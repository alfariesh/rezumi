import type { PanelView } from "@/features/resume/editor/store";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { SelectionIndicator, Tab, TabList, Tabs } from "react-aria-components";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { loadAssistantPanel } from "@/features/assistant/dock";
import { selectPanelView, useEditorStore } from "@/features/resume/editor/store";

type Mode<M extends string> = {
	id: M;
	icon: IconName;
	label: string;
	/** A count or dot at the icon's corner. */
	extra?: ReactNode;
};

type View = Exclude<PanelView, null>;

type ModeSwitchProps<M extends string> = {
	modes: Mode<M>[];
	selected: M;
	onChange: (mode: M) => void;
	/** The assistant and History, under the modes: each shows in the panel in place of the mode. */
	views?: readonly View[];
};

const viewItem = (view: View): Mode<View> =>
	view === "assistant"
		? { id: "assistant", icon: "sparkle", label: t`AI` }
		: { id: "history", icon: "clock-counter-clockwise", label: t`History` };

/**
 * The editor's modes down the left of the panel card, its header turned on its side: Write · Design · Check · Share,
 * then (apart, under a hairline) AI and History, each an icon over its name (as on a phone's tab bar), with Check's
 * count and Share's dot at the icon's corner. The gray marker slides to the picked item; a keyboard switch skips the
 * slide (`data-mode-switch`, see globals.css). Arrow keys move between items.
 */
export function ModeSwitch<M extends string>({ modes, selected, onChange, views = [] }: ModeSwitchProps<M>) {
	const view = useEditorStore(selectPanelView);
	const items: Mode<string>[] = [...modes, ...views.map(viewItem)];
	const firstView = views[0];

	return (
		// Only the list sits in Tabs: each mode's panel is the card's content, mounted by the editor itself.
		<Tabs
			orientation="vertical"
			selectedKey={view ?? selected}
			onSelectionChange={(key) => {
				const picked = String(key);
				if (picked === "assistant" || picked === "history") {
					useEditorStore.getState().setPanelView(picked);
					return;
				}
				useEditorStore.getState().setPanelView(null);
				onChange(picked as M);
			}}
			className="min-h-0 p-1.5"
		>
			<TabList aria-label={t`Editor mode`} data-mode-switch="" className="grid gap-1 outline-none">
				{items.map((item) => (
					<Tab
						key={item.id}
						id={item.id}
						{...(item.id === "assistant" ? { onHoverStart: () => void loadAssistantPanel() } : {})}
						className={({ isSelected }) =>
							cn(
								"relative flex h-14 cursor-(--cursor-interactive) flex-col items-center justify-center gap-1 rounded-xl text-[11px] leading-none font-medium transition-[color,scale] duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95",
								isSelected ? "text-foreground" : "text-muted hover:text-foreground",
								// A hairline sets the assistant and History apart from the modes.
								item.id === firstView &&
									"mt-3 before:absolute before:inset-x-3 before:-top-2 before:h-px before:bg-separator",
							)
						}
					>
						{({ isSelected }) => (
							<>
								<SelectionIndicator
									data-rail-indicator=""
									className="absolute inset-0 rounded-xl bg-default transition-[translate,width,height] duration-standard ease-in-out-strong motion-reduce:transition-none"
								/>
								<span className="relative flex">
									<Icon name={item.icon} size={20} variant={isSelected ? "duotone" : "stroke"} />
									{item.extra ? <span className="absolute -end-2 -top-1.5 flex">{item.extra}</span> : null}
								</span>
								<span className="relative max-w-full truncate px-1">{item.label}</span>
							</>
						)}
					</Tab>
				))}
			</TabList>
		</Tabs>
	);
}
