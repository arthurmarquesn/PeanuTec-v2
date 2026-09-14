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

`services/intelligence`

- FastAPI em `http://127.0.0.1:8001`.
- Calculo de features.
- Motor de risco.
- Contrato puro: recebe snapshot do talhao e snapshot meteorologico.
- Nao consulta Open-Meteo.

`legacy/python-backend-v1`

- Referencia historica.
- Biblioteca temporaria para partes do motor usadas pelo `engine_adapter`.
- Nao deve ser necessario como API operacional do produto.

`Open-Meteo`

- Consumido pelo Next, via cache em `apps/web/server/weather`.
- O snapshot resultante e enviado ao Intelligence Service.

`Prisma`

- Persistencia operacional de talhoes, produtos, inspecoes, pulverizacoes, calendario e historico de analises.

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

O endpoint consulta o talhao, reutiliza as doencas monitoradas, busca o clima uma vez por talhao e envia uma requisicao ao Intelligence Service por doenca.

## Doencas Suportadas

A fonte canonica no Next esta em:

```text
apps/web/lib/supported-diseases.ts
```

Doencas atuais:

- Mancha-preta.
- Mancha-castanha.

O frontend nao chama mais `GET /doencas` no backend legado.

## Dependencia Legada Restante

A autenticacao ainda pode usar o backend V1 via:

```text
NEXT_PUBLIC_LEGACY_AUTH_API_URL
```

Essa dependencia esta isolada em `apps/web/lib/api.ts` e nao faz parte dos fluxos operacionais principais de talhao, clima, analise, ranking, safra ou relatorios.
