import "server-only";

import type {
  Field as PrismaField,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import {
  GeocodingError,
  geocodeCity,
} from "@/server/geocoding/open-meteo-geocoding";

import {
  SUPPORTED_DISEASE_ALIASES,
} from "@/lib/supported-diseases";

import type {
  CropStatus,
  DiseaseIncidenceLevel,
  FieldRegistrationRequest,
  HistoricalPressure,
  RegisteredField,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class FieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "FieldValidationError";
  }
}

export class FieldNotFoundError extends Error {
  constructor() {
    super("Talhão não encontrado.");
    this.name =
      "FieldNotFoundError";
  }
}

/* =========================================================
 * Constants
 * ========================================================= */

const CROP_STATUSES =
  new Set<CropStatus>([
    "em_campo",
    "pre_arranquio",
    "arrancado",
    "colhido",
  ]);

const INCIDENCE_LEVELS =
  new Set<DiseaseIncidenceLevel>([
    "nenhuma",
    "baixa",
    "media",
    "alta",
  ]);

const HISTORICAL_PRESSURES =
  new Set<HistoricalPressure>([
    "baixa",
    "media",
    "alta",
  ]);

/* =========================================================
 * Generic parsing
 * ========================================================= */

function requireText(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !==
    "string"
  ) {
    throw new FieldValidationError(
      `${label} inválido.`,
    );
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new FieldValidationError(
      `Informe ${label.toLowerCase()}.`,
    );
  }

  return trimmed;
}

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
    throw new FieldValidationError(
      "Campo textual inválido.",
    );
  }

  return (
    value.trim() ||
    null
  );
}

function optionalBoolean(
  value: unknown,
  label: string,
): boolean | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw new FieldValidationError(
      `${label} inválido.`,
    );
  }

  return value;
}

/* =========================================================
 * Domain parsing
 * ========================================================= */

function parseCropStatus(
  value: unknown,
): CropStatus {
  if (
    typeof value !==
      "string" ||
    !CROP_STATUSES.has(
      value as CropStatus,
    )
  ) {
    throw new FieldValidationError(
      "Status da lavoura inválido.",
    );
  }

  return value as CropStatus;
}

function parsePlantingDate(
  value: unknown,
): string {
  if (
    typeof value !==
    "string"
  ) {
    throw new FieldValidationError(
      "Data de plantio inválida.",
    );
  }

  const match =
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    );

  if (!match) {
    throw new FieldValidationError(
      "A data de plantio deve estar no formato AAAA-MM-DD.",
    );
  }

  const date =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new FieldValidationError(
      "Data de plantio inválida.",
    );
  }

  const today =
    new Date();

  today.setHours(
    23,
    59,
    59,
    999,
  );

  if (date > today) {
    throw new FieldValidationError(
      "A data de plantio não pode ser futura.",
    );
  }

  return value;
}

function parseDiseases(
  value: unknown,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new FieldValidationError(
      "Selecione ao menos uma doença monitorada.",
    );
  }

  const diseases =
    value.map((item) => {
      if (
        typeof item !==
        "string"
      ) {
        throw new FieldValidationError(
          "Doença monitorada inválida.",
        );
      }

      const normalized =
        item.trim();

      const canonical =
        SUPPORTED_DISEASE_ALIASES[
          normalized
        ];

      if (!canonical) {
        throw new FieldValidationError(
          `Doença não suportada: ${normalized}`,
        );
      }

      return canonical;
    });

  return Array.from(
    new Set(diseases),
  );
}

function parsePreviousDiseases(
  value: unknown,
): string | string[] | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value ===
    "string"
  ) {
    return (
      value.trim() ||
      null
    );
  }

  if (Array.isArray(value)) {
    const values =
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean);

    return values.length > 0
      ? values
      : null;
  }

  throw new FieldValidationError(
    "Histórico de doenças inválido.",
  );
}

function parseRepetitionYears(
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
    !Number.isInteger(
      value,
    ) ||
    value < 0
  ) {
    throw new FieldValidationError(
      "Os anos consecutivos com amendoim devem ser um número inteiro maior ou igual a zero.",
    );
  }

  return value;
}

function parseIncidenceLevel(
  value: unknown,
): DiseaseIncidenceLevel | null {
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
    !INCIDENCE_LEVELS.has(
      value as DiseaseIncidenceLevel,
    )
  ) {
    throw new FieldValidationError(
      "Nível de incidência inválido.",
    );
  }

  return value as DiseaseIncidenceLevel;
}

function parseHistoricalPressure(
  value: unknown,
): HistoricalPressure | null {
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
    !HISTORICAL_PRESSURES.has(
      value as HistoricalPressure,
    )
  ) {
    throw new FieldValidationError(
      "Pressão histórica inválida.",
    );
  }

  return value as HistoricalPressure;
}

/* =========================================================
 * Request parser
 * ========================================================= */

function parseFieldRequest(
  input: unknown,
): FieldRegistrationRequest {
  if (
    !input ||
    typeof input !==
      "object" ||
    Array.isArray(input)
  ) {
    throw new FieldValidationError(
      "Dados do talhão inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const crop =
    requireText(
      body.cultura,
      "Cultura",
    );

  if (crop !== "Amendoim") {
    throw new FieldValidationError(
      "A cultura deve ser Amendoim.",
    );
  }

  return {
    nome:
      requireText(
        body.nome,
        "Nome do talhão",
      ),

    cidade:
      requireText(
        body.cidade,
        "Cidade",
      ),

    cultura:
      crop,

    data_plantio:
      parsePlantingDate(
        body.data_plantio,
      ),

    status_lavoura:
      parseCropStatus(
        body.status_lavoura,
      ),

    doencas_monitoradas:
      parseDiseases(
        body.doencas_monitoradas,
      ),

    previous_crop:
      optionalText(
        body.previous_crop,
      ),

    crop_rotation:
      optionalBoolean(
        body.crop_rotation,
        "Rotação de culturas",
      ),

    peanut_repetition_years:
      parseRepetitionYears(
        body.peanut_repetition_years,
      ),

    had_disease_incidence:
      optionalBoolean(
        body.had_disease_incidence,
        "Histórico de incidência",
      ),

    previous_diseases:
      parsePreviousDiseases(
        body.previous_diseases,
      ),

    disease_incidence_level:
      parseIncidenceLevel(
        body.disease_incidence_level,
      ),

    historical_pressure:
      parseHistoricalPressure(
        body.historical_pressure,
      ),

    agronomic_history_notes:
      optionalText(
        body.agronomic_history_notes,
      ),
  };
}

/* =========================================================
 * JSON storage
 * ========================================================= */

function encodeJson(
  value: unknown,
): string {
  return JSON.stringify(value);
}

function decodeDiseases(
  value: string,
): string[] {
  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(
      parsed,
    )
      ? parsed.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
      : [];
  } catch {
    return [];
  }
}

function decodePreviousDiseases(
  value: string | null,
): string | string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      typeof parsed ===
      "string"
    ) {
      return parsed;
    }

    if (
      Array.isArray(parsed)
    ) {
      return parsed.filter(
        (
          item,
        ): item is string =>
          typeof item ===
          "string",
      );
    }

    return null;
  } catch {
    return value;
  }
}

/* =========================================================
 * Mapper
 * ========================================================= */

function mapField(
  field: PrismaField,
): RegisteredField {
  return {
    id:
      field.id,

    nome:
      field.name,

    cidade:
      field.city,

    latitude:
      field.latitude,

    longitude:
      field.longitude,

    cultura:
      field.crop,

    data_plantio:
      field.plantingDate,

    status_lavoura:
      field.cropStatus as CropStatus,

    doencas_monitoradas:
      decodeDiseases(
        field.monitoredDiseases,
      ),

    previous_crop:
      field.previousCrop,

    crop_rotation:
      field.cropRotation,

    peanut_repetition_years:
      field.peanutRepetitionYears,

    had_disease_incidence:
      field.hadDiseaseIncidence,

    previous_diseases:
      decodePreviousDiseases(
        field.previousDiseases,
      ),

    disease_incidence_level:
      field.diseaseIncidenceLevel as
        | DiseaseIncidenceLevel
        | null,

    historical_pressure:
      field.historicalPressure as
        | HistoricalPressure
        | null,

    agronomic_history_notes:
      field.agronomicHistoryNotes,
  };
}

/* =========================================================
 * Queries
 * ========================================================= */

export async function listFields(): Promise<
  RegisteredField[]
> {
  const fields =
    await prisma.field.findMany({
      orderBy: [
        {
          cropStatus:
            "asc",
        },
        {
          name: "asc",
        },
      ],
    });

  return fields.map(
    mapField,
  );
}

export async function getFieldById(
  fieldId: string,
): Promise<RegisteredField> {
  const field =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  return mapField(field);
}

/* =========================================================
 * Create
 * ========================================================= */

export async function createField(
  input: unknown,
): Promise<RegisteredField> {
  const payload =
    parseFieldRequest(input);

  let coordinates;

  try {
    coordinates =
      await geocodeCity(
        payload.cidade,
      );
  } catch (error) {
    if (
      error instanceof
      GeocodingError
    ) {
      throw new FieldValidationError(
        error.message,
      );
    }

    throw error;
  }

  const field =
    await prisma.field.create({
      data: {
        name:
          payload.nome,

        city:
          payload.cidade,

        latitude:
          coordinates.latitude,

        longitude:
          coordinates.longitude,

        crop:
          payload.cultura,

        plantingDate:
          payload.data_plantio,

        cropStatus:
          payload.status_lavoura,

        monitoredDiseases:
          encodeJson(
            payload.doencas_monitoradas,
          ),

        previousCrop:
          payload.previous_crop,

        cropRotation:
          payload.crop_rotation,

        peanutRepetitionYears:
          payload.peanut_repetition_years,

        hadDiseaseIncidence:
          payload.had_disease_incidence,

        previousDiseases:
          payload.previous_diseases ===
          null
            ? null
            : encodeJson(
                payload.previous_diseases,
              ),

        diseaseIncidenceLevel:
          payload.disease_incidence_level,

        historicalPressure:
          payload.historical_pressure,

        agronomicHistoryNotes:
          payload.agronomic_history_notes,
      },
    });

  return mapField(field);
}

/* =========================================================
 * Update
 * ========================================================= */

export async function updateField(
  fieldId: string,
  input: unknown,
): Promise<RegisteredField> {
  const current =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
    });

  if (!current) {
    throw new FieldNotFoundError();
  }

  const payload =
    parseFieldRequest(input);

  let latitude =
    current.latitude;

  let longitude =
    current.longitude;

  /*
   * Só geocodifica novamente quando
   * a cidade realmente mudou.
   */
  if (
    current.city !==
    payload.cidade
  ) {
    try {
      const coordinates =
        await geocodeCity(
          payload.cidade,
        );

      latitude =
        coordinates.latitude;

      longitude =
        coordinates.longitude;
    } catch (error) {
      if (
        error instanceof
        GeocodingError
      ) {
        throw new FieldValidationError(
          error.message,
        );
      }

      throw error;
    }
  }

  const field =
    await prisma.field.update({
      where: {
        id: fieldId,
      },

      data: {
        name:
          payload.nome,

        city:
          payload.cidade,

        latitude,
        longitude,

        crop:
          payload.cultura,

        plantingDate:
          payload.data_plantio,

        cropStatus:
          payload.status_lavoura,

        monitoredDiseases:
          encodeJson(
            payload.doencas_monitoradas,
          ),

        previousCrop:
          payload.previous_crop,

        cropRotation:
          payload.crop_rotation,

        peanutRepetitionYears:
          payload.peanut_repetition_years,

        hadDiseaseIncidence:
          payload.had_disease_incidence,

        previousDiseases:
          payload.previous_diseases ===
          null
            ? null
            : encodeJson(
                payload.previous_diseases,
              ),

        diseaseIncidenceLevel:
          payload.disease_incidence_level,

        historicalPressure:
          payload.historical_pressure,

        agronomicHistoryNotes:
          payload.agronomic_history_notes,
      },
    });

  return mapField(field);
}

/* =========================================================
 * Delete
 * ========================================================= */

export async function deleteField(
  fieldId: string,
): Promise<{
  message: string;
  id: string;
}> {
  const existing =
    await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
    });

  if (!existing) {
    throw new FieldNotFoundError();
  }

  await prisma.field.delete({
    where: {
      id: fieldId,
    },
  });

  return {
    message:
      "Talhão excluído.",
    id: fieldId,
  };
}
