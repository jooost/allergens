import { useEffect, useRef, ReactNode } from "react";
import { cn } from "../../lib/utils.js";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Popover({ open, onClose, trigger, children, align = "left", className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      {trigger}
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 rounded-lg border border-border bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
