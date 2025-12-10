import { ButtonHTMLAttributes, ReactElement, ReactNode, cloneElement, isValidElement } from "react";

const baseClasses =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-blue-600",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  asChild?: boolean;
  className?: string;
};

const classNames = (...classes: Array<string | null | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function Button({
  children,
  variant = "primary",
  asChild = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const combinedClasses = classNames(baseClasses, variantClasses[variant], className);

  if (asChild && isValidElement(children)) {
    const childElement = children as ReactElement<{ className?: string }>;

    return cloneElement(childElement, {
      ...props,
      className: classNames(combinedClasses, childElement.props.className),
    });
  }

  return (
    <button className={combinedClasses} type={type} {...props}>
      {children}
    </button>
  );
}
