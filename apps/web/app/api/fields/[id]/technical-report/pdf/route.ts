import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  buildFieldTechnicalReportPdf,
  buildTechnicalReportFilename,
} from "@/server/reports/technical-report-pdf.service";

import {
  getFieldTechnicalReport,
} from "@/server/reports/technical-report.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id,
    } =
      await context.params;

    const report =
      await getFieldTechnicalReport(
        id,
      );

    const pdf =
      await buildFieldTechnicalReportPdf(
        report,
      );

    const filename =
      buildTechnicalReportFilename(
        report.field.nome,
      );

    /*
     * pdf-lib retorna Uint8Array<ArrayBufferLike>.
     *
     * Response espera BodyInit, e dependendo das
     * versões de TypeScript/DOM usadas pelo Next,
     * esse Uint8Array genérico não é aceito
     * diretamente.
     *
     * Criamos um novo Uint8Array baseado em
     * ArrayBuffer real e enviamos o buffer.
     */
    const pdfBytes =
      new Uint8Array(
        pdf.byteLength,
      );

    pdfBytes.set(
      pdf,
    );

    const pdfBuffer =
      pdfBytes.buffer;

    return new Response(
      pdfBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error: unknown) {
    if (
      error instanceof
      FieldNotFoundError
    ) {
      return NextResponse.json(
        {
          detail:
            error.message,
        },
        {
          status: 404,
        },
      );
    }

    console.error(
      "[GET /api/fields/[id]/technical-report/pdf]",
      error,
    );

    return NextResponse.json(
      {
        detail:
          "Não foi possível gerar o PDF do relatório técnico.",
      },
      {
        status: 500,
      },
    );
  }
}