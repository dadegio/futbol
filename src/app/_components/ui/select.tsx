type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      className={`h-10 rounded-[5px] border border-[var(--border)] bg-transparent px-3.5 text-sm font-medium text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] ${className}`}
      {...props}
    />
  );
}