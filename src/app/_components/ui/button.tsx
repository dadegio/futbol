type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive";
  size?: "default" | "sm";
};

const base =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const variants = {
  primary:
    "bg-[var(--accent)] text-black hover:bg-[var(--accent-2)]",
  secondary:
    "border border-[var(--border)] bg-white/5 text-[var(--foreground)]/75 hover:bg-white/10 hover:text-[var(--foreground)]",
  destructive:
    "border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20",
} as const;

const sizes = {
  default: "px-5 py-2.5 text-sm",
  sm: "px-3.5 py-2 text-xs",
} as const;

export default function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
