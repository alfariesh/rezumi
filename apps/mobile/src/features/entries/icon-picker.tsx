// The icon printed before an entry or a custom contact field: the resume icon set, searchable, in a sheet.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { FlatList, Pressable } from "react-native";
import { SvgXml } from "react-native-svg";
import iconPaths from "@rezumi/pdf/icons";
import { icons as resumeIcons } from "@rezumi/schema/icons";
import { upgradeIconName } from "@rezumi/schema/resume/icon-names";
import { EmptyState, Icon, SearchField, Sheet, size, useThemeColor } from "@/ui";

type IconPickerSheetProps = {
	isOpen: boolean;
	value: string;
	onOpenChange: (isOpen: boolean) => void;
	onChange: (icon: string) => void;
};

const paths = iconPaths as Record<string, string>;

/** The drawing for a resume icon name (a former Phosphor name draws its closest match); undefined for none. */
function drawingOf(name: string): string | undefined {
	const icon = upgradeIconName(name);
	return icon && icon !== "none" && Object.hasOwn(paths, icon) ? paths[icon] : undefined;
}

/** Whether a resume icon name draws anything. */
export const hasResumeIcon = (name: string) => drawingOf(name) !== undefined;

type ResumeIconGlyphProps = { name: string; size?: number };

/**
 * A resume icon drawn as it prints, for showing the current choice: icon ids are English file names, not labels.
 * Hidden from screen readers; the control it sits in carries the label.
 */
export function ResumeIconGlyph({ name, size: side = size.icon.md }: ResumeIconGlyphProps) {
	const [foreground] = useThemeColor(["foreground"]);
	const drawing = drawingOf(name);
	if (!drawing) return null;
	return (
		<SvgXml
			xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${drawing}</svg>`}
			color={foreground}
			width={side}
			height={side}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			testID={`resume-icon-${name}`}
		/>
	);
}

export function IconPickerSheet({ isOpen, value, onOpenChange, onChange }: IconPickerSheetProps) {
	const { t } = useLingui();
	const [foreground, selected, pressedColor] = useThemeColor(["foreground", "accent-soft", "default"]);
	const [query, setQuery] = useState("");
	const [columns, setColumns] = useState(1);
	// The grid is a virtualized list: a tracked detent gives the sheet a bounded viewport (zero height on Android otherwise).
	const [detent, setDetent] = useState(0);
	const search = query.trim().toLowerCase();
	const names = resumeIcons.filter((name) => !name || (Object.hasOwn(paths, name) && name.includes(search)));

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Icon`}
			closeLabel={t`Close`}
			detents={[0.6, 1]}
			scroll={false}
			detent={detent}
			onDetentChange={setDetent}
		>
			<SearchField value={query} onChange={setQuery}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input placeholder={t`Search icons`} accessibilityLabel={t`Search icons`} />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<FlatList
				key={columns}
				className="mt-3 flex-1"
				onLayout={({ nativeEvent: { layout } }) => setColumns(Math.max(1, Math.floor(layout.width / size.hit)))}
				numColumns={columns}
				data={isOpen ? names : []}
				extraData={value}
				keyExtractor={(name) => name || "none"}
				keyboardShouldPersistTaps="handled"
				nestedScrollEnabled
				renderItem={({ item: name }) => (
					<Pressable
						accessibilityRole="radio"
						accessibilityLabel={name || t`No icon`}
						accessibilityState={{ checked: value === name }}
						onPress={() => onChange(name)}
						style={({ pressed }) => [
							{
								width: `${100 / columns}%`,
								minHeight: size.hit,
								alignItems: "center",
								justifyContent: "center",
								borderRadius: 8,
								backgroundColor: value === name ? selected : pressed ? pressedColor : "transparent",
							},
						]}
					>
						{name ? (
							<SvgXml
								xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${paths[name]}</svg>`}
								color={foreground}
								width={size.icon.lg}
								height={size.icon.lg}
							/>
						) : (
							<Icon name="x" />
						)}
					</Pressable>
				)}
				ListFooterComponent={
					search && names.length <= 1 ? (
						<EmptyState kind="filtered" title={t`No icons match “${query.trim()}”.`} />
					) : undefined
				}
			/>
		</Sheet>
	);
}
