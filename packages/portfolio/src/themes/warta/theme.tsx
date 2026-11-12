import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { introLocation, IntroChips, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, ExtraSection, Picture, Section } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { EXTRA_KINDS, groupSections } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";

function Hero() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("warta", "hero", view.design.variants.hero);
	const background = useIntroBackground();
	return (
		<section
			className="lg-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? variant : "no-photo"}
			{...background}
		>
			{hero.picture && <Picture image={hero.picture} className="lg-photo" eager sizes="120px" />}
			<div className="lg-hero__text">
				<HeroName className="lg-name" />
				<HeroHeadline className="lg-headline" />
			</div>
			{hero.greeting && <p className="lg-greeting">{hero.greeting}</p>}
			<IntroChips location={introLocation(view)} availability={hero.availability} />
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="lg-stats" compact />
			)}
			<Buttons links={hero.buttons} />
		</section>
	);
}

type WorkListProps = { works: readonly PortfolioViewWork[] };

function WorkList({ works }: WorkListProps) {
	const { view } = useRender();
	const variant = themeVariant("warta", "work", view.design.variants.work);
	return (
		<ul className="lg-works" data-variant={variant}>
			{works.map((work, index) => (
				<li key={work.id} className="lg-work" {...(work.cover ? {} : { "data-noimg": "" })}>
					<a href={`#${work.anchor}`}>
						{work.cover && (
							<div className="pf-cover lg-work__cover">
								<Picture
									image={work.cover}
									decorative
									sizes={variant === "list" ? "120px" : index === 0 && variant === "featured-grid" ? "680px" : "340px"}
								/>
							</div>
						)}
						<span className="lg-work__body">
							<span className="lg-work__title">{work.title}</span>
							{work.summary && <span className="lg-work__summary">{work.summary}</span>}
							{(work.role || work.date || work.highlight) && (
								<span className="lg-work__meta">
									{(work.role || work.date) && <span>{[work.role, work.date].filter(Boolean).join(" · ")}</span>}
									{work.highlight && <WorkMetric metric={work.highlight} />}
								</span>
							)}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}

const SECTION_STYLE: SectionBodyStyle = {
	theme: "warta",
	prefix: "lg",
	work: (works) => <WorkList works={works} />,
};

type WartaPageProps = { year: number; creditUrl: string };

/** Warta (Phase 13 stub: a copy of Lugas until `pf-themes` draws it): intro, then every shown section in order, footer, and the works' details. */
export function WartaPage({ year, creditUrl }: WartaPageProps) {
	const { view } = useRender();
	return (
		<PageShell
			theme="warta"
			navigation={
				<Navigation
					className="pf-wrap lg-top"
					brandClassName="lg-brand"
					brandMark={
						<span className="lg-mono" aria-hidden="true">
							{view.basics.initials}
						</span>
					}
				/>
			}
			mainClassName="lg-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{groupSections(view.sections).map((group) => {
				const first = group[0] as PortfolioViewSection;
				if (group.length > 1 || EXTRA_KINDS.has(first.kind))
					return (
						<div key={first.key} className="lg-sec pf-extras">
							{group.map((section) => (
								<ExtraSection key={section.key} section={section}>
									<SectionBody section={section} style={SECTION_STYLE} />
								</ExtraSection>
							))}
						</div>
					);
				return (
					<Section
						key={first.key}
						section={first}
						className={`pf-section lg-sec${first.kind === "custom" ? " lg-custom" : ""}`}
					>
						<SectionBody section={first} style={SECTION_STYLE} />
					</Section>
				);
			})}
		</PageShell>
	);
}
