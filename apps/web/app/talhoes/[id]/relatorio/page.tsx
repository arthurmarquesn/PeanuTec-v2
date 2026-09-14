"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList, FileText } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  LoadingState,
  OperationalAlert,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";
import { getFieldTechnicalReport, getFieldTechnicalReportPdfUrl } from "@/lib/api";
import type {
  FieldTechnicalReport,
  FieldTechnicalReportTimelineItem,
  PriorityReason,
} from "@/types/analysis";

type BadgeTone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
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
    .replaceAll("Responsavel", "Responsável")
    .replaceAll("responsavel", "responsável")
    .replaceAll("Observacoes", "Observações")
    .replaceAll("observacoes", "observações");
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
    nenhuma: "Nenhuma",
    vencida: "Vencida",
    atrasado: "Atrasado",
    atencao: "Atenção",
    em_dia: "Em dia",
    critico: "Crítico",
    moderado: "Moderado",
    baixo: "Baixo",
    estavel: "Estável",
    monitorar: "Monitorar",
    monitoramento: "Monitoramento",
    alta_atencao: "Alta atenção",
    prioridade_maxima: "Prioridade máxima",
    consultar_responsavel: "Consultar responsável",
    manejo_realizado: "Manejo realizado",
    boa: "Boa",
    regular: "Regular",
    critica: "Crítica",
    ausente: "Ausente",
    localizado: "Localizado",
    reboleiras: "Reboleiras",
    espalhado: "Espalhado",
    generalizado: "Generalizado",
    seco: "Seco",
    adequado: "Adequado",
    umido: "Úmido",
    encharcado: "Encharcado",
    compactado: "Compactado",
    nao_avaliado: "Não avaliado",
    planting: "Plantio",
    inspection: "Inspeção",
    spray: "Pulverização",
    em_campo: "Em campo",
    pre_arranquio: "Pré-arranquio",
    arrancado: "Arrancado",
    colhido: "Colhido",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return fixPortugueseText(titleCase(value.replaceAll("_", " ")));
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "N/A";
  }

  const parsedDate = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsedDate);
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

function formatBoolean(value?: boolean | null): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return value ? "Sim" : "Não";
}

function formatScore(value?: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}` : "N/A";
}

function priorityTone(label?: string | null, score?: number | null): BadgeTone {
  const normalized = normalizeText(label);

  if (normalized.includes("MAXIMA") || (score !== undefined && score !== null && score >= 75)) {
    return "critical";
  }

  if (normalized.includes("ALTA") || (score !== undefined && score !== null && score >= 50)) {
    return "attention";
  }

  if (normalized.includes("MONITOR") || (score !== undefined && score !== null && score >= 25)) {
    return "info";
  }

  if (normalized.includes("ESTAVEL")) {
    return "positive";
  }

  return "neutral";
}

function confidenceTone(label?: string | null): BadgeTone {
  const normalized = normalizeText(label);

  if (normalized.includes("ALTA")) {
    return "positive";
  }

  if (normalized.includes("MEDIA")) {
    return "info";
  }

  if (normalized.includes("BAIXA")) {
    return "attention";
  }

  return "neutral";
}

function reasonCategoryLabel(reason: PriorityReason): string {
  const searchableText = normalizeText(
    `${reason.impact ?? ""} ${reason.code ?? ""} ${reason.label ?? ""}`,
  );

  if (searchableText.includes("DEFESA") || searchableText.includes("SPRAY")) {
    return "Defesa";
  }

  if (searchableText.includes("INSPECAO") || searchableText.includes("SINTOMA")) {
    return "Inspeção";
  }

  if (searchableText.includes("OPERACIONAL") || searchableText.includes("CALENDARIO")) {
    return "Operacional";
  }

  if (searchableText.includes("HISTOR")) {
    return "Histórico";
  }

  if (searchableText.includes("RISCO")) {
    return "Risco";
  }

  return formatStatus(reason.impact);
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {value}
      </dd>
    </div>
  );
}

function ReasonsList({ reasons }: { reasons: PriorityReason[] }) {
  if (reasons.length === 0) {
    return (
      <EmptyState title="Sem motivos detalhados">
        O relatório não recebeu motivos adicionais para esta prioridade.
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3">
      {reasons.map((reason) => (
        <li
          key={reason.code}
          className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
                {fixPortugueseText(reason.label)}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {fixPortugueseText(reason.description)}
              </p>
            </div>
            <StatusBadge tone="neutral">{reasonCategoryLabel(reason)}</StatusBadge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ item }: { item: FieldTechnicalReportTimelineItem }) {
  return (
    <li className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="earth">{formatStatus(item.type)}</StatusBadge>
            <p className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
              {fixPortugueseText(item.title)}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
            {fixPortugueseText(item.description)}
          </p>
        </div>
        <span className="text-sm font-medium text-[var(--pt-color-structure-600)]">
          {item.date.includes("T") ? formatDateTime(item.date) : formatDate(item.date)}
        </span>
      </div>
    </li>
  );
}

export default function FieldTechnicalReportPage() {
  const params = useParams<{ id: string }>();
  const fieldId = useMemo(() => {
    const value = params.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params.id]);

  const [report, setReport] = useState<FieldTechnicalReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getFieldTechnicalReport(fieldId);

        if (!ignore) {
          setReport(data);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o relatório técnico.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      ignore = true;
    };
  }, [fieldId]);

  const situation = report?.current_situation;
  const sprayContext = situation?.spray_context;
  const priorityLabel = situation?.priority_label ?? situation?.situation_label;
  const priorityScore = situation?.priority_score;
  const confidenceLabel = situation?.confidence_label;

  return (
    <AppShell title="Relatório Técnico do Talhão">
      <div className="mx-auto grid max-w-7xl gap-5">
        <SectionCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--pt-color-earth-700)]">
                Relatório operacional de apoio
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--pt-color-structure-950)]">
                Relatório Técnico do Talhão
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {report
                  ? `${report.field.nome} · ${report.field.cidade} · ${report.field.cultura} · plantio em ${formatDate(report.field.data_plantio)} · ${formatStatus(report.field.status_lavoura)}`
                  : "Consolidação operacional dos registros do talhão."}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton
                href={getFieldTechnicalReportPdfUrl(fieldId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Exportar PDF
              </PrimaryButton>
            <SecondaryButton
              href={`/talhoes/${fieldId}`}
              icon={ArrowLeft}
            >
              Voltar ao talhão
            </SecondaryButton>
            </div>
          </div>
        </SectionCard>

        {isLoading ? (
          <LoadingState label="Carregando relatório técnico do talhão..." />
        ) : null}

        {error ? (
          <OperationalAlert
            title="Não foi possível carregar o relatório"
            description={error}
            severity="critical"
          />
        ) : null}

        {!isLoading && !error && report ? (
          <>
            <OperationalAlert
              title="Uso do relatório"
              description={report.safety_note}
              severity="info"
              context={formatDateTime(report.generated_at)}
            />

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Prioridade de Atenção"
                value={formatScore(priorityScore)}
                detail={priorityLabel ? formatStatus(priorityLabel) : "Não informado"}
                tone={priorityTone(priorityLabel, priorityScore)}
              />
              <StatCard
                label="Confiança da análise"
                value={formatScore(situation?.confidence_score)}
                detail={confidenceLabel ? formatStatus(confidenceLabel) : "Não informado"}
                tone={confidenceTone(confidenceLabel)}
              />
              <StatCard
                label="Próximo passo operacional"
                value="Acompanhar"
                detail={fixPortugueseText(situation?.recommended_next_action)}
                tone="earth"
              />
              {sprayContext ? (
                <StatCard
                  label="Defesa estimada"
                  value={
                    sprayContext.estimated_defense_percent === null ||
                    sprayContext.estimated_defense_percent === undefined
                      ? "N/A"
                      : `${sprayContext.estimated_defense_percent}%`
                  }
                  detail={formatStatus(sprayContext.defense_status)}
                  tone="neutral"
                />
              ) : null}
            </section>

            <SectionCard
              title="Prioridade atual"
              description="Leitura operacional para decidir quais pontos do talhão merecem atenção primeiro."
            >
              <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={priorityTone(priorityLabel, priorityScore)}>
                      {priorityLabel ? formatStatus(priorityLabel) : "Não informado"}
                    </StatusBadge>
                    <StatusBadge tone={confidenceTone(confidenceLabel)}>
                      Confiança: {confidenceLabel ? formatStatus(confidenceLabel) : "N/A"}
                    </StatusBadge>
                  </div>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-[var(--pt-color-structure-950)]">
                    {formatScore(priorityScore)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                    {fixPortugueseText(situation?.summary)}
                  </p>
                </div>

                <ReasonsList reasons={situation?.main_reasons ?? []} />
              </div>
            </SectionCard>

            <SectionCard title="Última inspeção" description="Registro observacional mais recente informado para o talhão.">
              {report.latest_inspection ? (
                <div className="grid gap-4">
                  <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Data" value={formatDateTime(report.latest_inspection.inspected_at)} />
                    <DetailItem label="Responsável" value={report.latest_inspection.responsible} />
                    <DetailItem label="Doença observada" value={report.latest_inspection.disease} />
                    <DetailItem label="Sintomas" value={formatBoolean(report.latest_inspection.symptoms_found)} />
                    <DetailItem label="Severidade visual" value={formatStatus(report.latest_inspection.visual_severity)} />
                    <DetailItem label="Desfolha" value={formatStatus(report.latest_inspection.defoliation_level)} />
                    <DetailItem label="Situação geral" value={formatStatus(report.latest_inspection.general_status)} />
                    <DetailItem label="Distribuição do problema" value={formatStatus(report.latest_inspection.problem_distribution)} />
                    <DetailItem label="Pragas observadas" value={formatBoolean(report.latest_inspection.pests_found)} />
                    <DetailItem label="Observações de pragas" value={report.latest_inspection.pest_notes} />
                    <DetailItem label="Plantas daninhas" value={formatBoolean(report.latest_inspection.weeds_found)} />
                    <DetailItem label="Pressão de plantas daninhas" value={formatStatus(report.latest_inspection.weed_pressure)} />
                    <DetailItem label="Condição do solo" value={formatStatus(report.latest_inspection.soil_condition)} />
                    <DetailItem label="Necessidade de retorno" value={formatBoolean(report.latest_inspection.return_needed)} />
                    <DetailItem
                      label="Prazo de retorno"
                      value={
                        report.latest_inspection.return_days === null ||
                        report.latest_inspection.return_days === undefined
                          ? null
                          : `${report.latest_inspection.return_days} dias`
                      }
                    />
                    <DetailItem label="Área/ponto observado" value={report.latest_inspection.observed_area} />
                  </dl>
                  {report.latest_inspection.notes ? (
                    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
                        Observações
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                        {report.latest_inspection.notes}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState title="Sem inspeções registradas" icon={ClipboardList}>
                  Ainda não há inspeção registrada para este talhão.
                </EmptyState>
              )}
            </SectionCard>

            <SectionCard title="Última pulverização" description="Registro operacional mais recente de pulverização informado para o talhão.">
              {report.latest_spray_application ? (
                <div className="grid gap-4">
                  <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Produto" value={report.latest_spray_application.product} />
                    <DetailItem label="Alvo" value={report.latest_spray_application.target} />
                    <DetailItem label="Dose" value={report.latest_spray_application.dose} />
                    <DetailItem label="Responsável" value={report.latest_spray_application.responsible} />
                    <DetailItem label="Data" value={formatDateTime(report.latest_spray_application.application_date)} />
                    <DetailItem
                      label="Intervalo planejado"
                      value={
                        report.latest_spray_application.planned_interval_days === null ||
                        report.latest_spray_application.planned_interval_days === undefined
                          ? null
                          : `${report.latest_spray_application.planned_interval_days} dias`
                      }
                    />
                    <DetailItem
                      label="Dias desde aplicação"
                      value={report.latest_spray_application.days_since_application}
                    />
                    <DetailItem
                      label="Status do intervalo"
                      value={formatStatus(report.latest_spray_application.interval_status)}
                    />
                  </dl>
                  {report.latest_spray_application.notes ? (
                    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
                        Observações
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                        {report.latest_spray_application.notes}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState title="Sem pulverizações registradas" icon={FileText}>
                  Ainda não há pulverização registrada para este talhão.
                </EmptyState>
              )}
            </SectionCard>

            <SectionCard title="Resumos operacionais">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Inspeções"
                  value={report.inspections_summary.total}
                  detail={`${report.inspections_summary.symptoms_found_count} com sintomas registrados`}
                  tone="info"
                />
                <StatCard
                  label="Retornos indicados"
                  value={report.inspections_summary.return_needed_count}
                  detail={
                    report.inspections_summary.last_responsible
                      ? `Último responsável: ${report.inspections_summary.last_responsible}`
                      : "Sem responsável informado"
                  }
                  tone="earth"
                />
                <StatCard
                  label="Pulverizações"
                  value={report.spray_summary.total}
                  detail={report.spray_summary.last_product ?? "Sem produto registrado"}
                  tone="neutral"
                />
                <StatCard
                  label="Último intervalo"
                  value={formatStatus(report.spray_summary.last_interval_status)}
                  detail={
                    report.spray_summary.days_since_last_application === null
                      ? "Sem aplicação registrada"
                      : `${report.spray_summary.days_since_last_application} dias desde a última aplicação`
                  }
                  tone="attention"
                />
              </div>
            </SectionCard>

            <SectionCard title="Linha do tempo operacional">
              {report.timeline.length > 0 ? (
                <ol className="grid gap-3">
                  {report.timeline.map((item) => (
                    <TimelineItem
                      key={`${item.type}-${item.date}-${item.title}`}
                      item={item}
                    />
                  ))}
                </ol>
              ) : (
                <EmptyState title="Sem eventos operacionais" icon={CalendarDays}>
                  O relatório não recebeu eventos para a linha do tempo deste talhão.
                </EmptyState>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
