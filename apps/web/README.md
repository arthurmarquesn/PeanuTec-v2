# PeanuTec V2 Web

Next.js e Prisma formam o produto operacional do PeanuTec V2.

## Papel do `apps/web`

- Banco operacional via Prisma + SQLite local.
- Talhoes, produtos, inspecoes, pulverizacoes e calendario.
- Situacao atual, ranking, metricas da safra e resumo da safra.
- Relatorios tecnico JSON/PDF.
- Cache meteorologico e chamadas ao Open-Meteo.
- Persistencia de `AnalysisHistory`.
- Integracao server-side com `services/intelligence`.

O backend legado nao deve ser usado como API operacional do produto. A excecao atual e a autenticacao legada, isolada em `NEXT_PUBLIC_LEGACY_AUTH_API_URL`, enquanto a autenticacao propria do Next ainda nao existe.

## Desenvolvimento Local

Terminal 1, web:

```bash
cd apps/web
npm install
npm run dev
```

URL padrao:

```text
http://127.0.0.1:3000
```

Terminal 2, intelligence:

```bash
cd services/intelligence
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

## Variaveis

`apps/web/.env`:

```env
DATABASE_URL="file:./prisma/peanutec-v2.db"
PEANUTEC_INTELLIGENCE_URL="http://127.0.0.1:8001"
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_DISABLE_AUTH=true
```

Opcional, apenas para autenticacao legada:

```env
NEXT_PUBLIC_LEGACY_AUTH_API_URL="http://127.0.0.1:8000"
```

## Prisma

Schema:

```text
apps/web/prisma/schema.prisma
```

Banco local:

```text
apps/web/prisma/peanutec-v2.db
```

Gerar client, quando necessario:

```bash
npx prisma generate
```

## Verificacoes

TypeScript:

```bash
npx tsc --noEmit
```

Lint:

```bash
npm run lint
```

Smoke dos fluxos principais, com Next e Intelligence rodando:

```bash
npm run smoke:main
```

O smoke cria um talhao temporario, executa os principais fluxos e remove o talhao ao final.

## Fluxo de Analise

```text
Field Prisma
  -> Next API
  -> Weather cache no Next
  -> WeatherSnapshot
  -> services/intelligence
  -> resultado
  -> Next
  -> AnalysisHistory Prisma
```

Para um talhao com Mancha-preta e Mancha-castanha:

- o Next busca um unico `WeatherSnapshot`;
- o mesmo snapshot e reutilizado nas duas inferencias;
- o Python nao consulta Open-Meteo;
- o Next persiste o resultado em `AnalysisHistory`.
