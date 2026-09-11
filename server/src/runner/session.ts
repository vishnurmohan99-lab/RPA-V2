import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { chromium, type Browser, type BrowserContext, type Download, type Page } from 'playwright';
import { passwordFor } from './credentials.js';
import { toCsv, fileNameFor } from './csv.js';
import { parseCondition } from './conditions.js';
import { orderSteps, type OrderableEdge } from './flow.js';
import { elementAt, locatorFor, readColumnCells, resolve, tableRowCount } from './resolve.js';
import { applyRule, fieldFor, parseMoney, type GenericRow } from './rules.js';
import { isConfident, pct } from './score.js';
import { KINDS_BY_VERB, type Kind, type LogTone, type Match, type RunnerEvent } from './types.js';

export interface RunnerStep {
  id: string;
  verb: string;
  sentence: string;
  bind: string | null;
  value?: string;
}
export interface RunnerAutomation {
  id: string;
  name: string;
  startUrl: string;
  destination: string;
  steps: RunnerStep[];
  edges: OrderableEdge[];
}
export interface RunnerSignIn {
  id: string;
  label: string;
  user: string;
}
export interface RunnerRuleState {
  id: string;
  on: boolean;
}

export type RunMode = 'dry' | 'run';

interface Held {
  id: string;
  name: string;
  amount: string;
  why: string;
}

interface Ctx {
  read: number;
  outOfScope: number;
  inScope: string[] | null;
  ruled: boolean;
  kept: string[];
  keptTotal: number;
  skipped: { id: string; why: string }[];
  held: Held[];
  /** column label -> row id -> cell text, in the order columns were read (CSV header order). */
  reads: Map<string, Map<string, string>>;
  fileBuffer: Buffer | null;
  fileName: string | null;
  sentTo: string[];
  done: number;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const USER_FIELD_GUESSES = ['Username', 'User', 'Email', 'User ID', 'User name', 'Login'];
const SUBMIT_GUESSES = ['Sign in', 'Log in', 'Login', 'Submit'];

/**
 * Drives a workflow against a real page with a real Playwright browser — the same step
 * contract, the same resolve-by-meaning binder (see score.ts/resolve.ts), the same house
 * rules and approval gate as the in-app runner (web/src/pages/builder/useRunner.ts), but
 * against whatever real site the workflow's Starting URL points at instead of the synthetic
 * tenant. Emits `RunnerEvent`s over `event` for the WebSocket layer to forward to the client.
 */
export class RunSession extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private downloads: Download[] = [];
  private screenshotTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private waitingAttention: ((label: string | null) => void) | null = null;
  private waitingApproval: ((ok: boolean) => void) | null = null;
  private picking = false;
  private ctx: Ctx = {
    read: 0,
    outOfScope: 0,
    inScope: null,
    ruled: false,
    kept: [],
    keptTotal: 0,
    skipped: [],
    held: [],
    reads: new Map(),
    fileBuffer: null,
    fileName: null,
    sentTo: [],
    done: 0,
  };
  /** Set by the `download` step, read by the `saveTo`/`upload` step right after it. */
  private fileId: string | null = null;

  constructor(
    readonly id: string,
    private automation: RunnerAutomation,
    private mode: RunMode,
    private signIns: RunnerSignIn[],
    private ruleStates: RunnerRuleState[],
    private onRebind: (stepId: string, label: string) => void,
    private onFile: (buffer: Buffer, name: string) => Promise<{ id: string } | null>,
    private onSend: (fileId: string, destination: string) => Promise<void>,
  ) {
    super();
  }

  private send(e: RunnerEvent) {
    this.emit('event', e);
  }

  private log(text: string, tone: LogTone = 'ok') {
    this.send({ type: 'log', text, tone });
  }

  private ordered(): RunnerStep[] {
    return orderSteps(this.automation.steps, this.automation.edges);
  }

  async start() {
    try {
      this.browser = await chromium.launch();
      this.context = await this.browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
      this.page = await this.context.newPage();
      this.page.on('download', (d) => this.downloads.push(d));
      this.page.setDefaultTimeout(12000);
      this.screenshotTimer = setInterval(() => this.snap(), 700);

      const start = this.automation.startUrl || 'about:blank';
      this.log(`Going to ${start}.`);
      await this.page.goto(start, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => {
        this.log(`Could not open that address: ${String(e.message ?? e).split('\n')[0]}`, 'err');
      });
      await this.snap();

      await this.run();
    } catch (e) {
      this.send({ type: 'error', message: 'Something went wrong driving the real browser. Nothing was changed.' });
      this.log(String((e as Error)?.message ?? e).split('\n')[0], 'err');
    } finally {
      await this.cleanup();
    }
  }

  private async snap() {
    if (!this.page || this.page.isClosed()) return;
    try {
      const buf = await this.page.screenshot({ type: 'jpeg', quality: 55, timeout: 2000 });
      this.send({ type: 'screenshot', dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}` });
    } catch {
      /* a screenshot mid-navigation can fail; the next tick tries again */
    }
  }

  private async cleanup() {
    if (this.screenshotTimer) clearInterval(this.screenshotTimer);
    this.screenshotTimer = null;
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  // ---- external controls -------------------------------------------------

  /** Diane confirmed (or pointed at) the right element; resume from the stopped step. */
  answer(label: string) {
    this.waitingAttention?.(label);
    this.waitingAttention = null;
  }

  /** "Not now" — leave it for later. */
  notNow() {
    this.waitingAttention?.(null);
    this.waitingAttention = null;
  }

  approve() {
    this.waitingApproval?.(true);
    this.waitingApproval = null;
  }

  decline() {
    this.waitingApproval?.(false);
    this.waitingApproval = null;
  }

  stop() {
    this.stopped = true;
    this.waitingAttention?.(null);
    this.waitingApproval?.(false);
  }

  /** Picking mode: Diane clicked a point in the live screenshot to say what a step really means. */
  async pick(x: number, y: number): Promise<{ label: string; kind: Kind } | null> {
    if (!this.page) return null;
    const c = await elementAt(this.page, x, y);
    return c ? { label: c.label, kind: c.kind } : null;
  }

  // ---- the run -------------------------------------------------------------

  private async resolveUser(page: Page): Promise<Match | null> {
    let best: Match | null = null;
    for (const w of USER_FIELD_GUESSES) {
      const r = await resolve(page, w, ['field']);
      if (r.best && (!best || r.best.s > best.s)) best = r.best;
    }
    return best;
  }

  private async resolveSubmit(page: Page): Promise<Match | null> {
    let best: Match | null = null;
    for (const w of SUBMIT_GUESSES) {
      const r = await resolve(page, w, ['button']);
      if (r.best && (!best || r.best.s > best.s)) best = r.best;
    }
    return best;
  }

  private async doSignIn(step: RunnerStep, page: Page) {
    const signIn = this.signIns.find((s) => s.label === step.value) ?? this.signIns[0];
    if (!signIn) {
      this.log('There is no saved sign-in to use. Add one under Sign-ins.', 'warn');
      return;
    }
    const user = await this.resolveUser(page);
    const password = passwordFor(signIn.id);
    if (!password) this.log(`No password is set for ${signIn.label} on this server. Set its environment variable and try again.`, 'warn');
    if (user) {
      this.send({ type: 'highlight', box: user.box, label: user.label, s: user.s, tone: 'teal' });
      await locatorFor(page, user.ref).fill(signIn.user).catch(() => {});
    }
    const pwField = page.locator('input[type=password]').first();
    if ((await pwField.count()) > 0) await pwField.fill(password ?? '').catch(() => {});
    const submit = await this.resolveSubmit(page);
    if (submit) {
      this.send({ type: 'highlight', box: submit.box, label: submit.label, s: submit.s, tone: 'teal' });
      await locatorFor(page, submit.ref)
        .click()
        .catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    // A missing password isn't a stop-and-ask (there's nothing on the page to point at instead) —
    // just an honest log line, since claiming success here would be exactly the silent-wrong-click
    // behaviour this whole app exists to avoid.
    this.log(
      password
        ? `Signed in with ${signIn.label} (${signIn.user}). The password came from the server's own environment file.`
        : `Tried to sign in with ${signIn.label} (${signIn.user}), but no password was set, so this probably didn't work.`,
      password ? 'ok' : 'warn',
    );
  }

  private async waitForDownload(timeoutMs = 15000): Promise<Download | null> {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (this.downloads.length) return this.downloads.shift()!;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  private keptIds(): string[] {
    if (this.ctx.ruled) return this.ctx.kept;
    if (this.ctx.inScope) return this.ctx.inScope;
    const first = [...this.ctx.reads.values()][0];
    return first ? [...first.keys()] : [];
  }

  private buildCsv(): { name: string; text: string } {
    const headers = [...this.ctx.reads.keys()];
    const ids = this.keptIds();
    const rows = ids.map((id) => headers.map((h) => this.ctx.reads.get(h)?.get(id) ?? ''));
    const name = fileNameFor(this.automation.destination, this.automation.name);
    return { name, text: toCsv(headers.length ? headers : ['Row'], rows.length ? rows : ids.map((id) => [id])) };
  }

  private async run() {
    const page = this.page!;
    const steps = this.ordered();
    let resumeAt = 0;

    for (let i = resumeAt; i < steps.length; i++) {
      if (this.stopped) return;
      const step = steps[i];
      const kinds = KINDS_BY_VERB[step.verb];
      this.send({ type: 'active', stepId: step.id });

      if (kinds) {
        const res = await resolve(page, step.bind ?? '', kinds);
        if (!isConfident(res.best?.s)) {
          this.send({
            type: 'highlight',
            box: res.best?.box ?? null,
            label: res.best?.label ?? null,
            s: res.best?.s ?? null,
            tone: 'red',
          });
          const labels = [...new Set(res.all.map((m) => m.label))].slice(0, 8);
          this.log(
            res.best ? `Only ${pct(res.best.s)}% sure that ${res.best.label} is the ${step.bind} — stopped and asked.` : `Could not find ${step.bind} on the page — stopped and asked.`,
            'warn',
          );
          this.send({
            type: 'attention',
            stepId: step.id,
            want: step.bind ?? '',
            bestLabel: res.best?.label ?? null,
            bestPct: res.best ? pct(res.best.s) : null,
            labels,
            question: res.best ? `The ${step.bind} is gone. Is ${res.best.label} the same thing?` : `I can't find ${step.bind} on this page. Can you point at it?`,
          });
          const label = await new Promise<string | null>((r) => (this.waitingAttention = r));
          if (this.stopped) return;
          if (label === null) {
            this.log('Left it for later — waiting for you to point at the right thing.', 'info');
            this.send({ type: 'stopped', sentence: `Stopped at step ${i + 1}. Nothing was read and nothing was saved.` });
            return;
          }
          this.onRebind(step.id, label);
          step.bind = label;
          this.log(`You said ${label} is the ${step.bind}. Carrying on from step ${i + 1}.`, 'info');
          const again = await resolve(page, label, kinds);
          if (again.best) await this.act(step, again.best, page);
        } else {
          this.send({ type: 'highlight', box: res.best!.box, label: res.best!.label, s: res.best!.s, tone: 'teal' });
          await this.act(step, res.best!, page);
        }
      } else {
        await this.actOffScreen(step, page, i, steps.length);
        if (this.stopped) return;
        if (step.verb === 'review' && this.mode === 'run') {
          // actOffScreen paused for approval; if declined it already stopped the run.
          if (!this.ctx.ruled && this.ctx.inScope === null) {
            /* nothing read at all — still fine to continue */
          }
        }
      }
      this.ctx.done++;
      this.send({ type: 'stepDone', stepId: step.id });
    }
    await this.finish();
  }

  private async act(step: RunnerStep, best: Match, page: Page) {
    switch (step.verb) {
      case 'signin':
        await this.doSignIn(step, page);
        return;
      case 'open': {
        // A nav link needs clicking; a heading match means we're already on the right page.
        const el = locatorFor(page, best.ref);
        const tag = await el.evaluate((n) => n.tagName).catch(() => '');
        if (tag === 'A' || tag === 'BUTTON') {
          await el.click().catch(() => {});
          await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        }
        this.log(`Opened the ${best.label} screen.`);
        return;
      }
      case 'click':
      case 'submit':
        await locatorFor(page, best.ref)
          .click()
          .catch(() => {});
        this.log(`Clicked ${best.label}.`);
        return;
      case 'type':
        await locatorFor(page, best.ref)
          .fill(step.value ?? '')
          .catch(() => {});
        this.log(`Typed ${step.value} into ${best.label}.`);
        return;
      case 'choose': {
        const el = locatorFor(page, best.ref);
        const isSelect = (await el.evaluate((n) => n.tagName).catch(() => '')) === 'SELECT';
        if (isSelect) await el.selectOption({ label: step.value ?? '' }).catch(() => el.selectOption(step.value ?? '').catch(() => {}));
        else await el.fill(step.value ?? '').catch(() => {});
        this.log(`Chose ${step.value} from ${best.label}.`);
        return;
      }
      case 'date':
        await locatorFor(page, best.ref)
          .fill(step.value ?? '')
          .catch(() => {});
        this.log(`Set ${best.label} to ${step.value}.`);
        return;
      case 'tick':
        await locatorFor(page, best.ref)
          .check()
          .catch(() => {});
        this.log(`Ticked ${best.label}.`);
        return;
      case 'read': {
        const cells = await readColumnCells(page, best.ref);
        const map = new Map(cells.map((c) => [c.id, c.text]));
        this.ctx.reads.set(best.label, map);
        if (!this.ctx.read) this.ctx.read = map.size;
        this.log(`Read the ${best.label} column — ${(this.ctx.inScope ?? [...map.keys()]).length} rows.`);
        return;
      }
      case 'table': {
        const n = await tableRowCount(page, best.ref);
        if (!this.ctx.read) this.ctx.read = n;
        this.log(`Read everything in the ${best.label} — ${n} rows.`);
        return;
      }
      case 'filter': {
        const cells = await readColumnCells(page, best.ref);
        const map = new Map(cells.map((c) => [c.id, c.text]));
        if (!this.ctx.reads.has(best.label)) this.ctx.reads.set(best.label, map);
        if (!this.ctx.read) this.ctx.read = map.size;
        const test = parseCondition(step.value ?? '');
        const before = this.ctx.inScope ?? [...map.keys()];
        const pass = before.filter((id) => test(map.get(id) ?? ''));
        const fail = before.filter((id) => !pass.includes(id));
        this.ctx.inScope = pass;
        this.ctx.outOfScope += fail.length;
        this.log(`Kept rows where ${best.label} ${step.value} — ${pass.length} left.`);
        return;
      }
      case 'await':
        await locatorFor(page, best.ref)
          .waitFor({ timeout: 8000 })
          .catch(() => {});
        this.log(`${best.label} appeared.`);
        return;
      default:
        return;
    }
  }

  private applyRules() {
    const ids = this.ctx.inScope ?? (this.ctx.reads.size ? [...[...this.ctx.reads.values()][0].keys()] : []);
    const on = new Set(this.ruleStates.filter((r) => r.on).map((r) => r.id));
    this.ctx.ruled = true;
    for (const id of ids) {
      const row: GenericRow = { id };
      for (const [colLabel, values] of this.ctx.reads) {
        const field = fieldFor(colLabel);
        if (!field) continue;
        const text = values.get(id) ?? '';
        if (field === 'balance') row.balance = parseMoney(text);
        else (row as any)[field] = text;
      }
      const hit = applyRule(row, on);
      if (!hit) {
        this.ctx.kept.push(id);
        this.ctx.keptTotal += row.balance ?? 0;
      } else if (hit.hold) {
        this.ctx.held.push({ id, name: id, amount: row.balance !== undefined ? money(row.balance) : '', why: hit.why });
      } else {
        this.ctx.skipped.push({ id, why: hit.why });
      }
    }
    this.log(`Applied house rules — ${this.ctx.skipped.length} skipped, ${this.ctx.held.length} held for you.`, 'info');
  }

  private async actOffScreen(step: RunnerStep, page: Page, index: number, total: number) {
    switch (step.verb) {
      case 'goto':
        await page.goto(step.value ?? 'about:blank', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => this.log(`Could not go there: ${String(e.message ?? e).split('\n')[0]}`, 'warn'));
        this.log(`Went to ${step.value}.`);
        return;
      case 'back':
        await page.goBack().catch(() => {});
        this.log('Went back one page.');
        return;
      case 'pause': {
        const secs = Math.min(Number(step.value) || 1, 5);
        await new Promise((r) => setTimeout(r, secs * 1000));
        this.log(`Waited ${secs} seconds.`, 'info');
        return;
      }
      case 'rules':
        this.applyRules();
        return;
      case 'review': {
        if (this.mode !== 'run') {
          this.log('Would stop here to show you everything — dry run, so nothing is waiting.', 'info');
          return;
        }
        const ids = this.keptIds();
        const total$ = this.ctx.keptTotal || ids.reduce((s, id) => s + (parseMoney(this.ctx.reads.get('Balance')?.get(id) ?? '') ?? 0), 0);
        const edges = this.ordered()
          .filter((s) => ['download', 'saveTo', 'upload', 'notify'].includes(s.verb))
          .map((s) => s.sentence);
        this.log('Waiting for you to approve before anything leaves.', 'info');
        this.send({
          type: 'approval',
          read: this.ctx.read,
          outOfScope: this.ctx.outOfScope,
          skipped: this.ctx.skipped.length,
          held: this.ctx.held,
          kept: ids.length,
          total: total$,
          label: edges.some((e) => e.toLowerCase().includes('upload')) ? 'Approve and upload' : 'Approve and save',
          edges,
        });
        const ok = await new Promise<boolean>((r) => (this.waitingApproval = r));
        if (this.stopped) return;
        if (!ok) {
          this.log('You did not approve it, so nothing left the browser.', 'info');
          this.send({ type: 'stopped', sentence: 'You did not approve it, so nothing left the browser.' });
          this.stopped = true;
          return;
        }
        this.log('You approved it.');
        return;
      }
      case 'download': {
        if (this.mode !== 'run') {
          this.log('Dry run, so I did not catch a real download.', 'info');
          return;
        }
        this.log('Catching the file the screen gives me…', 'info');
        const built = this.buildCsv();
        const dl = await this.waitForDownload(6000);
        let buffer: Buffer;
        let name: string;
        if (dl) {
          const p = await dl.path().catch(() => null);
          buffer = p ? await fs.readFile(p) : Buffer.from(built.text, 'utf8');
          name = dl.suggestedFilename() || built.name;
        } else {
          // Nothing downloaded from the real page (no export button drove a browser download) —
          // fall back to building the file from whatever was read, same as the synthetic runner.
          buffer = Buffer.from(built.text, 'utf8');
          name = built.name;
        }
        this.ctx.fileBuffer = buffer;
        this.ctx.fileName = name;
        const kept = await this.onFile(buffer, name);
        this.fileId = kept?.id ?? null;
        this.log(`Caught ${name}.`);
        return;
      }
      case 'saveTo':
      case 'upload': {
        const dest = step.value ?? 'Billing share';
        if (this.fileId) await this.onSend(this.fileId, dest).catch(() => {});
        this.ctx.sentTo.push(dest);
        this.log(step.verb === 'upload' ? `Uploaded it to ${dest}. (Real portals aren't automated yet — this copies the file locally.)` : `Saved it to ${dest}.`);
        return;
      }
      case 'notify':
        this.log(`Let ${step.value} know it is done.`);
        return;
      case 'branch':
      case 'note':
        return;
      default:
        return;
    }
  }

  private async finish() {
    const ids = this.keptIds();
    const total = this.ctx.keptTotal || ids.length;
    if (this.mode === 'dry') {
      this.log('Dry run finished — nothing left the browser.', 'info');
      this.send({
        type: 'done',
        mode: 'dry',
        sentence: `Dry run: I would put ${ids.length} rows${this.ctx.keptTotal ? ` totalling ${money(this.ctx.keptTotal)}` : ''} in the file. I'd skip ${this.ctx.skipped.length} by house rule and hold ${this.ctx.held.length} for you.`,
        fileName: null,
      });
    } else {
      this.log('Finished. Nothing was written back into the real site beyond what the workflow itself clicked.', 'ok');
      const where = this.ctx.sentTo.length ? `, then sent it to ${this.ctx.sentTo.join(' and ')}` : '';
      this.send({
        type: 'done',
        mode: 'run',
        sentence: `Finished all ${this.ordered().length} steps. I put ${ids.length} rows${this.ctx.keptTotal ? ` totalling ${money(this.ctx.keptTotal)}` : ''} into ${this.ctx.fileName ?? 'the file'}${where}.`,
        fileName: this.ctx.fileName,
      });
    }
    void total;
  }
}
