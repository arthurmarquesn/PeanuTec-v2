"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Pencil,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";

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
import {
  createProduct,
  deactivateProduct,
  getProducts,
  updateProduct,
} from "@/lib/api";
import type { Product, ProductRequest, ProductType } from "@/types/analysis";

type ProductFormState = {
  name: string;
  product_type: ProductType;
  active_ingredient: string;
  main_target: string;
  default_defense_days: number | "";
  notes: string;
  is_active: boolean;
};

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

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

const initialForm: ProductFormState = {
  name: "",
  product_type: "fungicida",
  active_ingredient: "",
  main_target: "",
  default_defense_days: "",
  notes: "",
  is_active: true,
};

function optionalText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function optionalNumber(value: number | "") {
  return value === "" ? null : value;
}

function buildPayload(form: ProductFormState): ProductRequest {
  return {
    name: form.name.trim(),
    product_type: form.product_type,
    active_ingredient: optionalText(form.active_ingredient),
    main_target: optionalText(form.main_target),
    default_defense_days: optionalNumber(form.default_defense_days),
    notes: optionalText(form.notes),
    is_active: form.is_active,
  };
}

function formatProductType(productType: string) {
  return productTypeLabels[productType as ProductType] ?? productType;
}

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  return String(value);
}

function friendlyErrorMessage(error: unknown, fallback: string) {
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

  return error.message || fallback;
}

function ProductField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
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

function ProductDetail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--pt-color-structure-800)]">
        {formatNullable(value)}
      </dd>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDeactivate,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDeactivate: (product: Product) => void;
}) {
  return (
    <article className="rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--pt-color-structure-950)]">
              {product.name}
            </h3>

            <StatusBadge tone={productTypeTones[product.product_type]}>
              {formatProductType(product.product_type)}
            </StatusBadge>

            <StatusBadge tone={product.is_active ? "positive" : "neutral"}>
              {product.is_active ? "Ativo" : "Inativo"}
            </StatusBadge>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <ProductDetail
              label="Ingrediente ativo"
              value={product.active_ingredient}
            />

            <ProductDetail label="Alvo principal" value={product.main_target} />

            <ProductDetail
              label="Duração padrão"
              value={
                product.default_defense_days
                  ? `${product.default_defense_days} dias`
                  : null
              }
            />
          </dl>

          {product.notes ? (
            <div className="mt-4 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.10)] bg-[var(--pt-color-surface-muted)] px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
                Observações
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                {product.notes}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-2 md:justify-end">
          <SecondaryButton
            type="button"
            onClick={() => onEdit(product)}
            icon={Pencil}
          >
            Editar
          </SecondaryButton>

          {product.is_active ? (
            <button
              type="button"
              onClick={() => onDeactivate(product)}
              className="pt-button-danger gap-2"
            >
              <Ban size={16} strokeWidth={1.9} />
              Inativar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () =>
      [...products].sort((first, second) => {
        if (first.is_active !== second.is_active) {
          return first.is_active ? -1 : 1;
        }

        return first.name.localeCompare(second.name, "pt-BR");
      }),
    [products],
  );

  const activeProductsCount = products.filter((product) => product.is_active).length;
  const inactiveProductsCount = products.length - activeProductsCount;

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedProducts = await getProducts();

        if (isMounted) {
          setProducts(loadedProducts);
        }
      } catch (currentError) {
        if (isMounted) {
          setError(
            friendlyErrorMessage(
              currentError,
              "Não foi possível carregar os produtos.",
            ),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  function startNewProduct() {
    setEditingProductId(null);
    setForm(initialForm);
    setMessage(null);
    setError(null);
  }

  function startEditing(product: Product) {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      product_type: product.product_type,
      active_ingredient: product.active_ingredient ?? "",
      main_target: product.main_target ?? "",
      default_defense_days: product.default_defense_days ?? "",
      notes: product.notes ?? "",
      is_active: product.is_active,
    });
    setMessage(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = buildPayload(form);
      const savedProduct = editingProductId
        ? await updateProduct(editingProductId, payload)
        : await createProduct(payload);

      setProducts((currentProducts) => {
        const exists = currentProducts.some(
          (product) => product.id === savedProduct.id,
        );

        if (exists) {
          return currentProducts.map((product) =>
            product.id === savedProduct.id ? savedProduct : product,
          );
        }

        return [...currentProducts, savedProduct];
      });

      setEditingProductId(savedProduct.id);
      setForm({
        name: savedProduct.name,
        product_type: savedProduct.product_type,
        active_ingredient: savedProduct.active_ingredient ?? "",
        main_target: savedProduct.main_target ?? "",
        default_defense_days: savedProduct.default_defense_days ?? "",
        notes: savedProduct.notes ?? "",
        is_active: savedProduct.is_active,
      });

      setMessage(
        editingProductId
          ? "Produto atualizado com sucesso."
          : "Produto cadastrado com sucesso.",
      );
    } catch (currentError) {
      setError(
        friendlyErrorMessage(
          currentError,
          "Não foi possível salvar o produto.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(product: Product) {
    setMessage(null);
    setError(null);

    try {
      const deactivatedProduct = await deactivateProduct(product.id);

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id ? deactivatedProduct : currentProduct,
        ),
      );

      if (editingProductId === product.id) {
        startEditing(deactivatedProduct);
      }

      setMessage("Produto inativado.");
    } catch (currentError) {
      setError(
        friendlyErrorMessage(
          currentError,
          "Não foi possível inativar o produto.",
        ),
      );
    }
  }

  return (
    <AppShell
      title="Produtos Fitossanitários"
      subtitle="Cadastro técnico dos produtos usados no manejo para rastreabilidade das aplicações."
    >
      <div className="grid gap-5">
        {(message || error) ? (
          <OperationalAlert
            title={error ? "Ação não concluída" : "Registro atualizado"}
            description={error ?? message ?? ""}
            severity={error ? "attention" : "positive"}
          />
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="pt-card border-l-4 border-l-[var(--pt-color-earth-700)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Produtos cadastrados
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--pt-color-structure-950)]">
              {products.length}
            </p>
          </article>

          <article className="pt-card border-l-4 border-l-[var(--pt-color-leaf-700)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Ativos
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--pt-color-structure-950)]">
              {activeProductsCount}
            </p>
          </article>

          <article className="pt-card border-l-4 border-l-[var(--pt-color-structure-300)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
              Inativos
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--pt-color-structure-950)]">
              {inactiveProductsCount}
            </p>
          </article>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <SectionCard
            title="Produtos cadastrados"
            description="Lista operacional de produtos disponíveis para uso nos registros de pulverização."
            action={
              <PrimaryButton type="button" onClick={startNewProduct} icon={Plus}>
                Novo produto
              </PrimaryButton>
            }
          >
            {isLoading ? (
              <LoadingState label="Carregando produtos cadastrados..." />
            ) : sortedProducts.length === 0 ? (
              <EmptyState title="Nenhum produto cadastrado">
                Cadastre o primeiro produto para usá-lo nos registros de
                pulverização e melhorar a rastreabilidade da safra.
              </EmptyState>
            ) : (
              <div className="grid gap-3">
                {sortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={startEditing}
                    onDeactivate={(selectedProduct) =>
                      void handleDeactivate(selectedProduct)
                    }
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={editingProductId ? "Editar produto" : "Novo produto"}
            description="Dados operacionais usados no histórico, calendário e registros de pulverização."
          >
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <ProductField label="Nome do produto">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
                  className="pt-input"
                  required
                />
              </ProductField>

              <ProductField label="Tipo">
                <select
                  value={form.product_type}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      product_type: event.target.value as ProductType,
                    }))
                  }
                  className="pt-input"
                  required
                >
                  {productTypes.map((productType) => (
                    <option key={productType} value={productType}>
                      {productTypeLabels[productType]}
                    </option>
                  ))}
                </select>
              </ProductField>

              <ProductField label="Ingrediente ativo">
                <input
                  value={form.active_ingredient}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      active_ingredient: event.target.value,
                    }))
                  }
                  className="pt-input"
                  placeholder="Ex.: tebuconazol, azoxistrobina..."
                />
              </ProductField>

              <ProductField label="Alvo principal">
                <input
                  value={form.main_target}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      main_target: event.target.value,
                    }))
                  }
                  className="pt-input"
                  placeholder="Ex.: mancha-preta, mancha-castanha..."
                />
              </ProductField>

              <ProductField
                label="Duração estimada padrão"
                hint="Use apenas como referência operacional. Não substitui recomendação técnica."
              >
                <input
                  type="number"
                  min={1}
                  value={form.default_defense_days}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      default_defense_days: event.target.value
                        ? Number(event.target.value)
                        : "",
                    }))
                  }
                  className="pt-input"
                  placeholder="Ex.: 14"
                />
              </ProductField>

              <ProductField label="Observações">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  className="pt-textarea"
                  placeholder="Observações técnicas, restrições de uso, contexto operacional..."
                />
              </ProductField>

              {editingProductId ? (
                <label className="flex items-center gap-3 rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-3 py-3 text-sm font-semibold text-[var(--pt-color-structure-700)]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        is_active: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--pt-color-brand-800)]"
                  />
                  Produto ativo
                </label>
              ) : null}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <PrimaryButton
                  type="submit"
                  disabled={isSaving}
                  icon={Save}
                >
                  {isSaving ? "Salvando..." : "Salvar produto"}
                </PrimaryButton>

                {editingProductId ? (
                  <SecondaryButton
                    type="button"
                    onClick={startNewProduct}
                    icon={RotateCcw}
                  >
                    Limpar formulário
                  </SecondaryButton>
                ) : null}
              </div>
            </form>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
