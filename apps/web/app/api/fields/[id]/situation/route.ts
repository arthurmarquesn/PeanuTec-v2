import { NextRequest, NextResponse } from "next/server";

import { ResourceNotFoundError, requireOwnedField } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import { FieldNotFoundError } from "@/server/fields/field.service";
import { getCurrentFieldSituation } from "@/server/situation/current-field-situation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    return NextResponse.json(await getCurrentFieldSituation(id));
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    if (error instanceof ResourceNotFoundError || error instanceof FieldNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
    console.error("[GET /api/fields/[id]/situation]", error);
    return NextResponse.json({ detail: "Não foi possível calcular a situação atual do talhão." }, { status: 500 });
  }
}
