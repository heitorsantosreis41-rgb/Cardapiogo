// ============================================================
// CardápioGo — Servidor principal (Express)
// MicroSaaS de cardápio digital. Todas as rotas e regras de negócio.
// ============================================================
const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("./lib/db");
const auth = require("./lib/auth");
const { PLANS, TEMAS, PLANO_PADRAO, maxProdutos, planosArray } = require("./lib/plans");
const menu = require("./lib/menu_render");
const qr = require("./lib/qr");
const seed = require("./lib/seed");
const abacate = require("./lib/abacate");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.CG_BASE_URL || `http://localhost:${PORT}`;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

db.load();
seed.seed().then((r) => {
  if (r.created) console.log("Seeded demo: " + r.email + " / " + r.senha);
});

// ============================================================
// WEBHOOK ABACATEPAY (registrado ANTES do express.json p/ ler o corpo raw)
// Confirmação real de pagamento. Libera o plano SOMENTE aqui ou no check.
// ============================================================
app.post("/api/webhooks/abacatepay", express.raw({ type: "application/json" }), (req, res) => {
  try {
    // 1) Secret na URL (mesmo valor definido ao criar o webhook no painel)
    if (req.query.webhookSecret !== (process.env.ABACATEPAY_WEBHOOK_SECRET || "")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // 2) Assinatura HMAC (garante origem + corpo intacto)
    const signature = req.get("X-Webhook-Signature");
    if (!abacate.verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    const evt = JSON.parse(req.body.toString("utf8"));
    if (evt && evt.event === "transparent.completed" && evt.data && evt.data.transparent) {
      const t = evt.data.transparent;
      if (t.status === "PAID") {
        // Idempotência: ignora eventos já processados
        const evtKey = evt.event + ":" + t.id;
        if (!db.all("webhook_events").find((e) => e.key === evtKey)) {
          db.insert("webhook_events", { key: evtKey, processed_at: new Date().toISOString(), event: evt.event });
          const pay = db.all("payments").find((p) => p.external_id === t.externalId || p.abacate_id === t.id);
          if (pay) {
            db.update("payments", pay.id, { status: "PAID" });
            const user = db.getById("users", pay.user_id);
            if (user) activatePlanByPayment({ ...pay, status: "PAID" }, user);
          }
        }
      }
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e.message);
    return res.status(500).json({ error: "Internal" });
  }
});

app.use(express.json({ limit: "8mb" }));

// Cookie reader simples
app.use((req, res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) {
    raw.split(";").forEach((p) => {
      const i = p.indexOf("=");
      if (i > -1) req.cookies[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
  }
  next();
});

const api = express.Router();

// ============ HELPERS ============
function getOwnRestaurant(user) {
  return db.all("restaurants").find((r) => r.user_id === user.id) || null;
}
function getOwnSub(user) {
  return db.all("subscriptions").find((s) => s.user_id === user.id) || null;
}
function productCount(restaurantId) {
  return db.count("products", (p) => p.restaurant_id === restaurantId);
}
function serializeUser(u) {
  return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, onboarding_done: !!u.onboarding_done };
}
function serializeRestaurant(r) {
  if (!r) return null;
  const c = Object.assign({}, r);
  delete c.user_id;
  return c;
}
function planPayload(sub, restaurantId) {
  const plano = PLANS[(sub && sub.plano) || PLANO_PADRAO] || PLANS[PLANO_PADRAO];
  return {
    plano: plano,
    limite: maxProdutos(plano.id),
    ilimitado: plano.max_produtos === Infinity,
    produtos_utilizados: restaurantId ? productCount(restaurantId) : 0,
  };
}
async function uniqueSlug(base) {
  const slug = menu.slugify(base) || "cardapio";
  let s = slug, n = 2;
  while (db.all("restaurants").find((r) => r.slug === s)) {
    s = slug + "-" + n++;
  }
  return s;
}

// ============ AUTH ============
api.post("/auth/register", async (req, res) => {
  const { nome, email, senha, restaurante, whatsapp } = req.body || {};
  if (!nome || !email || !senha) return res.status(400).json({ error: "Preencha nome, e-mail e senha." });
  if (String(senha).length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  const em = String(email).toLowerCase().trim();
  if (db.all("users").find((u) => u.email === em)) return res.status(409).json({ error: "Este e-mail já está cadastrado." });

  const hash = await auth.hashPassword(senha);
  const user = db.insert("users", { nome: String(nome), email: em, senha_hash: hash, telefone: "", onboarding_done: false });
  db.insert("subscriptions", { user_id: user.id, plano: PLANO_PADRAO, status: "ativo", data_inicio: new Date().toISOString(), data_renovacao: new Date(Date.now() + 2592000000).toISOString() });

  // Cria o restaurante já (onboarding preenche os detalhes)
  const slug = await uniqueSlug(nome);
  db.insert("restaurants", {
    user_id: user.id, nome: String(nome), slug,
    whatsapp: whatsapp || "", logo: "", capa: "", descricao: "",
    instagram: "", endereco: "", tema: "moderno",
    cores: { primaria: "#e63946", botao: "#e63946", fundo: "#f4f4f5" },
    card_estilo: "red", publicado: true,
  });
  // Horários default (todos abertos 09-18)
  ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].forEach((d, i) => {
    db.insert("business_hours", { restaurant_id: db.all("restaurants").find(r=>r.user_id===user.id).id, dia: d, dia_idx: i, fechado: false, periodos: [{ abertura: "09:00", fechamento: "18:00" }] });
  });

  const token = auth.createSession(user.id);
  auth.setSessionCookie(res, token);
  res.status(201).json({ user: serializeUser(user), ok: true });
});

api.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body || {};
  const em = String(email || "").toLowerCase().trim();
  const user = db.all("users").find((u) => u.email === em);
  if (!user || !(await auth.verifyPassword(senha, user.senha_hash))) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  const token = auth.createSession(user.id);
  auth.setSessionCookie(res, token);
  res.json({ user: serializeUser(user) });
});

api.post("/auth/logout", (req, res) => {
  const token = req.cookies && req.cookies[auth.SESSION_COOKIE];
  if (token) auth.destroySession(token);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/auth/me", auth.requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

// Recuperação de senha (gera token de reset)
api.post("/auth/forgot", async (req, res) => {
  const em = String(req.body && req.body.email || "").toLowerCase().trim();
  const user = db.all("users").find((u) => u.email === em);
  if (user) {
    const token = require("crypto").randomBytes(24).toString("hex");
    db.insert("password_resets", { user_id: user.id, token, used: false, expires_at: new Date(Date.now() + 3600000).toISOString() });
    // Sem SMTP real: retornamos o link de redefinição (em produção, enviar por e-mail).
    res.json({ ok: true, resetLink: `${HOST}/reset?token=${token}` });
  } else {
    res.json({ ok: true });
  }
});

api.post("/auth/reset", async (req, res) => {
  const { token, senha } = req.body || {};
  if (!token || String(senha || "").length < 6) return res.status(400).json({ error: "Token inválido ou senha curta." });
  const rec = db.all("password_resets").find((r) => r.token === token && r.expires_at > new Date().toISOString() && !r.used);
  if (!rec) return res.status(400).json({ error: "Link de redefinição inválido ou expirado." });
  const hash = await auth.hashPassword(senha);
  db.update("users", rec.user_id, { senha_hash: hash });
  db.update("password_resets", rec.id, { used: true });
  res.json({ ok: true });
});

api.post("/auth/change-password", auth.requireAuth, async (req, res) => {
  const { senha_atual, nova_senha } = req.body || {};
  if (!(await auth.verifyPassword(senha_atual, req.user.senha_hash))) return res.status(400).json({ error: "Senha atual incorreta." });
  if (String(nova_senha || "").length < 6) return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
  const hash = await auth.hashPassword(nova_senha);
  db.update("users", req.user.id, { senha_hash: hash });
  res.json({ ok: true });
});

// ============ PLANS ============
api.get("/plans", (req, res) => res.json(planosArray()));
api.get("/me/subscription", auth.requireAuth, (req, res) => {
  const sub = getOwnSub(req.user);
  const rest = getOwnRestaurant(req.user);
  res.json(planPayload(sub, rest ? rest.id : null));
});
// Upgrade direto (sem gateway) só é aceito para planos GRATUITOS, ou em
// modo demo explícito (CG_ALLOW_INSTANT_UPGRADE=1) usado por testes/demo.
// Em produção, planos pagos exigem o checkout PIX (pagamento real confirmado).
api.post("/me/subscription/upgrade", auth.requireAuth, (req, res) => {
  const { plano } = req.body || {};
  if (!PLANS[plano]) return res.status(400).json({ error: "Plano inválido." });
  const isPaid = PLANS[plano].preco_mensal > 0;
  if (isPaid && process.env.CG_ALLOW_INSTANT_UPGRADE !== "1") {
    return res.status(403).json({ error: "Este plano exige pagamento via PIX. Inicie o checkout para ativar.", code: "PAYMENT_REQUIRED" });
  }
  const sub = getOwnSub(req.user);
  if (sub) {
    db.update("subscriptions", sub.id, {
      plano, status: "ativo",
      provider: isPaid ? "demo" : (sub.provider || "gratis"),
      data_renovacao: new Date(Date.now() + 2592000000).toISOString(),
    });
  }
  res.json(planPayload(getOwnSub(req.user), (getOwnRestaurant(req.user) || {}).id));
});

// ============ PAGAMENTO (AbacatePay PIX) ============
// Só libera o plano após confirmação REAL da AbacatePay (webhook ou check).
function serializePayment(p) {
  if (!p) return null;
  const plan = PLANS[p.plan_id];
  return {
    id: p.id, plan_id: p.plan_id, plan_nome: plan ? plan.nome : p.plan_id,
    preco_mensal: plan ? plan.preco_mensal : 0, preco_centavos: Math.round((plan ? plan.preco_mensal : 0) * 100),
    status: p.status || "PENDING", br_code: p.br_code || "", br_image: p.br_image || "",
    expires_at: p.expires_at || null, created_at: p.created_at,
  };
}

// Ativa o plano do usuário quando um pagamento está confirmado (status PAID).
// Idempotente: se o plano já está ativo, apenas marca o pagamento pago.
function activatePlanByPayment(pay, user) {
  const sub = getOwnSub(user);
  if (sub && sub.plano === pay.plan_id && sub.status === "ativo") {
    db.update("payments", pay.id, { paid_at: pay.paid_at || new Date().toISOString() });
    return true;
  }
  const now = new Date();
  const fields = { plano: pay.plan_id, status: "ativo", provider: "abacatepay", data_renovacao: new Date(now.getTime() + 2592000000).toISOString() };
  if (sub) db.update("subscriptions", sub.id, fields);
  else db.insert("subscriptions", Object.assign({ user_id: user.id, data_inicio: now.toISOString() }, fields));
  db.update("payments", pay.id, { paid_at: new Date().toISOString() });
  return true;
}

// Inicia o checkout PIX de um plano pago.
api.post("/me/subscription/checkout", auth.requireAuth, async (req, res) => {
  const { plano } = req.body || {};
  const plan = PLANS[plano];
  if (!plan) return res.status(400).json({ error: "Plano inválido." });
  if (plan.preco_mensal <= 0) return res.status(400).json({ error: "Este plano é gratuito e não requer pagamento." });
  const sub = getOwnSub(req.user);
  if (sub && sub.plano === plan.id && sub.status === "ativo") {
    return res.status(400).json({ error: "Você já está no plano " + plan.nome + ".", code: "ALREADY_ACTIVE" });
  }
  if (!abacate.configured()) {
    return res.status(503).json({ error: "Pagamentos ainda não configurados no servidor (falta ABACATEPAY_API_KEY)." });
  }
  const payment = db.insert("payments", {
    user_id: req.user.id, plan_id: plan.id, status: "PENDING",
    abacate_id: null, external_id: null, br_code: "", br_image: "", expires_at: null,
  });
  try {
    const data = await abacate.createPix({
      amountCents: Math.round(plan.preco_mensal * 100),
      description: "CardápioGo — Plano " + plan.nome + " (mensal)",
      externalId: payment.id,
      metadata: { cardapio_user: req.user.id, plano: plan.id },
      customer: { name: req.user.nome, email: req.user.email },
    });
    db.update("payments", payment.id, {
      abacate_id: data.id, external_id: payment.id,
      status: data.status || "PENDING", br_code: data.brCode || "",
      br_image: data.brCodeBase64 || "", expires_at: data.expiresAt || null,
      platform_fee: data.platformFee != null ? data.platformFee : null,
    });
    res.status(201).json({ checkout: serializePayment(db.getById("payments", payment.id)) });
  } catch (e) {
    db.remove("payments", payment.id);
    res.status(502).json({ error: e.message });
  }
});

// Consulta o status de um checkout (polling do frontend). Só o dono.
api.get("/me/subscription/checkout/:id", auth.requireAuth, async (req, res) => {
  const pay = db.getById("payments", req.params.id);
  if (!pay || pay.user_id !== req.user.id) return res.status(404).json({ error: "Pagamento não encontrado." });
  let p = pay;
  // Em PENDING, consulta a AbacatePay para refletir status real (sem liberar à toa).
  if (p.status === "PENDING" && p.abacate_id && abacate.configured()) {
    try {
      const st = await abacate.checkStatus(p.abacate_id);
      if (st && st.status && st.status !== p.status) {
        db.update("payments", p.id, { status: st.status });
        p = { ...p, status: st.status };
      }
    } catch (e) { /* falha de rede: mantém status local */ }
  }
  // Libera o plano somente quando a AbacatePay realmente reporta PAID.
  if (p.status === "PAID") activatePlanByPayment(db.getById("payments", p.id), req.user);
  res.json({ checkout: serializePayment(db.getById("payments", p.id)) });
});

// Botão "Já paguei": revalida o status na AbatecPay, NUNCA libera por conta própria.
api.post("/me/subscription/checkout/:id/check", auth.requireAuth, async (req, res) => {
  const pay = db.getById("payments", req.params.id);
  if (!pay || pay.user_id !== req.user.id) return res.status(404).json({ error: "Pagamento não encontrado." });
  let p = pay;
  if (p.abacate_id && abacate.configured()) {
    try {
      const st = await abacate.checkStatus(p.abacate_id);
      db.update("payments", p.id, { status: st.status });
      p = { ...p, status: st.status };
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  if (p.status === "PAID") activatePlanByPayment(db.getById("payments", p.id), req.user);
  res.json({ checkout: serializePayment(db.getById("payments", p.id)) });
});

api.put("/me", auth.requireAuth, (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (typeof b.nome === "string" && b.nome.trim()) patch.nome = b.nome.trim();
  if (typeof b.telefone === "string") patch.telefone = b.telefone;
  db.update("users", req.user.id, patch);
  res.json({ user: serializeUser(db.getById("users", req.user.id)) });
});

// ============ ONBOARDING / RESTAURANT ============
api.get("/me/restaurant", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.json({ restaurant: null });
  res.json({ restaurant: serializeRestaurant(r) });
});

api.put("/me/restaurant", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const b = req.body || {};
  const patch = {};
  ["nome", "descricao", "whatsapp", "instagram", "endereco", "logo", "capa"].forEach((k) => {
    if (typeof b[k] === "string") patch[k] = b[k].trim();
  });
  if (b.nome) patch.nome = String(b.nome).trim();
  db.update("restaurants", r.id, patch);
  res.json({ restaurant: serializeRestaurant(getOwnRestaurant(req.user)) });
});

api.put("/me/onboarding", auth.requireAuth, async (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const b = req.body || {};
  const patch = {};
  ["nome", "descricao", "whatsapp", "instagram", "logo", "capa", "endereco"].forEach((k) => {
    if (typeof b[k] === "string") patch[k] = b[k].trim();
  });
  if (b.tipo) patch.tipo = String(b.tipo);
  if (b.cores && typeof b.cores === "object") patch.cores = Object.assign({}, r.cores, b.cores);
  db.update("restaurants", r.id, patch);
  if (b.onboarding_done) db.update("users", req.user.id, { onboarding_done: true });
  res.json({ restaurant: serializeRestaurant(getOwnRestaurant(req.user)) });
});

// ============ CATEGORIAS ============
api.get("/categories", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.json([]);
  const cats = db.all("categories").filter((c) => c.restaurant_id === r.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  res.json(cats);
});
api.post("/categories", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const { nome, emoji } = req.body || {};
  if (!nome) return res.status(400).json({ error: "Informe o nome da categoria." });
  const maxOrdem = db.all("categories").filter((c) => c.restaurant_id === r.id).reduce((m, c) => Math.max(m, c.ordem || 0), -1);
  const cat = db.insert("categories", { restaurant_id: r.id, nome: String(nome), emoji: emoji || "", ordem: maxOrdem + 1 });
  res.status(201).json(cat);
});
api.put("/categories/:id", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const cat = db.getById("categories", req.params.id);
  if (!cat || !r || cat.restaurant_id !== r.id) return res.status(404).json({ error: "Categoria não encontrada." });
  const b = req.body || {};
  if (b.nome) cat.nome = String(b.nome);
  if (typeof b.emoji === "string") cat.emoji = b.emoji;
  db.update("categories", cat.id, { nome: cat.nome, emoji: cat.emoji });
  res.json(cat);
});
api.delete("/categories/:id", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const cat = db.getById("categories", req.params.id);
  if (!cat || !r || cat.restaurant_id !== r.id) return res.status(404).json({ error: "Categoria não encontrada." });
  db.remove("categories", cat.id);
  res.json({ ok: true });
});
api.post("/categories/reorder", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: "Lista de ordem inválida." });
  order.forEach((id, i) => {
    const cat = db.getById("categories", id);
    if (cat && cat.restaurant_id === r.id) db.update("categories", cat.id, { ordem: i });
  });
  res.json({ ok: true });
});

// ============ PRODUTOS ============
api.get("/products", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.json([]);
  res.json(db.all("products").filter((p) => p.restaurant_id === r.id));
});

function checkLimit(restaurantId, sub) {
  const plano = PLANS[(sub && sub.plano) || PLANO_PADRAO];
  const max = maxProdutos(plano.id);
  if (max === Infinity) return null;
  const used = productCount(restaurantId);
  if (used >= max) return { used, max, plano };
  return null;
}

api.post("/products", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const sub = getOwnSub(req.user);
  const blocked = checkLimit(r.id, sub);
  if (blocked) {
    return res.status(403).json({ error: `Você atingiu o limite de ${blocked.max} produtos do plano ${blocked.plano.nome}.`, code: "LIMIT", limite: blocked.max, plano: blocked.plano.id });
  }
  const b = req.body || {};
  if (!b.nome) return res.status(400).json({ error: "Informe o nome do produto." });
  const cat = b.category_id ? db.getById("categories", b.category_id) : null;
  if (cat && cat.restaurant_id !== r.id) return res.status(403).json({ error: "Categoria inválida." });
  const p = db.insert("products", {
    restaurant_id: r.id,
    category_id: cat ? cat.id : null,
    nome: String(b.nome),
    descricao: (b.descricao || ""),
    preco: Number(b.preco) || 0,
    imagem: (b.imagem || ""),
    disponivel: b.disponivel !== false,
    destaque: !!b.destaque,
    ingredientes: (b.ingredientes || ""),
  });
  res.status(201).json(p);
});
api.put("/products/:id", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const p = db.getById("products", req.params.id);
  if (!p || !r || p.restaurant_id !== r.id) return res.status(404).json({ error: "Produto não encontrado." });
  const b = req.body || {};
  if (b.nome) p.nome = String(b.nome);
  if (typeof b.descricao === "string") p.descricao = b.descricao;
  if (typeof b.preco !== "undefined") p.preco = Number(b.preco) || 0;
  if (typeof b.imagem === "string") p.imagem = b.imagem;
  if (typeof b.ingredientes === "string") p.ingredientes = b.ingredientes;
  if (typeof b.destaque === "boolean") p.destaque = b.destaque;
  if (typeof b.disponivel === "boolean") p.disponivel = b.disponivel;
  if (b.category_id) {
    const cat = db.getById("categories", b.category_id);
    if (cat && cat.restaurant_id === r.id) p.category_id = cat.id;
  }
  db.update("products", p.id, { nome: p.nome, descricao: p.descricao, preco: p.preco, imagem: p.imagem, ingredientes: p.ingredientes, destaque: p.destaque, disponivel: p.disponivel, category_id: p.category_id });
  res.json(p);
});
api.delete("/products/:id", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const p = db.getById("products", req.params.id);
  if (!p || !r || p.restaurant_id !== r.id) return res.status(404).json({ error: "Produto não encontrado." });
  db.remove("products", p.id);
  res.json({ ok: true });
});
api.post("/products/:id/duplicate", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const p = db.getById("products", req.params.id);
  if (!p || !r || p.restaurant_id !== r.id) return res.status(404).json({ error: "Produto não encontrado." });
  const sub = getOwnSub(req.user);
  const blocked = checkLimit(r.id, sub);
  if (blocked) {
    return res.status(403).json({ error: `Você atingiu o limite de ${blocked.max} produtos do plano ${blocked.plano.nome}.`, code: "LIMIT", limite: blocked.max, plano: blocked.plano.id });
  }
  const copy = db.insert("products", {
    restaurant_id: r.id, category_id: p.category_id, nome: p.nome + " (cópia)",
    descricao: p.descricao, preco: p.preco, imagem: p.imagem, disponivel: p.disponivel, destaque: p.destaque, ingredientes: p.ingredientes,
  });
  res.status(201).json(copy);
});
api.patch("/products/:id/toggle", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  const p = db.getById("products", req.params.id);
  if (!p || !r || p.restaurant_id !== r.id) return res.status(404).json({ error: "Produto não encontrado." });
  db.update("products", p.id, { disponivel: !p.disponivel });
  res.json({ ...p, disponivel: !p.disponivel });
});

// ============ HORÁRIOS ============
api.get("/business-hours", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.json([]);
  res.json(db.all("business_hours").filter((h) => h.restaurant_id === r.id).sort((a, b) => a.dia_idx - b.dia_idx));
});
api.put("/business-hours", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const list = req.body || [];
  list.forEach((item) => {
    const rec = db.all("business_hours").find((h) => h.restaurant_id === r.id && h.dia_idx === item.dia_idx);
    if (rec) db.update("business_hours", rec.id, { fechado: !!item.fechado, periodos: item.periodos || [] });
  });
  res.json({ ok: true });
});

// ============ APARÊNCIA ============
api.get("/me/appearance", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  res.json({ tema: r.tema, cores: r.cores, card_estilo: r.card_estilo, logo: r.logo, capa: r.capa });
});
api.put("/me/appearance", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const sub = getOwnSub(req.user);
  const plano = PLANS[(sub && sub.plano) || PLANO_PADRAO];
  const b = req.body || {};
  const patch = {};
  if (b.tema) {
    if ((plano.temas || []).includes(b.tema)) patch.tema = b.tema;
    else if (plano.temas.includes("moderno")) patch.tema = "moderno";
    else patch.tema = "moderno";
  }
  if (b.cores && typeof b.cores === "object") patch.cores = Object.assign({}, r.cores, b.cores);
  if (b.card_estilo) patch.card_estilo = b.card_estilo;
  if (typeof b.logo === "string") patch.logo = b.logo;
  if (typeof b.capa === "string") patch.capa = b.capa;
  db.update("restaurants", r.id, patch);
  res.json({ tema: patch.tema || r.tema, cores: patch.cores || r.cores, card_estilo: patch.card_estilo || r.card_estilo, logo: patch.logo || r.logo, capa: patch.capa || r.capa });
});

// ============ QR CODE ============
function qrPublicUrl(restaurant) {
  return `${HOST}/menu/${restaurant.slug}`;
}
api.get("/me/qr", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  res.json({ nome: r.nome, slug: r.slug, url: qrPublicUrl(r) });
});
api.get("/me/qr.png", auth.requireAuth, async (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const url = qrPublicUrl(r);
  const buf = await qr.qrPngBuffer(url);
  res.set("Content-Type", "image/png");
  res.set("Content-Disposition", `attachment; filename="qr-${r.slug}.png"`);
  res.send(buf);
});
api.get("/me/qr.pdf", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const url = qrPublicUrl(r);
  const buf = qr.qrPdfBuffer({ nome: r.nome, url, text: url });
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="qr-${r.slug}.pdf"`);
  res.send(buf);
});

// ============ ESTATÍSTICAS ============
api.get("/me/stats", auth.requireAuth, (req, res) => {
  const r = getOwnRestaurant(req.user);
  if (!r) return res.status(404).json({ error: "Restaurante não encontrado." });
  const sub = getOwnSub(req.user);
  const views = db.all("analytics").filter((a) => a.restaurant_id === r.id && a.tipo === "view");
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
  const visualizacoesHoje = views.filter((v) => v.created_at.slice(0, 10) === todayKey).length;
  const last7 = views.filter((v) => v.created_at.slice(0, 10) >= daysAgo(7)).length;
  const last30 = views.filter((v) => v.created_at.slice(0, 10) >= daysAgo(30)).length;
  const total = views.length;

  // Série por dia (últimos 30)
  const serie = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    serie.push({ data: d, valor: views.filter((v) => v.created_at.slice(0, 10) === d).length });
  }
  const porHora = {};
  const porDia = {};
  views.forEach((v) => {
    const h = new Date(v.created_at).getHours();
    porHora[h] = (porHora[h] || 0) + 1;
    const wd = new Date(v.created_at).getDay();
    porDia[wd] = (porDia[wd] || 0) + 1;
  });
  const horasTopo = Object.keys(porHora).map((h) => ({ hora: h + "h", valor: porHora[h] })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const diasTopo = Object.keys(porDia).map((h) => ({ dia: menu.DIAS_NAMES[h], valor: porDia[h] })).sort((a, b) => b.valor - a.valor).slice(0, 5);

  res.json({
    visualizacoesHoje, last7, last30, total,
    serie,
    horasMaisAcesso: horasTopo,
    diasMaisAcesso: diasTopo,
    premium: { produtosMaisVistos: [], categoriasMaisAcessadas: [] },
  });
});

// ============ CARDÁPIO PÚBLICO ============
api.post("/menu/:slug/view", (req, res) => {
  const r = db.all("restaurants").find((x) => x.slug === req.params.slug);
  if (r) db.insert("analytics", { restaurant_id: r.id, product_id: null, tipo: "view" });
  res.json({ ok: true });
});

// ============ APP MOUNT ============
app.use("/api", api);

// Página pública do cardápio
app.get("/menu/:slug", (req, res) => {
  const r = db.all("restaurants").find((x) => x.slug === req.params.slug);
  if (!r || r.publicado === false) {
    return res.status(404).send(fs.readFileSync(path.join(PUBLIC_DIR, "404.html"), "utf8"));
  }
  const cats = db.all("categories").filter((c) => c.restaurant_id === r.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const prods = db.all("products").filter((p) => p.restaurant_id === r.id);
  const hours = db.all("business_hours").filter((h) => h.restaurant_id === r.id);
  const html = menu.renderMenuHtml({ restaurant: r, categories: cats, products: prods, hours, host: HOST });
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ============ HEALTH CHECK ============
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ============ STATIC ============
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`\n🟢 CardápioGo rodando em ${HOST}`);
  console.log(`   Página pública demo: ${HOST}/menu/burger-house`);
});

module.exports = app;