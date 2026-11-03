import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Vector: for developers and data people. The name in the body face; the headline, dates and section labels in the heading face (Vector suggests a monospace one); skills as small chips that can carry tool logos.
 */
export const VectorPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useVector()} />;

const useVector = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);

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
			alignEnd: { ...lineup.alignEnd, fontFamily: metadata.typography.heading.fontFamily, fontSize: size.small },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(2.2),
				borderBottomWidth: 0.75,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontFamily: metadata.typography.body.fontFamily,
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: "700",
				...tracking(-0.02, size.heading * 2.1),
			},
			headerHeadline: {
				fontFamily: metadata.typography.heading.fontFamily,
				fontSize: size.body * 0.98,
				color: tokens.accent,
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
