import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Ivory: Nordic quiet. A large name in a light weight, wide margins of white between sections, light section titles led
 * by a single accent dot, and nothing else drawn on the page; entries read best on one line.
 */
export const IvoryPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useIvory()} />;

const useIvory = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(3);
		const titleSize = size.heading * 1.18;
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
			section: { flexDirection: "column", rowGap: metrics.gapY(1.1) },
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.15,
				color: tokens.ink,
				...tracking(-0.005, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.65 },
			sectionHeadingMarker: { width: dot, height: dot, borderRadius: dot, backgroundColor: tokens.accent },
			sectionItems: { rowGap: metrics.gapY(1.5) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.6,
				paddingBottom: metrics.gapY(1.2),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.5) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.6) },
			headerName: {
				fontSize: size.heading * 2.75,
				lineHeight: 1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.025, size.heading * 2.75),
			},
			headerHeadline: { fontSize: size.body * 1.15, color: tokens.muted },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.8, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.muted } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
