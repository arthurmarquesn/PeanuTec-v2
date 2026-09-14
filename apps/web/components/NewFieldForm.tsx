"use client";

import type {
  FormEvent,
} from "react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  MapPin,
  Sprout,
} from "lucide-react";

import {
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "@/components/design-system";

import {
  createField,
  getSupportedDiseases,
} from "@/lib/api";

import type {
  CropStatus,
  DiseaseIncidenceLevel,
  FieldRegistrationRequest,
  HistoricalPressure,
  SupportedDisease,
} from "@/types/analysis";

import {
  useRouter,
} from "next/navigation";

/* =========================================================
 * Types
 * ========================================================= */

type BooleanChoice =
  | ""
  | "true"
  | "false";

type FieldFormState = {
  nome: string;
  cidade: string;
  cultura: string;
  data_plantio: string;

  status_lavoura:
    CropStatus;

  doencas_monitoradas:
    string[];

  previous_crop: string;

  crop_rotation:
    BooleanChoice;

  peanut_repetition_years:
    number | "";

  had_disease_incidence:
    BooleanChoice;

  previous_diseases: string;

  disease_incidence_level:
    | ""
    | DiseaseIncidenceLevel;

  historical_pressure:
    | ""
    | HistoricalPressure;

  agronomic_history_notes:
    string;
};

/* =========================================================
 * Constants
 * ========================================================= */

const fallbackDiseases:
  SupportedDisease[] = [
    {
      id: "black-spot",
      name: "Mancha-preta",
      pathogen: "",
      status: "validated",
    },
    {
      id: "brown-spot",
      name: "Mancha-castanha",
      pathogen: "",
      status: "validated",
    },
  ];

const cropStatuses: Array<{
  value: CropStatus;
  label: string;
}> = [
  {
    value: "em_campo",
    label: "Em campo",
  },
  {
    value:
      "pre_arranquio",
    label:
      "Pré-arranquio",
  },
  {
    value: "arrancado",
    label: "Arrancado",
  },
  {
    value: "colhido",
    label: "Colhido",
  },
];

const incidenceLevels: Array<{
  value:
    DiseaseIncidenceLevel;
  label: string;
}> = [
  {
    value: "nenhuma",
    label: "Nenhuma",
  },
  {
    value: "baixa",
    label: "Baixa",
  },
  {
    value: "media",
    label: "Média",
  },
  {
    value: "alta",
    label: "Alta",
  },
];

const historicalPressures: Array<{
  value: HistoricalPressure;
  label: string;
}> = [
  {
    value: "baixa",
    label: "Baixa",
  },
  {
    value: "media",
    label: "Média",
  },
  {
    value: "alta",
    label: "Alta",
  },
];

/* =========================================================
 * Helpers
 * ========================================================= */

function todayIso() {
  const today =
    new Date();

  return [
    today.getFullYear(),

    String(
      today.getMonth() + 1,
    ).padStart(2, "0"),

    String(
      today.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function initialForm():
  FieldFormState {
  return {
    nome: "",
    cidade: "",
    cultura: "Amendoim",

    data_plantio:
      todayIso(),

    status_lavoura:
      "em_campo",

    doencas_monitoradas: [
      "Mancha-preta",
      "Mancha-castanha",
    ],

    previous_crop: "",

    crop_rotation: "",

    peanut_repetition_years:
      "",

    had_disease_incidence:
      "",

    previous_diseases: "",

    disease_incidence_level:
      "",

    historical_pressure: "",

    agronomic_history_notes:
      "",
  };
}

function optionalBoolean(
  value: BooleanChoice,
): boolean | null {
  if (!value) {
    return null;
  }

  return value === "true";
}

function optionalText(
  value: string,
): string | null {
  const trimmed =
    value.trim();

  return trimmed || null;
}

function friendlyError(
  error: unknown,
) {
  if (
    !(error instanceof Error)
  ) {
    return "Não foi possível cadastrar o talhão.";
  }

  const normalized =
    error.message
      .toLowerCase();

  if (
    normalized.includes(
      "failed to fetch",
    )
  ) {
    return "Não foi possível conectar ao backend atual.";
  }

  if (
    normalized.includes(
      "cidade nao encontrada",
    ) ||
    normalized.includes(
      "cidade não encontrada",
    )
  ) {
    return "A cidade informada não foi encontrada. Revise o nome e o estado.";
  }

  return error.message;
}

/* =========================================================
 * Small components
 * ========================================================= */

function FieldLabel({
  children,
  optional = false,
}: {
  children:
    React.ReactNode;

  optional?: boolean;
}) {
  return (
    <label
      className="
        mb-2
        block
        text-xs
        font-semibold
        text-[var(--pt-color-structure-700)]
      "
    >
      {children}

      {optional ? (
        <span
          className="
            ml-1
            font-normal
            text-[var(--pt-color-structure-400)]
          "
        >
          opcional
        </span>
      ) : null}
    </label>
  );
}

function SectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h3
        className="
          text-sm
          font-semibold
          text-[var(--pt-color-structure-950)]
        "
      >
        {title}
      </h3>

      <p
        className="
          mt-1
          max-w-3xl
          text-xs
          leading-5
          text-[var(--pt-color-structure-500)]
        "
      >
        {description}
      </p>
    </div>
  );
}

/* =========================================================
 * Form
 * ========================================================= */

export function NewFieldForm() {
  const router =
    useRouter();

  const [
    form,
    setForm,
  ] =
    useState<FieldFormState>(
      initialForm,
    );

  const [
    diseases,
    setDiseases,
  ] = useState<
    SupportedDisease[]
  >(fallbackDiseases);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  /* =======================================================
   * Supported diseases
   * ======================================================= */

  useEffect(() => {
    let ignore = false;

    async function loadDiseases() {
      try {
        const response =
          await getSupportedDiseases();

        if (
          ignore ||
          response
            .supported_diseases
            .length === 0
        ) {
          return;
        }

        setDiseases(
          response.supported_diseases,
        );
      } catch {
        /*
         * O formulário continua utilizável
         * com as doenças atualmente
         * suportadas pelo PeanuTec.
         */
      }
    }

    void loadDiseases();

    return () => {
      ignore = true;
    };
  }, []);

  /* =======================================================
   * Derived
   * ======================================================= */

  const canSubmit =
    useMemo(() => {
      return Boolean(
        form.nome.trim() &&
          form.cidade.trim() &&
          form.data_plantio &&
          form
            .doencas_monitoradas
            .length > 0,
      );
    }, [form]);

  /* =======================================================
   * Disease toggle
   * ======================================================= */

  function toggleDisease(
    diseaseName: string,
  ) {
    setForm((current) => {
      const selected =
        current
          .doencas_monitoradas
          .includes(
            diseaseName,
          );

      return {
        ...current,

        doencas_monitoradas:
          selected
            ? current
                .doencas_monitoradas
                .filter(
                  (name) =>
                    name !==
                    diseaseName,
                )
            : [
                ...current
                  .doencas_monitoradas,

                diseaseName,
              ],
      };
    });
  }

  /* =======================================================
   * Submit
   * ======================================================= */

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    setError(null);

    if (!canSubmit) {
      setError(
        "Preencha nome, cidade, data de plantio e selecione ao menos uma doença monitorada.",
      );

      return;
    }

    const payload:
      FieldRegistrationRequest =
      {
        nome:
          form.nome.trim(),

        cidade:
          form.cidade.trim(),

        cultura:
          form.cultura.trim() ||
          "Amendoim",

        data_plantio:
          form.data_plantio,

        status_lavoura:
          form.status_lavoura,

        doencas_monitoradas:
          form.doencas_monitoradas,

        previous_crop:
          optionalText(
            form.previous_crop,
          ),

        crop_rotation:
          optionalBoolean(
            form.crop_rotation,
          ),

        peanut_repetition_years:
          form.peanut_repetition_years ===
          ""
            ? null
            : Number(
                form.peanut_repetition_years,
              ),

        had_disease_incidence:
          optionalBoolean(
            form.had_disease_incidence,
          ),

        previous_diseases:
          optionalText(
            form.previous_diseases,
          ),

        disease_incidence_level:
          form.disease_incidence_level ||
          null,

        historical_pressure:
          form.historical_pressure ||
          null,

        agronomic_history_notes:
          optionalText(
            form.agronomic_history_notes,
          ),
      };

    setIsSaving(true);

    try {
      const created =
        await createField(
          payload,
        );

      router.push(
        `/talhoes/${created.id}`,
      );
    } catch (submitError) {
      setError(
        friendlyError(
          submitError,
        ),
      );

      setIsSaving(false);
    }
  }

  /* =======================================================
   * Render
   * ======================================================= */

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="
        grid
        gap-5
        pb-6
      "
    >
      {error ? (
        <div
          className="
            rounded-[18px]
            border
            border-[rgba(154,61,50,0.14)]
            bg-[rgba(245,222,218,0.52)]
            px-4
            py-3
          "
        >
          <p
            className="
              text-sm
              font-semibold
              text-[var(--pt-color-critical-700)]
            "
          >
            Não foi possível salvar
          </p>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-[var(--pt-color-structure-600)]
            "
          >
            {error}
          </p>
        </div>
      ) : null}

      {/* ===================================================
       * Identification
       * =================================================== */}

      <SectionCard>
        <SectionIntro
          title="Identificação da área"
          description="Informações básicas utilizadas em todo o acompanhamento operacional do talhão."
        />

        <div
          className="
            grid
            gap-5
            md:grid-cols-2
          "
        >
          <div>
            <FieldLabel>
              Nome do talhão
            </FieldLabel>

            <input
              autoFocus
              type="text"
              value={form.nome}
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    nome:
                      event
                        .target
                        .value,
                  }),
                )
              }
              placeholder="Ex.: Talhão Norte"
              className="pt-input"
            />
          </div>

          <div>
            <FieldLabel>
              Cidade
            </FieldLabel>

            <div className="relative">
              <MapPin
                size={16}
                strokeWidth={
                  1.8
                }
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
                type="text"
                value={
                  form.cidade
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      cidade:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Ex.: Pompeia-SP"
                className="
                  pt-input
                  pl-10
                "
              />
            </div>
          </div>

          <div>
            <FieldLabel>
              Cultura
            </FieldLabel>

            <div className="relative">
              <Sprout
                size={16}
                strokeWidth={
                  1.8
                }
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
                type="text"
                value={
                  form.cultura
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      cultura:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="
                  pt-input
                  pl-10
                "
              />
            </div>
          </div>

          <div>
            <FieldLabel>
              Data de plantio
            </FieldLabel>

            <input
              type="date"
              value={
                form.data_plantio
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    data_plantio:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="pt-input"
            />
          </div>

          <div>
            <FieldLabel>
              Situação da lavoura
            </FieldLabel>

            <select
              value={
                form.status_lavoura
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    status_lavoura:
                      event
                        .target
                        .value as CropStatus,
                  }),
                )
              }
              className="pt-input"
            >
              {cropStatuses.map(
                (status) => (
                  <option
                    key={
                      status.value
                    }
                    value={
                      status.value
                    }
                  >
                    {
                      status.label
                    }
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* ===================================================
       * Monitoring
       * =================================================== */}

      <SectionCard>
        <SectionIntro
          title="Monitoramento fitossanitário"
          description="Selecione os problemas que devem compor a rotina de avaliação do PeanuTec."
        />

        <div
          className="
            grid
            gap-3
            md:grid-cols-2
          "
        >
          {diseases.map(
            (disease) => {
              const selected =
                form
                  .doencas_monitoradas
                  .includes(
                    disease.name,
                  );

              return (
                <button
                  key={
                    disease.id
                  }
                  type="button"
                  onClick={() =>
                    toggleDisease(
                      disease.name,
                    )
                  }
                  className={[
                    "flex min-h-[76px] items-center gap-3 rounded-[16px] border px-4 text-left transition-all",

                    selected
                      ? "border-[rgba(243,111,33,0.22)] bg-[var(--pt-color-orange-50)]"
                      : "border-[rgba(47,37,32,0.09)] bg-white/50 hover:border-[rgba(47,37,32,0.16)]",
                  ].join(
                    " ",
                  )}
                >
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border",

                      selected
                        ? "border-[rgba(243,111,33,0.16)] bg-[var(--pt-color-orange-500)] text-white"
                        : "border-[rgba(47,37,32,0.10)] bg-white text-transparent",
                    ].join(
                      " ",
                    )}
                  >
                    <Check
                      size={15}
                      strokeWidth={
                        2
                      }
                    />
                  </span>

                  <div className="min-w-0">
                    <p
                      className="
                        text-sm
                        font-semibold
                        text-[var(--pt-color-structure-900)]
                      "
                    >
                      {
                        disease.name
                      }
                    </p>

                    {disease.pathogen ? (
                      <p
                        className="
                          mt-1
                          truncate
                          text-[11px]
                          text-[var(--pt-color-structure-400)]
                        "
                      >
                        {
                          disease.pathogen
                        }
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            },
          )}
        </div>
      </SectionCard>

      {/* ===================================================
       * Agronomic history
       * =================================================== */}

      <SectionCard>
        <SectionIntro
          title="Histórico agronômico"
          description="Esses dados ajudam a contextualizar a pressão histórica da área. Se ainda não souber alguma informação, deixe em branco."
        />

        <div
          className="
            grid
            gap-5
            md:grid-cols-2
          "
        >
          <div>
            <FieldLabel optional>
              Cultura anterior
            </FieldLabel>

            <input
              type="text"
              value={
                form.previous_crop
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    previous_crop:
                      event
                        .target
                        .value,
                  }),
                )
              }
              placeholder="Ex.: Milho"
              className="pt-input"
            />
          </div>

          <div>
            <FieldLabel optional>
              Houve rotação de culturas?
            </FieldLabel>

            <select
              value={
                form.crop_rotation
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    crop_rotation:
                      event
                        .target
                        .value as BooleanChoice,
                  }),
                )
              }
              className="pt-input"
            >
              <option value="">
                Não informado
              </option>

              <option value="true">
                Sim
              </option>

              <option value="false">
                Não
              </option>
            </select>
          </div>

          <div>
            <FieldLabel optional>
              Anos consecutivos com amendoim
            </FieldLabel>

            <input
              type="number"
              min={0}
              max={50}
              value={
                form.peanut_repetition_years
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    peanut_repetition_years:
                      event
                        .target
                        .value ===
                      ""
                        ? ""
                        : Number(
                            event
                              .target
                              .value,
                          ),
                  }),
                )
              }
              placeholder="Ex.: 2"
              className="pt-input"
            />
          </div>

          <div>
            <FieldLabel optional>
              Já houve incidência de doença?
            </FieldLabel>

            <select
              value={
                form.had_disease_incidence
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    had_disease_incidence:
                      event
                        .target
                        .value as BooleanChoice,
                  }),
                )
              }
              className="pt-input"
            >
              <option value="">
                Não informado
              </option>

              <option value="true">
                Sim
              </option>

              <option value="false">
                Não
              </option>
            </select>
          </div>

          <div>
            <FieldLabel optional>
              Doenças observadas anteriormente
            </FieldLabel>

            <input
              type="text"
              value={
                form.previous_diseases
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    previous_diseases:
                      event
                        .target
                        .value,
                  }),
                )
              }
              placeholder="Ex.: Mancha-preta"
              className="pt-input"
            />
          </div>

          <div>
            <FieldLabel optional>
              Intensidade da incidência anterior
            </FieldLabel>

            <select
              value={
                form.disease_incidence_level
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    disease_incidence_level:
                      event
                        .target
                        .value as
                        | ""
                        | DiseaseIncidenceLevel,
                  }),
                )
              }
              className="pt-input"
            >
              <option value="">
                Não informado
              </option>

              {incidenceLevels.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <FieldLabel optional>
              Pressão histórica
            </FieldLabel>

            <select
              value={
                form.historical_pressure
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    historical_pressure:
                      event
                        .target
                        .value as
                        | ""
                        | HistoricalPressure,
                  }),
                )
              }
              className="pt-input"
            >
              <option value="">
                Não informado
              </option>

              {historicalPressures.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <FieldLabel optional>
              Observações do histórico
            </FieldLabel>

            <textarea
              value={
                form.agronomic_history_notes
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (current) => ({
                    ...current,

                    agronomic_history_notes:
                      event
                        .target
                        .value,
                  }),
                )
              }
              placeholder="Informações relevantes sobre a área, safras anteriores ou comportamento fitossanitário."
              className="pt-textarea"
            />
          </div>
        </div>
      </SectionCard>

      {/* ===================================================
       * Actions
       * =================================================== */}

      <div
        className="
          flex
          flex-col-reverse
          gap-3
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <SecondaryButton
          href="/talhoes"
          icon={ArrowLeft}
        >
          Voltar
        </SecondaryButton>

        <PrimaryButton
          type="submit"
          disabled={
            !canSubmit ||
            isSaving
          }
          icon={Sprout}
        >
          {isSaving
            ? "Cadastrando..."
            : "Cadastrar talhão"}
        </PrimaryButton>
      </div>
    </form>
  );
}