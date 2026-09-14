"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { RiskResult } from "@/components/RiskResult";
import { analyzeField, getSupportedDiseases } from "@/lib/api";
import type {
  AnalysisRequest,
  AnalysisResult,
  CropStatus,
  SupportedDisease,
} from "@/types/analysis";

type FormState = {
  nome: string;
  cidade: string;
  latitude: string;
  longitude: string;
  data_plantio: string;
  cultura: string;
  doenca_alvo: string;
  status_lavoura: CropStatus;
};

const initialFormState: FormState = {
  nome: "",
  cidade: "Tupa-SP",
  latitude: "-21.9347",
  longitude: "-50.5136",
  data_plantio: "2026-04-10",
  cultura: "Amendoim",
  doenca_alvo: "Mancha-castanha",
  status_lavoura: "em_campo",
};

const cropStatuses: { value: CropStatus; label: string }[] = [
  { value: "em_campo", label: "Em campo" },
  { value: "pre_arranquio", label: "Pré-arranquio" },
  { value: "arrancado", label: "Arrancado" },
  { value: "colhido", label: "Colhido" },
];

const demoScenarios: { label: string; description: string; form: FormState }[] =
  [
    {
      label: "Mancha-preta final de ciclo",
      description: "Talhão demo com ciclo avançado em campo.",
      form: {
        nome: "Talhao Demo - Mancha Preta Final de Ciclo",
        cidade: "Tupa-SP",
        latitude: "-21.9347",
        longitude: "-50.5136",
        data_plantio: "2026-02-10",
        cultura: "Amendoim",
        doenca_alvo: "Mancha-preta",
        status_lavoura: "em_campo",
      },
    },
    {
      label: "Mancha-castanha fase crítica",
      description: "Talhão demo na janela principal de atenção.",
      form: {
        nome: "Talhao Demo - Mancha Castanha Fase Critica",
        cidade: "Tupa-SP",
        latitude: "-21.9347",
        longitude: "-50.5136",
        data_plantio: "2026-04-10",
        cultura: "Amendoim",
        doenca_alvo: "Mancha-castanha",
        status_lavoura: "em_campo",
      },
    },
  ];

function friendlyErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível concluir a análise. Verifique a API e os dados informados.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  ) {
    return "Não foi possível conectar ao backend do PeanuTec. Confirme se o Next está rodando na porta 3000 e o Intelligence Service na porta 8001.";
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

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function AnalysisForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [diseases, setDiseases] = useState<SupportedDisease[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoadingDiseases, setIsLoadingDiseases] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadDiseases() {
      try {
        const response = await getSupportedDiseases();

        if (ignore) {
          return;
        }

        setDiseases(response.supported_diseases);

        if (response.supported_diseases.length > 0) {
          setForm((current) => ({
            ...current,
            doenca_alvo: response.supported_diseases[0].id,
          }));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoadingDiseases(false);
        }
      }
    }

    loadDiseases();

    return () => {
      ignore = true;
    };
  }, []);

  const canSubmit = useMemo(
    () => !isLoadingDiseases && !isAnalyzing && diseases.length > 0,
    [diseases.length, isAnalyzing, isLoadingDiseases],
  );

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function loadDemoScenario(scenario: FormState) {
    setForm(scenario);
    setError(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const payload: AnalysisRequest = {
      nome: form.nome,
      cidade: form.cidade,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      data_plantio: form.data_plantio,
      cultura: form.cultura,
      doenca_alvo: form.doenca_alvo,
      status_lavoura: form.status_lavoura,
    };

    try {
      setResult(await analyzeField(payload));
    } catch (submitError) {
      setError(friendlyErrorMessage(submitError));
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
      <form
        onSubmit={handleSubmit}
        className="self-start rounded-md border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Parâmetros do talhão
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Entrada operacional para análise.
              </p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              V0.2
            </span>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-5">
          <section className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <h3 className="text-sm font-semibold text-emerald-950">
              Cenários de demonstração
            </h3>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Preenchem o formulário; a análise continua manual.
            </p>

            <div className="mt-3 grid gap-2">
              {demoScenarios.map((scenario) => (
                <button
                  key={scenario.label}
                  type="button"
                  onClick={() => loadDemoScenario(scenario.form)}
                  className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-left transition hover:border-emerald-400 hover:bg-emerald-100"
                >
                  <span className="block text-sm font-semibold text-slate-950">
                    {scenario.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {scenario.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-4">
            <FieldLabel label="Nome">
              <input
                required
                value={form.nome}
                onChange={(event) => updateField("nome", event.target.value)}
                className={inputClassName}
                placeholder="Talhao A1"
              />
            </FieldLabel>

            <FieldLabel label="Cidade">
              <input
                required
                value={form.cidade}
                onChange={(event) => updateField("cidade", event.target.value)}
                className={inputClassName}
              />
            </FieldLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Latitude">
                <input
                  required
                  type="number"
                  step="0.0001"
                  value={form.latitude}
                  onChange={(event) =>
                    updateField("latitude", event.target.value)
                  }
                  className={inputClassName}
                />
              </FieldLabel>

              <FieldLabel label="Longitude">
                <input
                  required
                  type="number"
                  step="0.0001"
                  value={form.longitude}
                  onChange={(event) =>
                    updateField("longitude", event.target.value)
                  }
                  className={inputClassName}
                />
              </FieldLabel>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-5">
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

            <FieldLabel label="Cultura">
              <input
                required
                value={form.cultura}
                onChange={(event) => updateField("cultura", event.target.value)}
                className={inputClassName}
              />
            </FieldLabel>

            <FieldLabel label="Doença">
              <select
                required
                value={form.doenca_alvo}
                disabled={isLoadingDiseases}
                onChange={(event) =>
                  updateField("doenca_alvo", event.target.value)
                }
                className={inputClassName}
              >
                {isLoadingDiseases ? (
                  <option>Carregando doenças...</option>
                ) : null}
                {diseases.map((disease) => (
                  <option key={disease.id} value={disease.id}>
                    {disease.name}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Status da lavoura">
              <select
                value={form.status_lavoura}
                onChange={(event) =>
                  updateField("status_lavoura", event.target.value as CropStatus)
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
          </div>
        </div>

        {error ? (
          <div className="mx-5 mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-800">
            {error}
          </div>
        ) : null}

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Analisando
              </span>
            ) : (
              "Analisar risco"
            )}
          </button>
        </div>
      </form>

      <div className="min-w-0">
        {isAnalyzing ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
              <h2 className="mt-5 text-lg font-semibold text-slate-950">
                Processando análise
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Consultando o serviço de inteligência.
              </p>
            </div>
          </div>
        ) : result ? (
          <RiskResult result={result} />
        ) : (
          <div className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                Painel de resultado
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Aguardando análise
              </h2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
