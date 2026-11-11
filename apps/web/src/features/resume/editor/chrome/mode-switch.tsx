import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { SelectionIndicator, Tab, TabList, Tabs, ToggleButton } from "react-aria-components";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { loadAssistantPanel } from "@/features/assistant/dock";
import { useEditorStore } from "@/features/resume/editor/store";

type Mode<M extends string> = {
	id: M;
	icon: IconName;
	label: string;
	/** A count or dot at the icon's corner. */
	extra?: ReactNode;
};

type ModeSwitchProps<M extends string> = {
	modes: Mode<M>[];
	selected: M;
	onChange: (mode: M) => void;
	/** History at the rail's foot: it shows in the panel in place of the mode. */
	history?: boolean;
	/** AI at the very foot: it opens and closes the assistant beside the canvas. */
	assistant?: boolean;
};

const ITEM =
	"relative flex h-14 w-full cursor-(--cursor-interactive) flex-col items-center justify-center gap-1 rounded-xl text-[11px] leading-none font-medium transition-[color,scale] duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95";

type RailItemBodyProps = { item: Mode<string>; selected: boolean; indicator?: ReactNode };

function RailItemBody({ item, selected, indicator }: RailItemBodyProps) {
	return (
		<>
			{indicator}
			<span className="relative flex">
				<Icon name={item.icon} size={20} variant={selected ? "duotone" : "stroke"} />
				{item.extra ? <span className="absolute -end-2 -top-1.5 flex">{item.extra}</span> : null}
			</span>
			<span className="relative max-w-full truncate px-1">{item.label}</span>
		</>
	);
}

/**
 * The rail down the window's left edge, beside the editor: Write · Design · Check · Share at the top, History and AI
 * at its foot, each an icon over its name (as on a phone's tab bar), with Check's count and Share's dot at the icon's
 * corner. The gray marker slides to the picked mode; a keyboard switch skips the slide (`data-mode-switch`, see
 * globals.css). Arrow keys move between the modes and History; AI is a toggle of its own.
 */
export function ModeSwitch<M extends string>({
	modes,
	selected,
	onChange,
	history = false,
	assistant = false,
}: ModeSwitchProps<M>) {
	const historyOpen = useEditorStore((state) => state.historyOpen);
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	const items: Mode<string>[] = [
		...modes,
		...(history ? [{ id: "history", icon: "clock-counter-clockwise", label: t`History` } as const] : []),
	];

	return (
		<div className="flex h-full min-h-0 flex-col gap-1 px-1.5 pb-2">
			{/* Only the list sits in Tabs: each mode's panel is the panel section's content, mounted by the editor itself. */}
			<Tabs
				orientation="vertical"
				selectedKey={historyOpen && history ? "history" : selected}
				onSelectionChange={(key) => {
					const picked = String(key);
					const store = useEditorStore.getState();
					if (picked === "history") return store.setHistoryOpen(true);
					store.setHistoryOpen(false);
					// Tablets: picking a mode opens the panel drawer.
					useEditorStore.setState({ drawerOpen: true });
					onChange(picked as M);
				}}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabList aria-label={t`Editor mode`} data-mode-switch="" className="flex flex-1 flex-col gap-1 outline-none">
					{items.map((item) => (
						<Tab
							key={item.id}
							id={item.id}
							className={({ isSelected }) =>
								cn(
									ITEM,
									isSelected ? "text-foreground" : "text-muted hover:text-foreground",
									// History sits at the rail's foot, apart from the modes.
									item.id === "history" && "mt-auto",
								)
							}
						>
							{({ isSelected }) => (
								<RailItemBody
									item={item}
									selected={isSelected}
									indicator={
										<SelectionIndicator
											data-rail-indicator=""
											className="absolute inset-0 rounded-xl bg-default transition-[translate,width,height] duration-standard ease-in-out-strong motion-reduce:transition-none"
										/>
									}
								/>
							)}
						</Tab>
					))}
				</TabList>
			</Tabs>

			{assistant && (
				<ToggleButton
					isSelected={assistantOpen}
					onChange={(open) => useEditorStore.getState().setAssistantOpen(open)}
					onHoverStart={() => void loadAssistantPanel()}
					className={({ isSelected }) =>
						cn(ITEM, isSelected ? "bg-default text-foreground" : "text-muted hover:text-foreground")
					}
				>
					{({ isSelected }) => (
						<RailItemBody item={{ id: "assistant", icon: "sparkle", label: t`AI` }} selected={isSelected} />
					)}
				</ToggleButton>
			)}
		</div>
	);
}
