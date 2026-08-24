// ============================================================
// PLANS — Configuração central de planos, limites e preços.
// Edite aqui para alterar limites/preços sem tocar no resto do app.
// ============================================================

const PLANS = {
  gratis: {
    id: "gratis",
    nome: "Grátis",
    emoji: "🆓",
    preco_mensal: 0,
    max_produtos: 10,
    categorias_ilimitadas: false,
    marca_cardapiogo: true,
    personalizacao: "basica",
    estatisticas: "basicas",
    url_personalizada: false,
    temas: ["moderno", "minimalista"],
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    emoji: "🚀",
    preco_mensal: 29.9,
    max_produtos: 20,
    categorias_ilimitadas: true,
    marca_cardapiogo: false,
    personalizacao: "avancada",
    estatisticas: "avancadas",
    url_personalizada: true,
    temas: ["moderno", "minimalista", "elegante", "dark"],
  },
  premium: {
    id: "premium",
    nome: "Premium",
    emoji: "💎",
    preco_mensal: 59.9,
    max_produtos: Infinity,
    categorias_ilimitadas: true,
    marca_cardapiogo: false,
    personalizacao: "avancada",
    estatisticas: "avancadas",
    url_personalizada: true,
    temas: ["moderno", "minimalista", "elegante", "dark", "vibrante"],
  },
};

const PLANO_PADRAO = "gratis";

const TEMAS = {
  moderno: {
    nome: "Moderno",
    card_estilo: "cards",
    fundo: "#f7f7f8",
    texto: "#1a1a1a",
  },
  minimalista: {
    nome: "Minimalista",
    card_estilo: "linha",
    fundo: "#ffffff",
    texto: "#111111",
  },
  elegante: {
    nome: "Elegante",
    card_estilo: "soft",
    fundo: "#faf7f2",
    texto: "#241f1a",
  },
  dark: {
    nome: "Dark",
    card_estilo: "dark",
    fundo: "#121212",
    texto: "#f5f5f5",
  },
  vibrante: {
    nome: "Vibrante",
    card_estilo: "vibrante",
    fundo: "#fef6e4",
    texto: "#201a16",
  },
};

function maxProdutos(planoId) {
  const p = PLANS[planoId];
  if (!p) return PLANS[PLANO_PADRAO].max_produtos;
  return p.max_produtos;
}

function planosArray() {
  return Object.values(PLANS);
}

module.exports = { PLANS, TEMAS, PLANO_PADRAO, maxProdutos, planosArray };