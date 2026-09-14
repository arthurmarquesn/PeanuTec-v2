import {
  NextResponse,
} from "next/server";

import {
  getSeasonOverview,
} from "@/server/season/season.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const overview =
      await getSeasonOverview();

    return NextResponse.json(
      overview,
    );
  } catch (error: unknown) {
    console.error(
      "[GET /api/season/overview]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar o resumo da safra.",
      },
      {
        status: 500,
      },
    );
  }
}