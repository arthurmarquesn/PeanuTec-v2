import "server-only";

import { prisma } from "@/server/db/prisma";

import {
  listCalendarEvents,
} from "@/server/calendar/calendar.service";

import {
  getCurrentFieldSituation,
} from "@/server/situation/current-field-situation.service";

import {
  addDaysToIsoDate,
  differenceInCalendarDays,
  getSaoPauloDateKey,
} from "@/server/time/sao-paulo";

import type {
  CalendarEvent,
  CriticalField,
  CurrentFieldSituation,
  DefenseDistribution,
  FieldStatusDistribution,
  OperationalAlert,
  ProductMetric,
  SeasonMetrics,
  SeasonOverview,
  TargetMetric,
} from "@/types/analysis";

/* =========================================================
 * Constants
 * ========================================================= */

const SEASON_SITUATION_ORDER = [
  "estavel",
  "monitorar",
  "monitorar_resposta",
  "alta_atencao",
  "prioridade_maxima",
  "sem_prioridade_operacional",
];

const SEASON_DEFENSE_ORDER = [
  "muito_alta",
  "alta",
  "media",
  "baixa",
  "vencida",
  "sem_registro",
];

const SITUATION_LABELS:
  Record<string, string> = {
    estavel:
      "Estável",

    monitorar:
      "Monitorar",

    monitorar_resposta:
      "Monitorar resposta",

    alta_atencao:
      "Alta atenção",

    prioridade_maxima:
      "Prioridade máxima",

    sem_prioridade_operacional:
      "Sem prioridade operacional imediata",
  };

const LOW_OR_EXPIRED_DEFENSE_STATUSES =
  new Set([
    "baixa",
    "vencida",
    "sem_registro",
  ]);

const CRITICAL_SITUATIONS =
  new Set([
    "alta_atencao",
    "prioridade_maxima",
  ]);

const RECENT_INSPECTION_WINDOW_DAYS =
  7;

const UPCOMING_EVENT_WINDOW_DAYS =
  14;

/* =========================================================
 * Generic helpers
 * ========================================================= */

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value
      ?.trim() ??
    ""
  );
}

function incrementCounter(
  counter:
    Map<string, number>,
  key:
    string | null,
): void {
  if (!key) {
    return;
  }

  counter.set(
    key,
    (
      counter.get(key) ??
      0
    ) + 1,
  );
}

function roundTwo(
  value: number,
): number {
  return (
    Math.round(
      value * 100,
    ) / 100
  );
}

function extractDateKey(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const match =
    /^\d{4}-\d{2}-\d{2}/.exec(
      value,
    );

  return (
    match?.[0] ??
    null
  );
}

function sortCountRows<
  T extends {
    applications_count:
      number;
  },
>(
  rows: T[],
  label:
    (row: T) => string,
): T[] {
  return rows.sort(
    (
      first,
      second,
    ) => {
      const countDifference =
        second.applications_count -
        first.applications_count;

      if (
        countDifference !==
        0
      ) {
        return countDifference;
      }

      return label(
        first,
      ).localeCompare(
        label(second),
        "pt-BR",
      );
    },
  );
}

/* =========================================================
 * Season metrics
 * ========================================================= */

export async function getSeasonMetrics(): Promise<SeasonMetrics> {
  const [
    fields,
    sprays,
  ] =
    await Promise.all([
      prisma.field.findMany({
        select: {
          id: true,
          name: true,
          cropStatus: true,
        },
      }),

      prisma.sprayApplication.findMany({
        include: {
          productRef: {
            select: {
              id: true,
              name: true,
              productType:
                true,
            },
          },
        },

        orderBy: {
          applicationDate:
            "asc",
        },
      }),
    ]);

  const productCounts =
    new Map<
      string,
      number
    >();

  const productData =
    new Map<
      string,
      {
        product_id:
          string | null;

        product:
          string;

        product_type:
          string | null;
      }
    >();

  const productTypeCounts =
    new Map<
      string,
      number
    >();

  const fieldCounts =
    new Map<
      string,
      number
    >();

  const fieldNames =
    new Map<
      string,
      string
    >();

  const targetCounts =
    new Map<
      string,
      number
    >();

  const monthCounts =
    new Map<
      string,
      number
    >();

  const validIntervals:
    number[] = [];

  for (
    const field of
    fields
  ) {
    fieldNames.set(
      field.id,
      field.name,
    );
  }

  for (
    const spray of
    sprays
  ) {
    const selectedProduct =
      spray.productRef;

    const productId =
      selectedProduct?.id ??
      spray.productId ??
      null;

    const productName =
      normalizeText(
        selectedProduct?.name ??
        spray.product,
      );

    const productType =
      normalizeText(
        spray.productType ??
        selectedProduct
          ?.productType,
      ) || null;

    if (productName) {
      const productKey =
        productId
          ? `id:${productId}`
          : `name:${productName.toLowerCase()}`;

      incrementCounter(
        productCounts,
        productKey,
      );

      productData.set(
        productKey,
        {
          product_id:
            productId,

          product:
            productName,

          product_type:
            productType,
        },
      );
    }

    incrementCounter(
      productTypeCounts,
      productType,
    );

    incrementCounter(
      fieldCounts,
      spray.fieldId,
    );

    if (
      spray.fieldName
    ) {
      fieldNames.set(
        spray.fieldId,
        spray.fieldName,
      );
    }

    const target =
      normalizeText(
        spray.target,
      );

    incrementCounter(
      targetCounts,
      target || null,
    );

    const month =
      getSaoPauloDateKey(
        spray.applicationDate,
      ).slice(
        0,
        7,
      );

    incrementCounter(
      monthCounts,
      month,
    );

    if (
      spray.plannedIntervalDays >
      0
    ) {
      validIntervals.push(
        spray.plannedIntervalDays,
      );
    }
  }

  const topProducts:
    ProductMetric[] =
    Array.from(
      productCounts.entries(),
    ).map(
      (
        [
          key,
          count,
        ],
      ) => {
        const data =
          productData.get(
            key,
          );

        return {
          product_id:
            data?.product_id ??
            null,

          product:
            data?.product ??
            key,

          product_type:
            data?.product_type ??
            null,

          applications_count:
            count,
        };
      },
    );

  sortCountRows(
    topProducts,
    (item) =>
      item.product,
  );

  const productTypeDistribution =
    Array.from(
      productTypeCounts.entries(),
    ).map(
      (
        [
          productType,
          count,
        ],
      ) => ({
        product_type:
          productType,

        applications_count:
          count,
      }),
    );

  sortCountRows(
    productTypeDistribution,
    (item) =>
      item.product_type,
  );

  const topFieldsByApplications =
    Array.from(
      fieldCounts.entries(),
    ).map(
      (
        [
          fieldId,
          count,
        ],
      ) => ({
        field_id:
          fieldId,

        field_name:
          fieldNames.get(
            fieldId,
          ) ??
          fieldId,

        applications_count:
          count,
      }),
    );

  sortCountRows(
    topFieldsByApplications,
    (item) =>
      item.field_name,
  );

  const topTargets:
    TargetMetric[] =
    Array.from(
      targetCounts.entries(),
    ).map(
      (
        [
          target,
          count,
        ],
      ) => ({
        target,

        applications_count:
          count,
      }),
    );

  sortCountRows(
    topTargets,
    (item) =>
      item.target,
  );

  const sprayApplicationsByMonth =
    Array.from(
      monthCounts.entries(),
    )
      .sort(
        (
          first,
          second,
        ) =>
          first[0].localeCompare(
            second[0],
          ),
      )
      .map(
        (
          [
            month,
            count,
          ],
        ) => ({
          month,

          applications_count:
            count,
        }),
      );

  const averageInterval =
    validIntervals.length >
    0
      ? roundTwo(
          validIntervals.reduce(
            (
              sum,
              interval,
            ) =>
              sum +
              interval,
            0,
          ) /
            validIntervals.length,
        )
      : 0;

  return {
    summary: {
      total_fields:
        fields.length,

      active_fields:
        fields.filter(
          (field) =>
            field.cropStatus ===
            "em_campo",
        ).length,

      total_spray_applications:
        sprays.length,

      total_products_used:
        productCounts.size,

      average_planned_interval_days:
        averageInterval,
    },

    top_products:
      topProducts,

    product_type_distribution:
      productTypeDistribution,

    top_fields_by_applications:
      topFieldsByApplications,

    top_targets:
      topTargets,

    spray_applications_by_month:
      sprayApplicationsByMonth,
  };
}

/* =========================================================
 * Situation distribution
 * ========================================================= */

function buildStatusDistribution(
  situations:
    CurrentFieldSituation[],
): FieldStatusDistribution[] {
  const counter =
    new Map<
      string,
      number
    >();

  for (
    const situation of
    situations
  ) {
    incrementCounter(
      counter,
      situation.current_situation,
    );
  }

  const rows:
    FieldStatusDistribution[] = [];

  for (
    const status of
    SEASON_SITUATION_ORDER
  ) {
    const count =
      counter.get(
        status,
      ) ?? 0;

    if (
      count === 0
    ) {
      continue;
    }

    rows.push({
      current_situation:
        status,

      situation_label:
        SITUATION_LABELS[
          status
        ] ??
        status,

      fields_count:
        count,
    });

    counter.delete(
      status,
    );
  }

  const remaining =
    Array.from(
      counter.entries(),
    ).sort(
      (
        first,
        second,
      ) =>
        first[0].localeCompare(
          second[0],
          "pt-BR",
        ),
    );

  for (
    const [
      status,
      count,
    ] of remaining
  ) {
    if (
      count <= 0
    ) {
      continue;
    }

    rows.push({
      current_situation:
        status,

      situation_label:
        SITUATION_LABELS[
          status
        ] ??
        status,

      fields_count:
        count,
    });
  }

  return rows;
}

/* =========================================================
 * Defense distribution
 * ========================================================= */

function buildDefenseDistribution(
  situations:
    CurrentFieldSituation[],
): DefenseDistribution[] {
  const counter =
    new Map<
      string,
      number
    >();

  for (
    const situation of
    situations
  ) {
    const status =
      situation
        .spray_context
        .defense_status;

    if (status) {
      incrementCounter(
        counter,
        status,
      );
    }
  }

  const rows:
    DefenseDistribution[] = [];

  for (
    const status of
    SEASON_DEFENSE_ORDER
  ) {
    const count =
      counter.get(
        status,
      ) ?? 0;

    if (
      count === 0
    ) {
      continue;
    }

    rows.push({
      defense_status:
        status,

      fields_count:
        count,
    });

    counter.delete(
      status,
    );
  }

  const remaining =
    Array.from(
      counter.entries(),
    ).sort(
      (
        first,
        second,
      ) =>
        first[0].localeCompare(
          second[0],
          "pt-BR",
        ),
    );

  for (
    const [
      status,
      count,
    ] of remaining
  ) {
    if (
      count <= 0
    ) {
      continue;
    }

    rows.push({
      defense_status:
        status,

      fields_count:
        count,
    });
  }

  return rows;
}

/* =========================================================
 * Recent inspection
 * ========================================================= */

function hasRecentInspection(
  situation:
    CurrentFieldSituation,
  today: string,
): boolean {
  const date =
    extractDateKey(
      situation
        .inspection_context
        .last_inspection_date ??
      situation
        .inspection_context
        .inspected_at,
    );

  if (!date) {
    return false;
  }

  const difference =
    differenceInCalendarDays(
      today,
      date,
    );

  return (
    difference >= 0 &&
    difference <=
      RECENT_INSPECTION_WINDOW_DAYS
  );
}

/* =========================================================
 * Critical fields
 * ========================================================= */

function buildCriticalFields(
  situations:
    CurrentFieldSituation[],
): CriticalField[] {
  const fields =
    situations
      .filter(
        (situation) =>
          CRITICAL_SITUATIONS.has(
            situation.current_situation,
          ),
      )
      .map(
        (
          situation,
        ): CriticalField => ({
          field_id:
            situation.field_id,

          field_name:
            situation.field_name,

          current_situation:
            situation.current_situation,

          situation_label:
            situation.situation_label,

          main_disease:
            situation
              .risk_context
              .main_disease,

          agronomic_index:
            situation
              .risk_context
              .agronomic_index,

          estimated_defense_percent:
            situation
              .spray_context
              .estimated_defense_percent,

          defense_status:
            situation
              .spray_context
              .defense_status,

          recommended_next_action:
            situation
              .recommended_next_action,
        }),
      );

  fields.sort(
    (
      first,
      second,
    ) => {
      if (
        first.current_situation !==
        second.current_situation
      ) {
        if (
          first.current_situation ===
          "prioridade_maxima"
        ) {
          return -1;
        }

        if (
          second.current_situation ===
          "prioridade_maxima"
        ) {
          return 1;
        }
      }

      const agronomicDifference =
        (
          second.agronomic_index ??
          0
        ) -
        (
          first.agronomic_index ??
          0
        );

      if (
        agronomicDifference !==
        0
      ) {
        return agronomicDifference;
      }

      return first.field_name.localeCompare(
        second.field_name,
        "pt-BR",
      );
    },
  );

  return fields;
}

/* =========================================================
 * Operational alerts
 * ========================================================= */

function buildFieldOperationalAlerts(
  situation:
    CurrentFieldSituation,
  today: string,
): OperationalAlert[] {
  const alerts:
    OperationalAlert[] = [];

  const fieldId =
    situation.field_id;

  const fieldName =
    situation.field_name;

  const defenseStatus =
    situation
      .spray_context
      .defense_status;

  if (
    situation.current_situation ===
    "prioridade_maxima"
  ) {
    alerts.push({
      type:
        "prioridade_maxima",

      severity:
        "alta",

      title:
        "Talhão em prioridade máxima",

      description:
        "A situação atual indica necessidade de verificação operacional.",

      field_id:
        fieldId,

      field_name:
        fieldName,
    });
  }

  if (
    defenseStatus ===
    "vencida"
  ) {
    alerts.push({
      type:
        "defesa_vencida",

      severity:
        "alta",

      title:
        "Defesa estimada vencida",

      description:
        "A última pulverização registrada está fora da janela operacional estimada.",

      field_id:
        fieldId,

      field_name:
        fieldName,
    });
  } else if (
    defenseStatus ===
    "baixa"
  ) {
    alerts.push({
      type:
        "defesa_baixa",

      severity:
        "media",

      title:
        "Defesa estimada baixa",

      description:
        "A defesa fitossanitária estimada está em nível baixo para acompanhamento.",

      field_id:
        fieldId,

      field_name:
        fieldName,
    });
  } else if (
    defenseStatus ===
    "sem_registro"
  ) {
    alerts.push({
      type:
        "sem_pulverizacao",

      severity:
        "media",

      title:
        "Sem pulverização registrada",

      description:
        "Não há pulverização registrada para apoiar a leitura operacional do talhão.",

      field_id:
        fieldId,

      field_name:
        fieldName,
    });
  }

  if (
    !hasRecentInspection(
      situation,
      today,
    )
  ) {
    alerts.push({
      type:
        "sem_inspecao_recente",

      severity:
        "media",

      title:
        "Sem inspeção recente",

      description:
        "Não há inspeção recente registrada para confirmar sintomas em campo.",

      field_id:
        fieldId,

      field_name:
        fieldName,
    });
  }

  return alerts;
}

/* =========================================================
 * Calendar alerts
 * ========================================================= */

function buildCalendarAlerts(
  events:
    CalendarEvent[],
  today: string,
): OperationalAlert[] {
  const alerts:
    OperationalAlert[] = [];

  for (
    const event of
    events
  ) {
    if (
      event.event_type !==
      "reaplicacao_prevista"
    ) {
      continue;
    }

    const daysUntilEvent =
      differenceInCalendarDays(
        event.date,
        today,
      );

    if (
      daysUntilEvent < 0 ||
      daysUntilEvent > 7
    ) {
      continue;
    }

    alerts.push({
      type:
        "reaplicacao_proxima",

      severity:
        daysUntilEvent <= 1
          ? "alta"
          : "media",

      title:
        "Reaplicação prevista próxima",

      description:
        `${event.title} prevista para ${event.date}.`,

      ...(event.field_id
        ? {
            field_id:
              event.field_id,
          }
        : {}),

      ...(event.field_name
        ? {
            field_name:
              event.field_name,
          }
        : {}),
    });
  }

  return alerts;
}

function sortOperationalAlerts(
  alerts:
    OperationalAlert[],
): OperationalAlert[] {
  const severityOrder:
    Record<string, number> = {
      alta: 3,
      media: 2,
      baixa: 1,
    };

  return alerts.sort(
    (
      first,
      second,
    ) => {
      const difference =
        (
          severityOrder[
            second.severity
          ] ?? 0
        ) -
        (
          severityOrder[
            first.severity
          ] ?? 0
        );

      if (
        difference !==
        0
      ) {
        return difference;
      }

      return first.title.localeCompare(
        second.title,
        "pt-BR",
      );
    },
  );
}

/* =========================================================
 * Season overview
 * ========================================================= */

export async function getSeasonOverview(): Promise<SeasonOverview> {
  const fields =
    await prisma.field.findMany({
      select: {
        id: true,
        cropStatus: true,
      },
    });

  const activeFields =
    fields.filter(
      (field) =>
        field.cropStatus ===
        "em_campo",
    );

  /*
   * Situation usa exclusivamente os
   * dados persistidos da V2.
   *
   * Nenhuma análise Python é executada
   * ao abrir o resumo da safra.
   */
  const situations =
    await Promise.all(
      activeFields.map(
        (field) =>
          getCurrentFieldSituation(
            field.id,
          ),
      ),
    );

  const today =
    getSaoPauloDateKey();

  const upcomingEndDate =
    addDaysToIsoDate(
      today,
      UPCOMING_EVENT_WINDOW_DAYS,
    );

  const [
    seasonMetrics,
    calendarResponse,
  ] =
    await Promise.all([
      getSeasonMetrics(),

      listCalendarEvents({
        startDate:
          today,

        endDate:
          upcomingEndDate,
      }),
    ]);

  const upcomingCalendarEvents =
    calendarResponse.events.filter(
      (event) =>
        event.date >=
          today &&
        event.date <=
          upcomingEndDate &&
        (
          event.status ===
            "previsto" ||
          event.status ===
            "informativo"
        ),
    );

  const statusCounter =
    new Map<
      string,
      number
    >();

  for (
    const situation of
    situations
  ) {
    incrementCounter(
      statusCounter,
      situation.current_situation,
    );
  }

  const estimatedDefenses =
    situations
      .map(
        (situation) =>
          situation
            .spray_context
            .estimated_defense_percent,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
          "number",
      );

  const averageDefense =
    estimatedDefenses.length >
    0
      ? roundTwo(
          estimatedDefenses.reduce(
            (
              sum,
              value,
            ) =>
              sum + value,
            0,
          ) /
            estimatedDefenses.length,
        )
      : 0;

  const fieldAlerts =
    situations.flatMap(
      (situation) =>
        buildFieldOperationalAlerts(
          situation,
          today,
        ),
    );

  const calendarAlerts =
    buildCalendarAlerts(
      upcomingCalendarEvents,
      today,
    );

  const operationalAlerts =
    sortOperationalAlerts([
      ...fieldAlerts,
      ...calendarAlerts,
    ]);

  return {
    summary: {
      total_fields:
        fields.length,

      active_fields:
        activeFields.length,

      stable_fields:
        statusCounter.get(
          "estavel",
        ) ?? 0,

      monitoring_fields:
        (
          statusCounter.get(
            "monitorar",
          ) ?? 0
        ) +
        (
          statusCounter.get(
            "monitorar_resposta",
          ) ?? 0
        ),

      high_attention_fields:
        statusCounter.get(
          "alta_atencao",
        ) ?? 0,

      maximum_priority_fields:
        statusCounter.get(
          "prioridade_maxima",
        ) ?? 0,

      low_or_expired_defense_fields:
        situations.filter(
          (situation) =>
            LOW_OR_EXPIRED_DEFENSE_STATUSES.has(
              situation
                .spray_context
                .defense_status ??
                "",
            ),
        ).length,

      fields_without_spray:
        situations.filter(
          (situation) =>
            situation
              .spray_context
              .has_spray_record !==
            true,
        ).length,

      fields_without_recent_inspection:
        situations.filter(
          (situation) =>
            !hasRecentInspection(
              situation,
              today,
            ),
        ).length,

      average_estimated_defense_percent:
        averageDefense,
    },

    status_distribution:
      buildStatusDistribution(
        situations,
      ),

    defense_distribution:
      buildDefenseDistribution(
        situations,
      ),

    critical_fields:
      buildCriticalFields(
        situations,
      ),

    operational_alerts:
      operationalAlerts,

    top_product:
      seasonMetrics
        .top_products[0] ??
      null,

    top_target:
      seasonMetrics
        .top_targets[0] ??
      null,

    upcoming_calendar_events:
      upcomingCalendarEvents,
  };
}