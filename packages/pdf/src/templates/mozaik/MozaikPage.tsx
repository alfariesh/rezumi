import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Mozaik ("mosaic"): a bento page. The header is a solid tile of the accent with the name in light text, and every
 * section sits on its own soft rounded tile, the gaps between them doing the work of rules.
 */
export const MozaikPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useMozaik()} />;

const useMozaik = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const tileGap = metrics.gapY(1.3);
		const radius = size.body * 1;
		const padding = size.body * 1.15;
		const onTile = tokens.onAccent;
		const onTileMuted = mixColors(onTile, tokens.accent, 0.8);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: {
				...base.page,
				paddingHorizontal: metrics.page.paddingHorizontal,
				paddingVertical: metrics.page.paddingVertical,
				rowGap: tileGap,
			},
			sectionGroup: { flexDirection: "column", rowGap: tileGap },
			section: {
				flexDirection: "column",
				rowGap: metrics.gapY(0.9),
				backgroundColor: mixColors(tokens.ink, tokens.background, 0.04),
				borderRadius: radius,
				paddingHorizontal: padding,
				paddingVertical: padding * 0.9,
			},
			sectionHeading: {
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accentText,
				...tracking(0.06, size.label),
			},
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2,
				backgroundColor: tokens.accent,
				borderRadius: radius,
				padding: padding * 1.3,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.3) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.3,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				color: onTile,
				...tracking(-0.025, size.heading * 2.3),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: onTileMuted, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.4 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: onTile, fontSize: size.meta },
		});

		return {
			colors,
			styles: {
				...styles,
				icon: { size: size.meta, color: tokens.accentText },
				contactIcon: { size: size.meta, color: onTile },
				contactLabel: { color: onTileMuted },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
