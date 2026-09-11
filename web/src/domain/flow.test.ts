import { describe, expect, it } from 'vitest';
import { makeStep } from './actions';
import { addBranch, chain, edgesOf, insertAfter, layout, orderSteps, removeNode, syncOrder } from './flow';
import { keywordParser } from './parser/keywordParser';
import { doneLine } from './runlog';

const node = (id: string) => ({ ...makeStep('note', null, id), id });
const ids = (g: { steps: ReturnType<typeof node>[]; edges: { a: string; b: string }[] }) => orderSteps(g.steps, g.edges).map((s) => s.id);

describe('flow graph', () => {
  const steps = ['a', 'b', 'c'].map(node);
  const edges = chain(steps);

  it('runs a straight line in order', () => {
    expect(ids({ steps, edges })).toEqual(['a', 'b', 'c']);
  });

  it('inserts a step between two others', () => {
    expect(ids(insertAfter(steps, edges, 'a', node('x')))).toEqual(['a', 'x', 'b', 'c']);
  });

  it('adds to the end when there is no anchor', () => {
    expect(ids(insertAfter(steps, edges, null, node('z')))).toEqual(['a', 'b', 'c', 'z']);
  });

  it('joins the flow back up when a step is removed', () => {
    expect(ids(removeNode(steps, edges, 'b'))).toEqual(['a', 'c']);
  });

  it('splits into two paths and runs the Yes path', () => {
    const g = addBranch(steps, edges, 'a', node('if'), node('yes'), node('no'));
    expect(ids(g)).toEqual(['a', 'if', 'yes', 'b', 'c']);
    expect(g.edges).toContainEqual({ a: 'if', b: 'no', label: 'No' });
  });

  it('lays nodes out top to bottom with the two paths side by side', () => {
    const g = addBranch(steps, edges, 'a', node('if'), node('yes'), node('no'));
    const pos = Object.fromEntries(layout(g.steps, g.edges).map((s) => [s.id, s]));
    expect(pos.a.y!).toBeLessThan(pos.if.y!);
    expect(pos.yes.y).toBe(pos.no.y);
    expect(pos.yes.x).not.toBe(pos.no.x);
  });

  it('leaves a node where Diane dragged it', () => {
    const moved = steps.map((s) => (s.id === 'b' ? { ...s, x: 999, y: 7, moved: true } : s));
    expect(layout(moved, edges).find((s) => s.id === 'b')).toMatchObject({ x: 999, y: 7 });
  });

  it('keeps assistant edits in step with the graph', () => {
    const first = keywordParser.parse('open the balances screen, pull anyone over 30 days, skip payer 99999, export it to the billing share', []);
    const g0 = syncOrder([], [], first.steps);
    expect(orderSteps(g0.steps, g0.edges).map((s) => s.sentence)).toEqual(first.steps.map((s) => s.sentence));
    const next = keywordParser.parse('actually leave out anyone on a payment plan', orderSteps(g0.steps, g0.edges));
    const g1 = syncOrder(g0.steps, g0.edges, next.steps);
    expect(orderSteps(g1.steps, g1.edges).map((s) => s.sentence)).toEqual(next.steps.map((s) => s.sentence));
  });

  it('rebuilds missing wires as a straight line', () => {
    expect(edgesOf({ steps, edges: undefined })).toEqual(edges);
  });

  it('writes run log lines in plain past tense', () => {
    expect(doneLine(makeStep('read', 'Balance'), { label: 'Balance', count: 11, pct: 96 })).toBe('Read the Balance column — 11 rows, 96% sure.');
  });
});
