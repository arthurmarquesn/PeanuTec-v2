import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearWeatherCache,
  getWeatherSnapshot,
  WeatherServiceError,
} from "@/server/weather/open-meteo.service";

const LATITUDE =
  -21.9347;

const LONGITUDE =
  -50.5136;

type FetchCall = {
  url: string;
};

function forecastPayload(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    hourly: {
      time: [
        "2026-09-13T00:00",
        "2026-09-13T01:00",
      ],
      temperature_2m: [
        22,
        null,
      ],
      relative_humidity_2m: [
        90,
        92,
      ],
      precipitation: [
        null,
        0.4,
      ],
      ...overrides,
    },
  };
}

function historicalPayload(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    daily: {
      time: [
        "2026-09-12",
        "2026-09-13",
      ],
      precipitation_sum: [
        null,
        3.5,
      ],
      ...overrides,
    },
  };
}

function jsonResponse(
  body: unknown,
  init: {
    ok?: boolean;
    status?: number;
  } = {},
) {
  return {
    ok:
      init.ok ?? true,
    status:
      init.status ?? 200,
    json:
      vi.fn()
        .mockResolvedValue(
          body,
        ),
  } as unknown as Response;
}

function isForecastUrl(
  url: string,
) {
  return url.includes(
    "/v1/forecast",
  );
}

function isArchiveUrl(
  url: string,
) {
  return url.includes(
    "archive-api.open-meteo.com",
  );
}

function mockOpenMeteoFetch(
  options: {
    forecast?: unknown;
    historical?: unknown;
    forecastResponse?: Response;
    historicalResponse?: Response;
    calls?: FetchCall[];
  } = {},
) {
  const calls =
    options.calls ?? [];

  const fetchMock =
    vi.fn(
      async (
        input: RequestInfo | URL,
      ) => {
        const url =
          String(input);

        calls.push({
          url,
        });

        if (
          isForecastUrl(
            url,
          )
        ) {
          return (
            options.forecastResponse ??
            jsonResponse(
              options.forecast ??
                forecastPayload(),
            )
          );
        }

        if (
          isArchiveUrl(
            url,
          )
        ) {
          return (
            options.historicalResponse ??
            jsonResponse(
              options.historical ??
                historicalPayload(),
            )
          );
        }

        throw new Error(
          `Unexpected URL in weather test: ${url}`,
        );
      },
    );

  vi.stubGlobal(
    "fetch",
    fetchMock,
  );

  return {
    fetchMock,
    calls,
  };
}

describe(
  "open-meteo weather cache",
  () => {
    beforeEach(
      () => {
        clearWeatherCache();
        vi.useRealTimers();
      },
    );

    afterEach(
      () => {
        clearWeatherCache();
        vi.unstubAllGlobals();
        vi.useRealTimers();
      },
    );

    it(
      "returns cache miss on the initial forecast and historical requests",
      async () => {
        const {
          fetchMock,
        } =
          mockOpenMeteoFetch();

        const snapshot =
          await getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        expect(
          snapshot.cache.forecast,
          "forecast cache state on first call",
        ).toBe("miss");
        expect(
          snapshot.cache.historical,
          "historical cache state on first call",
        ).toBe("miss");
        expect(
          fetchMock,
          "one forecast and one historical fetch should happen on initial miss",
        ).toHaveBeenCalledTimes(2);
      },
    );

    it(
      "returns cache hit without repeated external requests",
      async () => {
        const {
          fetchMock,
        } =
          mockOpenMeteoFetch();

        await getWeatherSnapshot(
          LATITUDE,
          LONGITUDE,
        );

        const snapshot =
          await getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        expect(
          snapshot.cache.forecast,
        ).toBe("hit");
        expect(
          snapshot.cache.historical,
        ).toBe("hit");
        expect(
          fetchMock,
          "cache hit should not call Open-Meteo again",
        ).toHaveBeenCalledTimes(2);
      },
    );

    it(
      "expires cached entries after their TTL",
      async () => {
        vi.useFakeTimers();
        vi.setSystemTime(
          new Date(
            "2026-09-14T00:00:00.000Z",
          ),
        );

        const {
          fetchMock,
        } =
          mockOpenMeteoFetch();

        await getWeatherSnapshot(
          LATITUDE,
          LONGITUDE,
        );

        vi.setSystemTime(
          new Date(
            "2026-09-14T06:00:01.000Z",
          ),
        );

        const snapshot =
          await getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        expect(
          snapshot.cache.forecast,
          "forecast should expire after 15 minutes",
        ).toBe("miss");
        expect(
          snapshot.cache.historical,
          "historical rainfall should expire after 6 hours",
        ).toBe("miss");
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(4);
      },
    );

    it(
      "requests forecast and historical rainfall endpoints",
      async () => {
        const {
          calls,
        } =
          mockOpenMeteoFetch();

        await getWeatherSnapshot(
          LATITUDE,
          LONGITUDE,
        );

        expect(
          calls.some(
            (call) =>
              isForecastUrl(
                call.url,
              ),
          ),
          "forecast endpoint should be requested",
        ).toBe(true);
        expect(
          calls.some(
            (call) =>
              isArchiveUrl(
                call.url,
              ),
          ),
          "historical archive endpoint should be requested",
        ).toBe(true);
      },
    );

    it(
      "rejects invalid coordinates before calling fetch",
      async () => {
        const {
          fetchMock,
        } =
          mockOpenMeteoFetch();

        await expect(
          getWeatherSnapshot(
            -91,
            LONGITUDE,
          ),
        ).rejects.toThrow(
          WeatherServiceError,
        );

        await expect(
          getWeatherSnapshot(
            LATITUDE,
            -181,
          ),
        ).rejects.toThrow(
          WeatherServiceError,
        );

        expect(
          fetchMock,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      404,
      500,
    ])(
      "surfaces Open-Meteo HTTP %s errors",
      async (
        status,
      ) => {
        mockOpenMeteoFetch({
          forecastResponse:
            jsonResponse(
              {
                reason:
                  "failure",
              },
              {
                ok: false,
                status,
              },
            ),
          historicalResponse:
            jsonResponse(
              historicalPayload(),
            ),
        });

        await expect(
          getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          ),
        ).rejects.toMatchObject({
          status,
        });
      },
    );

    it(
      "surfaces request timeout as a weather error",
      async () => {
        vi.useFakeTimers();

        const fetchMock =
          vi.fn(
            (
              _input:
                RequestInfo | URL,
              init?:
                RequestInit,
            ) =>
              new Promise<Response>(
                (
                  _resolve,
                  reject,
                ) => {
                  init?.signal?.addEventListener(
                    "abort",
                    () => {
                      const error =
                        new Error(
                          "Aborted",
                        );

                      error.name =
                        "AbortError";

                      reject(
                        error,
                      );
                    },
                  );
                },
              ),
          );

        vi.stubGlobal(
          "fetch",
          fetchMock,
        );

        const promise =
          getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        const assertion =
          expect(
            promise,
          ).rejects.toThrow(
            "Tempo limite excedido",
          );

        await vi.advanceTimersByTimeAsync(
          8_001,
        );

        await assertion;
      },
    );

    it(
      "rejects forecast responses without hourly data",
      async () => {
        mockOpenMeteoFetch({
          forecast: {},
        });

        await expect(
          getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          ),
        ).rejects.toThrow(
          "dados hor",
        );
      },
    );

    it(
      "rejects invalid historical rainfall responses",
      async () => {
        mockOpenMeteoFetch({
          historical: {
            daily: {
              precipitation_sum: [
                1,
              ],
            },
          },
        });

        await expect(
          getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          ),
        ).rejects.toThrow(
          "chuva di",
        );
      },
    );

    it(
      "rejects historical rainfall without precipitation_sum",
      async () => {
        mockOpenMeteoFetch({
          historical:
            historicalPayload({
              precipitation_sum:
                undefined,
            }),
        });

        await expect(
          getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          ),
        ).rejects.toThrow(
          "chuva di",
        );
      },
    );

    it(
      "preserves valid null values from Open-Meteo",
      async () => {
        mockOpenMeteoFetch();

        const snapshot =
          await getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        expect(
          snapshot.hourly_weather
            .temperature_2m?.[1],
        ).toBeNull();
        expect(
          snapshot.hourly_weather
            .precipitation?.[0],
        ).toBeNull();
        expect(
          snapshot.historical_daily_rainfall
            .precipitation_sum[0],
        ).toBeNull();
      },
    );

    it(
      "does not convert absent optional weather fields to zero",
      async () => {
        const forecast =
          forecastPayload();

        delete forecast.hourly.precipitation;

        mockOpenMeteoFetch({
          forecast,
        });

        const snapshot =
          await getWeatherSnapshot(
            LATITUDE,
            LONGITUDE,
          );

        expect(
          "precipitation" in
            snapshot.hourly_weather,
          "missing precipitation must remain absent instead of becoming 0",
        ).toBe(false);
      },
    );

    it(
      "deduplicates concurrent equivalent forecast and historical requests",
      async () => {
        const calls:
          FetchCall[] = [];

        const fetchMock =
          vi.fn(
            async (
              input:
                RequestInfo | URL,
            ) => {
              const url =
                String(input);

              calls.push({
                url,
              });

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    10,
                  ),
              );

              return jsonResponse(
                isForecastUrl(
                  url,
                )
                  ? forecastPayload()
                  : historicalPayload(),
              );
            },
          );

        vi.stubGlobal(
          "fetch",
          fetchMock,
        );

        const [
          first,
          second,
          third,
        ] =
          await Promise.all([
            getWeatherSnapshot(
              LATITUDE,
              LONGITUDE,
            ),
            getWeatherSnapshot(
              LATITUDE,
              LONGITUDE,
            ),
            getWeatherSnapshot(
              LATITUDE,
              LONGITUDE,
            ),
          ]);

        expect(
          first.cache.forecast,
        ).toBe("miss");
        expect(
          second.cache.forecast,
        ).toBe("hit");
        expect(
          third.cache.forecast,
        ).toBe("hit");

        expect(
          calls.filter(
            (call) =>
              isForecastUrl(
                call.url,
              ),
          ),
          "concurrent identical snapshots should share a single pending forecast promise",
        ).toHaveLength(1);
        expect(
          calls.filter(
            (call) =>
              isArchiveUrl(
                call.url,
              ),
          ),
          "concurrent identical snapshots should share a single pending historical promise",
        ).toHaveLength(1);
      },
    );
  },
);
