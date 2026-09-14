"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Save } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  LoadingState,
  OperationalAlert,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatusBadge,
} from "@/components/design-system";
import { createScopedInspection, getFields } from "@/lib/api";
import type {
  InspectionDisease,
  InspectionLevel,
  InspectionScope,
  RegisteredField,
  ScopedInspectionResponse,
} from "@/types/analysis";

type SymptomsValue = "true" | "false";
type VisualSeverityValue = "sem_sintomas" | "baixa" | "media" | "alta";

type InspectionFormState = {
  scope: InspectionScope;
  field_ids: string[];
  disease: InspectionDisease;
  symptoms_found: SymptomsValue;
  visual_severity: VisualSeverityValue;
  defoliation_level: "baixa" | "media" | "alta";
  action_taken: string;
  notes: string;
};

const initialForm: InspectionFormState = {
  scope: "selected",
  field_ids: [],
  disease: "Mancha-preta do amendoim",
  symptoms_found: "true",
  visual_severity: "baixa",
  defoliation_level: "baixa",
  action_taken: "monitorar",
  notes: "",
};

const diseaseOptions: { value: InspectionDisease; label: string }[] = [
  { value: "Mancha-preta do amendoim", label: "Mancha-preta" },
  { value: "Mancha-castanha do amendoim", label: "Mancha-castanha" },
];

const visualSeverityOptions: { value: VisualSeverityValue; label: string }[] = [
  { value: "sem_sintomas", label: "Sem sintomas" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const defoliationOptions: InspectionFormState["defoliation_level"][] = [
  "baixa",
  "media",
  "alta",
];

const inputClassName = "pt-input";
const textareaClassName = "pt-textarea";

const levelLabels: Record<"baixa" | "media" | "alta", string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

function friendlyErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível registrar a inspeção. Verifique os dados e tente novamente.";

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

  if (message.includes("talhao nao esta ativo")) {
    return "A inspeção só pode ser aplicada em talhões ativos/em campo.";
  }

  if (message.includes("talhao nao encontrado")) {
    return "Um dos talhões selecionados não foi encontrado. Atualize a lista e tente novamente.";
  }

  if (message.includes("ativos")) {
    return "Não há talhões ativos/em campo para receber esta inspeção.";
  }

  if (message.includes("action_taken")) {
    return "Ação tomada inválida. Use um valor operacional aceito, como monitorar, consultar_responsavel ou manejo_realizado.";
  }

  return error.message || fallback;
}

function mapVisualSeverity(value: VisualSeverityValue): InspectionLevel {
  return value === "sem_sintomas" ? "nenhuma" : value;
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="pt-label">{label}</span>
      {children}
    </label>
  );
}

function ScopeOption({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`rounded-[var(--pt-radius-lg)] border p-4 transition ${
        checked
          ? "border-[rgba(27,74,57,0.34)] bg-[var(--pt-color-leaf-100)]"
          : "border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] hover:border-[rgba(25,35,29,0.22)]"
      }`}
    >
      <input
        type="radio"
        name="scope"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="block text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {label}
      </span>
      <span className="mt-1 block text-sm leading-6 text-[var(--pt-color-structure-700)]">
        {description}
      </span>
    </label>
  );
}

export default function NewInspectionPage() {
  const [form, setForm] = useState<InspectionFormState>(initialForm);
  const [fields, setFields] = useState<RegisteredField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ScopedInspectionResponse | null>(null);

  const activeFields = useMemo(
    () => fields.filter((field) => field.status_lavoura === "em_campo"),
    [fields],
  );

  useEffect(() => {
    let ignore = false;

    async function loadFields() {
      setIsLoadingFields(true);
      setError(null);

      try {
        const loadedFields = await getFields();

        if (!ignore) {
          setFields(loadedFields);
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

    void loadFields();

    return () => {
      ignore = true;
    };
  }, []);

  function updateForm<K extends keyof InspectionFormState>(
    key: K,
    value: InspectionFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleField(fieldId: string) {
    setForm((current) => {
      const isSelected = current.field_ids.includes(fieldId);

      return {
        ...current,
        field_ids: isSelected
          ? current.field_ids.filter((selectedId) => selectedId !== fieldId)
          : [...current.field_ids, fieldId],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const actionTaken = form.action_taken.trim();

    if (form.scope === "selected" && form.field_ids.length === 0) {
      setError("Selecione pelo menos um talhão para registrar a inspeção.");
      return;
    }

    if (!actionTaken) {
      setError("Informe a ação tomada.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await createScopedInspection({
        scope: form.scope,
        field_ids: form.scope === "selected" ? form.field_ids : [],
        disease: form.disease,
        symptoms_found: form.symptoms_found === "true",
        visual_severity: mapVisualSeverity(form.visual_severity),
        defoliation_level: form.defoliation_level,
        action_taken: actionTaken,
        notes: form.notes.trim(),
      });

      setSuccess(response);
      setForm({ ...initialForm, scope: form.scope });
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      title="Nova Inspeção de Campo"
      subtitle="Registre sintomas, severidade e observações para um ou mais talhões."
    >
      <form
        onSubmit={handleSubmit}
        className="grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <SectionCard
          title="Escopo da inspeção"
          description="Defina se o registro será aplicado a talhões específicos ou a toda a base ativa."
        >
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <ScopeOption
                checked={form.scope === "selected"}
                label="Talhões selecionados"
                description="Escolha manualmente os talhões que receberam a vistoria."
                onChange={() => updateForm("scope", "selected")}
              />

              <ScopeOption
                checked={form.scope === "all"}
                label="Todos os talhões ativos"
                description="Aplique a inspeção aos talhões com status em campo."
                onChange={() => updateForm("scope", "all")}
              />
            </div>

            {form.scope === "selected" ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
                    Talhões para vistoria
                  </h3>
                  <StatusBadge tone="neutral">
                    {form.field_ids.length} selecionado(s)
                  </StatusBadge>
                </div>

                <div className="grid max-h-80 gap-2 overflow-y-auto rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)] p-2">
                  {isLoadingFields ? (
                    <LoadingState label="Carregando talhões..." />
                  ) : fields.length === 0 ? (
                    <EmptyState title="Nenhum talhão cadastrado">
                      Cadastre os talhões antes de registrar uma inspeção.
                    </EmptyState>
                  ) : (
                    fields.map((field) => {
                      const isActive = field.status_lavoura === "em_campo";
                      const isChecked = form.field_ids.includes(field.id);

                      return (
                        <label
                          key={field.id}
                          className={`flex min-h-14 items-center gap-3 rounded-[var(--pt-radius-md)] border px-3 py-2 text-sm transition ${
                            isActive
                              ? "border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] text-[var(--pt-color-structure-950)] hover:border-[rgba(27,74,57,0.28)]"
                              : "border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-structure-100)] text-[var(--pt-color-structure-500)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isActive}
                            onChange={() => toggleField(field.id)}
                            className="h-4 w-4 rounded border-[rgba(25,35,29,0.28)] accent-[var(--pt-color-brand-800)] disabled:opacity-40"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {field.nome}
                            </span>
                            <span className="block truncate text-xs text-[var(--pt-color-structure-500)]">
                              {field.cidade} - {statusLabel(field.status_lavoura)}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <OperationalAlert
                title="Aplicação em lote"
                description="A inspeção será aplicada a todos os talhões ativos/em campo."
                severity="info"
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Observação de campo"
          description="Classifique a doença, sintomas e ação tomada no registro técnico."
          className="xl:row-span-2"
        >
          <div className="grid gap-4">
            <FieldLabel label="Doença">
              <select
                value={form.disease}
                onChange={(event) =>
                  updateForm("disease", event.target.value as InspectionDisease)
                }
                className={inputClassName}
              >
                {diseaseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Sintomas encontrados">
              <select
                value={form.symptoms_found}
                onChange={(event) =>
                  updateForm("symptoms_found", event.target.value as SymptomsValue)
                }
                className={inputClassName}
              >
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </FieldLabel>

            <FieldLabel label="Severidade visual">
              <select
                value={form.visual_severity}
                onChange={(event) =>
                  updateForm(
                    "visual_severity",
                    event.target.value as VisualSeverityValue,
                  )
                }
                className={inputClassName}
              >
                {visualSeverityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Desfolha observada">
              <select
                value={form.defoliation_level}
                onChange={(event) =>
                  updateForm(
                    "defoliation_level",
                    event.target.value as InspectionFormState["defoliation_level"],
                  )
                }
                className={inputClassName}
              >
                {defoliationOptions.map((option) => (
                  <option key={option} value={option}>
                    {levelLabels[option]}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Ação tomada">
              <input
                value={form.action_taken}
                onChange={(event) => updateForm("action_taken", event.target.value)}
                className={inputClassName}
                placeholder="monitorar"
              />
            </FieldLabel>

            <FieldLabel label="Observações">
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className={textareaClassName}
                placeholder="Lesões observadas em folhas baixeiras."
              />
            </FieldLabel>
          </div>
        </SectionCard>

        <SectionCard
          title="Salvar inspeção"
          description={
            form.scope === "all"
              ? `${activeFields.length} talhão(ões) ativo(s) encontrado(s).`
              : `${form.field_ids.length} talhão(ões) selecionado(s).`
          }
          action={
            <PrimaryButton
              type="submit"
              disabled={isSaving || isLoadingFields}
              icon={Save}
            >
              {isSaving ? "Registrando..." : "Registrar inspeção"}
            </PrimaryButton>
          }
        >
          <div className="grid gap-3">
            {error ? (
              <OperationalAlert
                title="Inspeção não registrada"
                description={error}
                severity="attention"
              />
            ) : null}

            {success ? (
              <>
                <OperationalAlert
                  title="Inspeção registrada"
                  description={`Registro criado com sucesso em ${success.created_count} talhão(ões).`}
                  severity="positive"
                />
                <div>
                  <SecondaryButton href="/talhoes" icon={ClipboardCheck}>
                    Ver talhões
                  </SecondaryButton>
                </div>
              </>
            ) : null}
          </div>
        </SectionCard>
      </form>
    </AppShell>
  );
}
