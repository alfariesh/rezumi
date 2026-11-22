// Share's "5m", "2h", "3d", "6w", "1y": the parts come from `@rezumi/resume/sharing`, the words from Lingui plurals,
// since Hermes prints `Intl.NumberFormat` units wrong ("2,700s" for 45 minutes; apps/mobile/AGENTS.md).
import { plural, t } from "@lingui/core/macro";
import { timeSinceParts } from "@rezumi/resume/sharing";

/** Time since a moment in the largest whole unit, written short, in the app's language. */
export function formatTimeSince(date: Date, now = Date.now()) {
	const { count, unit } = timeSinceParts(date, now);
	switch (unit) {
		case "minute":
			return t({ message: plural(count, { other: "#m" }), comment: "Short time since, in minutes: 5m" });
		case "hour":
			return t({ message: plural(count, { other: "#h" }), comment: "Short time since, in hours: 2h" });
		case "day":
			return t({ message: plural(count, { other: "#d" }), comment: "Short time since, in days: 3d" });
		case "week":
			return t({ message: plural(count, { other: "#w" }), comment: "Short time since, in weeks: 6w" });
		case "year":
			return t({ message: plural(count, { other: "#y" }), comment: "Short time since, in years: 1y" });
	}
}
