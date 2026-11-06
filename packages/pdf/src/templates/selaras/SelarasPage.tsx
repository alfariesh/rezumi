import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Selaras ("in tune"): a split header, the name and headline on one side and the contact lines stacked on the other
 * behind a hairline. Section titles carry a short accent bar, and entries read best with their dates above them.
 */
export const SelarasPage = (props: TemplatePageProps) => (
	<OneColumnLayout {...props} contactListOutsideTitle template={useSelaras()} />
);

const useSelaras = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const titleSize = size.heading * 0.98;

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
			section: { flexDirection: "column", rowGap: metrics.gapY(1) },
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.2,
				color: tokens.ink,
				...tracking(-0.005, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.6 },
			sectionHeadingMarker: { width: size.body * 1.1, height: 2.2, borderRadius: 1.1, backgroundColor: tokens.accent },
			sectionHeadingRule: { borderTopWidth: 0.6, borderTopColor: tokens.hairline },
			sectionItems: { rowGap: metrics.gapY(1.45) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.row,
				alignItems: "center",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(2),
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(0.4) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.5) },
			headerName: {
				fontSize: size.heading * 2.05,
				lineHeight: 1.08,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.05),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "500" },
			// The contact lines stand in a column at the end of the header, behind a hairline.
			contactList: {
				flexDirection: "column",
				justifyContent: "center",
				rowGap: size.meta * 0.4,
				maxWidth: "42%",
				...(r.rtl
					? { borderRightWidth: 0.6, borderRightColor: tokens.hairline, paddingRight: size.body * 1.4 }
					: { borderLeftWidth: 0.6, borderLeftColor: tokens.hairline, paddingLeft: size.body * 1.4 }),
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.55 },
			contactText: { fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
