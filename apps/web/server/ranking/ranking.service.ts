import "server-only";

import { prisma } from "@/server/db/prisma";

import {
  getCurrentFieldSituation,
} from "@/server/situation/current-field-situation.service";

import type {
  AnalysisResult,
  CurrentFieldSituation,
  RankingItem,
  RankingResponse,
} from "@/types/analysis";

/* =========================================================
 * Internal types
 * ========================================================= */

type HistoricalRisk = {
  historical_risk_bonus: number;
  historical_risk_reasons: string[];
};

type RankingCandidate = {
  item: Omit<
    RankingItem,
    "rank"
  >;

  cropActive: boolean;
  managementActive: boolean;
};

/* =========================================================
 * Risk helpers
 * ========================================================= */

const RISK_CLASS_PRIORITY:
  Record<string, number> = {
    CRÍTICO: 4,
    CRITICO: 4,
    ALTO: 3,
    MODERADO: 2,
    BAIXO: 1,
  };

function normalizeRiskClassification(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .toUpperCase()
    .trim();
}

function getRiskClassPriority(
  value: string,
): number {
  return (
    RISK_CLASS_PRIORITY[
      normalizeRiskClassification(
        value,
      )
    ] ?? 0
  );
}

/* =========================================================
 * Historical bonus
 * ========================================================= */

function calculateHistoricalRisk(
  field: {
    historicalPressure:
      string | null;

    diseaseIncidenceLevel:
      string | null;

    hadDiseaseIncidence:
      boolean | null;

    peanutRepetitionYears:
      number | null;

    cropRotation:
      boolean | null;
  },
): HistoricalRisk {
  let bonus = 0;

  const reasons:
    string[] = [];

  if (
    field.historicalPressure ===
    "alta"
  ) {
    bonus += 15;

    reasons.push(
      "Pressão histórica alta da área",
    );
  } else if (
    field.historicalPressure ===
    "media"
  ) {
    bonus += 8;

    reasons.push(
      "Pressão histórica média da área",
    );
  }

  if (
    field.diseaseIncidenceLevel ===
    "alta"
  ) {
    bonus += 15;

    reasons.push(
      "Incidência histórica alta",
    );
  } else if (
    field.diseaseIncidenceLevel ===
    "media"
  ) {
    bonus += 8;

    reasons.push(
      "Incidência histórica média",
    );
  }

  if (
    field.hadDiseaseIncidence ===
    true
  ) {
    bonus += 5;

    reasons.push(
      "Incidência anterior de doença registrada",
    );
  }

  if (
    field.peanutRepetitionYears !==
    null
  ) {
    if (
      field.peanutRepetitionYears >=
      3
    ) {
      bonus += 10;

      reasons.push(
        `Repetição de amendoim por ${field.peanutRepetitionYears} safras`,
      );
    } else if (
      field.peanutRepetitionYears ===
      2
    ) {
      bonus += 5;

      reasons.push(
        "Repetição de amendoim por 2 safras",
      );
    }
  }

  if (
    field.cropRotation ===
    false
  ) {
    bonus += 5;

    reasons.push(
      "Sem rotação de cultura informada",
    );
  }

  return {
    historical_risk_bonus:
      Math.min(
        bonus,
        30,
      ),

    historical_risk_reasons:
      reasons,
  };
}

/* =========================================================
 * Legacy priority
 * ========================================================= */

function legacyPriority(
  priorityLabel: string,
  cropActive: boolean,
): string {
  if (!cropActive) {
    return "SEM PRIORIDADE OPERACIONAL IMEDIATA";
  }

  switch (
    priorityLabel
  ) {
    case "Prioridade máxima":
      return "PRIORIDADE MAXIMA";

    case "Alta atenção":
      return "ALTA PRIORIDADE";

    case "Monitoramento":
      return "MONITORAR";

    case "Estável":
      return "BAIXA PRIORIDADE";

    default:
      return priorityLabel.toUpperCase();
  }
}

/* =========================================================
 * Persisted analysis
 * ========================================================= */

async function getMainAnalysis(
  fieldId: string,
  situation:
    CurrentFieldSituation,
): Promise<AnalysisResult | null> {
  const disease =
    situation
      .risk_context
      .main_disease;

  if (!disease) {
    return null;
  }

  const record =
    await prisma.analysisHistory.findFirst({
      where: {
        fieldId,
        disease,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        resultJson:
          true,
      },
    });

  if (!record) {
    return null;
  }

  try {
    return JSON.parse(
      record.resultJson,
    ) as AnalysisResult;
  } catch {
    return null;
  }
}

/* =========================================================
 * Candidate
 * ========================================================= */

async function buildRankingCandidate(
  field: {
    id: string;
    name: string;
    city: string;
    cropStatus: string;
    manualCropStage:
      string | null;

    historicalPressure:
      string | null;

    diseaseIncidenceLevel:
      string | null;

    hadDiseaseIncidence:
      boolean | null;

    peanutRepetitionYears:
      number | null;

    cropRotation:
      boolean | null;
  },
): Promise<RankingCandidate> {
  const situation =
    await getCurrentFieldSituation(
      field.id,
    );

  const analysis =
    await getMainAnalysis(
      field.id,
      situation,
    );

  const historical =
    calculateHistoricalRisk(
      field,
    );

  const cropActive =
    field.cropStatus ===
    "em_campo";

  const agronomicIndex =
    analysis?.risk
      .agronomic_index ??
    0;

  const agronomicWithHistory =
    Math.min(
      100,
      agronomicIndex +
        historical
          .historical_risk_bonus,
    );

  const managementRelevance =
    analysis
      ?.management_relevance
      .status ??
    "SEM_ANALISE";

  const effectivePriorityScore =
    cropActive
      ? situation
          .priority_score ??
        0
      : 0;

  /*
   * CurrentFieldSituation declara
   * priority_label como opcional.
   *
   * Por isso garantimos sempre uma
   * string antes de chamar
   * legacyPriority().
   */
  const effectivePriorityLabel:
    string =
    cropActive
      ? situation
          .priority_label ??
        "Estável"
      : "Sem prioridade operacional imediata";

  const effectiveConfidenceScore =
    situation
      .confidence_score ??
    0;

  const effectiveConfidenceLabel =
    situation
      .confidence_label ??
    "Baixa";

  return {
    cropActive,

    managementActive:
      managementRelevance ===
      "ATIVA",

    item: {
      field_id:
        field.id,

      field_name:
        field.name,

      city:
        field.city,

      crop_stage:
        analysis?.field
          .crop_stage ??
        field.manualCropStage ??
        "Não informado",

      disease:
        analysis?.disease ??
        situation
          .risk_context
          .main_disease ??
        "Sem análise",

      pathogen:
        analysis?.pathogen ??
        "",

      risk_classification:
        analysis?.risk
          .classification ??
        "SEM ANÁLISE",

      climate_index:
        analysis?.risk
          .climate_index ??
        0,

      agronomic_index:
        agronomicIndex,

      agronomic_index_with_history:
        agronomicWithHistory,

      historical_risk_bonus:
        historical
          .historical_risk_bonus,

      historical_risk_reasons:
        historical
          .historical_risk_reasons,

      management_relevance:
        managementRelevance,

      priority:
        legacyPriority(
          effectivePriorityLabel,
          cropActive,
        ),

      priority_score:
        effectivePriorityScore,

      priority_label:
        effectivePriorityLabel,

      confidence_score:
        effectiveConfidenceScore,

      confidence_label:
        effectiveConfidenceLabel,

      main_reasons:
        situation
          .main_reasons ??
        [],

      metrics:
        situation.metrics,

      main_action:
        analysis
          ?.actions[0] ??
        situation
          .recommended_next_action ??
        null,

      generated_at:
        analysis
          ?.generated_at ??
        situation
          .generated_at ??
        new Date()
          .toISOString(),
    },
  };
}

/* =========================================================
 * Sort
 * ========================================================= */

function compareCandidates(
  first:
    RankingCandidate,
  second:
    RankingCandidate,
): number {
  if (
    first.cropActive !==
    second.cropActive
  ) {
    return first.cropActive
      ? -1
      : 1;
  }

  const priorityDifference =
    (second.item
      .priority_score ??
      0) -
    (first.item
      .priority_score ??
      0);

  if (
    priorityDifference !==
    0
  ) {
    return priorityDifference;
  }

  if (
    first.managementActive !==
    second.managementActive
  ) {
    return first.managementActive
      ? -1
      : 1;
  }

  const confidenceDifference =
    (second.item
      .confidence_score ??
      0) -
    (first.item
      .confidence_score ??
      0);

  if (
    confidenceDifference !==
    0
  ) {
    return confidenceDifference;
  }

  const agronomicDifference =
    (second.item
      .agronomic_index_with_history ??
      0) -
    (first.item
      .agronomic_index_with_history ??
      0);

  if (
    agronomicDifference !==
    0
  ) {
    return agronomicDifference;
  }

  const riskDifference =
    getRiskClassPriority(
      second.item
        .risk_classification,
    ) -
    getRiskClassPriority(
      first.item
        .risk_classification,
    );

  if (
    riskDifference !==
    0
  ) {
    return riskDifference;
  }

  return first.item
    .field_name.localeCompare(
      second.item
        .field_name,
      "pt-BR",
    );
}

/* =========================================================
 * Public service
 * ========================================================= */

export async function getRanking(): Promise<RankingResponse> {
  const fields =
    await prisma.field.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        cropStatus: true,
        manualCropStage:
          true,

        historicalPressure:
          true,

        diseaseIncidenceLevel:
          true,

        hadDiseaseIncidence:
          true,

        peanutRepetitionYears:
          true,

        cropRotation:
          true,
      },

      orderBy: {
        name:
          "asc",
      },
    });

  const candidates =
    await Promise.all(
      fields.map(
        buildRankingCandidate,
      ),
    );

  candidates.sort(
    compareCandidates,
  );

  const ranking:
    RankingItem[] =
    candidates.map(
      (
        candidate,
        index,
      ) => ({
        rank:
          index + 1,

        ...candidate.item,
      }),
    );

  return {
    generated_at:
      new Date()
        .toISOString(),

    total_fields:
      fields.length,

    total_items:
      ranking.length,

    ranking,
  };
}