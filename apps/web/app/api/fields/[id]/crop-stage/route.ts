import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  CropStageValidationError,
  updateFieldCropStage,
} from "@/server/operational/crop-stage.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
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
      await updateFieldCropStage(
        id,
        body,
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

    if (
      error instanceof
      CropStageValidationError
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
      "[PATCH /api/fields/[id]/crop-stage]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível atualizar a fase da lavoura.",
      },
      {
        status: 500,
      },
    );
  }
}