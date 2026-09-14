import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  getFieldOperationalContext,
} from "@/server/operational/field-operational.service";

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

    const result =
      await getFieldOperationalContext(
        id,
      );

    return NextResponse.json(
      result,
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
      "[GET /api/fields/[id]/operational-context]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar o contexto operacional do talhão.",
      },
      {
        status: 500,
      },
    );
  }
}