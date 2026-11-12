import type { PortfolioView, PortfolioViewLink, PortfolioViewSection } from "../view";
import type { UiIconName } from "./icons";
import type { ReactNode } from "react";
import { PORTFOLIO_MAP_ZOOM } from "@rezumi/schema/portfolio/data";
import { fillPortfolioMessage } from "../messages";
import { renderPortfolioHtml } from "../rich-text";
import { htmlToText } from "../text";
import { useRender } from "./context";
import { RezumiMark, ResumeIcon, UiIcon } from "./icons";
import { MessageForm } from "./message-form";
import { headingId, hostOf, linkAttributes, Picture, vars } from "./primitives";

export { headingId, hostOf, linkAttributes, Picture, vars };

const BUTTON_ICONS: Partial<Record<NonNullable<PortfolioViewLink["kind"]>, UiIconName>> = {
	resume: "resume",
	pdf: "pdf",
	contact: "mail",
	email: "mail",
	whatsapp: "whatsapp",
	link: "link",
	profile: "link",
	vcard: "user-plus",
};

type ButtonProps = { link: PortfolioViewLink; primary?: boolean; icon?: UiIconName };

export function Button({ link, primary, icon }: ButtonProps) {
	const name = icon ?? (link.kind ? BUTTON_ICONS[link.kind] : undefined);
	return (
		<a
			className={`pf-btn ${primary ? "pf-btn--primary" : "pf-btn--secondary"}`}
			{...(link.kind ? { "data-pf-event": link.kind === "profile" ? "link" : link.kind } : {})}
			{...linkAttributes(link.href, link)}
			// "Save contact" downloads the card; the editor's preview points it at `#contact` instead, which stays a link.
			{...(link.kind === "vcard" && !link.href.startsWith("#") ? { download: "" } : {})}
		>
			{name && <UiIcon name={name} />}
			{link.label}
		</a>
	);
}

type ButtonsProps = {
	links: readonly PortfolioViewLink[];
	/** None of them is the main action: something next to them already is. */
	quiet?: boolean;
};

/** 1–3 buttons; the first is the page's main action. */
export function Buttons({ links, quiet = false }: ButtonsProps) {
	if (!links.length) return null;
	return (
		<div className="pf-btns">
			{links.map((link, index) => (
				<Button key={`${link.href}-${index}`} link={link} primary={!quiet && index === 0} />
			))}
		</div>
	);
}

type ProseProps = {
	html: string;
	className?: string;
	/** The text sits right under the page's `h1` (a work's page), so its own H2 and H3 stay `h2` and `h3`. */
	topLevel?: boolean;
};

/**
 * Rich text's own headings, under the heading of the section or work they sit in: when the text uses H2, its H2 and
 * H3 become `h3` and `h4`; H3 alone stays `h3`. The cleaned text holds those tags without attributes.
 */
const demoteHeadings = (html: string) =>
	html.includes("<h2>")
		? html.replace(/<(\/?)h([23])>/g, (_tag, slash: string, level: string) => `<${slash}h${Number(level) + 1}>`)
		: html;

/** Rich text right under the page's `h1`: H2 and H3 stay as they are, and H3 alone becomes `h2`, so no level is skipped. */
const promoteHeadings = (html: string) =>
	html.includes("<h2>") ? html : html.replace(/<(\/?)h3>/g, (_tag, slash: string) => `<${slash}h2>`);

/** Rich text, cleaned once more at render (`02-teknis.md` section 15). */
export function Prose({ html, className, topLevel = false }: ProseProps) {
	const cleaned = renderPortfolioHtml(html);
	const clean = topLevel ? promoteHeadings(cleaned) : demoteHeadings(cleaned);
	if (!htmlToText(clean)) return null;
	return (
		<div
			className={["pf-prose", className].filter(Boolean).join(" ")}
			// oxlint-disable-next-line react/no-danger -- cleaned to the portfolio's tag subset just above.
			dangerouslySetInnerHTML={{ __html: clean }}
		/>
	);
}

type SectionTitleProps = { section: { anchor: string; title: string }; className?: string };

export function SectionTitle({ section, className }: SectionTitleProps) {
	return (
		<h2 className={["pf-section__title", className].filter(Boolean).join(" ")} id={headingId(section.anchor)}>
			{section.title}
		</h2>
	);
}

type SectionProps = {
	/** Its anchor and the title its heading shows. */
	section: { anchor: string; title: string };
	className: string;
	/** The heading's class besides `pf-section__title`. */
	titleClassName?: string;
	/** More attributes for the section element (Mozaik's tile shapes). */
	attributes?: Record<string, string>;
	children: ReactNode;
};

/** A section of the page: its anchor, named by its heading, then what the theme draws in it. */
export function Section({ section, className, titleClassName, attributes, children }: SectionProps) {
	return (
		<section className={className} id={section.anchor} aria-labelledby={headingId(section.anchor)} {...attributes}>
			<SectionTitle section={section} {...(titleClassName ? { className: titleClassName } : {})} />
			{children}
		</section>
	);
}

type ExtraSectionProps = {
	section: { anchor: string; title: string };
	/** Kanvas' rows leave out `pf-extra`. */
	className?: string;
	children: ReactNode;
};

/**
 * A short list that shares one block with the short lists beside it (`groupSections`): it keeps its own anchor and
 * names itself with a small heading.
 */
export function ExtraSection({ section, className = "pf-section pf-extra", children }: ExtraSectionProps) {
	return (
		<section className={className} id={section.anchor} aria-labelledby={headingId(section.anchor)}>
			<h2 className="pf-extra__title" id={headingId(section.anchor)}>
				{section.title}
			</h2>
			{children}
		</section>
	);
}

type CustomSectionBodyProps = {
	section: Extract<PortfolioViewSection, { kind: "custom" }>;
	imageClassName: string;
	proseClassName?: string;
};

/** One of the portfolio's own free sections: its picture, text and button. */
export function CustomSectionBody({ section, imageClassName, proseClassName }: CustomSectionBodyProps) {
	return (
		<>
			{section.image && <Picture image={section.image} className={imageClassName} />}
			<Prose html={section.html} {...(proseClassName ? { className: proseClassName } : {})} />
			{section.button && <Buttons links={[section.button]} />}
		</>
	);
}

/**
 * The full-screen picture viewer the page script fills from a gallery: one per work page that has one, hidden until a
 * gallery picture is opened. It stays a child of the page's root, after the footer: the page script makes the root's
 * other children inert while it's open. Escape, the arrow keys and swiping step through the gallery; closing returns focus to the picture.
 */
export function Lightbox() {
	const { messages } = useRender();
	return (
		<div className="pf-lightbox" role="dialog" aria-modal="true" aria-label={messages.pictureViewer} hidden>
			<figure className="pf-lightbox__stage">
				<img alt="" decoding="async" />
				<figcaption hidden />
			</figure>
			<p className="pf-lightbox__count" aria-live="polite" />
			<button type="button" className="pf-lightbox__btn pf-lightbox__close" data-lb="close" aria-label={messages.close}>
				<UiIcon name="close" />
			</button>
			<button
				type="button"
				className="pf-lightbox__btn pf-lightbox__prev"
				data-lb="prev"
				aria-label={messages.previous}
			>
				<UiIcon name="arrow-left" flip />
			</button>
			<button type="button" className="pf-lightbox__btn pf-lightbox__next" data-lb="next" aria-label={messages.next}>
				<UiIcon name="arrow-right" flip />
			</button>
		</div>
	);
}

type ContactSection = Extract<PortfolioViewSection, { kind: "contact" }>;

/**
 * An OpenStreetMap address centred on the location's point, at the zoom its precision allows. Only a city gets a
 * marker; a province or country is an area, centred on its middle. The view rounded the point to its precision, so
 * the address says no more than the person chose to show.
 */
function openStreetMapUrl(point: NonNullable<NonNullable<PortfolioView["location"]>["point"]>): string {
	const lat = String(point.lat);
	const lng = String(point.lng);
	const marker = point.precision === "city" ? `?mlat=${lat}&mlon=${lng}` : "";
	return `https://www.openstreetmap.org/${marker}#map=${PORTFOLIO_MAP_ZOOM[point.precision]}/${lat}/${lng}`;
}

type LocationMapProps = { location: NonNullable<PortfolioView["location"]> };

/**
 * The map picture the editor saved (`02-teknis.md` section 24): the light or dark copy by the page's mode (both, chosen
 * by the device, in auto mode), a pin in the accent colour drawn by CSS at the centre (cities only; a province or
 * country is an area), and the attribution the map data requires. No map service is contacted when the page opens.
 */
function LocationMap({ location }: LocationMapProps) {
	const { messages, view, imageUrl } = useRender();
	const { map } = location;
	if (!map) return null;
	const alt = location.label ? fillPortfolioMessage(messages.mapAround, { place: location.label }) : "";
	const light = imageUrl(map.light.src);
	const dark = imageUrl(map.dark.src);
	const { scheme } = view.design;
	const image = { ...(scheme === "dark" ? map.dark : map.light), alt };
	return (
		<div className="pf-loc__map">
			{scheme === "auto" && dark && light ? (
				<picture>
					<source media="(prefers-color-scheme: dark)" srcSet={dark} />
					<Picture image={image} />
				</picture>
			) : (
				<Picture image={image} />
			)}
			{(location.point?.precision ?? "city") === "city" && <span className="pf-loc__pin" aria-hidden="true" />}
			<span className="pf-loc__attr">© OpenMapTiles © OpenStreetMap contributors</span>
		</div>
	);
}

/**
 * Where the person is and how they work: the map picture when shown, city, local time (filled in by the page script),
 * work modes and relocation, and a link to the place on OpenStreetMap.
 */
function LocationCard({ location }: LocationMapProps) {
	const { messages, locale } = useRender();
	const modes = location.workModes.map((mode) => messages[mode]);
	if (location.relocate) modes.push(messages.relocate);
	const mapLink = location.map && location.point ? openStreetMapUrl(location.point) : null;
	return (
		<div className="pf-loc" data-map={location.map ? "" : undefined}>
			<LocationMap location={location} />
			<div className="pf-loc__body">
				{(location.label || location.showLocalTime) && (
					<div className="pf-loc__city">
						{location.label && <b>{location.label}</b>}
						{/* The page script writes the time into the last span and shows it. */}
						{location.showLocalTime && location.timezone && (
							<span className="pf-loc__time" data-tz={location.timezone} data-lang={locale} hidden>
								<span className="sr-only">{messages.localTime}: </span>
								<span />
							</span>
						)}
					</div>
				)}
				{modes.length > 0 && (
					<ul className="pf-chips">
						{modes.map((mode) => (
							<li key={mode} className="pf-chip">
								{mode}
							</li>
						))}
					</ul>
				)}
				{mapLink && (
					<a className="pf-loc__open" href={mapLink} target="_blank" rel="ugc nofollow noopener noreferrer">
						{messages.openMap}
					</a>
				)}
			</div>
		</div>
	);
}

type ContactProps = { section: ContactSection; ctaClassName?: string };

/** The contact section's buttons, list of ways to reach the person, and location card. */
export function Contact({ section, ctaClassName }: ContactProps) {
	const { messages } = useRender();
	const { contact } = section;
	const buttons: PortfolioViewLink[] = [];
	if (contact.email)
		buttons.push({ label: messages.email, href: `mailto:${contact.email}`, external: false, kind: "email" });
	if (contact.whatsapp)
		buttons.push({ label: messages.whatsapp, href: contact.whatsapp.href, external: true, kind: "whatsapp" });
	if (contact.vcard) buttons.push({ label: messages.saveContact, href: contact.vcard, external: false, kind: "vcard" });
	const rows: { label: string; value: string; href: string; me?: boolean; event?: string }[] = [];
	if (contact.email)
		rows.push({ label: messages.email, value: contact.email, href: `mailto:${contact.email}`, event: "email" });
	if (contact.whatsapp)
		rows.push({
			label: messages.whatsapp,
			value: formatPhoneNumber(contact.whatsapp.number),
			href: contact.whatsapp.href,
			event: "whatsapp",
		});
	if (contact.phone)
		rows.push({ label: messages.phone, value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}` });
	if (contact.website)
		rows.push({
			label: messages.website,
			value: contact.website.label.replace(/^https?:\/\//, "").replace(/\/$/, ""),
			href: contact.website.href,
			me: true,
			event: "link",
		});
	for (const profile of contact.profiles) {
		const value = profile.username || profile.href?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
		if (profile.href)
			rows.push({ label: profile.network || messages.profile, value, href: profile.href, me: true, event: "link" });
	}
	return (
		<>
			{contact.note && <p className={ctaClassName}>{contact.note}</p>}
			{contact.form && <MessageForm />}
			{/* The form's own button is the section's main action; these stay quieter beside it. Save contact alone is never
			the main action either. */}
			<Buttons links={buttons} quiet={contact.form || buttons[0]?.kind === "vcard"} />
			{rows.length > 0 && (
				<ul className="pf-contact-links">
					{rows.map((row) => (
						<li key={`${row.label}-${row.href}`}>
							<span>{row.label}</span>
							<a
								{...(row.event ? { "data-pf-event": row.event } : {})}
								{...linkAttributes(row.href, { me: row.me ?? false })}
							>
								{row.value}
							</a>
						</li>
					))}
				</ul>
			)}
			{contact.location && <LocationCard location={contact.location} />}
		</>
	);
}

type ClientsProps = { section: Extract<PortfolioViewSection, { kind: "clients" }>; variant: string };

/**
 * Clients as a row of logos (grey until pointed at, unless the variant is colour) or names. A logo or brand icon
 * without a name beside it is named by its own text or the site it links to; a client with nothing to draw is left out.
 */
export function Clients({ section, variant }: ClientsProps) {
	const { icon } = useRender();
	return (
		<ul className="pf-logos" data-variant={variant}>
			{section.clients.map((client) => {
				const brand = !client.logo && client.brandIcon && icon(client.brandIcon) ? client.brandIcon : null;
				if (!client.logo && !brand && !client.name) return null;
				const label = client.name || client.logo?.alt || (client.href ? hostOf(client.href) : "");
				const content = client.logo ? (
					<Picture image={{ ...client.logo, alt: label }} />
				) : (
					<>
						{brand && <ResumeIcon name={brand} {...(!client.name && label ? { label } : {})} />}
						{client.name && <span>{client.name}</span>}
					</>
				);
				return (
					<li key={client.id}>
						{client.href ? (
							<a className="pf-logo" {...linkAttributes(client.href)}>
								{content}
							</a>
						) : (
							<span className="pf-logo">{content}</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}

type FooterProps = { year: number; creditUrl: string };

export function Footer({ year, creditUrl }: FooterProps) {
	const { view, messages, live } = useRender();
	return (
		<footer className="pf-foot pf-wrap">
			<span>
				© {year} {view.basics.name}
			</span>
			{view.credit && (
				<a className="pf-badge" href={creditUrl}>
					<RezumiMark />
					{messages.credit}
				</a>
			)}
			{live && (
				<a href={live.reportUrl} rel="nofollow">
					{messages.report}
				</a>
			)}
		</footer>
	);
}

/**
 * A WhatsApp number (digits with the country code) as people write it. Indonesian numbers get their usual grouping,
 * "+62 812 5550 1824"; others keep their digits after "+".
 */
function formatPhoneNumber(digits: string): string {
	const indonesian = /^62(\d{3})(\d{3,4})(\d{3,5})$/.exec(digits);
	return indonesian ? `+62 ${indonesian[1]} ${indonesian[2]} ${indonesian[3]}` : `+${digits}`;
}
