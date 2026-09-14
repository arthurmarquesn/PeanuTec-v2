import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  getCurrentFieldSituation,
} from "@/server/situation/current-field-situation.service";

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

    const situation =
      await getCurrentFieldSituation(
        id,
      );

    return NextResponse.json(
      situation,
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
      "[GET /api/fields/[id]/situation]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Nao foi possivel calcular a situacao atual do talhao.",
      },
      {
        status: 500,
      },
    );
  }
}
