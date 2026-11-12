import type { PortfolioSectionKey, PortfolioStandardSection } from "@rezumi/schema/portfolio/sections";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useId, useRef } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { AiDraftButton } from "../ai/draft-dialog";
import { WorkEditor } from "../works/work-editor";
import { WorksForm } from "../works/works-form";
import { ContactForm } from "./contact-form";
import { useSourceResume } from "./context";
import { PanelGroup } from "./fields";
import { IntroForm } from "./intro-form";
import { ClientsForm, ServicesForm, TestimonialsForm } from "./offer-forms";
import { AboutForm, addCustomSection, CustomSectionForm, ResumeItemsForm } from "./section-forms";
import {
	editorSectionOrder,
	isResumeSection,
	isStandardSection,
	moveSection,
	sectionLabel,
	setSectionHidden,
	setSectionTitle,
} from "./sections";
import { editPortfolio, usePortfolioData } from "./store";
import { usePortfolioEditorUi } from "./ui";
import { useEditorView, usePageMessages } from "./use-view";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";
import { usePrompt } from "@/hooks/use-confirm";

const SECTION_ICONS: Record<PortfolioStandardSection, IconName> = {
	about: "user-circle",
	work: "squares-four",
	services: "tag",
	testimonials: "chat-text",
	clients: "hand-heart",
	experience: "briefcase",
	education: "graduation-cap",
	skills: "star",
	languages: "translate",
	certifications: "check-circle",
	awards: "star",
	publications: "books",
	volunteer: "hand-heart",
	interests: "sparkle",
	profiles: "link-simple-horizontal",
	contact: "envelope",
};

const sectionIcon = (key: PortfolioSectionKey): IconName =>
	isStandardSection(key) ? SECTION_ICONS[key] : key.startsWith("custom:") ? "note-pencil" : "file-text";

/**
 * Content: the intro, which is always first, then every section in page order. Drag a section (or use its arrows) to
 * reorder, the eye hides it, the pencil renames it; opening one shows its fields.
 */
export function ContentPanel() {
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const exists = usePortfolioData().works.items.some((work) => work.id === openWorkId);
	// A work removed elsewhere (undo, another tab) closes its editor.
	if (openWorkId && exists) return <WorkEditor key={openWorkId} workId={openWorkId} />;
	return (
		<div className="grid gap-6 p-3">
			<AiDraftButton />
			<PanelGroup icon="user-circle" title={<Trans>Intro</Trans>}>
				<IntroForm />
			</PanelGroup>
			<SectionsGroup />
		</div>
	);
}

function SectionsGroup() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const view = useEditorView();
	const messages = usePageMessages();
	const order = editorSectionOrder(data, source.data);
	const shown = new Set(view.sections.map((section) => section.key));
	// Kept with the editor, so it stays open across tabs and the save status can open the section with a problem.
	const open = usePortfolioEditorUi((state) => state.openSectionKey);
	const setOpen = usePortfolioEditorUi((state) => state.openSection);

	const move = (key: PortfolioSectionKey, to: number) =>
		editPortfolio((draft) => moveSection(draft, order, key, to), { structural: true });

	return (
		<PanelGroup icon="list-bullets" title={<Trans>Sections</Trans>}>
			<SortableProvider onMove={(id, target) => move(id as PortfolioSectionKey, target.index)}>
				<div className="grid gap-1">
					{order.map((key, index) => (
						<SectionRow
							key={key}
							sectionKey={key}
							index={index}
							title={sectionLabel(key, data, source.data, messages)}
							hidden={data.sections.hidden.includes(key)}
							empty={!data.sections.hidden.includes(key) && !shown.has(key)}
							open={open === key}
							onOpenChange={(next) => setOpen(next ? key : null)}
						>
							<SectionForm sectionKey={key} />
						</SectionRow>
					))}
				</div>
			</SortableProvider>
			{data.custom.length < PORTFOLIO_LIMITS.customSections && (
				<Button
					variant="secondary"
					className="w-fit"
					onPress={() => {
						const id = addCustomSection();
						setOpen(`custom:${id}`);
					}}
				>
					<Icon name="plus" size={18} />
					<Trans>Add a section</Trans>
				</Button>
			)}
		</PanelGroup>
	);
}

function SectionForm({ sectionKey }: { sectionKey: PortfolioSectionKey }) {
	if (sectionKey.startsWith("custom:")) return <CustomSectionForm id={sectionKey.slice("custom:".length)} />;
	if (isResumeSection(sectionKey)) return <ResumeItemsForm sectionKey={sectionKey} />;
	switch (sectionKey) {
		case "about":
			return <AboutForm />;
		case "work":
			return <WorksForm />;
		case "services":
			return <ServicesForm />;
		case "testimonials":
			return <TestimonialsForm />;
		case "clients":
			return <ClientsForm />;
		case "contact":
			return <ContactForm />;
		default:
			return null;
	}
}

type SectionRowProps = {
	sectionKey: PortfolioSectionKey;
	index: number;
	title: string;
	hidden: boolean;
	/** Shown, but with nothing in it yet, so the page leaves it out. */
	empty: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
};

function SectionRow({ sectionKey, index, title, hidden, empty, open, onOpenChange, children }: SectionRowProps) {
	const prompt = usePrompt();
	const titleId = useId();
	const detailsId = useId();
	const sortable = useSortableItem({ id: sectionKey, list: "sections", index, label: title });
	const fromResume = isResumeSection(sectionKey);
	const renamable = !sectionKey.startsWith("custom:");
	const toggle = useRef<HTMLButtonElement>(null);
	const revealing = usePortfolioEditorUi((state) => state.revealing === sectionKey);

	// "Show me" from the save status: once open, the section comes into view with its toggle focused.
	useEffect(() => {
		if (!revealing || !open) return;
		toggle.current?.scrollIntoView({ block: "start" });
		toggle.current?.focus({ preventScroll: true });
		usePortfolioEditorUi.getState().revealed();
	}, [revealing, open]);

	const rename = async () => {
		const value = await prompt(t`Rename section`, {
			defaultValue: title,
			description: t`Leave it empty to use the default title.`,
			confirmText: t`Rename`,
		});
		if (value === null) return;
		editPortfolio((draft) => setSectionTitle(draft, sectionKey, value.slice(0, PORTFOLIO_LIMITS.text.sectionTitle)));
	};

	return (
		<div {...sortable.dropTargetProps} className={cn("relative rounded-xl", sortable.isDragging && "opacity-50")}>
			<SortableEdge edge={sortable.edge} />
			<div className="group/row flex h-11 items-center gap-0.5 rounded-xl pe-1 hover:bg-default">
				<SortableHandle
					item={sortable}
					label={t`Reorder ${title}`}
					className={cn("h-11 w-7", hidden && "opacity-40")}
				/>
				<button
					ref={toggle}
					type="button"
					aria-expanded={open}
					aria-labelledby={titleId}
					aria-describedby={detailsId}
					onClick={() => onOpenChange(!open)}
					className="flex min-w-0 flex-1 cursor-(--cursor-interactive) items-center gap-2 self-stretch rounded-md text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus"
				>
					<Icon name={sectionIcon(sectionKey)} size={16} className="shrink-0 text-muted" />
					<span id={titleId} className={cn("truncate", hidden && "text-muted line-through")}>
						{title}
					</span>
					<span id={detailsId} className="contents">
						{fromResume && (
							<Chip size="sm" variant="soft" className="shrink-0">
								<Trans>From resume</Trans>
							</Chip>
						)}
						{empty && (
							<Chip size="sm" variant="soft" color="warning" className="shrink-0">
								<Trans>Empty</Trans>
							</Chip>
						)}
					</span>
				</button>
				<IconButton
					icon={hidden ? "eye-slash" : "eye"}
					label={hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
					aria-pressed={hidden}
					size="sm"
					className="text-muted"
					onPress={() => editPortfolio((draft) => setSectionHidden(draft, sectionKey, !hidden))}
				/>
				{renamable && (
					<IconButton
						icon="pencil-simple"
						label={t`Rename ${title}`}
						size="sm"
						className="text-muted"
						onPress={() => void rename()}
					/>
				)}
			</div>
			{open && <div className="grid gap-3 px-1 pt-2 pb-4">{children}</div>}
		</div>
	);
}
