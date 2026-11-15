import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useMemo } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/** The landing page's column: the same width and gutters for every section. */
export function Container({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

/** Every landing section, in page order. The sticky section bar and the section headings both number from these. */
// The portfolio leads once it is open: it is what sets Rezumi apart; the resume follows.
const allLandingSectionIds = ["portfolio", "features", "templates", "testimonials", "pricing", "faq"] as const;

type LandingSectionId = (typeof allLandingSectionIds)[number];

/** The sections on the page: the portfolio has one only once portfolios are open to everyone. */
const landingSectionIds = (portfolioEnabled: boolean): LandingSectionId[] =>
	allLandingSectionIds.filter((id) => portfolioEnabled || id !== "portfolio");

const LandingSectionsContext = createContext<LandingSectionId[]>(landingSectionIds(false));

type LandingSectionsProviderProps = { portfolioEnabled: boolean; children: ReactNode };

/** Tells the section bar and the numbered headings which sections the page shows. */
export function LandingSectionsProvider({ portfolioEnabled, children }: LandingSectionsProviderProps) {
	const ids = useMemo(() => landingSectionIds(portfolioEnabled), [portfolioEnabled]);
	return <LandingSectionsContext.Provider value={ids}>{children}</LandingSectionsContext.Provider>;
}

/** Whether the page shows the portfolio, which leads the page and its call to action when it does. */
export function usePortfolioLanding() {
	return useContext(LandingSectionsContext).includes("portfolio");
}

/** The page's sections with their titles, numbered by position. */
export function useLandingSections() {
	const ids = useContext(LandingSectionsContext);
	const titles: Record<LandingSectionId, string> = {
		features: t`Features`,
		templates: t`Templates`,
		portfolio: t`Portfolio`,
		testimonials: t`Testimonials`,
		pricing: t`Pricing`,
		faq: t`FAQ`,
	};
	return ids.map((id) => ({ id, title: titles[id] }));
}

type SectionHeadingProps = { section: LandingSectionId; id: string; className?: string };

/** A section's numbered label, "01 | Features", the heading the section is named by. */
export function SectionHeading({ section, id, className }: SectionHeadingProps) {
	const sections = useLandingSections();
	const index = sections.findIndex((item) => item.id === section);
	const title = sections[index]?.title;

	return (
		<h2
			id={id}
			className={cn(
				"inline-flex items-center gap-3 rounded-full px-4 py-1 text-accent ring-1 ring-accent/40 ring-inset",
				className,
			)}
		>
			<span aria-hidden="true" className="font-mono text-sm tabular-nums">
				{String(index + 1).padStart(2, "0")}
			</span>
			<span aria-hidden="true" className="h-3.5 w-px bg-accent/30" />
			<span className="text-base font-medium">{title}</span>
		</h2>
	);
}

type SectionTitleProps = { children: ReactNode; className?: string };

/** The large statement under a section heading. */
export function SectionTitle({ children, className }: SectionTitleProps) {
	return (
		<p className={cn("mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl", className)}>
			{children}
		</p>
	);
}

type CtaLinkProps = { size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary"; className?: string };

/**
 * The page's one call to action, in the hero, the section bar and the closing panel: "Create your portfolio" once
 * portfolios are open, "Build your resume" before.
 */
export function CtaLink({ size = "lg", variant = "primary", className }: CtaLinkProps) {
	const portfolio = usePortfolioLanding();
	return (
		<Link to="/auth/register" className={cn(buttonVariants({ size, variant }), className)}>
			{portfolio ? t`Create your portfolio` : t`Build your resume`}
			<Icon name="arrow-right" size={size === "lg" ? 20 : 16} />
		</Link>
	);
}
