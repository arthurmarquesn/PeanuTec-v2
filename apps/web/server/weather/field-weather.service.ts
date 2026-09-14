import "server-only";

import {
  prisma,
} from "@/server/db/prisma";

import {
  FieldNotFoundError,
} from "@/server/fields/field.service";

import {
  getWeatherSnapshot,
  type WeatherSnapshot,
} from "@/server/weather/open-meteo.service";

/* =========================================================
 * Public service
 * ========================================================= */

export async function getFieldWeatherSnapshot(
  fieldId: string,
): Promise<WeatherSnapshot> {
  const field =
    await prisma.field.findUnique({
      where: {
        id:
          fieldId,
      },

      select: {
        latitude:
          true,

        longitude:
          true,
      },
    });

  if (!field) {
    throw new FieldNotFoundError();
  }

  return getWeatherSnapshot(
    field.latitude,
    field.longitude,
  );
}