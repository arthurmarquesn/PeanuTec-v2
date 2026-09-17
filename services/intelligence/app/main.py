from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from app.engine_adapter import (
    run_disease_analysis_from_snapshot,
)


# ============================================================
# Constants
# ============================================================

SUPPORTED_DISEASES = [
    "Mancha-preta",
    "Mancha-castanha",
]

SUPPORTED_CROP_STATUSES = [
    "em_campo",
    "pre_arranquio",
    "arrancado",
    "colhido",
]

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# ============================================================
# Request models
# ============================================================


class FieldSnapshot(BaseModel):
    nome: str
    cidade: str

    latitude: float = Field(
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ge=-180,
        le=180,
    )

    data_plantio: date
    cultura: str
    doenca_alvo: str
    status_lavoura: str = "em_campo"

    @field_validator(
        "nome",
        "cidade",
        "cultura",
        "doenca_alvo",
        "status_lavoura",
        mode="before",
    )
    @classmethod
    def strip_string_fields(
        cls,
        value,
    ):
        if isinstance(
            value,
            str,
        ):
            return value.strip()

        return value

    @field_validator(
        "nome",
        "cidade",
    )
    @classmethod
    def reject_empty_fields(
        cls,
        value: str,
    ) -> str:
        if not value:
            raise ValueError(
                "campo não pode ser vazio"
            )

        return value

    @field_validator(
        "cultura",
    )
    @classmethod
    def validate_crop(
        cls,
        value: str,
    ) -> str:
        if value != "Amendoim":
            raise ValueError(
                "cultura deve ser Amendoim"
            )

        return value

    @field_validator(
        "doenca_alvo",
    )
    @classmethod
    def validate_disease(
        cls,
        value: str,
    ) -> str:
        if (
            value
            not in SUPPORTED_DISEASES
        ):
            raise ValueError(
                "doenca_alvo deve ser "
                "Mancha-preta ou "
                "Mancha-castanha"
            )

        return value

    @field_validator(
        "status_lavoura",
    )
    @classmethod
    def validate_crop_status(
        cls,
        value: str,
    ) -> str:
        if (
            value
            not in SUPPORTED_CROP_STATUSES
        ):
            raise ValueError(
                "status_lavoura inválido"
            )

        return value

    @field_validator(
        "data_plantio",
    )
    @classmethod
    def reject_future_date(
        cls,
        value: date,
    ) -> date:
        if value > date.today():
            raise ValueError(
                "data_plantio não pode ser futura"
            )

        return value


class WeatherSnapshotRequest(BaseModel):
    hourly_weather: dict[str, Any]
    historical_daily_rainfall: dict[str, Any]
    fetched_at: str | None = None


class AnalysisRequest(BaseModel):
    field: FieldSnapshot
    weather: WeatherSnapshotRequest


# ============================================================
# App
# ============================================================

app = FastAPI(
    title="PeanuTec Intelligence",
    version="2.0.0",
    description=(
        "Serviço de inteligência agronômica "
        "do PeanuTec V2."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Metadata
# ============================================================


@app.get("/")
def service_metadata() -> dict:
    return {
        "service": (
            "PeanuTec Intelligence"
        ),
        "version": "2.0.0",
        "role": "pure-intelligence",
        "weather_fetching": False,
        "supported_diseases": (
            SUPPORTED_DISEASES
        ),
    }


@app.get("/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "service": (
            "peanutec-intelligence"
        ),
        "version": "2.0.0",
    }


# ============================================================
# Analysis
# ============================================================


@app.post("/analisar")
def analyze(
    payload: AnalysisRequest,
) -> dict:
    field = (
        payload.field.model_dump(
            mode="json"
        )
    )

    weather = (
        payload.weather.model_dump(
            mode="python"
        )
    )

    historical_daily_rainfall = (
        weather[
            "historical_daily_rainfall"
        ]
    )

    if "precipitation_sum" not in historical_daily_rainfall:
        raise HTTPException(
            status_code=400,
            detail=(
                "Snapshot meteorológico inválido: "
                "historical_daily_rainfall.precipitation_sum é obrigatório."
            ),
        )

    try:
        result = (
            run_disease_analysis_from_snapshot(
                field=field,
                hourly_weather=(
                    weather[
                        "hourly_weather"
                    ]
                ),
                historical_daily_rainfall=historical_daily_rainfall,
            )
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Erro ao executar "
                "inteligência agronômica: "
                f"{error}"
            ),
        ) from error

    return result
