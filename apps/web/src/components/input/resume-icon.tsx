import type { IconStyle } from "@rezumi/schema/resume/data";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { upgradeIconName } from "@rezumi/schema/resume/icon-names";

type IconGlyphs = Readonly<Record<string, string>>;

// The drawings of every resume icon in a style (≈300 KB gzipped) load the first time that style shows, then stay.
const glyphs = new Map<IconStyle, IconGlyphs>();

/** Every resume icon's drawing in `style`, once loaded. */
export function useIconGlyphs(style: IconStyle): IconGlyphs | undefined {
	const [, setLoaded] = useState<IconStyle>();
	useEffect(() => {
		if (glyphs.has(style)) return;
		let active = true;
		void import("@rezumi/pdf/icon-glyphs")
			.then(({ loadIconGlyphs }) => loadIconGlyphs(style))
			.then(
				(loaded) => {
					glyphs.set(style, loaded);
					if (active) setLoaded(style);
				},
				// A failed download leaves the icons blank; the next picker or page that shows them tries again.
				() => {},
			);
		return () => {
			active = false;
		};
	}, [style]);
	return glyphs.get(style);
}

type ResumeIconGlyphProps = {
	/** A resume icon name; a former Phosphor name draws its closest match. */
	name: string;
	/** The resume's icon style; the page draws its icons in it. */
	variant?: IconStyle | undefined;
	className?: string | undefined;
	style?: CSSProperties | undefined;
};

/** A resume icon as the resume draws it, in the current text colour. */
export function ResumeIconGlyph({ name, variant = "standard", className, style }: ResumeIconGlyphProps) {
	const data = useIconGlyphs(variant);
	const icon = upgradeIconName(name);
	const markup = icon && icon !== "none" ? data?.[icon] : undefined;

	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
			className={className ?? "size-4"}
			style={style}
			// Markup from the generated resume icon set, looked up by name: never text the user typed.
			// oxlint-disable-next-line react/no-danger -- generated SVG shapes, see above.
			dangerouslySetInnerHTML={{ __html: markup ?? "" }}
		/>
	);
}
