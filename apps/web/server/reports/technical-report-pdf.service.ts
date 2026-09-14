import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type {
  FieldTechnicalReport,
} from "@/types/analysis";

/* =========================================================
 * Page configuration
 * ========================================================= */

const PAGE_WIDTH =
  595.28;

const PAGE_HEIGHT =
  841.89;

const MARGIN_X =
  46;

const TOP_MARGIN =
  48;

const BOTTOM_MARGIN =
  48;

const CONTENT_WIDTH =
  PAGE_WIDTH -
  MARGIN_X * 2;

const ORANGE =
  rgb(
    243 / 255,
    111 / 255,
    33 / 255,
  );

const BROWN =
  rgb(
    47 / 255,
    37 / 255,
    32 / 255,
  );

const DARK_GRAY =
  rgb(
    65 / 255,
    65 / 255,
    65 / 255,
  );

const MEDIUM_GRAY =
  rgb(
    105 / 255,
    105 / 255,
    105 / 255,
  );

const LIGHT_GRAY =
  rgb(
    225 / 255,
    225 / 255,
    225 / 255,
  );

/* =========================================================
 * Internal context
 * ========================================================= */

type PdfContext = {
  document:
    PDFDocument;

  page:
    PDFPage;

  regular:
    PDFFont;

  bold:
    PDFFont;

  y:
    number;
};

/* =========================================================
 * Text helpers
 * ========================================================= */

function safeText(
  value: unknown,
): string {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return "Não informado";
  }

  return String(
    value,
  )
    .replaceAll(
      "\u2013",
      "-",
    )
    .replaceAll(
      "\u2014",
      "-",
    )
    .replaceAll(
      "\u2022",
      "-",
    )
    .replaceAll(
      "\u201C",
      "\"",
    )
    .replaceAll(
      "\u201D",
      "\"",
    )
    .replaceAll(
      "\u2018",
      "'",
    )
    .replaceAll(
      "\u2019",
      "'",
    );
}

function formatBoolean(
  value:
    boolean | null | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "Não informado";
  }

  return value
    ? "Sim"
    : "Não";
}

function formatDate(
  value:
    string | null | undefined,
): string {
  if (!value) {
    return "Não informado";
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})/.exec(
      value,
    );

  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateTime(
  value:
    string | null | undefined,
): string {
  if (!value) {
    return "Não informado";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return formatDate(
      value,
    );
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",

      timeZone:
        "America/Sao_Paulo",
    },
  ).format(
    date,
  );
}

function formatStatus(
  value:
    string | null | undefined,
): string {
  if (!value) {
    return "Não informado";
  }

  const labels:
    Record<
      string,
      string
    > = {
      em_campo:
        "Em campo",

      pre_arranquio:
        "Pré-arranquio",

      arrancado:
        "Arrancado",

      colhido:
        "Colhido",

      em_dia:
        "Em dia",

      atencao:
        "Atenção",

      atrasado:
        "Atrasado",

      muito_alta:
        "Muito alta",

      alta:
        "Alta",

      media:
        "Média",

      baixa:
        "Baixa",

      vencida:
        "Vencida",

      sem_registro:
        "Sem registro",

      prioridade_maxima:
        "Prioridade máxima",

      alta_atencao:
        "Alta atenção",

      monitorar:
        "Monitorar",

      monitorar_resposta:
        "Monitorar resposta",

      estavel:
        "Estável",

      nenhuma:
        "Nenhuma",

      critica:
        "Crítica",

      regular:
        "Regular",

      localizado:
        "Localizado",

      reboleiras:
        "Reboleiras",

      espalhado:
        "Espalhado",

      generalizado:
        "Generalizado",

      ausente:
        "Ausente",
    };

  return (
    labels[value] ??
    value
      .replaceAll(
        "_",
        " ",
      )
  );
}

/* =========================================================
 * Wrapping
 * ========================================================= */

function splitLongWord(
  font: PDFFont,
  word: string,
  size: number,
  maxWidth: number,
): string[] {
  const chunks:
    string[] = [];

  let current =
    "";

  for (
    const character of
    word
  ) {
    const candidate =
      current +
      character;

    const width =
      font.widthOfTextAtSize(
        candidate,
        size,
      );

    if (
      width <=
        maxWidth ||
      current.length === 0
    ) {
      current =
        candidate;

      continue;
    }

    chunks.push(
      current,
    );

    current =
      character;
  }

  if (current) {
    chunks.push(
      current,
    );
  }

  return chunks;
}

function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs =
    safeText(
      text,
    ).split(
      /\r?\n/,
    );

  const result:
    string[] = [];

  for (
    const paragraph of
    paragraphs
  ) {
    const words =
      paragraph
        .split(
          /\s+/,
        )
        .filter(Boolean);

    if (
      words.length ===
      0
    ) {
      result.push(
        "",
      );

      continue;
    }

    let current =
      "";

    for (
      const originalWord of
      words
    ) {
      const pieces =
        font.widthOfTextAtSize(
          originalWord,
          size,
        ) >
        maxWidth
          ? splitLongWord(
              font,
              originalWord,
              size,
              maxWidth,
            )
          : [
              originalWord,
            ];

      for (
        const word of
        pieces
      ) {
        const candidate =
          current
            ? `${current} ${word}`
            : word;

        const width =
          font.widthOfTextAtSize(
            candidate,
            size,
          );

        if (
          width <=
          maxWidth
        ) {
          current =
            candidate;

          continue;
        }

        if (current) {
          result.push(
            current,
          );
        }

        current =
          word;
      }
    }

    if (current) {
      result.push(
        current,
      );
    }
  }

  return result;
}

/* =========================================================
 * Page helpers
 * ========================================================= */

function addPage(
  context:
    PdfContext,
): void {
  context.page =
    context.document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  context.y =
    PAGE_HEIGHT -
    TOP_MARGIN;
}

function ensureSpace(
  context:
    PdfContext,
  requiredHeight:
    number,
): void {
  if (
    context.y -
      requiredHeight <
    BOTTOM_MARGIN
  ) {
    addPage(
      context,
    );
  }
}

/* =========================================================
 * Drawing helpers
 * ========================================================= */

function drawParagraph(
  context:
    PdfContext,
  text: string,
  options?: {
    size?: number;
    bold?: boolean;
    color?: ReturnType<
      typeof rgb
    >;
    indent?: number;
    spacingAfter?: number;
  },
): void {
  const size =
    options?.size ??
    9.5;

  const font =
    options?.bold
      ? context.bold
      : context.regular;

  const indent =
    options?.indent ??
    0;

  const maxWidth =
    CONTENT_WIDTH -
    indent;

  const lineHeight =
    size * 1.35;

  const lines =
    wrapText(
      font,
      text,
      size,
      maxWidth,
    );

  for (
    const line of
    lines
  ) {
    ensureSpace(
      context,
      lineHeight,
    );

    context.page.drawText(
      line,
      {
        x:
          MARGIN_X +
          indent,

        y:
          context.y,

        size,

        font,

        color:
          options?.color ??
          DARK_GRAY,
      },
    );

    context.y -=
      lineHeight;
  }

  context.y -=
    options
      ?.spacingAfter ??
    5;
}

function drawSectionTitle(
  context:
    PdfContext,
  title: string,
): void {
  ensureSpace(
    context,
    34,
  );

  context.y -=
    6;

  context.page.drawText(
    safeText(
      title,
    ),
    {
      x:
        MARGIN_X,

      y:
        context.y,

      size:
        13,

      font:
        context.bold,

      color:
        BROWN,
    },
  );

  context.y -=
    8;

  context.page.drawLine({
    start: {
      x:
        MARGIN_X,

      y:
        context.y,
    },

    end: {
      x:
        PAGE_WIDTH -
        MARGIN_X,

      y:
        context.y,
    },

    thickness:
      1.2,

    color:
      ORANGE,
  });

  context.y -=
    15;
}

function drawKeyValue(
  context:
    PdfContext,
  label: string,
  value: unknown,
): void {
  const labelWidth =
    150;

  const valueWidth =
    CONTENT_WIDTH -
    labelWidth -
    8;

  const size =
    9;

  const labelLines =
    wrapText(
      context.bold,
      label,
      size,
      labelWidth,
    );

  const valueLines =
    wrapText(
      context.regular,
      safeText(value),
      size,
      valueWidth,
    );

  const lineCount =
    Math.max(
      labelLines.length,
      valueLines.length,
      1,
    );

  const lineHeight =
    12;

  const requiredHeight =
    lineCount *
      lineHeight +
    5;

  ensureSpace(
    context,
    requiredHeight,
  );

  const startY =
    context.y;

  labelLines.forEach(
    (
      line,
      index,
    ) => {
      context.page.drawText(
        line,
        {
          x:
            MARGIN_X,

          y:
            startY -
            index *
              lineHeight,

          size,

          font:
            context.bold,

          color:
            BROWN,
        },
      );
    },
  );

  valueLines.forEach(
    (
      line,
      index,
    ) => {
      context.page.drawText(
        line,
        {
          x:
            MARGIN_X +
            labelWidth +
            8,

          y:
            startY -
            index *
              lineHeight,

          size,

          font:
            context.regular,

          color:
            DARK_GRAY,
        },
      );
    },
  );

  context.y -=
    requiredHeight;
}

function drawTimelineItem(
  context:
    PdfContext,
  date: string,
  title: string,
  description: string,
): void {
  ensureSpace(
    context,
    48,
  );

  drawParagraph(
    context,
    `${formatDateTime(date)} - ${title}`,
    {
      size:
        9.5,

      bold:
        true,

      color:
        BROWN,

      spacingAfter:
        2,
    },
  );

  drawParagraph(
    context,
    description,
    {
      size:
        8.8,

      indent:
        12,

      spacingAfter:
        8,
    },
  );
}

/* =========================================================
 * PDF builder
 * ========================================================= */

export async function buildFieldTechnicalReportPdf(
  report:
    FieldTechnicalReport,
): Promise<Uint8Array> {
  const document =
    await PDFDocument.create();

  const regular =
    await document.embedFont(
      StandardFonts.Helvetica,
    );

  const bold =
    await document.embedFont(
      StandardFonts.HelveticaBold,
    );

  const context:
    PdfContext = {
    document,

    page:
      document.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]),

    regular,

    bold,

    y:
      PAGE_HEIGHT -
      TOP_MARGIN,
  };

  /* =======================================================
   * Header
   * ======================================================= */

  context.page.drawText(
    "PeanuTec",
    {
      x:
        MARGIN_X,

      y:
        context.y,

      size:
        21,

      font:
        bold,

      color:
        ORANGE,
    },
  );

  context.page.drawText(
    "Relatório Técnico Operacional",
    {
      x:
        MARGIN_X,

      y:
        context.y -
        24,

      size:
        15,

      font:
        bold,

      color:
        BROWN,
    },
  );

  context.y -=
    50;

  drawParagraph(
    context,
    report.field.nome,
    {
      size:
        11,

      bold:
        true,

      color:
        BROWN,

      spacingAfter:
        2,
    },
  );

  drawParagraph(
    context,
    `${report.field.cidade} - Gerado em ${formatDateTime(report.generated_at)}`,
    {
      size:
        8.5,

      color:
        MEDIUM_GRAY,

      spacingAfter:
        12,
    },
  );

  /* =======================================================
   * Field
   * ======================================================= */

  drawSectionTitle(
    context,
    "Identificação do talhão",
  );

  drawKeyValue(
    context,
    "Talhão",
    report.field.nome,
  );

  drawKeyValue(
    context,
    "Município",
    report.field.cidade,
  );

  drawKeyValue(
    context,
    "Cultura",
    report.field.cultura,
  );

  drawKeyValue(
    context,
    "Data de plantio",
    formatDate(
      report.field
        .data_plantio,
    ),
  );

  drawKeyValue(
    context,
    "Status da lavoura",
    formatStatus(
      report.field
        .status_lavoura,
    ),
  );

  drawKeyValue(
    context,
    "Doenças monitoradas",
    report.field
      .doencas_monitoradas
      .join(", "),
  );

  drawKeyValue(
    context,
    "Cultura anterior",
    report.field
      .previous_crop,
  );

  drawKeyValue(
    context,
    "Rotação de cultura",
    formatBoolean(
      report.field
        .crop_rotation,
    ),
  );

  drawKeyValue(
    context,
    "Repetição de amendoim",
    report.field
      .peanut_repetition_years !==
    null &&
    report.field
      .peanut_repetition_years !==
    undefined
      ? `${report.field.peanut_repetition_years} safra(s)`
      : "Não informado",
  );

  drawKeyValue(
    context,
    "Histórico de incidência",
    formatBoolean(
      report.field
        .had_disease_incidence,
    ),
  );

  drawKeyValue(
    context,
    "Pressão histórica",
    formatStatus(
      report.field
        .historical_pressure,
    ),
  );

  /* =======================================================
   * Current situation
   * ======================================================= */

  drawSectionTitle(
    context,
    "Situação atual",
  );

  drawKeyValue(
    context,
    "Situação",
    report
      .current_situation
      .situation_label,
  );

  drawKeyValue(
    context,
    "Prioridade",
    report
      .current_situation
      .priority_label ??
      "Não informado",
  );

  drawKeyValue(
    context,
    "Score de prioridade",
    report
      .current_situation
      .priority_score ??
      "Não informado",
  );

  drawKeyValue(
    context,
    "Confiança",
    report
      .current_situation
      .confidence_label ??
      "Não informado",
  );

  drawKeyValue(
    context,
    "Doença de referência",
    report
      .current_situation
      .risk_context
      .main_disease,
  );

  drawKeyValue(
    context,
    "Classificação de risco",
    formatStatus(
      report
        .current_situation
        .risk_context
        .risk_classification,
    ),
  );

  drawKeyValue(
    context,
    "Índice agronômico",
    report
      .current_situation
      .risk_context
      .agronomic_index,
  );

  drawParagraph(
    context,
    report
      .current_situation
      .summary,
    {
      size:
        9.5,

      spacingAfter:
        9,
    },
  );

  drawParagraph(
    context,
    `Próxima ação sugerida: ${report.current_situation.recommended_next_action}`,
    {
      size:
        9.5,

      bold:
        true,

      color:
        BROWN,

      spacingAfter:
        8,
    },
  );

  /* =======================================================
   * Inspection
   * ======================================================= */

  drawSectionTitle(
    context,
    "Inspeções de campo",
  );

  drawKeyValue(
    context,
    "Total de inspeções",
    report
      .inspections_summary
      .total,
  );

  drawKeyValue(
    context,
    "Última inspeção",
    formatDateTime(
      report
        .inspections_summary
        .latest_date,
    ),
  );

  drawKeyValue(
    context,
    "Inspeções com sintomas",
    report
      .inspections_summary
      .symptoms_found_count,
  );

  drawKeyValue(
    context,
    "Retornos indicados",
    report
      .inspections_summary
      .return_needed_count,
  );

  if (
    report.latest_inspection
  ) {
    drawKeyValue(
      context,
      "Doença observada",
      report
        .latest_inspection
        .disease,
    );

    drawKeyValue(
      context,
      "Sintomas",
      formatBoolean(
        report
          .latest_inspection
          .symptoms_found,
      ),
    );

    drawKeyValue(
      context,
      "Severidade visual",
      formatStatus(
        report
          .latest_inspection
          .visual_severity,
      ),
    );

    drawKeyValue(
      context,
      "Desfolha",
      formatStatus(
        report
          .latest_inspection
          .defoliation_level,
      ),
    );

    drawKeyValue(
      context,
      "Situação geral",
      formatStatus(
        report
          .latest_inspection
          .general_status,
      ),
    );

    drawKeyValue(
      context,
      "Distribuição",
      formatStatus(
        report
          .latest_inspection
          .problem_distribution,
      ),
    );

    drawKeyValue(
      context,
      "Condição do solo",
      formatStatus(
        report
          .latest_inspection
          .soil_condition,
      ),
    );

    drawKeyValue(
      context,
      "Responsável",
      report
        .latest_inspection
        .responsible,
    );

    if (
      report
        .latest_inspection
        .notes
    ) {
      drawParagraph(
        context,
        `Observações: ${report.latest_inspection.notes}`,
        {
          size:
            8.8,
        },
      );
    }
  }

  /* =======================================================
   * Spray
   * ======================================================= */

  drawSectionTitle(
    context,
    "Pulverizações",
  );

  drawKeyValue(
    context,
    "Total de aplicações",
    report
      .spray_summary
      .total,
  );

  drawKeyValue(
    context,
    "Última aplicação",
    formatDateTime(
      report
        .spray_summary
        .latest_date,
    ),
  );

  drawKeyValue(
    context,
    "Último produto",
    report
      .spray_summary
      .last_product,
  );

  drawKeyValue(
    context,
    "Último alvo",
    report
      .spray_summary
      .last_target,
  );

  drawKeyValue(
    context,
    "Intervalo atual",
    formatStatus(
      report
        .spray_summary
        .last_interval_status,
    ),
  );

  if (
    report
      .latest_spray_application
  ) {
    drawKeyValue(
      context,
      "Dose registrada",
      report
        .latest_spray_application
        .dose,
    );

    drawKeyValue(
      context,
      "Responsável",
      report
        .latest_spray_application
        .responsible,
    );

    drawKeyValue(
      context,
      "Intervalo planejado",
      report
        .latest_spray_application
        .planned_interval_days !==
      null
        ? `${report.latest_spray_application.planned_interval_days} dia(s)`
        : "Não informado",
    );

    drawKeyValue(
      context,
      "Dias desde a aplicação",
      report
        .latest_spray_application
        .days_since_application,
    );
  }

  /* =======================================================
   * Timeline
   * ======================================================= */

  drawSectionTitle(
    context,
    "Linha do tempo operacional",
  );

  if (
    report.timeline.length ===
    0
  ) {
    drawParagraph(
      context,
      "Nenhum evento operacional registrado.",
    );
  } else {
    for (
      const item of
      report.timeline
    ) {
      drawTimelineItem(
        context,
        item.date,
        item.title,
        item.description,
      );
    }
  }

  /* =======================================================
   * Safety note
   * ======================================================= */

  drawSectionTitle(
    context,
    "Nota técnica",
  );

  drawParagraph(
    context,
    report.safety_note,
    {
      size:
        8.5,

      color:
        MEDIUM_GRAY,

      spacingAfter:
        8,
    },
  );

  /* =======================================================
   * Footer / pagination
   * ======================================================= */

  const pages =
    document.getPages();

  pages.forEach(
    (
      page,
      index,
    ) => {
      page.drawLine({
        start: {
          x:
            MARGIN_X,

          y:
            32,
        },

        end: {
          x:
            PAGE_WIDTH -
            MARGIN_X,

          y:
            32,
        },

        thickness:
          0.6,

        color:
          LIGHT_GRAY,
      });

      page.drawText(
        "PeanuTec - Relatório Técnico",
        {
          x:
            MARGIN_X,

          y:
            18,

          size:
            7.5,

          font:
            regular,

          color:
            MEDIUM_GRAY,
        },
      );

      const pageText =
        `Página ${index + 1} de ${pages.length}`;

      const pageWidth =
        regular.widthOfTextAtSize(
          pageText,
          7.5,
        );

      page.drawText(
        pageText,
        {
          x:
            PAGE_WIDTH -
            MARGIN_X -
            pageWidth,

          y:
            18,

          size:
            7.5,

          font:
            regular,

          color:
            MEDIUM_GRAY,
        },
      );
    },
  );

  return document.save();
}

/* =========================================================
 * Filename
 * ========================================================= */

export function buildTechnicalReportFilename(
  fieldName: string,
): string {
  const normalized =
    fieldName
      .normalize(
        "NFD",
      )
      .replace(
        /\p{Diacritic}/gu,
        "",
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return `relatorio-tecnico-${
    normalized ||
    "talhao"
  }.pdf`;
}