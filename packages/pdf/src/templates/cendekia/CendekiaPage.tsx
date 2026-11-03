import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Cendekia: the academic CV. A quiet serif page with small capital section titles over a hairline, built to carry long lists of publications, grants and teaching; years read best in the date column.
 */
export const CendekiaPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useCendekia()} />;

const useCendekia = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.3);

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.8) },
			sectionHeading: {
				fontSize: size.body * 0.95,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.25,
				color: tokens.accent,
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
				paddingBottom: size.body * 0.2,
				...tracking(0.08, size.body),
			},
			sectionItems: { rowGap: metrics.gapY(1.1) },
			item: { rowGap: metrics.gapY(0.25) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(1.2),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.3) },
			headerName: { fontSize: size.heading * 1.9, lineHeight: 1.1, fontWeight: tokens.headingWeight },
			headerHeadline: { fontSize: size.body * 1.08, color: tokens.muted },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.4 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
