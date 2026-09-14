"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Search,
  Sprout,
  Trash2,
} from "lucide-react";

import {
  LoadingState,
  PrimaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";

import {
  deleteField,
  getFields,
  getRanking,
} from "@/lib/api";

import type {
  CropStatus,
  RankingItem,
  RankingResponse,
  RegisteredField,
} from "@/types/analysis";

type FieldFilter =
  | "all"
  | CropStatus;

type Tone =
  | "positive"
  | "attention"
  | "critical"
  | "info"
  | "earth"
  | "neutral";

function normalizeText(
  value?: string | null,
) {
  return (value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase();
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
  ).format(date);
}

function statusLabel(
  status: CropStatus,
) {
  const labels: Record<
    CropStatus,
    string
  > = {
    em_campo: "Em campo",
    pre_arranquio:
      "Pré-arranquio",
    arrancado: "Arrancado",
    colhido: "Colhido",
  };

  return labels[status];
}

function statusTone(
  status: CropStatus,
): Tone {
  if (
    status === "em_campo"
  ) {
    return "positive";
  }

  if (
    status ===
    "pre_arranquio"
  ) {
    return "attention";
  }

  if (
    status === "arrancado"
  ) {
    return "earth";
  }

  return "neutral";
}

function priorityLabel(
  item?: RankingItem,
) {
  if (!item) {
    return "Sem prioridade";
  }

  const raw =
    item.priority_label ??
    item.priority ??
    "";

  const normalized =
    normalizeText(raw);

  if (
    normalized.includes(
      "maxima",
    )
  ) {
    return "Prioridade máxima";
  }

  if (
    normalized.includes(
      "alta",
    )
  ) {
    return "Alta atenção";
  }

  if (
    normalized.includes(
      "monitor",
    )
  ) {
    return "Monitoramento";
  }

  if (
    normalized.includes(
      "estavel",
    ) ||
    normalized.includes(
      "baixa",
    )
  ) {
    return "Estável";
  }

  return (
    raw ||
    "Sem prioridade"
  );
}

function priorityTone(
  item?: RankingItem,
): Tone {
  if (!item) {
    return "neutral";
  }

  const score =
    item.priority_score;

  const label =
    normalizeText(
      priorityLabel(item),
    );

  if (
    label.includes(
      "maxima",
    ) ||
    (typeof score ===
      "number" &&
      score >= 75)
  ) {
    return "critical";
  }

  if (
    label.includes(
      "alta",
    ) ||
    (typeof score ===
      "number" &&
      score >= 50)
  ) {
    return "attention";
  }

  if (
    label.includes(
      "monitor",
    ) ||
    (typeof score ===
      "number" &&
      score >= 25)
  ) {
    return "info";
  }

  if (
    typeof score ===
    "number"
  ) {
    return "positive";
  }

  return "neutral";
}

function scoreLabel(
  value?: number | null,
) {
  return typeof value ===
    "number"
    ? Math.round(value)
    : "—";
}

function friendlyError(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    const message =
      error.message.toLowerCase();

    if (
      message.includes(
        "failed to fetch",
      ) ||
      message.includes(
        "networkerror",
      )
    ) {
      return "Não foi possível conectar ao backend atual.";
    }

    return error.message;
  }

  return "Não foi possível carregar os talhões.";
}

export default function FieldsOverview() {
  const [
    fields,
    setFields,
  ] = useState<
    RegisteredField[]
  >([]);

  const [
    ranking,
    setRanking,
  ] = useState<
    RankingResponse | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<FieldFilter>(
      "all",
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      const [
        fieldsResult,
        rankingResult,
      ] =
        await Promise.allSettled([
          getFields(),
          getRanking(),
        ]);

      if (ignore) {
        return;
      }

      if (
        fieldsResult.status ===
        "fulfilled"
      ) {
        setFields(
          fieldsResult.value,
        );
      } else {
        setFields([]);

        setError(
          friendlyError(
            fieldsResult.reason,
          ),
        );
      }

      if (
        rankingResult.status ===
        "fulfilled"
      ) {
        setRanking(
          rankingResult.value,
        );
      } else {
        setRanking(null);
      }

      setIsLoading(false);
    }

    void loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const rankingByField =
    useMemo(() => {
      const map =
        new Map<
          string,
          RankingItem
        >();

      ranking?.ranking
        .slice()
        .sort(
          (a, b) =>
            a.rank - b.rank,
        )
        .forEach((item) => {
          if (
            !map.has(
              item.field_id,
            )
          ) {
            map.set(
              item.field_id,
              item,
            );
          }
        });

      return map;
    }, [ranking]);

  const activeCount =
    fields.filter(
      (field) =>
        field.status_lavoura ===
        "em_campo",
    ).length;

  const highAttentionCount =
    fields.filter(
      (field) => {
        const item =
          rankingByField.get(
            field.id,
          );

        if (!item) {
          return false;
        }

        const score =
          item.priority_score;

        const label =
          normalizeText(
            priorityLabel(
              item,
            ),
          );

        return (
          label.includes(
            "maxima",
          ) ||
          label.includes(
            "alta",
          ) ||
          (typeof score ===
            "number" &&
            score >= 50)
        );
      },
    ).length;

  const filteredFields =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(search);

      return fields.filter(
        (field) => {
          const matchesStatus =
            filter ===
              "all" ||
            field.status_lavoura ===
              filter;

          const searchable =
            normalizeText(
              [
                field.nome,
                field.cidade,
                field.cultura,
              ].join(" "),
            );

          const matchesSearch =
            !normalizedSearch ||
            searchable.includes(
              normalizedSearch,
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        },
      );
    }, [
      fields,
      filter,
      search,
    ]);

  async function handleDelete(
    field: RegisteredField,
  ) {
    const confirmed =
      window.confirm(
        `Excluir o talhão "${field.nome}"?`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      field.id,
    );

    try {
      await deleteField(
        field.id,
      );

      setFields(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              field.id,
          ),
      );
    } catch (deleteError) {
      window.alert(
        friendlyError(
          deleteError,
        ),
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <LoadingState label="Carregando áreas da safra..." />
    );
  }

  return (
    <div
      className="
        grid
        gap-5
      "
    >
      {error ? (
        <div
          className="
            rounded-[18px]
            border
            border-[rgba(152,97,22,0.14)]
            bg-[rgba(251,239,210,0.50)]
            px-4
            py-3
          "
        >
          <p
            className="
              text-sm
              font-semibold
              text-[var(--pt-color-attention-700)]
            "
          >
            Dados indisponíveis
          </p>

          <p
            className="
              mt-1
              text-xs
              text-[var(--pt-color-structure-600)]
            "
          >
            {error}
          </p>
        </div>
      ) : null}

      <section
        className="
          grid
          gap-3
          sm:grid-cols-3
        "
      >
        <StatCard
          label="Talhões"
          value={fields.length}
          detail="áreas cadastradas"
          tone="earth"
        />

        <StatCard
          label="Em campo"
          value={activeCount}
          detail="lavouras ativas"
          tone="positive"
        />

        <StatCard
          label="Alta atenção"
          value={
            highAttentionCount
          }
          detail="prioridades atuais"
          tone={
            highAttentionCount >
            0
              ? "critical"
              : "neutral"
          }
        />
      </section>

      <SectionCard
        title="Áreas da safra"
        description="Consulte as áreas cadastradas e acesse o histórico operacional de cada talhão."
        action={
          <PrimaryButton
            href="/talhoes/novo"
            icon={Plus}
          >
            Novo talhão
          </PrimaryButton>
        }
      >
        <div
          className="
            mb-5
            flex
            flex-col
            gap-3
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div
            className="
              relative
              w-full
              max-w-md
            "
          >
            <Search
              size={17}
              strokeWidth={1.8}
              className="
                pointer-events-none
                absolute
                left-3.5
                top-1/2
                -translate-y-1/2
                text-[var(--pt-color-structure-400)]
              "
            />

            <input
              type="search"
              value={search}
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Buscar talhão ou cidade"
              className="
                pt-input
                pl-10
              "
            />
          </div>

          <select
            value={filter}
            onChange={(
              event,
            ) =>
              setFilter(
                event.target
                  .value as FieldFilter,
              )
            }
            className="
              pt-input
              w-full
              lg:w-52
            "
          >
            <option value="all">
              Todos os status
            </option>

            <option value="em_campo">
              Em campo
            </option>

            <option value="pre_arranquio">
              Pré-arranquio
            </option>

            <option value="arrancado">
              Arrancado
            </option>

            <option value="colhido">
              Colhido
            </option>
          </select>
        </div>

        {filteredFields.length ===
        0 ? (
          <div
            className="
              flex
              min-h-[250px]
              flex-col
              items-center
              justify-center
              rounded-[18px]
              bg-[rgba(47,37,32,0.018)]
              px-6
              text-center
            "
          >
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-[16px]
                bg-[var(--pt-color-orange-50)]
                text-[var(--pt-color-orange-700)]
              "
            >
              <Sprout
                size={21}
                strokeWidth={1.8}
              />
            </div>

            <h3
              className="
                mt-4
                text-sm
                font-semibold
                text-[var(--pt-color-structure-900)]
              "
            >
              {fields.length ===
              0
                ? "Nenhum talhão cadastrado"
                : "Nenhum resultado encontrado"}
            </h3>

            <p
              className="
                mt-1.5
                max-w-md
                text-sm
                leading-6
                text-[var(--pt-color-structure-500)]
              "
            >
              {fields.length ===
              0
                ? "Cadastre a primeira área produtiva para começar a organizar a safra."
                : "Altere a busca ou o filtro para visualizar outras áreas."}
            </p>

            {fields.length ===
            0 ? (
              <PrimaryButton
                href="/talhoes/novo"
                icon={Plus}
                className="mt-5"
              >
                Cadastrar talhão
              </PrimaryButton>
            ) : null}
          </div>
        ) : (
          <div
            className="
              divide-y
              divide-[rgba(47,37,32,0.07)]
            "
          >
            {filteredFields.map(
              (field) => {
                const priority =
                  rankingByField.get(
                    field.id,
                  );

                return (
                  <article
                    key={
                      field.id
                    }
                    className="
                      grid
                      gap-4
                      py-5
                      first:pt-0
                      last:pb-0
                      lg:grid-cols-[minmax(0,1fr)_180px_180px]
                      lg:items-center
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-0
                        gap-3.5
                      "
                    >
                      <div
                        className="
                          flex
                          h-11
                          w-11
                          shrink-0
                          items-center
                          justify-center
                          rounded-[14px]
                          bg-[var(--pt-color-orange-50)]
                          text-[var(--pt-color-orange-700)]
                        "
                      >
                        <MapPin
                          size={19}
                          strokeWidth={1.8}
                        />
                      </div>

                      <div className="min-w-0">
                        <div
                          className="
                            flex
                            flex-wrap
                            items-center
                            gap-2
                          "
                        >
                          <Link
                            href={`/talhoes/${field.id}`}
                            className="
                              truncate
                              text-[15px]
                              font-semibold
                              text-[var(--pt-color-structure-950)]
                              transition-colors
                              hover:text-[var(--pt-color-orange-700)]
                            "
                          >
                            {
                              field.nome
                            }
                          </Link>

                          <StatusBadge
                            tone={statusTone(
                              field.status_lavoura,
                            )}
                          >
                            {statusLabel(
                              field.status_lavoura,
                            )}
                          </StatusBadge>
                        </div>

                        <div
                          className="
                            mt-1.5
                            flex
                            flex-wrap
                            items-center
                            gap-x-4
                            gap-y-1
                            text-xs
                            text-[var(--pt-color-structure-500)]
                          "
                        >
                          <span>
                            {
                              field.cidade
                            }
                          </span>

                          <span
                            className="
                              flex
                              items-center
                              gap-1.5
                            "
                          >
                            <CalendarDays
                              size={13}
                              strokeWidth={1.7}
                            />

                            Plantio{" "}
                            {formatDate(
                              field.data_plantio,
                            )}
                          </span>

                          <span>
                            {
                              field
                                .doencas_monitoradas
                                .length
                            }{" "}
                            doença(s)
                            monitorada(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p
                        className="
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-[0.12em]
                          text-[var(--pt-color-structure-400)]
                        "
                      >
                        Prioridade
                      </p>

                      <div
                        className="
                          mt-1.5
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <StatusBadge
                          tone={priorityTone(
                            priority,
                          )}
                        >
                          {priorityLabel(
                            priority,
                          )}
                        </StatusBadge>

                        {priority ? (
                          <span
                            className="
                              text-xs
                              font-semibold
                              text-[var(--pt-color-structure-500)]
                            "
                          >
                            {scoreLabel(
                              priority.priority_score,
                            )}
                            /100
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="
                        flex
                        items-center
                        gap-2
                        lg:justify-end
                      "
                    >
                      <Link
                        href={`/talhoes/${field.id}`}
                        className="
                          inline-flex
                          h-10
                          items-center
                          gap-2
                          rounded-[13px]
                          border
                          border-[rgba(47,37,32,0.10)]
                          bg-white/60
                          px-3.5
                          text-xs
                          font-semibold
                          text-[var(--pt-color-structure-800)]
                          transition-all
                          hover:border-[rgba(243,111,33,0.18)]
                          hover:bg-[var(--pt-color-orange-50)]
                          hover:text-[var(--pt-color-orange-700)]
                        "
                      >
                        Abrir

                        <ArrowRight
                          size={14}
                          strokeWidth={1.8}
                        />
                      </Link>

                      <button
                        type="button"
                        disabled={
                          deletingId ===
                          field.id
                        }
                        onClick={() =>
                          void handleDelete(
                            field,
                          )
                        }
                        title="Excluir talhão"
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-[13px]
                          text-[var(--pt-color-structure-300)]
                          transition-colors
                          hover:bg-[var(--pt-color-critical-100)]
                          hover:text-[var(--pt-color-critical-700)]
                          disabled:pointer-events-none
                          disabled:opacity-40
                        "
                      >
                        <Trash2
                          size={16}
                          strokeWidth={1.8}
                        />
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}