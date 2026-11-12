import type { DateFormat } from "@rezumi/schema/resume/dates";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, Disclosure, Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { CustomStylesSectionBuilder } from "../-sidebar/right/sections/custom-styles";
import { DesignSectionBuilder } from "../-sidebar/right/sections/design";
import { LayoutSectionBuilder } from "../-sidebar/right/sections/layout";
import { PageSectionBuilder } from "../-sidebar/right/sections/page";
import { TypographySectionBuilder } from "../-sidebar/right/sections/typography";
import { CellSelectField } from "@/components/input/select-field";
import { useIsResumeLocked, useResumeData, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";
import { GroupPanel, GroupSection, useGroupSpy, useInGroupPanel } from "@/features/resume/editor/chrome/group-nav";
import { PanelSection } from "@/features/resume/editor/chrome/panel-section";
import { EntriesGroup } from "@/features/resume/editor/design/entries-group";
import { ColorGroup, IconsGroup, PageGroup, TypeGroup } from "@/features/resume/editor/design/style-groups";
import { TemplateGroup } from "@/features/resume/editor/design/template-group";
import { OfflineBanner } from "@/features/resume/editor/save-status";
import { getScrollBehavior } from "@/features/resume/editor/write/reveal";
import { D2 } from "@/libs/motion";

const GROUPS = [
	{ id: "template", icon: "squares-four", label: () => t`Template` },
	{ id: "entries", icon: "rows", label: () => t`Entries` },
	{ id: "type", icon: "text-aa", label: () => t`Type` },
	{ id: "color", icon: "palette", label: () => t`Color` },
	{ id: "icons", icon: "star", label: () => t`Icons` },
	{ id: "page", icon: "file", label: () => t`Page` },
	{ id: "advanced", icon: "sliders-horizontal", label: () => t`Advanced` },
] as const satisfies readonly { id: string; icon: IconName; label: () => string }[];

type GroupId = (typeof GROUPS)[number]["id"];

const groupOf = (id: GroupId) => GROUPS.find((group) => group.id === id) ?? GROUPS[0];

type DesignWidgetProps = { group: GroupId; children: ReactNode };

/**
 * One Design group, anchored as `design-{group}` for its chip: a section of the panel card, or (in the phone sheet) a
 * widget of its own with the icon and title over its content.
 */
function DesignWidget({ group, children }: DesignWidgetProps) {
	const inGroupPanel = useInGroupPanel();
	const { icon, label } = groupOf(group);

	if (inGroupPanel)
		return (
			<GroupSection id={`design-${group}`} icon={icon} title={label()}>
				{children}
			</GroupSection>
		);

	return (
		<PanelSection id={`design-${group}`} icon={icon} title={label()} className="scroll-mt-12" contentClassName="gap-4">
			{children}
		</PanelSection>
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

const GROUP_IDS = GROUPS.map((group) => group.id);

/**
 * Design: its groups (Template · Entries · Type · Color · Icons · Page · Advanced) as sections of the panel card, with
 * chips stuck to the top that jump to each and follow the scroll. Presets cover the common choices; Advanced keeps every exact value,
 * custom CSS and the reset.
 */
export function DesignPanel() {
	const locked = useIsResumeLocked();
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const advanced = { open: advancedOpen, setOpen: setAdvancedOpen };
	const { navRef, active, claim } = useGroupSpy(GROUP_IDS, "design-");

	return (
		<GroupPanel
			label={t`Design groups`}
			items={GROUPS.map((group) => ({ id: group.id, icon: group.icon, label: group.label() }))}
			active={active}
			navRef={navRef}
			onJump={(id) => {
				claim(id);
				jumpTo(`design-${id}`, advanced);
			}}
		>
			<fieldset disabled={locked} className="m-0 grid min-w-0 border-0 p-0">
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
				<DesignWidget group="icons">
					<IconsGroup />
				</DesignWidget>
				<DesignWidget group="page">
					<PageGroup />
				</DesignWidget>
				<AdvancedWidget open={advancedOpen} onOpenChange={setAdvancedOpen} />
			</fieldset>
		</GroupPanel>
	);
}

type SheetTab = "template" | "entries" | "type" | "color" | "icons" | "page";

/**
 * Phones: Design's content for the editor's sheet, which rests at half height so every change shows on the page above
 * it. Tabs replace the chips, each showing its group's widget; Advanced sits under Page.
 */
export function DesignSheet() {
	const locked = useIsResumeLocked();
	const [tab, setTab] = useState<SheetTab>("template");
	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<Tabs
			selectedKey={tab}
			onSelectionChange={(key) => setTab(String(key) as SheetTab)}
			variant="secondary"
			className="gap-0"
		>
			<Tabs.ListContainer className="sticky top-0 z-10 bg-overlay">
				<Tabs.List aria-label={t`Design`} className="w-full shrink-0 justify-around px-2">
					{GROUPS.filter((group) => group.id !== "advanced").map((group) => (
						<Tabs.Tab key={group.id} id={group.id}>
							{group.label()}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>

			{/* In a Panel: React Aria renders whatever else sits inside Tabs a second time to collect the tabs. */}
			<Tabs.Panel id={tab} className="p-0">
				<fieldset disabled={locked} className="m-0 grid min-w-0 gap-3 border-0 p-3">
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
					{tab === "icons" && (
						<DesignWidget group="icons">
							<IconsGroup />
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
				</fieldset>
			</Tabs.Panel>
		</Tabs>
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
			className="grid min-w-0 scroll-mt-3 gap-3"
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
		<CellSelectField
			label={t`Date format`}
			value={data?.metadata.page.dateFormat ?? "short"}
			onChange={(value) =>
				updateResumeData(
					(draft) => {
						draft.metadata.page.dateFormat = value as DateFormat;
					},
					{ newStep: true },
				)
			}
			options={DATE_FORMATS.map((format) => ({ value: format.value, label: format.label }))}
		/>
	);
}

// Controlled so the nav and Type's Custom row can open it.
type AdvancedWidgetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Every exact value (typography, colours and levels, page, layout), custom CSS and Reset design defaults, collapsed
 * until asked for. The editors mount the first time it opens (React Aria renders a closed panel's content too), then
 * stay for the closing animation.
 */
function AdvancedWidget({ open, onOpenChange }: AdvancedWidgetProps) {
	const [opened, setOpened] = useState(open);
	if (open && !opened) setOpened(true);
	const updateResumeData = useUpdateResumeData();
	const inGroupPanel = useInGroupPanel();
	const { icon, label } = groupOf("advanced");

	const reset = () => {
		updateResumeData(
			(draft) => {
				const defaults = defaultResumeData.metadata;
				draft.metadata.typography = structuredClone(defaults.typography);
				draft.metadata.design = structuredClone(defaults.design);
				draft.metadata.layout.sidebarWidth = defaults.layout.sidebarWidth;
				// Paper, language, date format, section placement and custom CSS are the user's, not the look's; they stay.
				const { gapX, gapY, marginX, marginY, hideLinkUnderline } = defaults.page;
				Object.assign(draft.metadata.page, { gapX, gapY, marginX, marginY, hideLinkUnderline });
			},
			{ newStep: true },
		);
		toast.add({
			description: t`Design reset to defaults`,
			actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
		});
	};

	const content = opened && (
		<div className="@container grid min-w-0 gap-8">
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
		</div>
	);

	const trigger = (
		<Disclosure.Heading level={2} className="min-w-0 flex-1">
			<Disclosure.Trigger className="flex min-h-8 w-full items-center gap-2 rounded-lg text-start">
				<Icon name={icon} size={20} className="shrink-0 text-muted [&_*]:stroke-2" />
				<span id="design-advanced-title" className="min-w-0 flex-1 truncate text-sm font-semibold">
					{label()}
				</span>
				<Disclosure.Indicator className="text-muted" />
			</Disclosure.Trigger>
		</Disclosure.Heading>
	);

	if (inGroupPanel)
		return (
			<section
				id="design-advanced"
				aria-labelledby="design-advanced-title"
				className="scroll-mt-12 border-t border-separator p-4"
			>
				<Disclosure isExpanded={open} onExpandedChange={onOpenChange}>
					{trigger}
					{/* `*:p-0`: Disclosure.Body pads an outer wrapper its className doesn't reach. */}
					<Disclosure.Content className="*:p-0">
						<Disclosure.Body className="p-0 pt-4">{content}</Disclosure.Body>
					</Disclosure.Content>
				</Disclosure>
			</section>
		);

	return (
		<section id="design-advanced" aria-labelledby="design-advanced-title" className="scroll-mt-3 px-1">
			<Disclosure isExpanded={open} onExpandedChange={onOpenChange}>
				{trigger}
				{/* `*:p-0`: Disclosure.Body pads an outer wrapper its className doesn't reach. */}
				<Disclosure.Content className="*:p-0">
					<Disclosure.Body className="p-0 pt-3">
						{opened && <div className="min-w-0 px-0.5">{content}</div>}
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</section>
	);
}
