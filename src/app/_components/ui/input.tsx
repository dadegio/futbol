type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-10 rounded-xl border border-[var(--border)] bg-white/5 px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground)]/30 focus:border-[var(--accent)]/50 focus:bg-white/8 ${className}`}
      {...props}
    />
  );
}
