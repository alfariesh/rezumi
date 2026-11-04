import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import type { TemplateStyleContext } from "../shared/types";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Purnama ("full moon"): a night sidebar. The accent, ideally deep, fills the left column, where a large serif name,
 * the portrait and the contact lines glow in light text; the main column stays white and quiet.
 */
export const PurnamaPage = (props: TemplatePageProps) => {
	const template = usePurnama();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd={false}
			headerPlacement="sidebar-only"
			sidebarBand={template.colors.sidebarBackground}
		/>
	);
};

/** A slot that reads one way in the main column and another in the sidebar. */
const bySide =
	(main: Style, sidebar: Style) =>
	({ placement }: TemplateStyleContext) =>
		placement === "sidebar" ? sidebar : main;

const usePurnama = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const light = tokens.onAccent;
		const lightMuted = mixColors(light, tokens.accent, 0.72);
		const lightRule = mixColors(light, tokens.accent, 0.25);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			sidebarColumn: { paddingTop: metrics.gapY(0.4) },
			header: { flexDirection: "column", rowGap: metrics.gapY(1.6), paddingBottom: metrics.gapY(1.4) },
			headerTitle: { rowGap: metrics.gapY(1.4) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontSize: size.heading * 1.75,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				color: light,
				...tracking(0.01, size.heading * 1.75),
			},
			headerHeadline: { fontSize: size.body, color: lightMuted, lineHeight: 1.35 },
			contactList: { flexDirection: "column", rowGap: size.meta * 0.55 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.6 },
			contactText: { color: light, fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: tokens.accent, sidebarForeground: light },
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
				levelItem: bySide({ borderColor: tokens.accent }, { borderColor: light }),
				levelItemActive: bySide({ backgroundColor: tokens.accent }, { backgroundColor: light }),
				sectionHeading: bySide(
					{ fontSize: size.heading * 1.05, fontWeight: tokens.headingWeight, lineHeight: 1.15, color: tokens.ink },
					{
						fontSize: size.label,
						fontWeight: "600",
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: lightMuted,
						fontFamily: base.text.fontFamily,
						...tracking(0.06, size.label),
					},
				),
				sectionHeadingContainer: bySide({ alignItems: "center", columnGap: size.label * 1.25 }, {}),
				sectionHeadingRule: bySide(
					{ borderTopWidth: 0.6, borderTopColor: tokens.hairline },
					{
						borderTopWidth: 0.6,
						borderTopColor: lightRule,
					},
				),
				contactIcon: { size: size.meta, color: light },
				contactLabel: { color: lightMuted },
				icon: ({ placement }: TemplateStyleContext) => ({
					size: size.meta,
					color: placement === "sidebar" ? light : tokens.accent,
				}),
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
