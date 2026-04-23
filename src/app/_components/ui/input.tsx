type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/35 focus:border-[var(--accent)]/40 ${className}`}
      {...props}
    />
  );
}
