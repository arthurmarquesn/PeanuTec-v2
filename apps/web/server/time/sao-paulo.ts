import "server-only";

export const SAO_PAULO_TIME_ZONE =
  "America/Sao_Paulo";

/*
 * O Brasil utiliza UTC-03 atualmente.
 *
 * Esse offset é utilizado apenas para
 * interpretar inputs datetime-local
 * enviados pela interface.
 */
const SAO_PAULO_OFFSET =
  "-03:00";

/* =========================================================
 * Date-only validation
 * ========================================================= */

export function parseIsoDate(
  value: string,
): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      "Data inválida.",
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    throw new Error(
      "Data inválida.",
    );
  }

  return value;
}

/* =========================================================
 * São Paulo date key
 * ========================================================= */

export function getSaoPauloDateKey(
  date = new Date(),
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SAO_PAULO_TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(date);

  const values =
    new Map(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  const year =
    values.get("year");

  const month =
    values.get("month");

  const day =
    values.get("day");

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Não foi possível determinar a data local.",
    );
  }

  return `${year}-${month}-${day}`;
}

/* =========================================================
 * datetime-local parser
 * ========================================================= */

export function parseSaoPauloDateTime(
  value:
    | string
    | null
    | undefined,
): Date {
  if (!value) {
    return new Date();
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return new Date();
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      normalized,
    )
  ) {
    parseIsoDate(
      normalized,
    );

    const date =
      new Date(
        `${normalized}T00:00:00${SAO_PAULO_OFFSET}`,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      throw new Error(
        "Data e horário inválidos.",
      );
    }

    return date;
  }

  const alreadyHasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      normalized,
    );

  const date =
    new Date(
      alreadyHasTimezone
        ? normalized
        : `${normalized}${SAO_PAULO_OFFSET}`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      "Data e horário inválidos.",
    );
  }

  return date;
}

/* =========================================================
 * Date arithmetic
 * ========================================================= */

export function addDaysToIsoDate(
  value: string,
  days: number,
): string {
  parseIsoDate(value);

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  date.setUTCDate(
    date.getUTCDate() +
      days,
  );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),

    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

export function differenceInCalendarDays(
  laterDate: string,
  earlierDate: string,
): number {
  parseIsoDate(
    laterDate,
  );

  parseIsoDate(
    earlierDate,
  );

  const later =
    Date.parse(
      `${laterDate}T00:00:00Z`,
    );

  const earlier =
    Date.parse(
      `${earlierDate}T00:00:00Z`,
    );

  return Math.floor(
    (later - earlier) /
      86_400_000,
  );
}