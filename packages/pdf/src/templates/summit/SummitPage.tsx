import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Summit: an executive page. A heavy accent rule along the top edge of every page, a commanding name over a tracked capital headline, and bold section titles underlined in the accent.
 */
export const SummitPage = (props: TemplatePageProps) => (
	<OneColumnLayout {...props} decoration={<TopRule />} template={useSummit()} />
);

/** The accent rule along the top edge, repeated on every page. */
const TopRule = () => {
	const { tokens } = useLineupBase();
	return (
		<View
			fixed
			style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: tokens.accent }}
		/>
	);
};

const useSummit = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.5);

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				alignSelf: "flex-start",
				fontSize: size.heading * 0.98,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.25,
				color: tokens.ink,
				borderBottomWidth: 1.5,
				borderBottomColor: tokens.accent,
				paddingBottom: size.body * 0.25,
			},
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(2.2),
				borderBottomWidth: 0.75,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.6) },
			headerName: {
				fontSize: size.heading * 2.35,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				...tracking(-0.025, size.heading * 2.35),
			},
			headerHeadline: {
				fontSize: size.label * 1.05,
				fontWeight: "600",
				textTransform: "uppercase",
				color: tokens.accent,
				...tracking(0.16, size.label),
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accent } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
