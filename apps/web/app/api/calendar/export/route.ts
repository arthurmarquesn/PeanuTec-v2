import ExcelJS from "exceljs";

import {
  NextRequest,
} from "next/server";

import {
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

function cellValue(
  value:
    | string
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return value;
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

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      "PeanuTec";

    workbook.created =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        "Calendário de Manejo",
      );

    worksheet.columns = [
      {
        header: "Data",
        key: "date",
        width: 14,
      },

      {
        header: "Data final",
        key: "end_date",
        width: 14,
      },

      {
        header: "Talhão",
        key: "field",
        width: 24,
      },

      {
        header: "Tipo",
        key: "type",
        width: 22,
      },

      {
        header: "Status",
        key: "status",
        width: 16,
      },

      {
        header: "Produto",
        key: "product",
        width: 24,
      },

      {
        header: "Tipo de produto",
        key: "product_type",
        width: 18,
      },

      {
        header: "Alvo",
        key: "target",
        width: 26,
      },

      {
        header: "Intervalo planejado",
        key: "interval",
        width: 21,
      },

      {
        header: "Observações",
        key: "notes",
        width: 40,
      },
    ];

    for (
      const event of
      result.events
    ) {
      worksheet.addRow({
        date:
          event.date,

        end_date:
          event.end_date,

        field:
          cellValue(
            event.field_name ??
              event.field_id,
          ),

        type:
          event.event_type,

        status:
          event.status,

        product:
          event.product,

        product_type:
          cellValue(
            event.product_type,
          ),

        target:
          event.target,

        interval:
          cellValue(
            event.planned_interval_days,
          ),

        notes:
          event.notes,
      });
    }

    const headerRow =
      worksheet.getRow(1);

    headerRow.font = {
      bold: true,
    };

    headerRow.alignment = {
      vertical:
        "middle",
    };

    headerRow.height =
      22;

    worksheet.views = [
      {
        state:
          "frozen",

        ySplit:
          1,
      },
    ];

    worksheet.autoFilter = {
      from:
        "A1",

      to:
        "J1",
    };

    const buffer =
      await workbook.xlsx.writeBuffer();

    return new Response(
      Buffer.from(
        buffer,
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            'attachment; filename="calendario-manejo-peanutec.xlsx"',

          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error(
      "[Calendar Export API]",
      error,
    );

    return Response.json(
      {
        detail:
          "Não foi possível exportar o calendário.",
      },
      {
        status: 500,
      },
    );
  }
}