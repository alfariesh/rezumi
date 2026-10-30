import type { DateFormat } from "@rezumi/schema/resume/dates";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode, RefObject } from "react";
import { NativeSelect, Segment, Widget } from "@heroui-pro/react";
import { Button, Disclosure, Label, Tabs, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { CustomStylesSectionBuilder } from "../-sidebar/right/sections/custom-styles";
import { DesignSectionBuilder } from "../-sidebar/right/sections/design";
import { LayoutSectionBuilder } from "../-sidebar/right/sections/layout";
import { PageSectionBuilder } from "../-sidebar/right/sections/page";
import { TypographySectionBuilder } from "../-sidebar/right/sections/typography";
import { useIsResumeLocked, useResumeData, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";
import { ExpandingLabel } from "@/features/resume/editor/chrome/mode-switch";
import { EntriesGroup } from "@/features/resume/editor/design/entries-group";
import { ColorGroup, PageGroup, TypeGroup } from "@/features/resume/editor/design/style-groups";
import { TemplateGroup } from "@/features/resume/editor/design/template-group";
import { OfflineBanner } from "@/features/resume/editor/save-status";
import { getScrollBehavior } from "@/features/resume/editor/write/reveal";
import { D2 } from "@/libs/motion";

const GROUPS = [
	{ id: "template", icon: "squares-four", label: () => t`Template` },
	{ id: "entries", icon: "rows", label: () => t`Entries` },
	{ id: "type", icon: "text-aa", label: () => t`Type` },
	{ id: "color", icon: "palette", label: () => t`Color` },
	{ id: "page", icon: "file", label: () => t`Page` },
	{ id: "advanced", icon: "sliders-horizontal", label: () => t`Advanced` },
] as const satisfies readonly { id: string; icon: IconName; label: () => string }[];

type GroupId = (typeof GROUPS)[number]["id"];

const groupOf = (id: GroupId) => GROUPS.find((group) => group.id === id) ?? GROUPS[0];

type DesignWidgetProps = { group: GroupId; children: ReactNode };

/** One Design group: an icon and title over its elevated content, anchored as `design-{group}` for the nav. */
function DesignWidget({ group, children }: DesignWidgetProps) {
	const { icon, label } = groupOf(group);
	const titleId = `design-${group}-title`;

	return (
		<Widget id={`design-${group}`} role="region" aria-labelledby={titleId} className="scroll-mt-14">
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					<Icon name={icon} size={16} className="shrink-0 text-muted" />
					<Widget.Title id={titleId} role="heading" aria-level={2} className="truncate">
						{label()}
					</Widget.Title>
				</span>
			</Widget.Header>
			{/* A size container, so groups lay out by the panel's width rather than the window's. */}
			<Widget.Content className="@container grid min-w-0 gap-4">{children}</Widget.Content>
		</Widget>
	);
}

type AdvancedState = { open: boolean; setOpen: (open: boolean) => void };

/**
 * Brings `id` into view. Advanced is collapsed until asked for: jumping into it opens it, then aims again once it
 * has grown (before that its contents aren't mounted and the panel may be too short to bring them to the top).
 * `focus` then moves focus to the target's first control.
 */
function jumpTo(id: string, advanced: AdvancedState, focus = false) {
	const aim = () => {
		const target = document.getElementById(id) ?? document.getElementById("design-advanced");
		target?.scrollIntoView({ behavior: getScrollBehavior() });
		if (focus) target?.querySelector<HTMLElement>("input, button, textarea")?.focus({ preventScroll: true });
	};
	if (id.startsWith("design-advanced") && !advanced.open) {
		advanced.setOpen(true);
		window.setTimeout(aim, D2 * 1000);
	}
	aim();
}

const TYPOGRAPHY_ID = "design-advanced-typography";

// How long a jump owns the nav's selection before the first scroll event, and how quiet the scroll must stay after
// its last event to count as settled. The first covers Advanced's second aim, D2 after the first.
const JUMP_START_MS = 400;
const SCROLL_SETTLE_MS = 150;

/**
 * The group in view: the last one whose top has passed just under the nav, or, once the panel is scrolled to its end,
 * the last one starting in its upper half. The panel's scroller is the editor's `section[aria-label]` around it.
 */
function useGroupInView(navRef: RefObject<HTMLElement | null>) {
	const [active, setActive] = useState<GroupId>("template");
	// Set while a jump's smooth scroll runs: the nav already shows its target, so scrolling past others mustn't move it.
	const jumping = useRef<number | undefined>(undefined);

	useEffect(() => {
		const nav = navRef.current;
		const scroller = nav?.closest<HTMLElement>("section[aria-label]");
		if (!nav || !scroller) return;

		// Straight from the scroll event: browsers fire it once per frame, and this reads six rects.
		const measure = () => {
			const { scrollTop, clientHeight, scrollHeight } = scroller;
			// At the end the last groups can't reach the nav, so the line drops to mid-panel: whatever group starts in the
			// upper half then wins, and a collapsed Advanced near the bottom doesn't steal the selection from Page.
			const atEnd = scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 4;
			const navLine = nav.getBoundingClientRect().bottom + 24;
			const line = atEnd ? Math.max(navLine, scroller.getBoundingClientRect().top + clientHeight / 2) : navLine;
			let current: GroupId = GROUPS[0].id;
			for (const group of GROUPS) {
				const top = document.getElementById(`design-${group.id}`)?.getBoundingClientRect().top;
				if (top !== undefined && top <= line) current = group.id;
			}
			setActive(current);
		};
		const onScroll = () => {
			if (jumping.current !== undefined) {
				window.clearTimeout(jumping.current);
				jumping.current = window.setTimeout(() => (jumping.current = undefined), SCROLL_SETTLE_MS);
				return;
			}
			measure();
		};

		measure();
		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scroller.removeEventListener("scroll", onScroll);
			window.clearTimeout(jumping.current);
		};
	}, [navRef]);

	/** Shows `id` as the group in view until the scroll that brings it there settles. */
	const claim = (id: GroupId) => {
		setActive(id);
		window.clearTimeout(jumping.current);
		jumping.current = window.setTimeout(() => (jumping.current = undefined), JUMP_START_MS);
	};

	return { active, claim };
}

type GroupNavProps = { active: GroupId; onJump: (id: GroupId) => void; navRef: RefObject<HTMLElement | null> };

/**
 * Jumps to a group by scrolling: navigation, not a tab panel. Each item shows its icon; the group in view also
 * shows its name, which keeps all six inside a 300px panel.
 */
function GroupNav({ active, onJump, navRef }: GroupNavProps) {
	return (
		<nav
			ref={navRef}
			aria-label={t`Design groups`}
			className="sticky top-0 z-10 bg-background/90 px-3 py-2 backdrop-blur"
		>
			<Segment aria-label={t`Design groups`} variant="ghost" selectedKey={active} className="max-w-full">
				{GROUPS.map((group) => (
					<Tooltip key={group.id} delay={500} isDisabled={group.id === active}>
						<Segment.Item
							id={group.id}
							aria-label={group.label()}
							// Tight padding beside the icon alone, so six fit a 300px panel with the selected group's name.
							className="w-auto px-1.5 data-selected:px-2.5"
							style={{ gap: 0 }}
							// On press, not on selection change: pressing the group in view still jumps back to its top.
							onPress={() => onJump(group.id)}
						>
							{({ isSelected }) => (
								<>
									<Icon name={group.icon} size={16} />
									<ExpandingLabel shown={isSelected}>{group.label()}</ExpandingLabel>
								</>
							)}
						</Segment.Item>
						<Tooltip.Content placement="bottom">{group.label()}</Tooltip.Content>
					</Tooltip>
				))}
			</Segment>
		</nav>
	);
}

/**
 * Design: a sticky nav that follows the scroll (Template · Entries · Type · Color · Page · Advanced) over one
 * widget per group. Presets cover the common choices; Advanced keeps every exact value, custom CSS and the reset.
 */
export function DesignPanel() {
	const locked = useIsResumeLocked();
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const advanced = { open: advancedOpen, setOpen: setAdvancedOpen };
	const navRef = useRef<HTMLElement>(null);
	const { active, claim } = useGroupInView(navRef);

	return (
		<div>
			<GroupNav
				navRef={navRef}
				active={active}
				onJump={(id) => {
					claim(id);
					jumpTo(`design-${id}`, advanced);
				}}
			/>

			<fieldset disabled={locked} className="m-0 grid min-w-0 gap-3 border-0 p-3 pt-1">
				<DesignWidget group="template">
					<TemplateGroup />
				</DesignWidget>
				<DesignWidget group="entries">
					<EntriesGroup />
				</DesignWidget>
				<DesignWidget group="type">
					<TypeGroup
						onCustomFonts={() => {
							claim("advanced");
							jumpTo(TYPOGRAPHY_ID, advanced, true);
						}}
					/>
				</DesignWidget>
				<DesignWidget group="color">
					<ColorGroup />
				</DesignWidget>
				<DesignWidget group="page">
					<PageGroup />
				</DesignWidget>
				<AdvancedWidget open={advancedOpen} onOpenChange={setAdvancedOpen} />
			</fieldset>
		</div>
	);
}

type SheetTab = "template" | "entries" | "type" | "color" | "page";

/**
 * Phones: Design is a sheet over the lower half of the page, so every change shows above it. The handle
 * raises it to full height. It keeps its full height and moves by `translate` (half out of view when lowered),
 * and rises into view when Design opens. Tabs replace the group nav, each showing its group's widget; Advanced
 * sits under Page.
 */
export function DesignSheet() {
	const locked = useIsResumeLocked();
	const [tab, setTab] = useState<SheetTab>("template");
	const [expanded, setExpanded] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<section
			aria-label={t`Design`}
			className={cn(
				"[container-type:size] absolute inset-x-0 bottom-0 z-20 flex h-[calc(100%-1rem)] flex-col rounded-t-2xl bg-overlay shadow-overlay transition-[translate] duration-emphasized ease-enter starting:translate-y-full",
				!expanded && "translate-y-[calc(50%-0.5rem)]",
			)}
		>
			{/* The sheet's handle (as on HeroUI Pro's Sheet): a bare bar, so it stays a raw button rather than a Button. */}
			<button
				type="button"
				aria-expanded={expanded}
				aria-label={expanded ? t`Lower the design sheet` : t`Raise the design sheet`}
				onClick={() => setExpanded(!expanded)}
				className="group/handle flex h-7 shrink-0 cursor-(--cursor-interactive) items-center justify-center rounded-t-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
			>
				<span className="h-[0.3rem] w-8 rounded-full bg-default transition-colors duration-quick group-hover/handle:bg-default-hover group-active/handle:bg-default-hover" />
			</button>

			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => setTab(String(key) as SheetTab)}
				variant="secondary"
				className="min-h-0 flex-1 gap-0"
			>
				<Tabs.ListContainer>
					<Tabs.List aria-label={t`Design`} className="w-full shrink-0 justify-around px-4">
						{GROUPS.filter((group) => group.id !== "advanced").map((group) => (
							<Tabs.Tab key={group.id} id={group.id}>
								{group.label()}
								<Tabs.Indicator />
							</Tabs.Tab>
						))}
					</Tabs.List>
				</Tabs.ListContainer>

				{/* In a Panel: React Aria renders whatever else sits inside Tabs a second time to collect the tabs. */}
				<Tabs.Panel id={tab} className="flex min-h-0 flex-1 flex-col p-0">
					<fieldset
						disabled={locked}
						// A column of unshrinkable widgets: the scroller's height mustn't squeeze them (they clip their overflow).
						className="m-0 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-0 p-3 *:shrink-0"
					>
						<OfflineBanner />
						{tab === "template" && (
							<DesignWidget group="template">
								<TemplateGroup layout="strip" />
							</DesignWidget>
						)}
						{tab === "entries" && (
							<DesignWidget group="entries">
								<EntriesGroup />
							</DesignWidget>
						)}
						{tab === "type" && (
							<DesignWidget group="type">
								<TypeGroup
									onCustomFonts={() => {
										// Advanced lives under Page, so from here it isn't mounted yet: switching mounts it, then it opens.
										setTab("page");
										jumpTo(TYPOGRAPHY_ID, { open: false, setOpen: setAdvancedOpen }, true);
									}}
								/>
							</DesignWidget>
						)}
						{tab === "color" && (
							<DesignWidget group="color">
								<ColorGroup />
							</DesignWidget>
						)}
						{tab === "page" && (
							<>
								<DesignWidget group="page">
									<PageGroup />
								</DesignWidget>
								<AdvancedWidget open={advancedOpen} onOpenChange={setAdvancedOpen} />
							</>
						)}
						{/* Lowered, the sheet's lower half is out of view: this keeps the end of the list scrollable into sight. */}
						{!expanded && <div aria-hidden="true" className="h-[calc(50cqh-0.5rem)]" />}
					</fieldset>
				</Tabs.Panel>
			</Tabs>
		</section>
	);
}

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
	{ value: "short", label: "Mar 2022" },
	{ value: "long", label: "March 2022" },
	{ value: "numeric", label: "03/2022" },
	{ value: "iso", label: "2022-03" },
];

type ExactSectionProps = { id: string; title: ReactNode; children: ReactNode };

/** One part of Advanced: a small muted heading over its exact-value editor, anchored as `design-advanced-{id}`. */
function ExactSection({ id, title, children }: ExactSectionProps) {
	return (
		<section
			id={`design-advanced-${id}`}
			aria-labelledby={`design-advanced-${id}-title`}
			className="grid min-w-0 scroll-mt-14 gap-3"
		>
			<h3 id={`design-advanced-${id}-title`} className="text-xs font-medium text-muted">
				{title}
			</h3>
			{children}
		</section>
	);
}

function DateFormatSelect() {
	const data = useResumeData();
	const updateResumeData = useUpdateResumeData();

	return (
		<NativeSelect variant="secondary" fullWidth>
			<Label htmlFor="design-date-format">
				<Trans>Date format</Trans>
			</Label>
			<NativeSelect.Trigger
				id="design-date-format"
				value={data?.metadata.page.dateFormat ?? "short"}
				onChange={(event) =>
					updateResumeData(
						(draft) => {
							draft.metadata.page.dateFormat = event.target.value as DateFormat;
						},
						{ newStep: true },
					)
				}
			>
				{DATE_FORMATS.map((format) => (
					<NativeSelect.Option key={format.value} value={format.value}>
						{format.label}
					</NativeSelect.Option>
				))}
				<NativeSelect.Indicator />
			</NativeSelect.Trigger>
		</NativeSelect>
	);
}

// Controlled so the nav and Type's Custom row can open it.
type AdvancedWidgetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Every exact value (typography, colours and levels, page, layout), custom CSS and Reset design defaults, collapsed
 * until asked for. The editors mount only while it's open.
 */
function AdvancedWidget({ open, onOpenChange }: AdvancedWidgetProps) {
	const updateResumeData = useUpdateResumeData();
	const { icon, label } = groupOf("advanced");

	const reset = () => {
		updateResumeData(
			(draft) => {
				const defaults = defaultResumeData.metadata;
				draft.metadata.typography = structuredClone(defaults.typography);
				draft.metadata.design = structuredClone(defaults.design);
				draft.metadata.layout.sidebarWidth = defaults.layout.sidebarWidth;
				// Paper, language, date format, section placement and custom CSS are the user's, not the look's; they stay.
				const { gapX, gapY, marginX, marginY, hideIcons, hideLinkUnderline, hideSectionIcons } = defaults.page;
				Object.assign(draft.metadata.page, {
					gapX,
					gapY,
					marginX,
					marginY,
					hideIcons,
					hideLinkUnderline,
					hideSectionIcons,
				});
			},
			{ newStep: true },
		);
		toast.add({
			description: t`Design reset to defaults`,
			actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
		});
	};

	return (
		<Widget
			id="design-advanced"
			role="region"
			aria-labelledby="design-advanced-title"
			className={cn("scroll-mt-14", !open && "pb-0.5")}
		>
			<Disclosure isExpanded={open} onExpandedChange={onOpenChange}>
				<Widget.Header>
					<Disclosure.Heading level={2} className="min-w-0 flex-1">
						<Disclosure.Trigger className="flex min-h-8 w-full items-center gap-2 rounded-lg text-start">
							<Icon name={icon} size={16} className="shrink-0 text-muted" />
							<Widget.Title id="design-advanced-title" className="truncate">
								{label()}
							</Widget.Title>
							<Disclosure.Indicator className="text-muted" />
						</Disclosure.Trigger>
					</Disclosure.Heading>
				</Widget.Header>

				{/* `*:p-0`: Disclosure.Body pads an outer wrapper its className doesn't reach; the widget's own insets apply. */}
				<Disclosure.Content className="*:p-0">
					{/* `pt-px`: room for the content's hairline under the header, which the panel's clip would cut. */}
					<Disclosure.Body className="p-0 pt-px">
						<Widget.Content className="@container mt-0 grid min-w-0 gap-8">
							<ExactSection id="typography" title={<Trans>Typography</Trans>}>
								<TypographySectionBuilder />
							</ExactSection>
							<ExactSection id="design" title={<Trans>Colors and levels</Trans>}>
								<DesignSectionBuilder />
							</ExactSection>
							<ExactSection id="page" title={<Trans>Page</Trans>}>
								<DateFormatSelect />
								<PageSectionBuilder />
							</ExactSection>
							<ExactSection id="layout" title={<Trans>Layout</Trans>}>
								<LayoutSectionBuilder />
							</ExactSection>
							<ExactSection id="styles" title={<Trans>Custom CSS</Trans>}>
								<CustomStylesSectionBuilder />
							</ExactSection>

							<Button variant="secondary" className="w-fit" onPress={() => reset()}>
								<Icon name="arrow-counter-clockwise" size={18} />
								<Trans>Reset design defaults</Trans>
							</Button>
						</Widget.Content>
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</Widget>
	);
}
