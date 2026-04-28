type CardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "inner" | "flat";
};

const styles = {
  default:
    "rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)] md:p-5",
  inner:
    "rounded-[16px] border border-[var(--border)] bg-[var(--card-2)] p-4 md:p-5",
  flat:
    "rounded-[16px] bg-[var(--card-2)] p-4",
} as const;

export default function Card({
  children,
  className = "",
  variant = "default",
}: CardProps) {
  return <div className={`${styles[variant]} ${className}`}>{children}</div>;
}

export function CardHeader({
  tag,
  title,
  description,
  level = 2,
}: {
  tag?: string;
  title: string;
  description?: string;
  level?: 1 | 2 | 3;
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3";

  return (
    <div>
      {tag && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          {tag}
        </div>
      )}

      <Tag className="text-2xl font-black tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
        {title}
      </Tag>

      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}
    </div>
  );
}