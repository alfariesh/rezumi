import type { PortfolioAiField, PortfolioAiRewrite } from "@rezumi/schema/portfolio/ai";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { View } from "react-native";
import { applyPortfolioDraft } from "@rezumi/portfolio/draft";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { Field } from "./fields";
import { offerUndo, useEdit, useEditor } from "./store";
import { AiConsentDeclined } from "@/api/ai-consent";
import { client } from "@/api/client";
import { useOnline } from "@/api/online";
import { RichTextField } from "@/features/entries/rich-text-field";
import { Button, ListGroup, ListRow, Sheet, Spinner, Text, showToast } from "@/ui";
import { SheetMenu } from "@/ui/sheet-menu";

type EditFieldProps = {
	label: string;
	value: string;
	field: PortfolioAiField;
	read: (data: PortfolioData) => string | undefined;
	write: (data: Draft<PortfolioData>, value: string) => void;
	rich?: boolean;
	max?: number;
};

export function AiField({ label, value, field, read, write, rich, max }: EditFieldProps) {
	const { t } = useLingui();
	const online = useOnline();
	const { scope, store } = useEditor();
	const edit = useEdit();
	const revision = store((state) => state.revision);
	const [busy, setBusy] = useState(false);
	const request = useRef(false);
	const change = (next: string) => edit((data) => write(data, next), { key: label });
	const rewrite = async (instruction: PortfolioAiRewrite) => {
		if (request.current) return;
		request.current = true;
		setBusy(true);
		try {
			const snapshot = store.getState().portfolio?.data;
			const original = snapshot && read(snapshot);
			if (!original?.trim()) return;
			const { text } = await client.portfolio.ai.rewrite(
				{ field, text: original, instruction },
				{ context: { scope } },
			);
			const current = store.getState().portfolio?.data;
			if (!current || read(current) !== original) {
				showToast({ title: t`This text changed while AI was writing. Try again.` });
				return;
			}
			edit((data) => write(data, text), { structural: true });
			offerUndo(store, current, t`Text rewritten`);
		} catch (error) {
			if (!(error instanceof AiConsentDeclined))
				showToast({ title: t`Couldn't rewrite this text.`, variant: "danger" });
		} finally {
			request.current = false;
			setBusy(false);
		}
	};
	const action = busy ? (
		<Spinner />
	) : online && value.trim() ? (
		<SheetMenu
			label={t`Rewrite with AI`}
			closeLabel={t`Close`}
			items={[
				{ label: t`Make shorter`, onPress: () => void rewrite("shorter") },
				{ label: t`Make more professional`, onPress: () => void rewrite("professional") },
				{ label: t`Translate to page language`, onPress: () => void rewrite("translate") },
			]}
		/>
	) : null;
	return rich ? (
		<RichTextField key={revision} value={value} label={label} onChange={change} tools="letter" labelAction={action} />
	) : (
		<Field value={value} label={label} onChange={change} max={max} multiline action={action} />
	);
}

type SheetKind = "draft" | "metrics";
type AiToolsProps = { hasSource: boolean; children?: ReactNode };
export function AiTools({ hasSource, children }: AiToolsProps) {
	const { t } = useLingui();
	const { scope, store } = useEditor();
	const online = useOnline();
	const edit = useEdit();
	const [sheet, setSheet] = useState<SheetKind | null>(null);
	const [note, setNote] = useState("");
	const [working, setWorking] = useState(false);
	const [candidates, setCandidates] = useState<
		Awaited<ReturnType<typeof client.portfolio.ai.findMetrics>>["candidates"]
	>([]);
	const run = async (kind: SheetKind) => {
		if (working) return;
		setWorking(true);
		try {
			if (!(await store.getState().flush())) {
				showToast({ title: t`Save your changes before using AI.` });
				return;
			}
			if (kind === "metrics") {
				const result = await client.portfolio.ai.findMetrics({}, { context: { scope } });
				setCandidates(result.candidates);
				if (!result.candidates.length) showToast({ title: t`No metrics found in your source.` });
			} else {
				const before = store.getState().portfolio?.data;
				const result = await client.portfolio.ai.draft(note.trim() ? { note: note.trim() } : {}, {
					context: { scope },
				});
				if (!before || before !== store.getState().portfolio?.data) {
					showToast({ title: t`Your portfolio changed while AI was writing. Try again.` });
					return;
				}
				edit((data) => applyPortfolioDraft(data, result), { structural: true });
				offerUndo(store, before, t`Draft applied. Review the text before publishing.`);
				setSheet(null);
			}
		} catch (error) {
			if (!(error instanceof AiConsentDeclined))
				showToast({ title: t`Couldn't complete the AI request.`, variant: "danger" });
		} finally {
			setWorking(false);
		}
	};

	return (
		<>
			<View className="flex-row flex-wrap gap-2">
				<Button
					size="sm"
					variant="secondary"
					isDisabled={!online || !hasSource}
					onPress={() => setSheet("draft")}
				>{t`Draft with AI`}</Button>
				<Button
					size="sm"
					variant="secondary"
					isDisabled={!online || !hasSource}
					onPress={() => {
						setCandidates([]);
						setSheet("metrics");
					}}
				>{t`Find numbers`}</Button>
				{children}
			</View>
			<Sheet
				isOpen={sheet !== null}
				onOpenChange={(open) => {
					if (!open && !working) setSheet(null);
				}}
				title={sheet === "draft" ? t`Draft with AI` : t`Find numbers`}
				closeLabel={t`Close`}
			>
				<View className="gap-3">
					{sheet === "draft" ? (
						<>
							<Text>{t`Draft an intro, About section and work stories from your selected source. You can undo the draft.`}</Text>
							<Field label={t`Instructions (optional)`} value={note} onChange={setNote} max={1000} multiline />
						</>
					) : (
						<Text>{t`Find measurable results in your source and add them to your intro.`}</Text>
					)}
					<Button
						isDisabled={working}
						onPress={() => {
							if (sheet) void run(sheet);
						}}
					>
						{working ? t`Working…` : sheet === "draft" ? t`Write draft` : t`Search source`}
					</Button>
					<ListGroup>
						{candidates.map(({ metric, quote, source }, index) => (
							<ListRow
								key={index}
								title={metric.label}
								description={`${source} — ${quote}`}
								onPress={() => {
									const before = store.getState().portfolio?.data;
									if (!before || before.hero.highlights.length >= PORTFOLIO_LIMITS.highlights) {
										showToast({ title: t`Your intro has room for only four highlights.` });
										return;
									}
									edit(
										(data) => {
											data.hero.highlights.push({ ...metric, id: generateId() });
										},
										{ structural: true },
									);
									offerUndo(store, before, t`Highlight added`);
									setCandidates((items) => items.filter((_, position) => position !== index));
								}}
							/>
						))}
					</ListGroup>
				</View>
			</Sheet>
		</>
	);
}
