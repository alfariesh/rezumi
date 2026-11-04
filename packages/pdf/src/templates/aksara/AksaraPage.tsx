import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Aksara: an editorial page set like a magazine feature. A small capital kicker over a large display name, hairlines between sections and serif section titles; for writers, designers and communications roles.
 */
export const AksaraPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useAksara()} />;

const useAksara = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

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
			section: {
				flexDirection: "column",
				rowGap: metrics.gapY(0.9),
				borderTopWidth: 0.6,
				borderTopColor: tokens.hairline,
				paddingTop: metrics.gapY(1.3),
			},
			sectionHeading: {
				fontSize: size.heading * 1.12,
				fontWeight: "400",
				lineHeight: 1.15,
				color: tokens.ink,
				...tracking(-0.005, size.heading * 1.12),
			},
			sectionItems: { rowGap: metrics.gapY(1.35) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "flex-end",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(0.6),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.4) },
			// The headline reads first, as the kicker over the name.
			headerIdentity: { ...r.headerIdentity, flexDirection: "column-reverse", rowGap: metrics.gapY(0.7) },
			headerName: {
				fontSize: size.heading * 2.8,
				lineHeight: 1,
				fontWeight: "400",
				...tracking(-0.02, size.heading * 2.8),
			},
			headerHeadline: {
				fontSize: size.label,
				fontWeight: "600",
				textTransform: "uppercase",
				color: tokens.accent,
				...tracking(0.06, size.label),
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
