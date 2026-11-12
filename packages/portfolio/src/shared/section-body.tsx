import type { PortfolioViewSection, PortfolioViewWork } from "../view";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "./context";
import { ServiceList, TestimonialList } from "./offers";
import { Clients, Contact, CustomSectionBody, Prose } from "./parts";
import { ResumeSectionBody } from "./resume";

type ContactSection = Extract<PortfolioViewSection, { kind: "contact" }>;

/** How one theme draws the body of a standard section (Mozaik's tiles draw their own). */
export type SectionBodyStyle = {
	theme: PortfolioTheme;
	/**
	 * The theme's class prefix: `lg` gives `lg-lead` (About), `lg-services`, `lg-quotes`, `lg-custom__image` and `lg-cta`
	 * (Contact's note).
	 */
	prefix: string;
	/** The work section's list; a theme that draws its works itself (Kanvas) leaves it out. */
	work?: (works: readonly PortfolioViewWork[]) => ReactNode;
	/** A free section's text class besides `pf-prose`. */
	customProseClassName?: string;
	/** A free section inside the theme's own wrapper. */
	wrapCustom?: (body: ReactNode) => ReactNode;
	/** Contact inside the theme's own wrapper. */
	wrapContact?: (body: ReactNode, section: ContactSection) => ReactNode;
	/** The resume sections' list class (`ResumeSectionBody`). */
	resumeListClassName?: string;
};

type SectionBodyProps = { section: PortfolioViewSection; style: SectionBodyStyle };

/** A section's content under its heading, in the page's variants, the same way in every theme that lists sections. */
export function SectionBody({ section, style }: SectionBodyProps): ReactNode {
	const { view } = useRender();
	const { theme, prefix } = style;
	const variant = (key: Parameters<typeof themeVariant>[1]) => themeVariant(theme, key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className={`${prefix}-lead`} />;
		case "work":
			return style.work ? style.work(section.works) : null;
		case "services":
			return <ServiceList section={section} className={`${prefix}-services`} variant={variant("services")} />;
		case "testimonials":
			return <TestimonialList section={section} className={`${prefix}-quotes`} variant={variant("testimonials")} />;
		case "clients":
			return <Clients section={section} variant={variant("clients")} />;
		case "custom": {
			const body = (
				<CustomSectionBody
					section={section}
					imageClassName={`${prefix}-custom__image`}
					{...(style.customProseClassName ? { proseClassName: style.customProseClassName } : {})}
				/>
			);
			return style.wrapCustom ? style.wrapCustom(body) : body;
		}
		case "contact": {
			const body = <Contact section={section} ctaClassName={`${prefix}-cta`} />;
			return style.wrapContact ? style.wrapContact(body, section) : body;
		}
		default:
			return (
				<ResumeSectionBody
					section={section}
					{...(style.resumeListClassName ? { listClassName: style.resumeListClassName } : {})}
				/>
			);
	}
}
