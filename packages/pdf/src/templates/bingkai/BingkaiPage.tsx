import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";
import { mixColors } from "../shared/tokens";

/**
 * Bingkai ("frame"): a classic page inside a fine double frame, the outer line in the accent and a hairline just
 * inside it, on every page. A serif name over a quiet contact line, a portrait at the end, and ruled capital titles.
 */
export const BingkaiPage = (props: TemplatePageProps) => (
	<OneColumnLayout {...props} decoration={<Frame />} template={useBingkai()} />
);

/**
 * One rectangle of the frame, drawn as four filled lines: Forme splits a fixed view that runs past the page's content
 * box into two pieces, which a fill hides but a border would show as an extra edge.
 */
const FrameLines = ({ inset, width, color }: { inset: number; width: number; color: string }) => {
	const line = { position: "absolute", backgroundColor: color } as const;
	return (
		<>
			<View fixed style={{ ...line, top: inset, left: inset, right: inset, height: width }} />
			<View fixed style={{ ...line, bottom: inset, left: inset, right: inset, height: width }} />
			<View fixed style={{ ...line, top: inset, bottom: inset, left: inset, width }} />
			<View fixed style={{ ...line, top: inset, bottom: inset, right: inset, width }} />
		</>
	);
};

/** The double frame, inset from the paper's edge by part of the page margin. */
const Frame = () => {
	const { tokens, metadata } = useLineupBase();
	const inset = Math.min(metadata.page.marginX, metadata.page.marginY) * 0.42;
	return (
		<>
			<FrameLines inset={inset} width={1.1} color={tokens.accent} />
			<FrameLines inset={inset + 3.4} width={0.5} color={mixColors(tokens.accent, tokens.background, 0.45)} />
		</>
	);
};

const useBingkai = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.3);
		const titleSize = size.body * 0.92;

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.85) },
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.3,
				color: tokens.accentText,
				borderBottomWidth: 0.75,
				borderBottomColor: mixColors(tokens.accent, tokens.background, 0.55),
				paddingBottom: size.body * 0.22,
				...tracking(0.05, titleSize),
			},
			sectionItems: { rowGap: metrics.gapY(1.25) },
			item: { rowGap: metrics.gapY(0.25) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 1.8,
				paddingBottom: metrics.gapY(1.8),
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.55) },
			headerName: {
				fontSize: size.heading * 1.95,
				lineHeight: 1.12,
				fontWeight: tokens.headingWeight,
				...tracking(-0.01, size.heading * 1.95),
			},
			headerHeadline: { fontSize: size.body * 1.05, color: tokens.muted },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.6, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { fontSize: size.meta, color: tokens.muted },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
