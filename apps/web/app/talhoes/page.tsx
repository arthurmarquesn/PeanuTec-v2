"use client";

import {
  Suspense,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  ClipboardCheck,
  FilePlus2,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";

import FieldsOverview from "@/components/FieldsOverview";

import {
  LoadingState,
} from "@/components/design-system";

function actionMessage(
  action: string | null,
) {
  if (
    action === "inspecao"
  ) {
    return {
      title:
        "Selecione o talhão da inspeção",

      description:
        "Abra a área que será vistoriada para registrar as observações de campo.",

      icon:
        ClipboardCheck,
    };
  }

  if (
    action ===
    "pulverizacao"
  ) {
    return {
      title:
        "Selecione o talhão da aplicação",

      description:
        "Abra a área onde a pulverização será registrada.",

      icon:
        FilePlus2,
    };
  }

  return null;
}

function FieldsPageContent() {
  const searchParams =
    useSearchParams();

  const message =
    actionMessage(
      searchParams.get(
        "acao",
      ),
    );

  const Icon =
    message?.icon;

  return (
    <AppShell
      title="Talhões"
      subtitle="Áreas produtivas e histórico operacional da safra."
    >
      <div
        className="
          grid
          gap-5
        "
      >
        {message &&
        Icon ? (
          <div
            className="
              flex
              items-center
              gap-3
              rounded-[18px]
              border
              border-[rgba(243,111,33,0.12)]
              bg-[var(--pt-color-orange-50)]
              px-4
              py-3.5
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-[12px]
                bg-white/70
                text-[var(--pt-color-orange-700)]
              "
            >
              <Icon
                size={17}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <p
                className="
                  text-sm
                  font-semibold
                  text-[var(--pt-color-structure-900)]
                "
              >
                {message.title}
              </p>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-[var(--pt-color-structure-500)]
                "
              >
                {message.description}
              </p>
            </div>
          </div>
        ) : null}

        <FieldsOverview />
      </div>
    </AppShell>
  );
}

export default function FieldsPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          title="Talhões"
          subtitle="Áreas produtivas e histórico operacional da safra."
        >
          <LoadingState label="Carregando talhões..." />
        </AppShell>
      }
    >
      <FieldsPageContent />
    </Suspense>
  );
}