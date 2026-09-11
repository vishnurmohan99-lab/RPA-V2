/**
 * A sign-in's password never lives in the app, an automation, or run history — only its name
 * does. The real-browser runner reads the actual password from the server's own environment,
 * one variable per saved sign-in: `cred-billing-ro` → `ATLAS_CRED_BILLING_RO`.
 */
export function envNameFor(signInId: string): string {
  const stripped = signInId.replace(/^cred-/, '');
  return `ATLAS_CRED_${stripped.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

export function passwordFor(signInId: string): string | undefined {
  return process.env[envNameFor(signInId)];
}
