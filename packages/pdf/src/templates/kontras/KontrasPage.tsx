import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Kontras ("contrast"): poster type. A tall condensed name over a heavy ink rule, section titles in the same display
 * face with a rule running on, and the accent kept for the headline and the small markers.
 */
export const KontrasPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useKontras()} />;

const useKontras = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const titleSize = size.heading * 1.2;
		const nameSize = size.heading * 3.1;

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
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				lineHeight: 1,
				color: tokens.ink,
				...tracking(0.02, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.7 },
			sectionHeadingMarker: { width: size.body * 0.9, height: size.body * 0.9, backgroundColor: tokens.accent },
			sectionHeadingRule: { borderTopWidth: 1, borderTopColor: tokens.ink },
			sectionItems: { rowGap: metrics.gapY(1.35) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "flex-end",
				columnGap: size.body * 2.2,
				paddingBottom: metrics.gapY(1.8),
				borderBottomWidth: 3,
				borderBottomColor: tokens.ink,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontSize: nameSize,
				lineHeight: 0.92,
				fontWeight: tokens.headingWeight,
				...tracking(0.01, nameSize),
			},
			headerHeadline: {
				fontSize: size.label * 1.12,
				fontWeight: "600",
				textTransform: "uppercase",
				color: tokens.accentText,
				...tracking(0.06, size.label * 1.12),
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
