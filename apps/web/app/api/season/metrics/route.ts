import {
  NextResponse,
} from "next/server";

import {
  getSeasonMetrics,
} from "@/server/season/season.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const metrics =
      await getSeasonMetrics();

    return NextResponse.json(
      metrics,
    );
  } catch (error: unknown) {
    console.error(
      "[GET /api/season/metrics]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar as métricas da safra.",
      },
      {
        status: 500,
      },
    );
  }
}