import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode, RefObject } from "react";
import { createContext, use, useEffect, useRef, useState } from "react";
import { SelectionIndicator, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { getScrollBehavior } from "@/features/resume/editor/write/reveal";

// A long settings panel (resume and portfolio Design) as sections of the panel card, with a row of chips stuck to the
// card's top: each jumps to its section, and the one in view is marked as the card scrolls.

export type GroupItem<I extends string> = { id: I; icon: IconName; label: string };

/** Inside a group panel, groups render as sections of the card instead of widgets of their own. */
const InGroupPanel = createContext(false);
export const useInGroupPanel = () => use(InGroupPanel);

type GroupPanelProps<I extends string> = {
	/** The chips' accessible name: "Design groups". */
	label: string;
	items: readonly GroupItem<I>[];
	active: I;
	onJump: (id: I) => void;
	navRef: RefObject<HTMLElement | null>;
	children: ReactNode;
};

export function GroupPanel<I extends string>({ label, items, active, onJump, navRef, children }: GroupPanelProps<I>) {
	return (
		<div>
			<nav
				ref={navRef}
				aria-label={label}
				className="sticky top-0 z-10 scrollbar-none overflow-x-auto border-b border-separator bg-surface/90 px-3 py-2 backdrop-blur"
			>
				<ToggleButtonGroup
					aria-label={label}
					selectionMode="single"
					disallowEmptySelection
					selectedKeys={[active]}
					className="flex w-max gap-1"
				>
					{items.map((item) => (
						<ToggleButton
							key={item.id}
							id={item.id}
							// On press, not on selection change: pressing the group in view still jumps back to its top.
							onPress={() => onJump(item.id)}
							className={({ isSelected }) =>
								cn(
									"relative flex h-8 cursor-(--cursor-interactive) items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[color,scale] duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95",
									isSelected ? "text-foreground" : "text-muted hover:text-foreground",
								)
							}
						>
							{({ isSelected }) => (
								<>
									<SelectionIndicator className="absolute inset-0 rounded-full bg-default transition-[translate,width] duration-standard ease-in-out-strong motion-reduce:transition-none" />
									<Icon name={item.icon} size={16} variant={isSelected ? "duotone" : "stroke"} className="relative" />
									<span className="relative">{item.label}</span>
								</>
							)}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</nav>
			<InGroupPanel value>{children}</InGroupPanel>
		</div>
	);
}

type GroupSectionProps = {
	/** The section's anchor, which its chip jumps to. */
	id: string;
	icon: IconName;
	title: ReactNode;
	/** A count or link at the end of the heading. */
	action?: ReactNode;
	children: ReactNode;
};

/** One group in a group panel: a 14px heading with its 20px icon over the group's controls. */
export function GroupSection({ id, icon, title, action, children }: GroupSectionProps) {
	const titleId = `${id}-title`;

	return (
		<section
			id={id}
			aria-labelledby={titleId}
			className="grid min-w-0 scroll-mt-12 gap-3 border-t border-separator p-4 first:border-t-0"
		>
			<div className="flex min-h-8 items-center gap-2">
				<Icon name={icon} size={20} className="shrink-0 text-muted [&_*]:stroke-2" />
				<h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
					{title}
				</h2>
				{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
			</div>
			{/* A size container, so groups lay out by the card's width rather than the window's. */}
			<div className="@container grid min-w-0 gap-4">{children}</div>
		</section>
	);
}

// How long a jump owns the selection before the first scroll event, and how quiet the scroll must stay after its last
// event to count as settled.
const JUMP_START_MS = 400;
const SCROLL_SETTLE_MS = 150;

/**
 * The group in view: the last one whose top has passed just under the chips, or, once the panel is scrolled to its
 * end, the last one starting in its upper half. Measured once per frame while the panel scrolls. The scroller is the
 * editor's `[data-editor-panel]` around the chips; each group's anchor is `prefix` + its id.
 */
export function useGroupSpy<I extends string>(ids: readonly I[], prefix: string) {
	const navRef = useRef<HTMLElement>(null);
	const [active, setActive] = useState<I>(ids[0] as I);
	// Set while a jump's smooth scroll runs: the chips already show its target, so passing others mustn't move them.
	const jumping = useRef<number | undefined>(undefined);
	const idsKey = ids.join(",");

	useEffect(() => {
		const nav = navRef.current;
		const scroller = nav?.closest<HTMLElement>("[data-editor-panel]");
		if (!nav || !scroller) return;
		const list = idsKey.split(",") as I[];
		let frame = 0;

		const measure = () => {
			frame = 0;
			const { scrollTop, clientHeight, scrollHeight } = scroller;
			const atEnd = scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 4;
			const navLine = nav.getBoundingClientRect().bottom + 16;
			const line = atEnd ? Math.max(navLine, scroller.getBoundingClientRect().top + clientHeight / 2) : navLine;
			let current = list[0] as I;
			for (const id of list) {
				const top = document.getElementById(prefix + id)?.getBoundingClientRect().top;
				if (top !== undefined && top <= line) current = id;
			}
			setActive(current);
		};
		const onScroll = () => {
			if (jumping.current !== undefined) {
				window.clearTimeout(jumping.current);
				jumping.current = window.setTimeout(() => (jumping.current = undefined), SCROLL_SETTLE_MS);
				return;
			}
			if (!frame) frame = requestAnimationFrame(measure);
		};

		measure();
		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scroller.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
			window.clearTimeout(jumping.current);
		};
	}, [idsKey, prefix]);

	// The active chip stays in view in the chip row, without moving the panel itself.
	useEffect(() => {
		const nav = navRef.current;
		const chip = nav?.querySelector<HTMLElement>("[data-selected]");
		if (!nav || !chip) return;
		const left = chip.offsetLeft - 12;
		const right = chip.offsetLeft + chip.offsetWidth + 12 - nav.clientWidth;
		if (nav.scrollLeft > left) nav.scrollTo({ left, behavior: getScrollBehavior() });
		else if (nav.scrollLeft < right) nav.scrollTo({ left: right, behavior: getScrollBehavior() });
	}, [active]);

	/** Shows `id` as the group in view until the scroll that brings it there settles. */
	const claim = (id: I) => {
		setActive(id);
		window.clearTimeout(jumping.current);
		jumping.current = window.setTimeout(() => (jumping.current = undefined), JUMP_START_MS);
	};

	/** Claims `id` and scrolls its group to the top of the panel, under the chips. */
	const jump = (id: I) => {
		claim(id);
		document.getElementById(prefix + id)?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
	};

	return { navRef, active, claim, jump };
}
