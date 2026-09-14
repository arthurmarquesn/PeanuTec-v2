import "server-only";

import type {
  SprayApplication as PrismaSprayApplication,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import {
  buildDerivedEventId,
  getEventDefaults,
} from "@/server/calendar/calendar.service";

import {
  addDaysToIsoDate,
  differenceInCalendarDays,
  getSaoPauloDateKey,
  parseIsoDate,
  parseSaoPauloDateTime,
} from "@/server/time/sao-paulo";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import type {
  ProductType,
  SprayApplication,
  SprayApplicationsResponse,
  SprayIntervalStatus,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class SprayValidationError extends Error {
  constructor(
    message: string,
  ) {
    super(message);

    this.name =
      "SprayValidationError";
  }
}

export {
  FieldNotFoundError,
};

/* =========================================================
 * Constants
 * ========================================================= */

const PRODUCT_TYPES =
  new Set<ProductType>([
    "fungicida",
    "inseticida",
    "acaricida",
    "herbicida",
    "outro",
  ]);

/* =========================================================
 * Internal types
 * ========================================================= */

type SprayPayload = {
  application_date:
    Date;

  product_id:
    string | null;

  product:
    string;

  product_type:
    ProductType | null;

  target:
    string;

  dose:
    string;

  responsible:
    string;

  planned_interval_days:
    number;

  notes:
    string;

  generate_reapplication:
    boolean;

  reapplication_interval_days:
    number | null;

  reapplication_date:
    string | null;

  reapplication_notes:
    string | null;
};

/* =========================================================
 * Parsers
 * ========================================================= */

function optionalText(
  value: unknown,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new SprayValidationError(
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
    throw new SprayValidationError(
      `${label} é obrigatório.`,
    );
  }

  return parsed;
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
    throw new SprayValidationError(
      "Tipo do produto inválido.",
    );
  }

  return value as ProductType;
}

function parsePositiveInteger(
  value: unknown,
  label: string,
  fallback?: number,
): number {
  const resolved =
    value === undefined ||
    value === null ||
    value === ""
      ? fallback
      : value;

  if (
    typeof resolved !==
      "number" ||
    !Number.isInteger(
      resolved,
    ) ||
    resolved <= 0
  ) {
    throw new SprayValidationError(
      `${label} deve ser um número inteiro maior que zero.`,
    );
  }

  return resolved;
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

  return parsePositiveInteger(
    value,
    label,
  );
}

function parseApplicationDate(
  value: unknown,
): Date {
  if (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    typeof value !==
      "string"
  ) {
    throw new SprayValidationError(
      "Data da aplicação inválida.",
    );
  }

  let date: Date;

  try {
    date =
      parseSaoPauloDateTime(
        typeof value ===
          "string"
          ? value
          : null,
      );
  } catch {
    throw new SprayValidationError(
      "Data da aplicação inválida.",
    );
  }

  if (
    date.getTime() >
    Date.now() + 60_000
  ) {
    throw new SprayValidationError(
      "A data da aplicação não pode ser futura.",
    );
  }

  return date;
}

function parseReapplicationDate(
  value: unknown,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new SprayValidationError(
      "Data de reaplicação inválida.",
    );
  }

  try {
    return parseIsoDate(
      value,
    );
  } catch {
    throw new SprayValidationError(
      "Data de reaplicação inválida.",
    );
  }
}

function parsePayload(
  input: unknown,
): SprayPayload {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new SprayValidationError(
      "Dados da pulverização inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const generateReapplication =
    body.generate_reapplication ===
      undefined
      ? false
      : body.generate_reapplication;

  if (
    typeof generateReapplication !==
    "boolean"
  ) {
    throw new SprayValidationError(
      "Configuração de reaplicação inválida.",
    );
  }

  const applicationDate =
    parseApplicationDate(
      body.application_date,
    );

  const plannedIntervalDays =
    parsePositiveInteger(
      body.planned_interval_days,
      "Intervalo planejado",
      12,
    );

  const reapplicationIntervalDays =
    parseOptionalPositiveInteger(
      body.reapplication_interval_days,
      "Intervalo de reaplicação",
    );

  const explicitReapplicationDate =
    parseReapplicationDate(
      body.reapplication_date,
    );

  const applicationDateKey =
    getSaoPauloDateKey(
      applicationDate,
    );

  if (
    explicitReapplicationDate &&
    explicitReapplicationDate <
      applicationDateKey
  ) {
    throw new SprayValidationError(
      "A data de reaplicação não pode ser anterior à aplicação.",
    );
  }

  if (
    generateReapplication &&
    !explicitReapplicationDate &&
    !reapplicationIntervalDays &&
    !plannedIntervalDays
  ) {
    throw new SprayValidationError(
      "Informe a data prevista ou um intervalo para gerar a reaplicação.",
    );
  }

  return {
    application_date:
      applicationDate,

    product_id:
      optionalText(
        body.product_id,
      ),

    product:
      requiredText(
        body.product,
        "Produto",
      ),

    product_type:
      parseProductType(
        body.product_type,
      ),

    target:
      requiredText(
        body.target,
        "Alvo",
      ),

    dose:
      requiredText(
        body.dose,
        "Dose",
      ),

    responsible:
      optionalText(
        body.responsible,
      ) ?? "",

    planned_interval_days:
      plannedIntervalDays,

    notes:
      optionalText(
        body.notes,
      ) ?? "",

    generate_reapplication:
      generateReapplication,

    reapplication_interval_days:
      generateReapplication
        ? reapplicationIntervalDays
        : null,

    reapplication_date:
      generateReapplication
        ? explicitReapplicationDate
        : null,

    reapplication_notes:
      generateReapplication
        ? optionalText(
            body.reapplication_notes,
          )
        : null,
  };
}

/* =========================================================
 * Interval calculation
 * ========================================================= */

function calculateInterval(
  applicationDate: Date,
  plannedIntervalDays: number,
): {
  daysSinceApplication: number;
  intervalStatus:
    SprayIntervalStatus;
} {
  const today =
    getSaoPauloDateKey();

  const application =
    getSaoPauloDateKey(
      applicationDate,
    );

  const days =
    differenceInCalendarDays(
      today,
      application,
    );

  let status:
    SprayIntervalStatus;

  if (
    days <=
    plannedIntervalDays - 3
  ) {
    status =
      "em_dia";
  } else if (
    days <=
    plannedIntervalDays
  ) {
    status =
      "atencao";
  } else {
    status =
      "atrasado";
  }

  return {
    daysSinceApplication:
      days,

    intervalStatus:
      status,
  };
}

/* =========================================================
 * Reapplication date
 * ========================================================= */

function resolveReapplicationDate(
  payload: SprayPayload,
): string | null {
  if (
    !payload.generate_reapplication
  ) {
    return null;
  }

  if (
    payload.reapplication_date
  ) {
    return payload.reapplication_date;
  }

  const intervalDays =
    payload.reapplication_interval_days ??
    payload.planned_interval_days;

  return addDaysToIsoDate(
    getSaoPauloDateKey(
      payload.application_date,
    ),
    intervalDays,
  );
}

/* =========================================================
 * Mapper
 * ========================================================= */

function mapSprayApplication(
  application:
    PrismaSprayApplication,
): SprayApplication {
  const interval =
    calculateInterval(
      application.applicationDate,
      application.plannedIntervalDays,
    );

  return {
    id:
      application.id,

    field_id:
      application.fieldId,

    field_name:
      application.fieldName,

    application_date:
      application.applicationDate.toISOString(),

    product_id:
      application.productId,

    product:
      application.product,

    product_type:
      application.productType as
        | ProductType
        | null,

    target:
      application.target,

    dose:
      application.dose,

    responsible:
      application.responsible,

    planned_interval_days:
      application.plannedIntervalDays,

    notes:
      application.notes,

    generate_reapplication:
      application.generateReapplication,

    reapplication_interval_days:
      application.reapplicationIntervalDays,

    reapplication_date:
      application.reapplicationDate,

    reapplication_notes:
      application.reapplicationNotes,

    days_since_application:
      interval.daysSinceApplication,

    interval_status:
      interval.intervalStatus,

    created_at:
      application.createdAt.toISOString(),
  };
}

/* =========================================================
 * List
 * ========================================================= */

export async function listFieldSprayApplications(
  fieldId: string,
): Promise<SprayApplicationsResponse> {
  const field =
    await prisma.field.findUnique({
      where: {
        id:
          fieldId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  const applications =
    await prisma.sprayApplication.findMany({
      where: {
        fieldId,
      },

      orderBy: {
        applicationDate:
          "desc",
      },
    });

  return {
    field_id:
      field.id,

    field_name:
      field.name,

    total:
      applications.length,

    spray_applications:
      applications.map(
        mapSprayApplication,
      ),
  };
}

/* =========================================================
 * Create
 * ========================================================= */

export async function createFieldSprayApplication(
  fieldId: string,
  input: unknown,
): Promise<SprayApplication> {
  const field =
    await prisma.field.findUnique({
      where: {
        id:
          fieldId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  const payload =
    parsePayload(input);

  let product =
    payload.product;

  let productType =
    payload.product_type;

  if (
    payload.product_id
  ) {
    const selectedProduct =
      await prisma.product.findUnique({
        where: {
          id:
            payload.product_id,
        },
      });

    if (!selectedProduct) {
      throw new SprayValidationError(
        "Produto não encontrado.",
      );
    }

    if (
      !selectedProduct.isActive
    ) {
      throw new SprayValidationError(
        "Produto inativo.",
      );
    }

    product =
      selectedProduct.name;

    productType =
      productType ??
      (selectedProduct.productType as ProductType);
  }

  const resolvedReapplicationDate =
    resolveReapplicationDate(
      payload,
    );

  const application =
    await prisma.$transaction(
      async (transaction) => {
        const created =
          await transaction.sprayApplication.create({
            data: {
              fieldId:
                field.id,

              fieldName:
                field.name,

              applicationDate:
                payload.application_date,

              productId:
                payload.product_id,

              product,

              productType,

              target:
                payload.target,

              dose:
                payload.dose,

              responsible:
                payload.responsible,

              plannedIntervalDays:
                payload.planned_interval_days,

              notes:
                payload.notes,

              generateReapplication:
                payload.generate_reapplication,

              reapplicationIntervalDays:
                payload.reapplication_interval_days,

              reapplicationDate:
                resolvedReapplicationDate,

              reapplicationNotes:
                payload.reapplication_notes,
            },
          });

        const applicationDateKey =
          getSaoPauloDateKey(
            created.applicationDate,
          );

        const sprayDefaults =
          getEventDefaults(
            "pulverizacao",
          );

        await transaction.calendarEvent.create({
          data: {
            id:
              buildDerivedEventId(
                "spray_application",
                created.id,
                "pulverizacao",
              ),

            eventType:
              "pulverizacao",

            title:
              `Pulverização - ${field.name}`,

            fieldId:
              field.id,

            fieldName:
              field.name,

            date:
              applicationDateKey,

            endDate:
              applicationDateKey,

            product,

            productType,

            target:
              payload.target,

            plannedIntervalDays:
              payload.planned_interval_days,

            notes:
              payload.notes,

            colorKey:
              sprayDefaults.colorKey,

            status:
              sprayDefaults.status,

            sourceType:
              "spray_application",

            sourceId:
              created.id,
          },
        });

        if (
          payload.generate_reapplication &&
          resolvedReapplicationDate
        ) {
          const reapplicationDefaults =
            getEventDefaults(
              "reaplicacao_prevista",
            );

          await transaction.calendarEvent.create({
            data: {
              id:
                buildDerivedEventId(
                  "spray_application",
                  created.id,
                  "reaplicacao_prevista",
                ),

              eventType:
                "reaplicacao_prevista",

              title:
                `Reaplicação prevista - ${field.name}`,

              fieldId:
                field.id,

              fieldName:
                field.name,

              date:
                resolvedReapplicationDate,

              endDate:
                resolvedReapplicationDate,

              product,

              productType,

              target:
                payload.target,

              plannedIntervalDays:
                payload.reapplication_interval_days ??
                payload.planned_interval_days,

              notes:
                payload.reapplication_notes ??
                "Evento gerado automaticamente a partir da pulverização.",

              colorKey:
                reapplicationDefaults.colorKey,

              status:
                reapplicationDefaults.status,

              sourceType:
                "spray_application",

              sourceId:
                created.id,
            },
          });
        }

        return created;
      },
    );

  return mapSprayApplication(
    application,
  );
}
