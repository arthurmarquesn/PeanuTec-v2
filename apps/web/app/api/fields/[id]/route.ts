import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deleteField,
  FieldNotFoundError,
  FieldValidationError,
  getFieldById,
  updateField,
} from "@/server/fields/field.service";

export const runtime =
  "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function handleFieldError(
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
    FieldValidationError
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
    "[Field API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Erro interno ao processar o talhão.",
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

    return NextResponse.json(
      await getFieldById(id),
    );
  } catch (error) {
    return handleFieldError(
      error,
    );
  }
}

export async function PUT(
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

    const field =
      await updateField(
        id,
        body,
      );

    return NextResponse.json(
      field,
    );
  } catch (error) {
    return handleFieldError(
      error,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const result =
      await deleteField(id);

    return NextResponse.json(
      result,
    );
  } catch (error) {
    return handleFieldError(
      error,
    );
  }
}