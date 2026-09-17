# PeanuTec V2 Architecture

## Principio

```text
Next vira o produto; Python vira a inteligencia do produto.
```

## Componentes

`apps/web`

- Produto operacional.
- APIs do produto.
- Prisma e SQLite local.
- Cache meteorologico.
- Persistencia das analises.
- Autenticacao e autorizacao da V2.

`services/intelligence`

- FastAPI em `http://127.0.0.1:8001`.
- Calculo de features.
- Motor de risco.
- Contrato puro: recebe snapshot do talhao e snapshot meteorologico.
- Nao consulta Open-Meteo.
- O motor e mantido integralmente dentro da V2.

`Open-Meteo`

- Consumido pelo Next, via cache em `apps/web/server/weather`.
- O snapshot resultante e enviado ao Intelligence Service.

`Prisma`

- Persistencia operacional de talhoes, usuarios, sessoes, produtos, inspecoes, pulverizacoes, calendario e historico de analises.

## Fluxo de Analise

```text
Talhao Prisma
  -> Next
  -> Weather cache
  -> WeatherSnapshot
  -> services/intelligence /analisar
  -> resultado compacto
  -> Next
  -> AnalysisHistory Prisma
```

O endpoint registrado e:

```text
POST /api/fields/[id]/analysis
```

O endpoint valida a propriedade do talhao, consulta as doencas monitoradas, busca o clima uma vez por talhao e envia o snapshot ao Intelligence Service.

A interface principal para executar a leitura esta em `/talhoes`.

## Doencas Suportadas

A fonte canonica no Next esta em:

```text
apps/web/lib/supported-diseases.ts
```

Doencas atuais:

- Mancha-preta.
- Mancha-castanha.

O frontend e o Intelligence Service nao dependem do backend legado para descobrir ou analisar doencas.

## Dependencias Legadas

O backend V1 foi removido da arvore da V2. O codigo operacional atual nao depende de `legacy/python-backend-v1`, nem para autenticacao, nem para o motor de risco, nem para os fluxos de talhao, clima, analise, ranking, safra ou relatorios.
