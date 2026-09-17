"use client";

import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Map,
  Package,
  Wheat,
} from "lucide-react";

import { logoutUser } from "@/lib/api";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { label: "Painel do Dia", href: "/dashboard", icon: LayoutDashboard },
      { label: "Talhões", href: "/talhoes", icon: Map },
      { label: "Calendário", href: "/calendario", icon: CalendarDays },
      { label: "Safra", href: "/safra", icon: Wheat },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Nova Inspeção", href: "/inspecoes/nova", icon: ClipboardCheck },
      { label: "Nova Pulverização", href: "/pulverizacoes/nova", icon: FilePlus2 },
    ],
  },
  {
    label: "Gestão",
    items: [{ label: "Produtos", href: "/produtos", icon: Package }],
  },
];

function isActive(pathname: string, href: string, currentAction: string | null) {
  const [hrefPath, hrefQuery = ""] = href.split("?");
  const hrefAction = new URLSearchParams(hrefQuery).get("acao");
  if (hrefAction) return pathname === hrefPath && currentAction === hrefAction;
  if (hrefPath === "/dashboard") return pathname === hrefPath;
  if (hrefPath === "/talhoes") return (pathname === hrefPath && !currentAction) || pathname.startsWith(`${hrefPath}/`);
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function NavButton({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isActive(pathname, item.href, searchParams.get("acao"));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[
        "group relative flex h-11 items-center gap-3 rounded-[var(--pt-radius-md)] px-3.5",
        "text-sm font-medium transition-all duration-150",
        active
          ? "bg-[var(--pt-color-orange-50)] text-[var(--pt-color-brand-950)] shadow-[inset_0_0_0_1px_rgba(243,111,33,0.12)]"
          : "text-[var(--pt-color-structure-600)] hover:bg-[rgba(47,37,32,0.035)] hover:text-[var(--pt-color-brand-950)]",
      ].join(" ")}
    >
      {active ? <span aria-hidden="true" className="absolute left-0 top-2.5 h-6 w-[3px] rounded-r-full bg-[var(--pt-color-orange-500)]" /> : null}
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} className={active ? "shrink-0 text-[var(--pt-color-orange-600)]" : "shrink-0 text-[var(--pt-color-structure-400)] group-hover:text-[var(--pt-color-structure-700)]"} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavigationSection({ section }: { section: NavSection }) {
  return (
    <section>
      <p className="mb-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--pt-color-structure-400)]">{section.label}</p>
      <div className="grid gap-1">
        {section.items.map((item) => <NavButton key={item.href} item={item} />)}
      </div>
    </section>
  );
}

export function Sidebar() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <aside className="fixed bottom-4 left-4 top-4 z-30 hidden w-60 flex-col overflow-hidden rounded-[var(--pt-radius-2xl)] border border-[rgba(47,37,32,0.09)] bg-[rgba(255,253,250,0.96)] shadow-[0_12px_36px_rgba(47,37,32,0.09)] backdrop-blur-xl lg:flex">
      <div className="flex min-h-[88px] items-center border-b border-[rgba(47,37,32,0.07)] px-5">
        <Image src="/brand/peanutec-logo.png" alt="PeanuTec" width={360} height={120} priority className="h-auto max-h-12 w-auto max-w-[165px] object-contain" />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
        <div className="grid gap-6">{navSections.map((section) => <NavigationSection key={section.label} section={section} />)}</div>
        <div className="mt-auto border-t border-[rgba(47,37,32,0.07)] pt-3">
          <button type="button" onClick={() => void handleLogout()} className="group flex h-11 w-full items-center gap-3 rounded-[var(--pt-radius-md)] px-3.5 text-left text-sm font-medium text-[var(--pt-color-structure-500)] transition-colors duration-150 hover:bg-[var(--pt-color-orange-50)] hover:text-[var(--pt-color-brand-950)]">
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} className="text-[var(--pt-color-structure-400)] transition-colors group-hover:text-[var(--pt-color-orange-600)]" />
            <span>Sair</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
