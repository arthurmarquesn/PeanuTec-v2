"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  LoaderCircle,
} from "lucide-react";

import {
  LoadingState,
  PrimaryButton,
  SectionCard,
  StatusBadge,
} from "@/components/design-system";

import {
  analyzeRegisteredField,
  getFields,
} from "@/lib/api";

import type {
  AnalysisResult,
  RegisteredField,
  RegisteredFieldAnalysisResponse,
} from "@/types/analysis";

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classificationTone(
  classification?: string | null,
): "positive" | "attention" | "critical" | "info" | "neutral" {
  const normalized = normalizeText(classification);

  if (
    normalized.includes("alto") ||
    normalized.includes("crit") ||
    normalized.includes("muito")
  ) {
    return "critical";
  }

  if (
    normalized.includes("medio") ||
    normalized.includes("moder") ||
    normalized.includes("atenc")
  ) {
    return "attention";
  }

  if (
    normalized.includes("baixo") ||
    normalized.includes("estavel") ||
    normalized.includes("sem risco")
  ) {
    return "positive";
  }

  return "info";
}

function score(value: number) {
  return Math.round(value);
}

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível concluir a análise do talhão.";
}

function AnalysisResultCard({
  analysis,
}: {
  analysis: AnalysisResult;
}) {
  return (
    <article className="rounded-[18px] border border-[rgba(47,37,32,0.07)] bg-white/65 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]">
            Doença analisada
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
            {analysis.disease}
          </h3>
          <p className="mt-1 text-xs text-[var(--pt-color-structure-500)]">
            {analysis.pathogen}
          </p>
        </div>

        <StatusBadge tone={classificationTone(analysis.risk.classification)}>
          {analysis.risk.classification}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] bg-[rgba(47,37,32,0.025)] px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]">
            Risco climático
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--pt-color-structure-900)]">
            {score(analysis.risk.climate_index)}/100
          </p>
        </div>

        <div className="rounded-[14px] bg-[rgba(47,37,32,0.025)] px-3 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]">
            Índice agronômico
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--pt-color-structure-900)]">
            {score(analysis.risk.agronomic_index)}/100
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[rgba(243,111,33,0.10)] bg-[var(--pt-color-orange-50)] px-3.5 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-orange-700)]">
          Relevância para manejo
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-900)]">
          {analysis.management_relevance.status}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--pt-color-structure-600)]">
          {analysis.management_relevance.description}
        </p>
      </div>

      {analysis.actions.length > 0 ? (
        <div className="mt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]">
            Próximas ações
          </p>
          <ul className="mt-2 grid gap-1.5">
            {analysis.actions.slice(0, 3).map((action) => (
              <li
                key={action}
                className="flex gap-2 text-xs leading-5 text-[var(--pt-color-structure-600)]"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pt-color-orange-500)]" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default function FieldAnalysisLauncher() {
  const [fields, setFields] = useState<RegisteredField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [result, setResult] = useState<RegisteredFieldAnalysisResponse | null>(null);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadFields() {
      setIsLoadingFields(true);
      setError(null);

      try {
        const response = await getFields();

        if (ignore) {
          return;
        }

        setFields(response);
        setSelectedFieldId((current) => current || response[0]?.id || "");
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyError(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoadingFields(false);
        }
      }
    }

    void loadFields();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  );

  async function handleAnalyze() {
    if (!selectedFieldId || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await analyzeRegisteredField(selectedFieldId);
      setResult(response);
    } catch (analysisError) {
      setError(friendlyError(analysisError));
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <SectionCard
      title="Análise de risco"
      description="Execute uma nova leitura do talhão usando os dados operacionais e meteorológicos disponíveis na V2."
      action={
        <div className="flex items-center gap-2 text-[var(--pt-color-orange-700)]">
          <BrainCircuit size={17} strokeWidth={1.8} />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
            Intelligence
          </span>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_1fr] xl:items-start">
        <div className="grid gap-3">
          <div>
            <label
              htmlFor="field-analysis-field"
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]"
            >
              Talhão
            </label>
            <select
              id="field-analysis-field"
              value={selectedFieldId}
              onChange={(event) => {
                setSelectedFieldId(event.target.value);
                setResult(null);
                setError(null);
              }}
              disabled={isLoadingFields || isAnalyzing || fields.length === 0}
              className="pt-input mt-2 w-full"
            >
              {isLoadingFields ? (
                <option value="">Carregando talhões...</option>
              ) : fields.length === 0 ? (
                <option value="">Nenhum talhão cadastrado</option>
              ) : (
                fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.nome} · {field.cidade}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedField ? (
            <div className="rounded-[16px] border border-[rgba(47,37,32,0.07)] bg-[rgba(47,37,32,0.018)] px-3.5 py-3 text-xs text-[var(--pt-color-structure-600)]">
              <div className="flex items-center gap-2">
                <Activity size={14} strokeWidth={1.8} />
                <span>
                  {selectedField.cultura} · {selectedField.doencas_monitoradas.length} doença(s) monitorada(s)
                </span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!selectedFieldId || isLoadingFields || isAnalyzing || fields.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[13px] bg-[var(--pt-color-orange-600)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--pt-color-orange-700)] disabled:cursor-not-allowed disabled:bg-[var(--pt-color-structure-200)]"
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle size={16} className="animate-spin" strokeWidth={1.8} />
                Analisando talhão...
              </>
            ) : (
              <>
                <BrainCircuit size={16} strokeWidth={1.8} />
                Analisar risco
              </>
            )}
          </button>

          {error ? (
            <div className="rounded-[15px] border border-[rgba(154,61,50,0.12)] bg-[rgba(245,222,218,0.42)] px-3.5 py-3 text-xs leading-5 text-[var(--pt-color-critical-700)]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          {isLoadingFields ? (
            <LoadingState label="Carregando talhões disponíveis..." />
          ) : result ? (
            <div className="grid gap-3">
              <div className="flex flex-col gap-2 rounded-[16px] border border-[rgba(47,37,32,0.07)] bg-white/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pt-color-structure-400)]">
                    Análise concluída
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
                    {result.field_name}
                  </p>
                </div>

                <Link
                  href={`/talhoes/${result.field_id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[11px] px-3 text-xs font-semibold text-[var(--pt-color-orange-700)] transition-colors hover:bg-[var(--pt-color-orange-50)]"
                >
                  Abrir talhão
                  <ArrowRight size={14} strokeWidth={1.8} />
                </Link>
              </div>

              {result.analyses.length > 0 ? (
                <div className="grid gap-3">
                  {result.analyses.map((analysis) => (
                    <AnalysisResultCard
                      key={`${analysis.disease}-${analysis.generated_at}`}
                      analysis={analysis}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(47,37,32,0.12)] bg-[rgba(47,37,32,0.018)] px-4 py-6 text-sm leading-6 text-[var(--pt-color-structure-600)]">
                  Este talhão não possui doenças monitoradas suficientes para gerar uma análise.
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[240px] items-center justify-center rounded-[18px] border border-dashed border-[rgba(47,37,32,0.12)] bg-[rgba(47,37,32,0.018)] px-6 text-center">
              <div>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--pt-color-orange-50)] text-[var(--pt-color-orange-700)]">
                  <BrainCircuit size={20} strokeWidth={1.8} />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--pt-color-structure-900)]">
                  Nenhuma análise executada nesta sessão
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--pt-color-structure-500)]">
                  Selecione um talhão e execute a leitura para consultar o resultado do Intelligence Service.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
