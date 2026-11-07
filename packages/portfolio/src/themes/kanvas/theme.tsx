import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { effectTarget, HeroHeadline, HeroName } from "../../shared/hero-text";
import { introLocation, IntroChips, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { ServiceList, TestimonialList } from "../../shared/offers";
import {
	Buttons,
	Clients,
	Contact,
	CustomSectionBody,
	ExtraSection,
	Picture,
	Prose,
	Section,
} from "../../shared/parts";
import { isResumeSection, ResumeSectionBody } from "../../shared/resume";
import { groupSections } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";

type VariantKey = Parameters<typeof themeVariant>[1];

/**
 * The "big name" intro: the name across the page, then under a thin rule three columns (photo and headline, greeting,
 * chips and buttons), then the achievements as big numbers.
 */
function Hero() {
	const { view, messages } = useRender();
	const { hero, basics } = view;
	const background = useIntroBackground();
	const location = introLocation(view);
	const typing = view.design.effect.id === "typewriter" && effectTarget(view) === "headline";
	const who = Boolean(hero.picture || basics.headline || typing);
	const side = Boolean(location || hero.availability || hero.buttons.length);
	return (
		<section
			className="kv-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? "big-name" : "no-photo"}
			{...background}
		>
			<HeroName className="kv-name" />
			{(who || hero.greeting || side) && (
				<div className="kv-hero__row">
					{who && (
						<div className="kv-hero__who">
							{hero.picture && <Picture image={hero.picture} className="kv-photo" eager sizes="56px" />}
							<HeroHeadline className="kv-headline" />
						</div>
					)}
					{hero.greeting && <p className="kv-greeting">{hero.greeting}</p>}
					{side && (
						<div className="kv-hero__side">
							<IntroChips location={location} availability={hero.availability} />
							<Buttons links={hero.buttons} />
						</div>
					)}
				</div>
			)}
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="kv-stats" compact />
			)}
		</section>
	);
}

/** The picture sizes a tile asks for, by its place in the grid. */
function tileSizes(variant: string, index: number): string {
	if (variant === "grid-3") return "(min-width: 1024px) 460px, (min-width: 641px) 50vw, 100vw";
	if (variant === "grid-2") return "(min-width: 641px) 700px, 100vw";
	return index === 0 ? "(min-width: 1024px) 930px, 100vw" : "(min-width: 1024px) 460px, (min-width: 641px) 50vw, 100vw";
}

type WorkGridProps = { works: readonly PortfolioViewWork[]; first: boolean };

/**
 * Works as pictures, almost as wide as the screen. Captions (title, year and tags, the highlighted metric) show over a
 * dark gradient on hover or focus, and always below the picture on phones and touch screens. A work without a picture
 * is a plain tile with its title.
 */
function WorkGrid({ works, first }: WorkGridProps) {
	const { view } = useRender();
	const variant = themeVariant("kanvas", "work", view.design.variants.work);
	return (
		<ul className="kv-grid" data-variant={variant}>
			{works.map((work, index) => {
				const meta = [work.date, ...work.tags.slice(0, 2)].filter(Boolean).join(" · ");
				return (
					<li key={work.id} className="kv-tile" {...(work.cover ? {} : { "data-noimg": "" })}>
						<a href={`#${work.anchor}`}>
							{work.cover && (
								<div className="pf-cover kv-tile__img">
									<Picture
										image={work.cover}
										decorative
										sizes={tileSizes(variant, index)}
										{...(first && index === 0 ? { eager: true } : {})}
									/>
								</div>
							)}
							<span className="kv-cap">
								<span className="kv-cap__title">{work.title}</span>
								{meta && <span className="kv-cap__meta">{meta}</span>}
								{work.highlight && <WorkMetric metric={work.highlight} />}
							</span>
						</a>
					</li>
				);
			})}
		</ul>
	);
}

type SectionProps = { section: Exclude<PortfolioViewSection, { kind: "work" }> };

/** A section's content beside its label. The page draws the work section itself, as a grid without a label column. */
function SectionBody({ section }: SectionProps): ReactNode {
	const { view } = useRender();
	const variant = (key: VariantKey) => themeVariant("kanvas", key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className="kv-lead" />;
		case "services":
			return <ServiceList section={section} className="kv-services" variant={variant("services")} />;
		case "testimonials":
			return <TestimonialList section={section} className="kv-quotes" variant={variant("testimonials")} />;
		case "clients":
			return <Clients section={section} variant={variant("clients")} />;
		case "custom":
			return (
				<div className="kv-custom">
					<CustomSectionBody section={section} imageClassName="kv-custom__image" proseClassName="kv-lead" />
				</div>
			);
		case "contact":
			return (
				<div className="kv-contact">
					<Contact section={section} ctaClassName="kv-cta" />
				</div>
			);
		default:
			return <ResumeSectionBody section={section} listClassName="pf-extra" />;
	}
}

type KanvasPageProps = { year: number; creditUrl: string };

/**
 * Kanvas (`01-desain.md` section 5): dark by default, 1400 px wide, pictures as the content. The big-name intro, every
 * shown section in order (work as a picture grid, the rest as label | content rows), footer, and the works' details
 * as full screens.
 */
export function KanvasPage({ year, creditUrl }: KanvasPageProps) {
	const { view } = useRender();
	const pair = view.design.fonts.pair;
	return (
		<PageShell
			theme="kanvas"
			{...(pair ? { attributes: { "data-font-pair": pair } } : {})}
			navigation={<Navigation className="pf-wrap kv-top" brandClassName="kv-brand" />}
			mainClassName="kv-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{groupSections(view.sections).map((group, index) => {
				const first = group[0] as PortfolioViewSection;
				// The work section: the grid right after the intro, its heading for screen readers only (shown when it
				// isn't first).
				if (first.kind === "work")
					return (
						<Section
							key={first.key}
							section={first}
							className="pf-section kv-work"
							titleClassName={index === 0 ? "kv-label sr-only" : "kv-label"}
						>
							<WorkGrid works={first.works} first={index === 0} />
						</Section>
					);
				// Short lists that follow each other share one row: a joined label, then each list with its own heading.
				// Only the resume's short lists ever group (`groupSections`).
				if (group.length > 1)
					return (
						<div key={first.key} className="kv-sec kv-group">
							<p className="kv-label" aria-hidden="true">
								{group.map((section) => section.title).join(" · ")}
							</p>
							<div className="kv-sec__body kv-extras">
								{group.filter(isResumeSection).map((section) => (
									<ExtraSection key={section.key} section={section} className="pf-section">
										<SectionBody section={section} />
									</ExtraSection>
								))}
							</div>
						</div>
					);
				return (
					<Section
						key={first.key}
						section={first}
						className={`pf-section kv-sec kv-sec--${first.kind}`}
						titleClassName="kv-label"
					>
						<div className="kv-sec__body">
							<SectionBody section={first} />
						</div>
					</Section>
				);
			})}
		</PageShell>
	);
}
