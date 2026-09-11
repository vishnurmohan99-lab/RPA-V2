import type { Automation, Edge, Step } from './types';

/** Size of a node on the flow canvas. */
export const NODE_W = 240;
export const NODE_H = 88;

export interface Graph {
  steps: Step[];
  edges: Edge[];
}

export const chain = (steps: Step[]): Edge[] => steps.slice(1).map((s, i) => ({ a: steps[i].id, b: s.id }));

/** The wires for a workflow, rebuilt as a straight line if they are missing or point at steps that are gone. */
export function edgesOf(a: Pick<Automation, 'steps' | 'edges'>): Edge[] {
  const ids = new Set(a.steps.map((s) => s.id));
  const e = a.edges;
  if (e && e.every((x) => ids.has(x.a) && ids.has(x.b)) && (e.length > 0 || a.steps.length < 2)) return e;
  return chain(a.steps);
}

const outOf = (edges: Edge[], id: string) => edges.filter((e) => e.a === id);

/** The order a run takes: start at the first step with nothing before it, then follow the first (or "Yes") wire. */
export function orderSteps(steps: Step[], edges: Edge[]): Step[] {
  if (!steps.length) return [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const incoming = new Set(edges.map((e) => e.b));
  let cur: Step | undefined = steps.find((s) => !incoming.has(s.id)) ?? steps[0];
  const out: Step[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    const outs = outOf(edges, cur.id);
    const next = outs.find((e) => e.label !== 'No') ?? outs[0];
    cur = next ? byId.get(next.b) : undefined;
  }
  return out;
}

const leafOf = (steps: Step[], edges: Edge[]) => {
  const ord = orderSteps(steps, edges);
  return ord.length ? ord[ord.length - 1].id : null;
};

/** Put a step after another one (or at the end of the main path) and rewire around it. */
export function insertAfter(steps: Step[], edges: Edge[], afterId: string | null, item: Step): Graph {
  const s = [...steps];
  const e = edges.map((x) => ({ ...x }));
  const anchor = afterId && s.some((x) => x.id === afterId) ? afterId : leafOf(s, e);
  if (!anchor) return { steps: [...s, item], edges: e };
  s.splice(s.findIndex((x) => x.id === anchor) + 1, 0, item);
  const next = outOf(e, anchor).find((x) => x.label !== 'No') ?? outOf(e, anchor)[0];
  let label: string | undefined;
  if (next) {
    label = next.label;
    next.a = item.id;
    delete next.label;
  }
  e.push(label ? { a: anchor, b: item.id, label } : { a: anchor, b: item.id });
  return { steps: s, edges: e };
}

/** Take a step out and join what came before it to what came after. */
export function removeNode(steps: Step[], edges: Edge[], id: string): Graph {
  const ins = edges.filter((e) => e.b === id);
  const outs = outOf(edges, id);
  const e = edges.filter((x) => x.a !== id && x.b !== id).map((x) => ({ ...x }));
  if (ins.length && outs.length) {
    const target = (outs.find((o) => o.label !== 'No') ?? outs[0]).b;
    e.push(ins[0].label ? { a: ins[0].a, b: target, label: ins[0].label } : { a: ins[0].a, b: target });
  }
  return { steps: steps.filter((s) => s.id !== id), edges: e };
}

/** Add an "If" step with a Yes path (which carries on with the rest of the flow) and a No path. */
export function addBranch(steps: Step[], edges: Edge[], afterId: string | null, gate: Step, yes: Step, no: Step): Graph {
  const g = insertAfter(steps, edges, afterId, gate);
  const s = [...g.steps];
  const e = g.edges;
  s.splice(s.findIndex((x) => x.id === gate.id) + 1, 0, yes, no);
  const tail = outOf(e, gate.id)[0];
  if (tail) {
    tail.a = yes.id;
    delete tail.label;
  }
  e.push({ a: gate.id, b: yes.id, label: 'Yes' }, { a: gate.id, b: no.id, label: 'No' });
  return { steps: s, edges: e };
}

/**
 * The assistant edits an ordered list of steps. Apply that list to the graph: drop removed steps,
 * update changed ones in place, and wire new ones in after the step that now comes before them.
 */
export function syncOrder(steps: Step[], edges: Edge[], next: Step[]): Graph {
  const keep = new Set(next.map((s) => s.id));
  let g: Graph = { steps, edges };
  for (const st of steps) if (!keep.has(st.id)) g = removeNode(g.steps, g.edges, st.id);
  const byId = new Map(next.map((s) => [s.id, s]));
  g = {
    steps: g.steps.map((x) => {
      const n = byId.get(x.id);
      return n ? { ...x, ...n, x: x.x, y: x.y, moved: x.moved } : x;
    }),
    edges: g.edges,
  };
  const old = new Set(steps.map((s) => s.id));
  next.forEach((st, i) => {
    if (old.has(st.id)) return;
    if (i === 0) {
      const first = orderSteps(g.steps, g.edges)[0];
      g = { steps: [st, ...g.steps], edges: first ? [...g.edges, { a: st.id, b: first.id }] : g.edges };
    } else {
      g = insertAfter(g.steps, g.edges, next[i - 1].id, st);
    }
  });
  return g;
}

/** Top-to-bottom layout, with the two sides of a split next to each other. Nodes Diane moved stay put. */
export function layout(steps: Step[], edges: Edge[]): Step[] {
  const incoming: Record<string, number> = {};
  edges.forEach((e) => {
    incoming[e.b] = (incoming[e.b] ?? 0) + 1;
  });
  const pos: Record<string, { x: number; y: number }> = {};
  const seen = new Set<string>();
  const walk = (id: string, depth: number, x: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    pos[id] = { x, y: 28 + depth * 126 };
    const outs = outOf(edges, id);
    outs.forEach((e, i) => walk(e.b, depth + 1, outs.length > 1 ? x + (i === 0 ? -148 : 148) : x));
  };
  steps.filter((s) => !incoming[s.id]).forEach((r, i) => walk(r.id, 0, 210 + i * 340));
  steps.forEach((s) => {
    if (!seen.has(s.id)) walk(s.id, 0, 210);
  });
  const xs = Object.values(pos).map((p) => p.x);
  const shift = xs.length ? 40 - Math.min(...xs) : 0;
  return steps.map((s) => (s.moved || !pos[s.id] ? s : { ...s, x: pos[s.id].x + shift, y: pos[s.id].y }));
}
