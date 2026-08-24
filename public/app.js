// ============ CardápioGo — Painel administrativo (SPA) ============
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

const state = { user: null, restaurant: null, categories: [], products: [], hours: [], sub: null, stats: null, section: 'dashboard', theme: null };

const NAV = [
  { sec: 'Gerenciar' },
  { id: 'dashboard', ic: '🏠', label: 'Dashboard' },
  { id: 'produtos', ic: '📦', label: 'Produtos' },
  { id: 'categorias', ic: '📂', label: 'Categorias' },
  { id: 'cardapio', ic: '🍽️', label: 'Meu Cardápio' },
  { id: 'qr', ic: '📱', label: 'QR Code' },
  { id: 'aparencia', ic: '🎨', label: 'Aparência' },
  { id: 'estatisticas', ic: '📊', label: 'Estatísticas' },
  { sec: 'Conta' },
  { id: 'assinatura', ic: '💳', label: 'Assinatura' },
  { id: 'config', ic: '⚙️', label: 'Configurações' },
];

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

// ---------- helpers ----------
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/login.html'; throw new Error('Não autenticado'); }
  if (!r.ok) { const e = new Error(d.error || 'Erro'); e.status = r.status; e.data = d; throw e; }
  return d;
}
function fmt(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, type = 'ok') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3000); }
function openModal(html) { $('#modal').innerHTML = html; $('#modalBackdrop').classList.add('open'); }
function closeModal() { clearPayPolling(); $('#modalBackdrop').classList.remove('open'); }
function maxProducts() { return state.sub && state.sub.plano ? (state.sub.plano.max_produtos || 0) : 10; }
function isUnlimited() { const p = state.sub && state.sub.plano; return !!(p && (p.ilimitado === true || p.max_produtos == null || p.max_produtos === Infinity)); }
function limit() { const used = state.products.length; const max = maxProducts(); const unlimited = isUnlimited(); return { used, max, unlimited }; }

// ---------- init ----------
async function init() {
  buildNav();
  $('#btnLogout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };
  $('#burger').onclick = () => $('#sidebar').classList.toggle('open');
  $('#modalBackdrop').onclick = (e) => { if (e.target.id === 'modalBackdrop') closeModal(); };

  try {
    const me = await api('/api/auth/me'); state.user = me.user;
    $('#userName').textContent = me.user.nome; $('#userAvatar').textContent = (me.user.nome || 'U')[0].toUpperCase();
    const rest = await api('/api/me/restaurant'); state.restaurant = rest.restaurant;
    const sub = await api('/api/me/subscription'); state.sub = sub;
    renderPlanChip();
    await loadAll();
    hashRoute();
  } catch (e) { if (e.status !== 401) toast(e.message, 'err'); }
}
function renderPlanChip() {
  const p = state.sub && state.sub.plano;
  $('#planChip').innerHTML = p ? `${p.emoji} <span>${p.nome}</span>` : '🆓 Grátis';
}
function buildNav() {
  $('#nav').innerHTML = NAV.map((n) => n.sec
    ? `<div class="sec">${n.sec}</div>`
    : `<div class="item" data-id="${n.id}" onclick="go('${n.id}')"><span class="ic">${n.ic}</span>${n.label}</div>`).join('');
}
async function loadAll() {
  const [cats, prods, hours] = await Promise.all([
    api('/api/categories'), api('/api/products'), api('/api/business-hours'),
  ]);
  state.categories = cats; state.products = prods; state.hours = hours;
  renderPlanChip();
}
function go(id) {
  state.section = id; location.hash = id; renderRoute();
}
function hashRoute() { const h = location.hash.replace('#', ''); state.section = NAV.find(n => n.id === h) ? h : 'dashboard'; renderRoute(); }
function renderRoute() {
  $$('#nav .item').forEach(i => i.classList.toggle('active', i.dataset.id === state.section));
  $('#sidebar').classList.remove('open');
  const titles = { dashboard: 'Dashboard', produtos: 'Produtos', categorias: 'Categorias', cardapio: 'Meu Cardápio', qr: 'Meu QR Code', aparencia: 'Aparência', estatisticas: 'Estatísticas', assinatura: 'Assinatura', config: 'Configurações' };
  $('#pageTitle').textContent = titles[state.section] || 'Dashboard';
  const c = $('#content');
  switch (state.section) {
    case 'dashboard': renderDashboard(c); break;
    case 'produtos': renderProdutos(c); break;
    case 'categorias': renderCategorias(c); break;
    case 'cardapio': renderCardapio(c); break;
    case 'qr': renderQr(c); break;
    case 'aparencia': renderAparencia(c); break;
    case 'estatisticas': renderEstatisticas(c); break;
    case 'assinatura': renderAssinatura(c); break;
    case 'config': renderConfig(c); break;
  }
}
window.addEventListener('hashchange', hashRoute);

// ---------- DASHBOARD ----------
async function renderDashboard(c) {
  const total = state.products.length;
  const { max, unlimited } = limit();
  let stats;
  try { stats = await api('/api/me/stats'); } catch (e) { stats = {}; }
  c.innerHTML = `
    <div class="grid cards" style="margin-bottom:20px">
      <div class="stat"><div class="label">Visualizações hoje</div><div class="value">${stats.visualizacoesHoje || 0}</div></div>
      <div class="stat"><div class="label">Últimos 7 dias</div><div class="value">${stats.last7 || 0}</div></div>
      <div class="stat"><div class="label">Últimos 30 dias</div><div class="value">${stats.last30 || 0}</div></div>
      <div class="stat"><div class="label">Produtos</div><div class="value">${total}${unlimited ? '' : `<small> / ${max}</small>`}</div></div>
      <div class="stat"><div class="label">Categorias</div><div class="value">${state.categories.length}</div></div>
      <div class="stat"><div class="label">Plano</div><div class="value">${(state.sub.plano || {}).emoji || '🆓'} ${esc((state.sub.plano || {}).nome || 'Grátis')}</div></div>
    </div>
    <div class="alert" id="limitAlert"></div>
    <div class="chart-box" style="margin-bottom:20px"><h3>📈 Visualizações — últimos 30 dias</h3><div id="dashChart"></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      <a class="btn btn-primary" href="javascript:go('produtos')">+ Adicionar produto</a>
      <button class="btn btn-secondary" onclick="go('cardapio')">Editar cardápio</button>
      <button class="btn btn-secondary" onclick="go('qr')">Meu QR Code</button>
      ${state.restaurant ? `<a class="btn btn-secondary" href="/menu/${state.restaurant.slug}" target="_blank">Ver cardápio ↗</a>` : ''}
    </div>`;
  const el = $('#limitAlert');
  if (unlimited) { el.innerHTML = '💎 Plano Premium: produtos ilimitados.'; el.style.display = 'none'; }
  else if (total >= max) el.innerHTML = `<span>⚠️ Você atingiu o limite de <b>${max}</b> produtos do plano <b>${(state.sub.plano||{}).nome}</b>.</span><button class="btn btn-primary btn-sm" onclick="go('assinatura')">Fazer upgrade</button>`;
  else el.innerHTML = `<span>Produtos: <b>${total} / ${max}</b> utilizados.</span>`;
  drawLineChart($('#dashChart'), stats.serie || [], 30);
}

// ---------- PRODUTOS ----------
function renderProdutos(c) {
  const { used, max, unlimited } = limit();
  const pct = unlimited ? 0 : Math.min(100, (used / max) * 100);
  c.innerHTML = `
    <div class="section-title">📦 Produtos
      <button class="btn btn-primary" onclick="openProduto()">+ Adicionar</button>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div style="font-size:13px;color:var(--muted);font-weight:600">Uso do plano: <b>${used}${unlimited ? '' : ' / ' + max}</b> produtos</div>
      <div class="limit-bar"><span style="width:${pct}%"></span></div>
      <div style="font-size:12px;color:var(--muted)">${unlimited ? 'Produtos ilimitados (Premium).' : 'Plano ' + ((state.sub.plano||{}).nome||'Grátis') + ': até ' + max + ' produtos.'}</div>
    </div>
    <div class="table-wrap">${renderProdTable()}</div>`;
}
function renderProdTable() {
  if (!state.products.length) return '';
  const catName = (id) => { const x = state.categories.find(c => c.id === id); return x ? x.nome : '—'; };
  return `<table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Destaque</th><th></th></tr></thead><tbody>
    ${state.products.map(p => `<tr>
      <td><div class="row-title">${esc(p.nome)}</div><div class="row-sub">${esc((p.descricao || '').slice(0, 50))}</div></td>
      <td>${esc(catName(p.category_id))}</td>
      <td class="price-tag">${fmt(p.preco)}</td>
      <td>${p.disponivel ? '<span class="badge on">Disponível</span>' : '<span class="badge off">Indisponível</span>'}</td>
      <td>${p.destaque ? '<span class="badge dest">★ Destaque</span>' : ''}</td>
      <td><div class="actions">
        <button class="icon-btn" title="Ativar/desativar" onclick="toggleProd('${p.id}')">${p.disponivel ? '🚫' : '✅'}</button>
        <button class="icon-btn" title="Duplicar" onclick="dupProd('${p.id}')">⧉</button>
        <button class="icon-btn" title="Editar" onclick="openProduto('${p.id}')">✏️</button>
        <button class="icon-btn danger" title="Excluir" onclick="delProd('${p.id}')">🗑️</button>
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}
function openProduto(id) {
  const p = id ? state.products.find(x => x.id === id) : null;
  if (!id) {
    const { used, max, unlimited } = limit();
    if (!unlimited && used >= max) {
      toast(`Você atingiu o limite de ${max} produtos do plano ${(state.sub.plano||{}).nome}.`, 'err');
      openModal(`<button class="close" onclick="closeModal()">×</button>
        <h2>Limite do plano atingido ⚠️</h2>
        <div class="alert">Você atingiu o limite de <b>${max}</b> produtos do plano <b>${(state.sub.plano||{}).nome}</b>.</div>
        <div style="text-align:center"><button class="btn btn-primary" onclick="go('assinatura');closeModal()">Fazer upgrade</button></div>`);
      return;
    }
  }
  const catsOpt = state.categories.map(x => `<option value="${x.id}" ${p && p.category_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  openModal(`<button class="close" onclick="closeModal()">×</button>
    <h2>${p ? 'Editar produto' : 'Novo produto'}</h2>
    <div class="field"><label>Nome</label><input id="p-nome" value="${p ? esc(p.nome) : ''}" placeholder="X-Bacon"></div>
    <div class="field"><label>Descrição</label><textarea id="p-desc" rows="2">${p ? esc(p.descricao || '') : ''}</textarea></div>
    <div class="field"><label>Ingredientes</label><input id="p-ing" value="${p ? esc(p.ingredientes || '') : ''}" placeholder="Pão, queijo, bacon…"></div>
    <div class="two-col">
      <div class="field"><label>Preço (R$)</label><input id="p-preco" type="number" step="0.01" value="${p ? p.preco : ''}" placeholder="24.90"></div>
      <div class="field"><label>Categoria</label><select id="p-cat">${catsOpt}</select></div>
    </div>
    <div class="field"><label>Foto (URL)</label><input id="p-img" value="${p ? esc(p.imagem || '') : ''}" placeholder="https://..."></div>
    <div class="row-flex">
      <label class="switch"><input type="checkbox" id="p-disp" ${p ? (p.disponivel ? 'checked' : '') : 'checked'}><span class="slider"></span></label><span style="font-size:13px">Disponível</span>
      <span style="width:16px"></span>
      <label class="switch"><input type="checkbox" id="p-dest" ${p && p.destaque ? 'checked' : ''}><span class="slider"></span></label><span style="font-size:13px">Destaque</span>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveProduto('${p ? p.id : ''}')">${p ? 'Salvar' : 'Adicionar'}</button>
    </div>`);
}
async function saveProduto(id) {
  const body = {
    nome: $('#p-nome').value.trim(),
    descricao: $('#p-desc').value,
    ingredientes: $('#p-ing').value,
    preco: parseFloat($('#p-preco').value) || 0,
    category_id: $('#p-cat').value || null,
    imagem: $('#p-img').value,
    disponivel: $('#p-disp').checked,
    destaque: $('#p-dest').checked,
  };
  if (!body.nome) return toast('Informe o nome do produto.', 'err');
  try {
    if (id) await api('/api/products/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/products', { method: 'POST', body: JSON.stringify(body) });
    closeModal(); toast('Produto salvo!'); await loadAll(); renderRoute();
  } catch (e) {
    if (e.status === 403) {
      openModal(`<button class="close" onclick="closeModal()">×</button>
        <h2>Limite atingido ⚠️</h2>
        <p class="alert">Você atingiu o limite de <b>${e.data.limite}</b> produtos do plano ${e.data.plano ? (e.data.plano) : 'atual'}.</p>
        <div class="modal-foot"><button class="btn btn-secondary" onclick="closeModal()">OK</button><button class="btn btn-primary" onclick="go('assinatura');closeModal()">Fazer upgrade</button></div>`);
    } else toast(e.message, 'err');
  }
}
async function loadAllProducts() { const d = await api('/api/products'); state.products = d; }
async function dupProd(id) {
  try { await api(`/api/products/${id}/duplicate`, { method: 'POST' }); toast('Produto duplicado!'); await loadAllProducts(); renderRoute(); }
  catch (e) { if (e.status === 403) { openModal(`<button class="close" onclick="closeModal()">×</button><h2>Limite atingido ⚠️</h2><p class="alert">${esc(e.message)}</p><div class="modal-foot"><button class="btn btn-primary" onclick="go('assinatura');closeModal()">Fazer upgrade</button></div>`); } else toast(e.message, 'err'); }
}
async function delProd(id) {
  if (!confirm('Excluir este produto?')) return;
  await api('/api/products/' + id, { method: 'DELETE' }); toast('Produto excluído.'); await loadAllProducts(); renderRoute();
}

// ---------- CATEGORIAS ----------
function renderCategorias(c) {
  c.innerHTML = `<div class="section-title">📂 Categorias <button class="btn btn-primary" onclick="openCat()">+ Nova categoria</button></div>
  <div class="card"><p style="color:var(--muted);font-size:13.5px;margin-bottom:10px">Arraste ou use as setas para reordenar. A ordem exibida aqui reflete no cardápio público.</p>
  <div id="catList">${renderCatList()}</div></div>`;
  if (!state.categories.length) {
    $('#catList').innerHTML = `<div class="empty"><div class="big">📂</div><h3>Nenhuma categoria</h3><p>Organize seu cardápio criando categorias.</p><div style="margin-top:12px"><button class="btn btn-primary" onclick="openCat()">+ Nova categoria</button></div></div>`;
  }
}
function renderCatList() {
  return state.categories.map((x, i) => `
    <div class="day-row" style="grid-template-columns:auto auto 1fr auto">
      <button class="icon-btn" onclick="moveCat(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
      <span style="font-size:20px">${x.emoji || '📄'}</span>
      <div><b>${esc(x.nome)}</b><div class="row-sub">${state.products.filter(p => p.category_id === x.id).length} produtos</div></div>
      <div class="actions">
        <button class="icon-btn" onclick="openCat('${x.id}')">✏️</button>
        <button class="icon-btn danger" onclick="delCat('${x.id}')">🗑️</button>
      </div>
    </div>`).join('');
}
function openCat(id) {
  const x = id ? state.categories.find(c => c.id === id) : null;
  openModal(`<button class="close" onclick="closeModal()">×</button><h2>${x ? 'Editar categoria' : 'Nova categoria'}</h2>
  <div class="field"><label>Nome</label><input id="c-nome" value="${x ? esc(x.nome) : ''}"></div>
  <div class="field"><label>Emoji</label><input id="c-emoji" value="${x ? esc(x.emoji || '') : ''}" placeholder="🍔"></div>
  <div class="modal-foot"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveCat('${id || ''}')">${x ? 'Salvar' : 'Criar'}</button></div>`);
}
async function saveCat(id) {
  const nome = $('#c-nome').value.trim(); if (!nome) return;
  const emoji = $('#c-emoji').value;
  if (id) await api('/api/categories/' + id, { method: 'PUT', body: JSON.stringify({ nome, emoji }) });
  else await api('/api/categories', { method: 'POST', body: JSON.stringify({ nome, emoji }) });
  closeModal(); await loadAllCategories(); renderRoute();
}
async function moveCat(i, d) {
  const arr = [...state.categories]; const j = i + d;
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  await api('/api/categories/reorder', { method: 'POST', body: JSON.stringify({ order: arr.map(x => x.id) }) });
  state.categories = arr; renderRoute();
}
async function delCat(id) {
  if (!confirm('Excluir esta categoria? Os produtos dela não serão apagados.')) return;
  await api('/api/categories/' + id, { method: 'DELETE' }); toast('Categoria excluída.'); await loadAllCategories(); renderRoute();
}
async function loadAllCategories() { state.categories = await api('/api/categories'); }

// ---------- CARDÁPIO ----------
function renderCardapio(c) {
  const slug = state.restaurant ? state.restaurant.slug : '';
  const url = location.origin + '/menu/' + slug;
  c.innerHTML = `
    <div class="section-title">🍽️ Meu Cardápio
      <div class="actions"><button class="btn btn-secondary" onclick="go('aparencia')">🎨 Personalizar</button><button class="btn btn-primary" onclick="window.open('/menu/${slug}','_blank')">Ver cardápio ↗</button></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--muted)">Link público do seu cardápio</div>
      <div class="qr-link">${esc(url)}</div>
      <button class="btn btn-secondary btn-sm" onclick="copyText('${esc(url)}')">Copiar link</button>
    </div>
    <div class="card"><h3>Prévia</h3><div class="preview-phone">
      <div class="preview-head" style="--pref-bg:${(state.restaurant&&state.restaurant.cores&&state.restaurant.cores.fundo)||'#f5f5f7'};text-align:center">
        <div style="width:40px;height:40px;border-radius:50%;margin:0 auto;background:${(state.restaurant&&state.restaurant.cores&&state.restaurant.cores.primaria)||'#e63946'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${esc(((state.restaurant&&state.restaurant.nome)||'C')[0])}</div>
        <b style="display:block;margin:6px 0 2px">${esc((state.restaurant&&state.restaurant.nome)||'Seu Restaurante')}</b>
        <span style="font-size:12px;color:#1a8f4b">🟢 Aberto agora</span>
      </div>
      <div class="preview-cats">${state.categories.map(x => `<span>${esc(x.emoji||'')} ${esc(x.nome)}</span>`).join('') || '<span>+ Categorias</span>'}</div>
      <div class="preview-body">${state.products.slice(0,6).map(p => `<div class="preview-item"><span>${esc(p.nome)}</span><b>${fmt(p.preco)}</b></div>`).join('') || '<div style="text-align:center;color:#999;padding:20px 0">Adicione produtos</div>'}</div>
    </div></div>`;
}

// ---------- QR ----------
async function renderQr(c) {
  const slug = state.restaurant.slug; const url = location.origin + '/menu/' + slug;
  const qrImg = await (await fetch('/api/me/qr.png')).blob().then(b => URL.createObjectURL(b));
  c.innerHTML = `
    <div class="qr-page">
      <h2 class="section-title" style="justify-content:center">📱 Meu QR Code</h2>
      <p style="color:var(--muted);margin-bottom:18px">Imprima, cole nas mesas ou compartilhe. O cliente escaneia e abre seu cardápio.</p>
      <div class="qr-box">
        <img src="${qrImg}" alt="QR Code">
        <div style="margin-top:8px;font-weight:800">${esc(state.restaurant.nome)}</div>
        <div style="color:var(--muted);font-size:13px">${esc(url)}</div>
      </div>
      <div class="qr-actions">
        <a class="btn btn-primary" href="/api/me/qr.png">Baixar PNG</a>
        <a class="btn btn-secondary" href="/api/me/qr.pdf">Baixar PDF</a>
        <button class="btn btn-secondary" onclick="copyText('${esc(url)}')">Copiar link</button>
        <button class="btn btn-secondary" onclick="window.print()">Imprimir</button>
      </div>
    </div>`;
}

// ---------- APARÊNCIA ----------
async function renderAparencia(c) {
  const r = state.restaurant; const cores = (r && r.cores) || { primaria: '#e63946', botao: '#e63946', fundo: '#f4f4f5' };
  const allowed = (state.sub && state.sub.plano && state.sub.plano.temas) || ['moderno','minimalista'];
  const temas = [{id:'moderno',n:'Moderno',bg:'#f4f4f5'},{id:'minimalista',n:'Minimalista',bg:'#ffffff'},{id:'elegante',n:'Elegante',bg:'#faf7f2'},{id:'dark',n:'Dark',bg:'#121212'},{id:'vibrante',n:'Vibrante',bg:'#f7f6e4'}];
  c.innerHTML = `
    <div class="section-title">🎨 Aparência</div>
    <div class="grid" style="grid-template-columns:1.2fr .8fr;gap:20px">
      <div>
        <div class="card" style="margin-bottom:16px"><h3>🎨 Tema</h3>
          <div class="tema-grid">${temas.map(t => `<div class="tema ${r.tema === t.id ? 'sel' : ''}" onclick="setTema('${t.id}')" ${allowed.includes(t.id) ? '' : 'title="Disponível no plano Profissional+"'}><div class="sw" style="background:${t.bg};border:1px solid var(--line)"></div>${t.n}${allowed.includes(t.id) ? '' : ' 🔒'}</div>`).join('')}</div>
          <p style="font-size:12px;color:var(--muted);margin-top:8px">${allowed.length < 5 ? 'Temas com 🔒 disponíveis nos planos pagos.' : 'Todos os temas liberados.'}</p>
        </div>
        <div class="card" style="margin-bottom:16px"><h3>🖌️ Cores</h3>
          <div class="color-row">
            <div class="color-input"><label>Cor principal</label><input type="color" id="colPrim" value="${cores.primaria||'#e63946'}" oninput="preview()"></div>
            <div class="color-input"><label>Cor botões</label><input type="color" id="colBtn" value="${cores.botao||'#e63946'}" oninput="preview()"></div>
            <div class="color-input"><label>Fundo</label><input type="color" id="colFundo" value="${cores.fundo||'#f4f4f5'}" oninput="preview()"></div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px"><h3>🖼️ Logo e Capa</h3>
          <div class="field"><label>Logo (URL)</label><input id="ap-logo" value="${esc(r.logo||'')}"></div>
          <div class="field"><label>Capa (URL)</label><input id="ap-capa" value="${esc(r.capa||'')}"></div>
        </div>
        <button class="btn btn-primary" onclick="saveAparencia()">Salvar alterações</button>
      </div>
      <div class="card"><h3>👁️ Prévia</h3><div id="previewArea"></div></div>
    </div>`;
  preview();
}
function preview() {
  const prim = $('#colPrim').value, btn = $('#colBtn').value, fundo = $('#colFundo').value;
  $('#previewArea').innerHTML = `<div class="preview-phone" style="--pref-color:${fundo}">
    <div class="preview-head" style="text-align:center;background:${fundo}">
      <div style="width:40px;height:40px;border-radius:50%;margin:0 auto;background:${prim};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${(state.restaurant&&state.restaurant.nome[0])||'C'}</div>
      <b style="display:block;margin:6px 0 2px">${esc((state.restaurant&&state.restaurant.nome)||'Seu Restaurante')}</b>
      <span style="font-size:12px;color:#1a8f4b">🟢 Aberto agora</span>
    </div>
    <div class="preview-cats"><span>Hambúrgueres</span><span>Bebidas</span><span>Porções</span></div>
    <div class="preview-body" style="--pref-btn:${btn}">
      <div class="preview-item"><span>Classic Burger</span><b style="color:${btn}">R$ 22,90</b></div>
      <div class="preview-item"><span>Bacon Burger</span><b style="color:${btn}">R$ 26,90</b></div>
      <div class="preview-item"><span>Batata Especial</span><b style="color:${btn}">R$ 14,90</b></div>
    </div></div>`;
}
async function setTema(t) {
  const allowed = (state.sub && state.sub.plano && state.sub.plano.temas) || ['moderno','minimalista'];
  if (!allowed.includes(t)) { toast('Este tema requer um plano pago. Faça upgrade para usar.', 'err'); go('assinatura'); return; }
  await api('/api/me/appearance', { method: 'PUT', body: JSON.stringify({ tema: t }) });
  state.restaurant.tema = t; renderRoute();
}
async function saveAparencia() {
  await api('/api/me/appearance', { method: 'PUT', body: JSON.stringify({
    cores: { primaria: $('#colPrim').value, botao: $('#colBtn').value, fundo: $('#colFundo').value },
    logo: $('#ap-logo').value, capa: $('#ap-capa').value,
  }) });
  state.restaurant.cores = { primaria: $('#colPrim').value, botao: $('#colBtn').value, fundo: $('#colFundo').value };
  state.restaurant.logo = $('#ap-logo').value; state.restaurant.capa = $('#ap-capa').value;
  toast('Aparência salva!'); preview();
}

// ---------- ESTATÍSTICAS ----------
async function renderEstatisticas(c) {
  c.innerHTML = `<div class="section-title">📊 Estatísticas</div>
    <div class="filters"><button class="filter-btn active" data-r="7" onclick="loadStats(7)">7 dias</button><button class="filter-btn" data-r="30" onclick="loadStats(30)">30 dias</button><button class="filter-btn" data-r="90" onclick="loadStats(90)">90 dias</button></div>
    <div id="statsArea">Carregando…</div>`;
  loadStats(30);
}
async function loadStats(days) {
  const st = await api('/api/me/stats');
  $$('.filter-btn').forEach(b => b.classList.toggle('active', +b.dataset.r === days));
  const serie = st.serie || [];
  const sliced = serie.slice(-days);
  const horas = (st.horasMaisAcesso || []).map(h => `${h.hora} (${h.valor})`).join(' · ') || '—';
  const dias = (st.diasMaisAcesso || []).map(d => `${d.dia} (${d.valor})`).join(' · ') || '—';
  $('#statsArea').innerHTML = `
    <div class="stats-row">
      <div class="stat"><div class="label">Hoje</div><div class="value">${st.visualizacoesHoje||0}</div></div>
      <div class="stat"><div class="label">Últimos 7 dias</div><div class="value">${st.last7||0}</div></div>
      <div class="stat"><div class="label">Últimos 30 dias</div><div class="value">${st.last30||0}</div></div>
      <div class="stat"><div class="label">Total</div><div class="value">${st.total||0}</div></div>
    </div>
    <div class="chart-box" style="margin-bottom:16px"><h3>Visualizações (${days} dias)</h3><div id="statChart"></div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
      <div class="card"><h3>🕐 Horários com maior acesso</h3><p>${esc(horas)}</p></div>
      <div class="card"><h3>📅 Dias com maior acesso</h3><p>${esc(dias)}</p></div>
    </div>`;
  drawLineChart($('#statChart'), sliced, days);
}
function drawLineChart(el, serie, days) {
  const vals = serie.slice(-days).map(s => s.valor || 0);
  const max = Math.max(1, ...vals);
  const w = 760, h = 180, pad = 20;
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  let path = '', area = '';
  vals.forEach((v, i) => {
    const x = pad + i * step, y = h - pad - (v / max) * (h - pad * 2);
    path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    area += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  });
  area += 'L' + (pad + (vals.length - 1) * step).toFixed(1) + ' ' + (h - pad) + ' L' + pad + ' ' + (h - pad) + ' Z';
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e63946" stop-opacity=".35"/><stop offset="1" stop-color="#e63946" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#g)"/>
    <path d="${path}" fill="none" stroke="#e63946" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  if (vals.every(v => v === 0)) el.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">Ainda sem visualizações.</div>';
}

// ---------- ASSINATURA ----------
async function renderAssinatura(c) {
  const sub = state.sub, p = sub.plano, used = state.products.length, max = maxProducts();
  const unlimited = isUnlimited();
  const pct = unlimited ? 100 : Math.min(100, (used / max) * 100);
  const plans = await api('/api/plans');
  const currentId = p.id;
  c.innerHTML = `
    <div class="section-title">💳 Assinatura</div>
    <div class="card" style="margin-bottom:20px">
      <div class="row-flex" style="justify-content:space-between">
        <div><h3>${p.emoji} Plano ${esc(p.nome)}</h3><div class="badge on" style="margin-top:6px">Status: ${esc((sub && sub.status) || 'ativo')}</div></div>
        <div style="text-align:right"><div style="font-size:28px;font-weight:800">${unlimited ? '∞' : used + ' / ' + max}</div><div style="font-size:13px;color:var(--muted)">${unlimited ? 'Produtos ilimitados' : 'produtos utilizados'}</div></div>
      </div>
      <div class="limit-bar"><span style="width:${pct}%"></span></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${plans.map(pl => {
        const isCur = pl.id === currentId;
        return `<div class="card" style="${pl.id==='profissional'?'border-color:var(--primary)':''}">
          <div style="font-size:24px">${pl.emoji}</div>
          <div style="font-size:18px;font-weight:800">${esc(pl.nome)}</div>
          <div style="font-size:24px;font-weight:800;margin:8px 0">${pl.preco_mensal === 0 ? 'R$ 0' : 'R$ ' + pl.preco_mensal.toFixed(2).replace('.',',')}<small>/mês</small></div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${(pl.max_produtos == null || pl.max_produtos === Infinity) ? 'Produtos ilimitados' : 'Até ' + pl.max_produtos + ' produtos'}</div>
          ${isCur ? '<button class="btn btn-secondary btn-block" disabled>Plano atual</button>' : (pl.preco_mensal === 0 ? '<button class="btn btn-secondary btn-block" onclick="upgrade(\'' + pl.id + '\')">Ativar</button>' : '<button class="btn btn-primary btn-block" onclick="startCheckout(\'' + pl.id + '\')">Assinar agora</button>')}
        </div>`;
      }).join('')}
    </div>
    <p style="font-size:12.5px;color:var(--muted);margin-top:16px">💡 Planos pagos são ativados via PIX (AbacatePay) após a confirmação real do pagamento. Seu plano é liberado automaticamente quando o pagamento é confirmado. Todos os seus produtos são preservados no upgrade.</p>`;
}
// ---------- PAGAMENTO PIX (AbacatePay) ----------
const PAY_BENEFITS = {
  profissional: ['Até 20 produtos', 'Categorias ilimitadas', 'Sem marca CardápioGo', 'Personalização avançada', 'URL personalizada', 'Todos os temas'],
  premium: ['Produtos ilimitados', 'Categorias ilimitadas', 'Sem marca CardápioGo', 'Personalização avançada', 'URL personalizada', 'Tema Vibrante exclusivo'],
};
function payBenefits(id) { return (PAY_BENEFITS[id] || []).map((t) => '<li>' + esc(t) + '</li>').join(''); }
function fmtBrl(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
let payTimer = null;
function clearPayPolling() { if (payTimer) { clearInterval(payTimer); payTimer = null; } }
// upgrade() fica apenas para o plano gratuito
async function upgrade(id) {
  await api('/api/me/subscription/upgrade', { method: 'POST', body: JSON.stringify({ plano: id }) });
  state.sub = await api('/api/me/subscription');
  renderPlanChip(); toast('Você está no plano ' + state.sub.plano.nome + '.'); renderAssinatura();
}
async function startCheckout(planId) {
  openModal('<button class="close" onclick="closeModal()">×</button><div class="pay-loading">Criando cobrança PIX…</div>');
  try {
    const r = await api('/api/me/subscription/checkout', { method: 'POST', body: JSON.stringify({ plano: planId }) });
    state.checkout = r.checkout;
    renderPayModal(r.checkout);
    startPayPolling(r.checkout.id);
  } catch (e) {
    openModal('<button class="close" onclick="closeModal()">×</button><h2>Pagamento</h2><p class="alert">' + esc(e.message) + '</p><div class="modal-foot"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>');
  }
}
function renderPayModal(c) {
  if (c.status === 'PAID') return renderPayConfirmed();
  $('#modal').innerHTML = `
    <button class="close" onclick="closeModal()">×</button>
    <div style="text-align:center">
      <div style="font-size:16px;font-weight:800">Plano ${esc(c.plan_nome)}</div>
      <div style="font-size:26px;font-weight:800;color:var(--primary)">${fmtBrl(c.preco_mensal)}<small>/mês</small></div>
    </div>
    <ul class="pay-benefits">${payBenefits(c.plan_id)}</ul>
    <div class="pay-status" id="payStatus">⏳ Aguardando pagamento</div>
    <div class="qr-wrap">
      ${c.br_image ? '<img src="' + c.br_image + '" alt="QR Code PIX" class="pay-qr">' : '<div class="pay-loading">Gerando QR Code…</div>'}
    </div>
    <div class="pix-copy">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">PIX copia e cola</div>
      <div class="copy-row">
        <input id="payBr" readonly value="${esc(c.br_code)}">
        <button class="btn btn-primary" onclick="copyPix()">Copiar</button>
      </div>
    </div>
    <div class="modal-foot" style="flex-direction:column;gap:8px">
      <button class="btn btn-secondary btn-block" id="btnCheck" onclick="manualCheck()">Já paguei — conferir</button>
      <div style="font-size:11.5px;color:var(--muted);text-align:center">O plano é ativado automaticamente após a confirmação do pagamento pela AbacatePay.</div>
    </div>`;
}
function startPayPolling(id) {
  clearPayPolling();
  payTimer = setInterval(async () => {
    try {
      const r = await api('/api/me/subscription/checkout/' + id);
      state.checkout = r.checkout;
      if (r.checkout.status === 'PAID') { clearPayPolling(); renderPayConfirmed(); refreshSub(); }
    } catch (e) {}
  }, 4000);
}
function copyPix() { if (state.checkout && state.checkout.br_code) { copyText(state.checkout.br_code); toast('Código PIX copiado!'); } }
async function manualCheck() {
  const b = $('#btnCheck'); if (b) b.disabled = true;
  try {
    const r = await api('/api/me/subscription/checkout/' + state.checkout.id + '/check', { method: 'POST' });
    state.checkout = r.checkout;
    if (r.checkout.status === 'PAID') { clearPayPolling(); renderPayConfirmed(); refreshSub(); }
    else if ($('#payStatus')) $('#payStatus').textContent = 'Ainda não identificamos o pagamento. Tente novamente em instantes.';
  } catch (e) { toast(e.message, 'err'); }
  if (b) b.disabled = false;
}
function renderPayConfirmed() {
  clearPayPolling();
  $('#modal').innerHTML = `
    <button class="close" onclick="closeModal()">×</button>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:52px">✅</div>
      <h2>Pagamento confirmado!</h2>
      <p class="alert" style="background:#e8f7ee;color:#1f7a43;border:none">Seu plano <b>${esc((state.checkout||{}).plan_nome || '')}</b> foi ativado.</p>
      <div class="modal-foot" style="justify-content:center"><button class="btn btn-primary" onclick="closeModal();go('dashboard')">Ver meu painel</button></div>
    </div>`;
}
async function refreshSub() {
  try { state.sub = await api('/api/me/subscription'); renderPlanChip(); } catch (e) {}
}

// ---------- CONFIG ----------
async function renderConfig(c) {
  const u = state.user, r = state.restaurant;
  c.innerHTML = `
    <div class="section-title">⚙️ Configurações</div>
    <div class="card" style="margin-bottom:18px"><h3>👤 Perfil</h3>
      <div class="field"><label>Nome</label><input id="cf-nome" value="${esc(u.nome)}"></div>
      <div class="field"><label>E-mail</label><input id="cf-email" value="${esc(u.email)}" disabled></div>
      <div class="field"><label>Telefone</label><input id="cf-tel" value="${esc(u.telefone || '')}"></div>
      <button class="btn btn-primary" onclick="savePerfil()">Salvar perfil</button>
    </div>
    <div class="card" style="margin-bottom:18px"><h3>🏪 Restaurante</h3>
      <div class="field"><label>Nome do restaurante</label><input id="cf-rnome" value="${esc(r.nome)}"></div>
      <div class="field"><label>Endereço</label><input id="cf-end" value="${esc(r.endereco || '')}"></div>
      <div class="field"><label>Descrição</label><textarea id="cf-desc" rows="2">${esc(r.descricao || '')}</textarea></div>
      <div class="two-col">
        <div class="field"><label>WhatsApp</label><input id="cf-wa" value="${esc(r.whatsapp || '')}"></div>
        <div class="field"><label>Instagram</label><input id="cf-ig" value="${esc(r.instagram || '')}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveRest()">Salvar restaurante</button>
    </div>
    <div class="card" style="margin-bottom:18px"><h3>🕐 Horário de funcionamento</h3>
      <div class="hours-grid">${renderHours()}</div>
      <button class="btn btn-primary" style="margin-top:12px" onclick="saveHours()">Salvar horários</button>
    </div>
    <div class="card"><h3>🔒 Segurança</h3>
      <div class="field"><label>Senha atual</label><input type="password" id="cf-pass1"></div>
      <div class="field"><label>Nova senha</label><input type="password" id="cf-pass2"></div>
      <button class="btn btn-primary" onclick="changePass()">Alterar senha</button>
    </div>`;
}
function renderHours() {
  const days = DIAS.map((d, i) => state.hours.find(h => h.dia_idx === i) || { dia_idx: i, dia: d, fechado: false, periodos: [{abertura:'09:00',fechamento:'18:00'}] });
  return days.map((h, i) => {
    const p0 = (h.periodos && h.periodos[0]) || { abertura: '', fechamento: '' };
    const p1 = (h.periodos && h.periodos[1]) || { abertura: '', fechamento: '' };
    return `<div class="hours-day">
      <b style="font-size:14px">${h.dia}</b>
      <div class="time-row">
        <input type="time" data-i="${i}" data-p="0" data-k="abertura" value="${p0.abertura}"> – <input type="time" data-i="${i}" data-p="0" data-k="fechamento" value="${p0.fechamento}">
        <span style="color:#ccc">·</span>
        <input type="time" data-i="${i}" data-p="1" data-k="abertura" value="${p1.abertura}"> – <input type="time" data-i="${i}" data-p="1" data-k="fechamento" value="${p1.fechamento}">
      </div>
      <label class="switch"><input type="checkbox" data-i="${i}" class="hday" ${h.fechado ? '' : 'checked'}><span class="slider"></span></label>
    </div>`;
  }).join('');
}
async function savePerfil() {
  await api('/api/me', { method: 'PUT', body: JSON.stringify({ nome: $('#cf-nome').value, telefone: $('#cf-tel').value }) });
  state.user.nome = $('#cf-nome').value; toast('Perfil salvo.');
}
async function saveRest() {
  await api('/api/me/restaurant', { method: 'PUT', body: JSON.stringify({ nome: $('#cf-rnome').value, endereco: $('#cf-end').value, descricao: $('#cf-desc').value, whatsapp: $('#cf-wa').value, instagram: $('#cf-ig').value }) });
  state.restaurant = (await api('/api/me/restaurant')).restaurant; toast('Restaurante salvo.');
}
async function saveHours() {
  const list = DIAS.map((d, i) => {
    const per = [];
    for (let p = 0; p < 2; p++) {
      const a = $(`input[data-i="${i}"][data-p="${p}"][data-k="abertura"]`).value;
      const f = $(`input[data-i="${i}"][data-p="${p}"][data-k="fechamento"]`).value;
      if (a && f) per.push({ abertura: a, fechamento: f });
    }
    const chk = $$(`.hday[data-i="${i}"]`)[0];
    return { dia_idx: i, fechado: chk ? !chk.checked : false, periodos: per };
  });
  await api('/api/business-hours', { method: 'PUT', body: JSON.stringify(list) });
  state.hours = list; toast('Horários salvos.');
}
async function changePass() {
  const p1 = $('#cf-pass1').value, p2 = $('#cf-pass2').value;
  if (p2.length < 6) return toast('Nova senha muito curta.', 'err');
  try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ senha_atual: p1, nova_senha: p2 }) }); toast('Senha alterada!'); $('#cf-pass1').value=''; $('#cf-pass2').value=''; }
  catch (e) { toast(e.message, 'err'); }
}

// ---------- utils ----------
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Link copiado!')); }
function navigate(url) { window.open(url, '_blank'); }

init();
