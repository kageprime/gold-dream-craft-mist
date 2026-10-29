import type { ReactNode } from "react";

export function MatchCard({
  kicker,
  title,
  children,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-medium tracking-[0.18em] text-brass uppercase">{kicker}</p>
        <h2 className="mt-2 font-display text-4xl leading-none text-fg">{title}</h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brass px-5 text-base font-semibold text-ink"
          >
            {primary}
          </button>
          {secondary && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-medium text-fg"
            >
              {secondary}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
