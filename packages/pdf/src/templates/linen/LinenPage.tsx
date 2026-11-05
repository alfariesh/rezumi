import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import type { TemplateStyleContext } from "../shared/types";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Linen: white and airy. An elegant serif name over a hairline, the main column on the left and a right sidebar set
 * apart by a single vertical hairline; no fills anywhere.
 */
export const LinenPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useLinen()} sidebarEnd headerPlacement="full-width" />
);

/** A slot that reads one way in the main column and another in the sidebar. */
const bySide =
	(main: Style, sidebar: Style) =>
	({ placement }: TemplateStyleContext) =>
		placement === "sidebar" ? sidebar : main;

const useLinen = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		// The hairline sits on the sidebar's inner edge, wherever Design puts the sidebar.
		const sidebarOnRight = r.columns === "row";

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: sidebarOnRight
				? { borderLeftWidth: 0.6, borderLeftColor: tokens.hairline }
				: { borderRightWidth: 0.6, borderRightColor: tokens.hairline },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				marginHorizontal: margin,
				paddingBottom: metrics.gapY(2),
				marginBottom: metrics.gapY(2.2),
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.4,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				...tracking(-0.01, size.heading * 2.4),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.muted },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{ fontSize: size.heading * 1.15, fontWeight: tokens.headingWeight, lineHeight: 1.15, color: tokens.ink },
					{
						fontSize: size.label,
						fontWeight: "600",
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: tokens.muted,
						...tracking(0.06, size.label),
					},
				),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
