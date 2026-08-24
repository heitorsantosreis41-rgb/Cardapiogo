// ============================================================
// EMAIL — envio de e-mails transacionais via Resend.
// Variáveis: RESEND_API_KEY (obrigatória) e EMAIL_FROM (opcional).
// ============================================================

const EMAIL_FROM = process.env.EMAIL_FROM || "CardápioGo <onboarding@resend.dev>";

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY não configurada; e-mail não enviado.");
    return { ok: false, skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${body}`);
  }
  return { ok: true };
}

function baseHtml(contentHtml) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f7;padding:24px">
    <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #eee">
      <div style="font-size:22px;font-weight:800;color:#e63946">🍔 CardápioGo</div>
      <div style="margin-top:18px;font-size:15px;line-height:1.6;color:#222">${contentHtml}</div>
      <div style="margin-top:22px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#999">Escaneou. Abriu. Pediu.</div>
    </div></body></html>`;
}

function cta(url, label) {
  return `<p style="margin:22px 0"><a href="${url}" style="background:#e63946;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${label}</a></p>`;
}

module.exports = { sendEmail, baseHtml, cta, EMAIL_FROM };