import { NextRequest, NextResponse } from "next/server";

import { ResourceNotFoundError, requireOwnedField, listOwnedFieldIds } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import {
  CalendarValidationError,
  createCalendarEvent,
  listCalendarEvents,
} from "@/server/calendar/calendar.service";
import type { CalendarEventType, ProductType } from "@/types/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
  if (error instanceof ResourceNotFoundError) return NextResponse.json({ detail: error.message }, { status: 404 });
  if (error instanceof CalendarValidationError) return NextResponse.json({ detail: error.message }, { status: 400 });
  console.error("[Calendar API]", error);
  return NextResponse.json({ detail: "Não foi possível processar o calendário." }, { status: 500 });
}

function filtersFromRequest(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    startDate: params.get("start_date") ?? undefined,
    endDate: params.get("end_date") ?? undefined,
    fieldId: params.get("field_id") ?? undefined,
    eventType: (params.get("event_type") as CalendarEventType | null) ?? undefined,
    productType: (params.get("product_type") as ProductType | null) ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const filters = filtersFromRequest(request);
    const ownedIds = new Set(await listOwnedFieldIds());

    if (filters.fieldId && !ownedIds.has(filters.fieldId)) {
      throw new ResourceNotFoundError("Talhão não encontrado.");
    }

    const result = await listCalendarEvents(filters);
    const events = filters.fieldId
      ? result.events
      : result.events.filter((event) => event.field_id === null || ownedIds.has(event.field_id));

    return NextResponse.json({
      ...result,
      total: events.length,
      events,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await listOwnedFieldIds();
    const body = await request.json();
    if (body?.field_id) await requireOwnedField(String(body.field_id));
    return NextResponse.json(await createCalendarEvent(body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
