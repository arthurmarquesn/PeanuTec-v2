"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  ListChecks,
  MapPinned,
  ShieldCheck,
  Sprout,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";

import {
  EmptyState,
  LoadingState,
  PrimaryButton,
  RiskBadge,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";

import {
  getCalendarEvents,
  getCalendarSummary,
  getCurrentFieldSituation,
  getFields,
  getRanking,
} from "@/lib/api";

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarSummary,
  CurrentFieldSituation,
  PriorityReason,
  RankingItem,
  RankingResponse,
  RegisteredField,
} from "@/types/analysis";

/* =========================================================
 * Types
 * ========================================================= */

type Tone =
  | "positive"
  | "attention"
  | "critical"
  | "info"
  | "earth"
  | "neutral";

type PriorityItem =
  RankingItem & {
    situation:
      | CurrentFieldSituation
      | null;
  };

type SectionError = {
  label: string;
  message: string;
};

/* =========================================================
 * Labels
 * ========================================================= */

const eventTypeLabels: Record<
  CalendarEventType,
  string
> = {
  pulverizacao: "Pulverização",
  inspecao: "Inspeção",
  monitoramento: "Monitoramento",
  reaplicacao_prevista:
    "Reaplicação prevista",
  observacao: "Observação",
};

/* =========================================================
 * General helpers
 * ========================================================= */

function normalizeText(
  value?: string | null,
): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toUpperCase();
}

function fixPortugueseText(
  value?: string | null,
): string {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("Nao", "Não")
    .replaceAll("nao", "não")
    .replaceAll(
      "atencao",
      "atenção",
    )
    .replaceAll(
      "Atencao",
      "Atenção",
    )
    .replaceAll(
      "maxima",
      "máxima",
    )
    .replaceAll(
      "Maxima",
      "Máxima",
    )
    .replaceAll(
      "pulverizacao",
      "pulverização",
    )
    .replaceAll(
      "Pulverizacao",
      "Pulverização",
    )
    .replaceAll(
      "inspecao",
      "inspeção",
    )
    .replaceAll(
      "Inspecao",
      "Inspeção",
    )
    .replaceAll(
      "talhao",
      "talhão",
    )
    .replaceAll(
      "Talhao",
      "Talhão",
    )
    .replaceAll(
      "Historico",
      "Histórico",
    )
    .replaceAll(
      "historico",
      "histórico",
    )
    .replaceAll(
      "Classificacao",
      "Classificação",
    )
    .replaceAll(
      "classificacao",
      "classificação",
    )
    .replaceAll(
      "Pressao",
      "Pressão",
    )
    .replaceAll(
      "pressao",
      "pressão",
    )
    .replaceAll(
      "Presenca",
      "Presença",
    )
    .replaceAll(
      "presenca",
      "presença",
    )
    .replaceAll(
      "aplicacao",
      "aplicação",
    )
    .replaceAll(
      "Aplicacao",
      "Aplicação",
    )
    .replaceAll(
      "calendario",
      "calendário",
    )
    .replaceAll(
      "Calendario",
      "Calendário",
    );
}

function friendlyErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return "Não foi possível carregar.";
}

function titleCase(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatStatus(
  value?: string | null,
): string {
  if (!value) {
    return "N/A";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const labels: Record<
    string,
    string
  > = {
    sem_registro: "Sem registro",

    muito_alta: "Muito alta",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",

    vencida: "Vencida",
    atrasado: "Atrasado",

    atencao: "Atenção",
    atenção: "Atenção",

    em_dia: "Em dia",

    critico: "Crítico",
    crítico: "Crítico",

    moderado: "Moderado",
    baixo: "Baixo",

    estavel: "Estável",
    estável: "Estável",

    monitoramento:
      "Monitoramento",

    alta_atencao:
      "Alta atenção",

    alta_atenção:
      "Alta atenção",

    prioridade_maxima:
      "Prioridade máxima",

    prioridade_máxima:
      "Prioridade máxima",

    pendente: "Pendente",

    concluido: "Concluído",
    concluído: "Concluído",

    cancelado: "Cancelado",
    planejado: "Planejado",
    realizado: "Realizado",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return fixPortugueseText(
    titleCase(
      value.replaceAll("_", " "),
    ),
  );
}

/* =========================================================
 * Dates
 * ========================================================= */

function toIsoDate(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(
  date: Date,
  days: number,
): Date {
  const nextDate =
    new Date(date);

  nextDate.setDate(
    nextDate.getDate() + days,
  );

  return nextDate;
}

function parseIsoDate(
  value: string,
): Date {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "N/A";
  }

  const parsedDate =
    value.includes("T")
      ? new Date(value)
      : parseIsoDate(value);

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "short",
    },
  )
    .format(parsedDate)
    .replace(".", "");
}

/* =========================================================
 * Priority helpers
 * ========================================================= */

function priorityScore(
  item: PriorityItem,
): number | undefined {
  return (
    item.priority_score ??
    item.situation
      ?.priority_score
  );
}

function confidenceScore(
  item: PriorityItem,
): number | undefined {
  return (
    item.confidence_score ??
    item.situation
      ?.confidence_score
  );
}

function scoreLabel(
  value?: number | null,
): string {
  return typeof value === "number"
    ? `${Math.round(value)}`
    : "—";
}

function priorityLabel(
  item: PriorityItem,
): string {
  const rawLabel =
    item.priority_label ??
    item.situation
      ?.priority_label ??
    item.priority;

  const normalized =
    normalizeText(rawLabel);

  if (
    item.situation
      ?.inspection_context
      .symptoms_found ===
      true &&
    (normalized.includes(
      "ESTAVEL",
    ) ||
      normalized.includes(
        "BAIXA",
      ))
  ) {
    return "Monitoramento";
  }

  if (
    normalized.includes(
      "MAXIMA",
    )
  ) {
    return "Prioridade máxima";
  }

  if (
    normalized.includes(
      "ALTA",
    )
  ) {
    return "Alta atenção";
  }

  if (
    normalized.includes(
      "MONITOR",
    )
  ) {
    return "Monitoramento";
  }

  if (
    normalized.includes(
      "ESTAVEL",
    ) ||
    normalized.includes(
      "BAIXA",
    )
  ) {
    return "Estável";
  }

  return rawLabel
    ? formatStatus(rawLabel)
    : "Não informado";
}

function confidenceLabel(
  item: PriorityItem,
): string {
  const rawLabel =
    item.confidence_label ??
    item.situation
      ?.confidence_label;

  const normalized =
    normalizeText(rawLabel);

  if (
    normalized.includes(
      "ALTA",
    )
  ) {
    return "Alta";
  }

  if (
    normalized.includes(
      "MEDIA",
    )
  ) {
    return "Média";
  }

  if (
    normalized.includes(
      "BAIXA",
    )
  ) {
    return "Baixa";
  }

  return rawLabel
    ? formatStatus(rawLabel)
    : "Não informado";
}

function attentionTone(
  item: PriorityItem,
): Tone {
  const score =
    priorityScore(item);

  const label =
    normalizeText(
      priorityLabel(item),
    );

  if (
    label.includes("MAXIMA") ||
    (score !== undefined &&
      score >= 75)
  ) {
    return "critical";
  }

  if (
    label.includes("ALTA") ||
    (score !== undefined &&
      score >= 50)
  ) {
    return "attention";
  }

  if (
    label.includes(
      "MONITOR",
    ) ||
    (score !== undefined &&
      score >= 25)
  ) {
    return "info";
  }

  return "positive";
}

function isHighAttention(
  item: RankingItem,
): boolean {
  const score =
    item.priority_score;

  const label =
    normalizeText(
      item.priority_label ??
        item.priority,
    );

  return (
    label.includes("MAXIMA") ||
    label.includes("ALTA") ||
    (typeof score ===
      "number" &&
      score >= 50)
  );
}

/* =========================================================
 * Reasons
 * ========================================================= */

function getPriorityReasons(
  item: PriorityItem,
): PriorityReason[] {
  return (
    item.main_reasons ??
    item.situation
      ?.main_reasons ??
    []
  );
}

function topReasonLabel(
  item: PriorityItem,
): string {
  const reason =
    getPriorityReasons(item)[0];

  if (reason) {
    return fixPortugueseText(
      reason.label,
    );
  }

  return fixPortugueseText(
    item.situation?.reasons?.[0] ??
      item.main_action ??
      "Registros operacionais indicam necessidade de acompanhamento.",
  );
}

/* =========================================================
 * Event helpers
 * ========================================================= */

function getEventTone(
  eventType:
    CalendarEventType,
): Tone {
  if (
    eventType === "inspecao"
  ) {
    return "positive";
  }

  if (
    eventType ===
    "pulverizacao"
  ) {
    return "attention";
  }

  if (
    eventType ===
    "reaplicacao_prevista"
  ) {
    return "earth";
  }

  if (
    eventType ===
    "monitoramento"
  ) {
    return "info";
  }

  return "neutral";
}

/* =========================================================
 * Migration notice
 * ========================================================= */

function DataStatusNotice({
  errors,
}: {
  errors: SectionError[];
}) {
  if (
    errors.length === 0
  ) {
    return null;
  }

  const labels = errors
    .map(
      (error) => error.label,
    )
    .join(", ");

  return (
    <div
      className="
        flex
        flex-col
        gap-3
        rounded-[18px]
        border
        border-[rgba(152,97,22,0.13)]
        bg-[rgba(251,239,210,0.44)]
        px-4
        py-3
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <div
        className="
          flex
          min-w-0
          items-center
          gap-3
        "
      >
        <div
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-[12px]
            bg-white/60
            text-[var(--pt-color-attention-700)]
          "
        >
          <CircleAlert
            size={17}
            strokeWidth={1.8}
          />
        </div>

        <div className="min-w-0">
          <p
            className="
              text-sm
              font-semibold
              text-[var(--pt-color-structure-900)]
            "
          >
            Atualização parcial
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-xs
              text-[var(--pt-color-structure-500)]
            "
          >
            Não foi possível atualizar:{" "}
            {labels}.
          </p>
        </div>
      </div>

      <span
        className="
          shrink-0
          text-[11px]
          font-semibold
          text-[var(--pt-color-attention-700)]
        "
      >
        Dados disponíveis continuam visíveis
      </span>
    </div>
  );
}

/* =========================================================
 * Main attention
 * ========================================================= */

function MainAttention({
  item,
}: {
  item: PriorityItem | null;
}) {
  if (!item) {
    return (
      <section
        className="
          overflow-hidden
          rounded-[24px]
          border
          border-[rgba(47,37,32,0.075)]
          bg-[rgba(255,253,250,0.92)]
          p-6
          shadow-[0_5px_18px_rgba(47,37,32,0.035)]
          sm:p-7
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              h-2
              w-2
              rounded-full
              bg-[var(--pt-color-orange-500)]
            "
          />

          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.15em]
              text-[var(--pt-color-structure-400)]
            "
          >
            Prioridade do dia
          </p>
        </div>

        <EmptyState
          title="Nenhum talhão priorizado"
          icon={ClipboardCheck}
        >
          Quando houver dados
          suficientes, o PeanuTec
          destacará aqui o talhão que
          merece atenção primeiro.
        </EmptyState>
      </section>
    );
  }

  const score =
    priorityScore(item);

  const confidence =
    confidenceScore(item);

  const tone =
    attentionTone(item);

  return (
    <section
      className="
        relative
        overflow-hidden
        rounded-[24px]
        border
        border-[rgba(243,111,33,0.12)]
        bg-[linear-gradient(135deg,rgba(255,253,250,0.98)_0%,rgba(255,247,241,0.98)_100%)]
        shadow-[0_8px_30px_rgba(47,37,32,0.045)]
      "
    >
      <div
        aria-hidden="true"
        className="
          absolute
          -right-24
          -top-24
          h-60
          w-60
          rounded-full
          bg-[rgba(243,111,33,0.07)]
          blur-3xl
        "
      />

      <div
        className="
          relative
          grid
          gap-7
          p-6
          lg:grid-cols-[minmax(0,1fr)_220px]
          lg:items-center
          sm:p-7
        "
      >
        <div className="min-w-0">
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <span
              className="
                h-2
                w-2
                rounded-full
                bg-[var(--pt-color-orange-500)]
              "
            />

            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.15em]
                text-[var(--pt-color-structure-400)]
              "
            >
              Talhão para olhar primeiro
            </p>

            <StatusBadge
              tone={tone}
            >
              {priorityLabel(item)}
            </StatusBadge>
          </div>

          <div className="mt-4">
            <div
              className="
                flex
                flex-wrap
                items-baseline
                gap-x-3
                gap-y-1
              "
            >
              <span
                className="
                  text-xs
                  font-semibold
                  text-[var(--pt-color-structure-400)]
                "
              >
                #{item.rank}
              </span>

              <h2
                className="
                  text-2xl
                  font-semibold
                  tracking-[-0.035em]
                  text-[var(--pt-color-structure-950)]
                  sm:text-[1.8rem]
                "
              >
                {item.field_name}
              </h2>
            </div>

            <p
              className="
                mt-3
                max-w-3xl
                text-sm
                leading-6
                text-[var(--pt-color-structure-600)]
              "
            >
              {topReasonLabel(item)}
            </p>
          </div>

          <div
            className="
              mt-6
              flex
              flex-wrap
              gap-x-7
              gap-y-4
            "
          >
            <div>
              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Risco avaliado
              </p>

              <div className="mt-1.5">
                <RiskBadge
                  value={
                    item.risk_classification
                  }
                />
              </div>
            </div>

            <div>
              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Confiança
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-[var(--pt-color-structure-800)]
                "
              >
                {scoreLabel(
                  confidence,
                )}
                /100 ·{" "}
                {confidenceLabel(
                  item,
                )}
              </p>
            </div>
          </div>

          <div
            className="
              mt-6
              flex
              flex-wrap
              gap-2
            "
          >
            <PrimaryButton
              href={`/talhoes/${item.field_id}`}
              icon={MapPinned}
            >
              Abrir talhão
            </PrimaryButton>

            <SecondaryButton
              href="/ranking"
              icon={ListChecks}
            >
              Ver ranking
            </SecondaryButton>
          </div>
        </div>

        <div
          className="
            flex
            items-center
            justify-between
            rounded-[20px]
            border
            border-[rgba(243,111,33,0.12)]
            bg-white/65
            px-5
            py-5
            lg:block
            lg:text-center
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.13em]
                text-[var(--pt-color-structure-400)]
              "
            >
              Prioridade
            </p>

            <div
              className="
                mt-1
                flex
                items-baseline
                gap-1
                lg:justify-center
              "
            >
              <span
                className="
                  text-[2.65rem]
                  font-semibold
                  tracking-[-0.055em]
                  text-[var(--pt-color-orange-600)]
                "
              >
                {scoreLabel(score)}
              </span>

              <span
                className="
                  text-sm
                  font-medium
                  text-[var(--pt-color-structure-400)]
                "
              >
                /100
              </span>
            </div>
          </div>

          <div
            className="
              hidden
              h-px
              bg-[rgba(47,37,32,0.08)]
              lg:my-4
              lg:block
            "
          />

          <p
            className="
              max-w-[130px]
              text-right
              text-xs
              leading-5
              text-[var(--pt-color-structure-500)]
              lg:mx-auto
              lg:text-center
            "
          >
            Índice para organizar a
            atenção operacional.
          </p>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
 * Priority list
 * ========================================================= */

function PriorityList({
  items,
}: {
  items: PriorityItem[];
}) {
  const visibleItems =
    items.slice(0, 4);

  return (
    <SectionCard
      title="Prioridades"
      description="Talhões que merecem atenção na rotina atual."
      action={
        <SecondaryButton
          href="/ranking"
          icon={ListChecks}
        >
          Ver ranking
        </SecondaryButton>
      }
    >
      {visibleItems.length ===
      0 ? (
        <EmptyState
          title="Sem prioridades calculadas"
          icon={ListChecks}
        >
          O ranking será exibido após
          o cadastro e atualização dos
          dados dos talhões.
        </EmptyState>
      ) : (
        <div
          className="
            divide-y
            divide-[rgba(47,37,32,0.07)]
          "
        >
          {visibleItems.map(
            (item) => (
              <Link
                key={`${item.field_id}-${item.disease}`}
                href={`/talhoes/${item.field_id}`}
                className="
                  group
                  grid
                  gap-3
                  py-4
                  transition-colors
                  first:pt-0
                  last:pb-0
                  sm:grid-cols-[44px_minmax(0,1fr)_auto]
                  sm:items-center
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-[13px]
                    bg-[var(--pt-color-orange-50)]
                    text-xs
                    font-bold
                    text-[var(--pt-color-orange-700)]
                  "
                >
                  {String(
                    item.rank,
                  ).padStart(
                    2,
                    "0",
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      gap-2
                    "
                  >
                    <h3
                      className="
                        truncate
                        text-sm
                        font-semibold
                        text-[var(--pt-color-structure-900)]
                        transition-colors
                        group-hover:text-[var(--pt-color-orange-700)]
                      "
                    >
                      {
                        item.field_name
                      }
                    </h3>

                    <StatusBadge
                      tone={attentionTone(
                        item,
                      )}
                    >
                      {priorityLabel(
                        item,
                      )}
                    </StatusBadge>
                  </div>

                  <p
                    className="
                      mt-1
                      line-clamp-1
                      text-xs
                      text-[var(--pt-color-structure-500)]
                    "
                  >
                    {topReasonLabel(
                      item,
                    )}
                  </p>
                </div>

                <div
                  className="
                    flex
                    items-center
                    gap-3
                    sm:justify-end
                  "
                >
                  <div className="text-right">
                    <p
                      className="
                        text-lg
                        font-semibold
                        tracking-tight
                        text-[var(--pt-color-structure-900)]
                      "
                    >
                      {scoreLabel(
                        priorityScore(
                          item,
                        ),
                      )}
                    </p>

                    <p
                      className="
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.1em]
                        text-[var(--pt-color-structure-400)]
                      "
                    >
                      prioridade
                    </p>
                  </div>

                  <ArrowRight
                    size={17}
                    strokeWidth={1.8}
                    className="
                      text-[var(--pt-color-structure-300)]
                      transition-all
                      group-hover:translate-x-0.5
                      group-hover:text-[var(--pt-color-orange-600)]
                    "
                  />
                </div>
              </Link>
            ),
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* =========================================================
 * Event list
 * ========================================================= */

function EventRow({
  event,
}: {
  event: CalendarEvent;
}) {
  return (
    <article
      className="
        flex
        gap-3
        py-3.5
        first:pt-0
        last:pb-0
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          shrink-0
          flex-col
          items-center
          justify-center
          rounded-[12px]
          bg-[var(--pt-color-surface-muted)]
          text-center
        "
      >
        <CalendarDays
          size={16}
          strokeWidth={1.7}
          className="
            text-[var(--pt-color-structure-500)]
          "
        />
      </div>

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >
          <div className="min-w-0">
            <p
              className="
                truncate
                text-sm
                font-semibold
                text-[var(--pt-color-structure-900)]
              "
            >
              {event.title}
            </p>

            <p
              className="
                mt-1
                text-xs
                text-[var(--pt-color-structure-500)]
              "
            >
              {formatDate(
                event.date,
              )}
              {" · "}
              {
                eventTypeLabels[
                  event.event_type
                ]
              }
            </p>

            {event.field_name ? (
              <p
                className="
                  mt-0.5
                  truncate
                  text-[11px]
                  text-[var(--pt-color-structure-400)]
                "
              >
                {event.field_name}
              </p>
            ) : null}
          </div>

          <StatusBadge
            tone={getEventTone(
              event.event_type,
            )}
          >
            {formatStatus(
              event.status,
            )}
          </StatusBadge>
        </div>
      </div>
    </article>
  );
}

function UpcomingEvents({
  events,
}: {
  events: CalendarEvent[];
}) {
  return (
    <SectionCard
      title="Próximos eventos"
      description="Agenda operacional dos próximos 21 dias."
      action={
        <Link
          href="/calendario"
          className="
            text-xs
            font-semibold
            text-[var(--pt-color-orange-700)]
            transition-colors
            hover:text-[var(--pt-color-orange-600)]
          "
        >
          Abrir calendário
        </Link>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          title="Agenda livre"
          icon={CalendarDays}
        >
          Nenhum evento está previsto
          para os próximos dias.
        </EmptyState>
      ) : (
        <div
          className="
            divide-y
            divide-[rgba(47,37,32,0.07)]
          "
        >
          {events
            .slice(0, 6)
            .map((event) => (
              <EventRow
                key={event.id}
                event={event}
              />
            ))}
        </div>
      )}
    </SectionCard>
  );
}

/* =========================================================
 * Dashboard
 * ========================================================= */

export default function DashboardPage() {
  const [
    fields,
    setFields,
  ] = useState<
    RegisteredField[]
  >([]);

  const [
    ranking,
    setRanking,
  ] = useState<
    RankingResponse | null
  >(null);

  const [
    summary,
    setSummary,
  ] = useState<
    CalendarSummary | null
  >(null);

  const [
    events,
    setEvents,
  ] = useState<
    CalendarEvent[]
  >([]);

  const [
    topSituation,
    setTopSituation,
  ] = useState<
    CurrentFieldSituation | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errors,
    setErrors,
  ] = useState<
    SectionError[]
  >([]);

  /* =======================================================
   * Load
   * ======================================================= */

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setIsLoading(true);
      setErrors([]);

      const today =
        new Date();

      const endDate =
        addDays(today, 21);

      const nextErrors:
        SectionError[] = [];

      const [
        fieldsResult,
        rankingResult,
        summaryResult,
        eventsResult,
      ] =
        await Promise.allSettled([
          getFields(),

          getRanking(),

          getCalendarSummary(),

          getCalendarEvents({
            start_date:
              toIsoDate(today),

            end_date:
              toIsoDate(endDate),
          }),
        ]);

      if (ignore) {
        return;
      }

      const loadedFields =
        fieldsResult.status ===
        "fulfilled"
          ? fieldsResult.value
          : [];

      const loadedRanking =
        rankingResult.status ===
        "fulfilled"
          ? rankingResult.value
          : null;

      const loadedSummary =
        summaryResult.status ===
        "fulfilled"
          ? summaryResult.value
          : null;

      const loadedEvents =
        eventsResult.status ===
        "fulfilled"
          ? eventsResult.value.events
              .slice()
              .sort(
                (a, b) =>
                  a.date.localeCompare(
                    b.date,
                  ),
              )
          : [];

      if (
        fieldsResult.status ===
        "rejected"
      ) {
        nextErrors.push({
          label: "Talhões",
          message:
            friendlyErrorMessage(
              fieldsResult.reason,
            ),
        });
      }

      if (
        rankingResult.status ===
        "rejected"
      ) {
        nextErrors.push({
          label: "Prioridades",
          message:
            friendlyErrorMessage(
              rankingResult.reason,
            ),
        });
      }

      if (
        summaryResult.status ===
        "rejected"
      ) {
        nextErrors.push({
          label: "Calendário",
          message:
            friendlyErrorMessage(
              summaryResult.reason,
            ),
        });
      }

      if (
        eventsResult.status ===
        "rejected"
      ) {
        nextErrors.push({
          label: "Eventos",
          message:
            friendlyErrorMessage(
              eventsResult.reason,
            ),
        });
      }

      setFields(
        loadedFields,
      );

      setRanking(
        loadedRanking,
      );

      setSummary(
        loadedSummary,
      );

      setEvents(
        loadedEvents,
      );

      /*
       * Importante:
       *
       * A versão antiga buscava a situação
       * individual de todos os talhões.
       *
       * Durante a reestruturação do V2,
       * o dashboard consulta apenas o
       * primeiro talhão do ranking.
       *
       * Isso reduz drasticamente o número
       * de requisições ao backend Python.
       */

      const firstFieldId =
        loadedRanking
          ?.ranking?.[0]
          ?.field_id;

      let loadedTopSituation:
        CurrentFieldSituation | null =
        null;

      if (firstFieldId) {
        try {
          loadedTopSituation =
            await getCurrentFieldSituation(
              firstFieldId,
            );
        } catch (error) {
          nextErrors.push({
            label:
              "Leitura detalhada",
            message:
              friendlyErrorMessage(
                error,
              ),
          });
        }
      }

      if (ignore) {
        return;
      }

      setTopSituation(
        loadedTopSituation,
      );

      setErrors(
        nextErrors,
      );

      setIsLoading(false);
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  /* =======================================================
   * Derived
   * ======================================================= */

  const priorityItems =
    useMemo<
      PriorityItem[]
    >(() => {
      return (
        ranking?.ranking.map(
          (item, index) => ({
            ...item,

            situation:
              index === 0
                ? topSituation
                : null,
          }),
        ) ?? []
      );
    }, [
      ranking,
      topSituation,
    ]);

  const topPriority =
    priorityItems[0] ?? null;

  const activeFields =
    fields.filter(
      (field) =>
        field.status_lavoura ===
        "em_campo",
    );

  const highAttentionCount =
    ranking?.ranking.filter(
      isHighAttention,
    ).length ?? 0;

  const nextEventsCount =
    events.length;

  const inspectionCount =
    summary
      ?.inspection_events_count ??
    "—";

  /* =======================================================
   * Render
   * ======================================================= */

  return (
    <AppShell
      title="Painel do Dia"
      subtitle="O que precisa da sua atenção na operação de hoje."
    >
      <div
        className="
          grid
          gap-5
          pb-4
        "
      >
        {isLoading ? (
          <LoadingState
            label="Organizando os dados da safra..."
          />
        ) : null}

        {!isLoading ? (
          <>
            <DataStatusNotice
              errors={errors}
            />

            <MainAttention
              item={topPriority}
            />

            <section
              className="
                grid
                gap-3
                sm:grid-cols-2
                xl:grid-cols-4
              "
            >
              <StatCard
                label="Talhões ativos"
                value={
                  summary
                    ?.active_fields ??
                  activeFields.length
                }
                detail="em campo"
                tone="positive"
              />

              <StatCard
                label="Alta atenção"
                value={
                  highAttentionCount
                }
                detail="no ranking atual"
                tone={
                  highAttentionCount >
                  0
                    ? "critical"
                    : "neutral"
                }
              />

              <StatCard
                label="Próximos eventos"
                value={
                  nextEventsCount
                }
                detail="nos próximos 21 dias"
                tone="info"
              />

              <StatCard
                label="Inspeções"
                value={
                  inspectionCount
                }
                detail="registradas no calendário"
                tone="earth"
              />
            </section>

            <div
              className="
                grid
                gap-5
                xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]
              "
            >
              <PriorityList
                items={
                  priorityItems
                }
              />

              <UpcomingEvents
                events={events}
              />
            </div>

            <section
              className="
                flex
                flex-col
                gap-4
                rounded-[20px]
                border
                border-[rgba(47,37,32,0.07)]
                bg-[rgba(255,253,250,0.62)]
                px-5
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-[13px]
                    bg-[var(--pt-color-orange-50)]
                    text-[var(--pt-color-orange-700)]
                  "
                >
                  <ShieldCheck
                    size={18}
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-[var(--pt-color-structure-900)]
                    "
                  >
                    A leitura é
                    operacional
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      leading-5
                      text-[var(--pt-color-structure-500)]
                    "
                  >
                    Prioridades ajudam
                    a organizar o campo
                    e não substituem
                    diagnóstico técnico.
                  </p>
                </div>
              </div>

              <Link
                href="/talhoes"
                className="
                  inline-flex
                  shrink-0
                  items-center
                  gap-2
                  text-xs
                  font-semibold
                  text-[var(--pt-color-orange-700)]
                  transition-colors
                  hover:text-[var(--pt-color-orange-600)]
                "
              >
                <Sprout
                  size={15}
                  strokeWidth={1.8}
                />

                Ver todos os talhões
              </Link>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}