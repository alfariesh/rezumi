import type { PortfolioPageMessages } from "../../messages";
import type { ResumeItem } from "../../shared/parts";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { ResumeIcon, UiIcon } from "../../shared/icons";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import {
	Buttons,
	Clients,
	Contact,
	CvList,
	ExtraList,
	Footer,
	hostOf,
	Lightbox,
	linkAttributes,
	Picture,
	Prose,
	SectionTitle,
	Skills,
	vars,
	WorkDetail,
} from "../../shared/parts";
import { EXTRA_KINDS, groupSections, initials, navSections } from "../../shared/sections";

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

function Navigation() {
	const { view, messages } = useRender();
	const links = navSections(view.sections);
	const contact = view.sections.find((section) => section.kind === "contact");
	const items = links.map((section) => (
		<li key={section.key}>
			<a href={`#${section.anchor}`}>{titleOf(section, messages)}</a>
		</li>
	));
	return (
		<header className="pr-head">
			<div className="pf-wrap">
				<nav className="pf-nav" aria-label={messages.pageNavigation}>
					<a className="pf-nav__brand pr-brand" href="#main">
						<span>{view.basics.name}</span>
					</a>
					{links.length > 0 && (
						<>
							<ul className="pf-nav__links">
								{items}
								{contact && (
									<li className="pr-head__cta">
										<a className="pf-btn pf-btn--primary" href={`#${contact.anchor}`}>
											{messages.sendMessage}
										</a>
									</li>
								)}
							</ul>
							<details className="pf-menu">
								<summary>
									<UiIcon name="menu" />
									{messages.menu}
								</summary>
								<ul className="pf-menu__list">{items}</ul>
							</details>
						</>
					)}
				</nav>
			</div>
		</header>
	);
}

/**
 * The intro: headline above the name in small capitals, greeting, chips and buttons beside the photo with its
 * credentials, then the achievements as one joined KPI strip.
 */
function Hero() {
	const { view, messages, imageUrl } = useRender();
	const { hero, basics } = view;
	const variant = themeVariant("prima", "hero", view.design.variants.hero);
	const location = view.location?.label || basics.location;
	const background = hero.background.image ? imageUrl(hero.background.image.src) : undefined;
	const bg = hero.background.kind === "image" && !background ? "plain" : hero.background.kind;
	const caption = credentials(view.sections);
	return (
		<section
			className="pr-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? variant : "no-photo"}
			data-bg={bg}
			{...(bg === "image" && background
				? { style: vars({ "--pf-hero-image": `url("${encodeURI(background).replaceAll('"', "%22")}")` }) }
				: {})}
		>
			<div className="pr-hero__grid">
				<div className="pr-hero__text">
					<HeroName className="pr-name" />
					<HeroHeadline className="pr-headline" />
					{hero.greeting && <p className="pr-greeting">{hero.greeting}</p>}
					{(location || hero.availability) && (
						<ul className="pf-chips">
							{location && (
								<li className="pf-chip">
									<UiIcon name="pin" />
									{location}
								</li>
							)}
							{hero.availability && <li className="pf-chip pf-chip--open">{hero.availability}</li>}
						</ul>
					)}
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
					<a className="pr-card" href={`#${work.anchor}`}>
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

type SectionProps = { section: PortfolioViewSection };

function SectionBody({ section }: SectionProps): ReactNode {
	const { view } = useRender();
	const variant = (key: Parameters<typeof themeVariant>[1]) => themeVariant("prima", key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className="pr-lead" />;
		case "work":
			return <WorkList works={section.works} />;
		case "services":
			return (
				<ul className="pr-services" data-variant={variant("services")}>
					{section.services.map((service) => (
						<li key={service.id} className="pf-service">
							<div className="pf-service__head">
								<h3>
									<ResumeIcon name={service.icon} />
									{service.title}
								</h3>
								{service.price && <span className="pf-service__price">{service.price}</span>}
							</div>
							{service.description && <p>{service.description}</p>}
							{service.cta && (
								<a className="pf-service__cta" {...linkAttributes(service.cta.href, service.cta)}>
									{service.cta.label}
									<UiIcon name="arrow-right" flip />
								</a>
							)}
						</li>
					))}
				</ul>
			);
		case "testimonials":
			return (
				<ul className="pr-quotes" data-variant={variant("testimonials")}>
					{section.testimonials.map((testimonial) => (
						<li key={testimonial.id} className="pf-quote">
							<blockquote>{testimonial.quote}</blockquote>
							<div className="pf-person">
								<span className="pf-avatar" aria-hidden="true">
									{testimonial.photo ? (
										<Picture image={testimonial.photo} decorative sizes="44px" />
									) : (
										initials(testimonial.name)
									)}
								</span>
								<span className="pf-person__text">
									<b>{testimonial.name}</b>
									{testimonial.role && <span>{testimonial.role}</span>}
								</span>
							</div>
							{testimonial.sourceUrl && (
								<a className="pf-quote__source" {...linkAttributes(testimonial.sourceUrl)}>
									{hostOf(testimonial.sourceUrl)}
								</a>
							)}
						</li>
					))}
				</ul>
			);
		case "clients":
			return <Clients section={section} variant={variant("clients")} />;
		case "experience":
		case "education":
			return <CvList kind={section.kind} items={section.items as ResumeItem[]} variant={variant(section.kind)} />;
		case "volunteer":
			return <CvList kind="volunteer" items={section.items as ResumeItem[]} variant={variant("experience")} />;
		case "skills":
			return <Skills items={section.items as ResumeItem[]} variant={variant("skills")} />;
		case "resume":
			return <CvList kind={section.type} items={section.items as unknown as ResumeItem[]} />;
		case "custom":
			return (
				<>
					{section.image && <Picture image={section.image} className="pr-custom__image" />}
					<Prose html={section.html} />
					{section.button && <Buttons links={[section.button]} />}
				</>
			);
		case "contact":
			return (
				<div className="pr-contact" {...(section.contact.location ? { "data-loc": "" } : {})}>
					<Contact section={section} ctaClassName="pr-cta" />
				</div>
			);
		default:
			return (
				<div className="pr-list">
					<ExtraList kind={section.kind} items={section.items as ResumeItem[]} />
				</div>
			);
	}
}

/** One section as a Prima row: the serif title in a 220 px rail, the content beside it, a rule above. */
function Row({ section }: SectionProps) {
	const { messages } = useRender();
	return (
		<section
			className={`pf-section pr-row${section.kind === "custom" ? " pr-custom" : ""}`}
			id={section.anchor}
			aria-labelledby={`${section.anchor}-title`}
		>
			<SectionTitle section={{ anchor: section.anchor, title: titleOf(section, messages) }} />
			<div className="pr-row__body">
				<SectionBody section={section} />
			</div>
		</section>
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
	const works = view.works;
	return (
		<div className="pf" data-theme="prima">
			<a className="pf-skip" href="#main">
				{messages.skipToContent}
			</a>
			<Navigation />
			<main className="pf-wrap pr-main" id="main" tabIndex={-1}>
				<Hero />
				{groupSections(view.sections).map((group) => {
					const first = group[0] as PortfolioViewSection;
					if (group.length > 1 && EXTRA_KINDS.has(first.kind))
						return (
							<div key={first.key} className="pr-row pr-facts">
								<div className="pf-extras">
									{group.map((section) => (
										<section
											key={section.key}
											className="pf-section pf-extra"
											id={section.anchor}
											aria-labelledby={`${section.anchor}-title`}
										>
											<h2 className="pf-extra__title" id={`${section.anchor}-title`}>
												{section.title}
											</h2>
											<SectionBody section={section} />
										</section>
									))}
								</div>
							</div>
						);
					return <Row key={first.key} section={first} />;
				})}
			</main>
			<Footer year={year} creditUrl={creditUrl} />
			{works.map((work, index) => (
				<WorkDetail
					key={work.id}
					work={work}
					previous={works[(index - 1 + works.length) % works.length] as PortfolioViewWork}
					next={works[(index + 1) % works.length] as PortfolioViewWork}
					total={works.length}
				/>
			))}
			{works.some((work) => work.blocks.some((block) => block.type === "images")) && <Lightbox />}
		</div>
	);
}
