import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createScopedInspection,
  FieldNotFoundError,
  InspectionValidationError,
} from "@/server/inspections/inspection.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

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
    "[Scoped Inspection API]",
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

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const result =
      await createScopedInspection(
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