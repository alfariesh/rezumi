import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import type { TemplateStyleContext } from "../shared/types";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors, readableAccent } from "../shared/tokens";

/** The sidebar's charcoal: a neutral near-black, whatever the accent, so a bright accent glows on it. */
const CHARCOAL = "#262a31";

/**
 * Graphite: a charcoal column down the right of every page, its labels lit in the accent, beside a white main column
 * that the name leads. Bright accents (gold, amber, cyan) shine on the dark side and stay readable on the light one.
 */
export const GraphitePage = (props: TemplatePageProps) => {
	const template = useGraphite();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd
			headerPlacement="main-only"
			sidebarBand={template.colors.sidebarBackground}
		/>
	);
};

const useGraphite = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const light = "#ffffff";
		const lightMuted = mixColors(light, CHARCOAL, 0.66);
		const lightRule = mixColors(light, CHARCOAL, 0.2);
		const glow = readableAccent(tokens.accent, CHARCOAL);
		const label = {
			fontSize: size.label,
			fontWeight: tokens.headingWeight,
			textTransform: "uppercase",
			lineHeight: 1.2,
			...tracking(0.06, size.label),
		} as const;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: { paddingTop: metrics.gapY(0.6) },
			header: {
				flexDirection: r.row,
				alignItems: "center",
				columnGap: size.body * 1.6,
				paddingBottom: metrics.gapY(1.6),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.25,
				lineHeight: 1.04,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.25),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.muted, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: CHARCOAL, sidebarForeground: light },
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				text: bySide(styles.text, { ...styles.text, color: light }),
				richParagraph: bySide(styles.richParagraph, { ...styles.richParagraph, color: light }),
				richListItemContent: bySide(styles.richListItemContent, { ...styles.richListItemContent, color: light }),
				richListItemMarker: bySide(styles.richListItemMarker, { ...styles.richListItemMarker, color: lightMuted }),
				small: bySide(styles.small, { ...styles.small, color: lightMuted }),
				alignEnd: bySide(styles.alignEnd, { ...styles.alignEnd, color: lightMuted }),
				link: bySide(styles.link, { ...styles.link, color: light }),
				levelItem: bySide({ borderColor: tokens.accent }, { borderColor: glow }),
				levelItemActive: bySide({ backgroundColor: tokens.accent }, { backgroundColor: glow }),
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.05,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.05),
					},
					{ ...label, color: glow },
				),
				sectionHeadingContainer: { alignItems: "center", columnGap: size.label * 1.2 },
				sectionHeadingRule: bySide(
					{ borderTopWidth: 1.5, borderTopColor: tokens.accent },
					{ borderTopWidth: 0.6, borderTopColor: lightRule },
				),
				icon: ({ placement }: TemplateStyleContext) => ({
					size: size.meta,
					color: placement === "sidebar" ? glow : tokens.accentText,
				}),
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
