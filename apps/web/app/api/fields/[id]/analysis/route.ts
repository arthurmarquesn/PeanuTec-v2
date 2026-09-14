import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
  getFieldAnalysisHistory,
  IntelligenceServiceError,
  runFieldAnalysis,
} from "@/server/analysis/field-analysis.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
 * Errors
 * ========================================================= */

function handleAnalysisError(
  error: unknown,
) {
  if (
    error instanceof
    FieldNotFoundError
  ) {
    return NextResponse.json(
      {
        detail:
          error.message,
      },
      {
        status: 404,
      },
    );
  }

  if (
    error instanceof
    IntelligenceServiceError
  ) {
    const message =
      error.message.toLowerCase();

    const status =
      error.status &&
      error.status >= 400 &&
      error.status < 500
        ? 400
        : message.includes(
            "tempo limite",
          )
          ? 504
          : 503;

    return NextResponse.json(
      {
        detail:
          error.message,
      },
      {
        status,
      },
    );
  }

  console.error(
    "[Field Analysis API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Não foi possível concluir a análise do talhão.",
    },
    {
      status: 500,
    },
  );
}

/* =========================================================
 * GET
 *
 * Histórico já salvo no Next.
 * ========================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const history =
      await getFieldAnalysisHistory(
        id,
      );

    return NextResponse.json(
      history,
    );
  } catch (error) {
    return handleAnalysisError(
      error,
    );
  }
}

/* =========================================================
 * POST
 *
 * Executa uma nova análise.
 * ========================================================= */

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const result =
      await runFieldAnalysis(
        id,
      );

    return NextResponse.json(
      result,
    );
  } catch (error) {
    return handleAnalysisError(
      error,
    );
  }
}
