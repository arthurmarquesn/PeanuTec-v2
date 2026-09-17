import { NextResponse } from "next/server";

import { UnauthorizedError } from "@/server/auth/auth.service";
import { getUserSeasonMetrics } from "@/server/season/user-season.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getUserSeasonMetrics());
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    console.error("[GET /api/season/metrics]", error);
    return NextResponse.json({ detail: "Não foi possível carregar as métricas da safra." }, { status: 500 });
  }
}
