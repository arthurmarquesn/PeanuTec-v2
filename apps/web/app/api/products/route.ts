import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createProduct,
  listProducts,
  ProductValidationError,
} from "@/server/products/product.service";

export const runtime =
  "nodejs";

/* =========================================================
 * GET /api/products
 * ========================================================= */

export async function GET(
  request: NextRequest,
) {
  try {
    const activeOnlyValue =
      request.nextUrl.searchParams.get(
        "active_only",
      );

    const activeOnly =
      activeOnlyValue === "true" ||
      activeOnlyValue === "1";

    const products =
      await listProducts(
        activeOnly,
      );

    return NextResponse.json(
      products,
    );
  } catch (error) {
    console.error(
      "[GET /api/products]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar os produtos.",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
 * POST /api/products
 * ========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const product =
      await createProduct(
        body,
      );

    return NextResponse.json(
      product,
      {
        status: 201,
      },
    );
  } catch (error) {
    if (
      error instanceof
      ProductValidationError
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
      "[POST /api/products]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível cadastrar o produto.",
      },
      {
        status: 500,
      },
    );
  }
}