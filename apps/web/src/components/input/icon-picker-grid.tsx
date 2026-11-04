// The searchable icon list behind ./icon-picker.tsx, loaded when the picker first opens.
import type { IconName } from "@rezumi/schema/icons";
import type { IconStyle } from "@rezumi/schema/resume/data";
import type { RowComponentProps } from "react-window";
import { NativeSelect } from "@heroui-pro/react";
import { Input } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { List } from "react-window";
import { iconPickerGroups, searchIcons } from "@rezumi/resume/icon-picker";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { useIconGlyphs } from "./resume-icon";

const COLUMNS = 8;
const ICON_ROW_HEIGHT = 36;
const HEADING_ROW_HEIGHT = 30;

/** Every heading's name: "suggested" and the Hugeicons categories (`iconPickerGroups`), translated. */
function groupLabels(): Readonly<Record<string, string>> {
	return {
		suggested: t({ comment: "Icon picker category: the icons resumes use most", message: "Suggested" }),
		logos: t({ comment: "Icon picker category: brand and network logos", message: "Logos" }),
		business: t`Business`,
		education: t`Education`,
		programming: t`Programming`,
		users: t({ comment: "Icon picker category: people and user icons", message: "People" }),
		award: t`Awards`,
		maps: t`Maps and places`,
		ai: t({ comment: "Icon picker category: artificial intelligence", message: "AI" }),
		"science-technology": t`Science and technology`,
		media: t`Music and video`,
		"image-camera": t`Photos and cameras`,
		presentation: t`Presentations`,
		dashboard: t`Charts and dashboards`,
		"notes-tasks": t`Notes and tasks`,
		hierarchy: t`Teams and structure`,
		git: t({ comment: "Icon picker category: the Git version control tool", message: "Git" }),
		"date-time": t`Date and time`,
		legal: t({ comment: "Icon picker category: legal and justice icons", message: "Law" }),
		security: t`Security`,
		medical: t`Health`,
		buildings: t`Buildings`,
		games: t`Games and sports`,
		gym: t`Fitness`,
		foods: t`Food and drink`,
		space: t`Outer space`,
		islamic: t({ comment: "Icon picker category: Islamic symbols such as mosques", message: "Islam" }),
	};
}

// A category synced after these labels were written still gets a readable name.
const labelOf = (labels: Readonly<Record<string, string>>, id: string) =>
	labels[id] ?? id.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());

type Row = { kind: "heading"; label: string } | { kind: "icons"; icons: readonly IconName[] };

const iconRows = (icons: readonly IconName[]): Row[] =>
	Array.from({ length: Math.ceil(icons.length / COLUMNS) }, (_, index) => ({
		kind: "icons",
		icons: icons.slice(index * COLUMNS, (index + 1) * COLUMNS),
	}));

type IconRowProps = {
	rows: readonly Row[];
	glyphs: Readonly<Record<string, string>> | undefined;
	value: string;
	onChange: (icon: IconName) => void;
};

function IconRow({ index, style, rows, glyphs, value, onChange }: RowComponentProps<IconRowProps>) {
	const row = rows[index];
	if (!row) return null;

	if (row.kind === "heading") {
		return (
			<div style={style} className="flex items-end px-2.5 pb-1 text-xs font-medium text-muted">
				{row.label}
			</div>
		);
	}

	return (
		<div style={style} className="grid grid-cols-8 px-1">
			{row.icons.map((icon) => (
				// Raw buttons: the cells are a pointer shortcut beside the search field (Enter there picks the first
				// match), so they stay out of the tab order.
				<button
					key={icon}
					type="button"
					title={icon}
					aria-label={icon}
					aria-pressed={icon === value}
					tabIndex={-1}
					onClick={() => onChange(icon)}
					className={cn(
						"flex h-9 cursor-(--cursor-interactive) items-center justify-center rounded-lg hover:bg-default",
						icon === value && "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft",
					)}
				>
					<svg
						aria-hidden
						viewBox="0 0 24 24"
						className="size-4"
						// Markup from the generated resume icon set, looked up by name: never text the user typed.
						// oxlint-disable-next-line react/no-danger -- generated SVG shapes, see above.
						dangerouslySetInnerHTML={{ __html: glyphs?.[icon] ?? "" }}
					/>
				</button>
			))}
		</div>
	);
}

type IconPickerGridProps = {
	search: string;
	onSearchChange: (value: string) => void;
	/** "all", "suggested" or a category. */
	group: string;
	onGroupChange: (group: string) => void;
	value: string;
	/** The resume's icon style: icons show as the page draws them. */
	iconStyle: IconStyle;
	onChange: (icon: IconName) => void;
};

/**
 * Search, a heading filter and the icons below, in the resume's icon style. All headings list Suggested first, then
 * each category under its name; a search lists the best matches first.
 */
export function IconPickerGrid({
	search,
	onSearchChange,
	group,
	onGroupChange,
	value,
	iconStyle,
	onChange,
}: IconPickerGridProps) {
	const glyphs = useIconGlyphs(iconStyle);
	const labels = groupLabels();
	const scope = group === "all" ? undefined : group;
	const results = search.trim() ? searchIcons(search, { group: scope, labels }) : undefined;
	const rows: Row[] = results
		? iconRows(results)
		: scope
			? iconRows(iconPickerGroups.find((candidate) => candidate.id === scope)?.icons ?? [])
			: iconPickerGroups.flatMap((candidate) => [
					{ kind: "heading", label: labelOf(labels, candidate.id) } satisfies Row,
					...iconRows(candidate.icons),
				]);

	return (
		<div className="flex h-full flex-col">
			<Input
				spellCheck={false}
				inputMode="search"
				// Opening the picker is asking to find an icon: typing searches straight away.
				// oxlint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a dialog the user just opened.
				autoFocus
				value={search}
				aria-label={t({
					comment: "Accessible label for icon picker search input",
					message: "Search for an icon",
				})}
				placeholder={t({
					comment: "Placeholder text in icon picker search input",
					message: "Search for an icon",
				})}
				onChange={(event) => onSearchChange(event.currentTarget.value)}
				onKeyDown={(event) => {
					// Enter picks the best match, so the picker works from the keyboard.
					if (event.key !== "Enter" || !results?.[0]) return;
					event.preventDefault();
					onChange(results[0]);
				}}
				fullWidth
				variant="secondary"
				className="shrink-0 rounded-none"
			/>

			<div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1">
				<NativeSelect variant="secondary" fullWidth className="min-w-0 flex-1">
					<NativeSelect.Trigger
						aria-label={t`Icon category`}
						value={group}
						onChange={(event) => onGroupChange(event.target.value)}
					>
						<NativeSelect.Option value="all">{t`All categories`}</NativeSelect.Option>
						{iconPickerGroups.map((candidate) => (
							<NativeSelect.Option key={candidate.id} value={candidate.id}>
								{labelOf(labels, candidate.id)}
							</NativeSelect.Option>
						))}
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
				<IconButton icon="prohibit" label={t`No icon`} size="sm" onPress={() => onChange("")} />
			</div>

			{rows.length > 0 ? (
				<List
					key={`${group}:${search}`}
					// About the list's height in the 380px popover, so a new list fills it before it's measured.
					defaultHeight={290}
					className="min-h-0 flex-1 pb-1"
					rowCount={rows.length}
					rowHeight={(index) => (rows[index]?.kind === "heading" ? HEADING_ROW_HEIGHT : ICON_ROW_HEIGHT)}
					rowComponent={IconRow}
					rowProps={{ rows, glyphs, value, onChange }}
				/>
			) : (
				<p className="px-3 py-6 text-center text-sm text-muted">{t`No icons match.`}</p>
			)}
		</div>
	);
}
