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
  CropStageContext,
  CropStageValue,
  FieldCropStageUpdateResponse,
  UpdateCropStagePayload,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class CropStageValidationError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "CropStageValidationError";
  }
}

/* =========================================================
 * Domain
 * ========================================================= */

const CROP_STAGES =
  new Set<CropStageValue>([
    "plantio",
    "emergencia_estabelecimento",
    "vegetativo",
    "florescimento",
    "enchimento_vagens",
    "pre_arranquio",
    "arranquio",
    "colheita",
    "pos_colheita",
  ]);

type CropStageField = {
  plantingDate: string;
  cropStatus: string;

  manualCropStage:
    string | null;

  cropStageUpdatedAt:
    Date | null;

  cropStageNotes:
    string | null;
};

/* =========================================================
 * Helpers
 * ========================================================= */

function calculateDaysAfterPlanting(
  plantingDate: string,
): number | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      plantingDate,
    )
  ) {
    return null;
  }

  const today =
    getSaoPauloDateKey();

  try {
    return differenceInCalendarDays(
      today,
      plantingDate,
    );
  } catch {
    return null;
  }
}

function estimateCropStageFromDays(
  daysAfterPlanting:
    number | null,
): string {
  if (
    daysAfterPlanting ===
      null ||
    daysAfterPlanting < 0
  ) {
    return "nao_informado";
  }

  if (
    daysAfterPlanting <= 7
  ) {
    return "plantio";
  }

  if (
    daysAfterPlanting <= 20
  ) {
    return "emergencia_estabelecimento";
  }

  if (
    daysAfterPlanting <= 40
  ) {
    return "vegetativo";
  }

  if (
    daysAfterPlanting <= 70
  ) {
    return "florescimento";
  }

  if (
    daysAfterPlanting <= 100
  ) {
    return "enchimento_vagens";
  }

  if (
    daysAfterPlanting <= 120
  ) {
    return "pre_arranquio";
  }

  return "arranquio";
}

function cropStageLabel(
  stage: string,
): string {
  const labels:
    Record<string, string> = {
      plantio:
        "Plantio",

      emergencia_estabelecimento:
        "Emergência e estabelecimento",

      vegetativo:
        "Vegetativo",

      florescimento:
        "Florescimento",

      enchimento_vagens:
        "Enchimento de vagens",

      pre_arranquio:
        "Pré-arranquio",

      arranquio:
        "Arranquio",

      colheita:
        "Colheita",

      pos_colheita:
        "Pós-colheita",

      nao_informado:
        "Não informado",
    };

  return (
    labels[stage] ??
    stage
      .replaceAll(
        "_",
        " ",
      )
  );
}

function cropStageDescription(
  stage: string,
): string {
  const descriptions:
    Record<string, string> = {
      plantio:
        "Talhão em fase inicial de plantio.",

      emergencia_estabelecimento:
        "Cultura em emergência e estabelecimento.",

      vegetativo:
        "Cultura em desenvolvimento vegetativo.",

      florescimento:
        "Talhão em florescimento, fase que merece acompanhamento próximo.",

      enchimento_vagens:
        "Talhão em enchimento de vagens, fase sensível para acompanhamento operacional.",

      pre_arranquio:
        "Talhão próximo do arranquio.",

      arranquio:
        "Talhão em arranquio ou já arrancado, com leitura operacional reduzida.",

      colheita:
        "Talhão em colheita.",

      pos_colheita:
        "Talhão em pós-colheita, útil para memória da propriedade.",

      nao_informado:
        "Não há dados suficientes para estimar a fase da lavoura.",
    };

  return (
    descriptions[stage] ??
    "Fase informada manualmente para apoiar a leitura operacional do talhão."
  );
}

/* =========================================================
 * Context builder
 * ========================================================= */

export function buildCropStageContext(
  field: CropStageField,
): CropStageContext {
  const statusStageMap:
    Record<string, string> = {
      pre_arranquio:
        "pre_arranquio",

      arrancado:
        "arranquio",

      colhido:
        "pos_colheita",
    };

  const daysAfterPlanting =
    calculateDaysAfterPlanting(
      field.plantingDate,
    );

  let stage: string;

  let source:
    "manual" |
    "estimated" |
    "missing";

  if (
    field.manualCropStage
  ) {
    stage =
      field.manualCropStage;

    source =
      "manual";
  } else if (
    field.cropStatus in
    statusStageMap
  ) {
    stage =
      statusStageMap[
        field.cropStatus
      ];

    /*
     * Mantemos o comportamento da V1:
     * status explícito da lavoura tem
     * precedência sobre estimativa temporal.
     */
    source =
      "manual";
  } else if (
    daysAfterPlanting ===
    null
  ) {
    stage =
      "nao_informado";

    source =
      "missing";
  } else {
    stage =
      estimateCropStageFromDays(
        daysAfterPlanting,
      );

    source =
      "estimated";
  }

  let description =
    cropStageDescription(
      stage,
    );

  if (
    source ===
      "manual" &&
    field.cropStageNotes
  ) {
    description =
      `${description} Observação: ${field.cropStageNotes}`;
  }

  return {
    stage,

    label:
      cropStageLabel(
        stage,
      ),

    source,

    days_after_planting:
      daysAfterPlanting,

    description,

    updated_at:
      field.cropStageUpdatedAt
        ?.toISOString() ??
      null,

    notes:
      field.cropStageNotes,
  };
}

/* =========================================================
 * Payload
 * ========================================================= */

function parsePayload(
  input: unknown,
): UpdateCropStagePayload {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new CropStageValidationError(
      "Dados da fase da lavoura inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  if (
    !Object.prototype.hasOwnProperty.call(
      body,
      "stage",
    )
  ) {
    throw new CropStageValidationError(
      "Informe a fase da lavoura ou null para remover a definição manual.",
    );
  }

  const stage =
    body.stage;

  if (
    stage !== null &&
    (
      typeof stage !==
        "string" ||
      !CROP_STAGES.has(
        stage as CropStageValue,
      )
    )
  ) {
    throw new CropStageValidationError(
      "Fase da lavoura inválida.",
    );
  }

  let notes:
    string | null =
    null;

  if (
    body.notes !==
      undefined &&
    body.notes !==
      null
  ) {
    if (
      typeof body.notes !==
      "string"
    ) {
      throw new CropStageValidationError(
        "Observações da fase da lavoura inválidas.",
      );
    }

    notes =
      body.notes.trim() ||
      null;
  }

  return {
    stage:
      stage as
        | CropStageValue
        | null,

    notes,
  };
}

/* =========================================================
 * Update
 * ========================================================= */

export async function updateFieldCropStage(
  fieldId: string,
  input: unknown,
): Promise<FieldCropStageUpdateResponse> {
  const payload =
    parsePayload(
      input,
    );

  const existing =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },

      select: {
        id: true,
      },
    });

  if (!existing) {
    throw new FieldNotFoundError();
  }

  const hasManualStage =
    payload.stage !==
    null;

  const field =
    await prisma.field.update({
      where: {
        id: fieldId,
      },

      data: {
        manualCropStage:
          payload.stage,

        cropStageNotes:
          hasManualStage
            ? payload.notes ??
              null
            : null,

        cropStageUpdatedAt:
          hasManualStage
            ? new Date()
            : null,
      },

      select: {
        id: true,
        plantingDate: true,
        cropStatus: true,
        manualCropStage:
          true,
        cropStageUpdatedAt:
          true,
        cropStageNotes:
          true,
      },
    });

  return {
    field_id:
      field.id,

    manual_crop_stage:
      field.manualCropStage as
        | CropStageValue
        | null,

    crop_stage_updated_at:
      field.cropStageUpdatedAt
        ?.toISOString() ??
      null,

    crop_stage_notes:
      field.cropStageNotes,

    crop_stage_context:
      buildCropStageContext(
        field,
      ),
  };
}