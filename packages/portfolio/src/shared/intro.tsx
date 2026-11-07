import type { PortfolioView } from "../view";
import type { CSSProperties } from "react";
import { useRender } from "./context";
import { UiIcon } from "./icons";
import { vars } from "./primitives";

type IntroBackground = { "data-bg": PortfolioView["hero"]["background"]["kind"]; style?: CSSProperties };

/**
 * The intro's background, as attributes for the element that draws it: `data-bg` (plain, the soft gradient, the dot
 * pattern or a picture, which the shared CSS draws) and the picture's address as `--pf-hero-image`. A picture the
 * page may not load (`imageUrl`) leaves the intro plain.
 */
export function useIntroBackground(): IntroBackground {
	const { view, imageUrl } = useRender();
	const { background } = view.hero;
	const src = background.image ? imageUrl(background.image.src) : undefined;
	if (background.kind !== "image") return { "data-bg": background.kind };
	if (!src) return { "data-bg": "plain" };
	// The address goes into CSS inside quotes: encoded, and with no quote left to end the string early.
	return {
		"data-bg": "image",
		style: vars({ "--pf-hero-image": `url("${encodeURI(src).replaceAll('"', "%22")}")` }),
	};
}

/** Where the intro says the person is: the location's own label, else the resume's. */
export function introLocation(view: PortfolioView): string {
	return view.location?.label || view.basics.location;
}

type IntroChipsProps = {
	/** Empty for none (Mozaik shows the place in its location tile instead). */
	location: string;
	availability: string | null;
	/** Mozaik reads "open to work" first. */
	availabilityFirst?: boolean;
};

/** The intro's chips: where the person is, and that they're open to work. */
export function IntroChips({ location, availability, availabilityFirst = false }: IntroChipsProps) {
	if (!location && !availability) return null;
	const place = location && (
		<li className="pf-chip">
			<UiIcon name="pin" />
			{location}
		</li>
	);
	const open = availability && <li className="pf-chip pf-chip--open">{availability}</li>;
	return (
		<ul className="pf-chips">
			{availabilityFirst ? open : place}
			{availabilityFirst ? place : open}
		</ul>
	);
}
