import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

import { listOwnedFieldIds, ResourceNotFoundError } from "@/server/auth/authorization";
import { UnauthorizedError } from "@/server/auth/auth.service";
import { listCalendarEvents } from "@/server/calendar/calendar.service";
import type { CalendarEventType, ProductType } from "@/types/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cellValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : value;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const ownedIds = new Set(await listOwnedFieldIds());
    const fieldId = params.get("field_id") ?? undefined;

    if (fieldId && !ownedIds.has(fieldId)) throw new ResourceNotFoundError("Talhão não encontrado.");

    const result = await listCalendarEvents({
      startDate: params.get("start_date") ?? undefined,
      endDate: params.get("end_date") ?? undefined,
      fieldId,
      eventType: (params.get("event_type") as CalendarEventType | null) ?? undefined,
      productType: (params.get("product_type") as ProductType | null) ?? undefined,
    });

    const events = fieldId
      ? result.events
      : result.events.filter((event) => event.field_id === null || ownedIds.has(event.field_id));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PeanuTec";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Calendário de Manejo");
    worksheet.columns = [
      { header: "Data", key: "date", width: 14 },
      { header: "Data final", key: "end_date", width: 14 },
      { header: "Talhão", key: "field", width: 24 },
      { header: "Tipo", key: "type", width: 22 },
      { header: "Status", key: "status", width: 16 },
      { header: "Produto", key: "product", width: 24 },
      { header: "Tipo de produto", key: "product_type", width: 18 },
      { header: "Alvo", key: "target", width: 26 },
      { header: "Intervalo planejado", key: "interval", width: 21 },
      { header: "Observações", key: "notes", width: 40 },
    ];

    for (const event of events) {
      worksheet.addRow({
        date: event.date,
        end_date: event.end_date,
        field: cellValue(event.field_name ?? event.field_id),
        type: event.event_type,
        status: event.status,
        product: event.product,
        product_type: cellValue(event.product_type),
        target: event.target,
        interval: cellValue(event.planned_interval_days),
        notes: event.notes,
      });
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: "middle" };
    worksheet.getRow(1).height = 22;
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: "J1" };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="calendario-manejo-peanutec.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) return Response.json({ detail: error.message }, { status: 401 });
    if (error instanceof ResourceNotFoundError) return Response.json({ detail: error.message }, { status: 404 });
    console.error("[Calendar Export API]", error);
    return Response.json({ detail: "Não foi possível exportar o calendário." }, { status: 500 });
  }
}
