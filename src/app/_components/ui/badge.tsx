type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "error" | "success";
  className?: string;
};

const variants = {
  default: "rounded-2xl bg-white/5 px-4 py-2 text-sm text-[var(--foreground)]/65",
  accent:
    "rounded-2xl bg-[var(--accent)] px-4 py-2 font-black text-black",
  error:
    "rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200",
  success:
    "rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200",
} as const;

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <div className={`${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
