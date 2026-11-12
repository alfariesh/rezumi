import type { PortfolioViewLocation, PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ContactSection, ProfileLink, ProfilesSection } from "./data";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { fillPortfolioMessage } from "../../messages";
import { useRender } from "../../shared/context";
import { HeroHeadline, HeroName } from "../../shared/hero-text";
import { UiIcon } from "../../shared/icons";
import { IntroChips, OpenToWork, introLocation, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { ServiceList, TestimonialList } from "../../shared/offers";
import {
	Buttons,
	Clients,
	Contact,
	CustomSectionBody,
	ExtraSection,
	headingId,
	hostOf,
	linkAttributes,
	Picture,
	Prose,
	Section,
	SectionTitle,
	vars,
} from "../../shared/parts";
import { isResumeSection, ResumeSectionBody } from "../../shared/resume";
import { Navigation, PageShell } from "../../shared/shell";
import {
	blocksOf,
	contactOf,
	displayUrl,
	hasContactBody,
	locationTileOf,
	moreLink,
	navigationSections,
	profileLinks,
	sectionsBelowIntro,
} from "./data";
import { bentoAreas, workSpans } from "./layout";

type VariantKey = Parameters<typeof themeVariant>[1];
type AboutSection = Extract<PortfolioViewSection, { kind: "about" }>;

function useVariant() {
	const { view } = useRender();
	return <K extends VariantKey>(key: K) => themeVariant("mozaik", key, view.design.variants[key]);
}

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

type BentoProps = {
	about: AboutSection | undefined;
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
	const { view, messages } = useRender();
	const { hero } = view;
	const background = useIntroBackground();
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
	const linksTitleId = profiles ? headingId(profiles.anchor) : "mz-links-title";
	return (
		<section
			className="mz-bento"
			aria-label={messages.intro}
			style={vars({ "--mz-areas": layout.wide, "--mz-areas-tablet": layout.tablet, "--mz-areas-phone": layout.phone })}
		>
			<div className="mz-tile mz-intro" {...background}>
				<IntroChips location={location ? "" : introLocation(view)} availability={hero.availability} availabilityFirst />
				<OpenToWork />
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
				<Section section={about} className="mz-tile mz-about pf-section" titleClassName="mz-tile__title">
					<Prose html={about.html} />
				</Section>
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
					<ul className="mz-links__list">
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

type LocationTileProps = { contact: ContactSection; location: PortfolioViewLocation; anchored: boolean };

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
		<Section section={contact} className="mz-tile mz-loc pf-section" titleClassName="sr-only">
			{card}
		</Section>
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
						<a className="mz-card" href={work.href}>
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
					<a href={work.href}>
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
						<b>{fillPortfolioMessage(messages.moreOn, { site: more.network || hostOf(more.href) })}</b>
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

type TileSectionProps = { section: PortfolioViewSection; className?: string; attributes?: Record<string, string> };

/** A section drawn as one tile, its heading inside. */
function TileSection({ section, className, attributes }: TileSectionProps) {
	return (
		<Section
			section={section}
			className={["mz-tile pf-section", className].filter(Boolean).join(" ")}
			titleClassName="mz-tile__title"
			{...(attributes ? { attributes } : {})}
		>
			<TileBody section={section} />
		</Section>
	);
}

type BodyProps = { section: PortfolioViewSection };

/** What goes inside a tile section: CV lists, skills, short lists, testimonials and clients. */
function TileBody({ section }: BodyProps): ReactNode {
	const variant = useVariant();
	switch (section.kind) {
		case "testimonials":
			return (
				<TestimonialList
					section={section}
					className="mz-quotes"
					variant={variant("testimonials")}
					footClassName="mz-quote__foot"
				/>
			);
		case "clients":
			return <Clients section={section} variant={variant("clients")} />;
		default:
			return isResumeSection(section) ? <ResumeSectionBody section={section} /> : null;
	}
}

type CvBlockProps = { tiles: PortfolioViewSection[]; extras: PortfolioViewSection[] };

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
						<ExtraSection key={section.key} section={section}>
							<TileBody section={section} />
						</ExtraSection>
					))}
				</div>
			)}
		</div>
	);
}

type SingleProps = { section: PortfolioViewSection; more: ProfileLink | undefined };

/** A section on its own: works, services and free sections with their title above, contact as a call-to-action tile. */
function Single({ section, more }: SingleProps): ReactNode {
	const variant = useVariant();
	const titled = (className: string, body: ReactNode) => (
		<Section section={section} className={`pf-section mz-sec ${className}`} titleClassName="mz-title">
			{body}
		</Section>
	);
	switch (section.kind) {
		case "work":
			return titled("mz-work-sec", <Works works={section.works} more={more} />);
		case "services": {
			const services = variant("services");
			return titled(
				"mz-services-sec",
				<ServiceList
					section={section}
					className="mz-services"
					variant={services}
					classNames={{ item: "pf-service mz-service", head: "mz-service__head" }}
					foot={{ className: "mz-service__foot", price: services === "cards" }}
				/>,
			);
		}
		case "custom":
			return titled(
				"mz-custom",
				<div className="mz-tile mz-custom__body">
					<CustomSectionBody section={section} imageClassName="mz-custom__image" />
				</div>,
			);
		case "contact":
			return (
				<section className="pf-section mz-contact" id={section.anchor} aria-labelledby={headingId(section.anchor)}>
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
	const about = view.sections.find((section): section is AboutSection => section.kind === "about");
	const profiles = view.sections.find((section): section is ProfilesSection => section.kind === "profiles");
	const contact = contactOf(view);
	const contactBody = hasContactBody(contact);
	const locationIsContact = !contactBody && Boolean(locationTileOf(contact));
	const links = profileLinks(view, profiles, messages.website);
	const more = moreLink(links);
	return (
		<PageShell
			theme="mozaik"
			navigation={
				<Navigation
					className="pf-wrap mz-top"
					brandClassName="mz-brand"
					brandMark={<span className="mz-dot" aria-hidden="true" />}
					sections={navigationSections(view.sections, { contactBody, locationIsContact, links: links.length })}
					message={contact && contactBody ? { anchor: contact.anchor } : null}
				/>
			}
			mainClassName="mz-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Bento about={about} contact={contact} locationIsContact={locationIsContact} links={links} profiles={profiles} />
			{blocksOf(sectionsBelowIntro(view.sections, contactBody)).map((block) => {
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
		</PageShell>
	);
}
