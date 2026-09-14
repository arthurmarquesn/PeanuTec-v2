"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Eye,
  FilePlus2,
  ListChecks,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  createField,
  deleteField,
  getFields,
  getRanking,
  getSupportedDiseases,
} from "@/lib/api";
import { StatusBadge } from "@/components/design-system";
import type {
  CropStatus,
  DiseaseIncidenceLevel,
  FieldRegistrationRequest,
  HistoricalPressure,
  PriorityReason,
  RankingItem,
  RankingResponse,
  RegisteredField,
  SupportedDisease,
} from "@/types/analysis";

type FieldFormState = {
  nome: string;
  cidade: string;
  cultura: string;
  data_plantio: string;
  status_lavoura: CropStatus;
  doencas_monitoradas: string[];
  previous_crop: string;
  crop_rotation: "" | "true" | "false";
  peanut_repetition_years: number | "";
  had_disease_incidence: "" | "true" | "false";
  previous_diseases: string;
  disease_incidence_level: "" | DiseaseIncidenceLevel;
  historical_pressure: "" | HistoricalPressure;
  agronomic_history_notes: string;
};

const initialFieldForm: FieldFormState = {
  nome: "",
  cidade: "Tupa-SP",
  cultura: "Amendoim",
  data_plantio: "2026-04-10",
  status_lavoura: "em_campo",
  doencas_monitoradas: ["Mancha-preta", "Mancha-castanha"],
  previous_crop: "",
  crop_rotation: "",
  peanut_repetition_years: "",
  had_disease_incidence: "",
  previous_diseases: "",
  disease_incidence_level: "",
  historical_pressure: "",
  agronomic_history_notes: "",
};

const cropStatuses: { value: CropStatus; label: string }[] = [
  { value: "em_campo", label: "Em campo" },
  { value: "pre_arranquio", label: "Pré-arranquio" },
  { value: "arrancado", label: "Arrancado" },
  { value: "colhido", label: "Colhido" },
];

const incidenceLevelOptions: { value: DiseaseIncidenceLevel; label: string }[] =
  [
    { value: "nenhuma", label: "Nenhuma" },
    { value: "baixa", label: "Baixa" },
    { value: "media", label: "Média" },
    { value: "alta", label: "Alta" },
  ];

const historicalPressureOptions: { value: HistoricalPressure; label: string }[] =
  [
    { value: "baixa", label: "Baixa" },
    { value: "media", label: "Média" },
    { value: "alta", label: "Alta" },
  ];

const inputClassName = "pt-input";
const textareaClassName = "pt-textarea";

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

function friendlyErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível completar a operação. Verifique a API e tente novamente.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  ) {
    return "Não foi possível conectar ao backend do PeanuTec. Confirme se o Next está rodando na porta 3000.";
  }

  if (message.includes("cidade nao encontrada")) {
    return "Cidade não encontrada no geocoding. Revise o nome da cidade.";
  }

  if (
    message.includes("value error") ||
    message.includes("field required") ||
    message.includes("input should")
  ) {
    return `Revise os dados do formulário: ${error.message}`;
  }

  return error.message || fallback;
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

function formatDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsedDate);
}

function formatGeneratedAt(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsedDate);
}

function scoreLabel(value?: number | null): string {
  return typeof value === "number" ? `${Math.round(value)}` : "N/A";
}

function priorityLabel(item: RankingItem): string {
  const rawLabel = item.priority_label ?? item.priority;
  const normalized = normalizeText(rawLabel);

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

function confidenceLabel(item: RankingItem): string {
  const normalized = normalizeText(item.confidence_label);

  if (normalized.includes("ALTA")) {
    return "Alta";
  }

  if (normalized.includes("MEDIA")) {
    return "Média";
  }

  if (normalized.includes("BAIXA")) {
    return "Baixa";
  }

  return item.confidence_label ? formatStatus(item.confidence_label) : "Não informado";
}

function priorityTone(item: RankingItem): Tone {
  const label = normalizeText(priorityLabel(item));
  const score = item.priority_score;

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

function confidenceTone(item: RankingItem): Tone {
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

function priorityCardClassName(item: RankingItem): string {
  const classNames: Record<Tone, string> = {
    positive: "border-l-[var(--pt-color-leaf-700)]",
    attention: "border-l-[var(--pt-color-attention-700)]",
    critical: "border-l-[var(--pt-color-critical-700)]",
    info: "border-l-[var(--pt-color-info-700)]",
    earth: "border-l-[var(--pt-color-earth-700)]",
    neutral: "border-l-[var(--pt-color-structure-300)]",
  };

  return classNames[priorityTone(item)];
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

function topReason(item: RankingItem): PriorityReason | undefined {
  return item.main_reasons?.[0];
}

function topReasonLabel(item: RankingItem): string {
  const reason = topReason(item);

  if (reason) {
    return fixPortugueseText(reason.label);
  }

  return fixPortugueseText(item.main_action ?? "Motivo principal não informado.");
}

function topReasonDescription(item: RankingItem): string | null {
  const reason = topReason(item);

  if (reason?.description) {
    return fixPortugueseText(reason.description);
  }

  return null;
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

function operationalReading(item: RankingItem): string {
  const label = priorityLabel(item);
  const reasons = item.main_reasons ?? [];
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

function statusLabel(status: CropStatus): string {
  const found = cropStatuses.find((item) => item.value === status);

  return found?.label ?? formatStatus(status);
}

function booleanLabel(value: boolean | null | undefined): string {
  if (value === true) {
    return "Sim";
  }

  if (value === false) {
    return "Não";
  }

  return "Não informado";
}

function optionalBoolean(value: "" | "true" | "false"): boolean | null {
  if (value === "") {
    return null;
  }

  return value === "true";
}

function optionalNumber(value: number | ""): number | null {
  return value === "" ? null : value;
}

function optionalText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function FieldLabel({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="pt-label">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--pt-color-structure-500)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
        {description}
      </p>
    </div>
  );
}

function RankingRow({ item }: { item: RankingItem }) {
  const reason = topReason(item);
  const description = topReasonDescription(item);

  return (
    <li className={`pt-card border-l-4 p-4 ${priorityCardClassName(item)}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--pt-color-structure-500)]">
              #{item.rank}
            </span>

            <Link
              href={`/talhoes/${item.field_id}`}
              className="text-base font-semibold text-[var(--pt-color-structure-950)] underline-offset-4 hover:underline"
            >
              {item.field_name}
            </Link>

            <StatusBadge tone={priorityTone(item)}>
              {priorityLabel(item)}
            </StatusBadge>

            <StatusBadge tone={confidenceTone(item)}>
              Confiança {confidenceLabel(item)}
            </StatusBadge>
          </div>

          <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
            {item.city} · {fixPortugueseText(item.crop_stage)}
          </p>

          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--pt-color-structure-800)]">
            {operationalReading(item)}
          </p>

          <div className="mt-3 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
                {topReasonLabel(item)}
              </p>

              {reason ? (
                <StatusBadge tone="neutral">
                  {reasonCategoryLabel(reason)}
                </StatusBadge>
              ) : null}
            </div>

            {description ? (
              <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="grid min-w-full grid-cols-2 gap-2 text-sm sm:min-w-[360px] sm:grid-cols-4">
          <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Prioridade
            </dt>
            <dd className="mt-1 font-semibold text-[var(--pt-color-structure-950)]">
              {scoreLabel(item.priority_score)}/100
            </dd>
          </div>

          <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Confiança
            </dt>
            <dd className="mt-1 font-semibold text-[var(--pt-color-structure-950)]">
              {scoreLabel(item.confidence_score)}/100
            </dd>
          </div>

          <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Risco atual
            </dt>
            <dd className="mt-1 font-semibold text-[var(--pt-color-earth-800)]">
              {formatStatus(item.risk_classification)}
            </dd>
          </div>

          <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Motivos
            </dt>
            <dd className="mt-1 font-semibold text-[var(--pt-color-structure-950)]">
              {item.main_reasons?.length ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

export function FieldDashboard() {
  const [form, setForm] = useState<FieldFormState>(initialFieldForm);
  const [diseases, setDiseases] = useState<SupportedDisease[]>([]);
  const [fields, setFields] = useState<RegisteredField[]>([]);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isSavingField, setIsSavingField] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      setIsLoadingFields(true);

      try {
        const [diseasesResponse, fieldsResponse] = await Promise.all([
          getSupportedDiseases(),
          getFields(),
        ]);

        if (ignore) {
          return;
        }

        setDiseases(diseasesResponse.supported_diseases);
        setFields(fieldsResponse);

        if (diseasesResponse.supported_diseases.length > 0) {
          setForm((current) => ({
            ...current,
            doencas_monitoradas: diseasesResponse.supported_diseases.map(
              (disease) => disease.id,
            ),
          }));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoadingFields(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  const canSubmit = useMemo(
    () => !isSavingField && form.doencas_monitoradas.length > 0,
    [form.doencas_monitoradas.length, isSavingField],
  );

  function updateField<K extends keyof FieldFormState>(
    key: K,
    value: FieldFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleDisease(diseaseId: string) {
    setForm((current) => {
      const isSelected = current.doencas_monitoradas.includes(diseaseId);

      return {
        ...current,
        doencas_monitoradas: isSelected
          ? current.doencas_monitoradas.filter((id) => id !== diseaseId)
          : [...current.doencas_monitoradas, diseaseId],
      };
    });
  }

  async function refreshFields() {
    setIsLoadingFields(true);
    setError(null);

    try {
      setFields(await getFields());
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setIsLoadingFields(false);
    }
  }

  async function handleCreateField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingField(true);
    setError(null);
    setMessage(null);

    const payload: FieldRegistrationRequest = {
      nome: form.nome,
      cidade: form.cidade,
      cultura: form.cultura,
      data_plantio: form.data_plantio,
      status_lavoura: form.status_lavoura,
      doencas_monitoradas: form.doencas_monitoradas,
      previous_crop: optionalText(form.previous_crop),
      crop_rotation: optionalBoolean(form.crop_rotation),
      peanut_repetition_years: optionalNumber(form.peanut_repetition_years),
      had_disease_incidence: optionalBoolean(form.had_disease_incidence),
      previous_diseases: optionalText(form.previous_diseases),
      disease_incidence_level: form.disease_incidence_level || null,
      historical_pressure: form.historical_pressure || null,
      agronomic_history_notes: optionalText(form.agronomic_history_notes),
    };

    try {
      const createdField = await createField(payload);
      setFields((current) => [...current, createdField]);
      setForm(initialFieldForm);
      setRanking(null);
      setMessage("Talhão cadastrado com sucesso.");
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setIsSavingField(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    setError(null);
    setMessage(null);

    try {
      await deleteField(fieldId);
      setFields((current) => current.filter((field) => field.id !== fieldId));
      setRanking(null);
      setMessage("Talhão removido.");
    } catch (deleteError) {
      setError(friendlyErrorMessage(deleteError));
    }
  }

  async function handleRefreshRanking() {
    setIsLoadingRanking(true);
    setError(null);
    setMessage(null);

    try {
      setRanking(await getRanking());
    } catch (rankingError) {
      setError(friendlyErrorMessage(rankingError));
    } finally {
      setIsLoadingRanking(false);
    }
  }

  return (
    <div className="grid gap-5">
      {(error || message) && (
        <div
          className={`rounded-[var(--pt-radius-lg)] border px-4 py-3 text-sm font-medium ${
            error
              ? "border-[rgba(140,63,50,0.28)] bg-[var(--pt-color-critical-100)] text-[var(--pt-color-critical-700)]"
              : "border-[rgba(47,112,70,0.28)] bg-[var(--pt-color-leaf-100)] text-[var(--pt-color-leaf-700)]"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(380px,450px)_1fr]">
        <form onSubmit={handleCreateField} className="pt-card self-start">
          <div className="border-b border-[rgba(25,35,29,0.10)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pt-color-earth-700)]">
              Cadastro de área
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--pt-color-structure-950)]">
              Cadastrar talhão
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
              Registre uma área produtiva para acompanhar risco, histórico,
              inspeções e pulverizações durante a safra.
            </p>
          </div>

          <div className="grid gap-5 px-5 py-5">
            <section className="grid gap-4">
              <SectionHeading
                title="Identificação do talhão"
                description="Informe os dados básicos da área monitorada."
              />

              <FieldLabel label="Nome do talhão">
                <input
                  required
                  value={form.nome}
                  onChange={(event) => updateField("nome", event.target.value)}
                  className={inputClassName}
                  placeholder="Talhão A1"
                />
              </FieldLabel>

              <FieldLabel label="Cidade">
                <input
                  required
                  value={form.cidade}
                  onChange={(event) =>
                    updateField("cidade", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Tupã-SP"
                />
              </FieldLabel>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Cultura">
                  <input
                    required
                    value={form.cultura}
                    onChange={(event) =>
                      updateField("cultura", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Amendoim"
                  />
                </FieldLabel>

                <FieldLabel label="Data de plantio">
                  <input
                    required
                    type="date"
                    value={form.data_plantio}
                    onChange={(event) =>
                      updateField("data_plantio", event.target.value)
                    }
                    className={inputClassName}
                  />
                </FieldLabel>
              </div>

              <FieldLabel label="Status da lavoura">
                <select
                  value={form.status_lavoura}
                  onChange={(event) =>
                    updateField(
                      "status_lavoura",
                      event.target.value as CropStatus,
                    )
                  }
                  className={inputClassName}
                >
                  {cropStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </section>

            <section className="grid gap-3 rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)] p-4">
              <SectionHeading
                title="Doenças monitoradas"
                description="Selecione as doenças que serão acompanhadas neste talhão."
              />

              <div className="grid gap-2">
                {diseases.map((disease) => (
                  <label
                    key={disease.id}
                    className="flex items-start gap-3 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-3 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.doencas_monitoradas.includes(disease.id)}
                      onChange={() => toggleDisease(disease.id)}
                      className="mt-1 h-4 w-4 accent-[var(--pt-color-brand-800)]"
                    />
                    <span>
                      <span className="block font-semibold text-[var(--pt-color-structure-950)]">
                        {disease.name}
                      </span>
                      <span className="text-xs text-[var(--pt-color-structure-500)]">
                        {disease.pathogen}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="grid gap-4 rounded-[var(--pt-radius-lg)] border border-[rgba(114,86,58,0.20)] bg-[var(--pt-color-earth-100)] p-4">
              <SectionHeading
                title="Histórico agronômico da área"
                description="Essas informações ajudam a contextualizar a pressão histórica do talhão sem substituir a avaliação técnica."
              />

              <FieldLabel label="Cultura anterior">
                <input
                  value={form.previous_crop}
                  onChange={(event) =>
                    updateField("previous_crop", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Milho, soja, pastagem..."
                />
              </FieldLabel>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Houve rotação de cultura?">
                  <select
                    value={form.crop_rotation}
                    onChange={(event) =>
                      updateField(
                        "crop_rotation",
                        event.target.value as "" | "true" | "false",
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="">Não informado</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </FieldLabel>

                <FieldLabel label="Safras seguidas com amendoim">
                  <input
                    type="number"
                    min={0}
                    value={form.peanut_repetition_years}
                    onChange={(event) =>
                      updateField(
                        "peanut_repetition_years",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                      )
                    }
                    className={inputClassName}
                    placeholder="0"
                  />
                </FieldLabel>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Já houve incidência de doença?">
                  <select
                    value={form.had_disease_incidence}
                    onChange={(event) =>
                      updateField(
                        "had_disease_incidence",
                        event.target.value as "" | "true" | "false",
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="">Não informado</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </FieldLabel>

                <FieldLabel label="Doenças já observadas">
                  <input
                    value={form.previous_diseases}
                    onChange={(event) =>
                      updateField("previous_diseases", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Mancha-preta, mancha-castanha..."
                  />
                </FieldLabel>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Nível histórico da incidência">
                  <select
                    value={form.disease_incidence_level}
                    onChange={(event) =>
                      updateField(
                        "disease_incidence_level",
                        event.target.value as "" | DiseaseIncidenceLevel,
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="">Não informado</option>
                    {incidenceLevelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Pressão histórica da área">
                  <select
                    value={form.historical_pressure}
                    onChange={(event) =>
                      updateField(
                        "historical_pressure",
                        event.target.value as "" | HistoricalPressure,
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="">Não informado</option>
                    {historicalPressureOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>

              <FieldLabel label="Observações técnicas">
                <textarea
                  value={form.agronomic_history_notes}
                  onChange={(event) =>
                    updateField("agronomic_history_notes", event.target.value)
                  }
                  className={textareaClassName}
                  placeholder="Histórico técnico da área, pressão percebida, observações do responsável..."
                />
              </FieldLabel>
            </section>
          </div>

          <div className="border-t border-[rgba(25,35,29,0.10)] px-5 py-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="pt-button-primary w-full gap-2 disabled:cursor-not-allowed disabled:bg-[var(--pt-color-structure-300)]"
            >
              {!isSavingField ? <Plus size={16} strokeWidth={1.9} /> : null}
              {isSavingField ? "Cadastrando talhão..." : "Cadastrar talhão"}
            </button>
          </div>
        </form>

        <section className="pt-card">
          <div className="flex flex-col gap-3 border-b border-[rgba(25,35,29,0.10)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pt-color-earth-700)]">
                Áreas monitoradas
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--pt-color-structure-950)]">
                Talhões cadastrados
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {fields.length} talhão{fields.length === 1 ? "" : "es"} em
                acompanhamento operacional.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshFields}
              disabled={isLoadingFields}
              className="pt-button-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!isLoadingFields ? <RefreshCw size={16} strokeWidth={1.9} /> : null}
              {isLoadingFields ? "Carregando..." : "Atualizar lista"}
            </button>
          </div>

          <div className="grid gap-3 p-5">
            {isLoadingFields ? (
              <div className="pt-empty-state">
                Carregando talhões cadastrados...
              </div>
            ) : fields.length === 0 ? (
              <div className="pt-empty-state">
                <p className="font-semibold text-[var(--pt-color-structure-950)]">
                  Nenhum talhão cadastrado ainda.
                </p>
                <p className="mt-2 text-sm leading-6">
                  Cadastre a primeira área para acompanhar risco, inspeções,
                  pulverizações e calendário de manejo.
                </p>
              </div>
            ) : (
              fields.map((field) => (
                <article
                  key={field.id}
                  className="rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)] p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--pt-color-structure-950)]">
                          {field.nome}
                        </h3>
                        <span className="pt-badge pt-badge-success">
                          {statusLabel(field.status_lavoura)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                        {field.cidade} · {field.cultura} · plantio em{" "}
                        {formatDate(field.data_plantio)}
                      </p>

                      <p className="mt-1 text-xs text-[var(--pt-color-structure-500)]">
                        Coordenadas: {field.latitude.toFixed(4)},{" "}
                        {field.longitude.toFixed(4)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {field.doencas_monitoradas.map((disease) => (
                          <span key={disease} className="pt-badge pt-badge-info">
                            {disease}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-2 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface)] p-3 text-xs sm:grid-cols-2">
                        <p className="font-medium text-[var(--pt-color-structure-700)]">
                          Rotação:{" "}
                          <span className="text-[var(--pt-color-structure-950)]">
                            {booleanLabel(field.crop_rotation)}
                          </span>
                        </p>
                        <p className="font-medium text-[var(--pt-color-structure-700)]">
                          Pressão histórica:{" "}
                          <span className="text-[var(--pt-color-structure-950)]">
                            {formatStatus(field.historical_pressure)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:min-w-[230px] xl:items-stretch">
                      <Link
                        href={`/talhoes/${field.id}`}
                        className="pt-button-primary gap-2"
                      >
                        <Eye size={16} strokeWidth={1.9} />
                        Ver talhão
                      </Link>

                      <Link
                        href={`/talhoes/${field.id}#inspecoes`}
                        className="pt-button-secondary gap-2"
                      >
                        <ClipboardCheck size={16} strokeWidth={1.9} />
                        Registrar inspeção
                      </Link>

                      <Link
                        href={`/talhoes/${field.id}#pulverizacoes`}
                        className="pt-button-secondary gap-2"
                      >
                        <FilePlus2 size={16} strokeWidth={1.9} />
                        Registrar pulverização
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDeleteField(field.id)}
                        className="pt-button-danger justify-center gap-2"
                      >
                        <Trash2 size={16} strokeWidth={1.9} />
                        Remover talhão
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section id="ranking" className="pt-card">
        <div className="flex flex-col gap-3 border-b border-[rgba(25,35,29,0.10)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pt-color-earth-700)]">
              Prioridade operacional
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--pt-color-structure-950)]">
              Prioridade de Atenção do Talhão
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
              O ranking indica quais talhões olhar primeiro, com prioridade,
              confiança e motivos da análise. A leitura não é diagnóstico de
              doença nem recomendação de defensivo.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshRanking}
            disabled={isLoadingRanking}
            className="pt-button-primary gap-2 disabled:cursor-not-allowed disabled:bg-[var(--pt-color-structure-300)]"
          >
            {!isLoadingRanking ? <ListChecks size={16} strokeWidth={1.9} /> : null}
            {isLoadingRanking ? "Atualizando..." : "Atualizar ranking"}
          </button>
        </div>

        <div className="p-5">
          {isLoadingRanking ? (
            <div className="pt-empty-state">
              Calculando prioridade de atenção...
            </div>
          ) : !ranking ? (
            <div className="pt-empty-state">
              <p className="font-semibold text-[var(--pt-color-structure-950)]">
                Ranking ainda não atualizado.
              </p>
              <p className="mt-2 text-sm leading-6">
                Atualize o ranking para comparar os talhões pela prioridade de
                atenção e pela confiança da análise.
              </p>
            </div>
          ) : ranking.ranking.length === 0 ? (
            <div className="pt-empty-state">
              Nenhum talhão cadastrado para ranquear.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] px-4 py-3 text-sm text-[var(--pt-color-structure-700)]">
                {ranking.total_items} item
                {ranking.total_items === 1 ? "" : "s"} · gerado em{" "}
                {formatGeneratedAt(ranking.generated_at)}
              </div>

              <ol className="space-y-3">
                {ranking.ranking.map((item) => (
                  <RankingRow
                    key={`${item.field_id}-${item.disease}`}
                    item={item}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
