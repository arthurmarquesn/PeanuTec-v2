import {
  NextResponse,
} from "next/server";

import {
  getRanking,
} from "@/server/ranking/ranking.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const ranking =
      await getRanking();

    return NextResponse.json(
      ranking,
    );
  } catch (error: unknown) {
    console.error(
      "[GET /api/ranking]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível calcular o ranking dos talhões.",
      },
      {
        status: 500,
      },
    );
  }
}