"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { SearchForm } from "@workspace/ui/layout/search-form"

export default function SearchFormNext({
  basePath = "/search",
  param = "q",
  placeholder = "Search…",
}: {
  basePath?: string
  param?: string
  placeholder?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const defaultValue = sp.get(param) ?? ""

  return (
    <SearchForm
      placeholder={placeholder}
      defaultValue={defaultValue}
      onSearch={(q) => {
        const url = q ? `${basePath}?${param}=${encodeURIComponent(q)}` : basePath
        router.push(url)
      }}
    />
  )
}
