// ============ CardápioGo — Onboarding em 8 etapas ============
const DIAS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const TIPOS = ["Restaurante","Lanchonete","Pizzaria","Bar","Cafeteria","Food Truck","Padaria","Outros"];

let state = { step: 0, restaurant: null, hours: [] };
const totalSteps = 8;

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok && r.status === 401) { location.href = '/login.html'; throw new Error(d.error); }
  return { r, d };
}

async function init() {
  const { d } = await api('/api/me/restaurant');
  if (!d.restaurant) { location.href = '/login.html'; return; }
  state.restaurant = d.restaurant;
  // load hours
  const h = await api('/api/business-hours');
  state.hours = h.d;
  if (state.hours.length) {
    // sync
  } else {
    state.hours = DIAS.map((dia, i) => ({ dia_idx: i, dia, fechado: false, periodos: [{ abertura: '09:00', fechamento: '18:00' }] }));
  }
  render();
}

function render() {
  const s = state.step;
  const prog = document.getElementById('progress');
  prog.innerHTML = Array.from({ length: totalSteps }, (_, i) => `<div class="dot ${i <= s ? 'on' : ''}"></div>`).join('');
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  switch (s) {
    case 0: stage0(stage); break;
    case 1: stage1(stage); break;
    case 2: stage2(stage); break;
    case 3: stage3(stage); break;
    case 4: stage4(stage); break;
    case 5: stage5(stage); break;
    case 6: stage6(stage); break;
    case 7: stage7(stage); break;
    default: stage8(stage); break;
  }
}

function nav(next) {
  state.step = next;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stage0(stage) {
  stage.innerHTML = `<h1>Qual o nome do seu restaurante? 🏪</h1><p class="sub">Esse nome aparecerá no seu cardápio e na sua URL.</p>
  <div class="field"><label>Nome do restaurante</label><input id="nome" value="${esc(state.restaurant.nome)}"></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="logout()">Sair</button><button class="btn btn-primary" onclick="saveNome()">Continuar →</button></div>`;
}
async function saveNome() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) return;
  await api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ nome }) });
  state.restaurant.nome = nome;
  nav(1);
}

function stage1(stage) {
  stage.innerHTML = `<h1>Qual o tipo do seu negócio? 🍕</h1><p class="sub">Isso nos ajuda a personalizar sua experiência.</p>
  <div class="tipo-grid">${TIPOS.map(t => `<div class="tipo" data-t="${t}"><span class="te">${emojiFor(t)}</span>${t}</div>`).join('')}</div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(0)">← Voltar</button><button class="btn btn-primary" onclick="saveTipo()">Continuar →</button></div>`;
}
function emojiFor(t) {
  return { Restaurante: '🍽️', Lanchonete: '🍔', Pizzaria: '🍕', Bar: '🍺', Cafeteria: '☕', 'Food Truck': '🚚', Padaria: '🥐', Outros: '✨' }[t] || '✨';
}
function saveTipo() {
  const sel = document.querySelector('.tipo.sel');
  if (!sel) { alert('Escolha um tipo de negócio.'); return; }
  state.tipo = sel.dataset.t;
  api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ tipo: sel.dataset.t }) });
  nav(2);
}

function stage2(stage) {
  stage.innerHTML = `<h1>Adicione logo e capa 🎨</h1><p class="sub">Você pode colar o link de uma imagem (URL) ou deixar para depois.</p>
  <div class="field"><label>Logo (URL da imagem)</label><input id="logo" value="${esc(state.restaurant.logo || '')}" placeholder="https://.../logo.png"></div>
  <div class="field"><label>Imagem de capa (URL)</label><input id="capa" value="${esc(state.restaurant.capa || '')}" placeholder="https://.../capa.jpg"></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(1)">← Voltar</button><button class="btn btn-primary" onclick="saveCapa()">Continuar →</button></div>`;
}
async function saveCapa() {
  await api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ logo: document.getElementById('logo').value, capa: document.getElementById('capa').value }) });
  state.restaurant.logo = document.getElementById('logo').value; state.restaurant.capa = document.getElementById('capa').value;
  nav(3);
}

function stage3(stage) {
  stage.innerHTML = `<h1>Descreva seu estabelecimento ✍️</h1><p class="sub">Uma frase curta que aparece no topo do cardápio.</p>
  <div class="field"><label>Descrição</label><textarea id="desc" rows="3">${esc(state.restaurant.descricao || '')}</textarea></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(2)">← Voltar</button><button class="btn btn-primary" onclick="saveDesc()">Continuar →</button></div>`;
}
async function saveDesc() {
  await api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ descricao: document.getElementById('desc').value }) });
  state.restaurant.descricao = document.getElementById('desc').value;
  nav(4);
}

function stage4(stage) {
  stage.innerHTML = `<h1>WhatsApp e Instagram 📱</h1><p class="sub">Permita que seus clientes entrem em contato com 1 toque.</p>
  <div class="field"><label>WhatsApp (com DDI e DDD, ex: 5511999990000)</label><input id="wa" value="${esc(state.restaurant.whatsapp || '')}" placeholder="5511999990000"></div>
  <div class="field"><label>Instagram (usuário)</label><input id="ig" value="${esc(state.restaurant.instagram || '')}" placeholder="meurestaurante"></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(3)">← Voltar</button><button class="btn btn-primary" onclick="saveContato()">Continuar →</button></div>`;
}
async function saveContato() {
  await api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ whatsapp: document.getElementById('wa').value, instagram: document.getElementById('ig').value }) });
  state.restaurant.whatsapp = document.getElementById('wa').value; state.restaurant.instagram = document.getElementById('ig').value;
  nav(5);
}

function stage5(stage) {
  const rows = state.hours.map((h, i) => {
    const p0 = (h.periodos && h.periodos[0]) || { abertura: '09:00', fechamento: '18:00' };
    const p1 = (h.periodos && h.periodos[1]) || { abertura: '', fechamento: '' };
    return `
    <div class="day-row" data-i="${i}">
      <label class="switch"><input type="checkbox" ${h.fechado ? '' : 'checked'} onchange="dayToggle(${i},this.checked)"><span class="slider"></span></label>
      <b>${h.dia}</b>
      <span class="p1"><input type="time" value="${p0.abertura}" data-day="${i}" data-p="0" data-k="abertura"> – <input type="time" value="${p0.fechamento}" data-day="${i}" data-p="0" data-k="fechamento"></span>
      <span class="p2"><input type="time" value="${p1.abertura}" data-day="${i}" data-p="1" data-k="abertura"> – <input type="time" value="${p1.fechamento}" data-day="${i}" data-p="1" data-k="fechamento"></span>
    </div>`;
  }).join('');
  stage.innerHTML = `<h2>Horário de funcionamento 🕐</h2><p class="sub">Marque os dias abertos e defina até 2 períodos. Ex.: 11:00–15:00 e 18:00–23:00.</p>
  <div class="hours-box">${rows}</div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(4)">← Voltar</button><button class="btn btn-primary" onclick="saveHours()">Continuar →</button></div>`;
  // re-ligar inputs
  stage.querySelectorAll('input[type=time]').forEach(inp => {
    inp.addEventListener('change', () => {
      const d = +inp.dataset.day, p = +inp.dataset.p, k = inp.dataset.k;
      if (!state.hours[d].periodos[p]) state.hours[d].periodos[p] = {};
      state.hours[d].periodos[p][k] = inp.value;
    });
  });
}
function dayToggle(i, on) { state.hours[i].fechado = !on; }
function dayPer(i) {}
async function saveHours() {
  await api('/api/business-hours', { method: 'PUT', body: JSON.stringify(state.hours) });
  nav(6);
}

function stage6(stage) {
  stage.innerHTML = `<h2>Crie sua primeira categoria 📂</h2><p class="sub">Ex.: Hambúrgueres, Pizzas, Bebidas, Sobremesas…</p>
  <div class="field"><label>Nome da categoria</label><input id="catnome" placeholder="Hambúrgueres"></div>
  <div class="field"><label>Emoji (opcional)</label><input id="catemoji" placeholder="🍔"></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(5)">← Voltar</button><button class="btn btn-primary" onclick="saveCat()">Continuar →</button></div>`;
}
async function saveCat() {
  const nome = document.getElementById('catnome').value.trim();
  if (!nome) { alert('Informe o nome da categoria.'); return; }
  const { d } = await api('/api/categories', { method: 'POST', body: JSON.stringify({ nome, emoji: document.getElementById('catemoji').value }) });
  state.catId = d.id;
  nav(7);
}

function stage7(stage) {
  stage.innerHTML = `<h2>Adicione seu primeiro produto 🍔</h2><p class="sub">Preencha as informações básicas.</p>
  <div class="field"><label>Nome do produto</label><input id="p-nome" placeholder="X-Bacon"></div>
  <div class="field"><label>Descrição</label><input id="p-desc" placeholder="Hambúrguer artesanal, queijo, bacon e molho especial."></div>
  <div class="field"><label>Preço (R$)</label><input id="p-preco" type="number" step="0.01" placeholder="24.90"></div>
  <div class="ob-nav"><button class="btn btn-secondary" onclick="nav(6)">← Voltar</button><button class="btn btn-primary" onclick="saveFirstProduct(true)">Adicionar e continuar</button></div>
  <div class="ob-nav"><button class="btn btn-ghost" onclick="saveFirstProduct(false)">Pular por enquanto</button></div>`;
}
async function saveFirstProduct(add) {
  if (add) {
    const nome = document.getElementById('p-nome').value.trim();
    const preco = parseFloat(document.getElementById('p-preco').value) || 0;
    if (!nome) { alert('Informe o nome do produto.'); return; }
    await api('/api/products', { method: 'POST', body: JSON.stringify({ nome, descricao: document.getElementById('p-desc').value, preco, category_id: state.catId || null, destaque: true }) });
  }
  await api('/api/me/onboarding', { method: 'PUT', body: JSON.stringify({ onboarding_done: true }) });
  nav(8);
}

function stage8(stage) {
  stage.innerHTML = `<div class="center" style="padding:12px 0">
    <div style="font-size:64px">🎉</div>
    <h1>Seu CardápioGo está pronto!</h1>
    <p class="sub">Seu cardápio já está no ar. Escaneie o QR Code ou compartilhe o link.</p>
    <a class="btn btn-primary btn-lg" href="/menu/${state.restaurant.slug}">Ver meu cardápio</a>
    <div style="margin-top:14px"><a class="btn btn-secondary" href="/app.html">Ir para o painel</a></div>
  </div>`;
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function logout() { fetch('/api/auth/logout', { method: 'POST' }).then(() => location.href = '/'); }

// delegates for inline on* handlers
document.addEventListener('click', (e) => {
  const t = e.target.closest('.tipo');
  if (t) { document.querySelectorAll('.tipo').forEach(x => x.classList.remove('sel')); t.classList.add('sel'); }
});

render_progress();
async function render_progress(){}
render();