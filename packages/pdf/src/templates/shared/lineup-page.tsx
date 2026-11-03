import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { TemplateColorRoles, TemplateFeatures, TemplateFeatureStyleSlots, TemplateStyleSlots } from "./types";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Page, View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { useRenderedSectionIds, useResolvedNode } from "../../semantic/context";
import { semanticNodeKeys } from "../../semantic/node-keys";
import { TemplateProvider } from "./context";
import { filterSections } from "./filtering";
import { SemanticRegionView, SemanticTemplatePartView } from "./primitives";
import { createRtlStyleHelpers } from "./rtl";
import { Section } from "./sections";
import { composeStyles } from "./styles";
import { TemplateHeader, useTemplateBase } from "./template-base";
import { createDesignTokens, createLineupStyles } from "./tokens";

/** The slots a lineup template's header and page take, on top of the shared section slots. */
type LineupStyles = Omit<TemplateStyleSlots, "page"> & {
	page: Style;
	header: Style;
	picture: Style;
	headerTitle: Style;
	headerIdentity: Style;
	headerName: Style;
	headerHeadline?: Style;
	contactList: Style;
	contactItem: Style;
	contactText?: Style;
	sectionGroup: Style;
	/** Two-column templates: the row of columns, and each column. */
	columns?: Style;
	sidebarColumn?: Style;
	mainColumn?: Style;
};

export type LineupTemplate = {
	colors: TemplateColorRoles;
	styles: LineupStyles;
	features?: TemplateFeatures;
	featureStyles?: TemplateFeatureStyleSlots;
};

type OneColumnLayoutProps = TemplatePageProps & {
	template: LineupTemplate;
	/** Drawn first on every page, such as a rule along the top edge. */
	decoration?: ReactNode;
	/** Replaces the shared header (name, headline, contact list). */
	header?: ReactNode;
	/** Prints the contact list beside the name block instead of under it. */
	contactListOutsideTitle?: boolean;
};

/** The shared header of the lineup: picture, name, headline and contact list, styled by the template. */
const LineupHeader = ({
	styles,
	contactListOutsideTitle = false,
}: {
	styles: LineupStyles;
	contactListOutsideTitle?: boolean;
}) => (
	<TemplateHeader
		contactListOutsideTitle={contactListOutsideTitle}
		styles={{
			header: styles.header,
			picture: styles.picture,
			title: styles.headerTitle,
			identity: styles.headerIdentity,
			name: styles.headerName,
			headline: styles.headerHeadline,
			contactList: styles.contactList,
			contactItem: styles.contactItem,
			contactText: styles.contactText,
		}}
	/>
);

/**
 * One reading column: the header, then the main sections, then the sidebar sections under them. Every one-column
 * template of the lineup draws through this; they differ in their styles.
 */
export const OneColumnLayout = ({
	page,
	pageSize,
	pageMinHeightStyle,
	showHeader,
	pageNumber,
	template,
	decoration,
	header,
	contactListOutsideTitle,
}: OneColumnLayoutProps) => {
	const data = useRender();
	const pageNodeKey = semanticNodeKeys.page(pageNumber);
	const { style: semanticPageStyle, size: semanticPageSize, ...semanticPageProps } = useResolvedNode(pageNodeKey);
	const { colors, styles, features, featureStyles } = template;
	const mainSections = useRenderedSectionIds(pageNodeKey, filterSections(page.main, data));
	const sidebarSections = useRenderedSectionIds(pageNodeKey, filterSections(page.sidebar, data));

	return (
		<Page
			{...semanticPageProps}
			size={semanticPageSize ?? pageSize}
			style={composeStyles(styles.page, pageMinHeightStyle, semanticPageStyle)}
		>
			<TemplateProvider
				pageNodeKey={pageNodeKey}
				styles={styles}
				colors={colors}
				{...(features ? { features } : {})}
				{...(featureStyles ? { featureStyles } : {})}
			>
				{decoration}
				{showHeader &&
					(header ?? (
						<LineupHeader styles={styles} {...(contactListOutsideTitle ? { contactListOutsideTitle } : {})} />
					))}

				<SemanticRegionView region="main" style={styles.sectionGroup}>
					{mainSections.map((section) => (
						<Section key={section} section={section} placement="main" />
					))}
				</SemanticRegionView>

				{!page.fullWidth && (
					<SemanticRegionView region="sidebar" style={styles.sectionGroup}>
						{sidebarSections.map((section) => (
							<Section key={section} section={section} placement="sidebar" />
						))}
					</SemanticRegionView>
				)}
			</TemplateProvider>
		</Page>
	);
};

/**
 * What a lineup template's style hook starts from: the base template values plus the design tokens, the template
 * colours and a tracking helper that leaves Arabic script alone (letter-spacing breaks its joins).
 */
export const useLineupBase = () => {
	const base = useTemplateBase();
	return useMemo(() => {
		const { metadata, r, foreground, background, primary } = base;
		const tokens = createDesignTokens({ metadata, foreground, background, primary });
		const colors: TemplateColorRoles = { foreground, background, primary };
		const tracking = (em: number, fontSize: number): Style => (r.rtl ? {} : { letterSpacing: em * fontSize });
		const lineup = createLineupStyles({ base: base.base, tokens });
		return { ...base, tokens, colors, tracking, lineup };
	}, [base]);
};

type TwoColumnLayoutProps = TemplatePageProps & {
	template: LineupTemplate;
	/** Whether the template draws its sidebar at the end of the line (right, left-to-right). */
	sidebarEnd: boolean;
	headerPlacement: "full-width" | "main-only" | "sidebar-only";
	/** Paints the sidebar column this colour down the whole page, margins included. */
	sidebarBand?: string | undefined;
	/** Replaces the shared header. */
	header?: ReactNode;
	/** Drawn first on every page. */
	decoration?: ReactNode;
	contactListOutsideTitle?: boolean;
};

/**
 * A sidebar column beside the main one, at the sidebar width chosen in Design and on the side chosen there. The page's
 * horizontal margin moves into the columns, so a sidebar band can reach the paper's edge while its text keeps the
 * margin; the gutter between the columns scales with the type.
 */
export const TwoColumnLayout = ({
	page,
	pageSize,
	pageMinHeightStyle,
	showHeader,
	pageNumber,
	template,
	sidebarEnd,
	headerPlacement,
	sidebarBand,
	header,
	decoration,
	contactListOutsideTitle,
}: TwoColumnLayoutProps) => {
	const data = useRender();
	const { metadata, columnsReversed } = data;
	const pageNodeKey = semanticNodeKeys.page(pageNumber);
	const { style: semanticPageStyle, size: semanticPageSize, ...semanticPageProps } = useResolvedNode(pageNodeKey);
	const { colors, styles, features, featureStyles } = template;
	const mainSections = useRenderedSectionIds(pageNodeKey, filterSections(page.main, data));
	const sidebarSections = useRenderedSectionIds(pageNodeKey, filterSections(page.sidebar, data));
	const r = createRtlStyleHelpers(data.rtl, columnsReversed);
	const margin = metadata.page.marginX;
	const gutter = metadata.typography.body.fontSize * (sidebarBand ? 1.6 : 2.2);
	const sidebarWidth = `${metadata.layout.sidebarWidth}%`;
	// Without sidebar sections the page reads as one column, unless the header lives in the sidebar.
	const showSidebar = !page.fullWidth || (showHeader && headerPlacement === "sidebar-only");
	const headerNode = header ?? (
		<LineupHeader styles={styles} {...(contactListOutsideTitle ? { contactListOutsideTitle } : {})} />
	);
	const bandSide = sidebarEnd !== columnsReversed ? "right" : "left";
	const { rowGap: sectionGap = 0 } = styles.sectionGroup;

	const sidebarColumn = showSidebar && (
		<View
			key="sidebar"
			style={composeStyles(
				{ width: sidebarWidth, flexShrink: 0, rowGap: sectionGap },
				sidebarEnd ? r.columnInset(gutter / 2, margin) : r.columnInset(margin, gutter / 2),
				styles.sidebarColumn,
			)}
		>
			{showHeader && headerPlacement === "sidebar-only" && headerNode}
			{!page.fullWidth && (
				<SemanticRegionView region="sidebar" style={styles.sectionGroup}>
					{sidebarSections.map((section) => (
						<Section key={section} section={section} placement="sidebar" />
					))}
				</SemanticRegionView>
			)}
		</View>
	);
	const mainColumn = (
		<View
			key="main"
			style={composeStyles(
				{ flex: 1, minWidth: 0, rowGap: sectionGap },
				!showSidebar
					? { paddingHorizontal: margin }
					: sidebarEnd
						? r.columnInset(margin, gutter / 2)
						: r.columnInset(gutter / 2, margin),
				styles.mainColumn,
			)}
		>
			{showHeader && headerPlacement === "main-only" && headerNode}
			<SemanticRegionView region="main" style={styles.sectionGroup}>
				{mainSections.map((section) => (
					<Section key={section} section={section} placement="main" />
				))}
			</SemanticRegionView>
		</View>
	);

	return (
		<Page
			{...semanticPageProps}
			size={semanticPageSize ?? pageSize}
			style={composeStyles(styles.page, { paddingHorizontal: 0 }, pageMinHeightStyle, semanticPageStyle)}
		>
			<TemplateProvider
				pageNodeKey={pageNodeKey}
				styles={styles}
				colors={colors}
				{...(features ? { features } : {})}
				{...(featureStyles ? { featureStyles } : {})}
			>
				{sidebarBand && showSidebar && (
					<SemanticTemplatePartView
						ownerNodeKey={semanticNodeKeys.region(pageNodeKey, "sidebar")}
						partKeys={["sidebar-background"]}
						fixed
						style={{
							position: "absolute",
							top: 0,
							bottom: 0,
							[bandSide]: 0,
							width: sidebarWidth,
							backgroundColor: sidebarBand,
						}}
					/>
				)}
				{decoration}
				{showHeader && headerPlacement === "full-width" && headerNode}
				<View style={composeStyles({ flexDirection: r.columns, flexGrow: 1 }, styles.columns)}>
					{sidebarEnd ? [mainColumn, sidebarColumn] : [sidebarColumn, mainColumn]}
				</View>
			</TemplateProvider>
		</Page>
	);
};
