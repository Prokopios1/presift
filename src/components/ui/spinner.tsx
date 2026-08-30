import * as React from "react"
import { cn } from "@/lib/utils"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md"
}

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-blue-600 border-t-transparent",
        size === "sm" ? "h-4 w-4 border-2" : "h-8 w-8 border-4",
        className
      )}
      {...props}
    />
  )
}
