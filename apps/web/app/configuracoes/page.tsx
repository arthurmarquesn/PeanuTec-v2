import { Settings, SlidersHorizontal, UserRound } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, SectionCard, StatusBadge } from "@/components/design-system";

const settingsAreas = [
  {
    title: "Conta e equipe",
    description:
      "Preferências de acesso e identificação dos responsáveis técnicos.",
    icon: UserRound,
  },
  {
    title: "Parâmetros operacionais",
    description:
      "Ajustes de referência para rotinas de inspeção, pulverização e calendário.",
    icon: SlidersHorizontal,
  },
];

export default function SettingsPage() {
  return (
    <AppShell
      title="Configurações"
      subtitle="Ajustes administrativos e parâmetros operacionais do PeanuTec."
    >
      <div className="grid gap-5">
        <SectionCard
          title="Preferências do sistema"
          description="Área reservada para ajustes de conta, API e parâmetros operacionais."
          action={<StatusBadge tone="neutral">Em preparação</StatusBadge>}
        >
          <EmptyState title="Configurações em organização" icon={Settings}>
            As preferências serão concentradas aqui sem interferir nos registros
            técnicos já usados pela equipe de campo.
          </EmptyState>
        </SectionCard>

        <section className="grid gap-3 md:grid-cols-2">
          {settingsAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.title}
                className="rounded-[var(--pt-radius-lg)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-surface)] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--pt-radius-md)] border border-[rgba(25,35,29,0.12)] bg-[var(--pt-color-field-50)] text-[var(--pt-color-brand-900)]">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-[var(--pt-color-structure-950)]">
                      {area.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--pt-color-structure-700)]">
                      {area.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
