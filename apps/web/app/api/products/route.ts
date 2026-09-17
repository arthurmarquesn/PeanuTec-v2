import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  createProduct,
  listProducts,
  ProductValidationError,
} from "@/server/products/product.service";
import { requireUser } from "@/server/auth/auth.service";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const activeOnlyValue = request.nextUrl.searchParams.get("active_only");
    const activeOnly = activeOnlyValue === "true" || activeOnlyValue === "1";
    return NextResponse.json(await listProducts(activeOnly));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    console.error("[GET /api/products]", error);
    return NextResponse.json({ detail: "Não foi possível carregar os produtos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const product = await createProduct(await request.json());
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    if (error instanceof ProductValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
    console.error("[POST /api/products]", error);
    return NextResponse.json({ detail: "Não foi possível cadastrar o produto." }, { status: 500 });
  }
}
