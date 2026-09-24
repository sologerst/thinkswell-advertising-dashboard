import "server-only";

/**
 * Optional: if RESEND_API_KEY and EMAIL_FROM are set, invite / reset links are
 * emailed automatically. Otherwise admins copy the link from the UI.
 */
export async function sendAccessEmail(opts: {
  to: string;
  name: string;
  link: string;
  kind: "invite" | "reset";
  clientName?: string;
  from?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.EMAIL_FROM;
  if (!key || !sender) return false;

  const first = opts.name.split(" ")[0];
  const subject = opts.kind === "invite" ? `Your ${opts.clientName ?? "Thinkswell"} ads dashboard is ready` : "Reset your Thinkswell dashboard password";
  const intro =
    opts.kind === "invite"
      ? `${opts.from ? `${opts.from} at Thinkswell` : "Thinkswell"} set you up with a live dashboard for your Facebook &amp; Instagram campaigns.`
      : "Here's your link to choose a new password.";
  const html = `
  <div style="background:#111522;padding:40px 16px;font-family:Arial,sans-serif;color:#f8fbff">
    <div style="max-width:480px;margin:0 auto;background:#151a2c;border:1px solid #232a42;border-radius:20px;padding:32px">
      <div style="font-weight:700;font-size:20px;letter-spacing:-1px">thinkswell</div>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:24px 0 8px">Hey ${escapeHtml(first ?? "")},</h1>
      <p style="color:#b9c2d3;line-height:1.6">${intro}</p>
      <p style="margin:28px 0"><a href="${opts.link}" style="background:#49cbed;color:#111522;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">${opts.kind === "invite" ? "Set up my login" : "Choose a new password"}</a></p>
      <p style="color:#8290a8;font-size:12px;line-height:1.6">This link works once and expires ${opts.kind === "invite" ? "in 7 days" : "in 24 hours"}. If you weren't expecting it, you can ignore this email.</p>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: [opts.to], subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
