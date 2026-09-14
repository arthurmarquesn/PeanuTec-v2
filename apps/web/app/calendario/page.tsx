"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  LoadingState,
  OperationalAlert,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/design-system";
import {
  exportCalendarExcel,
  getCalendarEvents,
  getCalendarSummary,
  getFields,
} from "@/lib/api";
import type {
  CalendarEvent,
  CalendarEventsResponse,
  CalendarEventType,
  CalendarSummary,
  ProductType,
  RegisteredField,
} from "@/types/analysis";

type Tone = "positive" | "attention" | "critical" | "info" | "earth" | "neutral";

type CalendarDay = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
};

type EventStyle = {
  label: string;
  tone: Tone;
  className: string;
  dotClassName: string;
};

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const eventTypeOptions: { value: CalendarEventType; label: string }[] = [
  { value: "pulverizacao", label: "Pulverização" },
  { value: "inspecao", label: "Inspeção" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "reaplicacao_prevista", label: "Reaplicação prevista" },
  { value: "observacao", label: "Observação" },
];

const productTypeOptions: { value: ProductType; label: string }[] = [
  { value: "fungicida", label: "Fungicida" },
  { value: "inseticida", label: "Inseticida" },
  { value: "acaricida", label: "Acaricida" },
  { value: "herbicida", label: "Herbicida" },
  { value: "outro", label: "Outro" },
];

const eventStyles: Record<CalendarEventType, EventStyle> = {
  pulverizacao: {
    label: "Pulverização",
    tone: "attention",
    className:
      "border-[rgba(147,95,22,0.28)] bg-[var(--pt-color-attention-100)] text-[var(--pt-color-attention-700)]",
    dotClassName: "bg-[var(--pt-color-attention-700)]",
  },
  inspecao: {
    label: "Inspeção",
    tone: "positive",
    className:
      "border-[rgba(47,112,70,0.28)] bg-[var(--pt-color-leaf-100)] text-[var(--pt-color-leaf-700)]",
    dotClassName: "bg-[var(--pt-color-leaf-700)]",
  },
  monitoramento: {
    label: "Monitoramento",
    tone: "info",
    className:
      "border-[rgba(54,95,124,0.28)] bg-[var(--pt-color-info-100)] text-[var(--pt-color-info-700)]",
    dotClassName: "bg-[var(--pt-color-info-700)]",
  },
  reaplicacao_prevista: {
    label: "Reaplicação",
    tone: "earth",
    className:
      "border-[rgba(114,86,58,0.28)] bg-[var(--pt-color-earth-100)] text-[var(--pt-color-earth-800)]",
    dotClassName: "bg-[var(--pt-color-earth-700)]",
  },
  observacao: {
    label: "Observação",
    tone: "neutral",
    className:
      "border-[rgba(25,35,29,0.14)] bg-[var(--pt-color-structure-100)] text-[var(--pt-color-structure-700)]",
    dotClassName: "bg-[var(--pt-color-structure-500)]",
  },
};

const filterClassName = "pt-input h-10 text-sm";

function friendlyErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível carregar o calendário. Verifique a API e tente novamente.";

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

function friendlyExportErrorMessage(error: unknown): string {
  const fallback =
    "Não foi possível exportar o calendário. Tente novamente em instantes.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  ) {
    return "Não foi possível conectar à API para exportar o calendário.";
  }

  return error.message || fallback;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function startOfCalendarGrid(monthDate: Date): Date {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;

  return addDays(monthStart, -mondayOffset);
}

function buildCalendarDays(monthDate: Date): CalendarDay[] {
  const gridStart = startOfCalendarGrid(monthDate);
  const currentMonth = monthDate.getMonth();

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);

    return {
      date,
      key: toIsoDate(date),
      inCurrentMonth: date.getMonth() === currentMonth,
    };
  });
}

function formatMonthTitle(date: Date): string {
  const value = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(parseIsoDate(value));
}

function formatNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  return String(value);
}

function formatEventStatus(value: string | null | undefined): string {
  if (!value) {
    return "Não informado";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groupedEvents = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const startDate = parseIsoDate(event.date);
    const endDate = parseIsoDate(event.end_date || event.date);
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const key = toIsoDate(currentDate);
      const dayEvents = groupedEvents.get(key) ?? [];

      dayEvents.push(event);
      groupedEvents.set(key, dayEvents);
      currentDate = addDays(currentDate, 1);
    }
  });

  return groupedEvents;
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: Tone;
}) {
  return <StatCard label={label} value={value} tone={tone} />;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--pt-color-structure-950)]">
        {formatNullable(value)}
      </dd>
    </div>
  );
}

function EventButton({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
}) {
  const style = eventStyles[event.event_type];
  const fieldName = event.field_name ?? "Sem talhão";

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      title={`${style.label} · ${fieldName}`}
      aria-label={`Abrir detalhes: ${style.label} em ${fieldName}`}
      className={`w-full rounded-[var(--pt-radius-md)] border px-3 py-2 text-left transition hover:ring-2 hover:ring-[rgba(25,35,29,0.10)] ${style.className}`}
    >
      <span className="block truncate text-xs font-semibold leading-4">
        {style.label}
      </span>

      <span className="mt-1 block truncate text-[11px] font-medium leading-4 opacity-85">
        {fieldName}
      </span>
    </button>
  );
}

function EmptyCalendarDay() {
  return (
    <span className="text-xs text-[var(--pt-color-structure-300)]">
      -
    </span>
  );
}

export default function CalendarPage() {
  const [monthDate, setMonthDate] = useState(() => {
    const today = new Date();

    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [eventsResponse, setEventsResponse] =
    useState<CalendarEventsResponse | null>(null);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [fields, setFields] = useState<RegisteredField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<
    CalendarEventType | ""
  >("");
  const [selectedProductType, setSelectedProductType] = useState<
    ProductType | ""
  >("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);

  const gridStartKey = calendarDays[0]?.key ?? toIsoDate(monthDate);
  const gridEndKey =
    calendarDays[calendarDays.length - 1]?.key ?? toIsoDate(monthDate);

  const groupedEvents = useMemo(
    () => groupEventsByDate(eventsResponse?.events ?? []),
    [eventsResponse],
  );

  useEffect(() => {
    let ignore = false;

    async function loadCalendar() {
      setIsLoading(true);
      setError(null);

      try {
        const [eventsData, summaryData, fieldsData] = await Promise.all([
          getCalendarEvents({
            start_date: gridStartKey,
            end_date: gridEndKey,
            field_id: selectedFieldId || undefined,
            event_type: selectedEventType || undefined,
            product_type: selectedProductType || undefined,
          }),
          getCalendarSummary(),
          getFields(),
        ]);

        if (ignore) {
          return;
        }

        setEventsResponse(eventsData);
        setSummary(summaryData);
        setFields(fieldsData);
      } catch (loadError) {
        if (!ignore) {
          setError(friendlyErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadCalendar();

    return () => {
      ignore = true;
    };
  }, [
    gridEndKey,
    gridStartKey,
    selectedEventType,
    selectedFieldId,
    selectedProductType,
  ]);

  function goToPreviousMonth() {
    setMonthDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  }

  function goToNextMonth() {
    setMonthDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  }

  function goToCurrentMonth() {
    const today = new Date();

    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  async function handleExportExcel() {
    setExportError(null);
    setIsExporting(true);

    try {
      const fileBlob = await exportCalendarExcel({
        start_date: gridStartKey,
        end_date: gridEndKey,
        field_id: selectedFieldId || undefined,
        event_type: selectedEventType || undefined,
        product_type: selectedProductType || undefined,
      });
      const fileUrl = window.URL.createObjectURL(fileBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = fileUrl;
      downloadLink.download = "calendario-manejo-peanutec.xlsx";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (exportErrorValue) {
      setExportError(friendlyExportErrorMessage(exportErrorValue));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <AppShell
      title="Calendário de Manejo"
      subtitle="Planejamento e acompanhamento de inspeções, pulverizações e janelas de atenção por talhão."
    >
      <div className="grid gap-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Talhões ativos"
            value={summary?.active_fields ?? "-"}
            tone="earth"
          />

          <SummaryCard
            label="Eventos"
            value={summary?.events_count ?? "-"}
            tone="info"
          />

          <SummaryCard
            label="Pulverizações"
            value={summary?.spray_events_count ?? "-"}
            tone="attention"
          />

          <SummaryCard
            label="Inspeções"
            value={summary?.inspection_events_count ?? "-"}
            tone="positive"
          />

          <SummaryCard
            label="Atenção futura"
            value={summary?.upcoming_attention_count ?? "-"}
            tone="earth"
          />

          <SummaryCard
            label="Sem inspeção recente"
            value={summary?.fields_without_recent_inspection ?? "-"}
            tone={
              summary && summary.fields_without_recent_inspection > 0
                ? "attention"
                : "neutral"
            }
          />
        </section>

        <SectionCard
          title={formatMonthTitle(monthDate)}
          description="Use os filtros para revisar eventos por talhão, tipo de atividade ou tipo de produto."
          action={
            <PrimaryButton
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              icon={Download}
            >
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </PrimaryButton>
          }
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                onClick={goToPreviousMonth}
                icon={ChevronLeft}
              >
                Anterior
              </SecondaryButton>

              <SecondaryButton
                type="button"
                onClick={goToCurrentMonth}
                icon={RotateCcw}
              >
                Hoje
              </SecondaryButton>

              <SecondaryButton
                type="button"
                onClick={goToNextMonth}
                icon={ChevronRight}
                iconPosition="right"
              >
                Próximo
              </SecondaryButton>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="pt-label">Talhão</span>
                <select
                  value={selectedFieldId}
                  onChange={(event) => setSelectedFieldId(event.target.value)}
                  className={filterClassName}
                >
                  <option value="">Todos os talhões</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="pt-label">Tipo de evento</span>
                <select
                  value={selectedEventType}
                  onChange={(event) =>
                    setSelectedEventType(
                      event.target.value as CalendarEventType | "",
                    )
                  }
                  className={filterClassName}
                >
                  <option value="">Todos os tipos</option>
                  {eventTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="pt-label">Tipo de produto</span>
                <select
                  value={selectedProductType}
                  onChange={(event) =>
                    setSelectedProductType(event.target.value as ProductType | "")
                  }
                  className={filterClassName}
                >
                  <option value="">Todos os produtos</option>
                  {productTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </SectionCard>

        {error ? (
          <OperationalAlert
            title="Não foi possível carregar o calendário"
            description={error}
            severity="attention"
          />
        ) : null}

        {exportError ? (
          <OperationalAlert
            title="Não foi possível exportar o calendário"
            description={exportError}
            severity="attention"
          />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] shadow-[var(--pt-shadow-card)]">
            <div className="overflow-x-auto">
              <div className="min-w-[1540px]">
                <div className="grid grid-cols-7 border-b border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)]">
                  {weekDays.map((weekDay) => (
                    <div
                      key={weekDay}
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pt-color-structure-500)]"
                    >
                      {weekDay}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dayEvents = groupedEvents.get(day.key) ?? [];
                    const isToday = day.key === toIsoDate(new Date());
                    const visibleEvents = dayEvents.slice(0, 7);
                    const hiddenEventsCount =
                      dayEvents.length - visibleEvents.length;

                    return (
                      <div
                        key={day.key}
                        className={`min-h-[18rem] border-b border-r border-[rgba(25,35,29,0.10)] p-4 ${
                          day.inCurrentMonth
                            ? "bg-[var(--pt-color-surface)]"
                            : "bg-[var(--pt-color-field-50)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-[var(--pt-radius-sm)] text-sm font-semibold ${
                              isToday
                                ? "bg-[var(--pt-color-brand-900)] text-white"
                                : day.inCurrentMonth
                                  ? "text-[var(--pt-color-structure-950)]"
                                  : "text-[var(--pt-color-structure-300)]"
                            }`}
                          >
                            {day.date.getDate()}
                          </span>

                          {dayEvents.length > 0 ? (
                            <span className="rounded-[var(--pt-radius-sm)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--pt-color-structure-600)]">
                              {dayEvents.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-2">
                          {dayEvents.length === 0 ? (
                            <EmptyCalendarDay />
                          ) : (
                            visibleEvents.map((event) => (
                              <EventButton
                                key={`${day.key}-${event.id}`}
                                event={event}
                                onSelect={setSelectedEvent}
                              />
                            ))
                          )}

                          {hiddenEventsCount > 0 ? (
                            <button
                              type="button"
                              className="rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.14)] bg-[var(--pt-color-surface-muted)] px-3 py-2 text-left text-xs font-semibold text-[var(--pt-color-structure-600)]"
                            >
                              +{hiddenEventsCount} evento
                              {hiddenEventsCount === 1 ? "" : "s"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="border-t border-[rgba(25,35,29,0.12)] px-4 py-3">
                <LoadingState label="Carregando calendário..." />
              </div>
            ) : (
              <div className="border-t border-[rgba(25,35,29,0.12)] px-4 py-3 text-sm text-[var(--pt-color-structure-600)]">
                {eventsResponse?.total ?? 0} evento(s) no período exibido.
              </div>
            )}
          </section>

          <aside className="grid gap-5 self-start">
            <SectionCard title="Legenda">
              <div className="grid gap-2">
                {eventTypeOptions.map((option) => {
                  const style = eventStyles[option.value];

                  return (
                    <div
                      key={option.value}
                      className="flex items-center gap-2 text-sm text-[var(--pt-color-structure-700)]"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${style.dotClassName}`}
                      />
                      <span>{style.label}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Detalhes do evento">
              {selectedEvent ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <StatusBadge tone={eventStyles[selectedEvent.event_type].tone}>
                        {eventStyles[selectedEvent.event_type].label}
                      </StatusBadge>

                      <h2 className="mt-3 text-lg font-semibold text-[var(--pt-color-structure-950)]">
                        {selectedEvent.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--pt-radius-sm)] border border-[rgba(25,35,29,0.18)] text-[var(--pt-color-structure-600)] transition hover:bg-[var(--pt-color-field-50)]"
                      aria-label="Fechar detalhes do evento"
                    >
                      <X size={16} strokeWidth={1.9} />
                    </button>
                  </div>

                  <dl className="mt-4 grid gap-2">
                    <DetailItem
                      label="Data"
                      value={formatDate(selectedEvent.date)}
                    />

                    <DetailItem
                      label="Talhão"
                      value={selectedEvent.field_name ?? selectedEvent.field_id}
                    />

                    <DetailItem
                      label="Tipo de evento"
                      value={eventStyles[selectedEvent.event_type].label}
                    />

                    <DetailItem
                      label="Status"
                      value={formatEventStatus(selectedEvent.status)}
                    />

                    <DetailItem label="Título" value={selectedEvent.title} />

                    <DetailItem label="Produto" value={selectedEvent.product} />

                    <DetailItem
                      label="Tipo de produto"
                      value={selectedEvent.product_type}
                    />

                    <DetailItem label="Alvo" value={selectedEvent.target} />

                    <DetailItem
                      label="Intervalo planejado"
                      value={
                        selectedEvent.planned_interval_days
                          ? `${selectedEvent.planned_interval_days} dias`
                          : null
                      }
                    />

                    <DetailItem label="Observações" value={selectedEvent.notes} />
                  </dl>
                </>
              ) : (
                <div>
                  <p className="text-sm leading-6 text-[var(--pt-color-structure-700)]">
                    Toque em um evento no calendário para ver produto, alvo,
                    talhão, intervalo planejado e observações.
                  </p>
                </div>
              )}
            </SectionCard>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
