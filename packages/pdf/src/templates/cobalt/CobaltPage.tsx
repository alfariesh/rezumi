import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Cobalt: an executive page with a firm hand. A solid accent bar stands beside the name block, and section titles are
 * tracked capitals behind a small accent square over a full-width rule.
 */
export const CobaltPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useCobalt()} />;

const useCobalt = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const titleSize = size.body * 0.95;
		const square = size.body * 0.5;

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
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.25,
				color: tokens.ink,
				borderBottomWidth: 0.9,
				borderBottomColor: tokens.subtle,
				paddingBottom: size.body * 0.3,
				...tracking(0.05, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.6 },
			sectionHeadingMarker: { width: square, height: square, backgroundColor: tokens.accent },
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(0.8),
			},
			// The accent bar stands along the name block's start edge.
			headerTitle: {
				flex: 1,
				rowGap: metrics.gapY(1.2),
				paddingVertical: size.body * 0.15,
				...(r.rtl
					? { borderRightWidth: 4, borderRightColor: tokens.accent, paddingRight: size.body * 1.3 }
					: { borderLeftWidth: 4, borderLeftColor: tokens.accent, paddingLeft: size.body * 1.3 }),
			},
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.45) },
			headerName: {
				fontSize: size.heading * 2.2,
				lineHeight: 1.06,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.2),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "600" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
