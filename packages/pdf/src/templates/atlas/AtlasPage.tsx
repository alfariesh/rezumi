import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Atlas: a Swiss grid. Section titles sit in a narrow column at the left edge, the entries in the wide column beside them, each section under a hairline that spans the page.
 */
export const AtlasPage = (props: TemplatePageProps) => (
	<OneColumnLayout {...props} contactListOutsideTitle template={useAtlas()} />
);

const useAtlas = (): LineupTemplate => {
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
			section: {
				flexDirection: r.row,
				alignItems: "flex-start",
				columnGap: size.body * 1.8,
				borderTopWidth: 0.6,
				borderTopColor: tokens.hairline,
				paddingTop: metrics.gapY(1.2),
			},
			sectionHeading: {
				width: "22%",
				flexShrink: 0,
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: (size.body * 1.45) / size.label,
				color: tokens.accent,
				...tracking(0.06, size.label),
			},
			sectionItems: { flex: 1, rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.row,
				alignItems: "flex-end",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(1.6),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(0.4) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.35) },
			headerName: {
				fontSize: size.heading * 2.05,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.05),
			},
			headerHeadline: { fontSize: size.body * 1.08, color: tokens.muted },
			contactList: {
				flexDirection: "column",
				alignItems: r.rtl ? "flex-start" : "flex-end",
				rowGap: size.meta * 0.3,
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
