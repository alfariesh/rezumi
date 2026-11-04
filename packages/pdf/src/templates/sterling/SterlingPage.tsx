import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Sterling: the classic Wall Street page. A centred header with the name in tracked capitals, and ruled capital section titles; quiet and authoritative for finance, law and consulting.
 */
export const SterlingPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useSterling()} />;

const useSterling = (): LineupTemplate => {
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
				fontSize: size.body * 0.98,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.25,
				color: tokens.accent,
				borderBottomWidth: 0.75,
				borderBottomColor: tokens.accent,
				paddingBottom: size.body * 0.2,
				...tracking(0.1, size.body),
			},
			sectionItems: { rowGap: metrics.gapY(1.2) },
			item: { rowGap: metrics.gapY(0.25) },
			header: { flexDirection: "column", alignItems: "center", rowGap: metrics.gapY(1.2) },
			headerTitle: { alignItems: "center", rowGap: metrics.gapY(1) },
			headerIdentity: { alignItems: "center", textAlign: "center", rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 1.85,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				textAlign: "center",
				...tracking(0.14, size.heading * 1.85),
			},
			headerHeadline: { fontSize: size.body * 1.05, color: tokens.muted, textAlign: "center" },
			contactList: {
				flexDirection: r.row,
				flexWrap: "wrap",
				justifyContent: "center",
				columnGap: size.meta * 1.6,
				rowGap: size.meta * 0.35,
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.4 },
			contactText: { fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta * 0.95, color: tokens.muted } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
