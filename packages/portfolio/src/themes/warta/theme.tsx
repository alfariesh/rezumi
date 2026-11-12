import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { fillPortfolioMessage } from "../../messages";
import { formatMetricNumber } from "../../metric";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { introLocation, IntroChips, OpenToWork, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, ExtraSection, Picture, Section } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { groupSections } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";

function Masthead() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("warta", "hero", view.design.variants.hero);
	const background = useIntroBackground();
	// The big name keeps the photo small, beside the dateline, as a columnist's byline picture.
	const portrait = variant === "big-name" ? null : hero.picture;
	const byline = variant === "big-name" ? hero.picture : null;
	const location = introLocation(view);
	return (
		<>
			<section
				className="wt-hero"
				aria-label={messages.intro}
				data-variant={variant}
				{...(portrait ? { "data-photo": "" } : {})}
				{...background}
			>
				{portrait && (
					<Picture
						image={portrait}
						className="wt-portrait"
						eager
						sizes={variant === "photo-left" ? "(min-width: 761px) 420px, 100vw" : "160px"}
					/>
				)}
				<div className="wt-masthead">
					<HeroHeadline className="wt-kicker" />
					<HeroName className="wt-name" />
					{(byline || location || hero.availability) && (
						<div className="wt-dateline">
							{byline && <Picture image={byline} className="wt-byline" eager sizes="56px" />}
							<IntroChips location={location} availability={hero.availability} />
						</div>
					)}
					<OpenToWork />
					{hero.greeting && <p className="wt-standfirst">{hero.greeting}</p>}
					<Buttons links={hero.buttons} />
				</div>
			</section>
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="big" className="wt-stats" compact />
			)}
		</>
	);
}

const PLAIN = { format: "plain" } as const;

type StoryProps = { work: PortfolioViewWork; lead: boolean; sizes: string };

/**
 * A work as an article: its picture, a rubric (the first tag), the headline, the summary as its dek, the highlighted
 * metric, and a byline of role, year and reading time.
 */
function Story({ work, lead, sizes }: StoryProps) {
	const { messages, locale } = useRender();
	const reading =
		work.readingMinutes === null
			? ""
			: fillPortfolioMessage(messages.readingTime, { count: formatMetricNumber(work.readingMinutes, PLAIN, locale) });
	const byline = [work.role, work.date, reading].filter(Boolean).join(" · ");
	const [rubric] = work.tags;
	return (
		<li className={`wt-story${lead ? " wt-story--lead" : ""}`} data-image={Boolean(work.cover)}>
			<a className="wt-story__link" href={work.href} aria-labelledby={`${work.anchor}--card-title`}>
				{work.cover && (
					<span className="pf-cover wt-story__cover">
						<Picture image={work.cover} decorative sizes={sizes} />
					</span>
				)}
				<div className="wt-story__text">
					{rubric && <span className="wt-rubric">{rubric}</span>}
					<h3 className="wt-story__title" id={`${work.anchor}--card-title`}>
						{work.title}
					</h3>
					{work.summary && <span className="wt-story__dek">{work.summary}</span>}
					{work.highlight && <WorkMetric metric={work.highlight} />}
					{byline && <span className="wt-story__byline">{byline}</span>}
				</div>
			</a>
		</li>
	);
}

type StoriesProps = { works: readonly PortfolioViewWork[] };

/** Works as a magazine's contents: a cover story and a grid of articles, a list, or two columns. */
function Stories({ works }: StoriesProps) {
	const { view } = useRender();
	const variant = themeVariant("warta", "work", view.design.variants.work);
	const featured = variant === "featured-grid";
	return (
		<ul className="wt-stories" data-variant={variant}>
			{works.map((work, index) => {
				const lead = featured && index === 0;
				const sizes = lead
					? "(min-width: 761px) 680px, 100vw"
					: variant === "list"
						? "200px"
						: variant === "grid-2"
							? "(min-width: 761px) 540px, 100vw"
							: "(min-width: 961px) 360px, (min-width: 761px) 50vw, 100vw";
				return <Story key={work.id} work={work} lead={lead} sizes={sizes} />;
			})}
		</ul>
	);
}

const SECTION_STYLE: SectionBodyStyle = {
	theme: "warta",
	prefix: "wt",
	work: (works) => <Stories works={works} />,
	wrapContact: (body) => <div className="wt-letters">{body}</div>,
};

/** Short lists that share an "in brief" row when two or more follow each other. Publications stand as a section. */
const BRIEF_KINDS: ReadonlySet<string> = new Set(["languages", "certifications", "awards", "interests"]);

type WartaPageProps = { year: number; creditUrl: string };

/**
 * Warta, for writers, PR, marketing and researchers: a magazine. A masthead with the name large and centred, a cover
 * story and articles with rubrics and reading times, testimonials as pull quotes, About with a drop cap, and short
 * lists gathered in brief. Every section keeps its own anchor and heading.
 */
export function WartaPage({ year, creditUrl }: WartaPageProps) {
	const { view } = useRender();
	const groups = groupSections(view.sections, BRIEF_KINDS);
	const brief = (group: readonly PortfolioViewSection[]) => group.length > 1 && BRIEF_KINDS.has(group[0]?.kind ?? "");
	return (
		<PageShell
			theme="warta"
			navigation={<Navigation className="pf-wrap wt-top" brandClassName="wt-brand" />}
			mainClassName="wt-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Masthead />
			{groups.map((group, index) => {
				const first = group[0] as PortfolioViewSection;
				if (brief(group))
					return (
						<div key={first.key} className="wt-brief">
							{group.map((section) => (
								<ExtraSection key={section.key} section={section} className="pf-section pf-extra wt-brief__item">
									<SectionBody section={section} style={SECTION_STYLE} />
								</ExtraSection>
							))}
						</div>
					);
				// The section's number among the full sections, like a magazine's folio (decoration).
				const folio = groups.slice(0, index + 1).filter((earlier) => !brief(earlier)).length;
				return (
					<Section key={first.key} section={first} className={`pf-section wt-section wt-section--${first.kind}`}>
						<span className="wt-folio" aria-hidden="true">
							{String(folio).padStart(2, "0")}
						</span>
						<div className="wt-section__body">
							<SectionBody section={first} style={SECTION_STYLE} />
						</div>
					</Section>
				);
			})}
		</PageShell>
	);
}
