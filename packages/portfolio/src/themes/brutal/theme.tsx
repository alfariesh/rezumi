import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { UiIcon } from "../../shared/icons";
import { introLocation, IntroChips, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { ServiceList, TestimonialList } from "../../shared/offers";
import { Buttons, Clients, Contact, CustomSectionBody, Picture, Prose, Section } from "../../shared/parts";
import { ResumeSectionBody } from "../../shared/resume";
import { Navigation, PageShell } from "../../shared/shell";

/** A decorative print-style burst, drawn here rather than borrowed from the reference sites. */
function Burst() {
	return (
		<svg className="br-burst" viewBox="0 0 120 120" aria-hidden="true" fill="currentColor">
			<path d="m60 4 10 25 22-15-3 28 27 3-20 20 19 20-28 2 3 28-23-16-10 25-10-25-23 16 3-28-28-2 20-20L0 45l27-3-3-28 23 15z" />
		</svg>
	);
}

function Hero() {
	const { view, messages } = useRender();
	const { hero, basics } = view;
	const background = useIntroBackground();
	return (
		<>
			<section
				className="br-hero"
				aria-label={messages.intro}
				data-variant={themeVariant("brutal", "hero", view.design.variants.hero)}
				{...background}
			>
				<div className="br-intro">
					<IntroChips location={introLocation(view)} availability={hero.availability} availabilityFirst />
					<HeroName className="br-name" />
					<HeroHeadline className="br-headline" />
					{hero.greeting && <p className="br-greeting">{hero.greeting}</p>}
					<Buttons links={hero.buttons} />
				</div>
				<div className="br-visual">
					<div className="br-visual__bar" aria-hidden="true">
						<i />
						<i />
						<i />
						<span>{basics.initials}</span>
					</div>
					<div className="br-visual__canvas">
						{hero.picture ? (
							<Picture image={hero.picture} className="br-photo" eager sizes="(min-width: 761px) 440px, 280px" />
						) : (
							<span className="br-monogram" aria-hidden="true">
								{basics.initials}
							</span>
						)}
						<Burst />
					</div>
				</div>
			</section>
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="br-stats" compact />
			)}
		</>
	);
}

type WorkGridProps = { works: readonly PortfolioViewWork[] };

function WorkGrid({ works }: WorkGridProps) {
	const { view } = useRender();
	const variant = themeVariant("brutal", "work", view.design.variants.work);
	return (
		<ul className="br-works" data-variant={variant}>
			{works.map((work, index) => (
				<li key={work.id} className="br-work" data-image={Boolean(work.cover)}>
					<a className="br-work__link" href={`#${work.anchor}`} aria-labelledby={`${work.anchor}--card-title`}>
						{work.cover && (
							<span className="pf-cover br-work__cover">
								<Picture
									image={work.cover}
									decorative
									sizes={variant === "list" ? "(min-width: 761px) 320px, 100vw" : "(min-width: 761px) 560px, 100vw"}
								/>
							</span>
						)}
						<div className="br-work__body">
							<span className="br-work__meta">
								<span className="br-work__number" aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
								{(work.role || work.date) && <span>{[work.role, work.date].filter(Boolean).join(" · ")}</span>}
							</span>
							<h3 className="br-work__title" id={`${work.anchor}--card-title`}>
								{work.title}
								<UiIcon name="link" flip />
							</h3>
							{work.summary && <span className="br-work__summary">{work.summary}</span>}
							{work.tags.length > 0 && (
								<span className="br-work__tags">
									{work.tags.map((tag) => (
										<span key={tag}>{tag}</span>
									))}
								</span>
							)}
							{work.highlight && <WorkMetric metric={work.highlight} />}
						</div>
					</a>
				</li>
			))}
		</ul>
	);
}

type SectionBodyProps = { section: PortfolioViewSection };

function SectionBody({ section }: SectionBodyProps): ReactNode {
	const { view } = useRender();
	const variant = (key: Parameters<typeof themeVariant>[1]) => themeVariant("brutal", key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className="br-lead" />;
		case "work":
			return <WorkGrid works={section.works} />;
		case "services":
			return <ServiceList section={section} className="br-services" variant={variant("services")} />;
		case "testimonials":
			return <TestimonialList section={section} className="br-quotes" variant={variant("testimonials")} />;
		case "clients":
			return <Clients section={section} variant={variant("clients")} />;
		case "custom":
			return <CustomSectionBody section={section} imageClassName="br-custom__image" />;
		case "contact":
			return <Contact section={section} ctaClassName="br-cta" />;
		default:
			return <ResumeSectionBody section={section} />;
	}
}

type BrutalPageProps = { year: number; creditUrl: string };

/** Bold, boxed content with real reading order; shared primitives retain media, privacy and keyboard behaviour. */
export function BrutalPage({ year, creditUrl }: BrutalPageProps) {
	const { view } = useRender();
	return (
		<PageShell
			theme="brutal"
			navigation={
				<Navigation
					className="pf-wrap br-top"
					brandClassName="br-brand"
					brandMark={
						<span className="br-mark" aria-hidden="true">
							{view.basics.initials}
						</span>
					}
				/>
			}
			mainClassName="br-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{view.sections.map((section, index) => (
				<Section key={section.key} section={section} className={`pf-section br-section br-section--${section.kind}`}>
					<div className="br-section__body">
						<SectionBody section={section} />
					</div>
					<span className="br-section__number" aria-hidden="true">
						{String(index + 1).padStart(2, "0")}
					</span>
				</Section>
			))}
		</PageShell>
	);
}
