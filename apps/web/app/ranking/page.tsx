"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, MapPinned } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  LoadingState,
  OperationalAlert,
  PrimaryButton,
  RiskBadge,
  SecondaryButton,
  SectionCard,
  StatusBadge,
} from "@/components/design-system";
import { getCurrentFieldSituation, getRanking } from "@/lib/api";
import type {
  AttentionPriorityMetrics,
  CurrentFieldSituation,
  PriorityReason,
  RankingItem,
  RankingResponse,
} from "@/types/analysis";

type PriorityItem = RankingItem & {
  situation: CurrentFieldSituation | null;
};

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

type FactorStatus = {
  label: string;
  tone: Tone;
};

function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível carregar as prioridades da safra.";
}

function fixPortugueseText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("Nao", "Não")
    .replaceAll("nao", "não")
    .replaceAll("atencao", "atenção")
    .replaceAll("Atencao", "Atenção")
    .replaceAll("maxima", "máxima")
    .replaceAll("Maxima", "Máxima")
    .replaceAll("pulverizacao", "pulverização")
    .replaceAll("Pulverizacao", "Pulverização")
    .replaceAll("inspecao", "inspeção")
    .replaceAll("Inspecao", "Inspeção")
    .replaceAll("talhao", "talhão")
    .replaceAll("Talhao", "Talhão")
    .replaceAll("Historico", "Histórico")
    .replaceAll("historico", "histórico")
    .replaceAll("Classificacao", "Classificação")
    .replaceAll("classificacao", "classificação")
    .replaceAll("Pressao", "Pressão")
    .replaceAll("pressao", "pressão")
    .replaceAll("Presenca", "Presença")
    .replaceAll("presenca", "presença")
    .replaceAll("aplicacao", "aplicação")
    .replaceAll("Aplicacao", "Aplicação")
    .replaceAll("calendario", "calendário")
    .replaceAll("Calendario", "Calendário");
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(value?: string | null): string {
  if (!value) {
    return "N/A";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const labels: Record<string, string> = {
    sem_registro: "Sem registro",
    muito_alta: "Muito alta",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    vencida: "Vencida",
    critico: "Crítico",
    crítico: "Crítico",
    moderado: "Moderado",
    baixo: "Baixo",
    estavel: "Estável",
    estável: "Estável",
    monitoramento: "Monitoramento",
    alta_atencao: "Alta atenção",
    alta_atenção: "Alta atenção",
    prioridade_maxima: "Prioridade máxima",
    prioridade_máxima: "Prioridade máxima",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return fixPortugueseText(titleCase(value.replaceAll("_", " ")));
}

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function priorityLabel(item: PriorityItem): string {
  const rawLabel =
    item.priority_label ?? item.situation?.priority_label ?? item.priority;
  const normalized = normalizeText(rawLabel);

  if (
    item.situation?.inspection_context.symptoms_found === true &&
    (normalized.includes("ESTAVEL") || normalized.includes("BAIXA"))
  ) {
    return "Monitoramento";
  }

  if (normalized.includes("MAXIMA")) {
    return "Prioridade máxima";
  }

  if (normalized.includes("ALTA")) {
    return "Alta atenção";
  }

  if (normalized.includes("MONITOR")) {
    return "Monitoramento";
  }

  if (normalized.includes("ESTAVEL") || normalized.includes("BAIXA")) {
    return "Estável";
  }

  return rawLabel ? formatStatus(rawLabel) : "Não informado";
}

function confidenceLabel(item: PriorityItem): string {
  const rawLabel = item.confidence_label ?? item.situation?.confidence_label;
  const normalized = normalizeText(rawLabel);

  if (normalized.includes("ALTA")) {
    return "Alta";
  }

  if (normalized.includes("MEDIA")) {
    return "Média";
  }

  if (normalized.includes("BAIXA")) {
    return "Baixa";
  }

  return rawLabel ? formatStatus(rawLabel) : "Não informado";
}

function scoreLabel(value?: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}` : "N/A";
}

function priorityScore(item: PriorityItem): number | undefined {
  return item.priority_score ?? item.situation?.priority_score;
}

function confidenceScore(item: PriorityItem): number | undefined {
  return item.confidence_score ?? item.situation?.confidence_score;
}

function priorityTone(item: PriorityItem): Tone {
  const label = normalizeText(priorityLabel(item));
  const score = priorityScore(item);

  if (label.includes("MAXIMA") || (score !== undefined && score >= 75)) {
    return "critical";
  }

  if (label.includes("ALTA") || (score !== undefined && score >= 50)) {
    return "attention";
  }

  if (label.includes("MONITOR") || (score !== undefined && score >= 25)) {
    return "info";
  }

  if (label.includes("ESTAVEL") || (score !== undefined && score < 25)) {
    return "positive";
  }

  return "neutral";
}

function confidenceTone(item: PriorityItem): Tone {
  const label = normalizeText(confidenceLabel(item));

  if (label.includes("ALTA")) {
    return "positive";
  }

  if (label.includes("MEDIA")) {
    return "info";
  }

  if (label.includes("BAIXA")) {
    return "attention";
  }

  return "neutral";
}

function priorityBorderClassName(tone: Tone): string {
  const classNames: Record<Tone, string> = {
    positive: "border-l-[var(--pt-color-leaf-700)]",
    attention: "border-l-[var(--pt-color-attention-700)]",
    critical: "border-l-[var(--pt-color-critical-700)]",
    info: "border-l-[var(--pt-color-info-700)]",
    earth: "border-l-[var(--pt-color-earth-700)]",
    neutral: "border-l-[var(--pt-color-structure-300)]",
  };

  return classNames[tone];
}

function defenseTone(status?: string | null): Tone {
  const normalized = normalizeText(status);

  if (
    normalized.includes("VENCIDA") ||
    normalized.includes("BAIXA") ||
    normalized.includes("SEM REGISTRO")
  ) {
    return "attention";
  }

  if (normalized.includes("MEDIA")) {
    return "info";
  }

  if (normalized.includes("ALTA")) {
    return "positive";
  }

  return "neutral";
}

function formatDefenseValue(
  status?: string | null,
  percent?: number | null,
): string {
  const formattedStatus = status ? formatStatus(status) : null;

  if (!formattedStatus && typeof percent !== "number") {
    return "Não informado";
  }

  if (formattedStatus === "Sem registro") {
    return "Sem registro";
  }

  if (typeof percent === "number" && formattedStatus) {
    return `${Math.round(percent)}% · ${formattedStatus}`;
  }

  if (typeof percent === "number") {
    return `${Math.round(percent)}%`;
  }

  return formattedStatus ?? "Não informado";
}

function DefenseStatusBadge({
  status,
  percent,
}: {
  status?: string | null;
  percent?: number | null;
}) {
  return (
    <StatusBadge tone={defenseTone(status)}>
      {formatDefenseValue(status, percent)}
    </StatusBadge>
  );
}

function getSprayLabel(item: PriorityItem): string {
  const sprayContext = item.situation?.spray_context;

  if (!sprayContext?.has_spray_record || !sprayContext.last_application_date) {
    return "Sem pulverização registrada";
  }

  return formatDateTime(sprayContext.last_application_date);
}

function getInspectionLabel(item: PriorityItem): string {
  const inspectionContext = item.situation?.inspection_context;
  const inspectionDate =
    inspectionContext?.last_inspection_date ?? inspectionContext?.inspected_at;

  if (!inspectionContext?.has_inspection_record || !inspectionDate) {
    return "Sem inspeção registrada";
  }

  return formatDateTime(inspectionDate);
}

function getPriorityReasons(item: PriorityItem): PriorityReason[] {
  return item.main_reasons ?? item.situation?.main_reasons ?? [];
}

function getFallbackReasons(item: PriorityItem): string[] {
  if (item.situation?.reasons?.length) {
    return item.situation.reasons;
  }

  if (item.main_action) {
    return [item.main_action];
  }

  return [];
}

function getBlockScores(
  item: PriorityItem,
): AttentionPriorityMetrics["block_scores"] | undefined {
  return item.metrics?.block_scores ?? item.situation?.metrics?.block_scores;
}

function reasonCategoryLabel(reason: PriorityReason): string {
  const searchableText = normalizeText(
    `${reason.impact ?? ""} ${reason.code ?? ""} ${reason.label ?? ""}`,
  );

  if (
    searchableText.includes("DEFESA") ||
    searchableText.includes("SPRAY") ||
    searchableText.includes("PULVER")
  ) {
    return "Defesa";
  }

  if (
    searchableText.includes("INSPECAO") ||
    searchableText.includes("INSPECTION") ||
    searchableText.includes("SINTOMA")
  ) {
    return "Inspeção";
  }

  if (
    searchableText.includes("OPERACIONAL") ||
    searchableText.includes("CALEND") ||
    searchableText.includes("PEND")
  ) {
    return "Operacional";
  }

  if (
    searchableText.includes("HISTORICO") ||
    searchableText.includes("HISTORY") ||
    searchableText.includes("PRESSAO")
  ) {
    return "Histórico";
  }

  if (searchableText.includes("RISCO") || searchableText.includes("RISK")) {
    return "Risco";
  }

  return "Fator";
}

function joinPortugueseList(items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} e ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function lowerFirst(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

function getOperationalReading(item: PriorityItem): string {
  const label = priorityLabel(item);
  const reasons = getPriorityReasons(item);
  const operationalReasons = reasons
    .filter((reason) => reasonCategoryLabel(reason) !== "Risco")
    .slice(0, 3)
    .map((reason) => lowerFirst(fixPortugueseText(reason.label)));

  const riskReasons = reasons.filter(
    (reason) => reasonCategoryLabel(reason) === "Risco",
  );

  if (operationalReasons.length > 0) {
    const riskComplement =
      riskReasons.length > 0 ? ", com risco atual como fator complementar" : "";

    return `${label} operacional devido a: ${joinPortugueseList(
      operationalReasons,
    )}${riskComplement}.`;
  }

  if (riskReasons.length > 0) {
    return `${label} operacional com risco atual como fator complementar. Revise o talhão conforme a rotina de monitoramento.`;
  }

  return `${label} operacional. Use esta prioridade para organizar a próxima visita ou revisão de registros do talhão.`;
}

function blockStatus(value?: number | null, block?: string): FactorStatus {
  const score = typeof value === "number" ? value : 0;
  const normalizedBlock = normalizeText(block);

  if (score <= 0) {
    return {
      label: "Sem sinal",
      tone: "neutral",
    };
  }

  if (normalizedBlock.includes("RISCO")) {
    if (score >= 8) {
      return {
        label: "Complementar relevante",
        tone: "info",
      };
    }

    return {
      label: "Complementar",
      tone: "neutral",
    };
  }

  if (score >= 20) {
    return {
      label: "Atenção alta",
      tone: "attention",
    };
  }

  if (score >= 10) {
    return {
      label: "Atenção",
      tone: "info",
    };
  }

  return {
    label: "Sinal leve",
    tone: "neutral",
  };
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {value}
      </dd>
    </div>
  );
}

function ReasonList({
  item,
  compact = false,
}: {
  item: PriorityItem;
  compact?: boolean;
}) {
  const reasons = getPriorityReasons(item);
  const fallbackReasons = getFallbackReasons(item);
  const visibleReasons = compact ? reasons.slice(0, 3) : reasons;
  const visibleFallbackReasons = compact
    ? fallbackReasons.slice(0, 2)
    : fallbackReasons;

  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        Motivos da prioridade
      </h4>

      {visibleReasons.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {visibleReasons.map((reason, index) => (
            <li
              key={`${reason.code}-${index}`}
              className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
                  {fixPortugueseText(reason.label)}
                </p>
                <StatusBadge tone="neutral">
                  {reasonCategoryLabel(reason)}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {fixPortugueseText(reason.description)}
              </p>
            </li>
          ))}
        </ul>
      ) : visibleFallbackReasons.length > 0 ? (
        <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-[var(--pt-color-structure-700)]">
          {visibleFallbackReasons.map((reason) => (
            <li key={reason}>{fixPortugueseText(reason)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-600)]">
          Nenhum motivo informado pelo cálculo.
        </p>
      )}
    </div>
  );
}

function EvaluatedFactors({ item }: { item: PriorityItem }) {
  const blockScores = getBlockScores(item);

  if (!blockScores) {
    return null;
  }

  const blocks = [
    ["Defesa", blockScores.defense],
    ["Inspeção", blockScores.inspection],
    ["Pendências", blockScores.operational],
    ["Histórico", blockScores.history],
    ["Risco atual", blockScores.risk],
  ] as const;

  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        Fatores avaliados
      </h4>
      <dl className="mt-3 grid gap-2 sm:grid-cols-5">
        {blocks.map(([label, value]) => {
          const factor = blockStatus(value, label);

          return (
            <div key={label}>
              <dt className="text-xs text-[var(--pt-color-structure-500)]">
                {label}
              </dt>
              <dd className="mt-1">
                <StatusBadge tone={factor.tone}>{factor.label}</StatusBadge>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function UrgentFieldCard({ item }: { item: PriorityItem }) {
  const tone = priorityTone(item);
  const sprayContext = item.situation?.spray_context;

  return (
    <SectionCard
      title="Talhão para olhar primeiro"
      description="Prioridade operacional baseada em pulverização, inspeção, calendário, histórico e risco atual. A leitura não é diagnóstico de doença nem recomendação de defensivo."
      action={
        <PrimaryButton href={`/talhoes/${item.field_id}`} icon={MapPinned}>
          Ver talhão
        </PrimaryButton>
      }
      className={`border-l-4 ${priorityBorderClassName(tone)}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[var(--pt-color-structure-500)]">
          #{item.rank}
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--pt-color-structure-950)]">
          {item.field_name}
        </h2>
        <StatusBadge tone={tone}>{priorityLabel(item)}</StatusBadge>
        <StatusBadge tone={confidenceTone(item)}>
          Confiança {confidenceLabel(item)}
        </StatusBadge>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DetailMetric
          label="Prioridade de Atenção"
          value={`${scoreLabel(priorityScore(item))}/100`}
        />
        <DetailMetric
          label="Confiança da análise"
          value={`${scoreLabel(confidenceScore(item))}/100`}
        />
        <DetailMetric label="Risco atual avaliado" value={item.disease} />
        <DetailMetric
          label="Classificação de risco"
          value={<RiskBadge value={item.risk_classification} />}
        />
        <DetailMetric
          label="Defesa estimada"
          value={
            <DefenseStatusBadge
              status={sprayContext?.defense_status}
              percent={sprayContext?.estimated_defense_percent}
            />
          }
        />
        <DetailMetric label="Última pulverização" value={getSprayLabel(item)} />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <OperationalAlert
          title="Leitura operacional"
          description={getOperationalReading(item)}
          severity={tone === "critical" ? "critical" : "info"}
        />
        <ReasonList item={item} compact />
      </div>
    </SectionCard>
  );
}

function PriorityRow({ item }: { item: PriorityItem }) {
  const tone = priorityTone(item);
  const sprayContext = item.situation?.spray_context;

  return (
    <article
      className={`rounded-[var(--pt-radius-lg)] border border-l-4 border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] p-4 ${priorityBorderClassName(
        tone,
      )}`}
    >
      <div className="grid gap-4 xl:grid-cols-[72px_1.15fr_1.45fr_auto] xl:items-start">
        <div className="flex items-center gap-3 xl:grid xl:gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-field-50)] text-base font-semibold text-[var(--pt-color-brand-900)]">
            #{item.rank}
          </span>
          <StatusBadge tone={tone}>{priorityLabel(item)}</StatusBadge>
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--pt-color-structure-950)]">
            {item.field_name}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
            {item.city} · {fixPortugueseText(item.crop_stage)}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <DetailMetric
              label="Prioridade de Atenção"
              value={`${scoreLabel(priorityScore(item))}/100`}
            />
            <DetailMetric
              label="Confiança da análise"
              value={
                <span className="inline-flex items-center gap-2">
                  {scoreLabel(confidenceScore(item))}/100
                  <StatusBadge tone={confidenceTone(item)}>
                    {confidenceLabel(item)}
                  </StatusBadge>
                </span>
              }
            />
            <DetailMetric label="Risco atual avaliado" value={item.disease} />
            <DetailMetric
              label="Classificação"
              value={<RiskBadge value={item.risk_classification} />}
            />
            <DetailMetric
              label="Defesa estimada"
              value={
                <DefenseStatusBadge
                  status={sprayContext?.defense_status}
                  percent={sprayContext?.estimated_defense_percent}
                />
              }
            />
            <DetailMetric
              label="Última inspeção"
              value={getInspectionLabel(item)}
            />
          </dl>
        </div>

        <div className="grid gap-3">
          <ReasonList item={item} compact />
          <EvaluatedFactors item={item} />
        </div>

        <SecondaryButton
          href={`/talhoes/${item.field_id}`}
          icon={ChevronRight}
          iconPosition="right"
          className="xl:justify-self-end"
        >
          Ver detalhes
        </SecondaryButton>
      </div>
    </article>
  );
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [situations, setSituations] = useState<
    Record<string, CurrentFieldSituation | null>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadPriorities() {
      setIsLoading(true);
      setError(null);

      try {
        const rankingResponse = await getRanking();
        const uniqueFieldIds = Array.from(
          new Set(rankingResponse.ranking.map((item) => item.field_id)),
        );
        const situationEntries = await Promise.all(
          uniqueFieldIds.map(async (fieldId) => {
            try {
              return [fieldId, await getCurrentFieldSituation(fieldId)] as const;
            } catch {
              return [fieldId, null] as const;
            }
          }),
        );

        if (!ignore) {
          setRanking(rankingResponse);
          setSituations(Object.fromEntries(situationEntries));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadPriorities();

    return () => {
      ignore = true;
    };
  }, []);

  const priorityItems = useMemo<PriorityItem[]>(() => {
    return (
      ranking?.ranking.map((item) => ({
        ...item,
        situation: situations[item.field_id] ?? null,
      })) ?? []
    );
  }, [ranking, situations]);

  const topPriority = priorityItems[0] ?? null;

  return (
    <AppShell
      title="Prioridade de Atenção do Talhão"
      subtitle="Lista operacional para decidir quais talhões olhar primeiro, com prioridade, confiança da análise e motivos do cálculo."
    >
      <div className="grid gap-5">
        {isLoading ? (
          <LoadingState label="Carregando prioridade dos talhões..." />
        ) : error ? (
          <OperationalAlert
            title="Prioridades indisponíveis"
            description={error}
            severity="attention"
          />
        ) : !topPriority ? (
          <EmptyState title="Nenhuma prioridade encontrada">
            Cadastre talhões e mantenha os registros de manejo atualizados para
            gerar a lista de prioridades da safra.
          </EmptyState>
        ) : (
          <>
            <UrgentFieldCard item={topPriority} />

            <SectionCard
              title="Ranking de atenção"
              description={`${priorityItems.length} item${
                priorityItems.length === 1 ? "" : "s"
              } ordenado${
                priorityItems.length === 1 ? "" : "s"
              } pela Prioridade de Atenção do Talhão.`}
              action={
                <StatusBadge tone="neutral">
                  Atualizado em {formatDateTime(ranking?.generated_at)}
                </StatusBadge>
              }
            >
              <div className="grid gap-3">
                {priorityItems.map((item) => (
                  <PriorityRow
                    key={`${item.field_id}-${item.disease}`}
                    item={item}
                  />
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </AppShell>
  );
}