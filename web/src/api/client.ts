import type { Automation, Destination, HouseRuleState, KeptFile, RunRecord, SignIn } from '../domain/types';

/** The runner is not reachable. The app keeps working from what it has in memory. */
export class Offline extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new Offline();
  }
  if (res.status >= 500) throw new Offline();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? 'Something went wrong. Nothing was changed.');
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export interface ServerState {
  automations: Automation[] | null;
  rules: HouseRuleState[] | null;
  signIns: SignIn[] | null;
  history: RunRecord[] | null;
}

export const api = {
  loadState: () => req<ServerState>('/state'),
  saveAutomations: (a: Automation[]) => req('/automations', json('PUT', a)),
  saveRules: (r: HouseRuleState[]) => req('/rules', json('PUT', r)),
  saveSignIns: (s: SignIn[]) => req('/signins', json('PUT', s.map(({ id, label, user }) => ({ id, label, user })))),
  saveHistory: (h: RunRecord[]) => req('/history', json('PUT', h)),
  addRun: (r: RunRecord) => req('/history', json('POST', r)),

  destinations: () => req<Destination[]>('/destinations'),
  files: () => req<KeptFile[]>('/files'),
  keepFile: (blob: Blob, name: string, automationId: string | null, runId: string | null) => {
    const form = new FormData();
    form.append('file', blob, name);
    form.append('name', name);
    if (automationId) form.append('automationId', automationId);
    if (runId) form.append('runId', runId);
    return req<KeptFile>('/files', { method: 'POST', body: form });
  },
  sendFile: (id: string, destination: string) => req<KeptFile>(`/files/${id}/send`, json('POST', { destination })),
  deleteFile: (id: string) => req(`/files/${id}`, { method: 'DELETE' }),
  fileUrl: (id: string) => `/api/files/${id}`,
  fileBlob: async (id: string) => {
    const res = await fetch(`/api/files/${id}`).catch(() => null);
    if (!res || !res.ok) throw new Offline();
    return res.blob();
  },

  // The real-browser runner: a Playwright session on the server, watched live over a WebSocket.
  startLiveRun: (automationId: string, mode: 'dry' | 'run') => req<{ runId: string }>('/runs', json('POST', { automationId, mode })),
  liveAnswer: (runId: string, label: string) => req(`/runs/${runId}/answer`, json('POST', { label })),
  liveNotNow: (runId: string) => req(`/runs/${runId}/not-now`, json('POST', {})),
  liveApprove: (runId: string) => req(`/runs/${runId}/approve`, json('POST', {})),
  liveDecline: (runId: string) => req(`/runs/${runId}/decline`, json('POST', {})),
  liveStop: (runId: string) => req(`/runs/${runId}/stop`, json('POST', {})),
  livePick: (runId: string, x: number, y: number) => req<{ label: string; kind: string } | null>(`/runs/${runId}/pick`, json('POST', { x, y })),
  liveScroll: (runId: string, deltaY: number) => req(`/runs/${runId}/scroll`, json('POST', { deltaY })),
  liveSocketUrl: (runId: string) => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/live?runId=${encodeURIComponent(runId)}`;
  },

  // A steps-free live browser used only while authoring, so Diane can see and click the
  // real Starting URL instead of the synthetic mockup — same WebSocket mechanism as a run.
  startBrowse: (url: string) => req<{ browseId: string }>('/browse', json('POST', { url })),
  browseClick: (browseId: string, x: number, y: number) => req<{ label: string; kind: string } | null>(`/browse/${browseId}/click`, json('POST', { x, y })),
  browseScroll: (browseId: string, deltaY: number) => req(`/browse/${browseId}/scroll`, json('POST', { deltaY })),
  stopBrowse: (browseId: string) => req(`/browse/${browseId}/stop`, json('POST', {})),
};
