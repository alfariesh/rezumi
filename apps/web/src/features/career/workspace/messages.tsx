import type { SavedData, SavedItem } from "../hooks";
import type { WorkspaceTabProps } from "./shell";
import { Button, Checkbox, Chip, Spinner, TextArea, Skeleton } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import {
	latest,
	useDebouncedSave,
	useDefaultProvider,
	useGenerate,
	useSavedItems,
	useSessionDraft,
	useWorkspace,
} from "../hooks";
import { formatMoney } from "../offer-compare";
import { CareerWidget, Swap, useCareerTime, withUndo, Working, workingSteps } from "../shared";
import { AiNotice } from "./fit";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getStageLabel } from "@/features/applications/stages";
import { useInvalidateApplications } from "@/features/applications/use-application-actions";
import { orpc } from "@/libs/orpc/client";

type ReplyItem = SavedItem & { data: SavedData<"reply"> };

/** W15–W17: paste what the employer wrote, read it, reply, and apply the changes it implies only if you choose. */
export function MessagesTab({ application, version, now }: WorkspaceTabProps) {
	const saved = useSavedItems(application.id);
	const workspace = useWorkspace(application.id);
	const readOnly = version?.data.kind === "reply";
	const reply = (readOnly ? version : latest(saved.data, "reply")) as ReplyItem | undefined;

	if (workspace.isPending || saved.isPending)
		return (
			<div className="grid gap-4 @3xl:w-1/2">
				<Skeleton className="h-28 rounded-lg" />
			</div>
		);

	return (
		<div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_280px] @5xl:grid-cols-[minmax(0,1fr)_360px]">
			<div className="grid gap-4">
				<PasteBox
					key={`paste-${version?.id ?? "live"}`}
					application={application}
					initial={readOnly ? (reply?.data.message ?? "") : workspace.data.message || (reply?.data.message ?? "")}
					readOnly={readOnly}
					onSave={(message) => workspace.save({ message })}
				/>
				{reply && <ReplyCard key={reply.id} reply={reply} readOnly={readOnly} />}
			</div>
			{reply && reply.data.changes.length > 0 && (
				<ProposalCard key={reply.id} reply={reply} application={application} now={now} readOnly={readOnly} />
			)}
		</div>
	);
}

type PasteBoxProps = {
	application: WorkspaceTabProps["application"];
	initial: string;
	readOnly: boolean;
	onSave: (message: string) => void;
};

/** W15: the employer's message, kept with the application, and "Read it for me". */
function PasteBox({ application, initial, readOnly, onSave }: PasteBoxProps) {
	const [message, setMessage] = useState(initial);
	const generate = useGenerate(application.id);
	const { provider } = useDefaultProvider();
	const flush = useDebouncedSave(message, initial, onSave);

	return (
		<CareerWidget title={t`Paste a message from ${application.company}`}>
			<TextArea
				fullWidth
				variant="secondary"
				id={`${application.id}-message`}
				value={message}
				maxLength={20_000}
				readOnly={readOnly}
				aria-label={t`Paste a message from ${application.company}`}
				placeholder={t`Paste the email or message, without the signature.`}
				onChange={(event) => setMessage(event.target.value)}
				onBlur={flush}
				className="min-h-[92px]"
			/>
			{!readOnly && (
				<div className="grid justify-items-start gap-2.5">
					<AiNotice />
					{provider && (
						<Button
							variant="secondary"
							isPending={generate.isPending}
							isDisabled={!message.trim()}
							onPress={() => void generate.run({ task: "reply", message: message.trim() }).catch(() => undefined)}
						>
							{generate.isPending ? (
								<Spinner size="sm" color="current" aria-hidden />
							) : (
								<Icon name="sparkle" size={18} />
							)}
							{generate.isPending ? <Working steps={workingSteps("reply")} /> : <Trans>Read it for me</Trans>}
						</Button>
					)}
				</div>
			)}
		</CareerWidget>
	);
}

type ReplyCardProps = { reply: ReplyItem; readOnly: boolean };

/** W16: what they're asking, what isn't confirmed, and a reply to edit and send yourself. */
function ReplyCard({ reply, readOnly }: ReplyCardProps) {
	const draft = useSessionDraft(`reply:${reply.id}`, reply.data.reply, (value) =>
		typeof value === "string" && value.length <= 4000 ? value : undefined,
	);
	const text = readOnly ? reply.data.reply : draft.value;

	const copy = async () => {
		await navigator.clipboard.writeText(text);
		toast.add({ description: t`Reply copied` });
	};

	return (
		<CareerWidget title={reply.data.title}>
			{(reply.data.asks.length > 0 || reply.data.unconfirmed.length > 0) && (
				<ul className="grid gap-2">
					{reply.data.asks.map((ask) => (
						<li key={ask} className="flex gap-2 text-sm leading-5">
							<Icon name="check" size={17} className="mt-0.5 shrink-0 text-success" />
							{ask}
						</li>
					))}
					{reply.data.unconfirmed.map((open) => (
						<li key={open} className="flex gap-2 text-sm leading-5">
							<Icon name="question" size={17} className="mt-0.5 shrink-0 text-warning" />
							{open}
						</li>
					))}
				</ul>
			)}
			{reply.data.reply && (
				<>
					<div className="grid gap-1.5">
						<label htmlFor={`${reply.id}-reply`} className="text-xs font-medium text-muted">
							<Trans>Suggested reply · edit before sending</Trans>
						</label>
						<TextArea
							fullWidth
							variant="secondary"
							id={`${reply.id}-reply`}
							value={text}
							readOnly={readOnly}
							maxLength={4000}
							onChange={(event) => draft.setValue(event.target.value)}
							className="min-h-[110px]"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<Button variant="secondary" size="sm" onPress={() => void copy()}>
							<Icon name="copy" size={16} />
							<Trans>Copy reply</Trans>
						</Button>
						<span className="text-xs text-muted">
							<Trans>You send it from your own email.</Trans>
						</span>
					</div>
				</>
			)}
		</CareerWidget>
	);
}

type ProposalCardProps = {
	reply: ReplyItem;
	application: WorkspaceTabProps["application"];
	now: Date;
	readOnly: boolean;
};

/**
 * W16–W17: changes the message implies, each one ticked by default. Nothing changes until Apply; Apply shows at once
 * and commits when its Undo toast closes.
 */
function ProposalCard({ reply, application, now, readOnly }: ProposalCardProps) {
	const { i18n } = useLingui();
	const { when, day } = useCareerTime();
	const queryClient = useQueryClient();
	const invalidate = useInvalidateApplications();
	const apply = useMutation(orpc.career.applyReply.mutationOptions());
	const changes = reply.data.changes;

	// A stage the application is already at (or can't reach from Saved) is shown fixed: nothing to apply.
	const fixed = (index: number) => {
		const change = changes[index];
		return change?.type === "stage" && (change.stage === application.status || application.status === "saved");
	};
	const open = changes.flatMap((_, index) => (fixed(index) ? [] : [index]));
	const [ticked, setTicked] = useState<number[]>(open);
	const [appliedNow, setAppliedNow] = useState<{ changes: number[]; at: Date } | null>(null);
	const applied =
		appliedNow ??
		(reply.data.applied ? { changes: reply.data.applied.changes, at: new Date(reply.data.applied.at) } : null);
	const selected = applied ? applied.changes : ticked;

	const contact = application.contacts[0]?.name.split(" ")[0];
	const current =
		application.followUpNote || describeNextStep(getNextStep(application, now), application, i18n.locale).title;

	const describe = (change: (typeof changes)[number]) => {
		switch (change.type) {
			case "stage": {
				const stage = getStageLabel(change.stage);
				if (change.stage === application.status)
					return { title: t`Stage stays ${stage}`, detail: t`No change needed. It's already at ${stage}.` };
				if (application.status === "saved")
					return { title: t`Move to ${stage}`, detail: t`Mark it as applied in Apply first.` };
				return {
					title: t`Move to ${stage}`,
					detail: t`Moves the application from ${getStageLabel(application.status)}.`,
				};
			}
			// One change carries the next step and, when a reply is due, its reminder.
			case "follow-up":
				if (!change.at)
					return { title: t`Next step: ${change.note}`, detail: t`Replaces “${current}” on the application.` };
				return {
					title: t`Follow up on ${when(change.at)}`,
					detail: change.note
						? t`Next step: ${change.note}. Adds a reminder to Today.`
						: t`Adds a reminder to Today if you haven't heard back by then.`,
				};
			case "offer": {
				const offer = reply.data.offer;
				const summary = offer
					? [offer.base === null ? "" : formatMoney(i18n.locale, offer.currency, offer.base), offer.location]
							.filter(Boolean)
							.join(" · ")
					: "";
				return {
					title: t`Save these offer terms to compare`,
					detail: summary ? t`${summary}. Opens in Career → Offers.` : t`Opens in Career → Offers.`,
				};
			}
		}
	};

	const followUp = changes.find((change, index) => change.type === "follow-up" && applied?.changes.includes(index));
	const count = ticked.length;

	const onApply = () => {
		const chosen = ticked;
		setAppliedNow({ changes: chosen, at: new Date() });
		withUndo({
			description: t`Application updated`,
			onUndo: () => setAppliedNow(null),
			commit: () =>
				apply.mutateAsync({ id: reply.id, changes: chosen }).then(
					() => {
						invalidate(application.id);
						void queryClient.invalidateQueries({ queryKey: orpc.career.savedItems.key() });
						void queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
					},
					() => {
						setAppliedNow(null);
						toast.add({
							type: "error",
							description: t`Couldn't update the application. Nothing was changed. Try again.`,
						});
					},
				),
		});
	};

	return (
		<CareerWidget
			title={<Trans>Proposed changes</Trans>}
			icon="list-checks"
			trailing={
				<Chip size="sm" variant="soft" color={applied ? "success" : readOnly ? "default" : "accent"}>
					{applied
						? t({ message: "Applied", context: "A proposed change has been applied" })
						: readOnly
							? t`Not applied`
							: t`Waiting for you`}
				</Chip>
			}
		>
			<ul className="grid gap-2">
				{changes.map((change, index) => {
					const { title, detail } = describe(change);
					const isFixed = fixed(index);
					const id = `${reply.id}-change-${index}`;
					return (
						<li key={id} className={cn("flex gap-2.5 rounded-xl bg-default px-3 py-2.5", isFixed && "opacity-70")}>
							<Checkbox
								variant="secondary"
								id={id}
								isSelected={isFixed || selected.includes(index)}
								isDisabled={isFixed || applied !== null || readOnly}
								onChange={(checked) =>
									setTicked((rows) => (checked ? [...rows, index] : rows.filter((row) => row !== index)))
								}
							>
								<Checkbox.Content className="items-start">
									<Checkbox.Control className="mt-px">
										<Checkbox.Indicator />
									</Checkbox.Control>
									<span className="grid gap-0.5 text-sm leading-5">
										<span className="font-semibold">{title}</span>
										<span className="text-muted">{detail}</span>
									</span>
								</Checkbox.Content>
							</Checkbox>
						</li>
					);
				})}
			</ul>

			{/* Only a message about scheduling can tempt adding an interview from an unconfirmed time. */}
			{reply.data.unconfirmed.length > 0 && !reply.data.changes.some((change) => change.type === "offer") && (
				<p className="text-xs text-muted">
					{contact
						? t`Confirm the time with ${contact} before adding a new interview.`
						: t`Confirm the time before adding a new interview.`}
				</p>
			)}

			{!readOnly && (
				<Swap id={applied ? "applied" : "pending"}>
					{applied ? (
						<p className="flex items-center gap-1.5 text-sm text-success">
							<Icon name="check-circle" size={17} />
							{followUp?.type === "follow-up" && followUp.at
								? t`Applied. Follow-up set for ${day(followUp.at)}.`
								: t`Applied. The application is updated.`}
						</p>
					) : (
						<Button fullWidth isDisabled={count === 0} onPress={onApply}>
							{count === 0 ? t`Nothing to apply` : plural(count, { one: "Apply # change", other: "Apply # changes" })}
						</Button>
					)}
				</Swap>
			)}
		</CareerWidget>
	);
}
