# PeanuTec V2 Stabilization Report

Data da estabilizacao: 2026-09-14

## 1. Estado inicial encontrado

- `apps/web` ja concentrava a maior parte do produto operacional com Next.js, Prisma e SQLite.
- `services/intelligence` ja existia como FastAPI em desenho de inteligencia pura, recebendo snapshot de talhao e clima.
- `legacy/python-backend-v1` ainda e usado como biblioteca de referencia pelo `engine_adapter`, mas nao precisa rodar como API para os fluxos principais validados.
- `npx tsc --noEmit` falhava em `server/analysis/field-analysis.service.ts`, porque `analyzeFieldSnapshot` exigia a lista de doencas e a chamada passava apenas o talhao.
- O `.env` do web apontava `PEANUTEC_INTELLIGENCE_URL` para `http://127.0.0.1:8000`, divergindo da porta V2 `8001`.
- O frontend ainda chamava `/doencas` e `/analisar` pelo client legado em `lib/api.ts`.
- A rota `/api/fields/[id]/situation` era chamada pelo frontend, mas nao existia em `app/api`, retornando 404.
- A rota `/api/fields/[id]/inspections` estava implementada como rota de inspecao em escopo e nao aceitava GET por talhao.
- O Git ja estava em estado de reorganizacao ampla antes desta missao: diretorios antigos apareciam como removidos e `apps/`, `services/`, `legacy/` como nao rastreados.

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

## 4. Arquivos modificados

- `apps/web/.env`
- `apps/web/package.json`
- `apps/web/README.md`
- `apps/web/lib/api.ts`
- `apps/web/lib/supported-diseases.ts`
- `apps/web/server/fields/field.service.ts`
- `apps/web/server/analysis/field-analysis.service.ts`
- `apps/web/app/api/intelligence/analyze/route.ts`
- `apps/web/app/api/fields/[id]/analysis/route.ts`
- `apps/web/app/api/fields/[id]/situation/route.ts`
- `apps/web/app/api/fields/[id]/inspections/route.ts`
- `apps/web/server/situation/route.ts` removido
- `apps/web/components/AnalysisForm.tsx`
- `apps/web/components/FieldDashboard.tsx`
- `apps/web/components/Sidebar.tsx`
- `apps/web/components/TopBar.tsx`
- `apps/web/components/field/FieldWorkspace.tsx`
- `apps/web/app/calendario/page.tsx`
- `apps/web/app/inspecoes/nova/page.tsx`
- `apps/web/app/produtos/page.tsx`
- `apps/web/app/pulverizacoes/nova/page.tsx`
- `apps/web/server/inspections/inspection.service.ts`
- `apps/web/server/sprays/spray.service.ts`
- `apps/web/scripts/smoke-main-flows.mjs`
- `services/intelligence/requirements.txt`
- `services/intelligence/tests/test_main.py`
- `docs/ARCHITECTURE.md`

## 5. APIs migradas/removidas

- Removida dependencia operacional de `GET /doencas` do backend V1.
- Removida chamada client-side operacional a `/analisar` no backend V1.
- Adicionada rota Next `POST /api/intelligence/analyze` para analise avulsa.
- Corrigida rota Next `GET /api/fields/[id]/situation`.
- Corrigida rota Next `GET/POST /api/fields/[id]/inspections`.

## 6. Dependencias do legado restantes

- `services/intelligence/app/engine_adapter.py` ainda importa o motor legado como biblioteca de calculo em `legacy/python-backend-v1/src`.
- `apps/web/lib/api.ts` ainda contem chamadas de autenticacao legada (`/auth/login`, `/auth/register`, `/auth/me`) via `NEXT_PUBLIC_LEGACY_AUTH_API_URL`.
- Nenhum fluxo operacional validado de talhao, clima, analise, ranking, safra ou relatorio exigiu o backend V1 rodando como API.

## 7. Testes executados

- `npx tsc --noEmit`
- `npm run lint`
- `python -m pytest -q` em `services/intelligence`
- `npm run smoke:main`
- `GET http://127.0.0.1:8001/health`
- `GET /api/fields`
- `GET /api/fields/[id]/weather` duas vezes para validar miss e hit
- `POST /api/fields/[id]/analysis`
- `GET /api/fields/[id]/analysis`
- `GET /api/fields/[id]/situation`
- `GET /api/fields/[id]/operational-context`
- `GET /api/fields/[id]/technical-report`
- `GET /api/fields/[id]/technical-report/pdf`
- `GET /api/ranking`
- `GET /api/season/metrics`
- `GET /api/season/overview`
- Smoke manual de CRUD de talhao com criacao, edicao, listagem e delete.
- Smoke manual de criacao de inspecao e pulverizacao.

## 8. Resultados dos testes

- TypeScript: passou.
- Lint: passou.
- Intelligence tests: `10 passed`.
- Smoke web: `PeanuTec main-flow smoke test passed.`
- Intelligence `/health`: respondeu 200.
- Next iniciou e respondeu 200 em `/api/fields`.
- Weather cache: primeira chamada `forecast=miss historical=miss`; segunda chamada `forecast=hit historical=hit`.
- Analise registrada com duas doencas: respondeu 200 com `total_analyses=2`.
- Historico persistido em `AnalysisHistory` e lido por GET.
- Situacao atual respondeu 200.
- Ranking, metricas e resumo da safra responderam 200 sem disparar inferencia Python no smoke.
- Relatorio tecnico JSON respondeu 200.
- Relatorio tecnico PDF respondeu 200 com `application/pdf`.

## 9. Problemas ainda conhecidos

- A autenticacao ainda depende do backend legado se `NEXT_PUBLIC_DISABLE_AUTH` for removido.
- `services/intelligence` ainda depende do codigo legado como biblioteca interna do motor de risco.
- O worktree Git esta em estado de reorganizacao grande e deve ser normalizado antes de um commit/release formal.
- O smoke web depende de Next e Intelligence ja estarem rodando.
- O smoke web consulta Open-Meteo via cache do Next; se a rede externa cair, esse smoke pode falhar por indisponibilidade externa.

## 10. Proximas implementacoes recomendadas

- Migrar autenticacao para Next ou outro provedor definido e remover dependencia de `/auth/*` no V1.
- Extrair gradualmente o motor legado usado pelo `engine_adapter` para codigo proprio de `services/intelligence`.
- Adicionar testes unitarios do weather cache com mock de `fetch`, cobrindo deduplicacao concorrente explicitamente.
- Criar pipeline local/CI que rode `tsc`, `lint`, `pytest` e smoke controlado.
- Preparar Docker apenas depois de estabilizar o fluxo local e variaveis.
