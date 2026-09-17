import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, requireUser } from "@/server/auth/auth.service";
import { analyzeDisease, IntelligenceServiceError } from "@/server/intelligence/python-intelligence";
import { WeatherServiceError } from "@/server/weather/open-meteo.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForIntelligenceError(error: IntelligenceServiceError) {
  if (error.status && error.status >= 400 && error.status < 500) return 400;
  if (error.message.toLowerCase().includes("tempo limite")) return 504;
  return 503;
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    return NextResponse.json(await analyzeDisease(await request.json()));
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    if (error instanceof IntelligenceServiceError) {
      return NextResponse.json({ detail: error.message }, { status: statusForIntelligenceError(error) });
    }
    if (error instanceof WeatherServiceError) {
      return NextResponse.json({ detail: error.message }, { status: 502 });
    }
    console.error("[POST /api/intelligence/analyze]", error);
    return NextResponse.json({ detail: "Não foi possível executar a análise." }, { status: 500 });
  }
}
