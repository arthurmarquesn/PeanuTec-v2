import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createFieldInspection,
  FieldNotFoundError,
  InspectionValidationError,
  listFieldInspections,
} from "@/server/inspections/inspection.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function handleInspectionError(
  error: unknown,
): NextResponse {
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
    InspectionValidationError
  ) {
    return NextResponse.json(
      {
        detail:
          error.message,
      },
      {
        status: 400,
      },
    );
  }

  console.error(
    "[Field Inspection API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Não foi possível registrar a inspeção.",
    },
    {
      status: 500,
    },
  );
}

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
      await listFieldInspections(
        id,
      );

    return NextResponse.json(
      result,
    );
  } catch (error: unknown) {
    return handleInspectionError(
      error,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const body =
      await request.json();

    const result =
      await createFieldInspection(
        id,
        body,
      );

    return NextResponse.json(
      result,
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return handleInspectionError(
      error,
    );
  }
}
