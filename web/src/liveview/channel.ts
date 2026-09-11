/** Same channel name derivation used by both the opener (Builder.tsx) and the popup (LiveViewWindow) — keeping it in one place avoids the two ever drifting apart. */
export const liveChannelName = (id: string) => `atlas-live-${id}`;

export interface LiveHitMessage {
  type: 'hit';
  label: string;
  kind: string;
}
