/**
 * Same channel name derivation used by both the opener (Builder.tsx) and the popup
 * (LiveViewWindow) — keeping it in one place avoids the two ever drifting apart.
 *
 * Keyed by the *workflow's own id*, not the browse/run session id — the session id is ephemeral
 * (a fresh one is minted whenever the builder tab restarts its session: a reload, navigating away
 * and back, "Run in" toggling, a new dry run, ...). If the channel were keyed by that instead, a
 * popup opened against an older session would keep broadcasting into a channel nobody's
 * listening on any more the moment the builder's session changes underneath it, and every click
 * would silently do nothing on the builder side. The workflow id never changes for the life of
 * the popup tab, so this can't happen.
 */
export const liveChannelName = (automationId: string) => `atlas-live-${automationId}`;

export interface LiveHitMessage {
  type: 'hit';
  label: string;
  kind: string;
  /** Set only for a field: what Diane actually typed in the popup, filled live on the real page too. */
  value?: string;
}
