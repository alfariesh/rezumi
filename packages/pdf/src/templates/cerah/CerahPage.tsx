import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Cerah ("bright"): friendly and open. A round portrait leads the name, and every section title sits on a soft rounded
 * band of the accent with a small dot, so a short first resume still reads as finished.
 */
export const CerahPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useCerah()} />;

const useCerah = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.2);
		const titleSize = size.body * 1.02;
		const inset = size.body * 0.75;
		const dot = size.body * 0.42;

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
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.25,
				color: tokens.accentText,
				backgroundColor: tokens.accentSoft,
				borderRadius: size.body * 0.6,
				paddingVertical: size.body * 0.32,
				paddingHorizontal: inset,
				...tracking(0.005, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.55 },
			sectionHeadingMarker: { width: dot, height: dot, borderRadius: dot, backgroundColor: tokens.accent },
			// Entries line up with the title's text inside the band.
			sectionItems: { rowGap: metrics.gapY(1.3), paddingHorizontal: inset * 0.6 },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.row,
				alignItems: "center",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(0.8),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2.1),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "600" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.4 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
