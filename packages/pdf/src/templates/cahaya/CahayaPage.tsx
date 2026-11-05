import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Cahaya ("light"): the name leads the main column from the top of the page, and the right column stands from the
 * same line behind a firm rule of the accent, with its titles in small ink capitals.
 */
export const CahayaPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useCahaya()} sidebarEnd headerPlacement="main-only" />
);

const useCahaya = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		// The rule sits on the sidebar's inner edge, wherever Design puts the sidebar.
		const sidebarOnRight = r.columns === "row";
		const label = {
			fontSize: size.label,
			fontWeight: tokens.headingWeight,
			textTransform: "uppercase",
			lineHeight: 1.2,
			...tracking(0.06, size.label),
		} as const;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: sidebarOnRight
				? { borderLeftWidth: 2, borderLeftColor: tokens.accent }
				: { borderRightWidth: 2, borderRightColor: tokens.accent },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(1.8),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.3,
				lineHeight: 1.04,
				fontWeight: tokens.headingWeight,
				...tracking(-0.025, size.heading * 2.3),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "600" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide({ ...label, color: tokens.accentText }, { ...label, color: tokens.ink }),
				sectionHeadingContainer: bySide({ alignItems: "center", columnGap: size.label * 1.2 }, {}),
				sectionHeadingRule: bySide({ borderTopWidth: 0.6, borderTopColor: tokens.hairline }, {}),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
