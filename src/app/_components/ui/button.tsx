type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive";
  size?: "default" | "sm";
};

const base =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const variants = {
  primary:
    "bg-[var(--accent)] text-white hover:opacity-90 active:opacity-80",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--card-2)] text-[var(--foreground)] hover:bg-[var(--card)] hover:border-[var(--border-strong)]",
  destructive:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
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
