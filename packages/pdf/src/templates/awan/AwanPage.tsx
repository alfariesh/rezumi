import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Awan ("cloud"): a soft rounded panel floats in the left column, holding the portrait, the name and the contact lines
 * above the supporting sections; the main column stays open and white beside it.
 */
export const AwanPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useAwan()} sidebarEnd={false} headerPlacement="sidebar-only" />
);

const useAwan = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		const panel = mixColors(tokens.ink, tokens.background, 0.045);
		const inner = size.body * 1.25;
		// The panel keeps part of the page margin outside it and puts the rest inside, around its text.
		const outside = margin * 0.45;
		const sidebarOnStart = r.columns === "row";

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: {
				backgroundColor: panel,
				borderRadius: size.body * 1.3,
				paddingTop: inner * 1.2,
				paddingBottom: inner,
				...(sidebarOnStart
					? { marginLeft: outside, paddingLeft: inner, paddingRight: inner }
					: { marginRight: outside, paddingLeft: inner, paddingRight: inner }),
			},
			mainColumn: { paddingTop: size.body * 0.3 },
			header: { flexDirection: "column", rowGap: metrics.gapY(1.4), paddingBottom: metrics.gapY(1.6) },
			headerTitle: { rowGap: metrics.gapY(1.3) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.45) },
			headerName: {
				fontSize: size.heading * 1.65,
				lineHeight: 1.08,
				fontWeight: tokens.headingWeight,
				...tracking(-0.01, size.heading * 1.65),
			},
			headerHeadline: { fontSize: size.body * 1.02, color: tokens.accentText, fontWeight: "600", lineHeight: 1.35 },
			contactList: { flexDirection: "column", rowGap: size.meta * 0.55 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.6 },
			contactText: { fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: panel, sidebarForeground: tokens.ink },
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.05,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.05),
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
				sectionHeadingContainer: bySide({ alignItems: "center", columnGap: size.body * 0.55 }, {}),
				sectionHeadingMarker: bySide(
					{ width: size.body * 0.55, height: size.body * 0.55, borderRadius: 999, backgroundColor: tokens.accent },
					{},
				),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
