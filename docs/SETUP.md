# Setup detalhado

## Passo 1 — Variáveis de ambiente

Crie `.env.local` na raiz (copia de `.env.example`):

```bash
cp .env.example .env.local
```

Edite e preencha:

| Variável | Onde encontrar | Obrigatória? |
|---|---|---|
| `SUPABASE_URL` | já está no arquivo | ✓ |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → **anon public** | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | já está no arquivo | ✓ |
| `CLIENT_CPF_PEPPER` | gere um segredo aleatório com `openssl rand -hex 32` | ✓ |
| `ML_SERVICE_TOKEN` | gere um segredo aleatório com `openssl rand -hex 32`; use o mesmo valor na API e no serviço ML | ✓ |
| `API_HOST` | padrão `127.0.0.1`; use `0.0.0.0` apenas se outro dispositivo ou container precisar acessar a API | opcional |
| `TRUST_PROXY` | `false` localmente; `true` somente atrás de um proxy confiável | recomendado |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database → **Connection string** (a senha aparece colada na string) | só se for usar `pnpm db:migrate` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | só para usar Claude (senão cai em fallback) |

Não troque `CLIENT_CPF_PEPPER` sem planejar a migração dos hashes existentes.
O CPF original não é guardado, então um hash antigo não pode ser recalculado sem
receber o CPF novamente de uma fonte autorizada.

**Mobile (`apps/mobile/.env.local`)** — adicione também:
```
EXPO_PUBLIC_SUPABASE_URL=<igual ao SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<igual ao SUPABASE_ANON_KEY>
EXPO_PUBLIC_API_URL=http://localhost:3333
```

## Passo 2 — Aplicar schema no Supabase

### Opção A — manual
1. Supabase Dashboard → **SQL Editor → New Query**
2. Abra cada arquivo em `supabase/migrations/` pela ordem do nome, começando em `20260514_001_init.sql` e terminando em `20260926_019_sprint3_security_hardening.sql`.
3. Execute uma migração por vez e confirme sucesso antes da próxima.

Para uma instalação nova, você também pode colar `supabase/migrations.combined.sql`
no SQL Editor. Regenere a cópia depois de alterar migrations:

```bash
python scripts/combine-migrations.py
```

Não execute o arquivo combinado em um banco já existente. Use `pnpm db:migrate`
para aplicar somente migrations pendentes.

### Opção B — automatizado (precisa `SUPABASE_DB_PASSWORD`)
```bash
pnpm install
pnpm db:migrate
```

## Passo 3 — Seed de veículos (Desafio 1)

```bash
pnpm db:seed
```

Insere Ranger Raptor, Hilux GR-S, RAM 1500 TRX, Amarok V6, Bronco Wildtrack.

## Passo 4 — Criar seu primeiro usuário

No app mobile, abra `Cadastrar` na tela de login. Você vai criar um usuário com o role default `analista`. O trigger `handle_new_user` cria automaticamente o `profile` no banco.

**Para virar admin:** abra Supabase Dashboard → SQL Editor → cole. Mudanças de
role e concessionária são provisionadas por um administrador no banco, não pelo
app:
```sql
update public.profiles set role = 'admin' where email = 'seu@email.com';
```

**Para se vincular a uma dealership:**
```sql
update public.profiles
set dealership_id = (select id from public.dealerships where codigo = 'FD001')
where email = 'seu@email.com';
```

## Passo 5 — Treinar o modelo

```bash
cd services/ml
pip install -r requirements.txt
python -m src.scripts.train_models 10000
```

## Passo 6 — Rodar tudo

Em 3 terminais separados:

```bash
# Terminal 1
cd services/ml && python -m uvicorn src.main:app --reload --port 8001

# Terminal 2
cd apps/api && pnpm dev

# Terminal 3
cd apps/mobile && pnpm start
```

## Troubleshooting

**"Could not find the table 'public.profiles'"** → migrations não foram aplicadas (passo 2).

**Mobile não loga: "Invalid API key"** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` faltando ou errada.

**ML service responde 503: "modelo não encontrado"** → rode `python -m src.scripts.train_models` (passo 5).

**API responde 500 quando chama `/clients`** → o `created_by` precisa de um `profiles.id` válido. Faça o passo 4 antes.

**`pnpm db:migrate` falha com "Tenant or user not found"** → o pooler está em outra região. Use a Opção A do passo 2.
