import Link from "next/link";

import { AppShell } from "@/components/AppShell";

export default function InspectionsPage() {
  return (
    <AppShell title="Inspecoes">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Historico de inspecoes
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Consulte os detalhes de um talhao para ver e registrar inspecoes de
          campo vinculadas a ele.
        </p>
        <Link
          href="/talhoes"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          Ver talhoes
        </Link>
      </section>
    </AppShell>
  );
}
