import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, requireUser } from "@/server/auth/auth.service";
import {
  deactivateProduct,
  getProductById,
  ProductNotFoundError,
  ProductValidationError,
  updateProduct,
} from "@/server/products/product.service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

function handleProductError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof ProductNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof ProductValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
  console.error("[Product API]", error);
  return NextResponse.json({ detail: "Erro interno ao processar o produto." }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    return NextResponse.json(await getProductById(id));
  } catch (error) {
    return handleProductError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    return NextResponse.json(await updateProduct(id, await request.json()));
  } catch (error) {
    return handleProductError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    return NextResponse.json(await deactivateProduct(id));
  } catch (error) {
    return handleProductError(error);
  }
}
