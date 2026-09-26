type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive";
  size?: "default" | "sm";
};

const base =
  "inline-flex items-center justify-center rounded-[5px] border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const variants = {
  primary:
    "border-[var(--accent-2)] bg-[var(--accent-2)] text-[var(--imperial-text)] hover:border-[color-mix(in_srgb,var(--accent-2)_80%,white)] hover:bg-[color-mix(in_srgb,var(--accent-2)_80%,white)]",
  secondary:
    "border-[var(--border-strong)] bg-transparent text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
  destructive:
    "border-[var(--live)]/40 bg-[var(--live)]/10 text-[var(--live)] hover:bg-[var(--live)]/18",
} as const;

const sizes = {
  default: "px-5 py-2.5 text-sm",
  sm: "px-3.5 py-2 text-xs",
} as const;

export default function Button({ variant = "primary", size = "default", className = "", ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
