"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export function AppShell({
  title,
  subtitle,
  children,
}: AppShellProps) {
  const router = useRouter();

  const token = useSyncExternalStore(
    () => () => undefined,

    () => {
      if (typeof window === "undefined") {
        return null;
      }

      return localStorage.getItem("access_token");
    },

    () => null,
  );

  useEffect(() => {
    if (AUTH_DISABLED) {
      return;
    }

    if (!token) {
      router.replace("/login");
    }
  }, [router, token]);

  /*
   * Durante o desenvolvimento do PeanuTec V2,
   * podemos desativar temporariamente a autenticação
   * através de:
   *
   * NEXT_PUBLIC_DISABLE_AUTH=true
   */
  if (!AUTH_DISABLED && !token) {
    return (
      <main className="pt-page-shell flex min-h-screen items-center justify-center px-4">
        <section className="pt-card max-w-md px-6 py-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--pt-radius-md)] bg-[var(--pt-color-orange-100)] text-2xl">
            🌱
          </div>

          <h1 className="mt-4 text-lg font-semibold text-[var(--pt-color-brand-950)]">
            Carregando PeanuTec
          </h1>

          <p className="mt-2 text-sm leading-6 text-[var(--pt-color-structure-700)]">
            Preparando sua central de gestão da safra.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="pt-page-shell min-h-screen text-[var(--pt-color-structure-950)]">
      <Sidebar />

      <div className="min-h-screen lg:pl-72">
        <TopBar
          title={title}
          subtitle={subtitle}
        />

        <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}