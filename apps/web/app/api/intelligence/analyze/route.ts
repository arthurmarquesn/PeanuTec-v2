import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  analyzeDisease,
  IntelligenceServiceError,
} from "@/server/intelligence/python-intelligence";

import {
  WeatherServiceError,
} from "@/server/weather/open-meteo.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function statusForIntelligenceError(
  error:
    IntelligenceServiceError,
) {
  if (
    error.status &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return 400;
  }

  if (
    error.message
      .toLowerCase()
      .includes("tempo limite")
  ) {
    return 504;
  }

  return 503;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const result =
      await analyzeDisease(
        body,
      );

    return NextResponse.json(
      result,
    );
  } catch (error: unknown) {
    if (
      error instanceof
      IntelligenceServiceError
    ) {
      return NextResponse.json(
        {
          detail:
            error.message,
        },
        {
          status:
            statusForIntelligenceError(
              error,
            ),
        },
      );
    }

    if (
      error instanceof
      WeatherServiceError
    ) {
      return NextResponse.json(
        {
          detail:
            error.message,
        },
        {
          status: 502,
        },
      );
    }

    console.error(
      "[POST /api/intelligence/analyze]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Nao foi possivel executar a analise.",
      },
      {
        status: 500,
      },
    );
  }
}
