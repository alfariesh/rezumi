import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { upgradeIconName } from "@rezumi/schema/resume/icon-names";

type IconData = Record<string, string>;

// The drawings of every resume icon (≈180 KB gzipped) load the first time one is shown, then stay.
let iconData: IconData | undefined;
let loading: Promise<IconData> | undefined;

function useIconData() {
	const [data, setData] = useState(iconData);
	useEffect(() => {
		if (data) return;
		let active = true;
		loading ??= import("@rezumi/pdf/icons").then((module) => (iconData = module.default));
		void loading.then((loaded) => active && setData(loaded));
		return () => {
			active = false;
		};
	}, [data]);
	return data;
}

type ResumeIconGlyphProps = {
	/** A resume icon name; a former Phosphor name draws its closest match. */
	name: string;
	className?: string | undefined;
	style?: CSSProperties | undefined;
};

/** A resume icon as the resume draws it (standard style), in the current text colour. */
export function ResumeIconGlyph({ name, className, style }: ResumeIconGlyphProps) {
	const data = useIconData();
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
