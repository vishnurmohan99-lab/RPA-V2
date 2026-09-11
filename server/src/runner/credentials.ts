/**
 * A sign-in's password never lives in the app, an automation, or run history — only its name
 * does. The real-browser runner reads the actual password from the server's own environment,
 * one variable per saved sign-in: `cred-billing-ro` → `ATLAS_CRED_BILLING_RO`.
 */
export function envNameFor(signInId: string): string {
  const stripped = signInId.replace(/^cred-/, '');
  return `ATLAS_CRED_${stripped.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

/**
 * A password typed into the live-view popup (see mount.ts's POST /api/browse/:id/credential)
 * lands here, in this process's memory only — never in a step, an automation, the database, or
 * on disk. It's gone the moment the server restarts, same as never having set the env var at
 * all; that's the deliberate trade for not having to touch a real .env file or a host's
 * dashboard just to try a real sign-in once.
 */
const overrides = new Map<string, string>();

export function setPasswordOverride(signInId: string, value: string) {
  overrides.set(signInId, value);
}

export function passwordFor(signInId: string): string | undefined {
  return overrides.get(signInId) ?? process.env[envNameFor(signInId)];
}
