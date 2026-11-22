import type { Proposal } from "@rezumi/resume/proposals";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { blockText, getProposalState } from "@rezumi/resume/proposals";
import { Button, Text, Typography } from "@/ui";

type ProposalCardProps = {
	proposal: Proposal;
	data: ResumeData;
	locked: boolean;
	onAccept: (proposal: Proposal) => void;
	onReject: (proposal: Proposal) => void;
};

/** A rewrite the review proposes: before and after, why, and Accept or Reject. */
export function ProposalCard({ proposal, data, locked, onAccept, onReject }: ProposalCardProps) {
	const { t } = useLingui();
	const state = getProposalState(data, proposal);

	return (
		<View className="gap-2 rounded-2xl bg-surface-secondary p-3" testID={`proposal-${proposal.id}`}>
			<Text size="xs" mono tone="muted">
				{proposal.location}
			</Text>
			<Typography type="body-sm" className="text-muted line-through">
				{blockText(proposal.before)}
			</Typography>
			<Typography type="body-sm">{blockText(proposal.after)}</Typography>
			<Typography type="body-xs" className="text-muted">
				{proposal.why}
			</Typography>
			{state === "stale" ? (
				<Text tone="warning">{t`This passage changed. Run the review again.`}</Text>
			) : state === "pending" ? (
				<View className="flex-row flex-wrap gap-2">
					<Button size="sm" isDisabled={locked} onPress={() => onAccept(proposal)}>
						<Button.Label>{t`Accept`}</Button.Label>
					</Button>
					<Button size="sm" variant="ghost" onPress={() => onReject(proposal)}>
						<Button.Label>{t`Reject`}</Button.Label>
					</Button>
				</View>
			) : (
				<Text tone="muted">{state === "accepted" ? t`Applied` : t`Rejected`}</Text>
			)}
		</View>
	);
}
