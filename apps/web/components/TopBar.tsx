"use client";

import {
  useState,
} from "react";

type TopBarProps = {
  title: string;
  subtitle?: string;
};

type StoredUser = {
  name?: string;
  nome?: string;
  email?: string;
};

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "P";
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function getStoredUserName(): string {
  if (
    typeof window ===
    "undefined"
  ) {
    return "PeanuTec";
  }

  try {
    const storedUser =
      window.localStorage.getItem(
        "peanutec_user",
      );

    if (!storedUser) {
      return "PeanuTec";
    }

    const user = JSON.parse(
      storedUser,
    ) as StoredUser;

    return (
      user.name?.trim() ||
      user.nome?.trim() ||
      "PeanuTec"
    );
  } catch {
    return "PeanuTec";
  }
}

export function TopBar({
  title,
  subtitle = "Gestão técnica da safra",
}: TopBarProps) {
  const [userName] =
    useState(
      getStoredUserName,
    );

  const initials = getInitials(userName);

  return (
    <header
      className="
        sticky
        top-0
        z-20
        px-4
        pt-4
        sm:px-6
        lg:px-7
        xl:px-9
      "
    >
      <div
        className="
          mx-auto
          flex
          min-h-[82px]
          w-full
          max-w-[1680px]
          items-center
          justify-between
          gap-6
          rounded-[var(--pt-radius-xl)]
          border
          border-[rgba(47,37,32,0.08)]
          bg-[rgba(255,253,250,0.92)]
          px-5
          py-4
          shadow-[0_5px_20px_rgba(47,37,32,0.045)]
          backdrop-blur-xl
          sm:px-6
        "
      >
        {/* Página atual */}
        <div className="min-w-0">
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <span
              aria-hidden="true"
              className="
                h-2
                w-2
                shrink-0
                rounded-full
                bg-[var(--pt-color-orange-500)]
              "
            />

            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.15em]
                text-[var(--pt-color-structure-400)]
              "
            >
              PeanuTec
            </p>
          </div>

          <div
            className="
              mt-1
              flex
              min-w-0
              flex-col
              gap-0.5
            "
          >
            <h1
              className="
                truncate
                text-[1.35rem]
                font-semibold
                tracking-[-0.025em]
                text-[var(--pt-color-brand-950)]
                sm:text-[1.45rem]
              "
            >
              {title}
            </h1>

            {subtitle ? (
              <p
                className="
                  truncate
                  text-sm
                  text-[var(--pt-color-structure-500)]
                "
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {/* Usuário */}
        <div
          className="
            hidden
            shrink-0
            items-center
            gap-3
            sm:flex
          "
        >
          <div
            className="
              hidden
              min-w-0
              text-right
              md:block
            "
          >
            <p
              className="
                max-w-40
                truncate
                text-sm
                font-semibold
                text-[var(--pt-color-structure-900)]
              "
            >
              {userName}
            </p>

            <p
              className="
                mt-0.5
                text-[11px]
                font-medium
                text-[var(--pt-color-structure-400)]
              "
            >
              Gestão da propriedade
            </p>
          </div>

          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-[14px]
              border
              border-[rgba(243,111,33,0.15)]
              bg-[var(--pt-color-orange-50)]
              text-xs
              font-bold
              text-[var(--pt-color-orange-700)]
            "
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
