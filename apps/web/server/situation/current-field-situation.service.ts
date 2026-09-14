import "server-only";

import { prisma } from "@/server/db/prisma";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  differenceInCalendarDays,
  getSaoPauloDateKey,
} from "@/server/time/sao-paulo";

import type {
  AnalysisResult,
  CurrentFieldSituation,
  InspectionContext,
  PriorityReason,
  SprayContext,
  SprayIntervalStatus,
} from "@/types/analysis";

/* =========================================================
 * Constants
 * ========================================================= */

const DEFAULT_PLANNED_INTERVAL_DAYS =
  12;

const PRIORITY_BLOCK_LIMITS = {
  defense: 30,
  inspection: 25,
  operational: 20,
  history: 15,
  risk: 10,
};

const RECENT_INSPECTION_WINDOW_DAYS =
  7;

const RECENT_RECORD_WINDOW_DAYS =
  14;

const SITUATION_LABELS: Record<
  string,
  string
> = {
  prioridade_maxima:
    "Prioridade máxima",

  alta_atencao:
    "Alta atenção",

  monitorar_resposta:
    "Monitorar resposta",

  monitorar:
    "Monitorar",

  estavel:
    "Estável",

  sem_prioridade_operacional:
    "Sem prioridade operacional imediata",
};

const SITUATION_ACTIONS: Record<
  string,
  string
> = {
  prioridade_maxima:
    "Verificar o talhão com prioridade e revisar o intervalo de pulverização com o responsável técnico.",

  alta_atencao:
    "Realizar inspeção de campo e acompanhar a evolução do risco nos próximos dias.",

  monitorar_resposta:
    "Manter monitoramento e registrar inspeção para acompanhar a resposta do manejo.",

  monitorar:
    "Realizar inspeção de campo e acompanhar a evolução do risco nos próximos dias.",

  estavel:
    "Manter acompanhamento de rotina.",

  sem_prioridade_operacional:
    "Talhão sem prioridade operacional imediata para manejo foliar.",
};

/* =========================================================
 * Generic helpers
 * ========================================================= */

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .toLowerCase()
    .replace(
      /[-_]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function canonicalDisease(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    normalizeText(value);

  if (
    normalized.includes(
      "mancha preta",
    )
  ) {
    return "mancha-preta";
  }

  if (
    normalized.includes(
      "mancha castanha",
    )
  ) {
    return "mancha-castanha";
  }

  return normalized;
}

function diseaseMatches(
  disease:
    | string
    | null
    | undefined,
  target:
    | string
    | null
    | undefined,
): boolean {
  const first =
    canonicalDisease(
      disease,
    );

  const second =
    canonicalDisease(
      target,
    );

  if (
    !first ||
    !second
  ) {
    return false;
  }

  return (
    first === second ||
    first.includes(second) ||
    second.includes(first)
  );
}

function formatDisplayValue(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "Não informado";
  }

  const normalized =
    normalizeText(value)
      .replaceAll(
        " ",
        "_",
      );

  const labels:
    Record<
      string,
      string
    > = {
      alta:
        "Alta",

      muito_alta:
        "Muito alta",

      media:
        "Média",

      baixa:
        "Baixa",

      nenhuma:
        "Nenhuma",

      vencida:
        "Vencida",

      sem_registro:
        "Sem registro",

      em_dia:
        "Em dia",

      atencao:
        "Atenção",

      atrasado:
        "Atrasado",

      manejo_realizado:
        "Manejo realizado",

      consultar_responsavel:
        "Consultar responsável",

      monitorar:
        "Monitorar",

      critico:
        "Crítico",

      alto:
        "Alto",

      moderado:
        "Moderado",

      baixo:
        "Baixo",

      boa:
        "Boa",

      regular:
        "Regular",

      critica:
        "Crítica",

      ausente:
        "Ausente",

      localizado:
        "Localizado",

      reboleiras:
        "Reboleiras",

      espalhado:
        "Espalhado",

      generalizado:
        "Generalizado",

      seco:
        "Seco",

      adequado:
        "Adequado",

      umido:
        "Úmido",

      encharcado:
        "Encharcado",

      compactado:
        "Compactado",

      nao_avaliado:
        "Não avaliado",
    };

  return (
    labels[normalized] ??
    value
      .replaceAll(
        "_",
        " ",
      )
  );
}

function dateKeyFromValue(
  value:
    | string
    | Date
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return getSaoPauloDateKey(
      value,
    );
  }

  const dateOnlyMatch =
    /^\d{4}-\d{2}-\d{2}/.exec(
      value,
    );

  if (dateOnlyMatch) {
    return dateOnlyMatch[0];
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return getSaoPauloDateKey(
    date,
  );
}

function daysSince(
  value:
    | string
    | Date
    | null
    | undefined,
  today: string,
): number | null {
  const date =
    dateKeyFromValue(
      value,
    );

  if (!date) {
    return null;
  }

  return differenceInCalendarDays(
    today,
    date,
  );
}

/* =========================================================
 * Risk helpers
 * ========================================================= */

function isHighRisk(
  classification:
    | string
    | null
    | undefined,
): boolean {
  const normalized =
    normalizeText(
      classification,
    ).toUpperCase();

  return (
    normalized === "ALTO" ||
    normalized === "CRITICO"
  );
}

function isModerateRisk(
  classification:
    | string
    | null
    | undefined,
): boolean {
  return (
    normalizeText(
      classification,
    ).toUpperCase() ===
    "MODERADO"
  );
}

function isLowRisk(
  classification:
    | string
    | null
    | undefined,
): boolean {
  return (
    normalizeText(
      classification,
    ).toUpperCase() ===
    "BAIXO"
  );
}

/* =========================================================
 * Priority helpers
 * ========================================================= */

function buildReason(
  code: string,
  label: string,
  impact: string,
  points: number,
  description: string,
): PriorityReason {
  return {
    code,
    label,
    impact,
    points,
    description,
  };
}

function capReasons(
  reasons:
    PriorityReason[],
  limit: number,
) {
  const total =
    reasons.reduce(
      (
        sum,
        reason,
      ) =>
        sum +
        reason.points,
      0,
    );

  if (
    total <= limit
  ) {
    return {
      points:
        total,

      reasons,
    };
  }

  let excess =
    total - limit;

  const capped =
    reasons.map(
      (reason) => ({
        ...reason,
      }),
    );

  for (
    let index =
      capped.length - 1;

    index >= 0 &&
    excess > 0;

    index -= 1
  ) {
    const reason =
      capped[index];

    const reduction =
      Math.min(
        reason.points,
        excess,
      );

    reason.points -=
      reduction;

    excess -=
      reduction;
  }

  return {
    points:
      limit,

    reasons:
      capped.filter(
        (reason) =>
          reason.points > 0,
      ),
  };
}

function priorityLabel(
  score: number,
): string {
  if (score >= 75) {
    return "Prioridade máxima";
  }

  if (score >= 50) {
    return "Alta atenção";
  }

  if (score >= 25) {
    return "Monitoramento";
  }

  return "Estável";
}

function confidenceLabel(
  score: number,
): string {
  if (score >= 75) {
    return "Alta";
  }

  if (score >= 45) {
    return "Média";
  }

  return "Baixa";
}

/* =========================================================
 * Latest analysis
 * ========================================================= */

async function getLatestAnalyses(
  fieldId: string,
): Promise<AnalysisResult[]> {
  const records =
    await prisma.analysisHistory.findMany({
      where: {
        fieldId,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  const analyses:
    AnalysisResult[] = [];

  const seenDiseases =
    new Set<string>();

  for (
    const record of
    records
  ) {
    let analysis:
      AnalysisResult;

    try {
      analysis =
        JSON.parse(
          record.resultJson,
        ) as AnalysisResult;
    } catch {
      continue;
    }

    const diseaseKey =
      canonicalDisease(
        analysis.disease,
      );

    if (
      !diseaseKey ||
      seenDiseases.has(
        diseaseKey,
      )
    ) {
      continue;
    }

    seenDiseases.add(
      diseaseKey,
    );

    analyses.push(
      analysis,
    );
  }

  return analyses.sort(
    (
      first,
      second,
    ) =>
      second.risk
        .agronomic_index -
      first.risk
        .agronomic_index,
  );
}

/* =========================================================
 * Spray context
 * ========================================================= */

function calculateIntervalStatus(
  daysSinceApplication:
    number,
  plannedIntervalDays:
    number,
): SprayIntervalStatus {
  if (
    daysSinceApplication <=
    plannedIntervalDays - 3
  ) {
    return "em_dia";
  }

  if (
    daysSinceApplication <=
    plannedIntervalDays
  ) {
    return "atencao";
  }

  return "atrasado";
}

function calculateDefense(
  daysSinceApplication:
    number | null,
  referenceDays:
    number | null,
) {
  if (
    daysSinceApplication ===
    null
  ) {
    return {
      estimatedDefensePercent:
        null,

      defenseStatus:
        "sem_registro",
    };
  }

  const interval =
    referenceDays &&
    referenceDays > 0
      ? referenceDays
      : DEFAULT_PLANNED_INTERVAL_DAYS;

  if (
    daysSinceApplication >
    interval
  ) {
    return {
      estimatedDefensePercent:
        0,

      defenseStatus:
        "vencida",
    };
  }

  const estimated =
    Math.max(
      0,
      Math.round(
        100 *
          (
            1 -
            daysSinceApplication /
              interval
          ),
      ),
    );

  let status:
    string;

  if (
    estimated >= 80
  ) {
    status =
      "muito_alta";
  } else if (
    estimated >= 60
  ) {
    status =
      "alta";
  } else if (
    estimated >= 35
  ) {
    status =
      "media";
  } else if (
    estimated >= 10
  ) {
    status =
      "baixa";
  } else {
    status =
      "vencida";
  }

  return {
    estimatedDefensePercent:
      estimated,

    defenseStatus:
      status,
  };
}

async function buildSprayContext(
  fieldId: string,
  mainDisease:
    string | null,
  today: string,
): Promise<SprayContext> {
  const sprays =
    await prisma.sprayApplication.findMany({
      where: {
        fieldId,
      },

      include: {
        productRef:
          true,
      },

      orderBy: {
        applicationDate:
          "desc",
      },
    });

  const matching =
    mainDisease
      ? sprays.find(
          (spray) =>
            diseaseMatches(
              mainDisease,
              spray.target,
            ),
        )
      : undefined;

  const spray =
    matching ??
    sprays[0];

  if (!spray) {
    return {
      has_spray_record:
        false,

      last_application_date:
        null,

      product_id:
        null,

      product:
        null,

      product_type:
        null,

      product_default_defense_days:
        null,

      defense_reference_days:
        DEFAULT_PLANNED_INTERVAL_DAYS,

      defense_reference_source:
        "fallback",

      target:
        null,

      dose:
        null,

      planned_interval_days:
        null,

      generate_reapplication:
        false,

      reapplication_date:
        null,

      days_until_reapplication:
        null,

      estimated_defense_percent:
        null,

      defense_status:
        "sem_registro",

      days_since_application:
        null,

      interval_status:
        "sem_registro",

      product_target_consistency:
        "nao_avaliado",
    };
  }

  const days =
    daysSince(
      spray.applicationDate,
      today,
    ) ?? 0;

  const plannedInterval =
    spray.plannedIntervalDays;

  const productDefault =
    spray.productRef
      ?.defaultDefenseDays ??
    null;

  const defenseReference =
    plannedInterval > 0
      ? plannedInterval
      : productDefault ??
        DEFAULT_PLANNED_INTERVAL_DAYS;

  const defenseSource =
    plannedInterval > 0
      ? "intervalo_planejado"
      : productDefault
        ? "produto"
        : "fallback";

  const intervalStatus =
    calculateIntervalStatus(
      days,
      defenseReference,
    );

  const defense =
    calculateDefense(
      days,
      defenseReference,
    );

  const reapplicationDate =
    spray.reapplicationDate;

  const daysUntilReapplication =
    reapplicationDate
      ? differenceInCalendarDays(
          reapplicationDate,
          today,
        )
      : null;

  return {
    has_spray_record:
      true,

    last_application_date:
      spray.applicationDate.toISOString(),

    product_id:
      spray.productId,

    product:
      spray.product,

    product_type:
      spray.productType ??
      spray.productRef
        ?.productType ??
      null,

    product_default_defense_days:
      productDefault,

    defense_reference_days:
      defenseReference,

    defense_reference_source:
      defenseSource,

    target:
      spray.target,

    dose:
      spray.dose,

    planned_interval_days:
      plannedInterval,

    generate_reapplication:
      spray.generateReapplication,

    reapplication_date:
      reapplicationDate,

    days_until_reapplication:
      daysUntilReapplication,

    estimated_defense_percent:
      defense.estimatedDefensePercent,

    defense_status:
      defense.defenseStatus,

    days_since_application:
      days,

    interval_status:
      intervalStatus,

    product_target_consistency:
      "nao_avaliado",
  };
}

/* =========================================================
 * Inspection context
 * ========================================================= */

async function buildInspectionContext(
  fieldId: string,
  mainDisease:
    string | null,
): Promise<InspectionContext> {
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

  const matching =
    mainDisease
      ? inspections.find(
          (inspection) =>
            diseaseMatches(
              mainDisease,
              inspection.disease,
            ),
        )
      : undefined;

  const inspection =
    matching ??
    inspections[0];

  if (!inspection) {
    return {
      has_inspection_record:
        false,

      last_inspection_date:
        null,

      inspected_at:
        null,

      disease:
        null,

      symptoms_found:
        null,

      visual_severity:
        null,

      defoliation_level:
        null,

      action_taken:
        null,

      general_status:
        null,

      problem_distribution:
        null,

      pests_found:
        null,

      pest_notes:
        null,

      weeds_found:
        null,

      weed_pressure:
        null,

      soil_condition:
        null,

      return_needed:
        null,

      return_days:
        null,

      observed_area:
        null,

      responsible:
        null,
    };
  }

  const inspectedAt =
    inspection.inspectedAt.toISOString();

  return {
    has_inspection_record:
      true,

    last_inspection_date:
      inspectedAt,

    inspected_at:
      inspectedAt,

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

    general_status:
      inspection.generalStatus as
        InspectionContext["general_status"],

    problem_distribution:
      inspection.problemDistribution as
        InspectionContext["problem_distribution"],

    pests_found:
      inspection.pestsFound,

    pest_notes:
      inspection.pestNotes,

    weeds_found:
      inspection.weedsFound,

    weed_pressure:
      inspection.weedPressure as
        InspectionContext["weed_pressure"],

    soil_condition:
      inspection.soilCondition as
        InspectionContext["soil_condition"],

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
 * Priority: defense
 * ========================================================= */

function calculateDefensePriority(
  context: SprayContext,
) {
  const reasons:
    PriorityReason[] = [];

  if (
    !context.has_spray_record
  ) {
    reasons.push(
      buildReason(
        "sem_pulverizacao_registrada",
        "Sem pulverização registrada",
        "defesa",
        24,
        "Não há registro de pulverização para estimar a janela operacional do talhão.",
      ),
    );
  } else if (
    context.defense_status ===
    "vencida"
  ) {
    reasons.push(
      buildReason(
        "defesa_vencida",
        "Defesa estimada vencida",
        "defesa",
        20,
        "A defesa estimada está fora da janela operacional planejada.",
      ),
    );
  } else if (
    context.defense_status ===
    "baixa"
  ) {
    reasons.push(
      buildReason(
        "defesa_baixa",
        "Defesa estimada baixa",
        "defesa",
        14,
        "A proteção operacional estimada está baixa e exige acompanhamento.",
      ),
    );
  } else if (
    context.defense_status ===
    "media"
  ) {
    reasons.push(
      buildReason(
        "defesa_media",
        "Defesa estimada média",
        "defesa",
        8,
        "A defesa estimada está em nível intermediário.",
      ),
    );
  }

  if (
    context.interval_status ===
    "atrasado"
  ) {
    reasons.push(
      buildReason(
        "intervalo_planejado_vencido",
        "Intervalo planejado vencido",
        "defesa",
        10,
        "O intervalo planejado desde a última aplicação foi ultrapassado.",
      ),
    );
  } else if (
    context.interval_status ===
    "atencao"
  ) {
    reasons.push(
      buildReason(
        "intervalo_proximo_vencimento",
        "Intervalo próximo do vencimento",
        "defesa",
        6,
        "O intervalo planejado está próximo do limite operacional.",
      ),
    );
  }

  return capReasons(
    reasons,
    PRIORITY_BLOCK_LIMITS
      .defense,
  );
}

/* =========================================================
 * Priority: inspection
 * ========================================================= */

function calculateInspectionPriority(
  context:
    InspectionContext,
  today: string,
) {
  const reasons:
    PriorityReason[] = [];

  const inspectionDays =
    daysSince(
      context.last_inspection_date ??
        context.inspected_at,
      today,
    );

  if (
    !context.has_inspection_record
  ) {
    reasons.push(
      buildReason(
        "nunca_inspecionado",
        "Nunca inspecionado",
        "inspecao",
        15,
        "Não há inspeção registrada para apoiar a priorização do talhão.",
      ),
    );
  } else if (
    inspectionDays !==
      null &&
    inspectionDays >
      RECENT_INSPECTION_WINDOW_DAYS
  ) {
    reasons.push(
      buildReason(
        "sem_inspecao_recente",
        "Sem inspeção recente",
        "inspecao",
        8,
        "A última inspeção está fora da janela recente de acompanhamento.",
      ),
    );
  }

  if (
    context.symptoms_found ===
    true
  ) {
    reasons.push(
      buildReason(
        "sintomas_presentes",
        "Presença de sintomas",
        "inspecao",
        6,
        "A última inspeção registrou sintomas em campo.",
      ),
    );
  }

  const statusPoints:
    Record<string, number> = {
      critica: 8,
      atencao: 5,
      regular: 2,
    };

  if (
    context.general_status
  ) {
    const points =
      statusPoints[
        context.general_status
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `status_geral_${context.general_status}`,
          "Situação geral da inspeção",
          "inspecao",
          points,
          `Situação geral registrada como ${formatDisplayValue(context.general_status)}.`,
        ),
      );
    }
  }

  const distributionPoints:
    Record<string, number> = {
      generalizado: 7,
      espalhado: 5,
      reboleiras: 3,
      localizado: 1,
    };

  if (
    context.problem_distribution
  ) {
    const points =
      distributionPoints[
        context.problem_distribution
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `distribuicao_problema_${context.problem_distribution}`,
          "Distribuição do problema observado",
          "inspecao",
          points,
          `Distribuição observada no talhão: ${formatDisplayValue(context.problem_distribution)}.`,
        ),
      );
    }
  }

  if (
    context.return_needed ===
    true
  ) {
    reasons.push(
      buildReason(
        "retorno_inspecao_necessario",
        "Retorno de inspeção necessário",
        "inspecao",
        5,
        context.return_days !==
          null &&
        context.return_days !==
          undefined
          ? `A inspeção indicou necessidade de retorno em ${context.return_days} dia(s).`
          : "A inspeção indicou necessidade de retorno ao talhão.",
      ),
    );
  }

  const severityPoints:
    Record<string, number> = {
      alta: 7,
      media: 4,
      baixa: 2,
    };

  if (
    context.visual_severity
  ) {
    const points =
      severityPoints[
        context.visual_severity
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `severidade_visual_${context.visual_severity}`,
          "Severidade visual",
          "inspecao",
          points,
          `Severidade visual registrada como ${formatDisplayValue(context.visual_severity)}.`,
        ),
      );
    }
  }

  const defoliationPoints:
    Record<string, number> = {
      alta: 5,
      media: 3,
      baixa: 1,
    };

  if (
    context.defoliation_level
  ) {
    const points =
      defoliationPoints[
        context.defoliation_level
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `desfolha_${context.defoliation_level}`,
          "Desfolha observada",
          "inspecao",
          points,
          `Desfolha registrada como ${formatDisplayValue(context.defoliation_level)}.`,
        ),
      );
    }
  }

  const result =
    capReasons(
      reasons,
      PRIORITY_BLOCK_LIMITS
        .inspection,
    );

  return {
    ...result,

    daysSinceInspection:
      inspectionDays,
  };
}

/* =========================================================
 * Priority: operational
 * ========================================================= */

function calculateOperationalPriority(
  fieldStatus: string,
  spray:
    SprayContext,
  inspection:
    InspectionContext,
  calendarEvents:
    Array<{
      date: string;
      eventType: string;
      status: string;
    }>,
  today: string,
) {
  const reasons:
    PriorityReason[] = [];

  const activeEvents =
    calendarEvents.filter(
      (event) =>
        event.status ===
          "previsto" ||
        event.status ===
          "informativo",
    );

  const overdue =
    activeEvents.filter(
      (event) =>
        event.date <
        today,
    );

  const overdueReapplications =
    overdue.filter(
      (event) =>
        event.eventType ===
        "reaplicacao_prevista",
    );

  const todayEvents =
    activeEvents.filter(
      (event) =>
        event.date ===
        today,
    );

  const alerts =
    activeEvents.filter(
      (event) =>
        event.eventType ===
          "monitoramento" ||
        event.eventType ===
          "reaplicacao_prevista",
    );

  if (overdue.length) {
    reasons.push(
      buildReason(
        "evento_calendario_vencido",
        "Evento vencido no calendário",
        "operacional",
        Math.min(
          7,
          4 +
            overdue.length,
        ),
        `${overdue.length} evento(s) previsto(s) estão vencidos.`,
      ),
    );
  }

  if (
    overdueReapplications.length
  ) {
    reasons.push(
      buildReason(
        "reaplicacao_prevista_vencida",
        "Reaplicação prevista vencida",
        "operacional",
        Math.min(
          8,
          5 +
            overdueReapplications.length,
        ),
        `${overdueReapplications.length} reaplicação(ões) prevista(s) estão vencidas.`,
      ),
    );
  }

  if (todayEvents.length) {
    reasons.push(
      buildReason(
        "evento_previsto_hoje",
        "Evento previsto para hoje",
        "operacional",
        5,
        `${todayEvents.length} evento(s) previsto(s) para hoje.`,
      ),
    );
  }

  if (alerts.length) {
    reasons.push(
      buildReason(
        "alerta_operacional_ativo",
        "Alerta operacional ativo",
        "operacional",
        Math.min(
          5,
          2 +
            alerts.length,
        ),
        `${alerts.length} alerta(s) operacional(is) ativo(s) no calendário.`,
      ),
    );
  }

  if (
    inspection.pests_found ===
    true
  ) {
    reasons.push(
      buildReason(
        "pragas_observadas",
        "Pragas observadas",
        "operacional",
        3,
        inspection.pest_notes
          ? `A inspeção registrou presença visual de pragas: ${inspection.pest_notes}.`
          : "A inspeção registrou presença visual de pragas.",
      ),
    );
  }

  if (
    inspection.weeds_found ===
    true
  ) {
    reasons.push(
      buildReason(
        "plantas_daninhas_observadas",
        "Plantas daninhas observadas",
        "operacional",
        3,
        inspection.weed_pressure
          ? `A inspeção registrou plantas daninhas com pressão ${formatDisplayValue(inspection.weed_pressure).toLowerCase()}.`
          : "A inspeção registrou presença visual de plantas daninhas.",
      ),
    );
  }

  const sprayDays =
    spray.days_since_application;

  const inspectionDays =
    daysSince(
      inspection.last_inspection_date ??
        inspection.inspected_at,
      today,
    );

  const hasRecentSpray =
    typeof sprayDays ===
      "number" &&
    sprayDays <=
      RECENT_RECORD_WINDOW_DAYS;

  const hasRecentInspection =
    typeof inspectionDays ===
      "number" &&
    inspectionDays <=
      RECENT_RECORD_WINDOW_DAYS;

  if (
    fieldStatus ===
      "em_campo" &&
    !hasRecentSpray &&
    !hasRecentInspection
  ) {
    reasons.push(
      buildReason(
        "talhao_ativo_sem_registro_recente",
        "Talhão ativo sem registro recente",
        "operacional",
        8,
        "Talhão ativo sem pulverização ou inspeção recente registrada.",
      ),
    );
  }

  const result =
    capReasons(
      reasons,
      PRIORITY_BLOCK_LIMITS
        .operational,
    );

  return {
    ...result,

    overdueEventsCount:
      overdue.length,

    overdueReapplicationsCount:
      overdueReapplications.length,

    todayEventsCount:
      todayEvents.length,

    activeAlertsCount:
      alerts.length,

    activeWithoutRecentRecord:
      result.reasons.some(
        (reason) =>
          reason.code ===
          "talhao_ativo_sem_registro_recente",
      ),
  };
}

/* =========================================================
 * Priority: history
 * ========================================================= */

function calculateHistoryPriority(
  field: {
    historicalPressure:
      string | null;

    peanutRepetitionYears:
      number | null;

    cropRotation:
      boolean | null;

    diseaseIncidenceLevel:
      string | null;

    hadDiseaseIncidence:
      boolean | null;
  },
) {
  const reasons:
    PriorityReason[] = [];

  const pressurePoints:
    Record<string, number> = {
      alta: 6,
      media: 4,
      baixa: 1,
    };

  if (
    field.historicalPressure
  ) {
    const points =
      pressurePoints[
        field.historicalPressure
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `pressao_historica_${field.historicalPressure}`,
          "Pressão histórica",
          "historico",
          points,
          `Pressão histórica informada como ${formatDisplayValue(field.historicalPressure)}.`,
        ),
      );
    }
  }

  if (
    field.peanutRepetitionYears !==
    null
  ) {
    let points =
      0;

    if (
      field.peanutRepetitionYears >=
      3
    ) {
      points = 4;
    } else if (
      field.peanutRepetitionYears ===
      2
    ) {
      points = 2;
    }

    if (points) {
      reasons.push(
        buildReason(
          "repeticao_amendoim",
          "Repetição de amendoim",
          "historico",
          points,
          `Área com ${field.peanutRepetitionYears} safra(s) recente(s) de amendoim.`,
        ),
      );
    }
  }

  if (
    field.cropRotation ===
    false
  ) {
    reasons.push(
      buildReason(
        "sem_rotacao_cultura",
        "Sem rotação de cultura",
        "historico",
        3,
        "Não há rotação de cultura informada para o talhão.",
      ),
    );
  }

  const incidencePoints:
    Record<string, number> = {
      alta: 5,
      media: 3,
      baixa: 1,
    };

  if (
    field.diseaseIncidenceLevel
  ) {
    const points =
      incidencePoints[
        field.diseaseIncidenceLevel
      ] ?? 0;

    if (points) {
      reasons.push(
        buildReason(
          `historico_problema_${field.diseaseIncidenceLevel}`,
          "Histórico recorrente de problema",
          "historico",
          points,
          `Incidência histórica informada como ${formatDisplayValue(field.diseaseIncidenceLevel)}.`,
        ),
      );
    }
  } else if (
    field.hadDiseaseIncidence ===
    true
  ) {
    reasons.push(
      buildReason(
        "historico_problema_registrado",
        "Histórico recorrente de problema",
        "historico",
        3,
        "Há registro anterior de incidência no talhão.",
      ),
    );
  }

  return capReasons(
    reasons,
    PRIORITY_BLOCK_LIMITS
      .history,
  );
}

/* =========================================================
 * Priority: risk
 * ========================================================= */

function calculateRiskPriority(
  analysis:
    AnalysisResult | null,
) {
  const reasons:
    PriorityReason[] = [];

  if (!analysis) {
    return {
      points: 0,
      reasons,
    };
  }

  const classification =
    normalizeText(
      analysis.risk
        .classification,
    ).toUpperCase();

  const classificationPoints:
    Record<string, number> = {
      CRITICO: 5,
      ALTO: 4,
      MODERADO: 2,
      BAIXO: 0,
    };

  const classificationScore =
    classificationPoints[
      classification
    ] ?? 0;

  if (
    classificationScore
  ) {
    reasons.push(
      buildReason(
        `risco_classificacao_${classification.toLowerCase()}`,
        "Classificação de risco",
        "risco",
        classificationScore,
        `Classificação de risco atual: ${formatDisplayValue(analysis.risk.classification)}.`,
      ),
    );
  }

  const agronomicIndex =
    analysis.risk
      .agronomic_index;

  let agronomicPoints =
    0;

  if (
    agronomicIndex >= 80
  ) {
    agronomicPoints = 3;
  } else if (
    agronomicIndex >= 60
  ) {
    agronomicPoints = 2;
  } else if (
    agronomicIndex >= 40
  ) {
    agronomicPoints = 1;
  }

  if (
    agronomicPoints
  ) {
    reasons.push(
      buildReason(
        "indice_agronomico_atual",
        "Risco climático/agronômico",
        "risco",
        agronomicPoints,
        `Índice agronômico atual em ${agronomicIndex}.`,
      ),
    );
  }

  if (
    analysis.risk
      .climate_index >= 80
  ) {
    reasons.push(
      buildReason(
        "indice_climatico_elevado",
        "Risco climático/agronômico",
        "risco",
        1,
        `Índice climático atual em ${analysis.risk.climate_index}.`,
      ),
    );
  }

  const stage =
    normalizeText(
      analysis.field
        .crop_stage,
    );

  if (
    [
      "critica",
      "florescimento",
      "pegamento",
      "enchimento",
    ].some(
      (term) =>
        stage.includes(
          term,
        ),
    )
  ) {
    reasons.push(
      buildReason(
        "estagio_sensivel_cultura",
        "Estágio sensível da cultura",
        "risco",
        2,
        `Estágio informado: ${analysis.field.crop_stage}.`,
      ),
    );
  }

  return capReasons(
    reasons,
    PRIORITY_BLOCK_LIMITS
      .risk,
  );
}

/* =========================================================
 * Situation
 * ========================================================= */

function determineSituation(
  cropStatus: string,
  analysis:
    AnalysisResult | null,
  spray:
    SprayContext,
  inspection:
    InspectionContext,
  priority:
    string,
): string {
  if (
    cropStatus !==
    "em_campo"
  ) {
    return "sem_prioridade_operacional";
  }

  if (!analysis) {
    if (
      priority ===
      "Prioridade máxima"
    ) {
      return "prioridade_maxima";
    }

    if (
      priority ===
      "Alta atenção"
    ) {
      return "alta_atencao";
    }

    if (
      priority ===
      "Estável"
    ) {
      return "estavel";
    }

    return "monitorar";
  }

  const risk =
    analysis.risk
      .classification;

  if (
    isHighRisk(risk) &&
    (
      spray.defense_status ===
        "vencida" ||
      spray.defense_status ===
        "sem_registro"
    )
  ) {
    return "prioridade_maxima";
  }

  if (
    isHighRisk(risk) &&
    spray.defense_status ===
      "baixa"
  ) {
    return "alta_atencao";
  }

  if (
    isHighRisk(risk) &&
    (
      spray.defense_status ===
        "alta" ||
      spray.defense_status ===
        "muito_alta"
    )
  ) {
    return "monitorar_resposta";
  }

  if (
    isModerateRisk(
      risk,
    ) &&
    inspection.symptoms_found ===
      true
  ) {
    return "monitorar";
  }

  if (
    isLowRisk(risk) &&
    spray.interval_status ===
      "em_dia"
  ) {
    return "estavel";
  }

  return "monitorar";
}

/* =========================================================
 * Public service
 * ========================================================= */

export async function getCurrentFieldSituation(
  fieldId: string,
): Promise<CurrentFieldSituation> {
  const field =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  const today =
    getSaoPauloDateKey();

  const analyses =
    await getLatestAnalyses(
      fieldId,
    );

  const mainAnalysis =
    analyses[0] ??
    null;

  const mainDisease =
    mainAnalysis?.disease ??
    null;

  const [
    spray,
    inspection,
    calendarEvents,
  ] =
    await Promise.all([
      buildSprayContext(
        fieldId,
        mainDisease,
        today,
      ),

      buildInspectionContext(
        fieldId,
        mainDisease,
      ),

      prisma.calendarEvent.findMany({
        where: {
          fieldId,
        },

        select: {
          date: true,
          eventType: true,
          status: true,
        },
      }),
    ]);

  const defensePriority =
    calculateDefensePriority(
      spray,
    );

  const inspectionPriority =
    calculateInspectionPriority(
      inspection,
      today,
    );

  const operationalPriority =
    calculateOperationalPriority(
      field.cropStatus,
      spray,
      inspection,
      calendarEvents,
      today,
    );

  const historyPriority =
    calculateHistoryPriority({
      historicalPressure:
        field.historicalPressure,

      peanutRepetitionYears:
        field.peanutRepetitionYears,

      cropRotation:
        field.cropRotation,

      diseaseIncidenceLevel:
        field.diseaseIncidenceLevel,

      hadDiseaseIncidence:
        field.hadDiseaseIncidence,
    });

  const riskPriority =
    calculateRiskPriority(
      mainAnalysis,
    );

  const blockScores = {
    defense:
      defensePriority.points,

    inspection:
      inspectionPriority.points,

    operational:
      operationalPriority.points,

    history:
      historyPriority.points,

    risk:
      riskPriority.points,
  };

  let score =
    Object.values(
      blockScores,
    ).reduce(
      (
        sum,
        value,
      ) =>
        sum + value,
      0,
    );

  score =
    Math.min(
      score,
      100,
    );

  if (
    inspection.symptoms_found ===
    true
  ) {
    score =
      Math.max(
        score,
        25,
      );
  }

  const label =
    priorityLabel(
      score,
    );

  const reasons =
    [
      ...defensePriority
        .reasons,

      ...inspectionPriority
        .reasons,

      ...operationalPriority
        .reasons,

      ...historyPriority
        .reasons,

      ...riskPriority
        .reasons,
    ].sort(
      (
        first,
        second,
      ) =>
        second.points -
        first.points,
    );

  let confidence =
    0;

  if (mainAnalysis) {
    confidence += 25;
  }

  if (
    spray.has_spray_record
  ) {
    confidence += 20;
  }

  if (
    inspection.has_inspection_record
  ) {
    confidence += 20;
  }

  if (
    calendarEvents.length
  ) {
    confidence += 10;
  }

  if (
    field.historicalPressure !==
      null ||
    field.peanutRepetitionYears !==
      null ||
    field.cropRotation !==
      null ||
    field.diseaseIncidenceLevel !==
      null ||
    field.hadDiseaseIncidence !==
      null
  ) {
    confidence += 15;
  }

  if (
    field.plantingDate &&
    field.cropStatus
  ) {
    confidence += 10;
  }

  confidence =
    Math.min(
      confidence,
      100,
    );

  const situation =
    determineSituation(
      field.cropStatus,
      mainAnalysis,
      spray,
      inspection,
      label,
    );

  const situationReasons:
    string[] = [];

  if (mainAnalysis) {
    situationReasons.push(
      `Referência de risco atual com classificação ${formatDisplayValue(mainAnalysis.risk.classification)} e índice agronômico ${mainAnalysis.risk.agronomic_index}.`,
    );
  } else {
    situationReasons.push(
      "Ainda não há análise de risco registrada para este talhão; a prioridade atual foi calculada com os dados operacionais disponíveis.",
    );
  }

  if (
    field.cropStatus !==
    "em_campo"
  ) {
    situationReasons.push(
      "Talhão fora de campo, sem prioridade operacional imediata.",
    );
  }

  if (
    spray.has_spray_record
  ) {
    situationReasons.push(
      `Defesa estimada em ${spray.estimated_defense_percent ?? 0}% com status ${formatDisplayValue(spray.defense_status).toLowerCase()}.`,
    );
  } else {
    situationReasons.push(
      "Sem pulverização registrada para apoiar a defesa estimada.",
    );
  }

  if (
    inspection.has_inspection_record
  ) {
    situationReasons.push(
      inspection.symptoms_found
        ? "Última inspeção registrada com sintomas."
        : "Última inspeção registrada sem sintomas.",
    );
  } else {
    situationReasons.push(
      "Sem inspeção registrada para confirmar sintomas em campo.",
    );
  }

  return {
    field_id:
      field.id,

    field_name:
      field.name,

    generated_at:
      new Date().toISOString(),

    current_situation:
      situation,

    situation_label:
      SITUATION_LABELS[
        situation
      ],

    summary:
      mainAnalysis
        ? `${label} do talhão, com defesa estimada ${formatDisplayValue(spray.defense_status).toLowerCase()} e classificação de risco ${formatDisplayValue(mainAnalysis.risk.classification).toLowerCase()}.`
        : `${label} do talhão com base nos registros operacionais disponíveis; ainda não há análise de risco registrada.`,

    risk_context: {
      main_disease:
        mainDisease,

      risk_classification:
        mainAnalysis?.risk
          .classification ??
        null,

      agronomic_index:
        mainAnalysis?.risk
          .agronomic_index ??
        null,

      climate_index:
        mainAnalysis?.risk
          .climate_index ??
        null,
    },

    spray_context:
      spray,

    inspection_context:
      inspection,

    recommended_next_action:
      SITUATION_ACTIONS[
        situation
      ],

    reasons:
      situationReasons,

    priority_score:
      score,

    priority_label:
      label,

    confidence_score:
      confidence,

    confidence_label:
      confidenceLabel(
        confidence,
      ),

    main_reasons:
      reasons.slice(
        0,
        8,
      ),

    metrics: {
      block_scores:
        blockScores,

      defense: {
        has_spray_record:
          spray.has_spray_record,

        defense_status:
          spray.defense_status,

        estimated_defense_percent:
          spray.estimated_defense_percent,

        interval_status:
          spray.interval_status,

        days_since_application:
          spray.days_since_application,

        planned_interval_days:
          spray.planned_interval_days,

        days_until_reapplication:
          spray.days_until_reapplication,
      },

      inspection: {
        has_inspection_record:
          inspection.has_inspection_record,

        days_since_inspection:
          inspectionPriority
            .daysSinceInspection,

        symptoms_found:
          inspection.symptoms_found,

        visual_severity:
          inspection.visual_severity,

        defoliation_level:
          inspection.defoliation_level,

        action_taken:
          inspection.action_taken,

        general_status:
          inspection.general_status,

        problem_distribution:
          inspection.problem_distribution,

        pests_found:
          inspection.pests_found,

        weed_pressure:
          inspection.weed_pressure,

        soil_condition:
          inspection.soil_condition,

        return_needed:
          inspection.return_needed,

        return_days:
          inspection.return_days,
      },

      operational: {
        overdue_events_count:
          operationalPriority
            .overdueEventsCount,

        overdue_reapplications_count:
          operationalPriority
            .overdueReapplicationsCount,

        today_events_count:
          operationalPriority
            .todayEventsCount,

        active_alerts_count:
          operationalPriority
            .activeAlertsCount,

        active_without_recent_record:
          operationalPriority
            .activeWithoutRecentRecord,
      },

      history: {
        historical_pressure:
          field.historicalPressure,

        peanut_repetition_years:
          field.peanutRepetitionYears,

        crop_rotation:
          field.cropRotation,

        disease_incidence_level:
          field.diseaseIncidenceLevel,

        had_disease_incidence:
          field.hadDiseaseIncidence,
      },

      risk: {
        main_disease:
          mainDisease,

        risk_classification:
          mainAnalysis?.risk
            .classification ??
          null,

        agronomic_index:
          mainAnalysis?.risk
            .agronomic_index ??
          null,

        climate_index:
          mainAnalysis?.risk
            .climate_index ??
          null,

        crop_stage:
          mainAnalysis?.field
            .crop_stage ??
          null,
      },

      confidence: {
        risk_data:
          mainAnalysis !== null,

        spray_data:
          spray.has_spray_record ===
          true,

        inspection_data:
          inspection.has_inspection_record ===
          true,

        calendar_data:
          calendarEvents.length >
          0,

        history_data:
          field.historicalPressure !==
            null ||
          field.peanutRepetitionYears !==
            null ||
          field.cropRotation !==
            null ||
          field.diseaseIncidenceLevel !==
            null ||
          field.hadDiseaseIncidence !==
            null,

        field_data:
          Boolean(
            field.plantingDate &&
            field.cropStatus,
          ),

        calendar_events_count:
          calendarEvents.length,
      },
    },
  };
}