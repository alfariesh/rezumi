import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Icon } from "@rezumi/ui/components/icon";

type Mode<M extends string> = {
	id: M;
	icon: IconName;
	label: string;
	/** A count or dot after the label. */
	extra?: ReactNode;
};

type ModeSwitchProps<M extends string> = {
	modes: Mode<M>[];
	selected: M;
	onChange: (mode: M) => void;
};

/**
 * A label that opens beside its icon while `shown` and folds to nothing otherwise (still read out: it's only
 * clipped). The "icon expand" pattern from HeroUI Pro's Segment, shared by the mode switch and Design's group nav.
 */
export function ExpandingLabel({ shown, children }: { shown: boolean; children: ReactNode }) {
	return (
		<span
			className="inline-grid min-w-0 transition-all duration-200 ease-out motion-reduce:transition-none"
			style={{ gridTemplateColumns: shown ? "1fr" : "0fr", opacity: shown ? 1 : 0 }}
		>
			<span
				className="min-w-0 overflow-hidden whitespace-nowrap transition-[padding] duration-200 ease-out motion-reduce:transition-none"
				style={{ paddingInlineStart: shown ? "0.375rem" : 0 }}
			>
				{children}
			</span>
		</span>
	);
}

/**
 * The editor's modes, across the top of the panel column. Every tab shows its icon (and Check's count, Share's dot);
 * the selected one also its label, so four modes fit the 300px column the assistant leaves as well as 400px. The
 * tabs share the column's width.
 */
export function ModeSwitch<M extends string>({ modes, selected, onChange }: ModeSwitchProps<M>) {
	// Only the list sits in Tabs: React Aria renders everything inside Tabs a second time to collect the tabs.
	return (
		<Tabs selectedKey={selected} onSelectionChange={(key) => onChange(String(key) as M)}>
			<Tabs.ListContainer>
				<Tabs.List aria-label={t`Editor mode`} data-mode-switch="" className="w-full">
					{modes.map((mode) => (
						<Tabs.Tab key={mode.id} id={mode.id} className="w-auto min-w-0 flex-auto gap-0 px-2.5">
							<Icon
								name={mode.icon}
								size={18}
								variant={mode.id === selected ? "duotone" : "stroke"}
								className="shrink-0"
							/>
							<ExpandingLabel shown={mode.id === selected}>{mode.label}</ExpandingLabel>
							{mode.extra ? <span className="ms-1.5 flex shrink-0 items-center">{mode.extra}</span> : null}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
		</Tabs>
	);
}
