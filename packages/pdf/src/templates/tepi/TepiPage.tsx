import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Tepi ("edge"): a slim stripe of the accent runs down the paper's edge on the sidebar's side of every page. The
 * sidebar keeps to the same side behind a hairline, and main section titles open with a short accent dash.
 */
export const TepiPage = (props: TemplatePageProps) => (
	<TwoColumnLayout
		{...props}
		template={useTepi()}
		sidebarEnd={false}
		headerPlacement="full-width"
		decoration={<Stripe />}
	/>
);

/** The stripe on the paper's edge beside the sidebar, repeated on every page. */
const Stripe = () => {
	const { r, tokens } = useLineupBase();
	return (
		<View
			fixed
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				width: 6,
				backgroundColor: tokens.accent,
				...r.anchorToColumnStart(0),
			}}
		/>
	);
};

const useTepi = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		// The hairline sits on the sidebar's inner edge, wherever Design puts the sidebar.
		const sidebarOnLeft = r.columns === "row";

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: sidebarOnLeft
				? { borderRightWidth: 0.6, borderRightColor: tokens.hairline }
				: { borderLeftWidth: 0.6, borderLeftColor: tokens.hairline },
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
				fontSize: size.heading * 2.25,
				lineHeight: 1.06,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.25),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "600" },
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
					{
						fontSize: size.heading * 1.02,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.02),
					},
					{
						fontSize: size.label,
						fontWeight: tokens.headingWeight,
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: tokens.muted,
						...tracking(0.06, size.label),
					},
				),
				sectionHeadingContainer: bySide({ alignItems: "center", columnGap: size.body * 0.6 }, {}),
				sectionHeadingMarker: bySide({ width: size.body * 1.3, height: 2.2, backgroundColor: tokens.accent }, {}),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
