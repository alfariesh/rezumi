import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { bySide, TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { hasTemplatePicture } from "../shared/picture";
import { Heading, SemanticHeaderPicture, SemanticHeaderView, Text } from "../shared/primitives";
import { HeaderContactList } from "../shared/template-base";

type MarqueeStyles = LineupTemplate["styles"] & { headerTop: Style; headerRule: Style };

/**
 * Marquee: the name in lights. A very large display name over a thick rule of the accent that crosses the page, the
 * headline and contact line beneath it, and the right column's sections set on soft rounded cards.
 */
export const MarqueePage = (props: TemplatePageProps) => {
	const template = useMarquee();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd
			headerPlacement="full-width"
			header={<MarqueeHeader styles={template.styles} />}
		/>
	);
};

const MarqueeHeader = ({ styles }: { styles: MarqueeStyles }) => {
	const { basics, picture } = useRender();
	return (
		<SemanticHeaderView style={styles.header}>
			<View style={styles.headerTop}>
				<View style={styles.headerTitle}>
					<View style={styles.headerIdentity}>
						<Heading style={styles.headerName}>{basics.name}</Heading>
					</View>
				</View>
				{hasTemplatePicture(picture) && <SemanticHeaderPicture src={picture.url} style={styles.picture} />}
			</View>
			<View style={styles.headerRule} />
			<Text style={styles.headerHeadline}>{basics.headline}</Text>
			<HeaderContactList styles={styles} />
		</SemanticHeaderView>
	);
};

const useMarquee = (): LineupTemplate & { styles: MarqueeStyles } => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		const nameSize = size.heading * 2.9;
		const card = size.body * 1;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: "column",
				rowGap: metrics.gapY(1),
				marginHorizontal: margin,
				marginBottom: metrics.gapY(2.6),
			},
			headerTop: {
				flexDirection: r.row,
				alignItems: "flex-end",
				columnGap: size.body * 2,
				marginBottom: metrics.gapY(0.4),
			},
			headerTitle: { flex: 1 },
			headerIdentity: { ...r.headerIdentity },
			headerName: {
				fontSize: nameSize,
				lineHeight: 0.98,
				fontWeight: tokens.headingWeight,
				...tracking(-0.03, nameSize),
			},
			headerRule: { height: 4.5, backgroundColor: tokens.accent, marginBottom: metrics.gapY(0.5) },
			headerHeadline: {
				fontSize: size.body * 1.15,
				fontWeight: "600",
				color: tokens.ink,
				...r.text,
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				// Sidebar sections each sit on a soft card.
				section: bySide(styles.section, {
					...styles.section,
					backgroundColor: tokens.accentSoft,
					borderRadius: card,
					padding: card,
				}),
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.08,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.08),
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
				sectionHeadingContainer: bySide({ alignItems: "center", columnGap: size.body * 0.7 }, {}),
				sectionHeadingRule: bySide({ borderTopWidth: 0.6, borderTopColor: tokens.hairline }, {}),
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
