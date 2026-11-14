import type { PortfolioAssistantDocument } from "@/features/assistant/document";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useMemo } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { usePortfolioEditorStore } from "../editor/store";
import { applyCall, callStatus, editCallOf, undoCall } from "./apply";
import { portfolioChangeLines } from "./labels";
import { callKey, usePortfolioChanges } from "./records";
import { POP_CLASS } from "@/libs/motion";
import { orpc } from "@/libs/orpc/client";

/** After a card's status reached the conversation, Past conversations count it. */
function useRecorded() {
	const queryClient = useQueryClient();
	return useCallback(
		() => void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() }),
		[queryClient],
	);
}

type PortfolioChangesProps = {
	threadId: string;
	messageId: string;
	toolCallId: string | undefined;
	/** The `edit_portfolio` call's output. */
	output: unknown;
	document: PortfolioAssistantDocument;
	readOnly: boolean;
};

/**
 * One reply's changes to the portfolio: what it set out to do, a line per change (pressing one opens its place in the
 * editor), what couldn't be done, and where the changes stand: Applied with Undo, Undone with Redo, or Apply for a
 * reply whose changes never reached the editor (the tab closed while it ran).
 */
export function PortfolioChanges({
	threadId,
	messageId,
	toolCallId,
	output,
	document,
	readOnly,
}: PortfolioChangesProps) {
	const { i18n } = useLingui();
	const headingId = useId();
	const onRecorded = useRecorded();
	const found = useMemo(
		() =>
			toolCallId
				? editCallOf(threadId, messageId, {
						type: "tool-edit_portfolio",
						state: "output-available",
						toolCallId,
						output,
					})
				: null,
		[threadId, messageId, toolCallId, output],
	);
	const record = usePortfolioChanges((state) => (found ? state.calls[callKey(found.call)] : undefined));
	const data = usePortfolioEditorStore((state) => state.portfolio?.data);
	const cards = found?.output.edits;
	const status = callStatus(record, cards ?? []);
	const { source } = document;

	const lines = useMemo(() => {
		if (!cards || !data) return [];
		return portfolioChangeLines(
			cards.map((card) => card.edit),
			{
				// Not applied yet: the portfolio as it is now is what they'd change.
				before: record?.before ?? (status.kind === "pending" ? data : null),
				data,
				resume: source.resume,
				from: source.from,
				messages: source.messages,
				locale: i18n.locale,
			},
		);
	}, [cards, data, record, status.kind, source, i18n.locale]);

	if (!found || !cards) return null;
	const failures = [...found.output.failed.map((failure) => failure.error), ...(record?.failed ?? [])];
	const options = { onRecorded };

	const apply = () => {
		// Redo applies again what applied before; Apply, what never did.
		const chosen = record
			? cards.filter((card) => record.appliedIds.includes(card.id))
			: status.kind === "pending"
				? cards.filter((card) => card.status === "pending")
				: cards;
		applyCall(found.call, chosen.length > 0 ? chosen : cards, options);
	};

	return (
		<section aria-labelledby={headingId} className="grid gap-2 rounded-xl bg-surface p-3">
			<h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
				<Icon name="sparkle" size={16} className="shrink-0 text-accent" />
				<span className="min-w-0">{found.output.title}</span>
			</h3>

			{lines.length > 0 && (
				<ul
					aria-label={t`Changes`}
					className={cn(
						"grid list-disc gap-1 ps-5 text-body-sm marker:text-muted",
						status.kind !== "applied" && "text-muted",
					)}
				>
					{lines.map((line, index) => (
						<li key={index}>
							{line.reveal ? (
								<button
									type="button"
									onClick={() => line.reveal && document.reveal(line.reveal)}
									className="cursor-(--cursor-interactive) rounded-sm text-start underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
								>
									{line.text}
									<span className="sr-only">
										{" "}
										<Trans>(show it in the editor)</Trans>
									</span>
								</button>
							) : (
								line.text
							)}
						</li>
					))}
				</ul>
			)}

			{failures.length > 0 && (
				<div className="grid gap-1 text-muted">
					<p className="text-body-xs">
						<Plural value={failures.length} one="# change couldn't be made:" other="# changes couldn't be made:" />
					</p>
					<ul className="grid list-disc gap-0.5 ps-5 text-body-xs">
						{failures.map((failure, index) => (
							<li key={index}>{failure}</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex min-h-8 items-center justify-between gap-2">
				<CallStatusLabel kind={status.kind} />
				{status.kind === "applied" && status.canUndo && (
					<Button size="sm" variant="ghost" isDisabled={readOnly} onPress={() => undoCall(found.call, options)}>
						<Icon name="arrow-counter-clockwise" size={16} />
						<Trans>Undo</Trans>
					</Button>
				)}
				{status.kind === "undone" && (
					<Button size="sm" variant="ghost" isDisabled={readOnly} onPress={apply}>
						<Icon name="arrow-clockwise" size={16} />
						<Trans>Redo</Trans>
					</Button>
				)}
				{status.kind === "pending" && (
					<Button size="sm" variant="secondary" isDisabled={readOnly} onPress={apply}>
						<Trans context="Put the assistant's changes into the portfolio">Apply</Trans>
					</Button>
				)}
			</div>
		</section>
	);
}

type CallStatusLabelProps = { kind: ReturnType<typeof callStatus>["kind"] };

/** Where a reply's changes stand, as an icon and words; changes in it are announced politely. */
function CallStatusLabel({ kind }: CallStatusLabelProps) {
	return (
		<span role="status" className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
			{kind === "applied" && (
				<>
					<Icon name="check" size={16} className={cn("shrink-0", POP_CLASS)} />
					<Trans context="A proposed change has been applied">Applied</Trans>
				</>
			)}
			{kind === "undone" && (
				<>
					<Icon name="arrow-counter-clockwise" size={16} className="shrink-0" />
					<Trans>Undone</Trans>
				</>
			)}
			{kind === "pending" && (
				<>
					<Icon name="minus" size={16} className="shrink-0" />
					<Trans context="The assistant's changes, not in the portfolio yet">Not applied yet</Trans>
				</>
			)}
			{kind === "failed" && (
				<>
					<Icon name="warning-circle" size={16} className="shrink-0" />
					<Trans>Not applied</Trans>
				</>
			)}
		</span>
	);
}
