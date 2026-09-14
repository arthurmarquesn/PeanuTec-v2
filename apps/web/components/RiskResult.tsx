import type { AnalysisResult } from "@/types/analysis";

type RiskResultProps = {
  result: AnalysisResult;
};

type Tone = {
  badge: string;
  panel: string;
  bar: string;
};

const riskTones: Record<string, Tone> = {
  BAIXO: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    panel: "border-emerald-200 bg-emerald-50",
    bar: "bg-emerald-500",
  },
  MODERADO: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    panel: "border-amber-200 bg-amber-50",
    bar: "bg-amber-500",
  },
  ALTO: {
    badge: "bg-orange-50 text-orange-800 ring-orange-200",
    panel: "border-orange-200 bg-orange-50",
    bar: "bg-orange-500",
  },
  CRÍTICO: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    panel: "border-red-200 bg-red-50",
    bar: "bg-red-600",
  },
  CRITICO: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    panel: "border-red-200 bg-red-50",
    bar: "bg-red-600",
  },
};

function getRiskTone(classification?: string): Tone {
  return riskTones[classification ?? ""] ?? {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    panel: "border-slate-200 bg-white",
    bar: "bg-slate-400",
  };
}

function formatGeneratedAt(value?: string): string {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsedDate);
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-950">{value ?? "N/A"}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number | undefined;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 shadow-sm ${
        emphasis
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <dt
        className={`text-sm font-medium ${
          emphasis ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-semibold">{value ?? "N/A"}</dd>
    </div>
  );
}

export function RiskResult({ result }: RiskResultProps) {
  const classification = result.risk?.classification ?? "N/A";
  const tone = getRiskTone(classification);
  const actions = result.actions ?? [];

  return (
    <section className="space-y-4" aria-live="polite">
      <div className={`rounded-md border p-5 shadow-sm ${tone.panel}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-600">
              Risco agronômico
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p className="text-5xl font-semibold text-slate-950">
                {result.risk?.agronomic_index ?? "N/A"}
              </p>
              <span
                className={`mb-1 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tone.badge}`}
              >
                {classification}
              </span>
            </div>
          </div>

          <div className="w-full max-w-md">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>0</span>
              <span>100</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/70">
              <div
                className={`h-2 rounded-full ${tone.bar}`}
                style={{
                  width: `${Math.min(
                    Math.max(result.risk?.agronomic_index ?? 0, 0),
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <dl className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Risco climático"
          value={result.risk?.climate_index}
        />
        <MetricCard
          label="Risco agronômico"
          value={result.risk?.agronomic_index}
          emphasis
        />
        <MetricCard label="Classificação" value={classification} />
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Talhão e estágio
              </h2>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {result.field?.name ?? "N/A"}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {result.field?.crop_status ?? "N/A"}
            </span>
          </div>

          <dl className="mt-4 text-sm">
            <InfoRow label="Cidade" value={result.field?.city} />
            <InfoRow label="Cultura" value={result.field?.crop} />
            <InfoRow
              label="Dias após plantio"
              value={result.field?.days_after_planting}
            />
            <InfoRow label="Estágio" value={result.field?.crop_stage} />
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Doença
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Nome</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {result.disease ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Patógeno</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {result.pathogen ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Gerado em</p>
              <p className="mt-1 font-medium text-slate-950">
                {formatGeneratedAt(result.generated_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Relevância de manejo
          </h2>
          <p className="mt-3 text-xl font-semibold text-slate-950">
            {result.management_relevance?.status ?? "N/A"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {result.management_relevance?.description ?? "N/A"}
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Ações recomendadas
            </h2>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {actions.length}
            </span>
          </div>
          {actions.length > 0 ? (
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {actions.map((action, index) => (
                <li
                  key={`${action}-${index}`}
                  className="grid grid-cols-[28px_1fr] gap-3 rounded-md bg-slate-50 p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950 ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Nenhuma ação retornada.</p>
          )}
        </div>
      </div>
    </section>
  );
}
