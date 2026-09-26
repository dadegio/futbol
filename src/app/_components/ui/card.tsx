type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "inner" | "flat";
};

const styles = {
  default: "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5",
  inner: "rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4 md:p-5",
  flat: "rounded-lg bg-[var(--card-2)] p-4",
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
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {tag}
        </div>
      )}

      <Tag className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--foreground)] md:text-3xl">
        {title}
      </Tag>

      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      )}
    </div>
  );
}
