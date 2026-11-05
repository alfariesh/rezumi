import type { ReactNode } from "react";
import { Drawer } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { useLocale } from "react-aria-components";
import { DocsHeader } from "./header";
import { DocsSidebar } from "./sidebar";

type DocsLayoutProps = {
	/** The page open now, marked in the sidebar. */
	slug: string;
	signedIn: boolean;
	children: ReactNode;
};

/**
 * The public docs' frame: the top bar, the pages by group on the start side (a drawer on phones and tablets), and the
 * page. The route and the prerendered pages render the same frame.
 */
export function DocsLayout({ slug, signedIn, children }: DocsLayoutProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const { direction } = useLocale();

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-accent"
			>
				<Trans>Skip to main content</Trans>
			</a>

			<DocsHeader signedIn={signedIn} onOpenMenu={() => setMenuOpen(true)} />

			<div className="mx-auto flex max-w-360">
				<aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-72 shrink-0 flex-col lg:flex">
					<DocsSidebar slug={slug} placement="aside" />
				</aside>
				<main id="main-content" className="min-w-0 flex-1">
					{children}
				</main>
			</div>

			<Drawer.Backdrop isOpen={menuOpen} onOpenChange={setMenuOpen}>
				<Drawer.Content placement={direction === "rtl" ? "right" : "left"}>
					<Drawer.Dialog className="w-80 max-w-[85vw]">
						<Drawer.CloseTrigger aria-label={t`Close`} />
						<Drawer.Header>
							<Drawer.Heading>{t`Documentation`}</Drawer.Heading>
						</Drawer.Header>
						<Drawer.Body className="flex min-h-0 flex-1 flex-col">
							<DocsSidebar slug={slug} placement="drawer" onNavigate={() => setMenuOpen(false)} />
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</div>
	);
}
