import "server-only";

import { prisma } from "@/server/db/prisma";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  buildCropStageContext,
} from "@/server/operational/crop-stage.service";

import {
  differenceInCalendarDays,
  getSaoPauloDateKey,
} from "@/server/time/sao-paulo";

import type {
  ApplicationResponseContext,
  DataQualityContext,
  FarmerSummaryContext,
  FieldObservationContext,
  FieldOperationalContext,
  HistoricalMemoryContext,
  WaterContext,
} from "@/types/analysis";

/* =========================================================
 * Constants
 * ========================================================= */

const RECENT_INSPECTION_WINDOW_DAYS =
  7;

const OPERATIONAL_CONTEXT_SAFETY_NOTE =
  "Esta leitura organiza dados operacionais do talhão e apoia o acompanhamento da propriedade. Ela não representa diagnóstico definitivo, laudo técnico ou recomendação automática de manejo.";

/* =========================================================
 * Generic helpers
 * ========================================================= */

function parseStringArray(
  value:
    | string
    | null,
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
    // Legacy/plain-text fallback below.
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

function dateKey(
  value:
    Date | null,
): string | null {
  if (!value) {
    return null;
  }

  return getSaoPauloDateKey(
    value,
  );
}

function isRecentDate(
  value:
    Date | null,
): boolean {
  const key =
    dateKey(value);

  if (!key) {
    return false;
  }

  const difference =
    differenceInCalendarDays(
      getSaoPauloDateKey(),
      key,
    );

  return (
    difference >= 0 &&
    difference <=
      RECENT_INSPECTION_WINDOW_DAYS
  );
}

/* =========================================================
 * Water context
 *
 * Nesta fase não fazemos nova chamada meteorológica.
 * O contexto hídrico usa a observação de campo persistida.
 * ========================================================= */

function buildWaterContext(
  cropStage: string,
  latestInspection: {
    soilCondition:
      string | null;

    notes:
      string;
  } | null,
  agronomicHistoryNotes:
    string | null,
): WaterContext {
  const latestSoilCondition =
    latestInspection
      ?.soilCondition ??
    null;

  const sensitiveStages =
    new Set([
      "florescimento",
      "enchimento_vagens",
      "pre_arranquio",
    ]);

  const isSensitiveStage =
    sensitiveStages.has(
      cropStage,
    );

  const notes =
    [
      agronomicHistoryNotes,
      latestInspection?.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  let status:
    WaterContext["status"];

  let mainReason:
    string;

  let farmerMessage:
    string;

  if (
    !latestSoilCondition ||
    latestSoilCondition ===
      "nao_avaliado"
  ) {
    status =
      "sem_dados";

    mainReason =
      "Sem registro recente de condição visual do solo.";

    farmerMessage =
      "Não há dados recentes de condição do solo para este talhão.";
  } else if (
    latestSoilCondition ===
      "seco" ||
    latestSoilCondition ===
      "compactado"
  ) {
    status =
      isSensitiveStage
        ? "critico"
        : "atencao";

    mainReason =
      `Última inspeção registrou solo ${latestSoilCondition === "seco" ? "seco" : "compactado"}.`;

    farmerMessage =
      isSensitiveStage
        ? "O talhão está em fase sensível e possui registro de condição hídrica desfavorável."
        : "A última inspeção registrou condição do solo que merece acompanhamento em campo.";
  } else if (
    latestSoilCondition ===
    "encharcado"
  ) {
    status =
      isSensitiveStage
        ? "critico"
        : "atencao";

    mainReason =
      "Última inspeção registrou solo encharcado.";

    farmerMessage =
      "A última inspeção registrou condição hídrica desfavorável. Acompanhar a área em campo.";
  } else if (
    latestSoilCondition ===
      "adequado" ||
    latestSoilCondition ===
      "umido"
  ) {
    status =
      "adequado";

    mainReason =
      "Última inspeção registrou condição visual do solo sem alerta hídrico.";

    farmerMessage =
      "A última inspeção registrou condição visual do solo adequada ou úmida.";
  } else {
    status =
      "sem_dados";

    mainReason =
      "Condição visual do solo não avaliada.";

    farmerMessage =
      "Não há leitura conclusiva de condição do solo para este talhão.";
  }

  if (
    status ===
      "adequado" &&
    (
      notes.includes(
        "seca",
      ) ||
      notes.includes(
        "seco",
      )
    )
  ) {
    status =
      "atencao";

    mainReason =
      "Há observações históricas relacionadas à seca ou solo seco.";

    farmerMessage =
      "Há registro textual de condição seca. Vale acompanhar a área em campo.";
  }

  const labels:
    Record<string, string> = {
      sem_dados:
        "Sem dados",

      adequado:
        "Adequado",

      atencao:
        "Atenção",

      critico:
        "Crítico",
    };

  return {
    status,

    label:
      labels[status] ??
      status,

    latest_soil_condition:
      latestSoilCondition,

    is_sensitive_stage:
      isSensitiveStage,

    main_reason:
      mainReason,

    farmer_message:
      farmerMessage,
  };
}

/* =========================================================
 * Historical memory
 * ========================================================= */

function buildHistoricalMemory(
  field: {
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
): HistoricalMemoryContext {
  const recurrentDiseases =
    parseStringArray(
      field.previousDiseases,
    );

  const pressureLevel =
    field.historicalPressure ??
    field.diseaseIncidenceLevel ??
    "sem_dados";

  const rotationAttention =
    field.cropRotation ===
      false ||
    (
      field.peanutRepetitionYears ??
      0
    ) > 0;

  const hasHistory =
    [
      field.previousCrop,
      field.cropRotation,
      field.peanutRepetitionYears,
      field.hadDiseaseIncidence,
      field.previousDiseases,
      field.diseaseIncidenceLevel,
      field.historicalPressure,
      field.agronomicHistoryNotes,
    ].some(
      (value) =>
        value !== null &&
        value !== "",
    );

  const attentionPoints:
    string[] = [];

  if (
    field.hadDiseaseIncidence ===
    true
  ) {
    attentionPoints.push(
      "Há registro de incidência anterior no talhão.",
    );
  }

  if (
    recurrentDiseases.length
  ) {
    attentionPoints.push(
      `Doenças recorrentes registradas: ${recurrentDiseases.join(", ")}`,
    );
  }

  if (
    rotationAttention
  ) {
    attentionPoints.push(
      "Histórico indica atenção à rotação de cultura.",
    );
  }

  if (
    pressureLevel ===
      "media" ||
    pressureLevel ===
      "alta"
  ) {
    attentionPoints.push(
      `Pressão histórica ${pressureLevel === "alta" ? "alta" : "média"}.`,
    );
  }

  return {
    has_history:
      hasHistory,

    pressure_level:
      pressureLevel,

    recurrent_diseases:
      recurrentDiseases,

    rotation_attention:
      rotationAttention,

    summary:
      hasHistory
        ? "Histórico operacional disponível para apoiar a leitura do talhão."
        : "Sem histórico agronômico cadastrado para este talhão.",

    attention_points:
      attentionPoints,
  };
}

/* =========================================================
 * Field observations
 * ========================================================= */

function buildFieldObservationContext(
  latestInspection: {
    inspectedAt:
      Date;

    symptomsFound:
      boolean;

    pestsFound:
      boolean | null;

    weedsFound:
      boolean | null;

    returnNeeded:
      boolean | null;
  } | null,
): FieldObservationContext {
  if (
    !latestInspection
  ) {
    return {
      has_recent_inspection:
        false,

      latest_inspection_date:
        null,

      symptoms_found:
        null,

      pests_found:
        null,

      weeds_found:
        null,

      return_needed:
        null,

      summary:
        "Sem inspeção registrada para consolidar observações de campo.",

      attention_points: [
        "Registrar nova inspeção de campo.",
      ],
    };
  }

  const hasRecentInspection =
    isRecentDate(
      latestInspection.inspectedAt,
    );

  const attentionPoints:
    string[] = [];

  if (
    latestInspection
      .symptomsFound
  ) {
    attentionPoints.push(
      "Sintomas observados na última inspeção.",
    );
  }

  if (
    latestInspection
      .pestsFound ===
    true
  ) {
    attentionPoints.push(
      "Pragas observadas na última inspeção.",
    );
  }

  if (
    latestInspection
      .weedsFound ===
    true
  ) {
    attentionPoints.push(
      "Plantas daninhas observadas na última inspeção.",
    );
  }

  if (
    latestInspection
      .returnNeeded ===
    true
  ) {
    attentionPoints.push(
      "Retorno/reinspeção indicado no registro.",
    );
  }

  return {
    has_recent_inspection:
      hasRecentInspection,

    latest_inspection_date:
      latestInspection
        .inspectedAt
        .toISOString(),

    symptoms_found:
      latestInspection
        .symptomsFound,

    pests_found:
      latestInspection
        .pestsFound,

    weeds_found:
      latestInspection
        .weedsFound,

    return_needed:
      latestInspection
        .returnNeeded,

    summary:
      hasRecentInspection
        ? "Última inspeção recente disponível para leitura operacional."
        : "Há inspeção registrada, mas ela pode não representar a condição atual do talhão.",

    attention_points:
      attentionPoints,
  };
}

/* =========================================================
 * Application response
 * ========================================================= */

function buildApplicationResponseContext(
  latestSpray: {
    applicationDate:
      Date;

    product:
      string;
  } | null,
  inspections:
    Array<{
      inspectedAt:
        Date;
    }>,
): ApplicationResponseContext {
  if (!latestSpray) {
    return {
      has_spray:
        false,

      latest_spray_date:
        null,

      latest_product:
        null,

      has_inspection_after_spray:
        false,

      status:
        "sem_aplicacao",

      farmer_message:
        "Não há aplicação registrada para avaliar resposta pós-aplicação.",
    };
  }

  const hasInspectionAfterSpray =
    inspections.some(
      (inspection) =>
        inspection
          .inspectedAt
          .getTime() >
        latestSpray
          .applicationDate
          .getTime(),
    );

  return {
    has_spray:
      true,

    latest_spray_date:
      latestSpray
        .applicationDate
        .toISOString(),

    latest_product:
      latestSpray.product,

    has_inspection_after_spray:
      hasInspectionAfterSpray,

    status:
      hasInspectionAfterSpray
        ? "verificada_por_inspecao"
        : "resposta_nao_verificada",

    farmer_message:
      hasInspectionAfterSpray
        ? "Há inspeção posterior à aplicação para apoiar o acompanhamento da resposta da área."
        : "Resposta observada ainda não verificada por inspeção posterior. Acompanhar resposta da área.",
  };
}

/* =========================================================
 * Data quality
 * ========================================================= */

function buildDataQualityContext(
  field: {
    plantingDate:
      string;
  },
  inspections:
    Array<{
      responsible:
        string | null;
    }>,
  latestInspection: {
    soilCondition:
      string | null;
  } | null,
  spraysCount: number,
  history:
    HistoricalMemoryContext,
  observation:
    FieldObservationContext,
): DataQualityContext {
  let score = 0;

  const missingItems:
    string[] = [];

  if (
    field.plantingDate
  ) {
    score += 15;
  } else {
    missingItems.push(
      "Data de plantio",
    );
  }

  if (
    latestInspection
  ) {
    score += 20;
  } else {
    missingItems.push(
      "Inspeção de campo",
    );
  }

  if (
    observation
      .has_recent_inspection
  ) {
    score += 15;
  } else {
    missingItems.push(
      "Inspeção recente",
    );
  }

  if (
    history.has_history
  ) {
    score += 15;
  } else {
    missingItems.push(
      "Histórico agronômico",
    );
  }

  if (
    latestInspection
      ?.soilCondition
  ) {
    score += 15;
  } else {
    missingItems.push(
      "Condição visual do solo",
    );
  }

  if (
    spraysCount > 0
  ) {
    score += 10;
  } else {
    missingItems.push(
      "Registro de pulverização",
    );
  }

  if (
    inspections.some(
      (inspection) =>
        Boolean(
          inspection.responsible,
        ),
    )
  ) {
    score += 10;
  } else {
    missingItems.push(
      "Responsável nas inspeções",
    );
  }

  const label =
    score >= 75
      ? "alta"
      : score >= 45
        ? "media"
        : "baixa";

  return {
    score,

    label,

    missing_items:
      missingItems,

    summary:
      label ===
        "alta"
        ? "Dados suficientes para uma boa leitura operacional."
        : "A leitura operacional pode melhorar com mais registros de campo.",
  };
}

/* =========================================================
 * Farmer summary
 * ========================================================= */

function buildFarmerSummary(
  cropStageDescription:
    string,
  water:
    WaterContext,
  history:
    HistoricalMemoryContext,
  observation:
    FieldObservationContext,
  application:
    ApplicationResponseContext,
  dataQuality:
    DataQualityContext,
): FarmerSummaryContext {
  const mainPoints:
    string[] = [
      cropStageDescription,
      water.farmer_message,
    ];

  const suggestedFollowUp:
    string[] = [];

  if (
    observation
      .attention_points
      .length
  ) {
    mainPoints.push(
      ...observation
        .attention_points
        .slice(
          0,
          2,
        ),
    );
  }

  if (
    history
      .attention_points
      .length
  ) {
    mainPoints.push(
      history
        .attention_points[0],
    );
  }

  if (
    !observation
      .has_recent_inspection
  ) {
    suggestedFollowUp.push(
      "Registrar nova inspeção de campo.",
    );
  }

  if (
    water.status ===
      "sem_dados" ||
    water.status ===
      "atencao" ||
    water.status ===
      "critico"
  ) {
    suggestedFollowUp.push(
      "Verificar condição do solo nos próximos dias.",
    );
  }

  if (
    application.status ===
    "resposta_nao_verificada"
  ) {
    suggestedFollowUp.push(
      "Acompanhar resposta da última aplicação.",
    );
  }

  if (
    dataQuality.label !==
    "alta"
  ) {
    suggestedFollowUp.push(
      "Completar histórico do talhão para aumentar a confiança da leitura.",
    );
  }

  if (
    suggestedFollowUp.length ===
    0
  ) {
    suggestedFollowUp.push(
      "Manter registros operacionais atualizados.",
    );
  }

  return {
    headline:
      "Talhão com pontos operacionais para acompanhamento.",

    main_points:
      mainPoints.slice(
        0,
        5,
      ),

    suggested_follow_up:
      suggestedFollowUp,
  };
}

/* =========================================================
 * Public service
 * ========================================================= */

export async function getFieldOperationalContext(
  fieldId: string,
): Promise<FieldOperationalContext> {
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
    inspections,
    sprays,
  ] =
    await Promise.all([
      prisma.inspection.findMany({
        where: {
          fieldId,
        },

        orderBy: {
          inspectedAt:
            "desc",
        },

        select: {
          inspectedAt:
            true,

          symptomsFound:
            true,

          pestsFound:
            true,

          weedsFound:
            true,

          returnNeeded:
            true,

          soilCondition:
            true,

          notes:
            true,

          responsible:
            true,
        },
      }),

      prisma.sprayApplication.findMany({
        where: {
          fieldId,
        },

        orderBy: {
          applicationDate:
            "desc",
        },

        select: {
          applicationDate:
            true,

          product:
            true,
        },
      }),
    ]);

  const latestInspection =
    inspections[0] ??
    null;

  const latestSpray =
    sprays[0] ??
    null;

  const cropStage =
    buildCropStageContext(
      field,
    );

  const water =
    buildWaterContext(
      cropStage.stage,
      latestInspection,
      field.agronomicHistoryNotes,
    );

  const history =
    buildHistoricalMemory(
      field,
    );

  const observation =
    buildFieldObservationContext(
      latestInspection,
    );

  const application =
    buildApplicationResponseContext(
      latestSpray,
      inspections,
    );

  const dataQuality =
    buildDataQualityContext(
      field,
      inspections,
      latestInspection,
      sprays.length,
      history,
      observation,
    );

  const farmerSummary =
    buildFarmerSummary(
      cropStage.description,
      water,
      history,
      observation,
      application,
      dataQuality,
    );

  const monitoredDiseases =
    parseStringArray(
      field.monitoredDiseases,
    );

  return {
    field: {
      id:
        field.id,

      nome:
        field.name,

      name:
        field.name,

      cidade:
        field.city,

      city:
        field.city,

      cultura:
        field.crop,

      crop:
        field.crop,

      data_plantio:
        field.plantingDate,

      planting_date:
        field.plantingDate,

      status_lavoura:
        field.cropStatus,

      crop_status:
        field.cropStatus,

      doencas_monitoradas:
        monitoredDiseases,

      monitored_diseases:
        monitoredDiseases,
    },

    crop_stage_context:
      cropStage,

    water_context:
      water,

    historical_memory:
      history,

    field_observation_context:
      observation,

    application_response_context:
      application,

    data_quality_context:
      dataQuality,

    farmer_summary:
      farmerSummary,

    generated_at:
      new Date()
        .toISOString(),

    safety_note:
      OPERATIONAL_CONTEXT_SAFETY_NOTE,
  };
}