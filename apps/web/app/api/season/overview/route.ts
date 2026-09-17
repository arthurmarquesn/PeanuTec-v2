import { NextResponse } from "next/server";

import { UnauthorizedError } from "@/server/auth/auth.service";
import { getUserSeasonOverview } from "@/server/season/user-season-overview.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getUserSeasonOverview());
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    console.error("[GET /api/season/overview]", error);
    return NextResponse.json({ detail: "Não foi possível carregar o resumo da safra." }, { status: 500 });
  }
}
