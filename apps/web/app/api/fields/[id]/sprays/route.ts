import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createFieldSprayApplication,
  FieldNotFoundError,
  listFieldSprayApplications,
  SprayValidationError,
} from "@/server/sprays/spray.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function handleSprayError(
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
    SprayValidationError
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
    "[Spray API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Não foi possível processar a pulverização.",
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
      await listFieldSprayApplications(
        id,
      );

    return NextResponse.json(
      result,
    );
  } catch (error: unknown) {
    return handleSprayError(
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

    const application =
      await createFieldSprayApplication(
        id,
        body,
      );

    return NextResponse.json(
      application,
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return handleSprayError(
      error,
    );
  }
}