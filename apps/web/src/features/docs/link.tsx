import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { DOCS_BASE } from "./paths";

type DocsLinkProps = {
	href?: string | undefined;
	className?: string | undefined;
	rel?: string | undefined;
	"aria-current"?: "page" | undefined;
	onClick?: (() => void) | undefined;
	children?: ReactNode;
};

/**
 * A link in the docs. Docs pages navigate inside the app (the build already rewrote the pages' links to `/docs/…`),
 * other pages of the app load normally, and other sites open in a new tab.
 */
export function DocsLink({ href = "", children, ...props }: DocsLinkProps) {
	if (href === DOCS_BASE || href.startsWith(`${DOCS_BASE}/`) || href.startsWith(`${DOCS_BASE}#`)) {
		const [path = "", hash] = href.split("#", 2);
		const splat = path.slice(DOCS_BASE.length + 1);
		const target = hash ? { hash } : {};
		return splat ? (
			<Link to="/docs/$" params={{ _splat: splat }} {...target} {...props}>
				{children}
			</Link>
		) : (
			<Link to="/docs" {...target} {...props}>
				{children}
			</Link>
		);
	}
	const external = /^https?:\/\//.test(href);
	return (
		<a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
			{children}
		</a>
	);
}
