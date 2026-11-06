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
import { mixColors } from "../shared/tokens";

type MenaraStyles = LineupTemplate["styles"] & { block: Style };

/**
 * Menara ("tower"): the left column stands like a tower. A solid block of the accent at its top holds the portrait,
 * the name and the contact lines in light text, and a faint wash of the accent carries the column down the page.
 */
export const MenaraPage = (props: TemplatePageProps) => {
	const template = useMenara();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd={false}
			headerPlacement="sidebar-only"
			sidebarBand={template.colors.sidebarBackground}
			header={<MenaraHeader styles={template.styles} />}
		/>
	);
};

/**
 * The header with its block of colour drawn by an inner view: Forme stretches a view placed first in a column to the
 * column's height, so the header itself carries no fill.
 */
const MenaraHeader = ({ styles }: { styles: MenaraStyles }) => {
	const { basics, picture } = useRender();
	return (
		<SemanticHeaderView style={styles.header}>
			<View style={styles.block}>
				{hasTemplatePicture(picture) && <SemanticHeaderPicture src={picture.url} style={styles.picture} />}
				<View style={styles.headerTitle}>
					<View style={styles.headerIdentity}>
						<Heading style={styles.headerName}>{basics.name}</Heading>
						<Text style={styles.headerHeadline}>{basics.headline}</Text>
					</View>
					<HeaderContactList styles={styles} />
				</View>
			</View>
		</SemanticHeaderView>
	);
};

const useMenara = (): LineupTemplate & { styles: MenaraStyles } => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const { marginX, marginY } = metadata.page;
		// The column's own padding (see `TwoColumnLayout`): the block reaches past it to the band's edges.
		const gutterHalf = (metadata.typography.body.fontSize * 1.6) / 2;
		const { paddingLeft = 0, paddingRight = 0 } = r.columnInset(marginX, gutterHalf);
		const light = tokens.onAccent;
		const lightMuted = mixColors(light, tokens.accent, 0.78);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: { flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start" },
			block: {
				flexDirection: "column",
				rowGap: metrics.gapY(1.4),
				backgroundColor: tokens.accent,
				marginTop: -marginY,
				marginLeft: -Number(paddingLeft),
				marginRight: -Number(paddingRight),
				marginBottom: metrics.gapY(1.2),
				paddingTop: marginY * 1.1,
				paddingBottom: marginY * 0.9,
				paddingLeft: Number(paddingLeft),
				paddingRight: Number(paddingRight),
			},
			headerTitle: { rowGap: metrics.gapY(1.3) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.45) },
			headerName: {
				fontSize: size.heading * 1.7,
				lineHeight: 1.06,
				fontWeight: tokens.headingWeight,
				color: light,
				...tracking(-0.01, size.heading * 1.7),
			},
			headerHeadline: { fontSize: size.body, color: lightMuted, lineHeight: 1.35 },
			contactList: { flexDirection: "column", rowGap: size.meta * 0.5 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.6 },
			contactText: { color: light, fontSize: size.meta },
		});

		return {
			colors: { ...colors, sidebarBackground: tokens.accentSoft, sidebarForeground: tokens.ink },
			features: { stackSidebarItemHeader: true },
			styles: {
				...styles,
				sectionHeading: bySide(
					{
						fontSize: size.heading * 1.05,
						fontWeight: tokens.headingWeight,
						lineHeight: 1.15,
						color: tokens.ink,
						...tracking(-0.01, size.heading * 1.05),
					},
					{
						fontSize: size.label,
						fontWeight: tokens.headingWeight,
						textTransform: "uppercase",
						lineHeight: 1.2,
						color: tokens.accentText,
						...tracking(0.06, size.label),
					},
				),
				sectionHeadingContainer: { alignItems: "center", columnGap: size.label * 1.2 },
				sectionHeadingRule: bySide(
					{ borderTopWidth: 0.6, borderTopColor: tokens.hairline },
					{ borderTopWidth: 0.6, borderTopColor: mixColors(tokens.accent, tokens.background, 0.25) },
				),
				contactIcon: { size: size.meta, color: light },
				contactLabel: { color: lightMuted },
				icon: { size: size.meta, color: tokens.accentText },
			},
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
