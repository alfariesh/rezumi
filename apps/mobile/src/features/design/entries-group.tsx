import type { DesignProps } from "./types";
import type { EntryHeader } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { entryHeaderOf } from "@rezumi/schema/resume/data";
import { FieldLabel } from "./section";
import { IconButton, Segment, Text, cx, haptics, listLayout } from "@/ui";

type BarProps = { tone?: "lead" | "accent"; className: string };

/** One line of text in a layout's wireframe: dark for the lead, light for the rest, accent for an eyebrow. */
function Bar({ tone, className }: BarProps) {
	return (
		<View
			className={cx(
				"rounded-sm",
				tone === "lead" ? "h-1 bg-foreground" : tone === "accent" ? "h-0.5 bg-accent" : "h-1 bg-muted/35",
				className,
			)}
		/>
	);
}

const ROW = "flex-row items-center justify-between gap-0.5";

const WIREFRAMES: Record<EntryHeader["layout"], ReactNode> = {
	stacked: (
		<>
			<View className={ROW}>
				<Bar tone="lead" className="w-[46%]" />
				<Bar className="w-[22%]" />
			</View>
			<View className={ROW}>
				<Bar className="w-[38%]" />
				<Bar className="w-[28%]" />
			</View>
		</>
	),
	inline: (
		<View className={ROW}>
			<View className="w-[68%] flex-row gap-0.5">
				<Bar tone="lead" className="w-[45%]" />
				<Bar className="w-[30%]" />
				<Bar className="w-[18%]" />
			</View>
			<Bar className="w-[22%]" />
		</View>
	),
	compact: (
		<>
			<View className={ROW}>
				<Bar tone="lead" className="w-[52%]" />
				<Bar className="w-[26%]" />
			</View>
			<View className="flex-row gap-0.5">
				<Bar className="w-[30%]" />
				<Bar className="w-[16%]" />
			</View>
		</>
	),
	"date-column": (
		<View className="flex-row items-center gap-1">
			<Bar className="w-[24%]" />
			<View className="flex-1 gap-1">
				<Bar tone="lead" className="w-[80%]" />
				<Bar className="w-[58%]" />
			</View>
		</View>
	),
	eyebrow: (
		<>
			<Bar tone="accent" className="w-[40%]" />
			<View className={ROW}>
				<Bar tone="lead" className="w-[58%]" />
				<Bar className="w-[24%]" />
			</View>
		</>
	),
};

/** Entries: how each Experience, Education and Volunteer header is laid out, which row leads, and its accent. */
export function EntriesGroup({ data, write, disabled }: DesignProps) {
	const { t } = useLingui();
	const entry = entryHeaderOf(data.metadata.design);
	// Old resumes have no entry settings: every change writes the whole object.
	const set = (value: Partial<EntryHeader>) =>
		write(
			"entry",
			(draft) => {
				draft.metadata.design.entry = { ...entryHeaderOf(draft.metadata.design), ...value };
			},
			true,
		);
	const names: Record<EntryHeader["layout"], string> = {
		stacked: t({ message: "Stacked", context: "Entry header layout" }),
		inline: t({ message: "One line", context: "Entry header layout" }),
		compact: t({ message: "Compact", context: "Entry header layout" }),
		"date-column": t({ message: "Date column", context: "Entry header layout" }),
		eyebrow: t({ message: "Eyebrow", context: "Entry header layout" }),
	};
	const rows = [
		{ id: "organization", name: t`Company`, detail: t`Location` },
		{ id: "role", name: t`Position`, detail: t`Date` },
	];
	if (entry.lead === "role") rows.reverse();
	const [first, second] = rows;

	return (
		<>
			<View className="gap-2">
				<FieldLabel label={t`Header layout`} note={t`Experience, Education and more`} />
				<View accessibilityRole="radiogroup" accessibilityLabel={t`Header layout`} className="flex-row flex-wrap gap-2">
					{(Object.keys(WIREFRAMES) as EntryHeader["layout"][]).map((layout) => {
						const selected = entry.layout === layout;
						return (
							<Pressable
								key={layout}
								accessibilityRole="radio"
								accessibilityLabel={names[layout]}
								accessibilityState={{ checked: selected, disabled }}
								disabled={disabled}
								onPress={() => {
									if (selected) return;
									haptics.selection();
									set({ layout });
								}}
								className={cx(
									"min-h-16 w-[31%] grow gap-1.5 rounded-xl px-2 pt-2.5 pb-1.5",
									selected ? "bg-accent-soft" : "bg-surface-secondary",
								)}
							>
								<View className="h-7 justify-center gap-1 px-0.5">{WIREFRAMES[layout]}</View>
								<Text
									size="xs"
									numberOfLines={1}
									weight={selected ? "semibold" : "normal"}
									tone={selected ? "default" : "muted"}
									className="text-center"
								>
									{names[layout]}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</View>

			<View className="gap-2">
				<FieldLabel label={t`Row order`} />
				{/* The two rows side by side, the first printed on the left; the button between them swaps them. */}
				<View className="flex-row items-center gap-2">
					{first ? <RowCard row={first} /> : null}
					<IconButton
						icon="arrows-left-right"
						variant="secondary"
						size="sm"
						isDisabled={disabled}
						label={entry.lead === "role" ? t`Swap rows: lead with company` : t`Swap rows: lead with position`}
						onPress={() => set({ lead: entry.lead === "role" ? "organization" : "role" })}
					/>
					{second ? <RowCard row={second} /> : null}
				</View>
			</View>

			<View className="gap-2">
				<FieldLabel label={t`Accent`} />
				<Segment<EntryHeader["accent"]>
					accessibilityLabel={t`Accent`}
					value={entry.accent}
					isDisabled={disabled}
					onValueChange={(accent) => set({ accent })}
					options={[
						{ value: "none", label: t({ message: "None", context: "Entry header accent" }) },
						{ value: "rule", label: t({ message: "Rule", context: "Entry header accent: a line under the header" }) },
						{ value: "bar", label: t({ message: "Bar", context: "Entry header accent: a bar beside the header" }) },
						{
							value: "band",
							label: t({ message: "Band", context: "Entry header accent: a tinted background behind the header" }),
						},
					]}
				/>
			</View>
		</>
	);
}

type RowCardProps = { row: { id: string; name: string; detail: string } };

/** One of the two header rows; it slides to its new side when the order swaps. */
function RowCard({ row }: RowCardProps) {
	return (
		<Animated.View
			layout={listLayout}
			className="h-11 min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-field bg-surface-secondary px-3"
		>
			<Text weight="medium" numberOfLines={1} className="shrink">
				{row.name}
			</Text>
			<Text size="xs" tone="muted" numberOfLines={1}>
				{row.detail}
			</Text>
		</Animated.View>
	);
}
