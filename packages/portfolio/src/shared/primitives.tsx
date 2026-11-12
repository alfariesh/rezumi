import type { PortfolioViewImage } from "../view";
import type { AnchorHTMLAttributes, CSSProperties } from "react";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { useRender } from "./context";

/** Addresses a link may lead to: other sites over http(s), mail and phone, and places on this page or site. */
// A path is `/` then neither `/` nor `\` (browsers read `/\host` like `//host`, another site).
const LINKABLE = /^(?:https?:\/\/|mailto:|tel:|#|\/(?![/\\]))/i;

/**
 * Whether a browser reads the address as written. Its URL parser drops a leading space or control character and every
 * tab and line break anywhere, so `/\t/host` would become `//host` (another site) and `java\tscript:` a scheme after
 * the checks here had passed it; such an address is refused instead.
 */
export function isPlainUrl(url: string): boolean {
	// oxlint-disable-next-line no-control-regex -- these control characters are exactly what the check looks for.
	return !/^[\0-\x20]|[\t\n\r]/.test(url);
}

/**
 * Attributes for a link: outside links open in a new tab and aren't credited by search engines (user content).
 * Anything else (`javascript:`, `data:`, `//host`, a bare word) gets no `href`, so it never becomes a link; the view
 * already makes every address safe, this keeps a slip from turning into one.
 */
export function linkAttributes(
	href: string,
	options: { external?: boolean; me?: boolean } = {},
): AnchorHTMLAttributes<HTMLAnchorElement> {
	if (!isPlainUrl(href) || !LINKABLE.test(href)) return {};
	const external = options.external ?? /^https?:/i.test(href);
	if (!external) return { href };
	return {
		href,
		target: "_blank",
		rel: [options.me ? "me" : "", "ugc nofollow noopener noreferrer"].filter(Boolean).join(" "),
	};
}

/**
 * The id of the heading that names a section or a work's detail. `--` keeps it apart from every anchor: work slugs
 * and section anchors never hold two dashes in a row.
 */
export function headingId(anchor: string): string {
	return `${anchor}--title`;
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

/**
 * The small copy's width: copies are made `PORTFOLIO_UPLOAD.thumbSide` pixels on the longest side (never enlarged), so
 * a portrait picture's copy is narrower than that.
 */
function smallWidth(width: number, height: number | undefined): number {
	// Never larger than the picture itself: a small picture's copy isn't enlarged.
	return Math.min(width, Math.round((PORTFOLIO_UPLOAD.thumbSide * width) / Math.max(width, height ?? width)));
}

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
			{...(small && image.width
				? {
						srcSet: `${small} ${smallWidth(image.width, image.height)}w, ${src} ${image.width}w`,
						sizes: sizes ?? "100vw",
					}
				: {})}
			alt={decorative ? "" : image.alt}
			{...(image.width && image.height ? { width: image.width, height: image.height } : {})}
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			{...(eager ? { fetchPriority: "high" as const } : {})}
			{...(style ? { style } : {})}
		/>
	);
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
