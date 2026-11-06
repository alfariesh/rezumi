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

function Navigation() {
	const { view, messages } = useRender();
	const links = navSections(view.sections);
	const items = links.map((section) => (
		<li key={section.key}>
			<a href={`#${section.anchor}`}>{section.title}</a>
		</li>
	));
	return (
		<header className="pf-wrap lg-top">
			<nav className="pf-nav" aria-label={messages.pageNavigation}>
				<a className="pf-nav__brand lg-brand" href="#main">
					<span className="lg-mono" aria-hidden="true">
						{view.basics.initials}
					</span>
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

function Hero() {
	const { view, messages, imageUrl } = useRender();
	const { hero, basics } = view;
	const variant = themeVariant("lugas", "hero", view.design.variants.hero);
	const location = view.location?.label || basics.location;
	const background = hero.background.image ? imageUrl(hero.background.image.src) : undefined;
	const bg = hero.background.kind === "image" && !background ? "plain" : hero.background.kind;
	return (
		<section
			className="lg-hero"
			aria-label={messages.intro}
			data-variant={hero.picture ? variant : "no-photo"}
			data-bg={bg}
			{...(bg === "image" && background
				? { style: vars({ "--pf-hero-image": `url("${encodeURI(background).replaceAll('"', "%22")}")` }) }
				: {})}
		>
			{hero.picture && <Picture image={hero.picture} className="lg-photo" eager sizes="120px" />}
			<div className="lg-hero__text">
				<HeroName className="lg-name" />
				<HeroHeadline className="lg-headline" />
			</div>
			{hero.greeting && <p className="lg-greeting">{hero.greeting}</p>}
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
	const variant = themeVariant("lugas", "work", view.design.variants.work);
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

type SectionProps = { section: PortfolioViewSection };

function SectionBody({ section }: SectionProps): ReactNode {
	const { view } = useRender();
	const variant = (key: Parameters<typeof themeVariant>[1]) => themeVariant("lugas", key, view.design.variants[key]);
	switch (section.kind) {
		case "about":
			return <Prose html={section.html} className="lg-lead" />;
		case "work":
			return <WorkList works={section.works} />;
		case "services":
			return (
				<ul className="lg-services" data-variant={variant("services")}>
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
				<ul className="lg-quotes" data-variant={variant("testimonials")}>
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
					{section.image && <Picture image={section.image} className="lg-custom__image" />}
					<Prose html={section.html} />
					{section.button && <Buttons links={[section.button]} />}
				</>
			);
		case "contact":
			return <Contact section={section} ctaClassName="lg-cta" />;
		default:
			return <ExtraList kind={section.kind} items={section.items as ResumeItem[]} />;
	}
}

type LugasPageProps = { year: number; creditUrl: string };

/** Lugas (`01-desain.md` section 5): intro, then every shown section in order, footer, and the works' details. */
export function LugasPage({ year, creditUrl }: LugasPageProps) {
	const { view, messages } = useRender();
	const works = view.works;
	return (
		<div className="pf" data-theme="lugas">
			<a className="pf-skip" href="#main">
				{messages.skipToContent}
			</a>
			<Navigation />
			<main className="pf-wrap lg-main" id="main" tabIndex={-1}>
				<Hero />
				{groupSections(view.sections).map((group) => {
					const first = group[0] as PortfolioViewSection;
					if (group.length > 1 || EXTRA_KINDS.has(first.kind))
						return (
							<div key={first.key} className="lg-sec pf-extras">
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
						);
					return (
						<section
							key={first.key}
							className={`pf-section lg-sec${first.kind === "custom" ? " lg-custom" : ""}`}
							id={first.anchor}
							aria-labelledby={`${first.anchor}-title`}
						>
							<SectionTitle section={first} />
							<SectionBody section={first} />
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
