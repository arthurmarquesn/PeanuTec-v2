import Link from "next/link";

import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";

import type { LucideIcon } from "lucide-react";

type Tone =
  | "positive"
  | "attention"
  | "critical"
  | "info"
  | "earth"
  | "neutral";

type BadgeTone =
  | Tone
  | "brand";

type IconPosition =
  | "left"
  | "right";

type ActionBaseProps = {
  className?: string;
  children: ReactNode;
  icon?: LucideIcon;
  iconPosition?: IconPosition;
};

type LinkButtonProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "className" | "children"
> &
  ActionBaseProps & {
    href: string;
  };

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children"
> &
  ActionBaseProps & {
    href?: undefined;
  };

type ActionButtonProps =
  | LinkButtonProps
  | NativeButtonProps;

/* =========================================================
 * Helpers
 * ========================================================= */

function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalize(
  value?: string | null,
) {
  return (value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toUpperCase();
}

function isLinkButtonProps(
  props: ActionButtonProps,
): props is LinkButtonProps {
  return (
    "href" in props &&
    typeof props.href === "string"
  );
}

/* =========================================================
 * Semantic visual system
 * ========================================================= */

const badgeToneClassNames: Record<
  BadgeTone,
  string
> = {
  brand: [
    "border-[rgba(243,111,33,0.16)]",
    "bg-[var(--pt-color-orange-50)]",
    "text-[var(--pt-color-orange-700)]",
  ].join(" "),

  positive: [
    "border-[rgba(57,115,74,0.16)]",
    "bg-[var(--pt-color-leaf-100)]",
    "text-[var(--pt-color-leaf-700)]",
  ].join(" "),

  attention: [
    "border-[rgba(152,97,22,0.16)]",
    "bg-[var(--pt-color-attention-100)]",
    "text-[var(--pt-color-attention-700)]",
  ].join(" "),

  critical: [
    "border-[rgba(154,61,50,0.16)]",
    "bg-[var(--pt-color-critical-100)]",
    "text-[var(--pt-color-critical-700)]",
  ].join(" "),

  info: [
    "border-[rgba(54,95,124,0.16)]",
    "bg-[var(--pt-color-info-100)]",
    "text-[var(--pt-color-info-700)]",
  ].join(" "),

  earth: [
    "border-[rgba(96,69,54,0.14)]",
    "bg-[var(--pt-color-earth-100)]",
    "text-[var(--pt-color-earth-800)]",
  ].join(" "),

  neutral: [
    "border-[rgba(47,37,32,0.09)]",
    "bg-[var(--pt-color-structure-100)]",
    "text-[var(--pt-color-structure-700)]",
  ].join(" "),
};

const statToneClassNames: Record<
  Tone,
  {
    dot: string;
    value: string;
    surface: string;
  }
> = {
  positive: {
    dot: "bg-[var(--pt-color-leaf-600)]",
    value:
      "text-[var(--pt-color-leaf-700)]",
    surface:
      "bg-[rgba(57,115,74,0.035)]",
  },

  attention: {
    dot: "bg-[var(--pt-color-attention-700)]",
    value:
      "text-[var(--pt-color-attention-700)]",
    surface:
      "bg-[rgba(152,97,22,0.035)]",
  },

  critical: {
    dot: "bg-[var(--pt-color-critical-700)]",
    value:
      "text-[var(--pt-color-critical-700)]",
    surface:
      "bg-[rgba(154,61,50,0.035)]",
  },

  info: {
    dot: "bg-[var(--pt-color-info-700)]",
    value:
      "text-[var(--pt-color-info-700)]",
    surface:
      "bg-[rgba(54,95,124,0.035)]",
  },

  earth: {
    dot: "bg-[var(--pt-color-earth-700)]",
    value:
      "text-[var(--pt-color-earth-800)]",
    surface:
      "bg-[rgba(96,69,54,0.035)]",
  },

  neutral: {
    dot: "bg-[var(--pt-color-orange-500)]",
    value:
      "text-[var(--pt-color-structure-950)]",
    surface:
      "bg-[var(--pt-color-surface)]",
  },
};

const alertToneClassNames: Record<
  Tone,
  string
> = {
  positive: [
    "border-[rgba(57,115,74,0.15)]",
    "bg-[rgba(230,242,233,0.65)]",
    "text-[var(--pt-color-leaf-700)]",
  ].join(" "),

  attention: [
    "border-[rgba(152,97,22,0.17)]",
    "bg-[rgba(251,239,210,0.70)]",
    "text-[var(--pt-color-attention-700)]",
  ].join(" "),

  critical: [
    "border-[rgba(154,61,50,0.16)]",
    "bg-[rgba(245,222,218,0.68)]",
    "text-[var(--pt-color-critical-700)]",
  ].join(" "),

  info: [
    "border-[rgba(54,95,124,0.15)]",
    "bg-[rgba(225,237,243,0.70)]",
    "text-[var(--pt-color-info-700)]",
  ].join(" "),

  earth: [
    "border-[rgba(96,69,54,0.13)]",
    "bg-[rgba(239,227,220,0.68)]",
    "text-[var(--pt-color-earth-800)]",
  ].join(" "),

  neutral: [
    "border-[rgba(47,37,32,0.09)]",
    "bg-[var(--pt-color-surface-muted)]",
    "text-[var(--pt-color-structure-700)]",
  ].join(" "),
};

/* =========================================================
 * Buttons
 * ========================================================= */

function actionButtonClassName(
  kind:
    | "primary"
    | "secondary",
  className?: string,
) {
  return cx(
    [
      "inline-flex",
      "min-h-11",
      "items-center",
      "justify-center",
      "gap-2",
      "rounded-[14px]",
      "px-4",
      "text-sm",
      "font-semibold",
      "transition-all",
      "duration-150",
      "outline-none",
      "focus-visible:ring-4",
      "disabled:pointer-events-none",
      "disabled:opacity-50",
    ].join(" "),

    kind === "primary"
      ? [
          "border",
          "border-[rgba(216,77,13,0.18)]",
          "bg-[var(--pt-color-orange-500)]",
          "text-white",
          "shadow-[0_3px_10px_rgba(243,111,33,0.16)]",
          "hover:-translate-y-px",
          "hover:bg-[var(--pt-color-orange-600)]",
          "hover:shadow-[0_7px_18px_rgba(243,111,33,0.20)]",
          "focus-visible:ring-[rgba(243,111,33,0.14)]",
          "active:translate-y-0",
        ].join(" ")
      : [
          "border",
          "border-[rgba(47,37,32,0.11)]",
          "bg-[rgba(255,253,250,0.92)]",
          "text-[var(--pt-color-structure-900)]",
          "shadow-[0_1px_2px_rgba(47,37,32,0.025)]",
          "hover:border-[rgba(47,37,32,0.18)]",
          "hover:bg-white",
          "focus-visible:ring-[rgba(47,37,32,0.08)]",
        ].join(" "),

    className,
  );
}

function ButtonContent({
  children,
  icon: Icon,
  iconPosition = "left",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  iconPosition?: IconPosition;
}) {
  if (!Icon) {
    return <>{children}</>;
  }

  return (
    <>
      {iconPosition === "left" ? (
        <Icon
          aria-hidden="true"
          size={16}
          strokeWidth={1.9}
        />
      ) : null}

      <span>
        {children}
      </span>

      {iconPosition === "right" ? (
        <Icon
          aria-hidden="true"
          size={16}
          strokeWidth={1.9}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  kind,
  props,
}: {
  kind:
    | "primary"
    | "secondary";
  props: ActionButtonProps;
}) {
  if (isLinkButtonProps(props)) {
    const {
      href,
      className,
      children,
      icon,
      iconPosition,
      ...rest
    } = props;

    return (
      <Link
        href={href}
        className={actionButtonClassName(
          kind,
          className,
        )}
        {...rest}
      >
        <ButtonContent
          icon={icon}
          iconPosition={iconPosition}
        >
          {children}
        </ButtonContent>
      </Link>
    );
  }

  const {
    className,
    children,
    icon,
    iconPosition,
    ...rest
  } = props;

  return (
    <button
      className={actionButtonClassName(
        kind,
        className,
      )}
      {...rest}
    >
      <ButtonContent
        icon={icon}
        iconPosition={iconPosition}
      >
        {children}
      </ButtonContent>
    </button>
  );
}

/* =========================================================
 * Page Header
 * ========================================================= */

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="
        flex
        flex-col
        gap-4
        sm:flex-row
        sm:items-start
        sm:justify-between
      "
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div
            className="
              mb-2
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                h-1.5
                w-1.5
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
              {eyebrow}
            </p>
          </div>
        ) : null}

        <h1
          className="
            text-2xl
            font-semibold
            tracking-[-0.025em]
            text-[var(--pt-color-structure-950)]
            sm:text-[1.7rem]
          "
        >
          {title}
        </h1>

        {subtitle ? (
          <p
            className="
              mt-1.5
              max-w-3xl
              text-sm
              leading-6
              text-[var(--pt-color-structure-500)]
            "
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
 * Section Card
 * ========================================================= */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        [
          "overflow-hidden",
          "rounded-[22px]",
          "border",
          "border-[rgba(47,37,32,0.075)]",
          "bg-[rgba(255,253,250,0.92)]",
          "shadow-[0_5px_18px_rgba(47,37,32,0.035)]",
          "backdrop-blur-sm",
        ].join(" "),
        className,
      )}
    >
      {title ||
      description ||
      action ? (
        <div
          className="
            flex
            flex-col
            gap-3
            px-6
            pb-4
            pt-5
            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div className="min-w-0">
            {title ? (
              <h2
                className="
                  text-[1.02rem]
                  font-semibold
                  tracking-[-0.015em]
                  text-[var(--pt-color-structure-950)]
                "
              >
                {title}
              </h2>
            ) : null}

            {description ? (
              <p
                className="
                  mt-1
                  max-w-3xl
                  text-sm
                  leading-6
                  text-[var(--pt-color-structure-500)]
                "
              >
                {description}
              </p>
            ) : null}
          </div>

          {action ? (
            <div className="shrink-0">
              {action}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cx(
          "px-6 pb-6",
          !title &&
            !description &&
            !action &&
            "pt-6",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/* =========================================================
 * Stat Card
 * ========================================================= */

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
}) {
  const visual =
    statToneClassNames[tone];

  return (
    <article
      className={cx(
        [
          "relative",
          "overflow-hidden",
          "rounded-[20px]",
          "border",
          "border-[rgba(47,37,32,0.07)]",
          "p-5",
          "shadow-[0_3px_12px_rgba(47,37,32,0.025)]",
          "transition-all",
          "duration-150",
          "hover:-translate-y-px",
          "hover:border-[rgba(47,37,32,0.11)]",
          "hover:shadow-[0_8px_22px_rgba(47,37,32,0.05)]",
        ].join(" "),
        visual.surface,
      )}
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        <span
          className={cx(
            "h-2 w-2 rounded-full",
            visual.dot,
          )}
        />

        <p
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.13em]
            text-[var(--pt-color-structure-400)]
          "
        >
          {label}
        </p>
      </div>

      <p
        className={cx(
          [
            "mt-3",
            "text-[1.75rem]",
            "font-semibold",
            "tracking-[-0.035em]",
          ].join(" "),
          visual.value,
        )}
      >
        {value}
      </p>

      {detail ? (
        <p
          className="
            mt-1
            text-[13px]
            leading-5
            text-[var(--pt-color-structure-500)]
          "
        >
          {detail}
        </p>
      ) : null}
    </article>
  );
}

/* =========================================================
 * Status Badge
 * ========================================================= */

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cx(
        [
          "inline-flex",
          "items-center",
          "justify-center",
          "rounded-full",
          "border",
          "px-2.5",
          "py-1",
          "text-[10px]",
          "font-bold",
          "leading-none",
          "tracking-[0.02em]",
        ].join(" "),
        badgeToneClassNames[tone],
      )}
    >
      {children}
    </span>
  );
}

/* =========================================================
 * Risk Badge
 * ========================================================= */

export function RiskBadge({
  value,
}: {
  value?: string | null;
}) {
  const normalized =
    normalize(value);

  const tone: Tone =
    normalized.includes(
      "CRITICO",
    ) ||
    normalized.includes("ALTO")
      ? "critical"
      : normalized.includes(
            "MODERADO",
          ) ||
          normalized.includes(
            "MEDIA",
          )
        ? "attention"
        : normalized.includes(
              "BAIXO",
            )
          ? "positive"
          : "neutral";

  return (
    <StatusBadge tone={tone}>
      {value ||
        "Sem classificação"}
    </StatusBadge>
  );
}

/* =========================================================
 * Defense Badge
 * ========================================================= */

export function DefenseBadge({
  status,
  percent,
}: {
  status?: string | null;
  percent?: number | null;
}) {
  const normalized =
    normalize(status);

  const tone: Tone =
    normalized.includes(
      "VENCIDA",
    )
      ? "critical"
      : normalized.includes(
            "BAIXA",
          ) ||
          normalized.includes(
            "MEDIA",
          )
        ? "attention"
        : normalized.includes(
              "ALTA",
            )
          ? "positive"
          : "neutral";

  const label =
    percent === null ||
    percent === undefined
      ? status ||
        "Defesa sem registro"
      : `${percent}% · ${
          status ||
          "estimativa operacional"
        }`;

  return (
    <span
      title="
        Estimativa operacional.
        Não representa garantia de proteção.
      "
    >
      <StatusBadge tone={tone}>
        {label}
      </StatusBadge>
    </span>
  );
}

/* =========================================================
 * Empty State
 * ========================================================= */

export function EmptyState({
  title = "Sem dados operacionais",
  children,
  action,
  icon: Icon,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div
      className="
        flex
        min-h-[170px]
        flex-col
        items-center
        justify-center
        rounded-[18px]
        border
        border-dashed
        border-[rgba(47,37,32,0.14)]
        bg-[rgba(255,255,255,0.34)]
        px-6
        py-7
        text-center
      "
    >
      {Icon ? (
        <div
          className="
            mb-3
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-[13px]
            border
            border-[rgba(243,111,33,0.12)]
            bg-[var(--pt-color-orange-50)]
            text-[var(--pt-color-orange-700)]
          "
        >
          <Icon
            aria-hidden="true"
            size={18}
            strokeWidth={1.8}
          />
        </div>
      ) : null}

      <p
        className="
          text-sm
          font-semibold
          text-[var(--pt-color-structure-950)]
        "
      >
        {title}
      </p>

      {children ? (
        <div
          className="
            mx-auto
            mt-1.5
            max-w-xl
            text-sm
            leading-6
            text-[var(--pt-color-structure-500)]
          "
        >
          {children}
        </div>
      ) : null}

      {action ? (
        <div className="mt-4">
          {action}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
 * Loading State
 * ========================================================= */

export function LoadingState({
  label = "Carregando informações da safra...",
}: {
  label?: string;
}) {
  return (
    <div
      className="
        flex
        min-h-[120px]
        items-center
        justify-center
        rounded-[18px]
        bg-[rgba(47,37,32,0.018)]
        px-6
        py-6
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
          text-sm
          font-medium
          text-[var(--pt-color-structure-500)]
        "
      >
        <span
          className="
            relative
            flex
            h-2.5
            w-2.5
          "
        >
          <span
            className="
              absolute
              inline-flex
              h-full
              w-full
              animate-ping
              rounded-full
              bg-[var(--pt-color-orange-400)]
              opacity-30
            "
          />

          <span
            className="
              relative
              inline-flex
              h-2.5
              w-2.5
              rounded-full
              bg-[var(--pt-color-orange-500)]
            "
          />
        </span>

        {label}
      </div>
    </div>
  );
}

/* =========================================================
 * Operational Alert
 * ========================================================= */

export function OperationalAlert({
  title,
  description,
  severity = "neutral",
  context,
}: {
  title: string;
  description: string;
  severity?: Tone;
  context?: string;
}) {
  return (
    <article
      className={cx(
        [
          "rounded-[18px]",
          "border",
          "px-4",
          "py-3.5",
        ].join(" "),
        alertToneClassNames[
          severity
        ],
      )}
    >
      <div
        className="
          flex
          flex-col
          gap-2
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div className="min-w-0">
          <h3
            className="
              text-sm
              font-semibold
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-1
              text-sm
              leading-6
              opacity-85
            "
          >
            {description}
          </p>
        </div>

        {context ? (
          <span
            className="
              shrink-0
              rounded-full
              bg-white/60
              px-2.5
              py-1
              text-[10px]
              font-bold
              ring-1
              ring-black/[0.04]
            "
          >
            {context}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/* =========================================================
 * Public Buttons
 * ========================================================= */

export function PrimaryButton(
  props: ActionButtonProps,
) {
  return (
    <ActionButton
      props={props}
      kind="primary"
    />
  );
}

export function SecondaryButton(
  props: ActionButtonProps,
) {
  return (
    <ActionButton
      props={props}
      kind="secondary"
    />
  );
}