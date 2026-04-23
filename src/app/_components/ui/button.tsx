type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive";
  size?: "default" | "sm";
};

const base = "rounded-2xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-[var(--accent)] text-black hover:bg-[var(--accent-2)]",
  secondary:
    "border border-white/10 bg-white/5 text-[var(--foreground)]/80 hover:bg-white/10 font-medium",
  destructive:
    "border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20",
} as const;

const sizes = {
  default: "px-5 py-3",
  sm: "px-4 py-2 text-sm",
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
