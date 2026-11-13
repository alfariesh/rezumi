import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { UiIcon } from "../../shared/icons";
import { introLocation, IntroChips, OpenToWork, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, Picture, Section } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { Navigation, PageShell } from "../../shared/shell";

/** Four selection handles on a frame's corners, as a design tool draws a selected layer. */
function Handles() {
	return (
		<>
			<i className="pp-handle pp-handle--tl" />
			<i className="pp-handle pp-handle--tr" />
			<i className="pp-handle pp-handle--bl" />
			<i className="pp-handle pp-handle--br" />
		</>
	);
}

function Hero() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("paper", "hero", view.design.variants.hero);
	const portrait = variant !== "photo-top" ? hero.picture : null;
	const background = useIntroBackground();
	// Without a large photo, the highlights fill the intro's right side; beside a photo they open the sheet instead.
	const sideStats = !portrait && hero.highlights.length > 0;
	return (
		<>
			<section className="pp-hero" aria-label={messages.intro} data-variant={variant} {...background}>
				<div className="pp-hero__copy">
					{hero.picture && variant === "photo-top" && (
						<span className="pp-avatar-frame">
							<Picture image={hero.picture} className="pp-avatar" eager sizes="80px" />
							<Handles />
						</span>
					)}
					<IntroChips location={introLocation(view)} availability={hero.availability} />
					<OpenToWork />
					<HeroName className="pp-name" />
					<HeroHeadline className="pp-headline" />
					{hero.greeting && <p className="pp-greeting">{hero.greeting}</p>}
					<Buttons links={hero.buttons} />
				</div>
				{sideStats && (
					<div className="pp-hero__stats">
						<MetricGroup metrics={hero.highlights} variant="big" className="pp-stats" compact />
						<Handles />
					</div>
				)}
				{portrait && (
					<div className="pp-hero__visual">
						<div className="pp-artboard pp-artboard--photo">
							<Picture image={portrait} className="pp-photo" eager sizes="(min-width: 761px) 420px, 200px" />
							<Handles />
						</div>
					</div>
				)}
			</section>
		</>
	);
}

type WorkListProps = { works: readonly PortfolioViewWork[] };

function WorkList({ works }: WorkListProps) {
	const { view, messages } = useRender();
	const variant = themeVariant("paper", "work", view.design.variants.work);
	return (
		<ul className="pp-works" data-variant={variant}>
			{works.map((work, index) => (
				<li key={work.id} className="pp-work" data-image={Boolean(work.cover)}>
					<a className="pp-work__card" href={work.href} aria-labelledby={`${work.anchor}--card-title`}>
						{work.cover && (
							<span className="pp-work__art">
								<span className="pp-work__frame pf-cover">
									<Picture image={work.cover} decorative sizes="(min-width: 761px) 460px, 100vw" />
								</span>
							</span>
						)}
						<div className="pp-work__copy">
							<div className="pp-work__meta">
								<span className="pp-number" aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
								{(work.role || work.date) && <span>{[work.role, work.date].filter(Boolean).join(" · ")}</span>}
							</div>
							<h3 className="pp-work__title" id={`${work.anchor}--card-title`}>
								{work.title}
							</h3>
							{work.summary && <p className="pp-work__summary">{work.summary}</p>}
							{work.highlight && <WorkMetric metric={work.highlight} />}
							{work.tags.length > 0 && (
								<ul className="pf-tags">
									{work.tags.map((tag) => (
										<li key={tag}>{tag}</li>
									))}
								</ul>
							)}
							<span className="pp-work__cta" aria-hidden="true">
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
	theme: "paper",
	prefix: "pp",
	work: (works) => <WorkList works={works} />,
};

/** Short lists that pair up two to a row. Experience is usually long, so it takes the full width as a dated index. */
const HALF_SECTIONS = new Set([
	"education",
	"skills",
	"awards",
	"certifications",
	"languages",
	"publications",
	"volunteer",
	"interests",
	"profiles",
]);

/** Pair consecutive short sections. A final unpaired cell spans the sheet, keeping hidden sections from leaving holes. */
function halfCell(sections: readonly PortfolioViewSection[], index: number): boolean {
	if (!HALF_SECTIONS.has(sections[index]?.kind ?? "")) return false;
	if (HALF_SECTIONS.has(sections[index + 1]?.kind ?? "")) return true;
	let preceding = 0;
	for (let previous = index - 1; previous >= 0 && HALF_SECTIONS.has(sections[previous]?.kind ?? ""); previous--)
		preceding++;
	return preceding % 2 === 1;
}

/** The sheet's cells that turn a corner over, as the reference turns one corner per screen or so. */
const FOLDED = new Set(["about", "testimonials"]);

type PaperPageProps = { year: number; creditUrl: string };

/**
 * Paper's page: a wide intro, then one bordered sheet of cells with registration squares
 * where the lines meet. Each section keeps its own position and anchor, including the user's free sections.
 */
export function PaperPage({ year, creditUrl }: PaperPageProps) {
	const { view } = useRender();
	// The highlights open the sheet only when a large photo has the intro's right side (`Hero`).
	const portraitVariant = themeVariant("paper", "hero", view.design.variants.hero) !== "photo-top";
	const highlights = portraitVariant && view.hero.picture ? view.hero.highlights : [];
	const contact = view.sections.find((section) => section.kind === "contact");
	// Work leads the menu: on a portfolio it is what visitors look for first, wherever the page puts it.
	const menuSections = [
		...view.sections.filter((section) => section.kind === "work"),
		...view.sections.filter((section) => section.kind !== "work"),
	];
	return (
		<PageShell
			theme="paper"
			navigation={
				<Navigation
					className="pf-wrap pp-top"
					brandClassName="pp-brand"
					brandMark={
						<span className="pp-monogram" aria-hidden="true">
							{view.basics.initials}
						</span>
					}
					sections={menuSections}
					message={contact ? { anchor: contact.anchor, className: "pp-hello" } : null}
				/>
			}
			mainClassName="pp-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{(view.sections.length > 0 || highlights.length > 0) && (
				<div className="pp-sheet">
					{highlights.length > 0 && (
						<div className="pp-cell pp-cell--stats">
							<MetricGroup metrics={highlights} variant="big" className="pp-stats" compact />
						</div>
					)}
					{view.sections.map((section, index) => (
						<Section
							key={section.key}
							section={section}
							className={`pf-section pp-cell pp-cell--${section.kind}${HALF_SECTIONS.has(section.kind) ? " pp-cell--short" : ""}${halfCell(view.sections, index) ? " pp-cell--half" : ""}`}
						>
							{section.kind === "custom" && <span className="pp-orbit" aria-hidden="true" />}
							<div className="pp-cell__body">
								<SectionBody section={section} style={SECTION_STYLE} />
							</div>
							{FOLDED.has(section.kind) && <span className="pp-fold" aria-hidden="true" />}
						</Section>
					))}
				</div>
			)}
		</PageShell>
	);
}
