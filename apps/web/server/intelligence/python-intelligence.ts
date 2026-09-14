import "server-only";

import type {
  AnalysisRequest,
  AnalysisResult,
} from "@/types/analysis";

import {
  getWeatherSnapshot,
  type WeatherSnapshot,
} from "@/server/weather/open-meteo.service";

/* =========================================================
 * Configuration
 * ========================================================= */

const INTELLIGENCE_URL =
  process.env.PEANUTEC_INTELLIGENCE_URL ??
  "http://127.0.0.1:8001";

const REQUEST_TIMEOUT_MS =
  90_000;

/* =========================================================
 * Internal types
 * ========================================================= */

export type AnalysisFieldSnapshot =
  Omit<
    AnalysisRequest,
    "doenca_alvo"
  >;

type IntelligenceWeatherPayload = {
  hourly_weather:
    WeatherSnapshot["hourly_weather"];

  historical_daily_rainfall:
    WeatherSnapshot["historical_daily_rainfall"];

  fetched_at:
    string;
};

type IntelligenceAnalysisPayload = {
  field:
    AnalysisRequest;

  weather:
    IntelligenceWeatherPayload;
};

type IntelligenceErrorBody = {
  detail?:
    string |
    Array<{
      msg?: string;
    }>;
};

/* =========================================================
 * Errors
 * ========================================================= */

export class IntelligenceServiceError extends Error {
  status:
    number | null;

  constructor(
    message: string,
    status:
      number | null =
      null,
  ) {
    super(message);

    this.name =
      "IntelligenceServiceError";

    this.status =
      status;
  }
}

/* =========================================================
 * Helpers
 * ========================================================= */

function buildWeatherPayload(
  snapshot:
    WeatherSnapshot,
): IntelligenceWeatherPayload {
  return {
    hourly_weather:
      snapshot.hourly_weather,

    historical_daily_rainfall:
      snapshot.historical_daily_rainfall,

    fetched_at:
      snapshot.fetched_at,
  };
}

async function parseIntelligenceError(
  response:
    Response,
): Promise<string> {
  try {
    const body =
      await response.json() as
        IntelligenceErrorBody;

    if (
      typeof body.detail ===
      "string"
    ) {
      return body.detail;
    }

    if (
      Array.isArray(
        body.detail,
      )
    ) {
      const message =
        body.detail
          .map(
            (item) =>
              item.msg,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          )
          .join("; ");

      if (message) {
        return message;
      }
    }
  } catch {
    // Fallback abaixo.
  }

  return (
    `Serviço de inteligência respondeu com HTTP ${response.status}.`
  );
}

/* =========================================================
 * HTTP client
 * ========================================================= */

async function requestAnalysis(
  payload:
    IntelligenceAnalysisPayload,
): Promise<AnalysisResult> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        `${INTELLIGENCE_URL}/analisar`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              payload,
            ),

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      throw new IntelligenceServiceError(
        await parseIntelligenceError(
          response,
        ),
        response.status,
      );
    }

    return (
      await response.json()
    ) as AnalysisResult;
  } catch (error: unknown) {
    if (
      error instanceof
      IntelligenceServiceError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new IntelligenceServiceError(
        "O serviço de inteligência excedeu o tempo limite da análise.",
      );
    }

    throw new IntelligenceServiceError(
      error instanceof Error
        ? `Não foi possível acessar o serviço de inteligência: ${error.message}`
        : "Não foi possível acessar o serviço de inteligência.",
    );
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/* =========================================================
 * Single disease
 * ========================================================= */

async function analyzeDiseaseWithWeather(
  field:
    AnalysisRequest,
  weather:
    WeatherSnapshot,
): Promise<AnalysisResult> {
  return requestAnalysis({
    field,

    weather:
      buildWeatherPayload(
        weather,
      ),
  });
}

/**
 * Executa uma análise isolada.
 *
 * Esta função continua disponível para qualquer ponto
 * que precise analisar somente uma doença.
 *
 * Mesmo nesse caso, o clima é obtido pelo Next e nunca
 * diretamente pelo serviço Python.
 */
export async function analyzeDisease(
  field:
    AnalysisRequest,
): Promise<AnalysisResult> {
  const weather =
    await getWeatherSnapshot(
      field.latitude,
      field.longitude,
    );

  return analyzeDiseaseWithWeather(
    field,
    weather,
  );
}

/* =========================================================
 * Multiple diseases
 * ========================================================= */

/**
 * Executa todas as doenças monitoradas usando o MESMO
 * snapshot meteorológico.
 *
 * Fluxo:
 *
 * 1. Next consulta/cacheia o clima uma única vez.
 * 2. O mesmo snapshot é compartilhado entre as doenças.
 * 3. Python recebe somente dados + snapshot.
 * 4. Python executa somente inteligência.
 */
export async function analyzeFieldSnapshot(
  field:
    AnalysisFieldSnapshot,
  diseases:
    string[],
): Promise<AnalysisResult[]> {
  if (
    diseases.length ===
    0
  ) {
    return [];
  }

  /*
   * Esta é a otimização principal:
   *
   * independentemente da quantidade de doenças,
   * buscamos o snapshot apenas UMA vez.
   */
  const weather =
    await getWeatherSnapshot(
      field.latitude,
      field.longitude,
    );

  /*
   * Depois que o snapshot existe, as análises são
   * independentes entre si.
   *
   * Podemos executá-las em paralelo sem duplicar
   * chamadas ao Open-Meteo.
   */
  const analyses =
    await Promise.all(
      diseases.map(
        (
          disease,
        ) =>
          analyzeDiseaseWithWeather(
            {
              ...field,

              doenca_alvo:
                disease,
            },
            weather,
          ),
      ),
    );

  /*
   * Mantemos a regra anterior:
   * maior índice agronômico aparece primeiro.
   */
  return analyses.sort(
    (
      first,
      second,
    ) =>
      second.risk
        .agronomic_index -
      first.risk
        .agronomic_index,
  );
}