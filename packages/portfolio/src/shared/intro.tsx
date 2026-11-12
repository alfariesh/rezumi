import type { PortfolioView } from "../view";
import type { CSSProperties, ReactNode } from "react";
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
	// The address goes into CSS inside quotes: what could end the string or the declaration early (a quote, a backslash,
	// a line break) is percent-encoded; the rest stays as given, so an address already encoded isn't encoded twice.
	const safe = src.replace(/["\\\n\r\f]/g, (char) => encodeURIComponent(char));
	return { "data-bg": "image", style: vars({ "--pf-hero-image": `url("${safe}")` }) };
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

type OpenToWorkProps = { className?: string };

/**
 * What the person is looking for, under "Open to work" (`view.hero.openTo`): "Looking for: <roles> — <kinds of work>".
 * Every theme draws it in the intro after `IntroChips`. Phase 13 Langkah 0 stub: draws nothing until `pf-render` does.
 */
export function OpenToWork(_props: OpenToWorkProps): ReactNode {
	return null;
}

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
