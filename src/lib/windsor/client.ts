/**
 * Minimal Windsor.ai client for the Facebook (Meta) connector.
 * Docs: https://windsor.ai/api-documentation/
 * Field list: https://connectors.windsor.ai/facebook/fields
 */

const CONNECTORS_BASE = "https://connectors.windsor.ai";
const ACCOUNTS_URL = "https://onboard.windsor.ai/api/common/ds-accounts";

export class WindsorError extends Error {}

export function windsorKey() {
  return process.env.WINDSOR_API_KEY?.trim() || null;
}

export function isLiveMode() {
  return Boolean(windsorKey());
}

type Row = Record<string, string | number | null>;

export async function fetchFacebook(opts: {
  fields: string[];
  from: string;
  to: string;
  accounts?: string[];
  attributionWindow?: string;
  timeoutMs?: number;
}): Promise<Row[]> {
  const key = windsorKey();
  if (!key) throw new WindsorError("WINDSOR_API_KEY is not set.");
  const url = new URL(`${CONNECTORS_BASE}/facebook`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("date_from", opts.from);
  url.searchParams.set("date_to", opts.to);
  url.searchParams.set("fields", opts.fields.join(","));
  if (opts.accounts?.length) url.searchParams.set("select_accounts", opts.accounts.join(","));
  const window = opts.attributionWindow ?? process.env.WINDSOR_ATTRIBUTION_WINDOW;
  if (window) url.searchParams.set("options", JSON.stringify({ facebook: { attribution_window: window } }));

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new WindsorError(`Windsor returned a non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const err = extractError(body);
  if (!res.ok || err) throw new WindsorError(err ?? `Windsor request failed with HTTP ${res.status}`);
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new WindsorError("Unexpected Windsor response: missing `data` array.");
  return data as Row[];
}

// Windsor has returned both {"error": "..."} and {"error": {"message": "..."}}.
function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const e = (body as { error: unknown }).error;
  if (!e) return null;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return JSON.stringify(e);
}

export type WindsorAccount = { id: string; name: string; status: string | null };

/** Meta ad accounts connected in Windsor. An invalid key returns an empty list, not an error. */
export async function listFacebookAccounts(): Promise<WindsorAccount[]> {
  const key = windsorKey();
  if (!key) throw new WindsorError("WINDSOR_API_KEY is not set.");
  const url = new URL(ACCOUNTS_URL);
  url.searchParams.set("datasource", "facebook");
  url.searchParams.set("api_key", key);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new WindsorError(`Could not list Windsor accounts (HTTP ${res.status}).`);
  const body = (await res.json()) as unknown;
  const list = Array.isArray(body) ? body : ((body as { data?: unknown[] })?.data ?? []);
  return (list as Record<string, unknown>[])
    .filter((a) => !a.datasource || a.datasource === "facebook")
    .map((a) => ({
      id: normalizeAccountId(String(a.account_id ?? "")),
      name: String(a.account_name ?? a.account_id ?? "Unnamed account"),
      status: a.status ? String(a.status) : null,
    }))
    .filter((a) => a.id);
}

/** Store account IDs without the `act_` prefix so both forms match. */
export function normalizeAccountId(id: string) {
  return id.trim().replace(/^act_/, "");
}
