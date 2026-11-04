import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Meridian: the default template. A clean Swiss page: a large name over an accent headline, a muted contact line, a
 * hairline under the header, and small uppercase section labels with a rule running to the margin.
 */
export const MeridianPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useMeridian()} />;

const useMeridian = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.6);

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
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accent,
				...tracking(0.06, size.label),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.label * 1.25 },
			sectionHeadingRule: { borderTopWidth: 0.6, borderTopColor: tokens.hairline },
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(2.6),
				borderBottomWidth: 0.75,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.35) },
			headerName: {
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2.1),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accent, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
