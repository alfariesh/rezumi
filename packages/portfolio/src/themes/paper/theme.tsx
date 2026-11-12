import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { UiIcon } from "../../shared/icons";
import { introLocation, IntroChips, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, Picture, Section } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { Navigation, PageShell } from "../../shared/shell";

/** An original, static paper studio. Decorative, with no WebGL, external images or extra page script. */
function PaperStudio() {
	return (
		<svg className="pp-studio" viewBox="0 0 500 380" fill="none" aria-hidden="true">
			<g className="pp-studio__sheets" strokeLinejoin="round">
				<path d="m55 232 210-121 188 109-210 121z" />
				<path d="m55 220 210-121 188 109-210 121z" />
				<path d="m55 208 210-121 188 109-210 121z" />
			</g>
			<g className="pp-studio__frames" strokeLinejoin="round">
				<path d="m100 136 136-78v143l-136 78z" />
				<path d="m110 142 116-67v119l-116 67z" />
				<path d="m264 176 119-68v112l-119 68z" />
				<path d="m274 182 99-57v88l-99 57z" />
			</g>
			<g className="pp-studio__lines" strokeLinecap="round">
				<path d="m126 203 80-46m-80 58 64-37m-64 49 45-26m-80-48 26-15m-26 24 45-26" />
				<path d="m288 230 68-39m-68 51 45-26m-45 38 59-34" />
				<path d="m164 288 45-26m99-5 43-25" />
			</g>
			<g className="pp-studio__accent" strokeLinejoin="round">
				<path d="m126 146 80-46v38l-80 46z" />
				<path d="m288 183 68-39v29l-68 39z" />
				<path d="m211 265 24-14 24 14-24 14z" />
			</g>
			<path className="pp-studio__cursor" d="m231 127 3 34 8-13 13 3z" strokeLinejoin="round" />
		</svg>
	);
}

function Hero() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("paper", "hero", view.design.variants.hero);
	const portrait = variant !== "photo-top" ? hero.picture : null;
	const background = useIntroBackground();
	return (
		<>
			<section className="pp-hero" aria-label={messages.intro} data-variant={variant} {...background}>
				<div className="pp-hero__copy">
					{hero.picture && variant === "photo-top" && (
						<Picture image={hero.picture} className="pp-avatar" eager sizes="56px" />
					)}
					<IntroChips location={introLocation(view)} availability={hero.availability} />
					<HeroName className="pp-name" />
					<HeroHeadline className="pp-headline" />
					{hero.greeting && <p className="pp-greeting">{hero.greeting}</p>}
					<Buttons links={hero.buttons} />
				</div>
				<div className={`pp-hero__visual${portrait ? " pp-hero__visual--photo" : ""}`}>
					{portrait ? (
						<Picture image={portrait} className="pp-photo" eager sizes="(min-width: 761px) 400px, 180px" />
					) : (
						<PaperStudio />
					)}
					<span className="pp-fold" aria-hidden="true" />
				</div>
			</section>
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="pp-stats" compact />
			)}
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
					<a className="pp-work__card" href={`#${work.anchor}`} aria-labelledby={`${work.anchor}--card-title`}>
						{work.cover && (
							<span className="pp-work__art pf-cover">
								<Picture image={work.cover} decorative sizes="(min-width: 761px) 540px, 100vw" />
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
								{messages.caseStudies}
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

const HALF_SECTIONS = new Set([
	"experience",
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

type PaperPageProps = { year: number; creditUrl: string };

/** Paper's bordered sheet. Each section keeps its own position and anchor, including the user's free sections. */
export function PaperPage({ year, creditUrl }: PaperPageProps) {
	const { view } = useRender();
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
				/>
			}
			mainClassName="pp-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{view.sections.length > 0 && (
				<div className="pp-sheet">
					{view.sections.map((section, index) => (
						<Section
							key={section.key}
							section={section}
							className={`pf-section pp-cell pp-cell--${section.kind}${halfCell(view.sections, index) ? " pp-cell--half" : ""}`}
						>
							<div className="pp-cell__body">
								<SectionBody section={section} style={SECTION_STYLE} />
							</div>
							{(section.kind === "about" || section.kind === "custom") && (
								<span className="pp-fold" aria-hidden="true" />
							)}
						</Section>
					))}
				</div>
			)}
		</PageShell>
	);
}
