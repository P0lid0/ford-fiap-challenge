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
| `SUPABASE_JWT_SECRET` | Dashboard → Project Settings → API → **JWT Settings → JWT Secret** | (recomendada para o backend) |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database → **Connection string** (a senha aparece colada na string) | só se for usar `pnpm db:migrate` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | só para usar Claude (senão cai em fallback) |

**Mobile (`apps/mobile/.env.local`)** — adicione também:
```
EXPO_PUBLIC_SUPABASE_URL=<igual ao SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<igual ao SUPABASE_ANON_KEY>
EXPO_PUBLIC_API_URL=http://localhost:3333
```

## Passo 2 — Aplicar schema no Supabase

### Opção A — manual (1 minuto, recomendada se não quiser configurar `SUPABASE_DB_PASSWORD`)
1. Supabase Dashboard → **SQL Editor → New Query**
2. Abra `supabase/migrations.combined.sql` deste repo
3. Copie tudo, cole no editor, **Run**
4. Aguarde "Success. No rows returned"

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

**Para virar admin:** abra Supabase Dashboard → SQL Editor → cole:
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
