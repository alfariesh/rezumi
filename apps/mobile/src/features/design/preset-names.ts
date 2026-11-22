// Names of the shared design presets (`@rezumi/resume/design-presets`) in the app's language. The package keeps plain
// English labels; the resume's and the letter's Design read these instead.
import type { MessageDescriptor } from "@lingui/core";
import type { ACCENTS, FontPairingId, MarginId } from "@rezumi/resume/design-presets";
import { msg } from "@lingui/core/macro";

export const PAIRING_NAMES: Record<FontPairingId, MessageDescriptor> = {
	classic: msg`Classic`,
	traditional: msg`Traditional`,
	balanced: msg`Balanced`,
	professional: msg`Professional`,
	clean: msg`Clean`,
};

/** Keyed by the package's English label. */
export const ACCENT_NAMES: Record<(typeof ACCENTS)[number]["label"], MessageDescriptor> = {
	Moss: msg`Moss`,
	"Ink blue": msg`Ink blue`,
	Teal: msg`Teal`,
	Plum: msg`Plum`,
	Rust: msg`Rust`,
	Burgundy: msg`Burgundy`,
	Ochre: msg`Ochre`,
	Graphite: msg`Graphite`,
};

export const MARGIN_NAMES: Record<MarginId, MessageDescriptor> = {
	narrow: msg`Narrow`,
	normal: msg`Normal`,
	wide: msg`Wide`,
};
