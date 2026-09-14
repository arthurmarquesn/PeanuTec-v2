import {
  NextResponse,
} from "next/server";

import {
  getCalendarSummary,
} from "@/server/calendar/calendar.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const summary =
      await getCalendarSummary();

    return NextResponse.json(
      summary,
    );
  } catch (error: unknown) {
    console.error(
      "[Calendar Summary API]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível carregar o resumo do calendário.",
      },
      {
        status: 500,
      },
    );
  }
}