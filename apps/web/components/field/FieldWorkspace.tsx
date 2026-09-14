"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowLeft,
  Beaker,
  ClipboardCheck,
  FileText,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useParams } from "next/navigation";

import { AppShell } from "@/components/AppShell";

import {
  DefenseBadge,
  EmptyState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from "@/components/design-system";

import {
  getCurrentFieldSituation,
  getField,
  getFieldInspections,
  getFieldOperationalContext,
  getFieldSprayApplications,
} from "@/lib/api";

import type {
  CurrentFieldSituation,
  FieldInspection,
  FieldInspectionsResponse,
  FieldOperationalContext,
  RegisteredField,
  SprayApplication,
  SprayApplicationsResponse,
} from "@/types/analysis";

/* =========================================================
 * Types
 * ========================================================= */

type TabKey =
  | "overview"
  | "operation"
  | "inspections"
  | "sprays";

type Tone =
  | "positive"
  | "attention"
  | "critical"
  | "info"
  | "earth"
  | "neutral";

type TabDefinition = {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
};

/* =========================================================
 * Tabs
 * ========================================================= */

const tabs: TabDefinition[] = [
  {
    key: "overview",
    label: "Visão geral",
    icon: Activity,
  },
  {
    key: "operation",
    label: "Operação",
    icon: Gauge,
  },
  {
    key: "inspections",
    label: "Inspeções",
    icon: ClipboardCheck,
  },
  {
    key: "sprays",
    label: "Pulverizações",
    icon: Beaker,
  },
];

/* =========================================================
 * Helpers
 * ========================================================= */

function normalizeText(
  value?: string | null,
) {
  return (value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase();
}

function formatStatus(
  value?: string | null,
) {
  if (!value) {
    return "Não informado";
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replaceAll("-", "_")
      .replaceAll(" ", "_");

  const labels: Record<
    string,
    string
  > = {
    em_campo: "Em campo",
    pre_arranquio:
      "Pré-arranquio",
    arrancado: "Arrancado",
    colhido: "Colhido",

    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    muito_alta: "Muito alta",

    baixo: "Baixo",
    moderado: "Moderado",
    critico: "Crítico",

    estavel: "Estável",
    monitoramento:
      "Monitoramento",

    monitorar:
      "Monitorar",

    monitorar_resposta:
      "Monitorar resposta",

    alta_atencao:
      "Alta atenção",

    prioridade_maxima:
      "Prioridade máxima",

    sem_prioridade_operacional:
      "Sem prioridade operacional",

    em_dia: "Em dia",
    atencao: "Atenção",
    atrasado: "Atrasado",
    vencida: "Vencida",

    boa: "Boa",
    regular: "Regular",
    critica: "Crítica",

    localizado: "Localizado",
    reboleiras: "Reboleiras",
    espalhado: "Espalhado",
    generalizado: "Generalizado",

    seco: "Seco",
    adequado: "Adequado",
    umido: "Úmido",
    encharcado: "Encharcado",
    compactado: "Compactado",
    nao_avaliado:
      "Não avaliado",

    manejo_realizado:
      "Manejo realizado",

    consultar_responsavel:
      "Consultar responsável",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Não informado";
  }

  const date =
    value.includes("T")
      ? new Date(value)
      : new Date(
          `${value}T00:00:00`,
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(date);
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) {
    return "Não informado";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}

function scoreLabel(
  value?: number | null,
) {
  return typeof value ===
    "number"
    ? Math.round(value)
    : "—";
}

function friendlyError(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    const normalized =
      error.message
        .toLowerCase();

    if (
      normalized.includes(
        "failed to fetch",
      ) ||
      normalized.includes(
        "networkerror",
      )
    ) {
      return "Não foi possível conectar ao backend atual.";
    }

    return error.message;
  }

  return "Não foi possível carregar os dados.";
}

function situationTone(
  situation:
    | CurrentFieldSituation
    | null,
): Tone {
  if (!situation) {
    return "neutral";
  }

  const label =
    normalizeText(
      situation.priority_label ??
        situation.situation_label,
    );

  const score =
    situation.priority_score;

  if (
    label.includes(
      "maxima",
    ) ||
    (typeof score ===
      "number" &&
      score >= 75)
  ) {
    return "critical";
  }

  if (
    label.includes(
      "alta",
    ) ||
    (typeof score ===
      "number" &&
      score >= 50)
  ) {
    return "attention";
  }

  if (
    label.includes(
      "monitor",
    ) ||
    (typeof score ===
      "number" &&
      score >= 25)
  ) {
    return "info";
  }

  return "positive";
}

function inspectionTone(
  inspection:
    FieldInspection,
): Tone {
  if (
    inspection.general_status ===
    "critica"
  ) {
    return "critical";
  }

  if (
    inspection.general_status ===
      "atencao" ||
    inspection.symptoms_found
  ) {
    return "attention";
  }

  if (
    inspection.general_status ===
    "boa"
  ) {
    return "positive";
  }

  return "neutral";
}

function sprayTone(
  application:
    SprayApplication,
): Tone {
  if (
    application.interval_status ===
    "atrasado"
  ) {
    return "critical";
  }

  if (
    application.interval_status ===
    "atencao"
  ) {
    return "attention";
  }

  return "positive";
}

/* =========================================================
 * Small visual components
 * ========================================================= */

function InfoMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div
      className="
        min-w-0
        rounded-[18px]
        border
        border-[rgba(47,37,32,0.07)]
        bg-white/45
        px-4
        py-4
      "
    >
      <p
        className="
          text-[9px]
          font-bold
          uppercase
          tracking-[0.13em]
          text-[var(--pt-color-structure-400)]
        "
      >
        {label}
      </p>

      <div
        className="
          mt-2
          text-sm
          font-semibold
          text-[var(--pt-color-structure-900)]
        "
      >
        {value}
      </div>

      {detail ? (
        <p
          className="
            mt-1
            text-[11px]
            leading-5
            text-[var(--pt-color-structure-400)]
          "
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SectionSurface({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      className="
        rounded-[22px]
        border
        border-[rgba(47,37,32,0.075)]
        bg-[rgba(255,253,250,0.90)]
        p-5
        shadow-[0_4px_16px_rgba(47,37,32,0.028)]
        sm:p-6
      "
    >
      <div>
        <h2
          className="
            text-[15px]
            font-semibold
            tracking-[-0.015em]
            text-[var(--pt-color-structure-950)]
          "
        >
          {title}
        </h2>

        {description ? (
          <p
            className="
              mt-1
              text-xs
              leading-5
              text-[var(--pt-color-structure-500)]
            "
          >
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        {children}
      </div>
    </section>
  );
}

function InlineError({
  message,
}: {
  message: string;
}) {
  return (
    <div
      className="
        rounded-[17px]
        border
        border-[rgba(154,61,50,0.12)]
        bg-[rgba(245,222,218,0.42)]
        px-4
        py-3
      "
    >
      <p
        className="
          text-sm
          font-semibold
          text-[var(--pt-color-critical-700)]
        "
      >
        Não foi possível carregar
      </p>

      <p
        className="
          mt-1
          text-xs
          leading-5
          text-[var(--pt-color-structure-500)]
        "
      >
        {message}
      </p>
    </div>
  );
}

/* =========================================================
 * Overview
 * ========================================================= */

function OverviewTab({
  field,
  situation,
}: {
  field: RegisteredField;
  situation:
    | CurrentFieldSituation
    | null;
}) {
  const defensePercent =
    situation
      ?.spray_context
      .estimated_defense_percent;

  const lastInspection =
    situation
      ?.inspection_context
      .last_inspection_date ??
    situation
      ?.inspection_context
      .inspected_at;

  return (
    <div
      className="
        grid
        gap-5
      "
    >
      <section
        className="
          relative
          overflow-hidden
          rounded-[24px]
          border
          border-[rgba(243,111,33,0.12)]
          bg-[linear-gradient(135deg,rgba(255,253,250,0.98)_0%,rgba(255,247,241,0.96)_100%)]
          p-6
          shadow-[0_8px_30px_rgba(47,37,32,0.04)]
          sm:p-7
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
            gap-6
            xl:grid-cols-[minmax(0,1fr)_240px]
            xl:items-center
          "
        >
          <div>
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
                Situação do talhão
              </p>

              <StatusBadge
                tone={situationTone(
                  situation,
                )}
              >
                {situation
                  ? formatStatus(
                      situation.priority_label ??
                        situation.situation_label,
                    )
                  : "Sem leitura"}
              </StatusBadge>
            </div>

            <h2
              className="
                mt-4
                text-xl
                font-semibold
                tracking-[-0.025em]
                text-[var(--pt-color-structure-950)]
              "
            >
              {situation
                ?.summary ??
                "Ainda não há leitura operacional disponível para este talhão."}
            </h2>

            {situation
              ?.recommended_next_action ? (
              <p
                className="
                  mt-3
                  max-w-3xl
                  text-sm
                  leading-6
                  text-[var(--pt-color-structure-600)]
                "
              >
                {
                  situation.recommended_next_action
                }
              </p>
            ) : null}
          </div>

          <div
            className="
              rounded-[20px]
              border
              border-[rgba(243,111,33,0.10)]
              bg-white/60
              px-5
              py-5
              text-center
            "
          >
            <p
              className="
                text-[9px]
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
                justify-center
                gap-1
              "
            >
              <span
                className="
                  text-[2.7rem]
                  font-semibold
                  tracking-[-0.055em]
                  text-[var(--pt-color-orange-600)]
                "
              >
                {scoreLabel(
                  situation
                    ?.priority_score,
                )}
              </span>

              <span
                className="
                  text-sm
                  text-[var(--pt-color-structure-400)]
                "
              >
                /100
              </span>
            </div>

            <p
              className="
                mt-1
                text-xs
                text-[var(--pt-color-structure-500)]
              "
            >
              Confiança{" "}
              {scoreLabel(
                situation
                  ?.confidence_score,
              )}
              /100
            </p>
          </div>
        </div>
      </section>

      <section
        className="
          grid
          gap-3
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <InfoMetric
          label="Risco atual"
          value={
            <StatusBadge
              tone={
                situation?.risk_context
                  .risk_classification
                  ? situationTone(
                      situation,
                    )
                  : "neutral"
              }
            >
              {formatStatus(
                situation
                  ?.risk_context
                  .risk_classification,
              )}
            </StatusBadge>
          }
        />

        <InfoMetric
          label="Defesa estimada"
          value={
            situation ? (
              <DefenseBadge
                status={
                  situation
                    .spray_context
                    .defense_status
                }
                percent={
                  defensePercent
                }
              />
            ) : (
              "Sem dados"
            )
          }
        />

        <InfoMetric
          label="Última inspeção"
          value={formatDateTime(
            lastInspection,
          )}
        />

        <InfoMetric
          label="Plantio"
          value={formatDate(
            field.data_plantio,
          )}
        />
      </section>

      <div
        className="
          grid
          gap-5
          xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]
        "
      >
        <SectionSurface
          title="Informações da área"
          description="Identificação utilizada pelo PeanuTec nas leituras operacionais."
        >
          <dl
            className="
              grid
              gap-x-8
              gap-y-5
              sm:grid-cols-2
            "
          >
            <div>
              <dt
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Cidade
              </dt>

              <dd
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-[var(--pt-color-structure-800)]
                "
              >
                {field.cidade}
              </dd>
            </div>

            <div>
              <dt
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Cultura
              </dt>

              <dd
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-[var(--pt-color-structure-800)]
                "
              >
                {field.cultura}
              </dd>
            </div>

            <div>
              <dt
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Status
              </dt>

              <dd className="mt-1">
                <StatusBadge
                  tone={
                    field.status_lavoura ===
                    "em_campo"
                      ? "positive"
                      : "earth"
                  }
                >
                  {formatStatus(
                    field.status_lavoura,
                  )}
                </StatusBadge>
              </dd>
            </div>

            <div>
              <dt
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--pt-color-structure-400)]
                "
              >
                Coordenadas
              </dt>

              <dd
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-[var(--pt-color-structure-800)]
                "
              >
                {field.latitude.toFixed(
                  4,
                )}
                ,{" "}
                {field.longitude.toFixed(
                  4,
                )}
              </dd>
            </div>
          </dl>
        </SectionSurface>

        <SectionSurface
          title="Monitoramento"
          description="Doenças acompanhadas atualmente nesta área."
        >
          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >
            {field
              .doencas_monitoradas
              .length > 0 ? (
              field.doencas_monitoradas.map(
                (disease) => (
                  <StatusBadge
                    key={disease}
                    tone="brand"
                  >
                    {disease}
                  </StatusBadge>
                ),
              )
            ) : (
              <p
                className="
                  text-sm
                  text-[var(--pt-color-structure-500)]
                "
              >
                Nenhuma doença
                configurada.
              </p>
            )}
          </div>
        </SectionSurface>
      </div>
    </div>
  );
}

/* =========================================================
 * Operation
 * ========================================================= */

function OperationTab({
  context,
  loading,
  error,
}: {
  context:
    | FieldOperationalContext
    | null;

  loading: boolean;

  error:
    | string
    | null;
}) {
  if (loading) {
    return (
      <LoadingState label="Carregando contexto operacional..." />
    );
  }

  if (error) {
    return (
      <InlineError
        message={error}
      />
    );
  }

  if (!context) {
    return (
      <EmptyState
        title="Contexto indisponível"
        icon={Gauge}
      >
        Ainda não existem dados
        suficientes para montar o
        contexto operacional.
      </EmptyState>
    );
  }

  return (
    <div
      className="
        grid
        gap-5
      "
    >
      <section
        className="
          grid
          gap-3
          md:grid-cols-3
        "
      >
        <InfoMetric
          label="Fase da lavoura"
          value={
            context
              .crop_stage_context
              .label
          }
          detail={
            context
              .crop_stage_context
              .description
          }
        />

        <InfoMetric
          label="Contexto hídrico"
          value={
            <StatusBadge
              tone={
                normalizeText(
                  context
                    .water_context
                    .status,
                ).includes(
                  "crit",
                )
                  ? "critical"
                  : normalizeText(
                        context
                          .water_context
                          .status,
                      ).includes(
                        "atenc",
                      )
                    ? "attention"
                    : "positive"
              }
            >
              {
                context
                  .water_context
                  .label
              }
            </StatusBadge>
          }
          detail={
            context
              .water_context
              .main_reason
          }
        />

        <InfoMetric
          label="Qualidade dos dados"
          value={`${Math.round(
            context
              .data_quality_context
              .score,
          )}/100`}
          detail={
            context
              .data_quality_context
              .summary
          }
        />
      </section>

      <SectionSurface
        title={
          context
            .farmer_summary
            .headline
        }
        description="Síntese construída a partir dos registros do talhão."
      >
        <div
          className="
            grid
            gap-5
            lg:grid-cols-2
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
              Pontos principais
            </p>

            <ul
              className="
                mt-3
                grid
                gap-2
              "
            >
              {context.farmer_summary.main_points.map(
                (point) => (
                  <li
                    key={point}
                    className="
                      flex
                      gap-2
                      text-sm
                      leading-6
                      text-[var(--pt-color-structure-600)]
                    "
                  >
                    <span
                      className="
                        mt-2.5
                        h-1.5
                        w-1.5
                        shrink-0
                        rounded-full
                        bg-[var(--pt-color-orange-500)]
                      "
                    />

                    {point}
                  </li>
                ),
              )}
            </ul>
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
              Próximos acompanhamentos
            </p>

            <ul
              className="
                mt-3
                grid
                gap-2
              "
            >
              {context.farmer_summary.suggested_follow_up.map(
                (point) => (
                  <li
                    key={point}
                    className="
                      flex
                      gap-2
                      text-sm
                      leading-6
                      text-[var(--pt-color-structure-600)]
                    "
                  >
                    <span
                      className="
                        mt-2.5
                        h-1.5
                        w-1.5
                        shrink-0
                        rounded-full
                        bg-[var(--pt-color-info-700)]
                      "
                    />

                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </SectionSurface>

      <div
        className="
          grid
          gap-5
          lg:grid-cols-2
        "
      >
        <SectionSurface
          title="Memória da área"
        >
          <p
            className="
              text-sm
              leading-6
              text-[var(--pt-color-structure-600)]
            "
          >
            {
              context
                .historical_memory
                .summary
            }
          </p>
        </SectionSurface>

        <SectionSurface
          title="Observação de campo"
        >
          <p
            className="
              text-sm
              leading-6
              text-[var(--pt-color-structure-600)]
            "
          >
            {
              context
                .field_observation_context
                .summary
            }
          </p>
        </SectionSurface>
      </div>
    </div>
  );
}

/* =========================================================
 * Inspections
 * ========================================================= */

function InspectionsTab({
  data,
  loading,
  error,
  fieldId,
}: {
  data:
    | FieldInspectionsResponse
    | null;

  loading: boolean;

  error:
    | string
    | null;

  fieldId: string;
}) {
  if (loading) {
    return (
      <LoadingState label="Carregando inspeções..." />
    );
  }

  if (error) {
    return (
      <InlineError
        message={error}
      />
    );
  }

  const inspections =
    data?.inspections ?? [];

  return (
    <SectionSurface
      title="Histórico de inspeções"
      description="Registros de campo realizados neste talhão."
    >
      <div
        className="
          mb-5
          flex
          justify-end
        "
      >
        <PrimaryButton
          href={`/inspecoes/nova?field_id=${fieldId}`}
          icon={ClipboardCheck}
        >
          Nova inspeção
        </PrimaryButton>
      </div>

      {inspections.length ===
      0 ? (
        <EmptyState
          title="Nenhuma inspeção registrada"
          icon={ClipboardCheck}
          action={
            <SecondaryButton
              href={`/inspecoes/nova?field_id=${fieldId}`}
            >
              Registrar inspeção
            </SecondaryButton>
          }
        >
          Registre observações de
          campo para melhorar a
          leitura operacional.
        </EmptyState>
      ) : (
        <div
          className="
            divide-y
            divide-[rgba(47,37,32,0.07)]
          "
        >
          {inspections.map(
            (inspection) => (
              <article
                key={
                  inspection.id
                }
                className="
                  grid
                  gap-3
                  py-4
                  first:pt-0
                  last:pb-0
                  md:grid-cols-[minmax(0,1fr)_auto]
                  md:items-start
                "
              >
                <div>
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
                        text-sm
                        font-semibold
                        text-[var(--pt-color-structure-900)]
                      "
                    >
                      {
                        inspection.disease
                      }
                    </h3>

                    <StatusBadge
                      tone={inspectionTone(
                        inspection,
                      )}
                    >
                      {inspection.general_status
                        ? formatStatus(
                            inspection.general_status,
                          )
                        : inspection.symptoms_found
                          ? "Sintomas encontrados"
                          : "Sem sintomas"}
                    </StatusBadge>
                  </div>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-[var(--pt-color-structure-500)]
                    "
                  >
                    {formatDateTime(
                      inspection.inspected_at,
                    )}
                    {inspection.responsible
                      ? ` · ${inspection.responsible}`
                      : ""}
                  </p>

                  {inspection.notes ? (
                    <p
                      className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                        text-[var(--pt-color-structure-600)]
                      "
                    >
                      {
                        inspection.notes
                      }
                    </p>
                  ) : null}
                </div>

                <div
                  className="
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  <StatusBadge tone="neutral">
                    Severidade{" "}
                    {formatStatus(
                      inspection.visual_severity,
                    )}
                  </StatusBadge>

                  <StatusBadge tone="neutral">
                    Desfolha{" "}
                    {formatStatus(
                      inspection.defoliation_level,
                    )}
                  </StatusBadge>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </SectionSurface>
  );
}

/* =========================================================
 * Spray applications
 * ========================================================= */

function SpraysTab({
  data,
  loading,
  error,
  fieldId,
}: {
  data:
    | SprayApplicationsResponse
    | null;

  loading: boolean;

  error:
    | string
    | null;

  fieldId: string;
}) {
  if (loading) {
    return (
      <LoadingState label="Carregando pulverizações..." />
    );
  }

  if (error) {
    return (
      <InlineError
        message={error}
      />
    );
  }

  const applications =
    data?.spray_applications ??
    [];

  return (
    <SectionSurface
      title="Histórico de pulverizações"
      description="Aplicações registradas neste talhão."
    >
      <div
        className="
          mb-5
          flex
          justify-end
        "
      >
        <PrimaryButton
          href={`/pulverizacoes/nova?field_id=${fieldId}`}
          icon={Beaker}
        >
          Nova pulverização
        </PrimaryButton>
      </div>

      {applications.length ===
      0 ? (
        <EmptyState
          title="Nenhuma pulverização registrada"
          icon={Beaker}
          action={
            <SecondaryButton
              href={`/pulverizacoes/nova?field_id=${fieldId}`}
            >
              Registrar aplicação
            </SecondaryButton>
          }
        >
          As aplicações registradas
          aparecerão neste histórico.
        </EmptyState>
      ) : (
        <div
          className="
            divide-y
            divide-[rgba(47,37,32,0.07)]
          "
        >
          {applications.map(
            (application) => (
              <article
                key={
                  application.id
                }
                className="
                  grid
                  gap-3
                  py-4
                  first:pt-0
                  last:pb-0
                  md:grid-cols-[minmax(0,1fr)_auto]
                  md:items-center
                "
              >
                <div>
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
                        text-sm
                        font-semibold
                        text-[var(--pt-color-structure-900)]
                      "
                    >
                      {application.product ||
                        "Produto não informado"}
                    </h3>

                    <StatusBadge
                      tone={sprayTone(
                        application,
                      )}
                    >
                      {formatStatus(
                        application.interval_status,
                      )}
                    </StatusBadge>
                  </div>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-[var(--pt-color-structure-500)]
                    "
                  >
                    {formatDate(
                      application.application_date,
                    )}
                    {application.target
                      ? ` · ${application.target}`
                      : ""}
                  </p>

                  <div
                    className="
                      mt-2
                      flex
                      flex-wrap
                      gap-x-4
                      gap-y-1
                      text-xs
                      text-[var(--pt-color-structure-500)]
                    "
                  >
                    {application.dose ? (
                      <span>
                        Dose:{" "}
                        {
                          application.dose
                        }
                      </span>
                    ) : null}

                    {application.responsible ? (
                      <span>
                        Responsável:{" "}
                        {
                          application.responsible
                        }
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  className="
                    text-left
                    md:text-right
                  "
                >
                  <p
                    className="
                      text-lg
                      font-semibold
                      tracking-tight
                      text-[var(--pt-color-structure-900)]
                    "
                  >
                    {
                      application.days_since_application
                    }{" "}
                    dias
                  </p>

                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.1em]
                      text-[var(--pt-color-structure-400)]
                    "
                  >
                    desde a aplicação
                  </p>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </SectionSurface>
  );
}

/* =========================================================
 * Main workspace
 * ========================================================= */

export default function FieldWorkspace() {
  const params =
    useParams();

  const rawId =
    params?.id;

  const fieldId =
    Array.isArray(rawId)
      ? rawId[0]
      : rawId;

  const [
    field,
    setField,
  ] = useState<
    RegisteredField | null
  >(null);

  const [
    situation,
    setSituation,
  ] = useState<
    CurrentFieldSituation | null
  >(null);

  const [
    operationalContext,
    setOperationalContext,
  ] = useState<
    FieldOperationalContext | null
  >(null);

  const [
    inspections,
    setInspections,
  ] = useState<
    FieldInspectionsResponse | null
  >(null);

  const [
    sprays,
    setSprays,
  ] = useState<
    SprayApplicationsResponse | null
  >(null);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabKey>(
      "overview",
    );

  const [
    initialLoading,
    setInitialLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    initialError,
    setInitialError,
  ] = useState<
    string | null
  >(null);

  const [
    operationLoading,
    setOperationLoading,
  ] = useState(false);

  const [
    operationError,
    setOperationError,
  ] = useState<
    string | null
  >(null);

  const [
    inspectionsLoading,
    setInspectionsLoading,
  ] = useState(false);

  const [
    inspectionsError,
    setInspectionsError,
  ] = useState<
    string | null
  >(null);

  const [
    spraysLoading,
    setSpraysLoading,
  ] = useState(false);

  const [
    spraysError,
    setSpraysError,
  ] = useState<
    string | null
  >(null);

  /* =======================================================
   * Initial load
   * ======================================================= */

  async function loadCore(
    silent = false,
  ) {
    if (!fieldId) {
      return;
    }

    if (!silent) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    setInitialError(null);

    const [
      fieldResult,
      situationResult,
    ] =
      await Promise.allSettled([
        getField(fieldId),

        getCurrentFieldSituation(
          fieldId,
        ),
      ]);

    if (
      fieldResult.status ===
      "fulfilled"
    ) {
      setField(
        fieldResult.value,
      );
    } else {
      setInitialError(
        friendlyError(
          fieldResult.reason,
        ),
      );
    }

    if (
      situationResult.status ===
      "fulfilled"
    ) {
      setSituation(
        situationResult.value,
      );
    } else {
      setSituation(null);
    }

    setInitialLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadCore();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  /* =======================================================
   * Lazy tab loaders
   * ======================================================= */

  useEffect(() => {
    if (
      !fieldId ||
      activeTab !==
        "operation" ||
      operationalContext ||
      operationLoading
    ) {
      return;
    }

    async function load() {
      setOperationLoading(true);
      setOperationError(null);

      try {
        const response =
          await getFieldOperationalContext(
            fieldId!,
          );

        setOperationalContext(
          response,
        );
      } catch (error) {
        setOperationError(
          friendlyError(error),
        );
      } finally {
        setOperationLoading(false);
      }
    }

    void load();
  }, [
    activeTab,
    fieldId,
    operationalContext,
    operationLoading,
  ]);

  useEffect(() => {
    if (
      !fieldId ||
      activeTab !==
        "inspections" ||
      inspections ||
      inspectionsLoading
    ) {
      return;
    }

    async function load() {
      setInspectionsLoading(true);
      setInspectionsError(null);

      try {
        const response =
          await getFieldInspections(
            fieldId!,
          );

        setInspections(
          response,
        );
      } catch (error) {
        setInspectionsError(
          friendlyError(error),
        );
      } finally {
        setInspectionsLoading(false);
      }
    }

    void load();
  }, [
    activeTab,
    fieldId,
    inspections,
    inspectionsLoading,
  ]);

  useEffect(() => {
    if (
      !fieldId ||
      activeTab !== "sprays" ||
      sprays ||
      spraysLoading
    ) {
      return;
    }

    async function load() {
      setSpraysLoading(true);
      setSpraysError(null);

      try {
        const response =
          await getFieldSprayApplications(
            fieldId!,
          );

        setSprays(response);
      } catch (error) {
        setSpraysError(
          friendlyError(error),
        );
      } finally {
        setSpraysLoading(false);
      }
    }

    void load();
  }, [
    activeTab,
    fieldId,
    sprays,
    spraysLoading,
  ]);

  /* =======================================================
   * Main disease
   * ======================================================= */

  const mainDisease =
    useMemo(() => {
      return (
        situation?.risk_context
          .main_disease ??
        field
          ?.doencas_monitoradas?.[0] ??
        null
      );
    }, [
      field,
      situation,
    ]);

  /* =======================================================
   * Render
   * ======================================================= */

  if (initialLoading) {
    return (
      <AppShell
        title="Talhão"
        subtitle="Carregando informações da área."
      >
        <LoadingState label="Preparando central do talhão..." />
      </AppShell>
    );
  }

  if (
    initialError ||
    !field ||
    !fieldId
  ) {
    return (
      <AppShell
        title="Talhão"
        subtitle="Não foi possível abrir esta área."
      >
        <InlineError
          message={
            initialError ??
            "Talhão não encontrado."
          }
        />

        <div className="mt-4">
          <SecondaryButton
            href="/talhoes"
            icon={ArrowLeft}
          >
            Voltar para talhões
          </SecondaryButton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={field.nome}
      subtitle={`${field.cidade} · ${field.cultura}${
        mainDisease
          ? ` · Monitorando ${mainDisease}`
          : ""
      }`}
    >
      <div
        className="
          grid
          gap-5
          pb-6
        "
      >
        {/* =================================================
         * Actions
         * ================================================= */}

        <section
          className="
            flex
            flex-col
            gap-3
            rounded-[20px]
            border
            border-[rgba(47,37,32,0.07)]
            bg-[rgba(255,253,250,0.68)]
            px-4
            py-3.5
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <Link
            href="/talhoes"
            className="
              inline-flex
              items-center
              gap-2
              text-xs
              font-semibold
              text-[var(--pt-color-structure-500)]
              transition-colors
              hover:text-[var(--pt-color-orange-700)]
            "
          >
            <ArrowLeft
              size={15}
              strokeWidth={1.8}
            />

            Todos os talhões
          </Link>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <button
              type="button"
              disabled={refreshing}
              onClick={() =>
                void loadCore(true)
              }
              className="
                inline-flex
                h-10
                items-center
                gap-2
                rounded-[13px]
                px-3
                text-xs
                font-semibold
                text-[var(--pt-color-structure-500)]
                transition-colors
                hover:bg-white
                hover:text-[var(--pt-color-structure-900)]
                disabled:opacity-50
              "
            >
              <RefreshCw
                size={15}
                strokeWidth={1.8}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Atualizar
            </button>

            <SecondaryButton
              href={`/talhoes/${fieldId}/relatorio`}
              icon={FileText}
            >
              Relatório
            </SecondaryButton>

            <PrimaryButton
              href={`/inspecoes/nova?field_id=${fieldId}`}
              icon={ClipboardCheck}
            >
              Nova inspeção
            </PrimaryButton>
          </div>
        </section>

        {/* =================================================
         * Identity strip
         * ================================================= */}

        <section
          className="
            flex
            flex-col
            gap-4
            rounded-[22px]
            border
            border-[rgba(47,37,32,0.07)]
            bg-[rgba(255,253,250,0.86)]
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
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-[14px]
                bg-[var(--pt-color-orange-50)]
                text-[var(--pt-color-orange-700)]
              "
            >
              <MapPin
                size={19}
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
                {field.nome}
              </p>

              <div
                className="
                  mt-1
                  flex
                  flex-wrap
                  gap-x-4
                  gap-y-1
                  text-xs
                  text-[var(--pt-color-structure-500)]
                "
              >
                <span>
                  {field.cidade}
                </span>

                <span>
                  Plantio{" "}
                  {formatDate(
                    field.data_plantio,
                  )}
                </span>

                <span>
                  {field
                    .doencas_monitoradas
                    .length}{" "}
                  doença(s)
                </span>
              </div>
            </div>
          </div>

          <StatusBadge
            tone={
              field.status_lavoura ===
              "em_campo"
                ? "positive"
                : "earth"
            }
          >
            {formatStatus(
              field.status_lavoura,
            )}
          </StatusBadge>
        </section>

        {/* =================================================
         * Tabs
         * ================================================= */}

        <div
          className="
            overflow-x-auto
          "
        >
          <div
            className="
              inline-flex
              min-w-full
              gap-1
              rounded-[17px]
              border
              border-[rgba(47,37,32,0.07)]
              bg-[rgba(255,253,250,0.74)]
              p-1.5
              sm:min-w-0
            "
          >
            {tabs.map(
              (tab) => {
                const Icon =
                  tab.icon;

                const active =
                  activeTab ===
                  tab.key;

                return (
                  <button
                    key={
                      tab.key
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.key,
                      )
                    }
                    className={[
                      "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-xs font-semibold transition-all",

                      active
                        ? "bg-white text-[var(--pt-color-structure-950)] shadow-[0_2px_8px_rgba(47,37,32,0.05)]"
                        : "text-[var(--pt-color-structure-500)] hover:bg-white/55 hover:text-[var(--pt-color-structure-800)]",
                    ].join(
                      " ",
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={
                        1.8
                      }
                    />

                    {tab.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* =================================================
         * Tab contents
         * ================================================= */}

        {activeTab ===
        "overview" ? (
          <OverviewTab
            field={field}
            situation={
              situation
            }
          />
        ) : null}

        {activeTab ===
        "operation" ? (
          <OperationTab
            context={
              operationalContext
            }
            loading={
              operationLoading
            }
            error={
              operationError
            }
          />
        ) : null}

        {activeTab ===
        "inspections" ? (
          <InspectionsTab
            data={inspections}
            loading={
              inspectionsLoading
            }
            error={
              inspectionsError
            }
            fieldId={
              fieldId
            }
          />
        ) : null}

        {activeTab ===
        "sprays" ? (
          <SpraysTab
            data={sprays}
            loading={
              spraysLoading
            }
            error={
              spraysError
            }
            fieldId={
              fieldId
            }
          />
        ) : null}

        {/* =================================================
         * Operational disclaimer
         * ================================================= */}

        <section
          className="
            flex
            gap-3
            rounded-[18px]
            border
            border-[rgba(54,95,124,0.10)]
            bg-[rgba(225,237,243,0.30)]
            px-4
            py-3
          "
        >
          <ShieldCheck
            size={17}
            strokeWidth={1.8}
            className="
              mt-0.5
              shrink-0
              text-[var(--pt-color-info-700)]
            "
          />

          <p
            className="
              text-xs
              leading-5
              text-[var(--pt-color-structure-500)]
            "
          >
            As leituras do
            PeanuTec são apoio
            operacional e não
            substituem diagnóstico
            agronômico ou decisão
            técnica sobre aplicação
            de defensivos.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
