import "server-only";

// Thin Resend wrapper. No SDK dependency — uses the REST API directly so the
// app builds without RESEND_API_KEY set. Returns false (no-op) when unconfigured.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  bcc?: string;
  attachments?: { filename: string; content: string }[]; // content = base64
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", opts.subject);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from ?? "opeigenerf <noreply@opeigenerf.nl>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.bcc ? { bcc: opts.bcc } : {}),
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend error", res.status, await res.text());
    return false;
  }
  return true;
}
