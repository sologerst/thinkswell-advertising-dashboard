/**
 * The dashboard's public address (https://advertising.thinkswell.com in
 * production), used for invite / reset links and to redirect the old
 * *.vercel.app address. No server-only imports: the proxy uses it too.
 */
export function appUrl() {
  const explicit = process.env.APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
