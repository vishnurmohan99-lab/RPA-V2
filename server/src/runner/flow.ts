/**
 * Step ordering only — ported from web/src/domain/flow.ts's orderSteps(). The runner needs
 * to walk a workflow's steps in run order; editing the graph (drag, insert, split) only
 * happens client-side, so nothing else from flow.ts is needed here.
 */
export interface OrderableStep {
  id: string;
}
export interface OrderableEdge {
  a: string;
  b: string;
  label?: string;
}

export function orderSteps<S extends OrderableStep>(steps: S[], edges: OrderableEdge[]): S[] {
  if (!steps.length) return [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const incoming = new Set(edges.map((e) => e.b));
  let cur: S | undefined = steps.find((s) => !incoming.has(s.id)) ?? steps[0];
  const out: S[] = [];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    const outs = edges.filter((e) => e.a === cur!.id);
    const next = outs.find((e) => e.label !== 'No') ?? outs[0];
    cur = next ? byId.get(next.b) : undefined;
  }
  return out;
}
