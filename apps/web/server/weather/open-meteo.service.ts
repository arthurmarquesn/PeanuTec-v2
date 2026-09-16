import "server-only";

import {
  addDaysToIsoDate,
  getSaoPauloDateKey,
} from "@/server/time/sao-paulo";

import {
  buildWeatherFixture,
} from "@/server/weather/weather-fixture";

/* =========================================================
 * Configuration
 * ========================================================= */

const TIME_ZONE =
  "America/Sao_Paulo";

const FORECAST_CACHE_TTL_MS =
  15 * 60 * 1000;

const HISTORICAL_CACHE_TTL_MS =
  6 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS =
  8_000;

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast";

const ARCHIVE_URL =
  "https://archive-api.open-meteo.com/v1/archive";

const HOURLY_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "surface_pressure",
  "pressure_msl",
  "wind_speed_10m",
  "shortwave_radiation",
];

/* =========================================================
 * Public types
 * ========================================================= */

export type WeatherCacheState =
  "hit" |
  "miss";

export type ForecastHourlyWeather = {
  time: string[];

  temperature_2m?: Array<
    number | null
  >;

  relative_humidity_2m?: Array<
    number | null
  >;

  dew_point_2m?: Array<
    number | null
  >;

  precipitation?: Array<
    number | null
  >;

  surface_pressure?: Array<
    number | null
  >;

  pressure_msl?: Array<
    number | null
  >;

  wind_speed_10m?: Array<
    number | null
  >;

  shortwave_radiation?: Array<
    number | null
  >;

  [key: string]:
    unknown;
};

export type HistoricalDailyRainfall = {
  time: string[];

  precipitation_sum:
    Array<
      number | null
    >;

  [key: string]:
    unknown;
};

export type WeatherSnapshot = {
  coordinates: {
    latitude: number;
    longitude: number;
  };

  fetched_at:
    string;

  cache: {
    forecast:
      WeatherCacheState;

    historical:
      WeatherCacheState;

    forecast_ttl_seconds:
      number;

    historical_ttl_seconds:
      number;
  };

  hourly_weather:
    ForecastHourlyWeather;

  historical_daily_rainfall:
    HistoricalDailyRainfall;
};

/* =========================================================
 * Internal types
 * ========================================================= */

type CacheEntry<T> = {
  value: T;

  expiresAt:
    number;
};

type ForecastApiResponse = {
  hourly?:
    ForecastHourlyWeather;
};

type HistoricalApiResponse = {
  daily?:
    HistoricalDailyRainfall;
};

/* =========================================================
 * Errors
 * ========================================================= */

export class WeatherServiceError extends Error {
  status:
    number | null;

  constructor(
    message: string,
    status:
      number | null =
      null,
  ) {
    super(
      message,
    );

    this.name =
      "WeatherServiceError";

    this.status =
      status;
  }
}

/* =========================================================
 * Cache
 * ========================================================= */

const forecastCache =
  new Map<
    string,
    CacheEntry<ForecastHourlyWeather>
  >();

const historicalCache =
  new Map<
    string,
    CacheEntry<HistoricalDailyRainfall>
  >();

/*
 * Evita duas requisições simultâneas para
 * a mesma coordenada durante um cache miss.
 */
const forecastPending =
  new Map<
    string,
    Promise<ForecastHourlyWeather>
  >();

const historicalPending =
  new Map<
    string,
    Promise<HistoricalDailyRainfall>
  >();

/* =========================================================
 * Helpers
 * ========================================================= */

function validateCoordinate(
  latitude: number,
  longitude: number,
): void {
  if (
    !Number.isFinite(
      latitude,
    ) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new WeatherServiceError(
      "Latitude inválida para consulta meteorológica.",
    );
  }

  if (
    !Number.isFinite(
      longitude,
    ) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new WeatherServiceError(
      "Longitude inválida para consulta meteorológica.",
    );
  }
}

function buildCoordinateKey(
  latitude: number,
  longitude: number,
): string {
  /*
   * Quatro casas decimais são suficientes
   * para normalizar pequenas diferenças de
   * floating point sem misturar áreas distantes.
   */
  return [
    latitude.toFixed(
      4,
    ),
    longitude.toFixed(
      4,
    ),
  ].join(
    ":",
  );
}

function getValidCacheEntry<T>(
  cache:
    Map<
      string,
      CacheEntry<T>
    >,
  key: string,
): T | null {
  const entry =
    cache.get(
      key,
    );

  if (!entry) {
    return null;
  }

  if (
    entry.expiresAt <=
    Date.now()
  ) {
    cache.delete(
      key,
    );

    return null;
  }

  return entry.value;
}

function shouldUseWeatherFixture(): boolean {
  return (
    process.env.PEANUTEC_WEATHER_MODE ===
      "fixture" &&
    process.env.NODE_ENV !==
      "production"
  );
}

async function requestJson<T>(
  url: URL,
): Promise<T> {
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
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      throw new WeatherServiceError(
        `Open-Meteo respondeu com HTTP ${response.status}.`,
        response.status,
      );
    }

    return await response.json() as T;
  } catch (error: unknown) {
    if (
      error instanceof
      WeatherServiceError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new WeatherServiceError(
        "Tempo limite excedido ao consultar dados meteorológicos.",
      );
    }

    throw new WeatherServiceError(
      error instanceof Error
        ? `Falha ao consultar Open-Meteo: ${error.message}`
        : "Falha ao consultar Open-Meteo.",
    );
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/* =========================================================
 * Forecast URL
 * ========================================================= */

function buildForecastUrl(
  latitude: number,
  longitude: number,
): URL {
  const url =
    new URL(
      FORECAST_URL,
    );

  url.searchParams.set(
    "latitude",
    String(
      latitude,
    ),
  );

  url.searchParams.set(
    "longitude",
    String(
      longitude,
    ),
  );

  url.searchParams.set(
    "hourly",
    HOURLY_VARIABLES.join(
      ",",
    ),
  );

  url.searchParams.set(
    "past_days",
    "7",
  );

  url.searchParams.set(
    "forecast_days",
    "7",
  );

  url.searchParams.set(
    "timezone",
    TIME_ZONE,
  );

  return url;
}

/* =========================================================
 * Historical URL
 * ========================================================= */

function buildHistoricalUrl(
  latitude: number,
  longitude: number,
): URL {
  const today =
    getSaoPauloDateKey();

  /*
   * O histórico termina ontem, da mesma
   * forma que o cliente Python antigo.
   */
  const endDate =
    addDaysToIsoDate(
      today,
      -1,
    );

  const startDate =
    addDaysToIsoDate(
      endDate,
      -39,
    );

  const url =
    new URL(
      ARCHIVE_URL,
    );

  url.searchParams.set(
    "latitude",
    String(
      latitude,
    ),
  );

  url.searchParams.set(
    "longitude",
    String(
      longitude,
    ),
  );

  url.searchParams.set(
    "start_date",
    startDate,
  );

  url.searchParams.set(
    "end_date",
    endDate,
  );

  url.searchParams.set(
    "daily",
    "precipitation_sum",
  );

  url.searchParams.set(
    "timezone",
    TIME_ZONE,
  );

  return url;
}

/* =========================================================
 * Forecast
 * ========================================================= */

async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastHourlyWeather> {
  if (
    shouldUseWeatherFixture()
  ) {
    return buildWeatherFixture()
      .forecast;
  }

  const url =
    buildForecastUrl(
      latitude,
      longitude,
    );

  const response =
    await requestJson<ForecastApiResponse>(
      url,
    );

  if (
    !response.hourly ||
    !Array.isArray(
      response.hourly.time,
    )
  ) {
    throw new WeatherServiceError(
      "Resposta do Open-Meteo não contém dados horários válidos.",
    );
  }

  return response.hourly;
}

async function getForecast(
  latitude: number,
  longitude: number,
): Promise<{
  value:
    ForecastHourlyWeather;

  cacheState:
    WeatherCacheState;
}> {
  const key =
    buildCoordinateKey(
      latitude,
      longitude,
    );

  const cached =
    getValidCacheEntry(
      forecastCache,
      key,
    );

  if (cached) {
    return {
      value:
        cached,

      cacheState:
        "hit",
    };
  }

  const existingPending =
    forecastPending.get(
      key,
    );

  if (
    existingPending
  ) {
    return {
      value:
        await existingPending,

      cacheState:
        "hit",
    };
  }

  const promise =
    fetchForecast(
      latitude,
      longitude,
    );

  forecastPending.set(
    key,
    promise,
  );

  try {
    const value =
      await promise;

    forecastCache.set(
      key,
      {
        value,

        expiresAt:
          Date.now() +
          FORECAST_CACHE_TTL_MS,
      },
    );

    return {
      value,

      cacheState:
        "miss",
    };
  } finally {
    forecastPending.delete(
      key,
    );
  }
}

/* =========================================================
 * Historical rainfall
 * ========================================================= */

async function fetchHistoricalRainfall(
  latitude: number,
  longitude: number,
): Promise<HistoricalDailyRainfall> {
  if (
    shouldUseWeatherFixture()
  ) {
    return buildWeatherFixture()
      .historical;
  }

  const url =
    buildHistoricalUrl(
      latitude,
      longitude,
    );

  const response =
    await requestJson<HistoricalApiResponse>(
      url,
    );

  if (
    !response.daily ||
    !Array.isArray(
      response.daily.time,
    ) ||
    !Array.isArray(
      response.daily
        .precipitation_sum,
    )
  ) {
    throw new WeatherServiceError(
      "Resposta do Open-Meteo histórico não contém chuva diária válida.",
    );
  }

  return response.daily;
}

async function getHistoricalRainfall(
  latitude: number,
  longitude: number,
): Promise<{
  value:
    HistoricalDailyRainfall;

  cacheState:
    WeatherCacheState;
}> {
  const key =
    buildCoordinateKey(
      latitude,
      longitude,
    );

  const cached =
    getValidCacheEntry(
      historicalCache,
      key,
    );

  if (cached) {
    return {
      value:
        cached,

      cacheState:
        "hit",
    };
  }

  const existingPending =
    historicalPending.get(
      key,
    );

  if (
    existingPending
  ) {
    return {
      value:
        await existingPending,

      cacheState:
        "hit",
    };
  }

  const promise =
    fetchHistoricalRainfall(
      latitude,
      longitude,
    );

  historicalPending.set(
    key,
    promise,
  );

  try {
    const value =
      await promise;

    historicalCache.set(
      key,
      {
        value,

        expiresAt:
          Date.now() +
          HISTORICAL_CACHE_TTL_MS,
      },
    );

    return {
      value,

      cacheState:
        "miss",
    };
  } finally {
    historicalPending.delete(
      key,
    );
  }
}

/* =========================================================
 * Public snapshot
 * ========================================================= */

export async function getWeatherSnapshot(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  validateCoordinate(
    latitude,
    longitude,
  );

  /*
   * As duas APIs são independentes,
   * portanto executamos em paralelo.
   */
  const [
    forecast,
    historical,
  ] =
    await Promise.all([
      getForecast(
        latitude,
        longitude,
      ),

      getHistoricalRainfall(
        latitude,
        longitude,
      ),
    ]);

  return {
    coordinates: {
      latitude,
      longitude,
    },

    fetched_at:
      new Date()
        .toISOString(),

    cache: {
      forecast:
        forecast.cacheState,

      historical:
        historical.cacheState,

      forecast_ttl_seconds:
        FORECAST_CACHE_TTL_MS /
        1000,

      historical_ttl_seconds:
        HISTORICAL_CACHE_TTL_MS /
        1000,
    },

    hourly_weather:
      forecast.value,

    historical_daily_rainfall:
      historical.value,
  };
}

/* =========================================================
 * Cache maintenance
 * ========================================================= */

export function clearWeatherCache(): void {
  forecastCache.clear();
  historicalCache.clear();
  forecastPending.clear();
  historicalPending.clear();
}
