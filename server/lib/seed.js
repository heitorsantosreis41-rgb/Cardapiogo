// ============================================================
// SEED — Cria o restaurante de demonstração "Burger House"
// na primeira execução, com usuário demo.
// ============================================================
const db = require("./db");
const auth = require("./auth");

const DEMO_EMAIL = "demo@cardapiogo.com.br";
const DEMO_PASS = "demo123";

async function seed() {
  const existing = db.all("users").find((u) => u.email === DEMO_EMAIL);
  if (existing) return { created: false, email: DEMO_EMAIL };

  const hash = await auth.hashPassword(DEMO_PASS);
  const user = db.insert("users", {
    nome: "Burger House",
    email: DEMO_EMAIL,
    senha_hash: hash,
    telefone: "(11) 99999-0000",
    onboarding_done: true,
  });

  const restaurant = db.insert("restaurants", {
    user_id: user.id,
    nome: "Burger House",
    slug: "burger-house",
    logo: "",
    capa: "",
    descricao: "Hambúrgueres artesanais, porções crocantes e milkshakes irresistíveis. Venha nos visitar!",
    whatsapp: "5511999990000",
    instagram: "burgerhouse",
    endereco: "Rua das Palmeiras, 123 - São Paulo, SP",
    tema: "moderno",
    cores: { primaria: "#e63946", botao: "#e63946", fundo: "#f4f4f5" },
    card_estilo: "red",
    publicado: true,
    onboarding_done: true,
  });

  db.insert("subscriptions", {
    user_id: user.id,
    plano: "gratis",
    status: "ativo",
    data_inicio: new Date().toISOString(),
    data_renovacao: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  });

  const seedCategories = [
    { nome: "Hambúrgueres", emoji: "🍔" },
    { nome: "Porções", emoji: "🍟" },
    { nome: "Bebidas", emoji: "🥤" },
    { nome: "Sobremesas", emoji: "🍰" },
  ];
  const seedProducts = [
    { nome: "Classic Burger", descricao: "Pão brioche, hambúrguer 180g, queijo prato, alface, tomate e maionese da casa.", preco: 22.9, cat: "Hambúrgueres", destaque: true },
    { nome: "Bacon Burger", descricao: "Hambúrguer artesanal, queijo, bacon crocante e molho especial.", preco: 26.9, cat: "Hambúrgueres", destaque: true },
    { nome: "Batata Especial", descricao: "Porção de batatas rústicas com cheddar e bacon.", preco: 14.9, cat: "Porções" },
    { nome: "Coca-Cola", descricao: "Lata 350ml.", preco: 6.0, cat: "Bebidas" },
    { nome: "Milkshake de Chocolate", descricao: "Milkshake cremoso de chocolate com calda.", preco: 15.9, cat: "Sobremesas", destaque: true },
  ];

  const catMap = {};
  seedCategories.forEach((c, i) => {
    const cat = db.insert("categories", {
      restaurant_id: restaurant.id,
      nome: c.nome,
      emoji: c.emoji,
      ordem: i,
    });
    catMap[c.nome] = cat.id;
  });

  seedProducts.forEach((p) => {
    db.insert("products", {
      restaurant_id: restaurant.id,
      category_id: catMap[p.cat],
      nome: p.nome,
      descricao: p.descricao,
      preco: p.preco,
      imagem: "",
      disponivel: true,
      destaque: !!p.destaque,
      ingredientes: "",
    });
  });

  const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  dias.forEach((d, i) => {
    const fechado = i === 6; // domingo fechado
    db.insert("business_hours", {
      restaurant_id: restaurant.id,
      dia: d,
      dia_idx: i,
      fechado,
      periodos: fechado ? [] : [{ abertura: "11:00", fechamento: "15:00" }, { abertura: "18:00", fechamento: "23:00" }],
    });
  });

  return { created: true, email: DEMO_EMAIL, senha: DEMO_PASS };
}

module.exports = { seed, DEMO_EMAIL, DEMO_PASS };