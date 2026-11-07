import type { PortfolioViewBlock } from "../view";
import { fillPortfolioMessage } from "../messages";
import { useRender } from "./context";
import { ResumeIcon, UiIcon } from "./icons";
import { hostOf, linkAttributes, Picture } from "./primitives";

type VideoBlock = Extract<PortfolioViewBlock, { type: "video" }>;
type PdfBlock = Extract<PortfolioViewBlock, { type: "pdf" }>;
type LinkBlock = Extract<PortfolioViewBlock, { type: "link" }>;

const PROVIDER_NAMES = { youtube: "YouTube", vimeo: "Vimeo" } as const;

type VideoFacadeProps = { block: VideoBlock };

/**
 * A video as its thumbnail and a play button (`02-teknis.md` section 18). Nothing from YouTube or Vimeo loads with
 * the page: the thumbnail is the portfolio's own copy, and the page script swaps in the player (`data-embed`) only
 * when the visitor presses play. Without JavaScript the link opens the video on its own site.
 */
export function VideoFacade({ block }: VideoFacadeProps) {
	const { messages } = useRender();
	const provider = PROVIDER_NAMES[block.provider];
	const label = block.title ? `${messages.playVideo}: ${block.title}` : `${messages.playVideo} (${provider})`;
	return (
		<div className="pf-video" data-provider={block.provider}>
			<a
				className="pf-video__open"
				{...linkAttributes(block.href)}
				data-embed={block.embedUrl}
				data-title={block.title || provider}
				data-pf-event="video"
				data-pf-block={block.id}
				aria-label={label}
			>
				<span className="pf-cover">
					{block.thumbnail && <Picture image={block.thumbnail} decorative sizes="(min-width: 860px) 820px, 100vw" />}
				</span>
				<span className="pf-video__play" aria-hidden="true">
					<span>
						<UiIcon name="play" className="pf-icon pf-video__icon" />
					</span>
				</span>
				<span className="pf-video__meta" aria-hidden="true">
					{block.title && <b>{block.title}</b>}
					{provider}
				</span>
			</a>
		</div>
	);
}

/** A file size as people read it, in the page's language: "2.4 MB", "820 kB". */
function formatFileSize(bytes: number, locale: string): string {
	const megabytes = bytes / 1_000_000;
	const unit = megabytes >= 1 ? "megabyte" : "kilobyte";
	const value = megabytes >= 1 ? megabytes : Math.max(1, Math.round(bytes / 1000));
	try {
		return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
	} catch {
		return `${value.toFixed(1)} ${megabytes >= 1 ? "MB" : "kB"}`;
	}
}

type PdfCardProps = { block: PdfBlock };

/**
 * A PDF as a card (`02-teknis.md` section 19): its first page, title, page count and size, and a button that opens
 * the file in a new tab. The server sends it locked down (inline PDF only, sandboxed, never sniffed).
 */
export function PdfCard({ block }: PdfCardProps) {
	const { messages, locale } = useRender();
	const pages = fillPortfolioMessage(messages.pages, { count: block.pages });
	const details = ["PDF", pages, block.bytes ? formatFileSize(block.bytes, locale) : ""].filter(Boolean).join(" · ");
	return (
		<div className="pf-pdf">
			<div className="pf-pdf__page">
				{block.preview ? (
					<Picture image={block.preview} decorative sizes="96px" />
				) : (
					<UiIcon name="document" className="pf-icon pf-pdf__icon" />
				)}
			</div>
			<div className="pf-pdf__text">
				{block.title && <b>{block.title}</b>}
				<span>{details}</span>
				<a
					className="pf-btn pf-btn--secondary"
					href={block.href}
					target="_blank"
					rel="noopener"
					data-pf-event="document"
					data-pf-block={block.id}
				>
					<UiIcon name="document" />
					{messages.openPdf}
					{block.title && <span className="sr-only">: {block.title}</span>}
				</a>
			</div>
		</div>
	);
}

type LinkCardProps = { block: LinkBlock };

/**
 * A link as a card (`02-teknis.md` section 20): its picture (the portfolio's own copy) or the site's logo, title,
 * description, and site. Like every outside link it opens in a new tab and isn't credited by search engines.
 */
export function LinkCard({ block }: LinkCardProps) {
	const { icon } = useRender();
	const host = hostOf(block.href);
	const site = block.siteName && block.siteName.toLowerCase() !== host ? `${block.siteName} · ${host}` : host;
	const brand = block.brandIcon && icon(block.brandIcon) ? block.brandIcon : null;
	return (
		<a
			className="pf-link"
			{...linkAttributes(block.href)}
			data-image={block.image ? "" : undefined}
			data-pf-event="link"
			data-pf-block={block.id}
		>
			{block.image ? (
				<span className="pf-link__image">
					<Picture image={block.image} decorative sizes="160px" />
				</span>
			) : (
				<span className="pf-link__site">{brand ? <ResumeIcon name={brand} /> : <UiIcon name="globe" />}</span>
			)}
			<span className="pf-link__text">
				<b>{block.title}</b>
				{block.description && <span className="pf-link__desc">{block.description}</span>}
				<span className="pf-link__domain">
					{site}
					<UiIcon name="link" flip />
				</span>
			</span>
		</a>
	);
}
