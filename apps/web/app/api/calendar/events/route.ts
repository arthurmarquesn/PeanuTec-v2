import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CalendarValidationError,
  createCalendarEvent,
  listCalendarEvents,
} from "@/server/calendar/calendar.service";

import type {
  CalendarEventType,
  ProductType,
} from "@/types/analysis";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function errorResponse(
  error: unknown,
): NextResponse {
  if (
    error instanceof
    CalendarValidationError
  ) {
    return NextResponse.json(
      {
        detail:
          error.message,
      },
      {
        status: 400,
      },
    );
  }

  console.error(
    "[Calendar API]",
    error,
  );

  return NextResponse.json(
    {
      detail:
        "Não foi possível processar o calendário.",
    },
    {
      status: 500,
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const params =
      request.nextUrl.searchParams;

    const result =
      await listCalendarEvents({
        startDate:
          params.get(
            "start_date",
          ) ??
          undefined,

        endDate:
          params.get(
            "end_date",
          ) ??
          undefined,

        fieldId:
          params.get(
            "field_id",
          ) ??
          undefined,

        eventType:
          (params.get(
            "event_type",
          ) as CalendarEventType | null) ??
          undefined,

        productType:
          (params.get(
            "product_type",
          ) as ProductType | null) ??
          undefined,
      });

    return NextResponse.json(
      result,
    );
  } catch (error: unknown) {
    return errorResponse(
      error,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const event =
      await createCalendarEvent(
        body,
      );

    return NextResponse.json(
      event,
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return errorResponse(
      error,
    );
  }
}