import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  getFieldTechnicalReport,
} from "@/server/reports/technical-report.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const report =
      await getFieldTechnicalReport(
        id,
      );

    return NextResponse.json(
      report,
    );
  } catch (error: unknown) {
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

    console.error(
      "[GET /api/fields/[id]/technical-report]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível gerar o relatório técnico do talhão.",
      },
      {
        status: 500,
      },
    );
  }
}