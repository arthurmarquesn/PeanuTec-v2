import "server-only";

import { prisma } from "@/server/db/prisma";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  getCurrentFieldSituation,
} from "@/server/situation/current-field-situation.service";

import {
  differenceInCalendarDays,
  getSaoPauloDateKey,
} from "@/server/time/sao-paulo";

import type {
  FieldTechnicalReport,
  FieldTechnicalReportInspection,
  FieldTechnicalReportInspectionSummary,
  FieldTechnicalReportSprayApplication,
  FieldTechnicalReportSpraySummary,
  FieldTechnicalReportTimelineItem,
  RegisteredField,
  SprayIntervalStatus,
} from "@/types/analysis";

/* =========================================================
 * Constants
 * ========================================================= */

const DEFAULT_PLANNED_INTERVAL_DAYS =
  12;

const TECHNICAL_REPORT_SAFETY_NOTE =
  "Este relatório organiza dados operacionais do talhão e apoia a tomada de decisão. Ele não representa diagnóstico definitivo de doença, não recomenda defensivo e não substitui a avaliação técnica responsável.";

/* =========================================================
 * Helpers
 * ========================================================= */

function parseStringArray(
  value:
    | string
    | null
    | undefined,
): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        value,
      ) as unknown;

    if (
      Array.isArray(
        parsed,
      )
    ) {
      return parsed
        .map(
          (item) =>
            String(
              item,
            ).trim(),
        )
        .filter(Boolean);
    }
  } catch {
    // Compatibilidade com registros
    // antigos armazenados como texto.
  }

  return value
    .split(
      /[,;]/,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

function calculateSprayInterval(
  applicationDate:
    Date,
  plannedIntervalDays:
    number | null,
): {
  daysSinceApplication:
    number;

  intervalStatus:
    SprayIntervalStatus;
} {
  const today =
    getSaoPauloDateKey();

  const applicationDateKey =
    getSaoPauloDateKey(
      applicationDate,
    );

  const daysSinceApplication =
    differenceInCalendarDays(
      today,
      applicationDateKey,
    );

  const interval =
    plannedIntervalDays &&
    plannedIntervalDays > 0
      ? plannedIntervalDays
      : DEFAULT_PLANNED_INTERVAL_DAYS;

  let intervalStatus:
    SprayIntervalStatus;

  if (
    daysSinceApplication <=
    interval - 3
  ) {
    intervalStatus =
      "em_dia";
  } else if (
    daysSinceApplication <=
    interval
  ) {
    intervalStatus =
      "atencao";
  } else {
    intervalStatus =
      "atrasado";
  }

  return {
    daysSinceApplication,

    intervalStatus,
  };
}

/* =========================================================
 * Field mapping
 * ========================================================= */

function mapField(
  field: {
    id: string;
    name: string;
    city: string;

    latitude: number;
    longitude: number;

    crop: string;
    plantingDate: string;
    cropStatus: string;

    monitoredDiseases:
      string;

    previousCrop:
      string | null;

    cropRotation:
      boolean | null;

    peanutRepetitionYears:
      number | null;

    hadDiseaseIncidence:
      boolean | null;

    previousDiseases:
      string | null;

    diseaseIncidenceLevel:
      string | null;

    historicalPressure:
      string | null;

    agronomicHistoryNotes:
      string | null;
  },
): RegisteredField {
  return {
    id:
      field.id,

    nome:
      field.name,

    cidade:
      field.city,

    cultura:
      field.crop,

    data_plantio:
      field.plantingDate,

    status_lavoura:
      field.cropStatus as
        RegisteredField["status_lavoura"],

    doencas_monitoradas:
      parseStringArray(
        field.monitoredDiseases,
      ),

    latitude:
      field.latitude,

    longitude:
      field.longitude,

    previous_crop:
      field.previousCrop,

    crop_rotation:
      field.cropRotation,

    peanut_repetition_years:
      field.peanutRepetitionYears,

    had_disease_incidence:
      field.hadDiseaseIncidence,

    previous_diseases:
      parseStringArray(
        field.previousDiseases,
      ),

    disease_incidence_level:
      field.diseaseIncidenceLevel as
        RegisteredField["disease_incidence_level"],

    historical_pressure:
      field.historicalPressure as
        RegisteredField["historical_pressure"],

    agronomic_history_notes:
      field.agronomicHistoryNotes,
  };
}

/* =========================================================
 * Inspection mapping
 * ========================================================= */

function mapInspection(
  inspection: {
    id: string;

    fieldId: string;
    fieldName: string;

    disease: string;

    symptomsFound:
      boolean;

    visualSeverity:
      string;

    defoliationLevel:
      string;

    actionTaken:
      string;

    notes: string;

    inspectedAt:
      Date;

    generalStatus:
      string | null;

    problemDistribution:
      string | null;

    pestsFound:
      boolean | null;

    pestNotes:
      string | null;

    weedsFound:
      boolean | null;

    weedPressure:
      string | null;

    soilCondition:
      string | null;

    returnNeeded:
      boolean | null;

    returnDays:
      number | null;

    observedArea:
      string | null;

    responsible:
      string | null;
  },
): FieldTechnicalReportInspection {
  return {
    id:
      inspection.id,

    field_id:
      inspection.fieldId,

    field_name:
      inspection.fieldName,

    disease:
      inspection.disease,

    symptoms_found:
      inspection.symptomsFound,

    visual_severity:
      inspection.visualSeverity,

    defoliation_level:
      inspection.defoliationLevel,

    action_taken:
      inspection.actionTaken,

    notes:
      inspection.notes,

    inspected_at:
      inspection.inspectedAt
        .toISOString(),

    general_status:
      inspection.generalStatus as
        FieldTechnicalReportInspection["general_status"],

    problem_distribution:
      inspection.problemDistribution as
        FieldTechnicalReportInspection["problem_distribution"],

    pests_found:
      inspection.pestsFound,

    pest_notes:
      inspection.pestNotes,

    weeds_found:
      inspection.weedsFound,

    weed_pressure:
      inspection.weedPressure as
        FieldTechnicalReportInspection["weed_pressure"],

    soil_condition:
      inspection.soilCondition as
        FieldTechnicalReportInspection["soil_condition"],

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
 * Spray mapping
 * ========================================================= */

function mapSpray(
  spray: {
    id: string;

    fieldId: string;
    fieldName: string;

    product: string;
    target: string;
    dose: string;

    responsible: string;

    plannedIntervalDays:
      number;

    notes: string;

    applicationDate:
      Date;
  },
): FieldTechnicalReportSprayApplication {
  const interval =
    calculateSprayInterval(
      spray.applicationDate,
      spray.plannedIntervalDays,
    );

  return {
    id:
      spray.id,

    field_id:
      spray.fieldId,

    field_name:
      spray.fieldName,

    product:
      spray.product,

    target:
      spray.target,

    dose:
      spray.dose,

    responsible:
      spray.responsible,

    planned_interval_days:
      spray.plannedIntervalDays,

    notes:
      spray.notes,

    application_date:
      spray.applicationDate
        .toISOString(),

    days_since_application:
      interval
        .daysSinceApplication,

    interval_status:
      interval
        .intervalStatus,
  };
}

/* =========================================================
 * Summaries
 * ========================================================= */

function buildInspectionSummary(
  inspections:
    FieldTechnicalReportInspection[],
): FieldTechnicalReportInspectionSummary {
  const latest =
    inspections[0] ??
    null;

  return {
    total:
      inspections.length,

    latest_date:
      latest
        ?.inspected_at ??
      null,

    symptoms_found_count:
      inspections.filter(
        (inspection) =>
          inspection
            .symptoms_found ===
          true,
      ).length,

    return_needed_count:
      inspections.filter(
        (inspection) =>
          inspection
            .return_needed ===
          true,
      ).length,

    last_responsible:
      latest
        ?.responsible ??
      null,

    last_general_status:
      latest
        ?.general_status ??
      null,

    last_problem_distribution:
      latest
        ?.problem_distribution ??
      null,
  };
}

function buildSpraySummary(
  sprays:
    FieldTechnicalReportSprayApplication[],
): FieldTechnicalReportSpraySummary {
  const latest =
    sprays[0] ??
    null;

  return {
    total:
      sprays.length,

    latest_date:
      latest
        ?.application_date ??
      null,

    last_product:
      latest
        ?.product ??
      null,

    last_target:
      latest
        ?.target ??
      null,

    last_interval_status:
      latest
        ?.interval_status ??
      null,

    days_since_last_application:
      latest
        ?.days_since_application ??
      null,
  };
}

/* =========================================================
 * Timeline
 * ========================================================= */

function getTimelineTimestamp(
  value: string,
): number {
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return Date.parse(
      `${value}T00:00:00Z`,
    );
  }

  const timestamp =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return 0;
  }

  return timestamp;
}

function buildTimeline(
  field:
    RegisteredField,
  inspections:
    FieldTechnicalReportInspection[],
  sprays:
    FieldTechnicalReportSprayApplication[],
): FieldTechnicalReportTimelineItem[] {
  const timeline:
    FieldTechnicalReportTimelineItem[] = [];

  if (
    field.data_plantio
  ) {
    timeline.push({
      type:
        "planting",

      date:
        field.data_plantio,

      title:
        "Plantio registrado",

      description:
        `Plantio do talhão ${field.nome} registrado no sistema.`,

      metadata: {
        field_id:
          field.id,

        crop:
          field.cultura,

        crop_status:
          field.status_lavoura,
      },
    });
  }

  for (
    const inspection of
    inspections
  ) {
    timeline.push({
      type:
        "inspection",

      date:
        inspection
          .inspected_at,

      title:
        "Inspeção registrada",

      description:
        `Registro observacional de campo para apoiar a priorização operacional do talhão ${field.nome}.`,

      metadata: {
        inspection_id:
          inspection.id,

        disease:
          inspection.disease,

        symptoms_found:
          inspection
            .symptoms_found,

        general_status:
          inspection
            .general_status,

        problem_distribution:
          inspection
            .problem_distribution,

        return_needed:
          inspection
            .return_needed,

        responsible:
          inspection
            .responsible,
      },
    });
  }

  for (
    const spray of
    sprays
  ) {
    timeline.push({
      type:
        "spray",

      date:
        spray
          .application_date,

      title:
        "Pulverização registrada",

      description:
        `Registro operacional de pulverização informado para o talhão ${field.nome}.`,

      metadata: {
        spray_application_id:
          spray.id,

        product:
          spray.product,

        target:
          spray.target,

        planned_interval_days:
          spray
            .planned_interval_days,

        interval_status:
          spray
            .interval_status,

        responsible:
          spray
            .responsible,
      },
    });
  }

  return timeline.sort(
    (
      first,
      second,
    ) =>
      getTimelineTimestamp(
        second.date,
      ) -
      getTimelineTimestamp(
        first.date,
      ),
  );
}

/* =========================================================
 * Public service
 * ========================================================= */

export async function getFieldTechnicalReport(
  fieldId: string,
): Promise<FieldTechnicalReport> {
  const field =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  const [
    currentSituation,
    inspectionRecords,
    sprayRecords,
  ] =
    await Promise.all([
      getCurrentFieldSituation(
        field.id,
      ),

      prisma.inspection.findMany({
        where: {
          fieldId:
            field.id,
        },

        orderBy: {
          inspectedAt:
            "desc",
        },
      }),

      prisma.sprayApplication.findMany({
        where: {
          fieldId:
            field.id,
        },

        orderBy: {
          applicationDate:
            "desc",
        },
      }),
    ]);

  const mappedField =
    mapField(
      field,
    );

  const inspections =
    inspectionRecords.map(
      mapInspection,
    );

  const sprays =
    sprayRecords.map(
      mapSpray,
    );

  return {
    field:
      mappedField,

    current_situation:
      currentSituation,

    latest_inspection:
      inspections[0] ??
      null,

    latest_spray_application:
      sprays[0] ??
      null,

    inspections_summary:
      buildInspectionSummary(
        inspections,
      ),

    spray_summary:
      buildSpraySummary(
        sprays,
      ),

    timeline:
      buildTimeline(
        mappedField,
        inspections,
        sprays,
      ),

    generated_at:
      new Date()
        .toISOString(),

    safety_note:
      TECHNICAL_REPORT_SAFETY_NOTE,
  };
}