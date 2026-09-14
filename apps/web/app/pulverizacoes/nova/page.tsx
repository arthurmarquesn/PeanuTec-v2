"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPinned, Package, Save } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  LoadingState,
  OperationalAlert,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatusBadge,
} from "@/components/design-system";
import { createFieldSprayApplication, getFields, getProducts } from "@/lib/api";
import type {
  Product,
  ProductType,
  RegisteredField,
  SprayApplication,
  SprayApplicationFormData,
} from "@/types/analysis";

type SprayFormState = {
  field_id: string;
  application_date: string;
  product_id: string;
  product: string;
  product_type: ProductType | "";
  target: string;
  dose: string;
  responsible: string;
  planned_interval_days: number;
  notes: string;
  generate_reapplication: boolean;
  reapplication_interval_days: number | "";
  reapplication_date: string;
  reapplication_notes: string;
};

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

const initialForm: SprayFormState = {
  field_id: "",
  application_date: "",
  product_id: "",
  product: "",
  product_type: "",
  target: "Mancha-preta",
  dose: "",
  responsible: "",
  planned_interval_days: 12,
  notes: "",
  generate_reapplication: false,
  reapplication_interval_days: 12,
  reapplication_date: "",
  reapplication_notes: "",
};

const inputClassName = "pt-input";
const textareaClassName = "pt-textarea";

const productTypeLabels: Record<ProductType, string> = {
  fungicida: "Fungicida",
  inseticida: "Inseticida",
  acaricida: "Acaricida",
  herbicida: "Herbicida",
  outro: "Outro",
};

const productTypeTones: Record<ProductType, Tone> = {
  fungicida: "positive",
  inseticida: "attention",
  acaricida: "info",
  herbicida: "earth",
  outro: "neutral",
};

const productTypes = Object.keys(productTypeLabels) as ProductType[];

function friendlyErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível registrar a pulverização. Verifique os dados e tente novamente.";

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

  if (message.includes("talhao nao encontrado")) {
    return "Talhão não encontrado. Atualize a lista e selecione outro talhão.";
  }

  if (message.includes("application_date")) {
    return "A data da aplicação não pode ser futura.";
  }

  if (message.includes("planned_interval_days")) {
    return "O intervalo planejado deve ser maior que zero.";
  }

  if (
    message.includes("reapplication_interval_days") ||
    message.includes("reaplicacao")
  ) {
    return "Informe a data prevista ou um intervalo válido para gerar a reaplicação.";
  }

  return error.message || fallback;
}

function formatDateTimeLocal(value: string): string | null {
  if (!value) {
    return null;
  }

  return `${value}:00`;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateReapplicationDate(
  applicationDate: string,
  intervalDays: number,
): string {
  const [datePart, timePart = "00:00"] = applicationDate.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const nextDate = new Date(year, month - 1, day, hours || 0, minutes || 0);

  nextDate.setDate(nextDate.getDate() + intervalDays);

  return formatDateInput(nextDate);
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

function ProductTypeBadge({ productType }: { productType: ProductType | "" }) {
  if (!productType) {
    return <StatusBadge tone="neutral">Não informado</StatusBadge>;
  }

  return (
    <StatusBadge tone={productTypeTones[productType]}>
      {productTypeLabels[productType]}
    </StatusBadge>
  );
}

function ToggleButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-[var(--pt-radius-md)] border px-4 text-sm font-semibold transition ${
        selected
          ? "border-[rgba(27,74,57,0.34)] bg-[var(--pt-color-leaf-100)] text-[var(--pt-color-brand-900)]"
          : "border-[rgba(25,35,29,0.18)] bg-[var(--pt-color-surface)] text-[var(--pt-color-structure-700)] hover:border-[rgba(25,35,29,0.30)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function NewSprayApplicationPage() {
  const [form, setForm] = useState<SprayFormState>(initialForm);
  const [fields, setFields] = useState<RegisteredField[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SprayApplication | null>(null);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === form.field_id) ?? null,
    [fields, form.field_id],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product_id) ?? null,
    [products, form.product_id],
  );

  useEffect(() => {
    let ignore = false;

    async function loadFormData() {
      setIsLoadingData(true);
      setError(null);

      try {
        const [loadedFields, loadedProducts] = await Promise.all([
          getFields(),
          getProducts(true),
        ]);

        if (!ignore) {
          setFields(loadedFields);
          setProducts(loadedProducts);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoadingData(false);
        }
      }
    }

    void loadFormData();

    return () => {
      ignore = true;
    };
  }, []);

  function updateForm<K extends keyof SprayFormState>(
    key: K,
    value: SprayFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applySelectedProduct(productId: string) {
    const product = products.find(
      (currentProduct) => currentProduct.id === productId,
    );

    if (!product) {
      setForm((current) => ({
        ...current,
        product_id: "",
        product: "",
        product_type: "",
      }));
      return;
    }

    setForm((current) => {
      const nextInterval =
        product.default_defense_days ?? current.planned_interval_days;

      return {
        ...current,
        product_id: product.id,
        product: product.name,
        product_type: product.product_type,
        target: product.main_target ?? current.target,
        planned_interval_days: nextInterval,
        reapplication_interval_days: current.generate_reapplication
          ? nextInterval
          : current.reapplication_interval_days,
        reapplication_date:
          current.generate_reapplication && current.application_date
            ? calculateReapplicationDate(current.application_date, nextInterval)
            : current.reapplication_date,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const product = form.product.trim();
    const target = form.target.trim();
    const dose = form.dose.trim();
    const responsible = form.responsible.trim();
    const notes = form.notes.trim();
    const reapplicationNotes = form.reapplication_notes.trim();

    if (!form.field_id) {
      setError("Selecione um talhão para registrar a pulverização.");
      return;
    }

    if (!product || !target || !dose) {
      setError("Produto, alvo e dose são obrigatórios.");
      return;
    }

    if (form.planned_interval_days <= 0) {
      setError("O intervalo planejado deve ser maior que zero.");
      return;
    }

    if (
      form.generate_reapplication &&
      form.reapplication_interval_days !== "" &&
      form.reapplication_interval_days <= 0
    ) {
      setError("O intervalo para reaplicação deve ser maior que zero.");
      return;
    }

    if (
      form.generate_reapplication &&
      !form.reapplication_date &&
      !form.reapplication_interval_days
    ) {
      setError("Informe a data prevista ou o intervalo para reaplicação.");
      return;
    }

    const payload: SprayApplicationFormData = {
      application_date: formatDateTimeLocal(form.application_date),
      product_id: form.product_id || null,
      product,
      product_type: form.product_type || null,
      target,
      dose,
      responsible,
      planned_interval_days: form.planned_interval_days,
      notes,
      generate_reapplication: form.generate_reapplication,
      reapplication_interval_days: form.generate_reapplication
        ? form.reapplication_interval_days || null
        : null,
      reapplication_date: form.generate_reapplication
        ? form.reapplication_date || null
        : null,
      reapplication_notes: form.generate_reapplication
        ? reapplicationNotes || null
        : null,
    };

    setIsSaving(true);

    try {
      const response = await createFieldSprayApplication(form.field_id, payload);

      setSuccess(response);
      setForm({
        ...initialForm,
        field_id: form.field_id,
      });
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      title="Nova Pulverização"
      subtitle="Registre uma aplicação realizada em um talhão."
    >
      <form
        onSubmit={handleSubmit}
        className="grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,22rem)_1fr]"
      >
        <SectionCard
          title="Talhão da aplicação"
          description="Selecione a área que recebeu o manejo."
        >
          <div className="grid gap-4">
            <FieldLabel label="Talhão">
              <select
                value={form.field_id}
                onChange={(event) => updateForm("field_id", event.target.value)}
                className={inputClassName}
                disabled={isLoadingData}
              >
                <option value="">
                  {isLoadingData ? "Carregando..." : "Selecione um talhão"}
                </option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.nome} - {statusLabel(field.status_lavoura)}
                  </option>
                ))}
              </select>
            </FieldLabel>

            {isLoadingData ? <LoadingState label="Carregando talhões..." /> : null}

            {selectedField ? (
              <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)] px-4 py-3 text-sm text-[var(--pt-color-structure-700)]">
                <p className="font-semibold text-[var(--pt-color-structure-950)]">
                  {selectedField.nome}
                </p>
                <p className="mt-1">
                  {selectedField.cidade} - {selectedField.cultura}
                </p>
                <p className="mt-1 text-xs text-[var(--pt-color-structure-500)]">
                  Status: {statusLabel(selectedField.status_lavoura)}
                </p>
              </div>
            ) : null}

            <OperationalAlert
              title="Registro por talhão"
              description="Pulverização é registrada por talhão nesta versão."
              severity="info"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Dados da aplicação"
          description="Informe produto, alvo, dose e intervalo operacional planejado."
        >
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Data da aplicação">
                <input
                  type="datetime-local"
                  value={form.application_date}
                  onChange={(event) => {
                    const nextApplicationDate = event.target.value;
                    setForm((current) => ({
                      ...current,
                      application_date: nextApplicationDate,
                      reapplication_date:
                        current.generate_reapplication &&
                        nextApplicationDate &&
                        current.reapplication_interval_days
                          ? calculateReapplicationDate(
                              nextApplicationDate,
                              current.reapplication_interval_days,
                            )
                          : current.reapplication_date,
                    }));
                  }}
                  className={inputClassName}
                />
              </FieldLabel>

              <FieldLabel label="Intervalo planejado em dias">
                <input
                  type="number"
                  min={1}
                  value={form.planned_interval_days}
                  onChange={(event) =>
                    updateForm(
                      "planned_interval_days",
                      Number(event.target.value),
                    )
                  }
                  className={inputClassName}
                />
              </FieldLabel>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Produto cadastrado">
                <select
                  value={form.product_id}
                  onChange={(event) => applySelectedProduct(event.target.value)}
                  className={inputClassName}
                  disabled={isLoadingData}
                >
                  <option value="">
                    {isLoadingData
                      ? "Carregando..."
                      : "Selecione um produto cadastrado"}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {productTypeLabels[product.product_type]}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Alvo">
                <input
                  value={form.target}
                  onChange={(event) => updateForm("target", event.target.value)}
                  className={inputClassName}
                  placeholder="Mancha-preta"
                />
              </FieldLabel>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Tipo de produto">
                <select
                  value={form.product_type}
                  onChange={(event) =>
                    updateForm(
                      "product_type",
                      event.target.value as ProductType | "",
                    )
                  }
                  className={inputClassName}
                >
                  <option value="">Não informado</option>
                  {productTypes.map((productType) => (
                    <option key={productType} value={productType}>
                      {productTypeLabels[productType]}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Nome do produto">
                <input
                  value={form.product}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      product_id: "",
                      product: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Produto usado"
                />
              </FieldLabel>
            </div>

            {selectedProduct ? (
              <OperationalAlert
                title="Rastreabilidade vinculada"
                description={`${selectedProduct.name}${
                  selectedProduct.default_defense_days
                    ? `, ${selectedProduct.default_defense_days} dias padrão`
                    : ""
                }${
                  selectedProduct.main_target
                    ? `, alvo ${selectedProduct.main_target}`
                    : ""
                }.`}
                severity="positive"
                context={productTypeLabels[selectedProduct.product_type]}
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Dose">
                <input
                  value={form.dose}
                  onChange={(event) => updateForm("dose", event.target.value)}
                  className={inputClassName}
                  placeholder="1,5 L/ha"
                />
              </FieldLabel>

              <FieldLabel label="Responsável">
                <input
                  value={form.responsible}
                  onChange={(event) =>
                    updateForm("responsible", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Técnico responsável"
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Observações">
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className={textareaClassName}
                placeholder="Aplicação preventiva realizada no talhão."
              />
            </FieldLabel>
          </div>
        </SectionCard>

        <SectionCard
          title="Reaplicação prevista"
          description="Opcionalmente, gere uma previsão de nova entrada no calendário."
          action={<ProductTypeBadge productType={form.product_type} />}
          className="xl:col-span-2"
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="pt-label">Gerar reaplicação prevista?</span>
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  selected={form.generate_reapplication}
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      generate_reapplication: true,
                      reapplication_interval_days:
                        current.reapplication_interval_days || 12,
                      reapplication_date: current.application_date
                        ? calculateReapplicationDate(
                            current.application_date,
                            current.reapplication_interval_days || 12,
                          )
                        : current.reapplication_date,
                    }));
                  }}
                >
                  Sim
                </ToggleButton>
                <ToggleButton
                  selected={!form.generate_reapplication}
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      generate_reapplication: false,
                      reapplication_interval_days: "",
                      reapplication_date: "",
                      reapplication_notes: "",
                    }));
                  }}
                >
                  Não
                </ToggleButton>
              </div>
            </div>

            {form.generate_reapplication ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Intervalo para reaplicação em dias">
                    <input
                      type="number"
                      min={1}
                      value={form.reapplication_interval_days}
                      onChange={(event) => {
                        const nextInterval =
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value);
                        setForm((current) => ({
                          ...current,
                          reapplication_interval_days: nextInterval,
                          reapplication_date:
                            current.application_date && nextInterval
                              ? calculateReapplicationDate(
                                  current.application_date,
                                  nextInterval,
                                )
                              : current.reapplication_date,
                        }));
                      }}
                      className={inputClassName}
                    />
                  </FieldLabel>

                  <FieldLabel label="Data prevista de reaplicação">
                    <input
                      type="date"
                      value={form.reapplication_date}
                      onChange={(event) => {
                        updateForm("reapplication_date", event.target.value);
                      }}
                      className={inputClassName}
                    />
                  </FieldLabel>
                </div>

                <FieldLabel label="Observações da reaplicação">
                  <textarea
                    value={form.reapplication_notes}
                    onChange={(event) =>
                      updateForm("reapplication_notes", event.target.value)
                    }
                    className={textareaClassName}
                    placeholder="Orientações para a próxima entrada no talhão."
                  />
                </FieldLabel>
              </>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Salvar pulverização"
          description={
            selectedField
              ? `Aplicação vinculada ao talhão ${selectedField.nome}.`
              : "Selecione o talhão antes de salvar."
          }
          action={
            <PrimaryButton
              type="submit"
              disabled={isSaving || isLoadingData}
              icon={Save}
            >
              {isSaving ? "Registrando..." : "Registrar pulverização"}
            </PrimaryButton>
          }
          className="xl:col-span-2"
        >
          <div className="grid gap-3">
            {error ? (
              <OperationalAlert
                title="Pulverização não registrada"
                description={error}
                severity="attention"
              />
            ) : null}

            {success ? (
              <>
                <OperationalAlert
                  title="Pulverização registrada"
                  description={`Registro criado com sucesso para ${success.field_name}.`}
                  severity="positive"
                  context={success.application_date}
                />
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton href={`/talhoes/${success.field_id}`} icon={MapPinned}>
                    Ver talhão
                  </SecondaryButton>
                  <SecondaryButton href="/calendario" icon={CalendarDays}>
                    Ver calendário
                  </SecondaryButton>
                  <SecondaryButton href="/produtos" icon={Package}>
                    Produtos
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
