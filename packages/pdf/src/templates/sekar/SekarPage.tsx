import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Sekar ("blossom"): a centred serif header, the portrait above the name, over two columns; the left column rests on
 * a soft rounded card of the accent and the main column reads in quiet serif titles.
 */
export const SekarPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useSekar()} sidebarEnd={false} headerPlacement="full-width" />
);

const useSekar = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		const inner = size.body * 1.2;
		// The card keeps part of the page margin outside it and puts the rest inside, around its text.
		const outside = margin * 0.5;
		const sidebarOnStart = r.columns === "row";
		const centred: Style = { alignItems: "center", textAlign: "center" };

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: {
				backgroundColor: tokens.accentSoft,
				borderRadius: size.body * 1.1,
				paddingTop: inner * 1.1,
				paddingBottom: inner,
				...(sidebarOnStart
					? { marginLeft: outside, paddingLeft: inner, paddingRight: inner }
					: { marginRight: outside, paddingLeft: inner, paddingRight: inner }),
			},
			mainColumn: { paddingTop: size.body * 0.4 },
			header: {
				flexDirection: "column",
				alignItems: "center",
				rowGap: metrics.gapY(1.3),
				marginHorizontal: margin,
				paddingBottom: metrics.gapY(2),
				marginBottom: metrics.gapY(2.2),
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { ...centred, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...centred, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontSize: size.heading * 2.35,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				textAlign: "center",
				...tracking(-0.01, size.heading * 2.35),
			},
			headerHeadline: {
				fontSize: size.label,
				fontWeight: "600",
				textTransform: "uppercase",
				textAlign: "center",
				color: tokens.accentText,
				...tracking(0.06, size.label),
			},
			contactList: {
				flexDirection: r.row,
				flexWrap: "wrap",
				justifyContent: "center",
				columnGap: size.meta * 1.6,
				rowGap: size.meta * 0.35,
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: tokens.accentSoft, sidebarForeground: tokens.ink },
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.18,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.005, size.heading * 1.18),
					},
					{
						fontSize: size.label,
						fontWeight: "600",
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: tokens.accentText,
						fontFamily: base.text.fontFamily,
						...tracking(0.06, size.label),
					},
				),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
