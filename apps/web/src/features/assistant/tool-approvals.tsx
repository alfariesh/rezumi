import type { UIMessage } from "ai";
import { Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { agentApprovalRequests } from "@rezumi/ai/tools/agent-tool-contracts";

type ToolApprovalsProps = {
	message: UIMessage;
	disabled: boolean;
	onDecision: (decision: { id: string; approved: boolean }) => void;
};

export function ToolApprovals({ message, disabled, onDecision }: ToolApprovalsProps) {
	return agentApprovalRequests(message).map(({ id, kind, text }) => (
		<div key={id} className="bg-surface-2 my-3 grid gap-3 rounded-lg border border-line p-4">
			<p className="text-sm font-medium">
				{kind === "search" ? (
					<Trans>Send this exact query to your web search provider?</Trans>
				) : (
					<Trans>Save this story to Knowledge?</Trans>
				)}
			</p>
			<p className="text-sm wrap-anywhere whitespace-pre-wrap">{text}</p>
			<div className="flex gap-2">
				<Button size="sm" isDisabled={disabled} onPress={() => onDecision({ id, approved: true })}>
					{kind === "search" ? <Trans>Search the web</Trans> : <Trans>Save story</Trans>}
				</Button>
				<Button size="sm" variant="secondary" isDisabled={disabled} onPress={() => onDecision({ id, approved: false })}>
					<Trans>Skip</Trans>
				</Button>
			</div>
		</div>
	));
}
