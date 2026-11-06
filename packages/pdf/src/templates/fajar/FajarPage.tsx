import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Fajar ("dawn"): a soft wash of the accent fills the top of the page edge to edge, where the portrait, the name and
 * the contact line sit in dark text; two open columns follow, the sidebar on the left.
 */
export const FajarPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useFajar()} sidebarEnd={false} headerPlacement="full-width" />
);

const useFajar = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const { marginX, marginY } = metadata.page;
		const wash = mixColors(tokens.accent, tokens.background, 0.12);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			// The band reaches the paper's top edge: it climbs over the page's top margin.
			header: {
				flexDirection: r.row,
				alignItems: "center",
				columnGap: size.body * 2,
				backgroundColor: wash,
				marginTop: -marginY,
				marginBottom: metrics.gapY(2.6),
				paddingTop: marginY * 1.05,
				paddingBottom: marginY * 0.85,
				paddingHorizontal: marginX,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.15,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.15),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.02,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.2,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.02),
					},
					{
						fontSize: size.label,
						fontWeight: tokens.headingWeight,
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: tokens.accentText,
						...tracking(0.06, size.label),
					},
				),
				sectionHeadingContainer: { alignItems: "center", columnGap: size.label * 1.2 },
				sectionHeadingRule: bySide(
					{ borderTopWidth: 0.75, borderTopColor: mixColors(tokens.accent, tokens.background, 0.45) },
					{},
				),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
