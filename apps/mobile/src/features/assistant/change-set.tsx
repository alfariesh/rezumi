import type { Proposal, ProposalState } from "@rezumi/resume/proposals";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { blockText } from "@rezumi/resume/proposals";
import { Button, Icon, Text } from "@/ui";

type ChangeSetProps = {
	proposals: readonly Proposal[];
	states: readonly ProposalState[];
	locked: boolean;
	onAccept: (proposals: readonly Proposal[]) => void;
	onReject: (proposals: readonly Proposal[]) => void;
	undo: { id: string | undefined; canUndo: () => boolean; run: () => void } | null;
};

export function ChangeSet({ proposals, states, locked, onAccept, onReject, undo }: ChangeSetProps) {
	const { t } = useLingui();
	const pending = proposals.filter((_, index) => states[index] === "pending");
	const accepted = states.filter((state) => state === "accepted").length;
	return (
		<View className="overflow-hidden rounded-2xl border border-border bg-surface">
			<View className="flex-row flex-wrap items-center justify-between gap-2 bg-surface-secondary p-3">
				<Text weight="semibold" accessibilityRole="header">
					{pending.length > 0
						? plural(proposals.length, { one: "# proposed edit", other: "# proposed edits" })
						: t`${accepted} of ${proposals.length} applied`}
				</Text>
				{pending.length > 1 ? (
					<Button size="sm" isDisabled={locked} onPress={() => onAccept(pending)}>
						<Button.Label>
							<Trans>Accept all</Trans>
						</Button.Label>
					</Button>
				) : null}
			</View>
			{proposals.map((proposal, index) => {
				const state = states[index];
				return (
					<View key={proposal.id} className="gap-2 border-t border-separator p-3">
						<Text size="xs" weight="semibold" tone="muted">
							{proposal.location}
						</Text>
						{proposal.before ? (
							<Text tone="muted" className="line-through">
								{blockText(proposal.before)}
							</Text>
						) : null}
						<Text className="self-start rounded bg-accent-soft px-1">{blockText(proposal.after)}</Text>
						{proposal.why ? (
							<Text size="xs" tone="muted">
								{proposal.why}
							</Text>
						) : null}
						{state === "pending" ? (
							<View className="flex-row flex-wrap gap-2">
								<Button size="sm" testID="assistant-accept" isDisabled={locked} onPress={() => onAccept([proposal])}>
									<Button.Label>
										<Trans>Accept</Trans>
									</Button.Label>
								</Button>
								<Button
									size="sm"
									testID="assistant-reject"
									variant="secondary"
									isDisabled={locked}
									onPress={() => onReject([proposal])}
								>
									<Button.Label>
										<Trans>Reject</Trans>
									</Button.Label>
								</Button>
							</View>
						) : state === "accepted" ? (
							<View className="min-h-8 flex-row items-center gap-2">
								<Icon name="check" size={16} tone="success" />
								<Text size="xs" tone="success">
									<Trans context="A proposed change has been applied">Applied</Trans>
								</Text>
								{!locked && undo?.id === proposal.id && undo.canUndo() ? (
									<Button size="sm" testID="assistant-undo" variant="tertiary" onPress={undo.run}>
										<Button.Label>
											<Trans>Undo</Trans>
										</Button.Label>
									</Button>
								) : null}
							</View>
						) : (
							<Text size="xs" tone={state === "stale" ? "warning" : "muted"}>
								{state === "stale" ? <Trans>Out of date: the text has changed since.</Trans> : <Trans>Rejected</Trans>}
							</Text>
						)}
					</View>
				);
			})}
		</View>
	);
}
