# blackspot-risk-v01

Motor de risco fitossanitário para doenças foliares do amendoim.

## Doenças suportadas

- Mancha-preta do amendoim
- Mancha-castanha do amendoim

## Status

- Motor validado
- 40 testes automatizados passando
- Relatório terminal multi-doença com:
  - patógeno
  - risco climático
  - risco agronômico
  - relevância de manejo
  - ação recomendada

## Como executar

Configure o talhão em `config/talhao.json` e rode:

```bash
python main.py
```

O campo `doenca_alvo` define qual modelo será executado:

- `Mancha-preta`
- `Mancha-castanha`

## API local

Para rodar a API FastAPI:

```bash
python -m uvicorn src.api.app:app --reload
```

Documentacao interativa:

```text
http://127.0.0.1:8000/docs
```

Exemplo de POST `/analisar`:

```bash
curl -X POST "http://127.0.0.1:8000/analisar" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Talhao A1",
    "cidade": "Tupa-SP",
    "latitude": -21.9347,
    "longitude": -50.5136,
    "data_plantio": "2026-04-10",
    "cultura": "Amendoim",
    "doenca_alvo": "Mancha-castanha",
    "status_lavoura": "em_campo"
  }'
```

## Cadastro de talhoes

Endpoints:

- `GET /talhoes`
- `POST /talhoes`
- `GET /talhoes/{field_id}`
- `PUT /talhoes/{field_id}`
- `DELETE /talhoes/{field_id}`

Os talhoes sao salvos em `outputs/fields.json`. Latitude e longitude sao obtidas automaticamente pela cidade usando geocoding.

Exemplo de POST `/talhoes`:

```bash
curl -X POST "http://127.0.0.1:8000/talhoes" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Talhao A1",
    "cidade": "Tupa-SP",
    "cultura": "Amendoim",
    "data_plantio": "2026-04-10",
    "status_lavoura": "em_campo",
    "doencas_monitoradas": ["Mancha-preta", "Mancha-castanha"]
  }'
```

## Analise de talhao cadastrado

O endpoint `POST /talhoes/{field_id}/analisar` executa uma analise individual
para um talhao ja cadastrado, usando todas as doencas monitoradas nele.

Exemplo:

```bash
curl -X POST "http://127.0.0.1:8000/talhoes/{field_id}/analisar"
```

## Ranking operacional

O endpoint `GET /ranking` analisa os talhoes cadastrados e suas doencas monitoradas, priorizando maior risco agronomico e relevancia operacional de manejo.

Exemplo:

```bash
curl "http://127.0.0.1:8000/ranking"
```

## Inspecoes de campo

As inspecoes registram observacoes feitas em campo para um talhao cadastrado.
Os dados sao salvos em `outputs/inspections.json`.

Endpoints:

- `POST /talhoes/{field_id}/inspecoes`
- `GET /talhoes/{field_id}/inspecoes`

Exemplo de body para `POST /talhoes/{field_id}/inspecoes`:

```json
{
  "disease": "Mancha-preta do amendoim",
  "symptoms_found": true,
  "visual_severity": "media",
  "defoliation_level": "baixa",
  "action_taken": "monitorar",
  "notes": "Lesoes observadas em folhas baixeiras."
}
```

O campo `inspected_at` e opcional. Quando omitido, a API usa o horario atual
com timezone `America/Sao_Paulo`.

## Historico de analises

O endpoint `GET /talhoes/{field_id}/historico-analises` retorna as analises
geradas pelo sistema para um talhao. Esse historico e salvo em
`outputs/analysis_history.json` quando `POST /talhoes/{field_id}/analisar` e
executado, permitindo comparacao futura com inspecoes de campo, sintomas
encontrados e acoes tomadas.

## Testes

Para validar o projeto:

```bash
python -m pytest -v
```
