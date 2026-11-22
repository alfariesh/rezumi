// The List's Sort (Updated, Role, Next step; descending or ascending) and Tag menus, as chips that open a menu.
import type { SortDirection } from "./use-list-state";
import type { MenuKey } from "@/ui";
import type { ApplicationSort } from "@rezumi/career/applications";
import type { PressableProps } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { Pressable } from "react-native";
import { Icon, Menu, Text } from "@/ui";

type MenuChipProps = Omit<PressableProps, "children" | "style"> & {
	label: string;
	text: string;
	icon: "arrows-down-up" | "tag";
	testID: string;
};

/** A chip that opens a menu; Menu.Trigger hands it the press handler. */
function MenuChip({ label, text, icon, testID, ...rest }: MenuChipProps) {
	return (
		<Pressable
			{...rest}
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={6}
			className="min-h-8 flex-row items-center gap-1 rounded-full bg-default px-3"
			testID={testID}
		>
			<Icon name={icon} size={14} />
			<Text size="sm" weight="medium" numberOfLines={1}>
				{text}
			</Text>
			<Icon name="caret-down" size={14} tone="muted" />
		</Pressable>
	);
}

type SortMenuProps = {
	sort: ApplicationSort;
	direction: SortDirection;
	onSort: (sort: ApplicationSort) => void;
	onDirection: (direction: SortDirection) => void;
};

const sorts = ["updated", "role", "next"] as const satisfies readonly ApplicationSort[];
const directions = ["desc", "asc"] as const satisfies readonly SortDirection[];

export function SortMenu({ sort, direction, onSort, onDirection }: SortMenuProps) {
	const { t } = useLingui();
	const labels: Record<ApplicationSort, string> = { updated: t`Updated`, role: t`Role`, next: t`Next step` };
	const directionLabels: Record<SortDirection, string> = { desc: t`Descending`, asc: t`Ascending` };
	return (
		<Menu>
			<Menu.Trigger asChild>
				<MenuChip
					label={t`Sort: ${labels[sort]}, ${directionLabels[direction]}`}
					text={labels[sort]}
					icon="arrows-down-up"
					testID="applications-sort"
				/>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Overlay />
				<Menu.Content presentation="popover" width={220}>
					<Menu.Label>{t`Sort by`}</Menu.Label>
					<Menu.Group
						selectionMode="single"
						selectedKeys={new Set([sort])}
						onSelectionChange={(keys: Set<MenuKey>) => {
							const next = sorts.find((value) => keys.has(value));
							if (next) onSort(next);
						}}
					>
						{sorts.map((value) => (
							<Menu.Item key={value} id={value}>
								<Menu.ItemIndicator />
								<Menu.ItemTitle>{labels[value]}</Menu.ItemTitle>
							</Menu.Item>
						))}
					</Menu.Group>
					<Menu.Label>{t`Order`}</Menu.Label>
					<Menu.Group
						selectionMode="single"
						selectedKeys={new Set([direction])}
						onSelectionChange={(keys: Set<MenuKey>) => {
							const next = directions.find((value) => keys.has(value));
							if (next) onDirection(next);
						}}
					>
						{directions.map((value) => (
							<Menu.Item key={value} id={value}>
								<Menu.ItemIndicator />
								<Menu.ItemTitle>{directionLabels[value]}</Menu.ItemTitle>
							</Menu.Item>
						))}
					</Menu.Group>
				</Menu.Content>
			</Menu.Portal>
		</Menu>
	);
}

type TagMenuProps = { tags: readonly string[]; tag: string; onTag: (tag: string) => void };

export function TagMenu({ tags, tag, onTag }: TagMenuProps) {
	const { t } = useLingui();
	const all = "__all__";
	return (
		<Menu>
			<Menu.Trigger asChild>
				<MenuChip
					label={tag ? t`Tag: ${tag}` : t`Tag: all tags`}
					text={tag ? `#${tag}` : t`All tags`}
					icon="tag"
					testID="applications-tag"
				/>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Overlay />
				<Menu.Content presentation="popover" width={220}>
					<Menu.Group
						selectionMode="single"
						selectedKeys={new Set([tag || all])}
						onSelectionChange={(keys: Set<MenuKey>) => {
							const next = [all, ...tags].find((value) => keys.has(value));
							if (next !== undefined) onTag(next === all ? "" : next);
						}}
					>
						{[all, ...tags].map((value) => (
							<Menu.Item key={value} id={value}>
								<Menu.ItemIndicator />
								<Menu.ItemTitle>{value === all ? t`All tags` : `#${value}`}</Menu.ItemTitle>
							</Menu.Item>
						))}
					</Menu.Group>
				</Menu.Content>
			</Menu.Portal>
		</Menu>
	);
}
