import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Nusa ("island"): confident and graphic. A heavy name, and every section opens with its title as a solid accent tag
 * with a rule running on from it to the margin, like a tab in a binder.
 */
export const NusaPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useNusa()} />;

const useNusa = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.6);
		const titleSize = size.label * 1.05;
		const titleLine = 1.2;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: {
				...base.page,
				paddingHorizontal: metrics.page.paddingHorizontal,
				paddingVertical: metrics.page.paddingVertical,
				rowGap: sectionGap,
			},
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(1) },
			// The title text is the tag; the row around it (the heading node once a rule follows) stays clear.
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: titleLine,
				color: tokens.onAccent,
				backgroundColor: tokens.accent,
				borderRadius: 2,
				paddingVertical: size.body * 0.26,
				paddingHorizontal: size.body * 0.6,
				...tracking(0.05, titleSize),
			},
			sectionHeadingContainer: {
				alignItems: "center",
				columnGap: size.body * 0.6,
				backgroundColor: tokens.background,
				borderRadius: 0,
				paddingVertical: 0,
				paddingHorizontal: 0,
			},
			sectionHeadingRule: { borderTopWidth: 0.9, borderTopColor: tokens.ink },
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(1),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontSize: size.heading * 2.4,
				lineHeight: 1.02,
				fontWeight: tokens.headingWeight,
				...tracking(-0.03, size.heading * 2.4),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "600" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors,
			styles: {
				...styles,
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
