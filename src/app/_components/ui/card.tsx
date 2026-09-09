type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "inner" | "flat";
};

const styles = {
  default:
    "rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(244,234,216,0.04)] backdrop-blur-xl md:p-5",
  inner:
    "rounded-[20px] border border-[var(--border)] bg-[var(--card-2)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-5",
  flat:
    "rounded-[20px] bg-[var(--card-2)] p-4",
} as const;

export default function Card({ className = "", variant = "default", ...props }: CardProps) {
  return <div {...props} className={`${styles[variant]} ${className}`} />;
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
        <div className="mb-2 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          {tag}
        </div>
      )}

      <Tag className="text-2xl font-black tracking-[-0.05em] text-[var(--foreground)] md:text-3xl">
        {title}
      </Tag>

      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      )}
    </div>
  );
}
