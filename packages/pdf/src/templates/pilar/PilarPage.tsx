import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/** Where the rail runs: inside the start margin, a little nearer the paper's edge than the text. */
const railOffset = (marginX: number) => marginX * 0.45;

/**
 * Pilar ("pillar"): a formal page held by an accent rail down the start margin of every page. A solid stretch of the
 * rail stands beside the name, and each section title hangs from the rail by a small ringed marker.
 */
export const PilarPage = (props: TemplatePageProps) => (
	<OneColumnLayout {...props} decoration={<Rail />} template={usePilar()} />
);

/** The rail along the start margin, repeated on every page; a fixed view is placed from the paper's edge. */
const Rail = () => {
	const { r, tokens, metadata } = useLineupBase();
	const side = r.anchorToStart(railOffset(metadata.page.marginX) - 0.4);
	return (
		<View
			fixed
			style={{ position: "absolute", top: 0, bottom: 0, width: 0.8, backgroundColor: tokens.hairline, ...side }}
		/>
	);
};

const usePilar = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.5);
		const titleSize = size.label * 1.12;
		const titleLine = 1.25;
		const ring = size.body * 0.66;
		// The marker is placed back over the rail: from the text's edge, out across the margin to the rail's centre.
		const toRail = metadata.page.marginX - railOffset(metadata.page.marginX) + ring / 2;
		// The header reaches back over the margin so its start border, the rail's solid stretch, lies on the rail.
		const stretch = 3;
		const reach = metadata.page.marginX - railOffset(metadata.page.marginX) + stretch / 2;

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				position: "relative",
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: titleLine,
				color: tokens.ink,
				...tracking(0.05, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.5 },
			sectionHeadingMarker: {
				position: "absolute",
				top: (titleSize * titleLine - ring) / 2,
				...r.anchorToStart(-toRail),
				width: ring,
				height: ring,
				borderRadius: ring,
				borderWidth: 1.4,
				borderColor: tokens.accent,
				backgroundColor: tokens.background,
			},
			sectionHeadingRule: { borderTopWidth: 0.6, borderTopColor: tokens.hairline },
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(0.6),
				...(r.rtl
					? {
							marginRight: -reach,
							paddingRight: reach - stretch,
							borderRightWidth: stretch,
							borderRightColor: tokens.accent,
						}
					: {
							marginLeft: -reach,
							paddingLeft: reach - stretch,
							borderLeftWidth: stretch,
							borderLeftColor: tokens.accent,
						}),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.45) },
			headerName: {
				fontSize: size.heading * 2.15,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2.15),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "600" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
