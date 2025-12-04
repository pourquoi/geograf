import type { ComponentProps } from "react";
import { Handle, type HandleProps } from "@xyflow/react";

import { cn } from "@/lib/utils";

export type BaseHandleProps = HandleProps;

export function BaseHandle({
  className,
  children,
  ...props
}: ComponentProps<typeof Handle>) {
  return (
    <Handle
      {...props}
      className={cn(
        "dark:border-secondary dark:bg-secondary h-[20px] w-[20px] rounded-full border border-slate-300 bg-slate-100 transition",
        className,
      )}
      style={{
        minWidth: "10px",
        minHeight: "10px",
      }}
    >
      {children}
    </Handle>
  );
}
