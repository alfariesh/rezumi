import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { UiIcon } from "../../shared/icons";
import { introLocation, IntroChips, OpenToWork, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, Picture, Section } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { pairsUp } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";

/** A decorative print-style burst, drawn here rather than borrowed from the reference sites. */
function Burst() {
	return (
		<svg className="br-burst" viewBox="0 0 120 120" aria-hidden="true" fill="currentColor">
			<path d="m60 4 10 25 22-15-3 28 27 3-20 20 19 20-28 2 3 28-23-16-10 25-10-25-23 16 3-28-28-2 20-20L0 45l27-3-3-28 23 15z" />
		</svg>
	);
}

/**
 * A ticker band under the intro: the headline, place and availability on a loop. Decorative (all of it is in the
 * intro as text), and still when the visitor prefers less motion.
 */
function Ticker() {
	const { view } = useRender();
	const words = [view.basics.headline, introLocation(view), view.hero.availability]
		.map((word) => word?.trim())
		.filter((word): word is string => Boolean(word));
	if (!words.length) return null;
	const run = (copy: number) => (
		<span className="br-ticker__run" key={copy}>
			{words.map((word, index) => (
				<span key={`${copy}-${index}`}>
					{word}
					<i />
				</span>
			))}
		</span>
	);
	return (
		<div className="br-ticker" aria-hidden="true">
			<div className="br-ticker__track">{[0, 1, 2, 3].map(run)}</div>
		</div>
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
					<OpenToWork />
					<HeroName className="br-name" />
					<HeroHeadline className="br-headline" />
					{hero.greeting && <p className="br-greeting">{hero.greeting}</p>}
					<Buttons links={hero.buttons} />
				</div>
				<div className="br-visual">
					{hero.picture ? (
						<Picture image={hero.picture} className="br-photo" eager sizes="(min-width: 761px) 440px, 280px" />
					) : (
						<span className="br-monogram" aria-hidden="true">
							{basics.initials}
						</span>
					)}
					<Burst />
				</div>
			</section>
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="br-stats" compact />
			)}
			<Ticker />
		</>
	);
}

type WorkGridProps = { works: readonly PortfolioViewWork[] };

function WorkGrid({ works }: WorkGridProps) {
	const { view, messages } = useRender();
	const variant = themeVariant("brutal", "work", view.design.variants.work);
	return (
		<ul className="br-works" data-variant={variant}>
			{works.map((work, index) => (
				<li key={work.id} className="br-work" data-image={Boolean(work.cover)}>
					<a className="br-work__link" href={work.href} aria-labelledby={`${work.anchor}--card-title`}>
						{work.cover && (
							<span className="pf-cover br-work__cover">
								<Picture
									image={work.cover}
									decorative
									sizes={variant === "list" ? "(min-width: 761px) 420px, 100vw" : "(min-width: 761px) 560px, 100vw"}
								/>
								<span className="br-work__number" aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
							</span>
						)}
						<div className="br-work__body">
							{(work.role || work.date) && (
								<span className="br-work__meta">{[work.role, work.date].filter(Boolean).join(" · ")}</span>
							)}
							<h3 className="br-work__title" id={`${work.anchor}--card-title`}>
								{work.title}
							</h3>
							{work.summary && <span className="br-work__summary">{work.summary}</span>}
							{work.highlight && <WorkMetric metric={work.highlight} />}
							{work.tags.length > 0 && (
								<span className="br-work__tags">
									{work.tags.map((tag) => (
										<span key={tag}>{tag}</span>
									))}
								</span>
							)}
							<span className="br-work__cta" aria-hidden="true">
								{messages.viewWork}
								<UiIcon name="arrow-right" flip />
							</span>
						</div>
					</a>
				</li>
			))}
		</ul>
	);
}

const SECTION_STYLE: SectionBodyStyle = {
	theme: "brutal",
	prefix: "br",
	work: (works) => <WorkGrid works={works} />,
};

/** Short lists drawn as cards, two to a row; the long sections stay open on the page. */
const CARD_SECTIONS = new Set([
	"education",
	"awards",
	"certifications",
	"languages",
	"publications",
	"volunteer",
	"interests",
	"profiles",
]);

type BrutalPageProps = { year: number; creditUrl: string };

/**
 * Brutal's page: a loud intro and a ticker band, then the long sections open under huge numbered titles, the short
 * ones as outlined cards two to a row, testimonials on an ink band and contact on a full accent block.
 */
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
			{view.sections.map((section, index) => {
				const card = CARD_SECTIONS.has(section.kind);
				const half = pairsUp(view.sections, index, CARD_SECTIONS);
				return (
					<Section
						key={section.key}
						section={section}
						className={`pf-section br-section br-section--${section.kind}${card ? " br-section--card" : ""}${half ? " br-section--half" : ""}`}
					>
						<span className="br-section__number" aria-hidden="true">
							{String(index + 1).padStart(2, "0")}
						</span>
						<div className="br-section__body">
							<SectionBody section={section} style={SECTION_STYLE} />
						</div>
					</Section>
				);
			})}
		</PageShell>
	);
}
