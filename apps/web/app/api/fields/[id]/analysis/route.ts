import { NextRequest, NextResponse } from "next/server";

import { ResourceNotFoundError, requireOwnedField } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  FieldNotFoundError,
  getFieldAnalysisHistory,
  IntelligenceServiceError,
  runFieldAnalysis,
} from "@/server/analysis/field-analysis.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

function handleAnalysisError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof ResourceNotFoundError || error instanceof FieldNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof IntelligenceServiceError) {
    const message = error.message.toLowerCase();
    const status = error.status && error.status >= 400 && error.status < 500 ? 400 : message.includes("tempo limite") ? 504 : 503;
    return NextResponse.json({ detail: error.message }, { status });
  }
  console.error("[Field Analysis API]", error);
  return NextResponse.json({ detail: "Não foi possível concluir a análise do talhão." }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    return NextResponse.json(await getFieldAnalysisHistory(id));
  } catch (error) {
    return handleAnalysisError(error);
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireOwnedField(id);
    return NextResponse.json(await runFieldAnalysis(id));
  } catch (error) {
    return handleAnalysisError(error);
  }
}
