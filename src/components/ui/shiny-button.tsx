import Link from "next/link";
import type React from "react";
import { cn } from "@/lib/utils";

type ShinyButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  /** Renders a link instead of a button (same look). */
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
};

/**
 * Call-to-action for AI features: a dark pill with a rotating brand-blue edge that brightens on hover.
 * Styles live in globals.css (`.shiny-cta`) so every instance shares one stylesheet and SSR needs no registry.
 */
export function ShinyButton({
  children,
  onClick,
  href,
  type = "button",
  disabled,
  size = "default",
  className,
}: ShinyButtonProps) {
  const classes = cn("shiny-cta", size === "sm" && "shiny-cta-sm", className);
  const content = <span className="inline-flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">{children}</span>;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
