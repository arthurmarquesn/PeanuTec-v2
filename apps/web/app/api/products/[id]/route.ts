import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deactivateProduct,
  getProductById,
  ProductNotFoundError,
  ProductValidationError,
  updateProduct,
} from "@/server/products/product.service";

export const runtime =
  "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
 * Error handler
 * ========================================================= */

function handleProductError(
  error: unknown,
) {
  if (
    error instanceof
    ProductNotFoundError
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
    "[Product API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Erro interno ao processar o produto.",
    },
    {
      status: 500,
    },
  );
}

/* =========================================================
 * GET /api/products/:id
 * ========================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const product =
      await getProductById(id);

    return NextResponse.json(
      product,
    );
  } catch (error) {
    return handleProductError(
      error,
    );
  }
}

/* =========================================================
 * PUT /api/products/:id
 * ========================================================= */

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

    const product =
      await updateProduct(
        id,
        body,
      );

    return NextResponse.json(
      product,
    );
  } catch (error) {
    return handleProductError(
      error,
    );
  }
}

/* =========================================================
 * DELETE /api/products/:id
 *
 * Soft delete:
 * apenas inativa o produto.
 * ========================================================= */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const product =
      await deactivateProduct(
        id,
      );

    return NextResponse.json(
      product,
    );
  } catch (error) {
    return handleProductError(
      error,
    );
  }
}