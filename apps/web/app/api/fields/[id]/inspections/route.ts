import { NextRequest, NextResponse } from "next/server";

import { ResourceNotFoundError, requireOwnedField } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  createFieldInspection,
  FieldNotFoundError,
  InspectionValidationError,
  listFieldInspections,
} from "@/server/inspections/inspection.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

function handleInspectionError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof ResourceNotFoundError || error instanceof FieldNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof InspectionValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
  console.error("[Field Inspection API]", error);
  return NextResponse.json({ detail: "Não foi possível registrar a inspeção." }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    return NextResponse.json(await listFieldInspections(id));
  } catch (error) {
    return handleInspectionError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    const body = await request.json();
    return NextResponse.json(await createFieldInspection(id, body), { status: 201 });
  } catch (error) {
    return handleInspectionError(error);
  }
}
