import { NextResponse } from "next/server";

import { listOwnedFieldIds } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import { prisma } from "@/server/db/prisma";
import { listCalendarEvents } from "@/server/calendar/calendar.service";
import { getSaoPauloDateKey } from "@/server/time/sao-paulo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysSince(value: Date | null, today: string) {
  if (!value) return null;
  const dayKey = getSaoPauloDateKey(value);
  const diff =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayKey}T00:00:00Z`)) /
    86_400_000;
  return Number.isFinite(diff) ? diff : null;
}

export async function GET() {
  try {
    const ownedIds = await listOwnedFieldIds();
    const ownedSet = new Set(ownedIds);

    const [fields, inspections, result] = await Promise.all([
      ownedIds.length
        ? prisma.field.findMany({
            where: { id: { in: ownedIds } },
            select: { id: true, cropStatus: true },
          })
        : Promise.resolve([]),
      ownedIds.length
        ? prisma.inspection.findMany({
            where: { fieldId: { in: ownedIds } },
            select: { fieldId: true, inspectedAt: true },
            orderBy: { inspectedAt: "desc" },
          })
        : Promise.resolve([]),
      listCalendarEvents(),
    ]);

    const events = result.events.filter(
      (event) => event.field_id === null || ownedSet.has(event.field_id),
    );

    const latestInspection = new Map<string, Date>();
    for (const inspection of inspections) {
      if (!latestInspection.has(inspection.fieldId)) {
        latestInspection.set(inspection.fieldId, inspection.inspectedAt);
      }
    }

    const today = getSaoPauloDateKey();
    const fieldsWithoutRecentInspection = fields.filter((field) => {
      if (field.cropStatus !== "em_campo") return false;
      const latest = latestInspection.get(field.id) ?? null;
      const age = daysSince(latest, today);
      return age === null || age > 7;
    }).length;

    return NextResponse.json({
      active_fields: fields.filter((field) => field.cropStatus === "em_campo").length,
      events_count: events.length,
      spray_events_count: events.filter((event) => event.event_type === "pulverizacao").length,
      inspection_events_count: events.filter((event) => event.event_type === "inspecao").length,
      upcoming_attention_count: events.filter(
        (event) =>
          (event.event_type === "monitoramento" || event.event_type === "reaplicacao_prevista") &&
          event.status === "previsto" &&
          event.date >= today,
      ).length,
      fields_without_recent_inspection: fieldsWithoutRecentInspection,
    });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ detail: error.message }, { status: 401 });
    console.error("[Calendar Summary API]", error);
    return NextResponse.json({ detail: "Não foi possível carregar o resumo do calendário." }, { status: 500 });
  }
}
