import "server-only";

import type {
  Inspection as PrismaInspection,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import {
  buildDerivedEventId,
  getEventDefaults,
} from "@/server/calendar/calendar.service";

import {
  getSaoPauloDateKey,
  parseSaoPauloDateTime,
} from "@/server/time/sao-paulo";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import type {
  FieldInspection,
  FieldInspectionsResponse,
  InspectionAction,
  InspectionDisease,
  InspectionGeneralStatus,
  InspectionLevel,
  ProblemDistribution,
  ScopedInspectionResponse,
  SoilCondition,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class InspectionValidationError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "InspectionValidationError";
  }
}

export {
  FieldNotFoundError,
};

/* =========================================================
 * Domain constants
 * ========================================================= */

const DISEASES =
  new Set<InspectionDisease>([
    "Mancha-preta do amendoim",
    "Mancha-castanha do amendoim",
  ]);

const LEVELS =
  new Set<InspectionLevel>([
    "nenhuma",
    "baixa",
    "media",
    "alta",
  ]);

const ACTIONS =
  new Set<InspectionAction>([
    "nenhuma",
    "monitorar",
    "consultar_responsavel",
    "manejo_realizado",
  ]);

const GENERAL_STATUSES =
  new Set<InspectionGeneralStatus>([
    "boa",
    "regular",
    "atencao",
    "critica",
  ]);

const PROBLEM_DISTRIBUTIONS =
  new Set<ProblemDistribution>([
    "ausente",
    "localizado",
    "reboleiras",
    "espalhado",
    "generalizado",
  ]);

const SOIL_CONDITIONS =
  new Set<SoilCondition>([
    "seco",
    "adequado",
    "umido",
    "encharcado",
    "compactado",
    "nao_avaliado",
  ]);

/* =========================================================
 * Internal types
 * ========================================================= */

type InspectionPayload = {
  disease: InspectionDisease;

  symptoms_found: boolean;

  visual_severity: InspectionLevel;

  defoliation_level: InspectionLevel;

  action_taken: InspectionAction;

  notes: string;

  inspected_at: Date;

  general_status:
    | InspectionGeneralStatus
    | null;

  problem_distribution:
    | ProblemDistribution
    | null;

  pests_found:
    | boolean
    | null;

  pest_notes:
    | string
    | null;

  weeds_found:
    | boolean
    | null;

  weed_pressure:
    | InspectionLevel
    | null;

  soil_condition:
    | SoilCondition
    | null;

  return_needed:
    | boolean
    | null;

  return_days:
    | number
    | null;

  observed_area:
    | string
    | null;

  responsible:
    | string
    | null;
};

/* =========================================================
 * Generic parsers
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
    throw new InspectionValidationError(
      "Campo textual inválido.",
    );
  }

  return (
    value.trim() ||
    null
  );
}

function requiredBoolean(
  value: unknown,
  label: string,
): boolean {
  if (
    typeof value !==
    "boolean"
  ) {
    throw new InspectionValidationError(
      `${label} inválido.`,
    );
  }

  return value;
}

function optionalBoolean(
  value: unknown,
  label: string,
): boolean | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw new InspectionValidationError(
      `${label} inválido.`,
    );
  }

  return value;
}

/* =========================================================
 * Domain parsers
 * ========================================================= */

function parseDisease(
  value: unknown,
): InspectionDisease {
  if (
    typeof value !==
      "string" ||
    !DISEASES.has(
      value as InspectionDisease,
    )
  ) {
    throw new InspectionValidationError(
      "Doença da inspeção inválida.",
    );
  }

  return value as InspectionDisease;
}

function parseLevel(
  value: unknown,
  label: string,
): InspectionLevel {
  if (
    typeof value !==
      "string" ||
    !LEVELS.has(
      value as InspectionLevel,
    )
  ) {
    throw new InspectionValidationError(
      `${label} inválido.`,
    );
  }

  return value as InspectionLevel;
}

function parseOptionalLevel(
  value: unknown,
  label: string,
): InspectionLevel | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return parseLevel(
    value,
    label,
  );
}

function parseAction(
  value: unknown,
): InspectionAction {
  if (
    typeof value !==
      "string" ||
    !ACTIONS.has(
      value as InspectionAction,
    )
  ) {
    throw new InspectionValidationError(
      "Ação tomada inválida.",
    );
  }

  return value as InspectionAction;
}

function parseGeneralStatus(
  value: unknown,
): InspectionGeneralStatus | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    !GENERAL_STATUSES.has(
      value as InspectionGeneralStatus,
    )
  ) {
    throw new InspectionValidationError(
      "Status geral inválido.",
    );
  }

  return value as InspectionGeneralStatus;
}

function parseProblemDistribution(
  value: unknown,
): ProblemDistribution | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    !PROBLEM_DISTRIBUTIONS.has(
      value as ProblemDistribution,
    )
  ) {
    throw new InspectionValidationError(
      "Distribuição do problema inválida.",
    );
  }

  return value as ProblemDistribution;
}

function parseSoilCondition(
  value: unknown,
): SoilCondition | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    !SOIL_CONDITIONS.has(
      value as SoilCondition,
    )
  ) {
    throw new InspectionValidationError(
      "Condição do solo inválida.",
    );
  }

  return value as SoilCondition;
}

function parseReturnDays(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 365
  ) {
    throw new InspectionValidationError(
      "Prazo de retorno inválido.",
    );
  }

  return value;
}

function parseInspectionDate(
  value: unknown,
): Date {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return new Date();
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new InspectionValidationError(
      "Data da inspeção inválida.",
    );
  }

  let date: Date;

  try {
    date =
      parseSaoPauloDateTime(
        value,
      );
  } catch {
    throw new InspectionValidationError(
      "Data da inspeção inválida.",
    );
  }

  if (
    date.getTime() >
    Date.now() + 60_000
  ) {
    throw new InspectionValidationError(
      "A data da inspeção não pode ser futura.",
    );
  }

  return date;
}

/* =========================================================
 * Payload parser
 * ========================================================= */

function parseInspectionPayload(
  input: unknown,
): InspectionPayload {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new InspectionValidationError(
      "Dados da inspeção inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const returnNeeded =
    optionalBoolean(
      body.return_needed,
      "Necessidade de retorno",
    );

  const returnDays =
    parseReturnDays(
      body.return_days,
    );

  if (
    returnNeeded === true &&
    returnDays === null
  ) {
    throw new InspectionValidationError(
      "Informe em quantos dias deverá ocorrer o retorno.",
    );
  }

  return {
    disease:
      parseDisease(
        body.disease,
      ),

    symptoms_found:
      requiredBoolean(
        body.symptoms_found,
        "Indicação de sintomas",
      ),

    visual_severity:
      parseLevel(
        body.visual_severity,
        "Severidade visual",
      ),

    defoliation_level:
      parseLevel(
        body.defoliation_level,
        "Nível de desfolha",
      ),

    action_taken:
      parseAction(
        body.action_taken,
      ),

    notes:
      optionalText(
        body.notes,
      ) ?? "",

    inspected_at:
      parseInspectionDate(
        body.inspected_at,
      ),

    general_status:
      parseGeneralStatus(
        body.general_status,
      ),

    problem_distribution:
      parseProblemDistribution(
        body.problem_distribution,
      ),

    pests_found:
      optionalBoolean(
        body.pests_found,
        "Presença de pragas",
      ),

    pest_notes:
      optionalText(
        body.pest_notes,
      ),

    weeds_found:
      optionalBoolean(
        body.weeds_found,
        "Presença de plantas daninhas",
      ),

    weed_pressure:
      parseOptionalLevel(
        body.weed_pressure,
        "Pressão de plantas daninhas",
      ),

    soil_condition:
      parseSoilCondition(
        body.soil_condition,
      ),

    return_needed:
      returnNeeded,

    return_days:
      returnDays,

    observed_area:
      optionalText(
        body.observed_area,
      ),

    responsible:
      optionalText(
        body.responsible,
      ),
  };
}

/* =========================================================
 * Mapper
 * ========================================================= */

function mapInspection(
  inspection: PrismaInspection,
): FieldInspection {
  return {
    id:
      inspection.id,

    field_id:
      inspection.fieldId,

    field_name:
      inspection.fieldName,

    disease:
      inspection.disease as InspectionDisease,

    symptoms_found:
      inspection.symptomsFound,

    visual_severity:
      inspection.visualSeverity as InspectionLevel,

    defoliation_level:
      inspection.defoliationLevel as InspectionLevel,

    action_taken:
      inspection.actionTaken as InspectionAction,

    notes:
      inspection.notes,

    inspected_at:
      inspection.inspectedAt.toISOString(),

    created_at:
      inspection.createdAt.toISOString(),

    general_status:
      inspection.generalStatus as
        | InspectionGeneralStatus
        | null,

    problem_distribution:
      inspection.problemDistribution as
        | ProblemDistribution
        | null,

    pests_found:
      inspection.pestsFound,

    pest_notes:
      inspection.pestNotes,

    weeds_found:
      inspection.weedsFound,

    weed_pressure:
      inspection.weedPressure as
        | InspectionLevel
        | null,

    soil_condition:
      inspection.soilCondition as
        | SoilCondition
        | null,

    return_needed:
      inspection.returnNeeded,

    return_days:
      inspection.returnDays,

    observed_area:
      inspection.observedArea,

    responsible:
      inspection.responsible,
  };
}

/* =========================================================
 * Field validation
 * ========================================================= */

async function getActiveField(
  fieldId: string,
) {
  const field =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },

      select: {
        id: true,
        name: true,
        cropStatus: true,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  if (
    field.cropStatus !==
    "em_campo"
  ) {
    throw new InspectionValidationError(
      `Talhão não está ativo para inspeção: ${fieldId}`,
    );
  }

  return field;
}

/* =========================================================
 * Create inspection + calendar event
 * ========================================================= */

async function createInspectionRecord(
  field: {
    id: string;
    name: string;
  },
  payload: InspectionPayload,
): Promise<FieldInspection> {
  const inspection =
    await prisma.$transaction(
      async (
        transaction,
      ) => {
        const created =
          await transaction.inspection.create({
            data: {
              fieldId:
                field.id,

              fieldName:
                field.name,

              disease:
                payload.disease,

              symptomsFound:
                payload.symptoms_found,

              visualSeverity:
                payload.visual_severity,

              defoliationLevel:
                payload.defoliation_level,

              actionTaken:
                payload.action_taken,

              notes:
                payload.notes,

              inspectedAt:
                payload.inspected_at,

              generalStatus:
                payload.general_status,

              problemDistribution:
                payload.problem_distribution,

              pestsFound:
                payload.pests_found,

              pestNotes:
                payload.pest_notes,

              weedsFound:
                payload.weeds_found,

              weedPressure:
                payload.weed_pressure,

              soilCondition:
                payload.soil_condition,

              returnNeeded:
                payload.return_needed,

              returnDays:
                payload.return_days,

              observedArea:
                payload.observed_area,

              responsible:
                payload.responsible,
            },
          });

        const eventDate =
          getSaoPauloDateKey(
            created.inspectedAt,
          );

        const defaults =
          getEventDefaults(
            "inspecao",
          );

        await transaction.calendarEvent.create({
          data: {
            id:
              buildDerivedEventId(
                "inspection",
                created.id,
                "inspecao",
              ),

            eventType:
              "inspecao",

            title:
              `Inspeção - ${field.name}`,

            fieldId:
              field.id,

            fieldName:
              field.name,

            date:
              eventDate,

            endDate:
              eventDate,

            product:
              "",

            productType:
              null,

            target:
              payload.disease,

            plannedIntervalDays:
              null,

            notes:
              payload.notes,

            colorKey:
              defaults.colorKey,

            status:
              defaults.status,

            sourceType:
              "inspection",

            sourceId:
              created.id,
          },
        });

        return created;
      },
    );

  return mapInspection(
    inspection,
  );
}

/* =========================================================
 * List by field
 * ========================================================= */

export async function listFieldInspections(
  fieldId: string,
): Promise<FieldInspectionsResponse> {
  const field =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  const inspections =
    await prisma.inspection.findMany({
      where: {
        fieldId,
      },

      orderBy: {
        inspectedAt:
          "desc",
      },
    });

  return {
    field_id:
      field.id,

    field_name:
      field.name,

    total:
      inspections.length,

    inspections:
      inspections.map(
        mapInspection,
      ),
  };
}

/* =========================================================
 * Single-field inspection
 * ========================================================= */

export async function createFieldInspection(
  fieldId: string,
  input: unknown,
): Promise<FieldInspection> {
  const field =
    await getActiveField(
      fieldId,
    );

  const payload =
    parseInspectionPayload(
      input,
    );

  return createInspectionRecord(
    field,
    payload,
  );
}

/* =========================================================
 * Scoped inspection
 * ========================================================= */

export async function createScopedInspection(
  input: unknown,
): Promise<ScopedInspectionResponse> {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new InspectionValidationError(
      "Dados da inspeção inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const scope =
    body.scope;

  if (
    scope !== "selected" &&
    scope !== "all"
  ) {
    throw new InspectionValidationError(
      "Escopo da inspeção inválido.",
    );
  }

  const payload =
    parseInspectionPayload(
      body,
    );

  let fields: Array<{
    id: string;
    name: string;
  }>;

  if (
    scope === "selected"
  ) {
    if (
      !Array.isArray(
        body.field_ids,
      ) ||
      body.field_ids.length ===
        0
    ) {
      throw new InspectionValidationError(
        "Selecione ao menos um talhão.",
      );
    }

    const fieldIds =
      Array.from(
        new Set(
          body.field_ids.map(
            (value) => {
              if (
                typeof value !==
                  "string" ||
                !value.trim()
              ) {
                throw new InspectionValidationError(
                  "Identificador de talhão inválido.",
                );
              }

              return value.trim();
            },
          ),
        ),
      );

    fields = [];

    for (
      const fieldId of
      fieldIds
    ) {
      const field =
        await getActiveField(
          fieldId,
        );

      fields.push({
        id:
          field.id,

        name:
          field.name,
      });
    }
  } else {
    fields =
      await prisma.field.findMany({
        where: {
          cropStatus:
            "em_campo",
        },

        select: {
          id: true,
          name: true,
        },

        orderBy: {
          name:
            "asc",
        },
      });

    if (
      fields.length === 0
    ) {
      throw new InspectionValidationError(
        "Não existem talhões ativos para receber a inspeção.",
      );
    }
  }

  const inspections:
    FieldInspection[] = [];

  for (
    const field of
    fields
  ) {
    const inspection =
      await createInspectionRecord(
        field,
        payload,
      );

    inspections.push(
      inspection,
    );
  }

  return {
    scope,

    created_count:
      inspections.length,

    field_ids:
      inspections.map(
        (inspection) =>
          inspection.field_id,
      ),

    inspections,
  };
}
