import type { UIMessage } from "ai";
import { Trans, useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { agentApprovalRequests } from "@rezumi/ai/tools/agent-tool-contracts";
import { Button, Text } from "@/ui";

type ToolApprovalsProps = {
	message: UIMessage;
	disabled: boolean;
	onDecision: (decision: { id: string; approved: boolean }) => void;
};

export function ToolApprovals({ message, disabled, onDecision }: ToolApprovalsProps) {
	const { t } = useLingui();
	return agentApprovalRequests(message).map(({ id, kind, text }) => (
		<View key={id} className="gap-3 rounded-2xl border border-border p-3">
			<Text weight="semibold">
				{kind === "search" ? (
					<Trans>Send this exact query to your web search provider?</Trans>
				) : (
					<Trans>Save this story to your Profile?</Trans>
				)}
			</Text>
			<Text selectable>{text}</Text>
			<View className="flex-row flex-wrap gap-2">
				<Button size="sm" isDisabled={disabled} onPress={() => onDecision({ id, approved: true })}>
					<Button.Label>{kind === "search" ? t`Search the web` : t`Save story`}</Button.Label>
				</Button>
				<Button size="sm" variant="secondary" isDisabled={disabled} onPress={() => onDecision({ id, approved: false })}>
					<Button.Label>
						<Trans>Skip</Trans>
					</Button.Label>
				</Button>
			</View>
		</View>
	));
}
