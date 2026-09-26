type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "error" | "success";
  className?: string;
};

const variants = {
  default:
    "inline-flex items-center rounded-[3px] border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]",
  accent:
    "inline-flex items-center rounded-[3px] border border-[var(--accent)] bg-transparent px-3 py-1.5 text-sm font-semibold text-[var(--accent)]",
  error:
    "flex items-center gap-2 rounded-[3px] border border-[var(--live)]/35 bg-[var(--live)]/10 px-4 py-3 text-sm font-semibold text-[var(--live)]",
  success:
    "flex items-center gap-2 rounded-[3px] border border-[var(--success)]/35 bg-[var(--success)]/10 px-4 py-3 text-sm font-semibold text-[var(--success)]",
} as const;

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return <div className={`${variants[variant]} ${className}`}>{children}</div>;
}
