import { NextRequest, NextResponse } from "next/server";

import { listOwnedFieldIds } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  createScopedInspection,
  FieldNotFoundError,
  InspectionValidationError,
} from "@/server/inspections/inspection.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handleInspectionError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof FieldNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof InspectionValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
  console.error("[Scoped Inspection API]", error);
  return NextResponse.json({ detail: "Não foi possível registrar a inspeção." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownedFieldIds = await listOwnedFieldIds();
    const scope = body?.scope;

    if (scope !== "selected" && scope !== "all") {
      throw new InspectionValidationError("Escopo da inspeção inválido.");
    }

    const fieldIds = scope === "all" ? ownedFieldIds : body?.field_ids;
    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      throw new InspectionValidationError(
        scope === "all"
          ? "Não existem talhões ativos para receber a inspeção."
          : "Selecione ao menos um talhão.",
      );
    }

    const normalizedOwned = new Set(ownedFieldIds);
    const requestedIds = Array.from(new Set(fieldIds));
    if (requestedIds.some((fieldId) => typeof fieldId !== "string" || !normalizedOwned.has(fieldId))) {
      throw new FieldNotFoundError();
    }

    const result = await createScopedInspection({
      ...body,
      scope: "selected",
      field_ids: requestedIds,
    });

    return NextResponse.json({ ...result, scope }, { status: 201 });
  } catch (error: unknown) {
    return handleInspectionError(error);
  }
}
