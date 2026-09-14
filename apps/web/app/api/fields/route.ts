import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createField,
  FieldValidationError,
  listFields,
} from "@/server/fields/field.service";

export const runtime =
  "nodejs";

export async function GET() {
  try {
    const fields =
      await listFields();

    return NextResponse.json(
      fields,
    );
  } catch (error) {
    console.error(
      "[GET /api/fields]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar os talhões.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const field =
      await createField(body);

    return NextResponse.json(
      field,
      {
        status: 201,
      },
    );
  } catch (error) {
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
      "[POST /api/fields]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível cadastrar o talhão.",
      },
      {
        status: 500,
      },
    );
  }
}