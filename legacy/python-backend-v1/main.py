import json
from pathlib import Path

from src.engine.risk_engine import (
    build_compact_analysis_response,
    run_disease_analysis,
    save_compact_analysis_to_json,
)
from src.report.terminal_report import print_terminal_report


COMPACT_JSON_OUTPUT_PATH = "outputs/latest_analysis.json"


def load_field_config(path: str = "config/talhao.json") -> dict:
    config_path = Path(path)

    if not config_path.exists():
        raise FileNotFoundError(f"Arquivo de configuração não encontrado: {path}")

    with open(config_path, "r", encoding="utf-8") as file:
        return json.load(file)


def main():
    talhao = load_field_config()

    result = run_disease_analysis(talhao)

    print_terminal_report(result)

    compact_result = build_compact_analysis_response(result)
    save_compact_analysis_to_json(compact_result, COMPACT_JSON_OUTPUT_PATH)
    print(f"JSON compacto salvo em: {COMPACT_JSON_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
