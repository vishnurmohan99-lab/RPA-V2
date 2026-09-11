import type { Page } from 'playwright';
import { scoreWithWhy } from './score.js';
import type { Candidate, Kind, Match } from './types.js';

const ATTR = 'data-atlas-ref';

/**
 * Runs inside the real page. Written as a plain JS string, not a TS function reference:
 * Playwright serializes an evaluate function via `.toString()` and re-runs the source in an
 * isolated browser context, but tsx/esbuild injects a `__name(...)` name-preservation helper
 * into every function it compiles (including this one, however it's written) — and that
 * helper doesn't exist in the isolated context, so the call throws. A string literal is never
 * passed through esbuild's transform, so it survives untouched. Keep this in sync with the
 * commented-out equivalent below if you ever change the scan logic.
 */
const SCAN_SOURCE = `(function (attr) {
  var out = [];
  var n = 0;
  var seen = new Set();

  function visibleText(el) {
    return (el.innerText || el.textContent || '').trim();
  }

  function accessibleName(el) {
    var aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    var labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      var t = labelledby.split(/\\s+/).map(function (id) {
        var byId = document.getElementById(id);
        return byId ? byId.textContent : '';
      }).join(' ').trim();
      if (t) return t;
    }
    var id = el.id;
    if (id) {
      var lbl = document.querySelector('label[for="' + CSS.escape(id) + '"]');
      if (lbl) return (lbl.textContent || '').trim();
    }
    var closestLabel = el.closest('label');
    if (closestLabel) return (closestLabel.textContent || '').trim();
    // A <label> that names this field but was never wired up with for="..." -- common enough on
    // real, imperfectly-marked-up sites (a floating-label div holding one input plus one label
    // with no for attribute) that it's worth a nearby-container fallback before giving up.
    var node = el.parentElement;
    for (var depth = 0; depth < 3 && node; depth++) {
      var nearbyLabel = node.querySelector('label');
      if (nearbyLabel && !nearbyLabel.getAttribute('for')) {
        var nearbyText = (nearbyLabel.textContent || '').trim();
        if (nearbyText) return nearbyText;
      }
      node = node.parentElement;
    }
    var placeholder = el.placeholder;
    if (placeholder) return placeholder.trim();
    var title = el.getAttribute('title');
    if (title) return title.trim();
    return visibleText(el).slice(0, 160);
  }

  function push(el, kind) {
    if (seen.has(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return;
    var label = accessibleName(el);
    if (!label) return;
    seen.add(el);
    var ref = String(n++);
    el.setAttribute(attr, ref);
    out.push({ ref: ref, kind: kind, label: label, box: { x: r.x, y: r.y, width: r.width, height: r.height } });
  }

  // Order matters: more specific roles first, since seen skips an element already tagged.
  document.querySelectorAll('nav a, [role=navigation] a, [role=tab]').forEach(function (el) { push(el, 'nav'); });
  document.querySelectorAll('h1, h2, [role=heading]').forEach(function (el) { push(el, 'screen'); });
  document.querySelectorAll('th, [role=columnheader]').forEach(function (el) { push(el, 'column'); });
  document.querySelectorAll('table, [role=table]').forEach(function (el) { push(el, 'table'); });
  document.querySelectorAll('input[type=file]').forEach(function (el) { push(el, 'upload'); });
  document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=file]):not([type=hidden]):not([type=password]), textarea, select').forEach(function (el) { push(el, 'field'); });
  document.querySelectorAll('input[type=submit], input[type=button], button, [role=button], a[href]').forEach(function (el) { push(el, 'button'); });

  return out;
})`;

async function scanCandidates(page: Page): Promise<Candidate[]> {
  return page.evaluate(`(${SCAN_SOURCE})(${JSON.stringify(ATTR)})`) as unknown as Promise<Candidate[]>;
}

export async function resolve(page: Page, want: string, kinds: Kind[]): Promise<{ best: Match | null; all: Match[] }> {
  const all = (await scanCandidates(page))
    .filter((c) => kinds.includes(c.kind))
    .map((c) => ({ ...c, s: scoreWithWhy(want, c.label).s }))
    .sort((a, b) => b.s - a.s);
  return { best: all[0] ?? null, all };
}

export function locatorFor(page: Page, ref: string) {
  return page.locator(`[${ATTR}="${ref}"]`);
}

/** Every row's text in the column a `column` candidate's ref points at, keyed by a stable row-N id. */
export async function readColumnCells(page: Page, ref: string): Promise<{ id: string; text: string }[]> {
  return page.evaluate(
    `(function (ref) {
      var th = document.querySelector('[data-atlas-ref="' + ref + '"]');
      if (!th) return [];
      var table = th.closest('table');
      if (!table) return [];
      var headerRow = th.parentElement;
      var idx = Array.prototype.indexOf.call(headerRow.children, th);
      var body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
      var rows = Array.prototype.filter.call(body.rows, function (r) { return r.parentElement.tagName !== 'THEAD'; });
      return rows.map(function (r, i) {
        var cell = r.children[idx];
        return { id: 'row-' + i, text: cell ? (cell.innerText || cell.textContent || '').trim() : '' };
      });
    })(${JSON.stringify(ref)})`,
  ) as unknown as Promise<{ id: string; text: string }[]>;
}

/** Row count for a `table` candidate's ref, used by the plain "read the whole table" verb. */
export async function tableRowCount(page: Page, ref: string): Promise<number> {
  return page.evaluate(
    `(function (ref) {
      var table = document.querySelector('[data-atlas-ref="' + ref + '"]');
      if (!table) return 0;
      var body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
      return Array.prototype.filter.call(body.rows, function (r) { return r.parentElement.tagName !== 'THEAD'; }).length;
    })(${JSON.stringify(ref)})`,
  ) as unknown as Promise<number>;
}

/** Picking mode: which tagged element sits under a click in the live screenshot. */
export async function elementAt(page: Page, x: number, y: number): Promise<Candidate | null> {
  const all = await scanCandidates(page);
  const hit = (await page.evaluate(
    `(function(px, py, attr) { var el = document.elementFromPoint(px, py); if (!el) return null; var t = el.closest('[' + attr + ']'); return t ? t.getAttribute(attr) : null; })(${x}, ${y}, ${JSON.stringify(ATTR)})`,
  )) as string | null;
  const found = all.find((c) => c.ref === hit);
  if (found) return found;
  // A password input is deliberately never scanned as a nameable field (see the field selector
  // above) -- so Diane can never be asked to type a literal password into a step's saved value.
  // But clicking one while recording clearly means "this is the sign-in form", so hand back the
  // same {kind:'button', label:'Sign in'} shape a click on an actual "Sign in" button would --
  // the client already turns that into a proper signin step, with the real password coming from
  // the server's own environment file at run time, never typed into the app.
  const isPassword = (await page.evaluate(
    `(function(px, py) {
      var els = document.elementsFromPoint(px, py);
      for (var i = 0; i < els.length; i++) if (els[i].matches && els[i].matches('input[type=password]')) return true;
      return false;
    })(${x}, ${y})`,
  )) as boolean;
  if (isPassword) return { ref: '', kind: 'button', label: 'Sign in', box: { x: x - 1, y: y - 1, width: 2, height: 2 } };
  return null;
}
