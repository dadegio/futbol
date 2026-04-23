type CardProps = {
  children: React.ReactNode;
  className?: string;
  /** Inner variant with less rounding for nesting inside cards */
  variant?: "default" | "inner" | "flat";
};

const styles = {
  default:
    "rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-5 md:p-6 shadow-2xl shadow-black/20",
  inner:
    "rounded-[24px] border border-white/8 bg-[var(--card-2)] p-5",
  flat:
    "rounded-2xl bg-white/[0.04] p-4",
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
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
          {tag}
        </div>
      )}
      <h1 className="mt-2 text-2xl md:text-3xl font-black text-[var(--foreground)]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm text-[var(--foreground)]/60">{description}</p>
      )}
    </div>
  );
}
