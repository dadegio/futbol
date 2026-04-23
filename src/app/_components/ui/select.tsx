type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      className={`h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-[var(--foreground)] outline-none ${className}`}
      {...props}
    />
  );
}
