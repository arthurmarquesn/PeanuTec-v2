"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Layers, Package, Target } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  LoadingState,
  OperationalAlert,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";
import { getSeasonMetrics } from "@/lib/api";
import type {
  FieldApplicationMetric,
  MonthlyApplicationMetric,
  ProductMetric,
  ProductTypeMetric,
  SeasonMetrics,
  TargetMetric,
} from "@/types/analysis";

const productTypeLabels: Record<string, string> = {
  fungicida: "Fungicida",
  inseticida: "Inseticida",
  acaricida: "Acaricida",
  herbicida: "Herbicida",
  outro: "Outro",
};

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

const productTypeTones: Record<string, Tone> = {
  fungicida: "positive",
  inseticida: "attention",
  acaricida: "info",
  herbicida: "earth",
  outro: "neutral",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatProductType(value: string | null | undefined): string {
  if (!value) {
    return "Não informado";
  }

  return productTypeLabels[value] ?? value;
}

function getProductTypeTone(value: string | null | undefined): Tone {
  if (!value) {
    return "neutral";
  }

  return productTypeTones[value] ?? "neutral";
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-");

  if (!year || !month) {
    return value;
  }

  return `${month}/${year}`;
}

function ProductsTable({ products }: { products: ProductMetric[] }) {
  if (products.length === 0) {
    return (
      <EmptyState title="Nenhum produto usado">
        Nenhum registro de pulverização foi vinculado a produtos nesta safra.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)]">
      <table className="min-w-full divide-y divide-[rgba(25,35,29,0.10)] text-sm">
        <thead className="bg-[var(--pt-color-surface-muted)]">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
            <th className="px-3 py-3">Produto</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3 text-right">Aplicações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)]">
          {products.map((product) => (
            <tr
              key={`${product.product_id ?? product.product}-${
                product.product_type ?? ""
              }`}
            >
              <td className="px-3 py-3 font-semibold text-[var(--pt-color-structure-950)]">
                {product.product}
              </td>
              <td className="px-3 py-3">
                <StatusBadge tone={getProductTypeTone(product.product_type)}>
                  {formatProductType(product.product_type)}
                </StatusBadge>
              </td>
              <td className="px-3 py-3 text-right font-semibold text-[var(--pt-color-structure-950)]">
                {product.applications_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountList<T>({
  items,
  emptyTitle,
  emptyText,
  renderLabel,
}: {
  items: T[];
  emptyTitle: string;
  emptyText: string;
  renderLabel: (item: T) => string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item, index) => {
        const applicationsCount = (item as { applications_count: number })
          .applications_count;

        return (
          <div
            key={`${renderLabel(item)}-${index}`}
            className="flex items-center justify-between gap-4 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-4 py-3 text-sm"
          >
            <span className="min-w-0 truncate font-semibold text-[var(--pt-color-structure-800)]">
              {renderLabel(item)}
            </span>
            <StatusBadge tone="neutral">{applicationsCount}</StatusBadge>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitleIcon({ icon: Icon }: { icon: typeof BarChart3 }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-field-50)] text-[var(--pt-color-brand-900)]">
      <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
    </span>
  );
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<SeasonMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMetrics() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedMetrics = await getSeasonMetrics();

        if (isMounted) {
          setMetrics(loadedMetrics);
        }
      } catch (currentError) {
        if (isMounted) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : "Não foi possível carregar as métricas da safra.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppShell
      title="Métricas da Safra"
      subtitle="Acompanhe uso de produtos, aplicações por talhão e principais alvos registrados na safra."
    >
      <div className="grid gap-5">
        {isLoading ? <LoadingState label="Carregando métricas da safra..." /> : null}

        {error ? (
          <OperationalAlert
            title="Métricas indisponíveis"
            description={error}
            severity="attention"
          />
        ) : null}

        {metrics ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Talhões"
                value={metrics.summary.total_fields}
                detail={`${metrics.summary.active_fields} ativos`}
                tone="earth"
              />
              <StatCard
                label="Pulverizações"
                value={metrics.summary.total_spray_applications}
                tone="attention"
              />
              <StatCard
                label="Produtos usados"
                value={metrics.summary.total_products_used}
                tone="positive"
              />
              <StatCard
                label="Intervalo médio"
                value={`${formatNumber(
                  metrics.summary.average_planned_interval_days,
                )} dias`}
                tone="info"
              />
              <StatCard
                label="Meses com aplicação"
                value={metrics.spray_applications_by_month.length}
                tone="neutral"
              />
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard
                title="Produtos mais utilizados"
                description="Volume de aplicações registrado por produto na safra."
                action={<SectionTitleIcon icon={Package} />}
              >
                <ProductsTable products={metrics.top_products} />
              </SectionCard>

              <SectionCard
                title="Distribuição por tipo"
                description="Leitura por categoria técnica do produto aplicado."
                action={<SectionTitleIcon icon={Layers} />}
              >
                <CountList<ProductTypeMetric>
                  items={metrics.product_type_distribution}
                  emptyTitle="Nenhum tipo registrado"
                  emptyText="Nenhum produto foi associado a uma aplicação nesta safra."
                  renderLabel={(item) => formatProductType(item.product_type)}
                />
              </SectionCard>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <SectionCard
                title="Talhões com mais aplicações"
                description="Áreas com maior volume de entradas registradas."
                action={<SectionTitleIcon icon={BarChart3} />}
              >
                <CountList<FieldApplicationMetric>
                  items={metrics.top_fields_by_applications}
                  emptyTitle="Nenhum talhão com aplicação"
                  emptyText="Ainda não há aplicações vinculadas a talhões."
                  renderLabel={(item) => item.field_name}
                />
              </SectionCard>

              <SectionCard
                title="Alvos mais frequentes"
                description="Principais alvos declarados nos registros de pulverização."
                action={<SectionTitleIcon icon={Target} />}
              >
                <CountList<TargetMetric>
                  items={metrics.top_targets}
                  emptyTitle="Nenhum alvo registrado"
                  emptyText="Os alvos aparecerão aqui conforme as pulverizações forem lançadas."
                  renderLabel={(item) => item.target}
                />
              </SectionCard>

              <SectionCard
                title="Aplicações por mês"
                description="Distribuição mensal dos registros da safra."
                action={<SectionTitleIcon icon={CalendarDays} />}
              >
                <CountList<MonthlyApplicationMetric>
                  items={metrics.spray_applications_by_month}
                  emptyTitle="Nenhum mês com aplicação"
                  emptyText="Não há aplicação mensal registrada no período."
                  renderLabel={(item) => formatMonth(item.month)}
                />
              </SectionCard>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
