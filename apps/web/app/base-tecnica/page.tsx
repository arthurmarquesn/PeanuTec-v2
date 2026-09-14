import { BookOpen, FileText, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, SectionCard, StatusBadge } from "@/components/design-system";

const referenceAreas = [
  {
    title: "Protocolos de manejo",
    description:
      "Critérios internos para orientar inspeções, pulverizações e janelas de acompanhamento.",
    icon: ShieldCheck,
  },
  {
    title: "Severidade e sintomas",
    description:
      "Referências para classificar sintomas de mancha-preta e mancha-castanha em campo.",
    icon: FileText,
  },
];

export default function TechnicalBasePage() {
  return (
    <AppShell
      title="Base Técnica"
      subtitle="Referências de manejo para padronizar decisões técnicas da safra de amendoim."
    >
      <div className="grid gap-5">
        <SectionCard
          title="Referências de manejo"
          description="Área preparada para protocolos, critérios de severidade e orientações sobre mancha-preta e mancha-castanha."
          action={<StatusBadge tone="neutral">Em preparação</StatusBadge>}
        >
          <EmptyState title="Conteúdo técnico em organização" icon={BookOpen}>
            Os materiais técnicos serão concentrados aqui para apoiar a equipe
            de campo sem misturar protocolos com registros operacionais.
          </EmptyState>
        </SectionCard>

        <section className="grid gap-3 md:grid-cols-2">
          {referenceAreas.map((area) => {
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
