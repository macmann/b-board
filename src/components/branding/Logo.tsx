import Image from "next/image";

const classNames = (...classes: Array<string | null | false | undefined>) =>
  classes.filter(Boolean).join(" ");

type LogoProps = {
  className?: string;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  title?: string;
  subtitle?: string;
  showText?: boolean;
  size?: number;
};

export default function Logo({
  className,
  textClassName,
  titleClassName,
  subtitleClassName,
  title = "B Board",
  subtitle,
  showText = true,
  size = 40,
}: LogoProps) {
  return (
    <div className={classNames("flex items-center gap-3", className)}>
      <Image
        src="/logo.svg"
        alt={`${title} logo`}
        width={size}
        height={size}
        priority
      />
      {showText ? (
        <div className={classNames("flex flex-col", textClassName)}>
          <span className={classNames("text-sm font-semibold", titleClassName)}>{title}</span>
          {subtitle ? (
            <span className={classNames("text-xs text-slate-500 dark:text-slate-400", subtitleClassName)}>{subtitle}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
