import "server-only";

import type {
  AnalysisHistory,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import {
  analyzeFieldSnapshot,
  IntelligenceServiceError,
} from "@/server/intelligence/python-intelligence";

import {
  FieldNotFoundError,
  getFieldById,
} from "@/server/fields/field.service";

import type {
  AnalysisResult,
  RegisteredFieldAnalysisResponse,
} from "@/types/analysis";

/* =========================================================
 * Exports
 * ========================================================= */

export {
  FieldNotFoundError,
  IntelligenceServiceError,
};

/* =========================================================
 * History mapper
 * ========================================================= */

function parseAnalysisResult(
  record: AnalysisHistory,
): AnalysisResult | null {
  try {
    return JSON.parse(
      record.resultJson,
    ) as AnalysisResult;
  } catch {
    return null;
  }
}

/* =========================================================
 * Save history
 * ========================================================= */

async function saveAnalysisHistory(
  fieldId: string,
  fieldName: string,
  city: string,
  analyses: AnalysisResult[],
) {
  if (
    analyses.length === 0
  ) {
    return;
  }

  await prisma.$transaction(
    analyses.map(
      (analysis) =>
        prisma.analysisHistory.create({
          data: {
            fieldId,

            fieldName,

            city,

            disease:
              analysis.disease,

            pathogen:
              analysis.pathogen,

            generatedAt:
              analysis.generated_at,

            climateRiskIndex:
              analysis.risk
                .climate_index,

            agronomicRiskIndex:
              analysis.risk
                .agronomic_index,

            classification:
              analysis.risk
                .classification,

            managementRelevance:
              analysis
                .management_relevance
                .status,

            mainAction:
              analysis.actions[0] ??
              null,

            resultJson:
              JSON.stringify(
                analysis,
              ),
          },
        }),
    ),
  );
}

/* =========================================================
 * Execute analysis
 * ========================================================= */

export async function runFieldAnalysis(
  fieldId: string,
): Promise<RegisteredFieldAnalysisResponse> {
  const field =
    await getFieldById(
      fieldId,
    );

  const analyses =
    await analyzeFieldSnapshot(
      field,
      field.doencas_monitoradas,
    );

  await saveAnalysisHistory(
    field.id,
    field.nome,
    field.cidade,
    analyses,
  );

  return {
    field_id:
      field.id,

    field_name:
      field.nome,

    city:
      field.cidade,

    total_analyses:
      analyses.length,

    analyses,
  };
}

/* =========================================================
 * Read history
 * ========================================================= */

export async function getFieldAnalysisHistory(
  fieldId: string,
): Promise<RegisteredFieldAnalysisResponse> {
  const field =
    await getFieldById(
      fieldId,
    );

  const records =
    await prisma.analysisHistory.findMany({
      where: {
        fieldId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const analyses =
    records
      .map(
        parseAnalysisResult,
      )
      .filter(
        (
          analysis,
        ): analysis is AnalysisResult =>
          analysis !== null,
      );

  return {
    field_id:
      field.id,

    field_name:
      field.nome,

    city:
      field.cidade,

    total_analyses:
      analyses.length,

    analyses,
  };
}
