"use client"

import * as React from "react"

export function SearchForm({
  placeholder = "Search…",
  defaultValue = "",
  onSearch,
  className = "",
}: {
  placeholder?: string
  defaultValue?: string
  onSearch?: (q: string) => void | Promise<void>
  className?: string
}) {
  const [q, setQ] = React.useState(defaultValue)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSearch?.(q)
  }
  return (
    <form onSubmit={onSubmit} className={`flex items-center gap-2 ${className}`}>
      <input
        className="bg-muted/50 text-sm rounded-md px-3 py-2 outline-none ring-1 ring-border focus:ring-2 focus:ring-ring w-64"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
      />
      <button className="text-sm px-3 py-2 rounded-md bg-primary text-primary-foreground" type="submit">
        Search
      </button>
    </form>
  )
}
