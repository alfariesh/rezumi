import type { PortfolioPageMessages } from "../../messages";
import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { introLocation, IntroChips, OpenToWork, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, ExtraSection, Picture, Section, vars } from "../../shared/parts";
import { SectionBody } from "../../shared/section-body";
import { EXTRA_KINDS, groupSections } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";

/** A section's title as Prima shows it: the Work section is "Case studies" unless the person renamed it. */
function titleOf(section: PortfolioViewSection, messages: PortfolioPageMessages): string {
	return section.kind === "work" && section.title === messages.work ? messages.caseStudies : section.title;
}

/** The photo's caption: the person's first two certificates, as the credentials a formal reader looks for. */
function credentials(sections: readonly PortfolioViewSection[]): string {
	for (const section of sections)
		if (section.kind === "certifications")
			return section.items
				.map((item) => item.title.trim())
				.filter(Boolean)
				.slice(0, 2)
				.join(" · ");
	return "";
}

/**
 * The intro: headline above the name in small capitals, greeting, chips and buttons beside the photo with its
 * credentials, then the achievements as one joined KPI strip.
 */
function Hero() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("prima", "hero", view.design.variants.hero);
	const background = useIntroBackground();
	const caption = credentials(view.sections);
	return (
		<section
			className="pr-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? variant : "no-photo"}
			{...background}
		>
			<div className="pr-hero__grid">
				<div className="pr-hero__text">
					<HeroName className="pr-name" />
					<HeroHeadline className="pr-headline" />
					{hero.greeting && <p className="pr-greeting">{hero.greeting}</p>}
					<IntroChips location={introLocation(view)} availability={hero.availability} />
					<OpenToWork />
					<Buttons links={hero.buttons} />
				</div>
				{hero.picture && (
					<figure className="pr-photo">
						<Picture image={hero.picture} eager sizes="(max-width: 820px) 200px, 360px" />
						{caption && <figcaption>{caption}</figcaption>}
					</figure>
				)}
			</div>
			{hero.highlights.length > 0 && (
				<div className="pr-kpis" style={vars({ "--pr-kpis": hero.highlights.length })}>
					<MetricGroup metrics={hero.highlights} variant="kpi" compact />
				</div>
			)}
		</section>
	);
}

type WorkListProps = { works: readonly PortfolioViewWork[] };

/** How wide a card's cover draws per work variant; Prima offers grid-2 (default), grid-3 and list. */
const COVER_SIZES: Partial<Record<string, string>> = {
	"grid-3": "(max-width: 560px) 100vw, 300px",
	list: "(max-width: 560px) 100vw, 240px",
};

/** Works as bordered cards: 16:10 cover, year · role, serif title, summary and the highlighted metric. */
function WorkList({ works }: WorkListProps) {
	const { view } = useRender();
	const variant = themeVariant("prima", "work", view.design.variants.work);
	return (
		<ul className="pr-works" data-variant={variant}>
			{works.map((work) => (
				<li key={work.id} className="pr-work" {...(work.cover ? {} : { "data-noimg": "" })}>
					<a className="pr-card" href={work.href}>
						{work.cover && (
							<div className="pf-cover pr-card__cover">
								<Picture
									image={work.cover}
									decorative
									sizes={COVER_SIZES[variant] ?? "(max-width: 560px) 100vw, 440px"}
								/>
							</div>
						)}
						<span className="pr-card__body">
							{(work.date || work.role) && (
								<span className="pr-card__meta">{[work.date, work.role].filter(Boolean).join(" · ")}</span>
							)}
							<span className="pr-card__title">{work.title}</span>
							{work.summary && <span className="pr-card__summary">{work.summary}</span>}
							{work.highlight && <WorkMetric metric={work.highlight} />}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}

type SectionProps = { section: PortfolioViewSection; index: number };

const SECTION_STYLE: SectionBodyStyle = {
	theme: "prima",
	prefix: "pr",
	work: (works) => <WorkList works={works} />,
	resumeListClassName: "pr-list",
	wrapContact: (body, section) => (
		<div className="pr-contact" {...(section.contact.location ? { "data-loc": "" } : {})}>
			{body}
		</div>
	),
};

/** One section as a Prima row: its number and serif title in a rail, the content beside it, a heavy rule above. */
function Row({ section, index }: SectionProps) {
	const { messages } = useRender();
	return (
		<Section
			section={{ anchor: section.anchor, title: titleOf(section, messages) }}
			className={`pf-section pr-row${section.kind === "custom" ? " pr-custom" : ""}`}
		>
			<span className="pr-row__index" aria-hidden="true">
				{String(index).padStart(2, "0")}
			</span>
			<div className="pr-row__body">
				<SectionBody section={section} style={SECTION_STYLE} />
			</div>
		</Section>
	);
}

type PrimaPageProps = { year: number; creditUrl: string };

/**
 * Prima (`01-desain.md` section 5): a formal, wide page with a sticky translucent navigation, the intro beside the
 * photo, a KPI strip, and every section as a two-column row. Consecutive short lists (languages, certificates, awards,
 * publications, interests) share one row in columns, each keeping its anchor and heading.
 */
export function PrimaPage({ year, creditUrl }: PrimaPageProps) {
	const { view, messages } = useRender();
	const contact = view.sections.find((section) => section.kind === "contact");
	return (
		<PageShell
			theme="prima"
			navigation={
				<Navigation
					className="pr-head"
					innerClassName="pf-wrap"
					brandClassName="pr-brand"
					label={(section) => titleOf(section, messages)}
					message={contact ? { anchor: contact.anchor, className: "pr-head__cta" } : null}
				/>
			}
			mainClassName="pr-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{groupSections(view.sections).map((group, index) => {
				const first = group[0] as PortfolioViewSection;
				if (group.length > 1 && EXTRA_KINDS.has(first.kind))
					return (
						<div key={first.key} className="pr-row pr-facts">
							<div className="pf-extras">
								{group.map((section) => (
									<ExtraSection key={section.key} section={section}>
										<SectionBody section={section} style={SECTION_STYLE} />
									</ExtraSection>
								))}
							</div>
						</div>
					);
				return <Row key={first.key} section={first} index={index + 1} />;
			})}
		</PageShell>
	);
}
