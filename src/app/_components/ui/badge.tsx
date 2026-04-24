type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "error" | "success";
  className?: string;
};

const variants = {
  default:
    "inline-flex items-center rounded-lg bg-white/5 px-3 py-1.5 text-xs text-[var(--foreground)]/60",
  accent:
    "inline-flex items-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-black",
  error:
    "flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300",
  success:
    "flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300",
} as const;

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <div className={`${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
