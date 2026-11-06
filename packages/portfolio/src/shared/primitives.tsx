import type { PortfolioViewImage } from "../view";
import type { AnchorHTMLAttributes, CSSProperties } from "react";
import { useRender } from "./context";

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
