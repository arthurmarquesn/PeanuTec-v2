import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  AnalysisResult,
} from "@/types/analysis";

const weatherSnapshot = {
  coordinates: {
    latitude:
      -21.9347,
    longitude:
      -50.5136,
  },
  fetched_at:
    "2026-09-14T00:00:00.000Z",
  cache: {
    forecast:
      "miss" as const,
    historical:
      "miss" as const,
    forecast_ttl_seconds:
      900,
    historical_ttl_seconds:
      21_600,
  },
  hourly_weather: {
    time: [
      "2026-09-13T00:00",
    ],
    temperature_2m: [
      22,
    ],
  },
  historical_daily_rainfall: {
    time: [
      "2026-09-13",
    ],
    precipitation_sum: [
      3.5,
    ],
  },
};

const getWeatherSnapshotMock =
  vi.fn();

vi.mock(
  "@/server/weather/open-meteo.service",
  () => ({
    getWeatherSnapshot:
      getWeatherSnapshotMock,
  }),
);

function analysisResult(
  disease: string,
  agronomicIndex: number,
): AnalysisResult {
  return {
    generated_at:
      "2026-09-14T00:00:00-03:00",
    field: {
      name:
        "Talhao Teste",
      city:
        "Tupa-SP",
      crop:
        "Amendoim",
      crop_status:
        "em_campo",
      days_after_planting:
        90,
      crop_stage:
        "Fase critica",
    },
    disease,
    pathogen:
      "Patogeno",
    risk: {
      climate_index:
        agronomicIndex,
      agronomic_index:
        agronomicIndex,
      classification:
        "MODERADO",
    },
    management_relevance: {
      status:
        "ATIVA",
      description:
        "Teste",
    },
    actions: [
      "Monitorar",
    ],
  };
}

function jsonResponse(
  body: unknown,
) {
  return {
    ok: true,
    status: 200,
    json:
      vi.fn()
        .mockResolvedValue(
          body,
        ),
  } as unknown as Response;
}

describe(
  "python intelligence integration client",
  () => {
    beforeEach(
      () => {
        getWeatherSnapshotMock
          .mockReset()
          .mockResolvedValue(
            weatherSnapshot,
          );

        vi.stubGlobal(
          "fetch",
          vi.fn(
            async (
              _input:
                RequestInfo | URL,
              init?:
                RequestInit,
            ) => {
              const body =
                JSON.parse(
                  String(
                    init?.body,
                  ),
                ) as {
                  field: {
                    doenca_alvo:
                      string;
                  };
                };

              return jsonResponse(
                analysisResult(
                  body.field.doenca_alvo,
                  body.field
                    .doenca_alvo ===
                    "Mancha-castanha"
                    ? 70
                    : 40,
                ),
              );
            },
          ),
        );
      },
    );

    it(
      "reuses one WeatherSnapshot for two disease analyses",
      async () => {
        const {
          analyzeFieldSnapshot,
        } =
          await import(
            "@/server/intelligence/python-intelligence"
          );

        const results =
          await analyzeFieldSnapshot(
            {
              nome:
                "Talhao Teste",
              cidade:
                "Tupa-SP",
              latitude:
                -21.9347,
              longitude:
                -50.5136,
              data_plantio:
                "2026-06-01",
              cultura:
                "Amendoim",
              status_lavoura:
                "em_campo",
            },
            [
              "Mancha-preta",
              "Mancha-castanha",
            ],
          );

        const fetchMock =
          vi.mocked(
            fetch,
          );

        expect(
          getWeatherSnapshotMock,
          "two diseases for one field must fetch weather exactly once",
        ).toHaveBeenCalledTimes(1);
        expect(
          fetchMock,
          "each disease should still produce one intelligence request",
        ).toHaveBeenCalledTimes(2);

        const bodies =
          fetchMock.mock.calls.map(
            (
              call,
            ) =>
              JSON.parse(
                String(
                  call[1]?.body,
                ),
              ) as {
                field: {
                  doenca_alvo:
                    string;
                };
                weather:
                  unknown;
              },
          );

        expect(
          bodies.map(
            (body) =>
              body.field
                .doenca_alvo,
          ).sort(),
        ).toEqual([
          "Mancha-castanha",
          "Mancha-preta",
        ]);

        expect(
          bodies[0].weather,
          "first disease should receive the shared weather payload",
        ).toStrictEqual(
          bodies[1].weather,
        );
        expect(
          bodies[0].weather,
        ).toStrictEqual({
          hourly_weather:
            weatherSnapshot
              .hourly_weather,
          historical_daily_rainfall:
            weatherSnapshot
              .historical_daily_rainfall,
          fetched_at:
            weatherSnapshot
              .fetched_at,
        });

        expect(
          results.map(
            (result) =>
              result.disease,
          ),
          "results should be ordered by agronomic index descending",
        ).toEqual([
          "Mancha-castanha",
          "Mancha-preta",
        ]);
      },
    );
  },
);
