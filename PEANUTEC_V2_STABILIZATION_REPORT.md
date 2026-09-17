# PeanuTec V2 Stabilization Report

Data da estabilizacao: 2026-09-14

## 1. Estado inicial encontrado

- `apps/web` ja concentrava a maior parte do produto operacional com Next.js, Prisma e SQLite.
- `services/intelligence` ja existia como FastAPI em desenho de inteligencia pura, recebendo snapshot de talhao e clima.
- `legacy/python-backend-v1` ainda era usado como biblioteca de referencia pelo `engine_adapter`.
- `npx tsc --noEmit` falhava em `server/analysis/field-analysis.service.ts`, porque `analyzeFieldSnapshot` exigia a lista de doencas e a chamada passava apenas o talhao.
- O `.env` do web apontava `PEANUTEC_INTELLIGENCE_URL` para `http://127.0.0.1:8000`, divergindo da porta V2 `8001`.
- O frontend ainda chamava `/doencas` e `/analisar` pelo client legado em `lib/api.ts`.
- A rota `/api/fields/[id]/situation` era chamada pelo frontend, mas nao existia em `app/api`, retornando 404.
- A rota `/api/fields/[id]/inspections` estava implementada como rota de inspecao em escopo e nao aceitava GET por talhao.
- O Git ja estava em estado de reorganizacao ampla antes desta missao.

## 2. Problemas identificados

- Erro TypeScript no fluxo de analise registrada.
- Dependencia operacional indevida do backend V1 para descobrir doencas suportadas.
- Analise avulsa de `AnalysisForm` chamava `/analisar` no backend legado.
- Variavel de ambiente apontava para a porta antiga.
- Endpoint de situacao atual ausente.
- Endpoint de inspecoes por talhao incompleto.
- Mensagens de erro ainda orientavam o dev a subir FastAPI em `8000`.
- Lint acusava `setState` sincronico em effects e imports mortos.
- README ainda era o template padrao do Next.

## 3. Alteracoes realizadas

- Criada fonte canonica de doencas em `apps/web/lib/supported-diseases.ts`.
- `getSupportedDiseases()` passou a responder localmente no Next, sem `GET /doencas`.
- `analyzeField()` passou a chamar `POST /api/intelligence/analyze`, rota Next server-side.
- Criado `POST /api/intelligence/analyze`, que busca clima no Next e chama `services/intelligence`.
- `runFieldAnalysis()` agora passa `field.doencas_monitoradas` para `analyzeFieldSnapshot`.
- Corrigido `.env` para `PEANUTEC_INTELLIGENCE_URL=http://127.0.0.1:8001`.
- Criado `GET /api/fields/[id]/situation`.
- Corrigido `GET/POST /api/fields/[id]/inspections`.
- Removido arquivo morto `apps/web/server/situation/route.ts`.
- Adicionados testes do Intelligence Service.
- Adicionado smoke test web `npm run smoke:main`.
- Corrigidos lint errors e imports mortos.
- Atualizados `apps/web/README.md` e `docs/ARCHITECTURE.md`.
- Migrado o motor de risco necessario para `services/intelligence`.
- Migrada a autenticacao para a V2 com `User` + `Session` e ownership dos talhoes.
- Adicionado fluxo de analise em `/talhoes`.
- Descomissionado e removido o backend legado da arvore da V2.

## 4. APIs migradas/removidas

- Removida dependencia operacional de `GET /doencas` do backend V1.
- Removida chamada client-side operacional a `/analisar` no backend V1.
- Adicionada rota Next `POST /api/intelligence/analyze` para analise avulsa.
- Adicionada rota Next `POST /api/fields/[id]/analysis` para analise registrada por talhao.
- Corrigida rota Next `GET /api/fields/[id]/situation`.
- Corrigida rota Next `GET/POST /api/fields/[id]/inspections`.
- Removidos os endpoints operacionais de autenticacao do V1; a V2 possui auth propria.

## 5. Validacao

A rodada local de 2026-09-17 antes da remocao do legado passou em todas as etapas:

- Prisma generate: PASS.
- Prisma migrations: PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Auth Vitest: `9/9` PASS.
- Intelligence pytest: `24/24` PASS.
- Weather Vitest: `14/14` PASS.
- Smoke dos fluxos principais: PASS.
- Analise registrada de talhao: HTTP 200.
- Intelligence `/analisar`: HTTP 200.

A validacao final, com o legado removido da arvore, deve ser executada localmente antes do sincronismo com o repositorio original.

## 6. Estado atual

- `apps/web` e o produto operacional da V2.
- `services/intelligence` concentra o motor de risco da V2 e trabalha sobre snapshots.
- O Next controla autenticacao, autorizacao, persistencia, cache meteorologico e orquestracao da analise.
- O backend legado nao faz parte da arvore atual da V2.
- A interface `/talhoes` permite executar a analise por talhao.

## 7. Proximas implementacoes recomendadas

- Adicionar testes unitarios do weather cache com mock de `fetch`, cobrindo deduplicacao concorrente explicitamente.
- Criar pipeline local/CI que rode `tsc`, `lint`, `pytest` e smoke controlado.
- Preparar Docker apenas depois de estabilizar o fluxo local e variaveis.
