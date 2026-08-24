// ============================================================
// MENU_RENDER — Renderização server-side do cardápio público
// (SEO, Open Graph, mobile-first) + helpers de horário/estado.
// ============================================================
const { PLANS } = require("./plans");

function formatBRL(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const DIAS_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Verifica se o restaurante está aberto agora.
function abertoAgora(hours, now = new Date()) {
  const diaIdx = now.getDay(); // 0=Domingo
  const rec = (hours || []).find((h) => h.dia_idx === diaIdx);
  if (!rec || rec.fechado) return { aberto: false, mensagem: "Fechado" };
  const minutos = now.getHours() * 60 + now.getMinutes();
  const periodos = rec.periodos || [];
  for (const p of periodos) {
    if (!p.abertura || !p.fechamento) continue;
    const [ah, am] = p.abertura.split(":").map(Number);
    const [fh, fm] = p.fechamento.split(":").map(Number);
    const aMin = (ah || 0) * 60 + (am || 0);
    const fMin = (fh || 0) * 60 + (fm || 0);
    if (minutos >= aMin && minutos < fMin) {
      return { aberto: true };
    }
  }
  return { aberto: false, mensagem: "Fechado agora" };
}

function planMeta(planoId) {
  return PLANS[planoId] || PLANS.gratis;
}

function renderMenuHtml({ restaurant, categories, products, hours, host }) {
  const ab = abertoAgora(hours);
  const marca = planMeta(restaurant.plano_id).marca_cardapiogo;
  const primaria = (restaurant.cores && restaurant.cores.primaria) || "#e63946";
  const botao = (restaurant.cores && restaurant.cores.botao) || primaria;
  const fundo = (restaurant.cores && restaurant.cores.fundo) || "#f4f4f5";

  const title = `${restaurant.nome} | CardápioGo`;
  const url = `${host}/menu/${restaurant.slug}`;
  const descricao = (restaurant.descricao || "").slice(0, 160);

  const chips = categories
    .map((c) => `<button class="nav" data-cat="${c.id}">${esc(c.emoji || "")} ${esc(c.nome)}</button>`)
    .join("\n");

  const sections = categories
    .map((cat) => {
      const prods = products
        .filter((p) => p.category_id === cat.id)
        .map((p) => {
          const img = p.imagem
            ? `<img class="prod-img" src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
            : `<div class="prod-img prod-img-ph"></div>`;
          const destaque = p.destaque ? `<span class="tag-destaque">★ Destaque</span>` : "";
          const off = p.disponivel ? "" : `<div class="indisponivel">Indisponível</div>`;
          return `<div class="produto ${p.disponivel ? "" : "produto-off"}" data-nome="${esc(p.nome.toLowerCase())}" data-desc="${esc((p.descricao || "").toLowerCase())}">
            ${img}
            <div class="prod-info">
              <div class="prod-nome-row">${destaque}<h4 class="prod-nome">${esc(p.nome)}</h4></div>
              <p class="prod-desc">${esc(p.descricao || "")}</p>
              ${p.ingredientes ? `<p class="prod-ing">${esc(p.ingredientes)}</p>` : ""}
              ${off}
            </div>
            <div class="prod-price">${formatBRL(p.preco)}</div>
          </div>`;
        })
        .join("\n");
      return `<section class="cat-sec" id="cat-${cat.id}">
        <h3 class="cat-title">${esc(cat.emoji || "")} ${esc(cat.nome)}</h3>
        ${prods || `<div class="empty-cat">Nenhum produto nesta categoria ainda.</div>`}
      </section>`;
    })
    .join("\n");

  const logoHtml = restaurant.logo
    ? `<img class="logo" src="${esc(restaurant.logo)}" alt="Logo">`
    : `<div class="logo logo-ph">${esc((restaurant.nome || "C")[0].toUpperCase())}</div>`;

  const capaHtml = restaurant.capa
    ? `<img class="capa" src="${esc(restaurant.capa)}" alt="Capa">`
    : `<div class="capa" style="background:linear-gradient(135deg,${esc(primaria)},#1b1b1b)"></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(descricao)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(url)}">
${restaurant.logo ? `<meta property="og:image" content="${esc(restaurant.logo)}">` : ""}
<meta name="theme-color" content="${esc(primaria)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{--primaria:${esc(primaria)};--botao:${esc(botao)};--fundo:${esc(fundo)}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--fundo);color:#1a1a1a;line-height:1.5}
.wrap{max-width:640px;margin:0 auto;padding:16px 14px 30px}
.capa{width:100%;height:170px;object-fit:cover;border-radius:18px;display:block}
.header{text-align:center;margin-top:-44px;position:relative;padding:0 8px}
.logo{width:92px;height:92px;border-radius:50%;object-fit:cover;border:4px solid #fff;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.12);display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#fff}
.logo-ph{background:var(--primaria)}
.nome{font-size:25px;font-weight:800;margin-top:10px}
.desc{color:#555;font-size:14.5px;margin:6px 6px}
.status{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:99px;font-size:13px;font-weight:700;margin-top:8px}
.aberto{background:#e6f7ec;color:#1a8f4b}.fechado{background:#fdecec;color:#c0392b}
.contatos{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0 6px}
.contato{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:99px;background:#fff;border:1px solid #e6e6e6;color:#333}
.contato.whatsapp{background:#25d366;color:#fff;border:none}
.contato.insta{background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;border:none}
.search{margin:16px 0 6px}
.search input{width:100%;padding:13px 16px;border-radius:12px;border:1px solid #ddd;font-size:15px;background:#fff}
.navcats{display:flex;gap:8px;overflow-x:auto;padding:8px 0 12px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.navcats::-webkit-scrollbar{display:none}
.nav{flex:0 0 auto;padding:8px 14px;border-radius:99px;border:1px solid #e0e0e0;background:#fff;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit}
.nav.active{background:var(--botao);color:#fff;border-color:var(--botao)}
.cat-sec{margin-top:20px;scroll-margin-top:12px}
.cat-title{font-size:19px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.produto{display:flex;gap:14px;background:#fff;border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);border:1px solid #f0f0f0}
.produto-off{opacity:.55}
.prod-img{width:76px;height:76px;border-radius:12px;object-fit:cover;flex:0 0 auto}
.prod-img-ph{background:linear-gradient(135deg,#e8e8e8,#f7f7f7);flex:0 0 auto}
.prod-info{flex:1;min-width:0}
.prod-nome-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.prod-nome{font-size:15.5px;font-weight:700}
.prod-desc{color:#666;font-size:13.5px;margin-top:3px}
.prod-ing{color:#999;font-size:12.5px;margin-top:2px}
.prod-price{color:var(--botao);font-weight:800;font-size:16px;margin-left:auto;white-space:nowrap;align-self:center}
.tag-destaque{background:var(--botao);color:#fff;font-size:10px;padding:2px 8px;border-radius:99px;font-weight:700}
.indisponivel{color:#c0392b;font-size:12px;font-weight:700;margin-top:4px}
.empty-cat{color:#999;font-size:14px;padding:8px 0}
.no-results{text-align:center;color:#888;padding:30px 0;display:none}
.footer{text-align:center;padding:26px 0 6px;font-size:12px;color:#aaa}
.footer a{color:#aaa;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<div class="wrap">
  ${capaHtml}
  <div class="header">
    ${logoHtml}
    <h1 class="nome">${esc(restaurant.nome)}</h1>
    ${restaurant.descricao ? `<p class="desc">${esc(restaurant.descricao)}</p>` : ""}
    <span class="status ${ab.aberto ? "aberto" : "fechado"}">${ab.aberto ? "🟢 Aberto agora" : "🔴 " + esc(ab.mensagem || "Fechado")}</span>
  </div>
  <div class="contatos">
    ${restaurant.whatsapp ? `<a class="contato whatsapp" href="https://wa.me/${esc(restaurant.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
    ${restaurant.instagram ? `<a class="contato insta" href="https://instagram.com/${esc(restaurant.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""}
  </div>
  <div class="search"><input id="q" type="search" placeholder="O que você está procurando?" autocomplete="off"></div>
  ${categories.length ? `<div class="navcats" id="navcats">${chips}</div>` : ""}
  ${sections}
  <div class="no-results" id="noresults">Nenhum produto encontrado para sua busca. 🔍</div>
  <div class="footer">
    ${marca
      ? `Feito com <a href="${esc(host)}" target="_blank" rel="noopener">CardápioGo</a> · Escaneou. Abriu. Pediu.`
      : `Cardápio digital por CardápioGo`}
  </div>
</div>
<script>
(function(){
  try{fetch('${esc(host)}/api/menu/${restaurant.slug}/view',{method:'POST'})}catch(e){}
  var q=document.getElementById('q');
  var items=document.querySelectorAll('.produto');
  var secs=document.querySelectorAll('.cat-sec');
  var no=document.getElementById('noresults');
  function filt(){
    var t=(q?q.value:'').toLowerCase();var any=false;
    items.forEach(function(it){
      var m=!t||it.getAttribute('data-nome').indexOf(t)>-1||it.getAttribute('data-desc').indexOf(t)>-1;
      it.style.display=m?'':'none';if(m)any=true;
    });
    secs.forEach(function(s){var has=false;var pr=s.querySelectorAll('.produto');pr.forEach(function(p){if(p.style.display!=='none')has=true});s.style.display=has?'':'none';});
    no.style.display=any?'none':'block';
  }
  if(q)q.addEventListener('input',filt);
  var navs=document.querySelectorAll('.nav');
  navs.forEach(function(n){n.addEventListener('click',function(){
    navs.forEach(function(x){x.classList.remove('active')});n.classList.add('active');
    var el=document.getElementById('cat-'+n.getAttribute('data-cat'));
    if(el)el.scrollIntoView({behavior:'smooth'});
  })});
})();
</script>
</body>
</html>`;
}

module.exports = { formatBRL, slugify, abertoAgora, esc, planMeta, renderMenuHtml, DIAS_NAMES };