// ============================================================
// ABACATEPAY — Gateway de pagamento PIX (API v2)
// Usa apenas variáveis de ambiente. NUNCA exponha a chave ao frontend.
//
//   ABACATEPAY_API_KEY         -> chave de API (Bearer token)
//   ABACATEPAY_WEBHOOK_SECRET  -> secret definido ao criar o webhook no painel
//   ABACATEPAY_PUBLIC_KEY      -> chave pública (fixa da documentação)
// ============================================================
const crypto = require("crypto");

const API_BASE = "https://api.abacatepay.com/v2";

// Chave pública da AbacatePay (constante publicada na documentação oficial,
// usada para validar a assinatura HMAC do webhook). Não é segredo.
const DEFAULT_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

function configured() {
  return !!process.env.ABACATEPAY_API_KEY;
}

function publicKey() {
  return process.env.ABACATEPAY_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
}

function header() {
  return { Authorization: "Bearer " + process.env.ABACATEPAY_API_KEY, "Content-Type": "application/json" };
}

// Cria uma cobrança PIX (checkout transparente). amount_cents em centavos.
async function createPix({ amountCents, description, externalId, metadata }) {
  const data = {
    method: "PIX",
    data: {
      amount: amountCents,
      description: description || "Pagamento CardápioGo",
      externalId,
      metadata: metadata || {},
    },
  };

  const res = await fetch(API_BASE + "/transparents/create", {
    method: "POST",
    headers: header(),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error || !json.data) {
    const err = new Error((json && json.error) || "Falha ao criar cobrança PIX na AbacatePay");
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json.data;
}

// Consulta o status de um checkout transparente pelo id retornado na criação.
async function checkStatus(transparentId) {
  const res = await fetch(API_BASE + "/transparents/check?id=" + encodeURIComponent(transparentId), {
    method: "GET",
    headers: header(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error || !json.data) {
    const err = new Error((json && json.error) || "Falha ao checar o status do PIX");
    err.status = res.status;
    throw err;
  }
  return json.data; // { id, status, expiresAt }
}

// Valida a assinatura HMAC-SHA256 do webhook (header X-Webhook-Signature).
function verifyWebhookSignature(rawBody, signatureFromHeader) {
  if (!rawBody || !signatureFromHeader) return false;
  const expected = crypto
    .createHmac("sha256", publicKey())
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const A = Buffer.from(expected, "utf8");
  const B = Buffer.from(String(signatureFromHeader), "utf8");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

module.exports = { configured, createPix, checkStatus, verifyWebhookSignature, API_BASE };
