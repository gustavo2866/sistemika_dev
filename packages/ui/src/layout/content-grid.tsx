"use client"

import * as React from "react"

export function ContentGrid({
  children,
  columns = 1,
  gap = 16,
  className = "",
}: {
  children?: React.ReactNode
  columns?: number
  gap?: number
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  )
}
