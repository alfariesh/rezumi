import type { EntryHeader } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { m } from "motion/react";
import { entryHeaderOf } from "@rezumi/schema/resume/data";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { SEGMENT_ITEM, useDesign } from "./style-groups";
import { D2, EASE_MOVE } from "@/libs/motion";

type BarProps = { tone?: "lead" | "accent"; className: string };

/** One line of text in a layout's wireframe: dark for the lead, light for the rest, accent for an eyebrow. */
function Bar({ tone, className }: BarProps) {
	return (
		<span
			className={cn(
				"block h-1 rounded-sm",
				tone === "lead" ? "bg-foreground" : tone === "accent" ? "h-[3px] bg-accent" : "bg-muted/35",
				className,
			)}
		/>
	);
}

const ROW = "flex items-center justify-between gap-0.5";

const LAYOUTS: { id: EntryHeader["layout"]; label: () => string; wireframe: ReactNode }[] = [
	{
		id: "stacked",
		label: () => t({ message: "Stacked", context: "Entry header layout" }),
		wireframe: (
			<>
				<span className={ROW}>
					<Bar tone="lead" className="w-[46%]" />
					<Bar className="w-[22%]" />
				</span>
				<span className={ROW}>
					<Bar className="w-[38%]" />
					<Bar className="w-[28%]" />
				</span>
			</>
		),
	},
	{
		id: "inline",
		label: () => t({ message: "One line", context: "Entry header layout" }),
		wireframe: (
			<span className={ROW}>
				<span className="flex w-[68%] gap-0.5">
					<Bar tone="lead" className="w-[45%]" />
					<Bar className="w-[30%]" />
					<Bar className="w-[18%]" />
				</span>
				<Bar className="w-[22%]" />
			</span>
		),
	},
	{
		id: "compact",
		label: () => t({ message: "Compact", context: "Entry header layout" }),
		wireframe: (
			<>
				<span className={ROW}>
					<Bar tone="lead" className="w-[52%]" />
					<Bar className="w-[26%]" />
				</span>
				<span className="flex gap-0.5">
					<Bar className="w-[30%]" />
					<Bar className="w-[16%]" />
				</span>
			</>
		),
	},
	{
		id: "date-column",
		label: () => t({ message: "Date column", context: "Entry header layout" }),
		wireframe: (
			<span className="flex items-center gap-1">
				<Bar className="w-[24%] shrink-0" />
				<span className="grid flex-1 gap-1">
					<Bar tone="lead" className="w-[80%]" />
					<Bar className="w-[58%]" />
				</span>
			</span>
		),
	},
	{
		id: "eyebrow",
		label: () => t({ message: "Eyebrow", context: "Entry header layout" }),
		wireframe: (
			<>
				<Bar tone="accent" className="w-[40%]" />
				<span className={ROW}>
					<Bar tone="lead" className="h-[5px] w-[58%]" />
					<Bar className="w-[24%]" />
				</span>
			</>
		),
	},
];

/**
 * Entries: how the header of each Experience, Education and Volunteer entry is laid out, which of its two rows
 * leads, and an accent around it. One setting for the whole resume.
 */
export function EntriesGroup() {
	const { metadata, write } = useDesign();
	if (!metadata) return null;

	const entry = entryHeaderOf(metadata.design);
	// Old resumes have no entry settings: every change writes the whole object.
	const set = (value: Partial<EntryHeader>) =>
		write(
			"entry",
			(draft) => {
				draft.design.entry = { ...entryHeaderOf(draft.design), ...value };
			},
			true,
		);

	const rows = [
		{ id: "organization", name: t`Company`, detail: t`Location` },
		{ id: "role", name: t`Position`, detail: t`Date` },
	];
	if (entry.lead === "role") rows.reverse();

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<div className="flex items-baseline justify-between gap-2">
					<span className="shrink-0 text-sm font-medium">
						<Trans>Header layout</Trans>
					</span>
					<span className="truncate text-xs text-muted">
						<Trans>Experience, Education and more</Trans>
					</span>
				</div>
				<RadioButtonGroup
					aria-label={t`Header layout`}
					layout="grid"
					value={entry.layout}
					onChange={(value) => set({ layout: value as EntryHeader["layout"] })}
					className="grid-cols-3 gap-2"
				>
					{LAYOUTS.map((option) => (
						<RadioButtonGroup.Item
							key={option.id}
							value={option.id}
							className="group/layout gap-1.5 rounded-xl border-0 bg-surface-secondary px-2 pt-2.5 pb-1.5 data-selected:bg-accent-soft"
						>
							<RadioButtonGroup.ItemContent className="gap-1.5">
								<span aria-hidden="true" className="flex h-7.5 flex-col justify-center gap-1 px-0.5">
									{option.wireframe}
								</span>
								<span className="text-center text-xs leading-4 text-muted group-data-selected/layout:font-semibold group-data-selected/layout:text-foreground">
									{option.label()}
								</span>
							</RadioButtonGroup.ItemContent>
						</RadioButtonGroup.Item>
					))}
				</RadioButtonGroup>
			</div>

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Row order</Trans>
				</span>
				<div className="flex items-center gap-2 rounded-xl bg-surface-secondary p-2">
					<div className="grid min-w-0 flex-1 gap-1">
						{rows.map((row) => (
							<m.div
								key={row.id}
								layout="position"
								// Measured only when the order changes, so the panel moving around it doesn't slide the chips.
								layoutDependency={entry.lead}
								transition={{ duration: D2, ease: EASE_MOVE }}
								className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs"
							>
								<span className="truncate font-semibold">{row.name}</span>
								<span className="truncate text-muted">{row.detail}</span>
							</m.div>
						))}
					</div>
					<IconButton
						icon="arrows-down-up"
						iconSize={16}
						variant="secondary"
						size="sm"
						tooltipPlacement="top"
						className="rounded-full"
						label={entry.lead === "role" ? t`Swap rows: lead with company` : t`Swap rows: lead with position`}
						onPress={() => set({ lead: entry.lead === "role" ? "organization" : "role" })}
					/>
				</div>
				<span className="text-xs text-muted">
					<Trans>Education swaps school and field of study the same way.</Trans>
				</span>
			</div>

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Accent</Trans>
				</span>
				<Segment
					aria-label={t`Accent`}
					selectedKey={entry.accent}
					onSelectionChange={(key) => set({ accent: key as EntryHeader["accent"] })}
					className="w-full"
				>
					<Segment.Item id="none" className={SEGMENT_ITEM}>
						<Trans context="Entry header accent">None</Trans>
					</Segment.Item>
					<Segment.Item id="rule" className={SEGMENT_ITEM}>
						<Trans context="Entry header accent: a line under the header">Rule</Trans>
					</Segment.Item>
					<Segment.Item id="bar" className={SEGMENT_ITEM}>
						<Trans context="Entry header accent: a bar beside the header">Bar</Trans>
					</Segment.Item>
					<Segment.Item id="band" className={SEGMENT_ITEM}>
						<Trans context="Entry header accent: a tinted background behind the header">Band</Trans>
					</Segment.Item>
				</Segment>
			</div>
		</div>
	);
}
