import type {
	PortfolioView,
	PortfolioViewImage,
	PortfolioViewLink,
	PortfolioViewSection,
	PortfolioViewWork,
} from "../view";
import type { UiIconName } from "./icons";
import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from "react";
import { renderPortfolioHtml } from "../rich-text";
import { htmlToText } from "../text";
import { useRender } from "./context";
import { RezumiMark, ResumeIcon, UiIcon } from "./icons";
import { MetricGroup } from "./metric";

/** Attributes for a link: outside links open in a new tab and aren't credited by search engines (user content). */
export function linkAttributes(
	href: string,
	options: { external?: boolean; me?: boolean } = {},
): AnchorHTMLAttributes<HTMLAnchorElement> {
	const external = options.external ?? /^https?:/i.test(href);
	if (!external) return { href };
	return {
		href,
		target: "_blank",
		rel: [options.me ? "me" : "", "ugc nofollow noopener noreferrer"].filter(Boolean).join(" "),
	};
}

const BUTTON_ICONS: Partial<Record<NonNullable<PortfolioViewLink["kind"]>, UiIconName>> = {
	resume: "resume",
	pdf: "pdf",
	contact: "mail",
	email: "mail",
	whatsapp: "whatsapp",
	link: "link",
	profile: "link",
};

type ButtonProps = { link: PortfolioViewLink; primary?: boolean; icon?: UiIconName };

function Button({ link, primary, icon }: ButtonProps) {
	const name = icon ?? (link.kind ? BUTTON_ICONS[link.kind] : undefined);
	return (
		<a className={`pf-btn ${primary ? "pf-btn--primary" : "pf-btn--secondary"}`} {...linkAttributes(link.href, link)}>
			{name && <UiIcon name={name} />}
			{link.label}
		</a>
	);
}

type ButtonsProps = { links: readonly PortfolioViewLink[] };

/** 1–3 buttons; the first is the page's main action. */
export function Buttons({ links }: ButtonsProps) {
	if (!links.length) return null;
	return (
		<div className="pf-btns">
			{links.map((link, index) => (
				<Button key={`${link.href}-${index}`} link={link} primary={index === 0} />
			))}
		</div>
	);
}

type PictureProps = {
	image: PortfolioViewImage;
	className?: string;
	/** Load at once with high priority: the first picture a visitor sees. */
	eager?: boolean;
	/** The picture is decoration next to text that says the same; screen readers skip it. */
	decorative?: boolean;
	sizes?: string;
};

/** An `<img>` with its size (no layout shift), lazy loading, the small copy for narrow cards, and its focus point. */
export function Picture({ image, className, eager, decorative, sizes }: PictureProps) {
	const { imageUrl } = useRender();
	const src = imageUrl(image.src);
	if (!src) return null;
	const small = image.srcSmall ? imageUrl(image.srcSmall) : undefined;
	const style: CSSProperties | undefined = image.focus
		? { objectPosition: `${Math.round(image.focus.x * 100)}% ${Math.round(image.focus.y * 100)}%` }
		: undefined;
	return (
		<img
			className={className}
			src={src}
			{...(small && image.width ? { srcSet: `${small} 800w, ${src} ${image.width}w`, sizes: sizes ?? "100vw" } : {})}
			alt={decorative ? "" : image.alt}
			{...(image.width && image.height ? { width: image.width, height: image.height } : {})}
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			{...(eager ? { fetchPriority: "high" as const } : {})}
			{...(style ? { style } : {})}
		/>
	);
}

type ProseProps = { html: string; className?: string };

/** Rich text, cleaned once more at render (`02-teknis.md` section 15). */
export function Prose({ html, className }: ProseProps) {
	const clean = renderPortfolioHtml(html);
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
		<h2 className={["pf-section__title", className].filter(Boolean).join(" ")} id={`${section.anchor}-title`}>
			{section.title}
		</h2>
	);
}

type WorkDetailProps = { work: PortfolioViewWork; previous: PortfolioViewWork; next: PortfolioViewWork; total: number };

/**
 * A work's detail, opened by its anchor (`#work-<slug>`) through `:target`, so it reads without JavaScript and each work
 * can be shared. The bar closes back to the list and steps to the previous and next work.
 */
export function WorkDetail({ work, previous, next, total }: WorkDetailProps) {
	const { messages, view, imageUrl } = useRender();
	const titleId = `${work.anchor}-title`;
	return (
		<section className="pf-detail" id={work.anchor} role="dialog" aria-labelledby={titleId}>
			<article className="pf-detail__panel">
				<div className="pf-detail__bar">
					<a href="#work" data-close>
						<UiIcon name="arrow-left" flip />
						{messages.close}
					</a>
					{total > 1 && (
						<nav aria-label={messages.otherWork}>
							<a href={`#${previous.anchor}`} aria-label={`${messages.previous}: ${previous.title}`} data-previous>
								<UiIcon name="arrow-left" flip />
							</a>
							<a href={`#${next.anchor}`} aria-label={`${messages.next}: ${next.title}`} data-next>
								<UiIcon name="arrow-right" flip />
							</a>
						</nav>
					)}
				</div>
				<header className="pf-detail__head">
					<h2 className="pf-detail__title" id={titleId}>
						{work.title}
					</h2>
					{work.summary && <p className="pf-detail__summary">{work.summary}</p>}
					{(work.role || work.date) && (
						<div className="pf-detail__meta">
							{work.role && (
								<span>
									{messages.role} <b>{work.role}</b>
								</span>
							)}
							{work.date && (
								<span>
									{messages.year} <b>{work.date}</b>
								</span>
							)}
						</div>
					)}
					{work.tags.length > 0 && (
						<ul className="pf-tags">
							{work.tags.map((tag) => (
								<li key={tag}>{tag}</li>
							))}
						</ul>
					)}
				</header>
				{work.cover && (
					<div className="pf-cover pf-detail__hero">
						<Picture image={work.cover} sizes="(min-width: 860px) 820px, 100vw" />
					</div>
				)}
				{work.blocks.length > 0 && (
					<div className="pf-blocks">
						{work.blocks.map((block) => {
							switch (block.type) {
								case "text":
									return <Prose key={block.id} html={block.html} />;
								case "images":
									return (
										<div key={block.id} className="pf-gallery" data-layout={block.layout}>
											{block.images.map((image, index) => (
												<figure key={`${image.src}-${index}`}>
													{/* The full picture: the page script opens it in the viewer, without it the link opens the file. */}
													<a
														className="pf-zoom"
														href={imageUrl(image.src) ?? image.src}
														data-lightbox=""
														{...(image.caption ? { "data-caption": image.caption } : {})}
													>
														<Picture
															image={image}
															sizes={
																block.layout === "grid"
																	? "(min-width: 860px) 400px, 100vw"
																	: "(min-width: 860px) 820px, 100vw"
															}
														/>
													</a>
													{image.caption && <figcaption>{image.caption}</figcaption>}
												</figure>
											))}
										</div>
									);
								case "metrics":
									return <MetricGroup key={block.id} metrics={block.items} variant={view.design.variants.metric} />;
								// Video, PDF and link blocks render from Phase 05 on; until then they're left out.
								default:
									return null;
							}
						})}
					</div>
				)}
				{work.primaryLink && (
					<div className="pf-btns">
						<Button link={work.primaryLink} primary icon="link" />
					</div>
				)}
			</article>
		</section>
	);
}

/**
 * The full-screen picture viewer the page script fills from a gallery: one per page, hidden until a gallery picture
 * is opened. Escape, the arrow keys and swiping step through the gallery; closing returns focus to the picture.
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

type ResumeItem = Record<string, unknown> & { id: string };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const websiteOf = (item: ResumeItem) => {
	const website = item.website as { url?: unknown } | undefined;
	return text(website?.url);
};

/**
 * A resume item's parts, whatever its section: what it is, where, when, its link and description. Sections differ
 * in field names (position or degree, company or school), so each one is mapped here.
 */
function resumeItemParts(kind: string, raw: ResumeItem) {
	const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
	const item = raw as Record<string, unknown>;
	switch (kind) {
		case "experience":
			return {
				title: text(item.position) || text(item.company),
				org: join(text(item.position) ? text(item.company) : "", text(item.location)),
				when: text(item.period),
				description: text(item.description),
				roles: Array.isArray(item.roles) ? (item.roles as ResumeItem[]) : [],
			};
		case "education":
			return {
				title: [text(item.degree), text(item.area)].filter(Boolean).join(", ") || text(item.school),
				org: join(text(item.degree) || text(item.area) ? text(item.school) : "", text(item.location), text(item.grade)),
				when: text(item.period),
				description: text(item.description),
				roles: [],
			};
		case "profiles":
			return {
				title: text(item.network) || text(item.username),
				org: text(item.network) ? text(item.username) : "",
				when: "",
				description: "",
				roles: [],
			};
		case "volunteer":
			return {
				title: text(item.organization),
				org: text(item.location),
				when: text(item.period),
				description: text(item.description),
				roles: [],
			};
		default:
			return {
				title:
					text(item.title) || text(item.name) || text(item.position) || text(item.organization) || text(item.language),
				org: join(
					text(item.awarder),
					text(item.issuer),
					text(item.publisher),
					text(item.company),
					text(item.school),
					text(item.fluency),
					text(item.location),
				),
				when: text(item.date) || text(item.period),
				description: text(item.description) || text(item.content),
				roles: [],
			};
	}
}

type CvListProps = { kind: string; items: readonly ResumeItem[]; variant?: string };

/** Experience, education, volunteering and the resume's custom sections: role, place, period, description. */
export function CvList({ kind, items, variant }: CvListProps) {
	const Tag = kind === "experience" ? "ol" : "ul";
	return (
		<Tag className="pf-cvlist" data-variant={variant}>
			{items.map((item) => {
				const parts = resumeItemParts(kind, item);
				const website = websiteOf(item);
				if (!parts.title && !parts.description) return null;
				return (
					<li key={item.id} className="pf-cvitem">
						<div className="pf-cvitem__head">
							<span className="pf-cvitem__role">{parts.title}</span>
							{parts.when && <span className="pf-cvitem__when">{parts.when}</span>}
						</div>
						{(parts.org || website) && (
							<span className="pf-cvitem__org">
								{website ? <a {...linkAttributes(website)}>{parts.org || website}</a> : parts.org}
							</span>
						)}
						{parts.description && <Prose html={parts.description} />}
						{parts.roles.length > 0 && (
							<ul className="pf-cvitem__roles">
								{parts.roles.map((role) => (
									<li key={role.id} className="pf-cvitem">
										<div className="pf-cvitem__head">
											<span className="pf-cvitem__role">{text(role.position)}</span>
											{text(role.period) && <span className="pf-cvitem__when">{text(role.period)}</span>}
										</div>
										{text(role.description) && <Prose html={text(role.description)} />}
									</li>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</Tag>
	);
}

type ExtraListProps = { kind: string; items: readonly ResumeItem[] };

/** Short lists (languages, certificates, awards, publications, interests): a bold line and a muted one. */
export function ExtraList({ kind, items }: ExtraListProps) {
	return (
		<ul>
			{items.map((item) => {
				const record = item as Record<string, unknown>;
				const parts = resumeItemParts(kind, item);
				const keywords = Array.isArray(record.keywords) ? (record.keywords as unknown[]).map(text).filter(Boolean) : [];
				const detail = [parts.org, parts.when, keywords.join(", ")].filter(Boolean).join(" · ");
				const website = websiteOf(item);
				if (!parts.title) return null;
				return (
					<li key={item.id}>
						<b>{website ? <a {...linkAttributes(website)}>{parts.title}</a> : parts.title}</b>
						{detail && <span>{detail}</span>}
					</li>
				);
			})}
		</ul>
	);
}

type SkillsProps = { items: readonly ResumeItem[]; variant: string };

/** Skills as groups (a skill with its keywords) or as one row of chips. */
export function Skills({ items, variant }: SkillsProps) {
	const skills = items
		.map((item) => {
			const record = item as Record<string, unknown>;
			return {
				id: item.id,
				name: text(record.name),
				icon: text(record.icon),
				keywords: Array.isArray(record.keywords) ? (record.keywords as unknown[]).map(text).filter(Boolean) : [],
			};
		})
		.filter((skill) => skill.name || skill.keywords.length);
	if (variant === "chips" || skills.every((skill) => !skill.keywords.length)) {
		return (
			<ul className="pf-tags" data-variant="chips">
				{skills.map((skill) => (
					<li key={skill.id}>{skill.name || skill.keywords.join(", ")}</li>
				))}
			</ul>
		);
	}
	return (
		<div className="pf-skillgroups" data-variant="groups">
			{skills.map((skill) => (
				<div key={skill.id} className="pf-skillgroup">
					{skill.name && <b>{skill.name}</b>}
					{skill.keywords.length > 0 && (
						<ul className="pf-tags">
							{skill.keywords.map((keyword) => (
								<li key={keyword}>{keyword}</li>
							))}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}

type ContactSection = Extract<PortfolioViewSection, { kind: "contact" }>;
type LocationCardProps = { location: NonNullable<PortfolioView["location"]> };

/**
 * Where the person is and how they work: city, local time (filled in by the page script), work modes and relocation.
 * The map picture arrives with Phase 05.
 */
function LocationCard({ location }: LocationCardProps) {
	const { messages, locale } = useRender();
	const modes = location.workModes.map((mode) => messages[mode]);
	if (location.relocate) modes.push(messages.relocate);
	return (
		<div className="pf-loc">
			{(location.label || location.showLocalTime) && (
				<div className="pf-loc__city">
					{location.label && <b>{location.label}</b>}
					{location.showLocalTime && location.timezone && (
						<span
							className="pf-loc__time"
							data-tz={location.timezone}
							data-lang={locale}
							aria-label={messages.localTime}
							hidden
						/>
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
		</div>
	);
}

type ContactProps = { section: ContactSection; ctaClassName?: string; children?: ReactNode };

/** The contact section's buttons, list of ways to reach the person, and location card. */
export function Contact({ section, ctaClassName }: ContactProps) {
	const { messages } = useRender();
	const { contact } = section;
	const buttons: PortfolioViewLink[] = [];
	if (contact.email)
		buttons.push({ label: messages.email, href: `mailto:${contact.email}`, external: false, kind: "email" });
	if (contact.whatsapp)
		buttons.push({ label: messages.whatsapp, href: contact.whatsapp.href, external: true, kind: "whatsapp" });
	const rows: { label: string; value: string; href: string; me?: boolean }[] = [];
	if (contact.email) rows.push({ label: messages.email, value: contact.email, href: `mailto:${contact.email}` });
	if (contact.whatsapp)
		rows.push({
			label: messages.whatsapp,
			value: formatPhoneNumber(contact.whatsapp.number),
			href: contact.whatsapp.href,
		});
	if (contact.phone)
		rows.push({ label: messages.phone, value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}` });
	if (contact.website)
		rows.push({
			label: messages.website,
			value: contact.website.label.replace(/^https?:\/\//, "").replace(/\/$/, ""),
			href: contact.website.href,
			me: true,
		});
	for (const profile of contact.profiles) {
		const value = profile.username || profile.href?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
		if (profile.href) rows.push({ label: profile.network || messages.profile, value, href: profile.href, me: true });
	}
	return (
		<>
			{contact.note && <p className={ctaClassName}>{contact.note}</p>}
			<Buttons links={buttons} />
			{rows.length > 0 && (
				<ul className="pf-contact-links">
					{rows.map((row) => (
						<li key={`${row.label}-${row.href}`}>
							<span>{row.label}</span>
							<a {...linkAttributes(row.href, { me: row.me ?? false })}>{row.value}</a>
						</li>
					))}
				</ul>
			)}
			{contact.location && <LocationCard location={contact.location} />}
		</>
	);
}

type ClientsProps = { section: Extract<PortfolioViewSection, { kind: "clients" }>; variant: string };

/** Clients as a row of logos (grey until pointed at, unless the variant is colour) or names. */
export function Clients({ section, variant }: ClientsProps) {
	return (
		<ul className="pf-logos" data-variant={variant}>
			{section.clients.map((client) => {
				const content = (
					<>
						{client.logo ? (
							<Picture image={{ ...client.logo, alt: client.name || client.logo.alt }} />
						) : (
							<ResumeIcon name={client.brandIcon} />
						)}
						{(!client.logo || !client.name) && client.name && <span>{client.name}</span>}
						{client.logo && client.name && <span className="sr-only">{client.name}</span>}
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
	const { view, messages } = useRender();
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

/** A link's site, as people read it: `linkedin.com`. */
export function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** CSS custom properties React writes as written. */
export const vars = (values: Record<string, string | number>) => values as CSSProperties;

export type { ResumeItem };
