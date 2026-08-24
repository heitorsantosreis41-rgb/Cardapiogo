# 🍔 CardápioGo

> **Escaneou. Abriu. Pediu.**

MicroSaaS real de **cardápio digital** para restaurantes, lanchonetes, pizzarias, bares, cafeterias, food trucks, padarias e pequenos negócios de alimentação no Brasil. O proprietário cria a conta, cadastra categorias e produtos e publica um cardápio com **URL pública própria** e **QR Code exclusivo**. O cliente escaneia, abre, navega — sem cadastro, sem app.

Este é um **MVP funcional de ponta a ponta**: autenticação, banco de dados, CRUDs, regras de acesso por proprietário, limites reais de plano no backend e QR Code.

---

## ✨ Recursos implementados

- **Landing page** profissional (hero com mockup de celular, benefícios, como funciona, planos, comparativo, demonstração).
- **Autenticação**: cadastro, login, logout, recuperação de senha, redefinição, alteração de senha e perfil.
- **Onboarding em 8 etapas** (nome, tipo de negócio, logo/capa, descrição, contatos, horários, primeira categoria, primeiro produto).
- **Dashboard** com visualizações (hoje/7d/30d), produtos, categorias, plano, gráfico e atalhos.
- **CRUD completo de Produtos**: criar, editar, excluir, duplicar, ativar/desativar, destaque, ingredientes, indisponibilidade.
- **CRUD completo de Categorias** com reordenação.
- **Cardápio público** server-side (SEO, Open Graph, busca, navegação por categoria, aberto agora/fechado, WhatsApp/Instagram), 100% mobile-first, sem login.
- **QR Code** grande + baixar **PNG**, baixar **PDF**, copiar link, imprimir.
- **Personalização (Aparência)**: temas (Moderno, Minimalista, Elegante, Dark, Vibrante), cores e prévia em tempo real.
- **Horário de funcionamento** com 2 períodos por dia e cálculo de "Aberto agora".
- **Estatísticas**: visualizações registradas automaticamente a cada acesso; hoje/7d/30d/total, horários e dias de maior acesso, gráfico.
- **Sistema de planos** com limites **reais no backend**: Grátis = 10, Profissional = 20, Premium = ilimitado. Upgrade preserva todos os produtos.
- **Segurança**: cada usuário só acessa os próprios dados (verificado por testes).
- **Restaurante de demonstração** "Burger House" criado automaticamente na primeira execução.

## 🔒 Limites e preços (configuráveis)

Todos os limites/prices ficam em **`server/lib/plans.js`** — basta editar ali para mudar limites/preços sem tocar no resto da aplicação.

| Plano | Preço | Produtos |
|---|---|---|
| 🆓 Grátis | R$ 0/mês | 10 |
| 🚀 Profissional | R$ 29,90/mês | 20 |
| 💎 Premium | R$ 59,90/mês | Ilimitados |

> Ao atingir o limite, a **criação e a duplicação** são bloqueadas no backend (HTTP 403) e a UI mostra "Você atingiu o limite…" + botão **Fazer upgrade**. Nenhum produto existente é excluído; o upgrade preserva tudo.

## 🏗️ Tecnologia

- **Backend**: Node.js + Express (100% JS puro, sem compilação nativa).
- **Banco de dados**: arquivo JSON com persistência atômica (`data/db.json`), com estruturas `users`, `restaurants`, `categories`, `products`, `business_hours`, `subscriptions`, `analytics`, `password_resets`, `sessions`.
- **Autenticação**: sessão com cookie HttpOnly (`bcryptjs` para senha).
- **QR Code**: lib `qrcode` (PNG) + geração de **PDF padrão 1.4** embutindo a imagem (sem dependência).
- **Frontend**: HTML/CSS/JS vanilla (landing + SPA de painel), mobile-first.

## 📁 Estrutura

```
cardapiogo/
├── server/
│   ├── index.js          # rotas + regras de negócio + limites
│   └── lib/
│       ├── auth.js       # sessões, senha, requireAuth
│       ├── db.js         # armazenamento JSON atômico
│       ├── plans.js      # planos/limites/preços/temas (config)
│       ├── menu_render.js# cardápio público server-side (SEO)
│       ├── qr.js         # QR Code PNG/PDF
│       ├── pdf.js        # gerador de PDF (embute QR)
│       └── seed.js       # restaurante de demonstração
├── public/
│   ├── index.html        # landing page
│   ├── login/register/forgot/reset/onboarding/app/404
│   ├── app.js            # SPA do painel admin
│   └── assets/           # css
├── data/                 # criado em tempo de execução (não versionado)
├── test.js               # 30 testes de integração (automatizados)
└── package.json
```

## ▶️ Como rodar

```bash
npm install
npm start          # http://localhost:3000
```

Variáveis de ambiente:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | não | Porta do servidor (padrão 3000) |
| `CG_BASE_URL` | sim* | URL pública base do app (ex.: `https://app.seudominio.com`) |
| `CG_DATA_DIR` | não | Pasta do banco JSON (padrão `./data`) |
| `ABACATEPAY_API_KEY` | para planos pagos | Chave de API AbacatePay (Bearer token) — **nunca no frontend** |
| `ABACATEPAY_WEBHOOK_SECRET` | para planos pagos | Secret que você define ao cadastrar o webhook no painel |
| `ABACATEPAY_PUBLIC_KEY` | não | Chave pública (fixa da documentação, já embutida como padrão) |
| `CG_ALLOW_INSTANT_UPGRADE` | não | `1` libera upgrade direto (somente teste/demo; em produção planos pagos exigem PIX) |

\* `CG_BASE_URL` é usada para montar a URL pública dos cardápios/QR e o link de reset.

**Conta de demonstração** (criada no seed):
```
e-mail: demo@cardapiogo.com.br
senha:  demo123
Cardápio público: http://localhost:3000/menu/burger-house
```

**Testes:** `npm test` roda 33 verificações (autenticação, limites, isolamento entre usuários, QR, recuperação de senha, segurança do webhook).

---

## 🚀 Publicar (deploy) — ter uma URL pública de verdade

O projeto já vem com **`Dockerfile`**, **`render.yaml`** (Render) e **`Procfile`** (Railway), prontos para deploy. Para o webhook da AbacatePay funcionar, o app precisa de uma **URL HTTPS pública**.

**Caminho mais rápido (Render, plano grátis):**
1. Suba este código para um repositório GitHub.
2. Em [render.com](https://render.com), crie conta grátis → **New → Web Service** → conecte o repositório.
3. O Render usa o `render.yaml` (ou Dockerfile) automaticamente e te devolve a URL, ex.: `https://cardapiogo.onrender.com`.
4. Defina as variáveis no painel: `CG_BASE_URL` (sua URL), `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`.
5. Cadastre o webhook na AbacatePay com URL `https://SUA_URL/api/webhooks/abacatepay` + evento `transparent.completed`.

**Persistência de dados:** o banco JSON fica em `./data`. Em Render/Railway o disco é efêmero (reseta ao redeploy) — para produção adicione um **disco persistente** e aponte `CG_DATA_DIR` para ele (ou migre para um banco real).

**Health check:** `GET /health` → `{ ok: true }`.

## 💳 Pagamento de planos — AbacatePay (PIX)

Os planos **Profissional (R$ 29,90/mês)** e **Premium (R$ 59,90/mês)** são ativados por **PIX** via AbacatePay. O plano **só é liberado após a confirmação real do pagamento** — o botão "Já paguei" apenas revalida o status; nada é liberado por clique.

### Como ativar

1. **Crie uma chave de API** no painel AbacatePay (Configurações → API Keys).
2. **Defina um webhook** no dashboard da AbacatePay (`app.abacatepay.com/webhooks` → **Criar**):
   ```
   Nome:  CardápioGo - pagamentos
   URL:   https://SEU_DOMINIO/api/webhooks/abacatepay
   Secret: <um valor aleatório que você inventa>   ← anote este valor
   Evento: transparent.completed
   ```
   A AbacatePay envia o `Secret` automaticamente como `?webhookSecret=...` em cada requisição — você **não** digita a query string na URL. O `Secret` que você definir aqui precisa ser o **mesmo** valor de `ABACATEPAY_WEBHOOK_SECRET` no servidor.
3. Configure as variáveis no servidor:
   ```
   ABACATEPAY_API_KEY=sk_...
   ABACATEPAY_WEBHOOK_SECRET=SEU_SECRET
   ```

### Como o plano é liberado (segurança)

- `POST /api/me/subscription/checkout` → cria a cobrança PIX na AbacatePay e devolve QR Code (`brCodeBase64`) + código copia-e-cola (`brCode`).
- **Webhook** `POST /api/webhooks/abacatepay` → valida o `webhookSecret` (query) **e** a assinatura HMAC-SHA256 (`X-Webhook-Signature`, com a chave pública da AbacatePay). Só então ativa o plano. **Idempotente** (ignora eventos repetidos).
- `GET/POST /api/me/subscription/checkout/:id[/check]` → consulta o status real na AbacatePay e ativa somente se a AbacatePay retornar `PAID`.
- `POST /api/me/subscription/upgrade` só aceita plano **gratuito** (downgrade); planos pagos retornam `403 PAYMENT_REQUIRED` (a menos de `CG_ALLOW_INSTANT_UPGRADE=1`, reservado a testes/demo).
- A chave de API fica **apenas no backend** (variável de ambiente), nunca exposta ao navegador.

### Credenciais que VOCÊ precisa inserir

- **`ABACATEPAY_API_KEY`** — gerada no painel AbacatePay.
- **`ABACATEPAY_WEBHOOK_SECRET`** — o secret que você definir ao criar o webhook no dashboard (a AbacatePay o anexa automaticamente à URL).
- **`CG_BASE_URL`** — a URL pública do app (precisa estar exposta para o webhook da AbacatePay alcançá-la).
- `ABACATEPAY_PUBLIC_KEY` — opcional; a chave pública da AbacatePay já vem embutida como padrão (constante pública dos docs).

## 🔮 Arquitetura para o futuro (MVP não inclui como obrigatório)

O modelo de dados e as rotas foram preparadas para evoluir sem retrabalho:
- **Pedidos online**: campos/estrutura já separados por produto/categoria; adicionar entidades `carts/order_items/orders` e estados (local/retirada/delivery).
- **WhatsApp**: o restaurante já guarda o `whatsapp`; o fluxo "montar pedido → enviar pelo WhatsApp" usa o link `https://wa.me/…` com a mensagem montada.
- **Pagamento Pix / online**: os próximos entregáveis, plugando um gateway no upgrade de assinatura.
- **Estatísticas avançadas** (produtos mais vistos, categorias mais acessadas, comparação de períodos): os eventos de `analytics` já têm `product_id` para suportar isso no Premium.

## 🔐 Segurança

- Sessão httpOnly por cookie, senha com `bcrypt`.
- Toda rota de dados usa o `user_id` da sessão para filtrar (nunca confia em IDs do cliente).
- CRUD verifica `restaurant_id` do dono em cada operação → **Usuário A nunca vê/edita dados de Usuário B** (coberto por testes).