import * as React from "react"

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: React.ReactNode
}
export type LinkComponent = (props: LinkProps) => React.ReactElement

export const DefaultLink: LinkComponent = ({ children, ...props }) => (
  <a {...props}>{children}</a>
)