import type { PortfolioViewSection } from "../view";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ReactNode } from "react";
import { useRender } from "./context";
import { UiIcon } from "./icons";
import { Footer, WorkDetails } from "./parts";
import { navSections } from "./sections";

type NavigationProps = {
	/** The header's class: `pf-wrap` and the theme's own. */
	className: string;
	/** A full-width header (Prima's) holds the navigation in a `pf-wrap` of this class. */
	innerClassName?: string;
	/** The brand link's class besides `pf-nav__brand`. */
	brandClassName: string;
	/** What the brand link draws before the name (Lugas' monogram, Mozaik's dots). */
	brandMark?: ReactNode;
	/** The sections it may link to (`navSections` picks from them); the page's by default. */
	sections?: readonly PortfolioViewSection[];
	/** A link's text; the section's title by default. */
	label?: (section: PortfolioViewSection) => string;
	/** A "Send a message" button to this anchor after the links, on wide screens; its item takes `className`. */
	message?: { anchor: string; className?: string } | null;
};

/**
 * The page's navigation: the person's name back to the top, then links to the first sections and Contact
 * (`navSections`), which phones get in a `<details>` menu that works without the page script.
 */
export function Navigation(props: NavigationProps) {
	const { view, messages } = useRender();
	const links = navSections(props.sections ?? view.sections);
	const items = links.map((section) => (
		<li key={section.key}>
			<a href={`#${section.anchor}`}>{props.label ? props.label(section) : section.title}</a>
		</li>
	));
	const nav = (
		<nav className="pf-nav" aria-label={messages.pageNavigation}>
			<a className={`pf-nav__brand ${props.brandClassName}`} href="#main">
				{props.brandMark}
				<span>{view.basics.name}</span>
			</a>
			{links.length > 0 && (
				<>
					<ul className="pf-nav__links">
						{items}
						{props.message && (
							<li className={props.message.className}>
								<a className="pf-btn pf-btn--primary" href={`#${props.message.anchor}`}>
									{messages.sendMessage}
								</a>
							</li>
						)}
					</ul>
					<details className="pf-menu">
						<summary>
							<UiIcon name="menu" />
							{messages.menu}
						</summary>
						<ul className="pf-menu__list">{items}</ul>
					</details>
				</>
			)}
		</nav>
	);
	return (
		<header className={props.className}>
			{props.innerClassName ? <div className={props.innerClassName}>{nav}</div> : nav}
		</header>
	);
}

type PageShellProps = {
	theme: PortfolioTheme;
	/** More attributes for the page's root (Kanvas' font pair). */
	attributes?: Record<string, string>;
	navigation: ReactNode;
	/** The main column's class besides `pf-wrap`. */
	mainClassName: string;
	year: number;
	creditUrl: string;
	/** The intro and the sections. */
	children: ReactNode;
};

/**
 * What every theme's page is made of (`01-desain.md` section 5): a link past the navigation, the navigation, the main
 * column with the intro and the sections, the footer, then the works' details and the picture viewer.
 */
export function PageShell({ theme, attributes, navigation, mainClassName, year, creditUrl, children }: PageShellProps) {
	const { messages } = useRender();
	return (
		<div className="pf" data-theme={theme} {...attributes}>
			<a className="pf-skip" href="#main">
				{messages.skipToContent}
			</a>
			{navigation}
			<main className={`pf-wrap ${mainClassName}`} id="main" tabIndex={-1}>
				{children}
			</main>
			<Footer year={year} creditUrl={creditUrl} />
			<WorkDetails />
		</div>
	);
}
