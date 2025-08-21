"use client"

import * as React from "react"

export function Footer({
  left,
  right,
  className = "",
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <footer className={`border-t px-4 py-3 text-sm text-muted-foreground flex items-center justify-between ${className}`}>
      <div>{left ?? "© Your Company"}</div>
      <div>{right}</div>
    </footer>
  )
}
