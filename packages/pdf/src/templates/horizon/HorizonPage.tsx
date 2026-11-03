import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Horizon: a header band. The accent runs edge to edge across the top with the name, headline and contact line in
 * light text and the portrait at its end; two columns follow, the sidebar on the right.
 */
export const HorizonPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useHorizon()} sidebarEnd headerPlacement="full-width" />
);

const useHorizon = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const { marginX, marginY } = metadata.page;
		const onBand = tokens.onAccent;
		const onBandMuted = mixColors(onBand, tokens.accent, 0.78);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accent,
				...tracking(0.12, size.label),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.label * 1.25 },
			sectionHeadingRule: { borderTopWidth: 0.6, borderTopColor: tokens.hairline },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			// The band reaches the paper's top edge: it climbs over the page's top margin.
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				backgroundColor: tokens.accent,
				marginTop: -marginY,
				marginBottom: metrics.gapY(2.6),
				paddingTop: marginY * 0.95,
				paddingBottom: marginY * 0.8,
				paddingHorizontal: marginX,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				color: onBand,
				...tracking(-0.015, size.heading * 2.1),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: onBandMuted, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: onBand, fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				icon: { size: size.meta, color: tokens.accent },
				// The contact line sits on the band.
				contactIcon: { size: size.meta, color: onBand },
				contactLabel: { color: onBandMuted },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
