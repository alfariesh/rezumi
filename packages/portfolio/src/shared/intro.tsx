import type { PortfolioPageMessages } from "../messages";
import type { PortfolioView } from "../view";
import type { PortfolioJobType } from "@rezumi/schema/portfolio/data";
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

const JOB_TYPE_LABELS = {
	"full-time": "fullTime",
	"part-time": "partTime",
	contract: "contractWork",
	freelance: "freelance",
	internship: "internship",
} as const satisfies Record<PortfolioJobType, keyof PortfolioPageMessages>;

/**
 * What the person is looking for, under "Open to work" (`view.hero.openTo`, Phase 13 B19): "Looking for: Product
 * Designer · UI Designer — Full-time, Contract", in words rather than colour alone. Every theme draws it in the intro
 * after `IntroChips`; nothing when the person shows neither roles nor kinds of work.
 */
export function OpenToWork({ className }: OpenToWorkProps): ReactNode {
	const { view, messages } = useRender();
	const { openTo } = view.hero;
	if (!openTo) return null;
	const roles = openTo.roles.join(" · ");
	const types = openTo.types.map((type) => messages[JOB_TYPE_LABELS[type]]).join(", ");
	if (!roles && !types) return null;
	return (
		<p className={["pf-opento", className].filter(Boolean).join(" ")}>
			<span className="pf-opento__label">{messages.lookingFor}:</span> {[roles, types].filter(Boolean).join(" — ")}
		</p>
	);
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
