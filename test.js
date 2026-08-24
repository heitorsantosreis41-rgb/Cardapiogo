// Teste de integração end-to-end do CardápioGo
process.env.PORT = '3099';
process.env.CG_BASE_URL = 'http://localhost:3099';
process.env.CG_DATA_DIR = '/tmp/cgtest-data';
// Permite upgrade instantâneo apenas nos testes/demo. Em produção planos pagos
// exigem o checkout PIX real da AbacatePay (ver /api/me/subscription/checkout).
process.env.CG_ALLOW_INSTANT_UPGRADE = '1';
process.env.ABACATEPAY_WEBHOOK_SECRET = 'test-webhook-secret';
const fs = require('fs');
fs.rmSync('/tmp/cgtest-data', { recursive: true, force: true });

const app = require('/home/user/cardapiogo/server/index.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
const BASE = 'http://localhost:3099';
const jars = {};

async function j(method, path, body, cookie) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data, setCookies: res.headers.get('set-cookie') || '' };
}
function save(key, setCookies) { if (setCookies) jars[key] = setCookies.split(';')[0]; }
const C = (key) => jars[key] || '';

(async () => {
  await new Promise(r => setTimeout(r, 500));
  console.log('\n== Landing / publico ==');
  let r = await fetch(BASE + '/'); check('landing 200', r.status === 200);
  r = await fetch(BASE + '/menu/burger-house'); check('menu publico demo 200', r.status === 200);
  const html = await r.text();
  check('SEO title', html.includes('Burger House | CardápioGo'));
  check('Open Graph', html.includes('property="og:'));
  check('busca', html.includes('O que você está procurando'));
  check('aberto/fechado', html.includes('Aberto agora') || html.includes('Fechado'));

  console.log('\n== Demo auth ==');
  let l = await j('POST', '/api/auth/login', { email: 'demo@cardapiogo.com.br', senha: 'demo123' });
  save('demo', l.setCookies);
  check('login demo', l.status === 200 && l.data.user.email === 'demo@cardapiogo.com.br');
  let sub = await j('GET', '/api/me/subscription', null, C('demo'));
  check('sub gratis limite 10', sub.data.plano.id === 'gratis' && sub.data.limite === 10);

  console.log('\n== Limite gratis ==');
  const cur = (await j('GET', '/api/products', null, C('demo'))).data.length;
  for (let i = 0; i < 10 - cur; i++) await j('POST', '/api/products', { nome: 'Teste ' + (i + 1), preco: 1 }, C('demo'));
  let add11 = await j('POST', '/api/products', { nome: 'Extra 11', preco: 1 }, C('demo'));
  check('bloqueia 11o gratis', add11.status === 403 && add11.data.code === 'LIMIT');
  check('mensagem de limite', (add11.data.error || '').includes('10'));
  const count = (await j('GET', '/api/products', null, C('demo'))).data.length;
  check('nenhum excluido (10)', count === 10);
  let dup = await j('POST', '/api/products/' + (await j('GET', '/api/products', null, C('demo'))).data[0].id + '/duplicate', {}, C('demo'));
  check('duplicar bloqueado no limite', dup.status === 403);

  console.log('\n== Upgrade premium preserva + libera ==');
  let up = await j('POST', '/api/me/subscription/upgrade', { plano: 'premium' }, C('demo'));
  check('upgrade premium ilimitado', up.data.plano.nome === 'Premium' && up.data.ilimitado === true);
  let add = await j('POST', '/api/products', { nome: 'Premium extra', preco: 2 }, C('demo'));
  check('premium aceita produto', add.status === 201);
  const count2 = (await j('GET', '/api/products', null, C('demo'))).data.length;
  check('preservou todos (11)', count2 === 11);

  console.log('\n== Visualizacoes ==');
  for (let i = 0; i < 3; i++) await j('POST', '/api/menu/burger-house/view');
  let st = (await j('GET', '/api/me/stats', null, C('demo'))).data;
  check('views >= 3 hoje', st.total >= 3 && st.visualizacoesHoje >= 3);
  check('serie 30 dias', Array.isArray(st.serie) && st.serie.length === 30);

  console.log('\n== Registro novo + isolamento ==');
  let reg = await j('POST', '/api/auth/register', { nome: 'Joao', restaurante: 'Cantina Joao', email: 'joao@teste.com', senha: 'joao123' });
  save('joao', reg.setCookies);
  check('registro + cookie', reg.status === 201 && !!C('joao'));
  const demoProd = (await j('GET', '/api/products', null, C('demo'))).data[0];
  let b = await j('PUT', '/api/products/' + demoProd.id, { nome: 'HACK' }, C('joao'));
  check('B nao edita produto de A', b.status === 404 || b.status === 403);
  let bCat = await j('GET', '/api/categories', null, C('joao'));
  check('B ve so suas categorias (0)', bCat.data.length === 0);
  let bStats = await j('GET', '/api/me/stats', null, C('joao'));
  check('B stats nao expoe A (total 0)', bStats.status === 200 && bStats.data.total === 0);

  console.log('\n== CRUD categorias ==');
  let c1 = await j('POST', '/api/categories', { nome: 'Bebidas', emoji: '🥤' }, C('joao'));
  let c2 = await j('POST', '/api/categories', { nome: 'Porcoes' }, C('joao'));
  check('cria categorias', c1.status === 201 && c2.status === 201);
  let re = await j('POST', '/api/categories/reorder', { order: [c2.data.id, c1.data.id] }, C('joao'));
  check('reorder ok', re.status === 200);
  let cats = (await j('GET', '/api/categories', null, C('joao'))).data;
  check('ordem aplicada', cats[0].id === c2.data.id);

  console.log('\n== QR ==');
  let png = await fetch(BASE + '/api/me/qr.png', { headers: { cookie: C('demo') } });
  let pdf = await fetch(BASE + '/api/me/qr.pdf', { headers: { cookie: C('demo') } });
  const pb = Buffer.from(await png.arrayBuffer());
  const pdb = Buffer.from(await pdf.arrayBuffer());
  check('qr.png e PNG valido', png.status === 200 && pb.length > 1000 && pb.toString('latin1', 1, 4) === 'PNG');
  check('qr.pdf e PDF valido', pdf.status === 200 && pdb.toString('latin1', 0, 5) === '%PDF-');

  console.log('\n== Recuperacao de senha ==');
  let fo = await j('POST', '/api/auth/forgot', { email: 'joao@teste.com' });
  check('forgot gera link', fo.data.resetLink && fo.data.resetLink.includes('token='));
  const token = fo.data.resetLink.split('token=')[1];
  let reset = await j('POST', '/api/auth/reset', { token, senha: 'novasenha123' });
  check('reset ok', reset.status === 200);
  let loginNew = await j('POST', '/api/auth/login', { email: 'joao@teste.com', senha: 'novasenha123' });
  check('login com nova senha', loginNew.status === 200);

  console.log('\n== Protecao de rota sem auth ==');
  let noauth = await j('GET', '/api/products');
  check('sem cookie -> 401', noauth.status === 401);

  console.log('\n== Webhook AbacPay (seguranca) ==');
  let whNoSecret = await fetch(BASE + '/api/webhooks/abacatepay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('webhook sem secret -> 401', whNoSecret.status === 401);
  let whBadSecret = await fetch(BASE + '/api/webhooks/abacatepay?webhookSecret=errado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('webhook secret errado -> 401', whBadSecret.status === 401);
  let whNoSig = await fetch(BASE + '/api/webhooks/abacatepay?webhookSecret=' + process.env.ABACATEPAY_WEBHOOK_SECRET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('webhook assinatura ausente -> 401', whNoSig.status === 401);

  console.log(`\n==== RESULTADO: ${pass} OK, ${fail} FAIL ====`);
  process.exit(fail ? 1 : 0);
})();