"use client"
import NextLink from "next/link"
import type { LinkComponent } from "@workspace/ui/layout/link-slot"

export const NextLinkAdapter: LinkComponent = ({ href, children, ...rest }) => {
  return <NextLink href={href} {...rest}>{children}</NextLink>
}
