import "server-only";

// Thin Resend wrapper. No SDK dependency — uses the REST API directly so the
// app builds without RESEND_API_KEY set. Returns { ok, id }: `id` is de Resend
// email-id, waarmee de nurture-meetlaag de webhook-events koppelt. `ok=false`
// (no-op) wanneer RESEND_API_KEY ontbreekt of Resend een fout geeft.
export type SendResult = { ok: boolean; id: string | null };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string }[]; // content = base64
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", opts.subject);
    return { ok: false, id: null };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from ?? "opeigenerf <info@opeigenerf.nl>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.bcc ? { bcc: opts.bcc } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend error", res.status, await res.text());
    return { ok: false, id: null };
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: data?.id ?? null };
}
