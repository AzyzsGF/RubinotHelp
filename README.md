# Rubinot Help

Painel de utilidades para jogadores do RubinOT com calculadora de stamina, bestiário, check-ins de bosses e alertas por navegador/WhatsApp.

## Stack

- Vite + React + TypeScript + Tailwind
- Supabase Auth, Postgres e Storage
- Cloudflare Pages para o site
- Cloudflare Worker com cron para Evolution API

## Rodar local

```bash
npm install
npm run dev
```

Sem `.env.local`, o app usa um backend local em `localStorage`. A primeira conta criada nesse modo vira admin para facilitar testes.

Para usar Supabase:

```bash
cp .env.example .env.local
```

Este workspace ja tem um `.env.local` ignorado pelo git apontando para o projeto:

```text
VITE_SUPABASE_URL=https://zzfqvclrqhlbqcmdnxpa.supabase.co
VITE_SUPABASE_ANON_KEY=<sua publishable key>
```

Depois aplique a migration no banco remoto. O comando principal nao depende de login interativo da CLI; ele le a senha do Postgres de um arquivo local ignorado pelo Git:

```bash
cp .env.supabase.example .env.supabase.local
# preencha SUPABASE_DB_PASSWORD em .env.supabase.local
npm run supabase:db:push
```

Se preferir o fluxo linkado da Supabase CLI, use:

```bash
npm run supabase:login
npm run supabase:link
npm run supabase:db:push:linked
```

O `supabase:link` usa o project ref `zzfqvclrqhlbqcmdnxpa`, mas em ambiente nao interativo ele exige `SUPABASE_ACCESS_TOKEN`.

## Cloudflare Pages

Configure o projeto Pages com:

- Build command: `npm run build`
- Build output: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL=https://zzfqvclrqhlbqcmdnxpa.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<sua publishable key>`
  - `VITE_RUBINOT_BOOSTED_ENDPOINT=https://<seu-worker>/rubinot/boosted` (opcional)

O app usa a [RubinOT Wiki](https://wiki.rubinot.com/pt-BR) como fonte oficial na navegacao e o widget do topo busca boss/monstro boosted em `/rubinot/boosted`. O repositorio ja inclui uma Cloudflare Pages Function nesse caminho; use a variavel `VITE_RUBINOT_BOOSTED_ENDPOINT` apenas se quiser apontar para o Worker separado.

## Worker de WhatsApp

Copie `worker/.dev.vars.example` para `worker/.dev.vars` durante desenvolvimento e preencha:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EVOLUTION_BASE_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
CRON_SECRET=
```

Comandos:

```bash
npm run worker:dev
npm run worker:deploy
```

O Worker roda a cada minuto e processa `notification_jobs` pendentes. Ele envia mensagens via `POST /message/sendText/{instance}` da Evolution API.

Ele tambem expõe `GET /rubinot/boosted`, que consulta `https://rubinot.com.br/`, procura o bloco `BoostedBox-module__6IRxPW__body` e devolve o boss e o monstro boosted para o topo do site.

## Admin

1. Crie sua conta pelo site.
2. No Supabase SQL editor:

```sql
update public.profiles
set is_admin = true
where email = 'seu-email@exemplo.com';
```

3. Recarregue o site e acesse `Admin`.

## Testes

```bash
npm test
npm run build
```

As regras de stamina implementadas seguem a página pública de Server Info do RubinOT: faixas de bonus/normal/reduzida, sem loot abaixo de 08:00, e regeneração orange/green por offline/sleeping, trainer e protection zone.
