type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      className={`h-10 rounded-xl border border-[var(--border)] bg-white/5 px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)]/50 ${className}`}
      {...props}
    />
  );
}
