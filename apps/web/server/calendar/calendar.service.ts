import "server-only";

import type {
  CalendarEvent as PrismaCalendarEvent,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import {
  getSaoPauloDateKey,
  parseIsoDate,
} from "@/server/time/sao-paulo";

import type {
  CalendarColorKey,
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventsResponse,
  CalendarEventType,
  CalendarSummary,
  ProductType,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class CalendarValidationError extends Error {
  constructor(
    message: string,
  ) {
    super(message);

    this.name =
      "CalendarValidationError";
  }
}

/* =========================================================
 * Constants
 * ========================================================= */

const EVENT_TYPES =
  new Set<CalendarEventType>([
    "pulverizacao",
    "inspecao",
    "monitoramento",
    "reaplicacao_prevista",
    "observacao",
  ]);

const PRODUCT_TYPES =
  new Set<ProductType>([
    "fungicida",
    "inseticida",
    "acaricida",
    "herbicida",
    "outro",
  ]);

const EVENT_COLORS: Record<
  CalendarEventType,
  CalendarColorKey
> = {
  pulverizacao:
    "yellow",

  inspecao:
    "green",

  monitoramento:
    "blue",

  reaplicacao_prevista:
    "purple",

  observacao:
    "gray",
};

const EVENT_STATUSES: Record<
  CalendarEventType,
  CalendarEventStatus
> = {
  pulverizacao:
    "realizado",

  inspecao:
    "realizado",

  monitoramento:
    "previsto",

  reaplicacao_prevista:
    "previsto",

  observacao:
    "informativo",
};

/* =========================================================
 * Public data types
 * ========================================================= */

export type CalendarEventInsert = {
  id?: string;

  eventType:
    CalendarEventType;

  title:
    string;

  fieldId:
    string | null;

  fieldName:
    string | null;

  date:
    string;

  endDate:
    string;

  product:
    string;

  productType:
    ProductType | null;

  target:
    string;

  plannedIntervalDays:
    number | null;

  notes:
    string;

  colorKey:
    CalendarColorKey;

  status:
    CalendarEventStatus;

  sourceType:
    string | null;

  sourceId:
    string | null;
};

export type CalendarEventFilters = {
  startDate?:
    string;

  endDate?:
    string;

  fieldId?:
    string;

  eventType?:
    CalendarEventType;

  productType?:
    ProductType;
};

/* =========================================================
 * Helpers
 * ========================================================= */

function optionalText(
  value: unknown,
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new CalendarValidationError(
      "Campo textual inválido.",
    );
  }

  return (
    value.trim() ||
    null
  );
}

function requiredText(
  value: unknown,
  label: string,
): string {
  const parsed =
    optionalText(value);

  if (!parsed) {
    throw new CalendarValidationError(
      `Informe ${label.toLowerCase()}.`,
    );
  }

  return parsed;
}

function parseEventType(
  value: unknown,
): CalendarEventType {
  if (
    typeof value !==
      "string" ||
    !EVENT_TYPES.has(
      value as CalendarEventType,
    )
  ) {
    throw new CalendarValidationError(
      "Tipo de evento inválido.",
    );
  }

  return value as CalendarEventType;
}

function parseProductType(
  value: unknown,
): ProductType | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    !PRODUCT_TYPES.has(
      value as ProductType,
    )
  ) {
    throw new CalendarValidationError(
      "Tipo de produto inválido.",
    );
  }

  return value as ProductType;
}

function parseOptionalPositiveInteger(
  value: unknown,
  label: string,
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "number" ||
    !Number.isInteger(
      value,
    ) ||
    value <= 0
  ) {
    throw new CalendarValidationError(
      `${label} deve ser um número inteiro positivo.`,
    );
  }

  return value;
}

export function buildDerivedEventId(
  sourceType: string,
  sourceId: string,
  eventType:
    CalendarEventType,
): string {
  return [
    sourceType,
    sourceId,
    eventType,
  ].join(":");
}

export function getEventDefaults(
  eventType:
    CalendarEventType,
) {
  return {
    colorKey:
      EVENT_COLORS[
        eventType
      ],

    status:
      EVENT_STATUSES[
        eventType
      ],
  };
}

/* =========================================================
 * Mapper
 * ========================================================= */

export function mapCalendarEvent(
  event:
    PrismaCalendarEvent,
): CalendarEvent {
  return {
    id:
      event.id,

    event_type:
      event.eventType as CalendarEventType,

    title:
      event.title,

    field_id:
      event.fieldId,

    field_name:
      event.fieldName,

    date:
      event.date,

    end_date:
      event.endDate,

    product:
      event.product,

    product_type:
      event.productType,

    target:
      event.target,

    planned_interval_days:
      event.plannedIntervalDays,

    notes:
      event.notes,

    color_key:
      event.colorKey as CalendarColorKey,

    status:
      event.status,

    source_type:
      event.sourceType,

    source_id:
      event.sourceId,

    created_at:
      event.createdAt.toISOString(),
  };
}

/* =========================================================
 * Manual event parser
 * ========================================================= */

async function parseManualEvent(
  input: unknown,
): Promise<CalendarEventInsert> {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new CalendarValidationError(
      "Dados do evento inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const eventType =
    parseEventType(
      body.event_type,
    );

  const title =
    requiredText(
      body.title,
      "Título",
    );

  const fieldId =
    optionalText(
      body.field_id,
    );

  if (
    !fieldId &&
    eventType !==
      "observacao"
  ) {
    throw new CalendarValidationError(
      "Selecione um talhão para este tipo de evento.",
    );
  }

  let fieldName:
    string | null = null;

  if (fieldId) {
    const field =
      await prisma.field.findUnique({
        where: {
          id: fieldId,
        },

        select: {
          name: true,
        },
      });

    if (!field) {
      throw new CalendarValidationError(
        "Talhão não encontrado.",
      );
    }

    fieldName =
      field.name;
  }

  if (
    typeof body.date !==
    "string"
  ) {
    throw new CalendarValidationError(
      "Data do evento inválida.",
    );
  }

  let date: string;

  try {
    date =
      parseIsoDate(
        body.date,
      );
  } catch {
    throw new CalendarValidationError(
      "Data do evento inválida.",
    );
  }

  let endDate =
    date;

  if (
    body.end_date !==
      undefined &&
    body.end_date !==
      null &&
    body.end_date !==
      ""
  ) {
    if (
      typeof body.end_date !==
      "string"
    ) {
      throw new CalendarValidationError(
        "Data final inválida.",
      );
    }

    try {
      endDate =
        parseIsoDate(
          body.end_date,
        );
    } catch {
      throw new CalendarValidationError(
        "Data final inválida.",
      );
    }
  }

  if (
    endDate < date
  ) {
    throw new CalendarValidationError(
      "A data final não pode ser anterior à data inicial.",
    );
  }

  const defaults =
    getEventDefaults(
      eventType,
    );

  return {
    eventType,

    title,

    fieldId,

    fieldName,

    date,

    endDate,

    product:
      optionalText(
        body.product,
      ) ?? "",

    productType:
      parseProductType(
        body.product_type,
      ),

    target:
      optionalText(
        body.target,
      ) ?? "",

    plannedIntervalDays:
      parseOptionalPositiveInteger(
        body.planned_interval_days,
        "Intervalo planejado",
      ),

    notes:
      optionalText(
        body.notes,
      ) ?? "",

    colorKey:
      defaults.colorKey,

    status:
      defaults.status,

    sourceType:
      null,

    sourceId:
      null,
  };
}

/* =========================================================
 * Create
 * ========================================================= */

export async function createCalendarEvent(
  input: unknown,
): Promise<CalendarEvent> {
  const data =
    await parseManualEvent(
      input,
    );

  const event =
    await prisma.calendarEvent.create({
      data,
    });

  return mapCalendarEvent(
    event,
  );
}

/* =========================================================
 * List
 * ========================================================= */

export async function listCalendarEvents(
  filters:
    CalendarEventFilters = {},
): Promise<CalendarEventsResponse> {
  const events =
    await prisma.calendarEvent.findMany({
      where: {
        ...(filters.startDate
          ? {
              date: {
                gte:
                  filters.startDate,
              },
            }
          : {}),

        ...(filters.endDate
          ? {
              date: {
                lte:
                  filters.endDate,
              },
            }
          : {}),

        ...(filters.fieldId
          ? {
              fieldId:
                filters.fieldId,
            }
          : {}),

        ...(filters.eventType
          ? {
              eventType:
                filters.eventType,
            }
          : {}),

        ...(filters.productType
          ? {
              productType:
                filters.productType,
            }
          : {}),
      },

      orderBy: [
        {
          date: "asc",
        },

        {
          endDate:
            "asc",
        },

        {
          title:
            "asc",
        },
      ],
    });

  return {
    total:
      events.length,

    events:
      events.map(
        mapCalendarEvent,
      ),
  };
}

/* =========================================================
 * Summary
 * ========================================================= */

export async function getCalendarSummary(): Promise<CalendarSummary> {
  const today =
    getSaoPauloDateKey();

  const [
    activeFields,
    eventsCount,
    sprayEventsCount,
    inspectionEventsCount,
    upcomingAttentionCount,
  ] =
    await Promise.all([
      prisma.field.count({
        where: {
          cropStatus:
            "em_campo",
        },
      }),

      prisma.calendarEvent.count(),

      prisma.calendarEvent.count({
        where: {
          eventType:
            "pulverizacao",
        },
      }),

      prisma.calendarEvent.count({
        where: {
          eventType:
            "inspecao",
        },
      }),

      prisma.calendarEvent.count({
        where: {
          eventType: {
            in: [
              "monitoramento",
              "reaplicacao_prevista",
            ],
          },

          status:
            "previsto",

          date: {
            gte:
              today,
          },
        },
      }),
    ]);

  return {
    active_fields:
      activeFields,

    events_count:
      eventsCount,

    spray_events_count:
      sprayEventsCount,

    inspection_events_count:
      inspectionEventsCount,

    upcoming_attention_count:
      upcomingAttentionCount,

    /*
     * Será calculado corretamente quando
     * a central operacional passar a usar
     * somente o banco V2.
     */
    fields_without_recent_inspection:
      0,
  };
}