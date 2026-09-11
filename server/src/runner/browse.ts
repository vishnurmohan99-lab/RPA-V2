import { EventEmitter } from 'node:events';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { elementAt, locatorFor } from './resolve.js';
import type { Kind } from './types.js';

/**
 * A live, steps-free Playwright session used only while Diane is *building* a workflow: it
 * opens the workflow's real Starting URL and streams screenshots the same way `RunSession`
 * does, so the builder can show the real page instead of the synthetic mockup from the start.
 * `click()` both identifies what's under a point (for turning it into a step, same as
 * `RunSession.pick`) and actually clicks it, so following a real nav link or button moves the
 * session to the next real page — letting Diane record steps across more than one screen.
 */
export class BrowseSession extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  /** The last field clicked, so a follow-up `type()` call knows what to fill without the client having to track a ref. */
  private lastFieldRef: string | null = null;

  constructor(
    readonly id: string,
    private url: string,
  ) {
    super();
  }

  private send(e: unknown) {
    this.emit('event', e);
  }

  async start() {
    try {
      this.browser = await chromium.launch();
      this.context = await this.browser.newContext({ viewport: { width: 1280, height: 800 } });
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(12000);
      this.screenshotTimer = setInterval(() => this.snap(), 700);

      const start = this.url || 'about:blank';
      await this.page.goto(start, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => {
        this.send({ type: 'error', message: `Could not open ${start}: ${String(e.message ?? e).split('\n')[0]}` });
      });
      await this.snap();
    } catch {
      this.send({ type: 'error', message: 'Could not open a live browser to that address.' });
      await this.stop();
    }
  }

  private async snap() {
    if (!this.page || this.page.isClosed()) return;
    try {
      const buf = await this.page.screenshot({ type: 'jpeg', quality: 55, timeout: 2000 });
      this.send({ type: 'screenshot', dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}` });
    } catch {
      /* mid-navigation screenshot can fail; the next tick tries again */
    }
  }

  /** What's at this point, and (for a nav link or button) actually go there so recording can continue on the next page. */
  async click(x: number, y: number): Promise<{ label: string; kind: Kind } | null> {
    if (!this.page) return null;
    const hit = await elementAt(this.page, x, y);
    if (!hit) return null;
    this.lastFieldRef = hit.kind === 'field' && hit.ref ? hit.ref : null;
    await this.page.mouse.click(x, y).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {});
    await this.snap();
    return { label: hit.label, kind: hit.kind };
  }

  /** Fills the field last clicked — real, live typing on the real page, so what Diane sees on screen is what gets saved into the step. */
  async type(value: string) {
    if (!this.page || !this.lastFieldRef) return;
    await locatorFor(this.page, this.lastFieldRef)
      .fill(value)
      .catch(() => {});
    await this.snap();
  }

  /** Scrolls the real page — the 1280×800 screenshot is only ever one screenful, so this is how Diane sees the rest of a taller page. */
  async scroll(deltaY: number) {
    if (!this.page) return;
    await this.page.mouse.wheel(0, deltaY).catch(() => {});
    await this.snap();
  }

  async stop() {
    if (this.closed) return;
    this.closed = true;
    if (this.screenshotTimer) clearInterval(this.screenshotTimer);
    this.screenshotTimer = null;
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
