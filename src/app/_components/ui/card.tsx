type CardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "inner" | "flat";
};

const styles = {
  default:
    "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-6 shadow-sm",
  inner:
    "rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4 md:p-5",
  flat:
    "rounded-xl bg-white/[0.03] p-4",
} as const;

export default function Card({ children, className = "", variant = "default" }: CardProps) {
  return (
    <div className={`${styles[variant]} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  tag,
  title,
  description,
}: {
  tag?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {tag && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]/80">
          {tag}
        </div>
      )}
      <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 text-sm text-[var(--foreground)]/50">{description}</p>
      )}
    </div>
  );
}
