import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Wibawa: the formal Indonesian CV. A portrait at the right of the header, the name and headline over a column of personal details (contact lines and labelled custom fields), and firm ruled section titles.
 */
export const WibawaPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useWibawa()} />;

const useWibawa = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.3);

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.8) },
			sectionHeading: {
				fontSize: size.body,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.25,
				color: tokens.accentText,
				borderBottomWidth: 1,
				borderBottomColor: tokens.accent,
				paddingBottom: size.body * 0.25,
				...tracking(0.06, size.body),
			},
			sectionItems: { rowGap: metrics.gapY(1.2) },
			item: { rowGap: metrics.gapY(0.25) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "flex-start",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(1),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.3) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.35) },
			headerName: {
				fontSize: size.heading * 1.85,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.01, size.heading * 1.85),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "500" },
			contactList: { flexDirection: "column", rowGap: size.body * 0.3 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.body * 0.5 },
			contactText: { fontSize: size.body },
			// The labels of the personal details take one width (room for "Tempat, tanggal lahir:"), so their values line up
			// as in a table.
			contactLabel: { color: tokens.muted, width: size.body * 11, flexShrink: 0 },
		});

		return {
			colors,
			features: { contactIconColumn: true },
			styles: { ...styles, icon: { size: size.body * 0.95, color: tokens.accentText } },
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
