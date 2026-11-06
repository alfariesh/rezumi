import { absoluteUrl } from "./paths";

/** The part of an image field's value needed to address the file (see emdash-env.d.ts). */
type ImageValue = { id?: string; src?: string; meta?: Record<string, unknown> } | null | undefined;

/**
 * The absolute URL of an image field's file, for social cards and structured data, which need a full URL. Uploaded
 * media is served by EmDash's media route; an external image keeps its own address.
 */
export function imageUrl(image: ImageValue): string | undefined {
	if (!image) return undefined;
	if (image.src && /^https?:\/\//.test(image.src)) return image.src;
	const storageKey = typeof image.meta?.storageKey === "string" ? image.meta.storageKey : image.id;
	if (storageKey) return absoluteUrl(`/_emdash/api/media/file/${encodeURIComponent(storageKey)}`);
	return image.src ? absoluteUrl(image.src) : undefined;
}
