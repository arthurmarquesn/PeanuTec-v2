"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, ListChecks } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  DefenseBadge,
  EmptyState as BaseEmptyState,
  LoadingState,
  OperationalAlert as OperationalAlertCard,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";
import { getSeasonMetrics, getSeasonOverview } from "@/lib/api";
import type {
  CalendarEvent,
  CriticalField,
  DefenseDistribution,
  FieldStatusDistribution,
  OperationalAlert,
  SeasonMetrics,
  SeasonOverview,
} from "@/types/analysis";

const defenseStatusLabels: Record<string, string> = {
  muito_alta: "Muito alta",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  vencida: "Vencida",
  sem_registro: "Sem registro",
};

const eventTypeLabels: Record<string, string> = {
  pulverizacao: "Pulverização",
  inspecao: "Inspeção",
  monitoramento: "Monitoramento",
  reaplicacao_prevista: "Reaplicação prevista",
  observacao: "Observação",
};

const productTypeLabels: Record<string, string> = {
  fungicida: "Fungicida",
  inseticida: "Inseticida",
  acaricida: "Acaricida",
  herbicida: "Herbicida",
  outro: "Outro",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function formatProductType(value: string | null | undefined): string {
  if (!value) {
    return "N/A";
  }

  return productTypeLabels[value] ?? value;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDefenseStatus(value: string | null | undefined): string {
  if (!value) {
    return "N/A";
  }

  return defenseStatusLabels[value] ?? value.replaceAll("_", " ");
}

function getDefenseTone(value: string | null | undefined) {
  if (value === "vencida" || value === "baixa") {
    return "critical";
  }

  if (value === "media") {
    return "attention";
  }

  if (value === "alta" || value === "muito_alta") {
    return "positive";
  }

  return "neutral";
}

function getEventTone(value: string | null | undefined) {
  if (value === "pulverizacao") {
    return "attention";
  }

  if (value === "inspecao") {
    return "positive";
  }

  if (value === "monitoramento") {
    return "info";
  }

  if (value === "reaplicacao_prevista") {
    return "earth";
  }

  return "neutral";
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "positive" | "attention" | "critical" | "info" | "earth" | "neutral";
}) {
  return <StatCard label={label} value={value} detail={detail} tone={tone} />;
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} action={action}>
      {children}
    </SectionCard>
  );
}

function EmptyState({ text }: { text: string }) {
  return <BaseEmptyState title="Sem registros para mostrar">{text}</BaseEmptyState>;
}

function DistributionList({
  items,
  emptyText,
  renderLabel,
  renderTone,
}: {
  items: Array<FieldStatusDistribution | DefenseDistribution>;
  emptyText: string;
  renderLabel: (item: FieldStatusDistribution | DefenseDistribution) => string;
  renderTone?: (
    item: FieldStatusDistribution | DefenseDistribution,
  ) => "positive" | "attention" | "critical" | "info" | "earth" | "neutral";
}) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div
          key={`${renderLabel(item)}-${index}`}
          className="flex items-center justify-between gap-4 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-4 py-3 text-sm"
        >
          <span className="min-w-0 truncate font-medium text-[var(--pt-color-structure-800)]">
            {renderLabel(item)}
          </span>

          <StatusBadge tone={renderTone?.(item) ?? "neutral"}>
            {item.fields_count}
          </StatusBadge>
        </div>
      ))}
    </div>
  );
}

function CriticalFieldsTable({ fields }: { fields: CriticalField[] }) {
  if (fields.length === 0) {
    return <EmptyState text="Nenhum talhão crítico no momento." />;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[var(--pt-color-surface-muted)]">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
            <th className="px-3 py-3">Talhão</th>
            <th className="px-3 py-3">Situação</th>
            <th className="px-3 py-3">Doença principal</th>
            <th className="px-3 py-3 text-right">Índice agronômico</th>
            <th className="px-3 py-3 text-right">Defesa estimada</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)]">
          {fields.map((field) => (
            <tr key={field.field_id}>
              <td className="px-3 py-3">
                <Link
                  href={`/talhoes/${field.field_id}`}
                  className="font-semibold text-[var(--pt-color-brand-900)] underline-offset-4 hover:underline"
                >
                  {field.field_name}
                </Link>
              </td>

              <td className="px-3 py-3 text-[var(--pt-color-structure-700)]">
                {field.situation_label}
              </td>

              <td className="px-3 py-3 text-[var(--pt-color-structure-700)]">
                {formatNullable(field.main_disease)}
              </td>

              <td className="px-3 py-3 text-right font-semibold text-[var(--pt-color-structure-950)]">
                {formatNullable(field.agronomic_index)}
              </td>

              <td className="px-3 py-3 text-right">
                <DefenseBadge
                  status={field.defense_status}
                  percent={field.estimated_defense_percent}
                />
              </td>

              <td className="px-3 py-3">
                <StatusBadge tone={getDefenseTone(field.defense_status)}>
                  {formatDefenseStatus(field.defense_status)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsList({ alerts }: { alerts: OperationalAlert[] }) {
  if (alerts.length === 0) {
    return <EmptyState text="Nenhum alerta operacional no momento." />;
  }

  return (
    <div className="grid gap-3">
      {alerts.map((alert, index) => (
        <OperationalAlertCard
          key={`${alert.type}-${alert.field_id ?? "geral"}-${index}`}
          title={alert.title}
          description={alert.description}
          context={alert.field_name ?? undefined}
          severity={
            alert.severity === "alta"
              ? "critical"
              : alert.severity === "media"
                ? "attention"
                : "neutral"
          }
        />
      ))}
    </div>
  );
}

function CalendarEventsList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return <EmptyState text="Nenhum evento previsto no calendário." />;
  }

  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="grid gap-2 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-4 py-3 text-sm sm:grid-cols-[7rem_1fr_auto]"
        >
          <span className="font-semibold text-[var(--pt-color-structure-950)]">
            {formatDate(event.date)}
          </span>

          <span className="min-w-0 truncate text-[var(--pt-color-structure-700)]">
            {event.title}
          </span>

          <StatusBadge tone={getEventTone(event.event_type)}>
            {eventTypeLabels[event.event_type] ?? event.event_type}
          </StatusBadge>
        </div>
      ))}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {value}
      </dd>

      {detail ? (
        <p className="mt-1 text-xs text-[var(--pt-color-structure-500)]">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SeasonMetricsSummary({
  metrics,
  isLoading,
  error,
}: {
  metrics: SeasonMetrics | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return <LoadingState label="Carregando resumo de métricas..." />;
  }

  if (error) {
    return (
      <OperationalAlertCard
        title="Resumo de métricas indisponível"
        description={error}
        severity="attention"
      />
    );
  }

  if (!metrics) {
    return <EmptyState text="Nenhuma métrica operacional disponível." />;
  }

  const topProduct = metrics.top_products[0] ?? null;
  const topProductType = metrics.product_type_distribution[0] ?? null;
  const topField = metrics.top_fields_by_applications[0] ?? null;
  const topTarget = metrics.top_targets[0] ?? null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <CompactMetric
        label="Produto mais usado"
        value={topProduct?.product ?? "N/A"}
        detail={
          topProduct ? `${topProduct.applications_count} aplicações` : undefined
        }
      />

      <CompactMetric
        label="Tipo mais usado"
        value={formatProductType(topProductType?.product_type)}
        detail={
          topProductType
            ? `${topProductType.applications_count} aplicações`
            : undefined
        }
      />

      <CompactMetric
        label="Talhão com mais aplicações"
        value={topField?.field_name ?? "N/A"}
        detail={topField ? `${topField.applications_count} aplicações` : undefined}
      />

      <CompactMetric
        label="Alvo mais frequente"
        value={topTarget?.target ?? "N/A"}
        detail={topTarget ? `${topTarget.applications_count} aplicações` : undefined}
      />

      <CompactMetric
        label="Aplicações no período"
        value={metrics.summary.total_spray_applications}
      />

      <CompactMetric
        label="Intervalo médio"
        value={`${formatNumber(metrics.summary.average_planned_interval_days)} dias`}
      />
    </dl>
  );
}

export default function SeasonOverviewPage() {
  const [overview, setOverview] = useState<SeasonOverview | null>(null);
  const [metrics, setMetrics] = useState<SeasonMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setIsLoading(true);
      setIsLoadingMetrics(true);
      setError(null);
      setMetricsError(null);

      const [overviewResult, metricsResult] = await Promise.allSettled([
        getSeasonOverview(),
        getSeasonMetrics(),
      ]);

      if (!isMounted) {
        return;
      }

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      } else {
        setError(
          overviewResult.reason instanceof Error
            ? overviewResult.reason.message
            : "Não foi possível carregar a visão da safra.",
        );
      }

      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value);
      } else {
        setMetricsError(
          metricsResult.reason instanceof Error
            ? metricsResult.reason.message
            : "Não foi possível carregar as métricas da safra.",
        );
      }

      setIsLoading(false);
      setIsLoadingMetrics(false);
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppShell
      title="Visão da Safra"
      subtitle="Leitura consolidada dos talhões, defesas estimadas, alertas operacionais e prioridades."
    >
      <div className="grid gap-5">
        {isLoading ? (
          <LoadingState label="Carregando visão operacional da safra..." />
        ) : null}

        {error ? (
          <OperationalAlertCard
            title="Não foi possível carregar a visão da safra"
            description={error}
            severity="attention"
          />
        ) : null}

        {overview ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Talhões ativos"
                value={overview.summary.active_fields}
                detail={`${overview.summary.total_fields} cadastrados`}
                tone="earth"
              />

              <SummaryCard
                label="Estáveis"
                value={overview.summary.stable_fields}
                tone="positive"
              />

              <SummaryCard
                label="Monitoramento"
                value={overview.summary.monitoring_fields}
                tone="info"
              />

              <SummaryCard
                label="Alta atenção"
                value={overview.summary.high_attention_fields}
                detail={`${overview.summary.maximum_priority_fields} prioridade máxima`}
                tone={
                  overview.summary.high_attention_fields > 0
                    ? "attention"
                    : "neutral"
                }
              />

              <SummaryCard
                label="Defesa média"
                value={`${formatNumber(
                  overview.summary.average_estimated_defense_percent,
                )}%`}
                tone="positive"
              />
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Defesa baixa/vencida"
                value={overview.summary.low_or_expired_defense_fields}
                tone={
                  overview.summary.low_or_expired_defense_fields > 0
                    ? "critical"
                    : "positive"
                }
              />

              <SummaryCard
                label="Sem pulverização"
                value={overview.summary.fields_without_spray}
                tone={
                  overview.summary.fields_without_spray > 0
                    ? "attention"
                    : "positive"
                }
              />

              <SummaryCard
                label="Sem inspeção recente"
                value={overview.summary.fields_without_recent_inspection}
                tone={
                  overview.summary.fields_without_recent_inspection > 0
                    ? "attention"
                    : "positive"
                }
              />

              <SummaryCard
                label="Alertas"
                value={overview.operational_alerts.length}
                tone={
                  overview.operational_alerts.length > 0 ? "attention" : "neutral"
                }
              />
            </section>

            <Section
              title="Métricas da safra"
              description="Resumo operacional de produtos, alvos e aplicações registradas."
              action={
                <SecondaryButton href="/metricas" icon={BarChart3}>
                  Ver métricas detalhadas
                </SecondaryButton>
              }
            >
              <SeasonMetricsSummary
                metrics={metrics}
                isLoading={isLoadingMetrics}
                error={metricsError}
              />
            </Section>

            <div className="grid gap-5 xl:grid-cols-2">
              <Section
                title="Distribuição da situação"
                description="Quantidade de talhões por leitura operacional."
              >
                <DistributionList
                  items={overview.status_distribution}
                  emptyText="Nenhum talhão ativo para distribuir."
                  renderLabel={(item) =>
                    "situation_label" in item
                      ? item.situation_label
                      : formatDefenseStatus(item.defense_status)
                  }
                />
              </Section>

              <Section
                title="Distribuição da defesa estimada"
                description="Distribuição dos talhões conforme a estimativa operacional de defesa."
              >
                <DistributionList
                  items={overview.defense_distribution}
                  emptyText="Nenhuma defesa estimada calculada."
                  renderLabel={(item) =>
                    "defense_status" in item
                      ? formatDefenseStatus(item.defense_status)
                      : item.situation_label
                  }
                  renderTone={(item) =>
                    "defense_status" in item
                      ? getDefenseTone(item.defense_status)
                      : "neutral"
                  }
                />
              </Section>
            </div>

            <Section
              title="Talhões críticos"
              description="Áreas que exigem maior atenção operacional na leitura consolidada."
              action={
                <SecondaryButton href="/ranking" icon={ListChecks}>
                  Ver todas as prioridades
                </SecondaryButton>
              }
            >
              <CriticalFieldsTable fields={overview.critical_fields} />
            </Section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Section
                title="Alertas operacionais"
                description="Ocorrências que merecem revisão antes da próxima tomada de decisão."
              >
                <AlertsList alerts={overview.operational_alerts} />
              </Section>

              <div className="grid gap-5">
                <Section
                  title="Uso predominante"
                  description="Leitura rápida do produto e alvo mais frequentes na safra."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryCard
                      label="Produto mais usado"
                      value={overview.top_product?.product ?? "N/A"}
                      detail={
                        overview.top_product
                          ? `${overview.top_product.applications_count} aplicações`
                          : undefined
                      }
                      tone="earth"
                    />

                    <SummaryCard
                      label="Alvo mais frequente"
                      value={overview.top_target?.target ?? "N/A"}
                      detail={
                        overview.top_target
                          ? `${overview.top_target.applications_count} aplicações`
                          : undefined
                      }
                      tone="info"
                    />
                  </div>
                </Section>

                <Section
                  title="Próximos eventos do calendário"
                  description="Eventos previstos para orientar o acompanhamento operacional."
                  action={
                    <SecondaryButton href="/calendario" icon={CalendarDays}>
                      Abrir calendário
                    </SecondaryButton>
                  }
                >
                  <CalendarEventsList events={overview.upcoming_calendar_events} />
                </Section>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}