import type { ResumeItem } from "../../shared/parts";
import type { PortfolioView, PortfolioViewSection, PortfolioViewWork } from "../../view";
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
import { EXTRA_KINDS, initials, navSections } from "../../shared/sections";
import { bentoAreas, workSpans } from "./layout";

type Section = PortfolioViewSection;
type ContactSection = Extract<Section, { kind: "contact" }>;
type ProfilesSection = Extract<Section, { kind: "profiles" }>;
type VariantKey = Parameters<typeof themeVariant>[1];

/** Sections Mozaik lays out as tiles of one block: CV lists beside each other, short lists in one wide tile. */
const CV_KINDS: ReadonlySet<string> = new Set(["experience", "education", "skills", "volunteer", ...EXTRA_KINDS]);
const PAIR_KINDS: ReadonlySet<string> = new Set(["testimonials", "clients"]);
/** Sites people show work on, preferred for the works' closing "More on …" tile. */
const SHOWCASE =
	/behance|dribbble|github|gitlab|artstation|deviantart|codepen|figma|youtube|vimeo|instagram|tiktok|medium|substack|kaggle|huggingface|flickr|500px|unsplash|pinterest|cara\.app|read\.cv/i;

function useVariant() {
	const { view } = useRender();
	return <K extends VariantKey>(key: K) => themeVariant("mozaik", key, view.design.variants[key]);
}

/** The contact section, when the page shows it. */
function contactOf(view: PortfolioView): ContactSection | undefined {
	return view.sections.find((section): section is ContactSection => section.kind === "contact");
}

/**
 * The location card the intro shows as a tile: the contact section's, when it says more than the place's name (a map,
 * work modes, relocation or local time). A name alone reads better as the intro's location chip.
 */
function locationTileOf(section: ContactSection | undefined) {
	const location = section?.contact.location;
	if (!location) return null;
	return location.map || location.workModes.length || location.relocate || location.showLocalTime ? location : null;
}

/** Whether the contact section has anything left once its location card moves into the intro. */
function hasContactBody(section: ContactSection | undefined): boolean {
	if (!section) return false;
	const { contact } = section;
	return Boolean(
		contact.note ||
		contact.email ||
		contact.whatsapp ||
		contact.phone ||
		contact.website ||
		contact.profiles.some((profile) => profile.href),
	);
}

type ProfileLink = { key: string; label: string; network: string; href: string | null };

/**
 * The person's profile links for the intro's links tile and the works' "More on …" tile: the profiles (from the
 * contact section, and from the Profiles section when it is shown) and the website, without repeats.
 */
function profileLinks(view: PortfolioView, profiles: ProfilesSection | undefined, websiteLabel: string): ProfileLink[] {
	const links: ProfileLink[] = [];
	const seen = new Set<string>();
	const add = (link: ProfileLink) => {
		const key = link.href ?? `${link.network}:${link.label}`;
		if (seen.has(key) || !link.label) return;
		seen.add(key);
		links.push(link);
	};
	const contact = contactOf(view)?.contact;
	for (const profile of contact?.profiles ?? [])
		add({
			key: profile.id,
			label: profile.network || profile.username || (profile.href ? hostOf(profile.href) : ""),
			network: profile.network,
			href: profile.href,
		});
	for (const item of profiles?.items ?? []) {
		const href = item.website.url.trim() || null;
		const network = item.network.trim();
		add({
			key: item.id,
			label: network || item.username.trim() || (href ? hostOf(href) : ""),
			network,
			href,
		});
	}
	if (contact?.website) add({ key: "website", label: websiteLabel, network: "", href: contact.website.href });
	return links;
}

/** A link as people read it: `behance.net/citra`. */
const displayUrl = (href: string) => href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

/** The arrow of an outgoing link, ↗ (mirrored on right-to-left pages). */
function ArrowUpRight() {
	return (
		<svg
			className="pf-icon pf-flip"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M7 17 17 7M9 7h8v8" />
		</svg>
	);
}

type NavigationProps = { sections: readonly Section[]; messageButton: boolean };

function Navigation({ sections, messageButton }: NavigationProps) {
	const { view, messages } = useRender();
	const links = navSections(sections);
	const items = links.map((section) => (
		<li key={section.key}>
			<a href={`#${section.anchor}`}>{section.title}</a>
		</li>
	));
	return (
		<header className="pf-wrap mz-top">
			<nav className="pf-nav" aria-label={messages.pageNavigation}>
				<a className="pf-nav__brand mz-brand" href="#main">
					<span className="mz-dot" aria-hidden="true" />
					<span>{view.basics.name}</span>
				</a>
				{links.length > 0 && (
					<>
						<ul className="pf-nav__links">
							{items}
							{messageButton && (
								<li>
									<a className="pf-btn pf-btn--primary" href="#contact">
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
		</header>
	);
}

type BentoProps = {
	about: Extract<Section, { kind: "about" }> | undefined;
	contact: ContactSection | undefined;
	/** The location tile carries the contact anchor when the contact section has nothing else to show. */
	locationIsContact: boolean;
	links: ProfileLink[];
	profiles: ProfilesSection | undefined;
};

/**
 * The intro as a bento (`01-desain.md` section 5): the intro tile, photo, one or two stat tiles, About, the location
 * card and the profile links. Its grid areas come from the tiles there are (`bentoAreas`), so it always closes.
 */
function Bento({ about, contact, locationIsContact, links, profiles }: BentoProps) {
	const { view, messages, imageUrl } = useRender();
	const { hero, basics } = view;
	const location = locationTileOf(contact);
	const [first, ...rest] = hero.highlights;
	const stats = first ? (rest.length ? 2 : 1) : 0;
	const layout = bentoAreas({
		photo: Boolean(hero.picture),
		stats,
		about: Boolean(about),
		location: Boolean(location),
		links: links.length > 0,
	});
	const chipLocation = location ? "" : view.location?.label || basics.location;
	const background = hero.background.image ? imageUrl(hero.background.image.src) : undefined;
	const bg = hero.background.kind === "image" && !background ? "plain" : hero.background.kind;
	const linksTitleId = profiles ? `${profiles.anchor}-title` : "mz-links-title";
	return (
		<section
			className="mz-bento"
			aria-label={messages.intro}
			style={vars({ "--mz-areas": layout.wide, "--mz-areas-tablet": layout.tablet, "--mz-areas-phone": layout.phone })}
		>
			<div
				className="mz-tile mz-intro"
				data-bg={bg}
				{...(bg === "image" && background
					? { style: vars({ "--pf-hero-image": `url("${encodeURI(background).replaceAll('"', "%22")}")` }) }
					: {})}
			>
				{(hero.availability || chipLocation) && (
					<ul className="pf-chips">
						{hero.availability && <li className="pf-chip pf-chip--open">{hero.availability}</li>}
						{chipLocation && (
							<li className="pf-chip">
								<UiIcon name="pin" />
								{chipLocation}
							</li>
						)}
					</ul>
				)}
				<HeroName className="mz-name" />
				<HeroHeadline className="mz-headline" />
				{hero.greeting && <p className="mz-greeting">{hero.greeting}</p>}
				<Buttons links={hero.buttons} />
			</div>
			{hero.picture && (
				<div className="mz-tile mz-photo" {...(stats ? {} : { "data-wide": "" })}>
					<Picture image={hero.picture} eager sizes="(min-width: 900px) 300px, 50vw" />
				</div>
			)}
			{first && (
				<div className="mz-tile mz-stat mz-s1">
					<MetricGroup metrics={[first]} variant="big" compact />
				</div>
			)}
			{rest.length > 0 && (
				<div className="mz-tile mz-stat mz-s2" data-count={rest.length}>
					<MetricGroup metrics={rest} variant="big" compact />
				</div>
			)}
			{about && (
				<section className="mz-tile mz-about pf-section" id={about.anchor} aria-labelledby={`${about.anchor}-title`}>
					<SectionTitle section={about} className="mz-tile__title" />
					<Prose html={about.html} />
				</section>
			)}
			{contact && location && <LocationTile contact={contact} location={location} anchored={locationIsContact} />}
			{links.length > 0 && (
				<section
					className="mz-tile mz-links pf-section"
					{...(profiles ? { id: profiles.anchor } : {})}
					aria-labelledby={linksTitleId}
				>
					<h2 className="pf-section__title mz-tile__title" id={linksTitleId}>
						{profiles?.title ?? messages.profiles}
					</h2>
					<ul>
						{links.map((link) => (
							<li key={link.key}>
								{link.href ? (
									<a className="mz-link" {...linkAttributes(link.href, { me: true })}>
										<span>{link.label}</span>
										<ArrowUpRight />
									</a>
								) : (
									<span className="mz-link">
										<span>{link.label}</span>
									</span>
								)}
							</li>
						))}
					</ul>
				</section>
			)}
		</section>
	);
}

type LocationTileProps = {
	contact: ContactSection;
	location: NonNullable<ContactSection["contact"]["location"]>;
	anchored: boolean;
};

/**
 * The contact section's location card as an intro tile (`01-desain.md` section 19 lets Mozaik move it). The shared
 * contact part draws it from a contact with nothing but the location.
 */
function LocationTile({ contact, location, anchored }: LocationTileProps) {
	const card = (
		<Contact
			section={{
				...contact,
				contact: {
					...contact.contact,
					note: "",
					email: null,
					phone: null,
					website: null,
					whatsapp: null,
					profiles: [],
					form: false,
					location,
				},
			}}
		/>
	);
	if (!anchored) return <div className="mz-tile mz-loc">{card}</div>;
	return (
		<section className="mz-tile mz-loc pf-section" id={contact.anchor} aria-labelledby={`${contact.anchor}-title`}>
			<SectionTitle section={contact} className="sr-only" />
			{card}
		</section>
	);
}

type WorksProps = { works: readonly PortfolioViewWork[]; more: ProfileLink | undefined };

/**
 * Works as a bento (default) or a grid of two. The bento's first work is 2 × 2, the sixth 2 × 1, and a "More on …" tile
 * to the main profile closes it; `workSpans` widens tiles so any count closes without holes.
 */
function Works({ works, more }: WorksProps) {
	const { messages } = useRender();
	const variant = useVariant()("work");
	if (variant === "grid-2")
		return (
			<ul className="mz-works" data-variant="grid-2">
				{works.map((work) => (
					<li key={work.id} className="mz-work" {...(work.cover ? {} : { "data-noimg": "" })}>
						<a className="mz-card" href={`#${work.anchor}`}>
							{work.cover && (
								<div className="pf-cover">
									<Picture
										image={work.cover}
										decorative
										sizes="(min-width: 900px) 600px, (min-width: 560px) 50vw, 100vw"
									/>
								</div>
							)}
							<span className="mz-card__body">
								<span className="mz-work__title">{work.title}</span>
								{work.summary && <span className="mz-card__summary">{work.summary}</span>}
								{(work.role || work.date || work.highlight) && (
									<span className="mz-card__meta">
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
	const spans = workSpans(works.length + (more ? 1 : 0), (index) => index === 5 || index === works.length);
	const style = (index: number) => {
		const span = spans[index];
		return span
			? vars({ "--c": span.wide.columns, "--r": span.wide.rows, "--ct": span.tablet.columns, "--rt": span.tablet.rows })
			: undefined;
	};
	return (
		<ul className="mz-works" data-variant="bento">
			{works.map((work, index) => (
				<li key={work.id} className="mz-work" style={style(index)} {...(work.cover ? {} : { "data-noimg": "" })}>
					<a href={`#${work.anchor}`}>
						{work.cover && (
							<div className="pf-cover mz-work__img">
								<Picture
									image={work.cover}
									decorative
									sizes={
										index === 0
											? "(min-width: 900px) 600px, 100vw"
											: "(min-width: 900px) 300px, (min-width: 560px) 50vw, 100vw"
									}
								/>
							</div>
						)}
						{!work.cover && work.summary && <span className="mz-work__summary">{work.summary}</span>}
						<span className="mz-work__cap">
							<span className="mz-work__title">{work.title}</span>
							{work.highlight && <WorkMetric metric={work.highlight} />}
						</span>
					</a>
				</li>
			))}
			{more?.href && (
				<li className="mz-more" style={style(works.length)}>
					<a {...linkAttributes(more.href, { me: true })}>
						<b>{messages.moreOn.replace("{site}", more.network || hostOf(more.href))}</b>
						<span>
							{displayUrl(more.href)}
							<UiIcon name="arrow-right" flip />
						</span>
					</a>
				</li>
			)}
		</ul>
	);
}

type ServicesProps = { section: Extract<Section, { kind: "services" }> };

function Services({ section }: ServicesProps) {
	const variant = useVariant()("services");
	return (
		<ul className="mz-services" data-variant={variant}>
			{section.services.map((service) => (
				<li key={service.id} className="pf-service mz-service">
					<div className="mz-service__head">
						<h3>
							<ResumeIcon name={service.icon} />
							{service.title}
						</h3>
						{variant === "list" && service.price && <span className="pf-service__price">{service.price}</span>}
					</div>
					{service.description && <p>{service.description}</p>}
					{((variant === "cards" && service.price) || service.cta) && (
						<div className="mz-service__foot">
							{variant === "cards" && service.price && <span className="pf-service__price">{service.price}</span>}
							{service.cta && (
								<a className="pf-service__cta" {...linkAttributes(service.cta.href, service.cta)}>
									{service.cta.label}
									<UiIcon name="arrow-right" flip />
								</a>
							)}
						</div>
					)}
				</li>
			))}
		</ul>
	);
}

type TestimonialsProps = { section: Extract<Section, { kind: "testimonials" }> };

function Testimonials({ section }: TestimonialsProps) {
	const variant = useVariant()("testimonials");
	return (
		<ul className="mz-quotes" data-variant={variant}>
			{section.testimonials.map((testimonial) => (
				<li key={testimonial.id} className="pf-quote">
					<blockquote>{testimonial.quote}</blockquote>
					<div className="mz-quote__foot">
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
					</div>
				</li>
			))}
		</ul>
	);
}

type TileSectionProps = { section: Section; className?: string; attributes?: Record<string, string> };

/** A section drawn as one tile, its heading inside. */
function TileSection({ section, className, attributes }: TileSectionProps) {
	return (
		<section
			className={["mz-tile pf-section", className].filter(Boolean).join(" ")}
			id={section.anchor}
			aria-labelledby={`${section.anchor}-title`}
			{...attributes}
		>
			<SectionTitle section={section} className="mz-tile__title" />
			<TileBody section={section} />
		</section>
	);
}

type BodyProps = { section: Section };

/** What goes inside a tile section: CV lists, skills, short lists, testimonials and clients. */
function TileBody({ section }: BodyProps): ReactNode {
	const variant = useVariant();
	switch (section.kind) {
		case "testimonials":
			return <Testimonials section={section} />;
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
		default:
			return "items" in section ? <ExtraList kind={section.kind} items={section.items as ResumeItem[]} /> : null;
	}
}

type Block =
	| { type: "single"; section: Section }
	| { type: "pair"; sections: Section[] }
	| { type: "cv"; tiles: Section[]; extras: Section[] };

/**
 * The sections below the intro as Mozaik's blocks: testimonials beside clients, CV sections as one bento of tiles
 * (short lists gathered in one wide tile at its end), everything else on its own.
 */
function blocksOf(sections: readonly Section[]): Block[] {
	const blocks: Block[] = [];
	for (const section of sections) {
		const last = blocks.at(-1);
		if (PAIR_KINDS.has(section.kind)) {
			if (last?.type === "pair" && last.sections.length === 1 && last.sections[0]?.kind !== section.kind)
				last.sections.push(section);
			else blocks.push({ type: "pair", sections: [section] });
		} else if (CV_KINDS.has(section.kind)) {
			const block: Extract<Block, { type: "cv" }> = last?.type === "cv" ? last : { type: "cv", tiles: [], extras: [] };
			if (block !== last) blocks.push(block);
			(EXTRA_KINDS.has(section.kind) ? block.extras : block.tiles).push(section);
		} else blocks.push({ type: "single", section });
	}
	return blocks;
}

type CvBlockProps = { tiles: Section[]; extras: Section[] };

/**
 * CV sections as tiles in two columns (one under 900 px): with an odd number of tiles the first one is tall beside the
 * next two (experience beside skills and education by default), a lone tile spans both columns, and the short lists
 * share one wide tile at the end, each with its own anchor and heading.
 */
function CvBlock({ tiles, extras }: CvBlockProps) {
	const tall = tiles.length >= 3 && tiles.length % 2 === 1;
	return (
		<div className="mz-cv">
			{tiles.map((section, index) => {
				const shape = tiles.length === 1 ? "wide" : index === 0 && tall ? "tall" : undefined;
				return (
					<TileSection
						key={section.key}
						section={section}
						{...(shape ? { attributes: { "data-shape": shape } } : {})}
					/>
				);
			})}
			{extras.length > 0 && (
				<div className="mz-tile mz-extras">
					{extras.map((section) => (
						<section
							key={section.key}
							className="pf-section pf-extra"
							id={section.anchor}
							aria-labelledby={`${section.anchor}-title`}
						>
							<h2 className="pf-extra__title" id={`${section.anchor}-title`}>
								{section.title}
							</h2>
							<TileBody section={section} />
						</section>
					))}
				</div>
			)}
		</div>
	);
}

type SingleProps = { section: Section; more: ProfileLink | undefined };

/** A section on its own: works, services and free sections with their title above, contact as a call-to-action tile. */
function Single({ section, more }: SingleProps): ReactNode {
	const titled = (className: string, body: ReactNode) => (
		<section
			className={`pf-section mz-sec ${className}`}
			id={section.anchor}
			aria-labelledby={`${section.anchor}-title`}
		>
			<SectionTitle section={section} className="mz-title" />
			{body}
		</section>
	);
	switch (section.kind) {
		case "work":
			return titled("mz-work-sec", <Works works={section.works} more={more} />);
		case "services":
			return titled("mz-services-sec", <Services section={section} />);
		case "custom":
			return titled(
				"mz-custom",
				<div className="mz-tile mz-custom__body">
					{section.image && <Picture image={section.image} className="mz-custom__image" />}
					<Prose html={section.html} />
					{section.button && <Buttons links={[section.button]} />}
				</div>,
			);
		case "contact":
			return (
				<section className="pf-section mz-contact" id={section.anchor} aria-labelledby={`${section.anchor}-title`}>
					<div className="mz-tile mz-contact__main" {...(section.contact.note ? { "data-note": "" } : {})}>
						<SectionTitle section={section} className="mz-title" />
						<Contact section={{ ...section, contact: { ...section.contact, location: null } }} ctaClassName="mz-cta" />
					</div>
				</section>
			);
		default:
			return <TileSection section={section} className="mz-wide" />;
	}
}

type MozaikPageProps = { year: number; creditUrl: string };

/**
 * Mozaik (`01-desain.md` section 5): white tiles on a green-grey page. The intro is a bento that also holds About, the
 * location card and the profile links (so those don't repeat below), then works as a bento and the other sections as
 * tiles, footer, and the works' details.
 */
export function MozaikPage({ year, creditUrl }: MozaikPageProps) {
	const { view, messages } = useRender();
	const works = view.works;
	const about = view.sections.find(
		(section): section is Extract<Section, { kind: "about" }> => section.kind === "about",
	);
	const profiles = view.sections.find((section): section is ProfilesSection => section.kind === "profiles");
	const contact = contactOf(view);
	const contactBody = hasContactBody(contact);
	const locationIsContact = !contactBody && Boolean(locationTileOf(contact));
	const links = profileLinks(view, profiles, messages.website);
	const linked = links.filter((link) => link.href);
	const more =
		linked.find((link) => SHOWCASE.test(`${link.network} ${link.href}`)) ??
		linked.find((link) => link.key === "website") ??
		linked[0];
	// About, the profiles and the location card live in the intro; a contact section with nothing else is left out.
	const rest = view.sections.filter(
		(section) =>
			section.kind !== "about" && section.kind !== "profiles" && !(section.kind === "contact" && !contactBody),
	);
	return (
		<div className="pf" data-theme="mozaik">
			<a className="pf-skip" href="#main">
				{messages.skipToContent}
			</a>
			<Navigation
				sections={view.sections.filter(
					(section) =>
						(section.kind !== "contact" || contactBody || locationIsContact) &&
						(section.kind !== "profiles" || links.length > 0),
				)}
				messageButton={contactBody}
			/>
			<main className="pf-wrap mz-main" id="main" tabIndex={-1}>
				<Bento
					about={about}
					contact={contact}
					locationIsContact={locationIsContact}
					links={links}
					profiles={profiles}
				/>
				{blocksOf(rest).map((block) => {
					if (block.type === "single") return <Single key={block.section.key} section={block.section} more={more} />;
					const key = (block.type === "pair" ? block.sections[0] : (block.tiles[0] ?? block.extras[0]))?.key;
					if (block.type === "cv") return <CvBlock key={key} tiles={block.tiles} extras={block.extras} />;
					return (
						<div key={key} className="mz-pair" data-first={block.sections[0]?.kind} data-count={block.sections.length}>
							{block.sections.map((section) => (
								<TileSection
									key={section.key}
									section={section}
									className={section.kind === "testimonials" ? "mz-quotes-tile" : "mz-clients-tile"}
								/>
							))}
						</div>
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
