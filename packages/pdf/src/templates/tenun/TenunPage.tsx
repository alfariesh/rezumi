import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Tenun: a structured grid in the spirit of the Japanese rirekisho and the Indonesian DRH, redrawn with hairlines. The header and every section are ruled boxes with a faintly tinted title band.
 */
export const TenunPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useTenun()} />;

const useTenun = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(1.6);
		const rule = tokens.subtle;
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
			section: { flexDirection: "column", borderWidth: 0.75, borderColor: rule },
			sectionHeading: {
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accent,
				backgroundColor: tokens.accentSoft,
				borderBottomWidth: 0.75,
				borderBottomColor: rule,
				paddingHorizontal: size.body * 0.8,
				paddingVertical: size.body * 0.4,
				...tracking(0.06, size.label),
			},
			sectionItems: {
				rowGap: metrics.gapY(1),
				paddingHorizontal: size.body * 0.8,
				paddingVertical: size.body * 0.7,
			},
			item: { rowGap: metrics.gapY(0.25) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "stretch",
				borderWidth: 0.75,
				borderColor: rule,
			},
			headerTitle: { flex: 1, padding: size.body * 0.9, rowGap: metrics.gapY(1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.3) },
			headerName: {
				fontSize: size.heading * 1.75,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(0.02, size.heading * 1.75),
			},
			headerHeadline: { fontSize: size.body * 1.05, color: tokens.muted },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.4 },
			contactText: { fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
