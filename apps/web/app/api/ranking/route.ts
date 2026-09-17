import { NextResponse } from "next/server";

import { listOwnedFieldIds } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import { getRanking } from "@/server/ranking/ranking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownedIds = new Set(await listOwnedFieldIds());
    const ranking = await getRanking();
    const scoped = ranking.ranking
      .filter((item) => ownedIds.has(item.field_id))
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return NextResponse.json({
      ...ranking,
      total_fields: ownedIds.size,
      total_items: scoped.length,
      ranking: scoped,
    });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    console.error("[GET /api/ranking]", error);
    return NextResponse.json({ detail: "Não foi possível calcular o ranking dos talhões." }, { status: 500 });
  }
}
