import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import type { TemplateStyleContext } from "../shared/types";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Kirana: a soft sidebar. A faint wash of the accent runs down the left column for skills, languages and the
 * supporting sections; the name, a round portrait and the contact row lead the main column.
 */
export const KiranaPage = (props: TemplatePageProps) => {
	const template = useKirana();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd={false}
			headerPlacement="main-only"
			sidebarBand={template.colors.sidebarBackground}
		/>
	);
};

/** A slot that reads one way in the main column and another in the sidebar. */
const bySide =
	(main: Style, sidebar: Style) =>
	({ placement }: TemplateStyleContext) =>
		placement === "sidebar" ? sidebar : main;

const useKirana = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const label: Style = {
			fontSize: size.label,
			fontWeight: tokens.headingWeight,
			textTransform: "uppercase",
			lineHeight: 1.2,
			color: tokens.accent,
			...tracking(0.12, size.label),
		};

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.row,
				alignItems: "center",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(1.4),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.3) },
			headerName: {
				fontSize: size.heading * 2,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accent, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: tokens.accentSoft, sidebarForeground: tokens.ink },
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{ fontSize: size.heading * 1.02, fontWeight: tokens.headingWeight, lineHeight: 1.2, color: tokens.accent },
					label,
				),
				icon: { size: size.meta, color: tokens.accent },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
