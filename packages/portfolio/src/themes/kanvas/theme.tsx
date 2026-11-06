import type { ResumeItem } from "../../shared/parts";
import type { PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { effectTarget, HeroHeadline, HeroName } from "../../shared/hero-text";
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
import { groupSections, initials, navSections } from "../../shared/sections";

type VariantKey = Parameters<typeof themeVariant>[1];

function Navigation() {
	const { view, messages } = useRender();
	const links = navSections(view.sections);
	const items = links.map((section) => (
		<li key={section.key}>
			<a href={`#${section.anchor}`}>{section.title}</a>
		</li>
	));
	return (
		<header className="pf-wrap kv-top">
			<nav className="pf-nav" aria-label={messages.pageNavigation}>
				<a className="pf-nav__brand kv-brand" href="#main">
					<span>{view.basics.name}</span>
				</a>
				{links.length > 0 && (
					<>
						<ul className="pf-nav__links">{items}</ul>
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
		</header>
	);
}

/**
 * The "big name" intro: the name across the page, then under a thin rule three columns (photo and headline, greeting,
 * chips and buttons), then the achievements as big numbers.
 */
function Hero() {
	const { view, messages, imageUrl } = useRender();
	const { hero, basics } = view;
	const location = view.location?.label || basics.location;
	const background = hero.background.image ? imageUrl(hero.background.image.src) : undefined;
	const bg = hero.background.kind === "image" && !background ? "plain" : hero.background.kind;
	const typing = view.design.effect.id === "typewriter" && effectTarget(view) === "headline";
	const who = Boolean(hero.picture || basics.headline || typing);
	const side = Boolean(location || hero.availability || hero.buttons.length);
	return (
		<section
			className="kv-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? "big-name" : "no-photo"}
			data-bg={bg}
			{...(bg === "image" && background
				? { style: vars({ "--pf-hero-image": `url("${encodeURI(background).replaceAll('"', "%22")}")` }) }
				: {})}
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

type SectionProps = { section: PortfolioViewSection };

function SectionBody({ section }: SectionProps): ReactNode {
	const { view } = useRender();
	const variant = (key: VariantKey) => themeVariant("kanvas", key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className="kv-lead" />;
		case "work":
			return <WorkGrid works={section.works} first={false} />;
		case "services":
			return (
				<ul className="kv-services" data-variant={variant("services")}>
					{section.services.map((service) => (
						<li key={service.id} className="pf-service">
							<div className="pf-service__head">
								<h3>
									<ResumeIcon name={service.icon} />
									{service.title}
								</h3>
								{service.price && <span className="pf-service__price">{service.price}</span>}
							</div>
							{service.description && <p className="pf-service__desc">{service.description}</p>}
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
				<ul className="kv-quotes" data-variant={variant("testimonials")}>
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
				<div className="kv-custom">
					{section.image && <Picture image={section.image} className="kv-custom__image" />}
					<Prose html={section.html} className="kv-lead" />
					{section.button && <Buttons links={[section.button]} />}
				</div>
			);
		case "contact":
			return (
				<div className="kv-contact">
					<Contact section={section} ctaClassName="kv-cta" />
				</div>
			);
		default:
			return (
				<div className="pf-extra">
					<ExtraList kind={section.kind} items={section.items as ResumeItem[]} />
				</div>
			);
	}
}

/** The work section: the grid right after the intro, its heading for screen readers only (shown when it isn't first). */
function WorkSection({ section, first }: SectionProps & { first: boolean }) {
	if (section.kind !== "work") return null;
	return (
		<section className="pf-section kv-work" id={section.anchor} aria-labelledby={`${section.anchor}-title`}>
			<SectionTitle section={section} className="kv-label" />
			<WorkGrid works={section.works} first={first} />
		</section>
	);
}

type KanvasPageProps = { year: number; creditUrl: string };

/**
 * Kanvas (`01-desain.md` section 5): dark by default, 1400 px wide, pictures as the content. The big-name intro, every
 * shown section in order (work as a picture grid, the rest as label | content rows), footer, and the works' details
 * as full screens.
 */
export function KanvasPage({ year, creditUrl }: KanvasPageProps) {
	const { view, messages } = useRender();
	const works = view.works;
	const pair = view.design.fonts.pair;
	return (
		<div className="pf" data-theme="kanvas" {...(pair ? { "data-font-pair": pair } : {})}>
			<a className="pf-skip" href="#main">
				{messages.skipToContent}
			</a>
			<Navigation />
			<main className="pf-wrap kv-main" id="main" tabIndex={-1}>
				<Hero />
				{groupSections(view.sections).map((group, index) => {
					const first = group[0] as PortfolioViewSection;
					if (first.kind === "work") return <WorkSection key={first.key} section={first} first={index === 0} />;
					// Short lists that follow each other share one row: a joined label, then each list with its own heading.
					if (group.length > 1)
						return (
							<div key={first.key} className="kv-sec kv-group">
								<p className="kv-label" aria-hidden="true">
									{group.map((section) => section.title).join(" · ")}
								</p>
								<div className="kv-sec__body kv-extras">
									{group.map((section) => (
										<section
											key={section.key}
											className="pf-section"
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
					return (
						<section
							key={first.key}
							className={`pf-section kv-sec kv-sec--${first.kind}`}
							id={first.anchor}
							aria-labelledby={`${first.anchor}-title`}
						>
							<SectionTitle section={first} className="kv-label" />
							<div className="kv-sec__body">
								<SectionBody section={first} />
							</div>
						</section>
					);
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
