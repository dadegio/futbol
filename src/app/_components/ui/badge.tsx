type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "error" | "success";
  className?: string;
};

const variants = {
  default:
    "inline-flex items-center rounded-lg bg-[var(--card-2)] px-3 py-1.5 text-xs text-[var(--muted)]",
  accent:
    "inline-flex items-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-white",
  error:
    "flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  success:
    "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700",
} as const;

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <div className={`${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
