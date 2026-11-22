// W16–W17: changes the message implies, each one ticked by default. Nothing changes until Apply; Apply shows at once
// and commits when its Undo toast closes, even after leaving the part (one pending apply per reply).
import type { ReplyItem } from "./reply-card";
import type { Application } from "@/features/applications/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { isFixedChange, openChanges } from "@rezumi/career/workspace";
import { ActionButton, Block, Caption, CheckRow, Notice, Pill } from "../blocks";
import { createPendingRegistry, dispatchForOrigin } from "../state";
import { useDescribeChange } from "./describe-change";
import { client, orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { getDraftScope } from "@/draft";
import { useUserTime } from "@/features/applications/date";
import { useInvalidateApplications } from "@/features/applications/queries";
import { withUndo } from "@/features/career/undo";
import { showToast } from "@/ui";

/** Applies waiting on their Undo toast, by server and reply id; they outlive the Messages part. */
const replyApplies = createPendingRegistry<{ changes: number[]; at: Date }>();

type ProposalCardProps = { reply: ReplyItem; application: Application; now: Date; readOnly: boolean };

export function ProposalCard({ reply, application, now, readOnly }: ProposalCardProps) {
	const { t } = useLingui();
	const { day } = useUserTime();
	const queryClient = useQueryClient();
	const invalidate = useInvalidateApplications();
	const session = useSession();
	const describe = useDescribeChange(reply, application, now);
	const changes = reply.data.changes;
	const [ticked, setTicked] = useState<number[]>(() => openChanges(changes, application.status));
	const pendingKey = `${session.server}:${reply.id}`;
	const appliedNow = useSyncExternalStore(replyApplies.subscribe, () => replyApplies.get(pendingKey));
	const applied =
		appliedNow ??
		(reply.data.applied ? { changes: reply.data.applied.changes, at: new Date(reply.data.applied.at) } : null);
	const selected = applied ? applied.changes : ticked;
	const contact = application.contacts[0]?.name.split(" ")[0];
	const followUp = changes.find((change, index) => change.type === "follow-up" && applied?.changes.includes(index));
	const count = ticked.length;

	const onApply = () => {
		const chosen = ticked;
		if (!replyApplies.start(pendingKey, { changes: chosen, at: new Date() })) return;
		// The account that pressed Apply; the commit is dropped if another one is signed in by then.
		const origin = getDraftScope();
		withUndo({
			message: t`Application updated`,
			restore: () => replyApplies.finish(pendingKey),
			failed: () =>
				showToast({ title: t`Couldn't update the application. Nothing was changed; try again.`, variant: "danger" }),
			// The client, not this part's mutation: the commit may run after the screen is gone.
			commit: async () => {
				try {
					await dispatchForOrigin(origin, getDraftScope, async () => {
						await client.career.applyReply({ id: reply.id, changes: chosen });
						await Promise.all([
							invalidate(),
							queryClient.invalidateQueries({ queryKey: orpc.career.savedItems.key() }),
							queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() }),
						]);
					});
				} finally {
					replyApplies.finish(pendingKey);
				}
			},
		});
	};

	return (
		<Block
			title={t`Proposed changes`}
			trailing={
				<Pill
					tone={applied ? "success" : readOnly ? "default" : "accent"}
					label={
						applied
							? t({ message: "Applied", context: "A proposed change has been applied" })
							: readOnly
								? t`Not applied`
								: t`Waiting for you`
					}
				/>
			}
		>
			{changes.map((change, index) => {
				const { title, detail } = describe(change);
				const fixed = isFixedChange(change, application.status);
				return (
					<CheckRow
						key={`${reply.id}-change-${index}`}
						label={title}
						detail={detail}
						checked={fixed || selected.includes(index)}
						disabled={fixed || applied !== null || readOnly}
						onChange={(on) => setTicked((rows) => (on ? [...rows, index] : rows.filter((row) => row !== index)))}
					/>
				);
			})}
			{/* Only a message about scheduling can tempt adding an interview from an unconfirmed time. */}
			{reply.data.unconfirmed.length > 0 && !changes.some((change) => change.type === "offer") ? (
				<Caption>
					{contact
						? t`Confirm the time with ${contact} before adding a new interview.`
						: t`Confirm the time before adding a new interview.`}
				</Caption>
			) : null}
			{readOnly ? null : applied ? (
				<Notice
					status="success"
					icon="check-circle"
					message={
						followUp?.type === "follow-up" && followUp.at
							? t`Applied. Follow-up set for ${day(followUp.at)}.`
							: t`Applied. The application is updated.`
					}
				/>
			) : (
				<ActionButton
					full
					size="md"
					variant="primary"
					disabled={count === 0}
					label={count === 0 ? t`Nothing to apply` : plural(count, { one: "Apply # change", other: "Apply # changes" })}
					onPress={onApply}
					testID="messages-apply"
				/>
			)}
		</Block>
	);
}
