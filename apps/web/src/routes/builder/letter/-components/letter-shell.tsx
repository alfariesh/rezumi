import type { LetterMode } from "@/features/letters/use-letter-mode";
import type { CoverLetter } from "@rezumi/schema/cover-letter/data";
import { t } from "@lingui/core/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { LetterDesignPanel } from "./design-panel";
import { LetterDownloadSheet, LetterHistory } from "./download-sheet";
import { LetterBar, LetterDownload, LetterMenu, LetterModeTabs, useDownloadLetter } from "./letter-bar";
import { LetterPage } from "./letter-page";
import { LetterWritePanel } from "./write-panel";
import { LetterAssistant } from "@/features/assistant/dock";
import { useLetterEditorStore } from "@/features/letters/store";
import {
	useLetterMode,
	useOpenLetterAssistantFromUrl,
	useOpenLetterVersionFromUrl,
} from "@/features/letters/use-letter-mode";
import { useLetterWebMcpTools } from "@/features/letters/webmcp";
import { usePreviewPausedStore } from "@/features/resume/builder/draft";
import { ZoomControls } from "@/features/resume/editor/chrome";
import {
	EditorFrame,
	KeptModes,
	MobileEditor,
	useEditorLayout,
	useMobileSheet,
} from "@/features/resume/editor/chrome/shell";
import { selectPanelView, useEditorStore } from "@/features/resume/editor/store";
import { switchModeInstantly } from "@/libs/motion";

const routeApi = getRouteApi("/builder/letter/$coverLetterId");

/**
 * The letter editor: the resume editor's shell with Write and Design (no Check). The panel holds who the letter is
 * for, to and from, and its body; the page shows the letter as it prints.
 */
export function LetterShell() {
	const [mode, setMode] = useLetterMode();
	const editorLayout = useEditorLayout();
	const resetEditor = useEditorStore((state) => state.reset);

	// Zoom, open sheets and the History version belong to one document.
	useEffect(() => resetEditor, [resetEditor]);
	useOpenLetterVersionFromUrl();
	useOpenLetterAssistantFromUrl();
	useLinkedUpdateNotice();
	useUnsavedGuard();
	useLetterWebMcpTools(routeApi.useParams().coverLetterId);

	return (
		<>
			<EditorFrame
				editorLayout={editorLayout}
				bar={<LetterBar layout={editorLayout.layout} pinnable={editorLayout.pinnable} />}
				mode={mode}
				modes={<LetterModeTabs />}
				title={<LetterMenu />}
				controls={<ZoomControls compact={editorLayout.layout === "tablet"} />}
				panelLabel={mode === "design" ? t`Design` : t`Letter details`}
				panel={<ModePanel mode={mode} />}
				page={<LetterPage />}
				assistant={<LetterAssistant />}
				history={<LetterHistory />}
				floating={<LetterDownload />}
				mobile={<MobileBody mode={mode} onModeChange={setMode} />}
			>
				<LetterHotkeys onModeChange={setMode} />
			</EditorFrame>
			<LetterDownloadSheet />
		</>
	);
}

function ModePanel({ mode }: { mode: LetterMode }) {
	return (
		<KeptModes mode={mode}>{(kept) => (kept === "design" ? <LetterDesignPanel /> : <LetterWritePanel />)}</KeptModes>
	);
}

const LETTER_MODES = ["write", "design"] as const;

type MobileBodyProps = { mode: LetterMode; onModeChange: (mode: LetterMode) => void };

/** Phones: the letter, with Write · Design floating over it, each opening a sheet; Design's rests at half height. */
function MobileBody({ onModeChange }: MobileBodyProps) {
	const open = useMobileSheet(LETTER_MODES);
	const view = useEditorStore(selectPanelView);
	const setPreviewPaused = usePreviewPausedStore((state) => state.setPaused);
	// Full-height sheets (Write, AI) hide the letter, so it stops re-rendering until they go.
	const covered = view === "assistant" || (view === null && open === "write");

	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect -- a shared store the preview renderer reads, reset on unmount
		setPreviewPaused(covered);
		return () => setPreviewPaused(false);
	}, [covered, setPreviewPaused]);

	return (
		<MobileEditor
			items={[
				{ mode: "write", icon: "pencil-simple", label: t`Write` },
				{ mode: "design", icon: "palette", label: t`Design` },
			]}
			views={["assistant", "history"]}
			assistant={<LetterAssistant />}
			history={<LetterHistory />}
			open={open}
			onOpenChange={(next) => {
				useEditorStore.setState({ mobileView: next ?? "page" });
				if (next) onModeChange(next);
			}}
			halfModes={["design"]}
			page={<LetterPage />}
		>
			{open && <ModePanel mode={open} />}
		</MobileEditor>
	);
}

/** 1 and 2 switch modes outside fields, ⌘P downloads the PDF, ⌘⇧E opens Download. Saving is automatic. */
function LetterHotkeys({ onModeChange }: { onModeChange: (mode: LetterMode) => void }) {
	const download = useDownloadLetter();
	const setSheetTab = useEditorStore((state) => state.setSheetTab);

	useHotkey("1", () => switchModeInstantly(() => onModeChange("write")));
	useHotkey("2", () => switchModeInstantly(() => onModeChange("design")));
	useHotkey("Mod+P", () => void download.run());
	useHotkey("Mod+Shift+E", () => setSheetTab("download"));
	useHotkey("Mod+J", () => useEditorStore.getState().setAssistantOpen(!useEditorStore.getState().assistantOpen, true));
	useHotkey("Mod+S", () => {
		void useLetterEditorStore.getState().flush();
		toast.add({ type: "info", description: t`Your changes are saved automatically.`, id: "auto-save" });
	});

	return null;
}

/** Closing the tab with edits still on their way asks first. */
function useUnsavedGuard() {
	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			const { status, pending } = useLetterEditorStore.getState();
			if (status === "saved" && Object.keys(pending).length === 0) return;
			void useLetterEditorStore.getState().flush();
			event.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, []);
}

const SENDER_FIELDS = ["name", "headline", "email", "phone", "location"] as const;
type SenderField = (typeof SENDER_FIELDS)[number];
type SenderSnapshot = Partial<Record<SenderField, string>>;

const snapshotOf = (letter: CoverLetter): SenderSnapshot =>
	Object.fromEntries(SENDER_FIELDS.map((field) => [field, letter.style.basics[field]]));

// The resume's snapshot keeps the key it always had; the Profile's has its own.
const snapshotKey = (letter: CoverLetter) =>
	letter.sourceResumeId ? `letter-sender:${letter.id}` : `letter-sender:${letter.id}:profile`;

const readSnapshot = (key: string): SenderSnapshot | null => {
	try {
		return JSON.parse(window.localStorage.getItem(key) ?? "null") as SenderSnapshot | null;
	} catch {
		return null;
	}
};

const changedMessage = (field: SenderField) =>
	({
		name: t`Your name changed on the resume. The letter updated too.`,
		headline: t`Your headline changed on the resume. The letter updated too.`,
		email: t`Your email address changed on the resume. The letter updated too.`,
		phone: t`Your phone number changed on the resume. The letter updated too.`,
		location: t`Your location changed on the resume. The letter updated too.`,
	})[field];

/**
 * C2: a linked letter says so, once, when details it takes from the resume or the Profile changed since this device
 * last showed it. The live link means there's nothing to refresh. Each source keeps its own snapshot, so switching
 * between them says nothing.
 */
function useLinkedUpdateNotice() {
	const letterId = useLetterEditorStore((state) => state.letter?.id);
	const basics = useLetterEditorStore((state) => state.letter?.style.basics);

	useEffect(() => {
		const letter = useLetterEditorStore.getState().letter;
		if (!letterId || !letter?.senderLinked) return;
		const before = readSnapshot(snapshotKey(letter));
		if (!before) return;
		const now = snapshotOf(letter);
		const changed = SENDER_FIELDS.filter((field) => before[field] !== undefined && before[field] !== now[field]);
		const [only] = changed;
		if (!only) return;
		toast.add({
			description: !letter.sourceResumeId
				? t`Your details changed in your Profile. The letter updated too.`
				: changed.length === 1
					? changedMessage(only)
					: t`Your details changed on the resume. The letter updated too.`,
		});
	}, [letterId]);

	// What this device has shown, for the next visit.
	useEffect(() => {
		const letter = useLetterEditorStore.getState().letter;
		if (!letter || !basics) return;
		try {
			window.localStorage.setItem(snapshotKey(letter), JSON.stringify(snapshotOf(letter)));
		} catch {
			// Storage can be unavailable; the notice is a nicety.
		}
	}, [basics]);
}
