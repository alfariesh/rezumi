import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Tunas: compact and fresh for a first job or an internship. A tight rhythm to keep to one page, a short accent bar before each section title and a one-line contact row.
 */
export const TunasPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useTunas()} />;

const useTunas = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.0);

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.6) },
			sectionHeading: {
				fontSize: size.body * 1.02,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.2,
				color: tokens.ink,
				...tracking(0.01, size.body),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.5 },
			sectionHeadingMarker: { width: 3, height: size.body * 0.95, borderRadius: 1.5, backgroundColor: tokens.accent },
			sectionItems: { rowGap: metrics.gapY(1) },
			item: { rowGap: metrics.gapY(0.2) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2,
				paddingBottom: metrics.gapY(1.6),
				borderBottomWidth: 0.75,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(0.8) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.2) },
			headerName: {
				fontSize: size.heading * 1.7,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.01, size.heading * 1.7),
			},
			headerHeadline: { fontSize: size.body * 1.05, color: tokens.accent, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.4, rowGap: size.meta * 0.3 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.4 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
