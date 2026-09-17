import "server-only";

import { listOwnedFieldIds } from "@/server/auth/authorization";
import { prisma } from "@/server/db/prisma";
import { listCalendarEvents } from "@/server/calendar/calendar.service";
import { getCurrentFieldSituation } from "@/server/situation/current-field-situation.service";
import { getSaoPauloDateKey } from "@/server/time/sao-paulo";
import type { CurrentFieldSituation, SeasonOverview } from "@/types/analysis";
import { getUserSeasonMetrics } from "@/server/season/user-season.service";

const SITUATION_LABELS: Record<string, string> = {
  estavel: "Estável",
  monitorar: "Monitorar",
  monitorar_resposta: "Monitorar resposta",
  alta_atencao: "Alta atenção",
  prioridade_maxima: "Prioridade máxima",
  sem_prioridade_operacional: "Sem prioridade operacional imediata",
};

function daysSince(dateValue: string | null | undefined, today: string): number | null {
  if (!dateValue) return null;
  const date = dateValue.slice(0, 10);
  const diff = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(diff) ? diff : null;
}

function countBy(values: string[], order: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const rows = [] as Array<{ current_situation: string; situation_label: string; fields_count: number }>;
  for (const key of order) {
    const count = counts.get(key) ?? 0;
    if (count) rows.push({ current_situation: key, situation_label: SITUATION_LABELS[key] ?? key, fields_count: count });
    counts.delete(key);
  }
  for (const [key, count] of counts) {
    if (count) rows.push({ current_situation: key, situation_label: SITUATION_LABELS[key] ?? key, fields_count: count });
  }
  return rows;
}

function defenseDistribution(situations: CurrentFieldSituation[]) {
  const order = ["muito_alta", "alta", "media", "baixa", "vencida", "sem_registro"];
  const counts = new Map<string, number>();
  for (const situation of situations) {
    const status = situation.spray_context.defense_status;
    if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return order
    .filter((status) => counts.has(status))
    .map((status) => ({ defense_status: status, fields_count: counts.get(status) ?? 0 }));
}

function buildAlerts(situations: CurrentFieldSituation[], today: string) {
  const alerts: Array<Record<string, string>> = [];
  for (const situation of situations) {
    const field = { field_id: situation.field_id, field_name: situation.field_name };
    if (situation.current_situation === "prioridade_maxima") {
      alerts.push({ ...field, type: "prioridade_maxima", severity: "alta", title: "Talhão em prioridade máxima", description: "A situação atual indica necessidade de verificação operacional." });
    }
    if (situation.spray_context.defense_status === "vencida") {
      alerts.push({ ...field, type: "defesa_vencida", severity: "alta", title: "Defesa estimada vencida", description: "A última pulverização registrada está fora da janela operacional estimada." });
    } else if (situation.spray_context.defense_status === "baixa") {
      alerts.push({ ...field, type: "defesa_baixa", severity: "media", title: "Defesa estimada baixa", description: "A defesa fitossanitária estimada está em nível baixo para acompanhamento." });
    }
    const lastInspection = situation.inspection_context.last_inspection_date ?? situation.inspection_context.inspected_at;
    const inspectionAge = daysSince(lastInspection, today);
    if (inspectionAge === null || inspectionAge > 7) {
      alerts.push({ ...field, type: "sem_inspecao_recente", severity: "media", title: "Sem inspeção recente", description: "Não há inspeção recente registrada para confirmar sintomas em campo." });
    }
  }
  return alerts.sort((a, b) => (a.severity === "alta" ? -1 : 0) - (b.severity === "alta" ? -1 : 0) || a.title.localeCompare(b.title, "pt-BR"));
}

export async function getUserSeasonOverview(): Promise<SeasonOverview> {
  const ownedIds = await listOwnedFieldIds();
  const fields = ownedIds.length
    ? await prisma.field.findMany({
        where: { id: { in: ownedIds } },
        select: { id: true, cropStatus: true },
      })
    : [];
  const activeFields = fields.filter((field) => field.cropStatus === "em_campo");
  const situations = await Promise.all(activeFields.map((field) => getCurrentFieldSituation(field.id)));
  const metrics = await getUserSeasonMetrics();
  const allEvents = await listCalendarEvents();
  const upcomingEnd = new Date(`${getSaoPauloDateKey()}T00:00:00Z`);
  upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 14);
  const endDate = upcomingEnd.toISOString().slice(0, 10);
  const upcomingEvents = allEvents.events.filter((event) =>
    (event.field_id === null || ownedIds.includes(event.field_id)) &&
    event.date >= getSaoPauloDateKey() && event.date <= endDate &&
    (event.status === "previsto" || event.status === "informativo"),
  );

  const defenses = situations
    .map((situation) => situation.spray_context.estimated_defense_percent)
    .filter((value): value is number => typeof value === "number");
  const averageDefense = defenses.length
    ? Math.round((defenses.reduce((sum, value) => sum + value, 0) / defenses.length) * 100) / 100
    : 0;
  const today = getSaoPauloDateKey();
  const statusValues = situations.map((situation) => situation.current_situation);
  const criticalFields = situations
    .filter((situation) => situation.current_situation === "alta_atencao" || situation.current_situation === "prioridade_maxima")
    .map((situation) => ({
      field_id: situation.field_id,
      field_name: situation.field_name,
      current_situation: situation.current_situation,
      situation_label: situation.situation_label,
      main_disease: situation.risk_context.main_disease,
      agronomic_index: situation.risk_context.agronomic_index,
      estimated_defense_percent: situation.spray_context.estimated_defense_percent,
      defense_status: situation.spray_context.defense_status,
      recommended_next_action: situation.recommended_next_action,
    }));

  const summary = {
    total_fields: fields.length,
    active_fields: activeFields.length,
    stable_fields: situations.filter((s) => s.current_situation === "estavel").length,
    monitoring_fields: situations.filter((s) => s.current_situation === "monitorar" || s.current_situation === "monitorar_resposta").length,
    high_attention_fields: situations.filter((s) => s.current_situation === "alta_atencao").length,
    maximum_priority_fields: situations.filter((s) => s.current_situation === "prioridade_maxima").length,
    low_or_expired_defense_fields: situations.filter((s) => ["baixa", "vencida", "sem_registro"].includes(s.spray_context.defense_status ?? "")).length,
    fields_without_spray: situations.filter((s) => s.spray_context.has_spray_record !== true).length,
    fields_without_recent_inspection: situations.filter((s) => {
      const age = daysSince(s.inspection_context.last_inspection_date ?? s.inspection_context.inspected_at, today);
      return age === null || age > 7;
    }).length,
    average_estimated_defense_percent: averageDefense,
  };

  return {
    summary,
    status_distribution: countBy(statusValues, ["estavel", "monitorar", "monitorar_resposta", "alta_atencao", "prioridade_maxima", "sem_prioridade_operacional"]),
    defense_distribution: defenseDistribution(situations),
    critical_fields: criticalFields,
    operational_alerts: buildAlerts(situations, today),
    top_product: metrics.top_products[0] ?? null,
    top_target: metrics.top_targets[0] ?? null,
    upcoming_calendar_events: upcomingEvents,
  } as SeasonOverview;
}
