import { NextRequest, NextResponse } from "next/server";

import { ResourceNotFoundError, requireOwnedField } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  createFieldSprayApplication,
  FieldNotFoundError,
  listFieldSprayApplications,
  SprayValidationError,
} from "@/server/sprays/spray.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

function handleSprayError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof ResourceNotFoundError || error instanceof FieldNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof SprayValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
  console.error("[Spray API]", error);
  return NextResponse.json({ detail: "Não foi possível processar a pulverização." }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    return NextResponse.json(await listFieldSprayApplications(id));
  } catch (error) {
    return handleSprayError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    const body = await request.json();
    return NextResponse.json(await createFieldSprayApplication(id, body), { status: 201 });
  } catch (error) {
    return handleSprayError(error);
  }
}
