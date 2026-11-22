// Why a search gave nothing (the web's SearchProblem): the day's searches, the server's budget, a list that can't be
// continued, too many at once, or the providers. The day's limit reads neutrally, with no plan or price (K6: no
// purchase UI in the app on either platform).
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { Alert, Button, Icon } from "@/ui";

type SearchProblemProps = {
	error: unknown;
	/** Asks for the same page again. */
	onRetry: () => void;
	/** Starts the list over from its first page, when a later page can't be continued. */
	onRestart: () => void;
};

export const problemCode = (error: unknown) => (error instanceof ORPCError ? String(error.code) : undefined);

export function SearchProblem({ error, onRetry, onRestart }: SearchProblemProps) {
	const { t } = useLingui();
	const code = problemCode(error);
	if (code === "PLAN_LIMIT_REACHED")
		return (
			<Notice
				status="warning"
				message={t`You've reached today's search limit. Results you already opened stay available. Try again tomorrow.`}
			/>
		);
	if (code === "JOBS_BUDGET_LIMITED")
		return (
			<Notice
				status="default"
				message={t`New searches are limited right now. Results you already opened stay available.`}
			/>
		);
	if (code === "BAD_REQUEST")
		return (
			<Notice
				status="default"
				message={t`This list can't be continued. Search again to see more jobs.`}
				action={{ label: t`Search again`, onPress: onRestart }}
			/>
		);
	return (
		<Notice
			status="danger"
			message={
				code === "RATE_LIMIT_EXCEEDED"
					? t`Too many searches in a short time. Wait a minute, then try again.`
					: t`Jobs couldn't be loaded. Try again in a moment.`
			}
			action={{ label: t`Try again`, onPress: onRetry }}
		/>
	);
}

type NoticeProps = {
	status: "default" | "warning" | "danger" | "accent";
	message: string;
	action?: { label: string; onPress: () => void } | undefined;
	testID?: string | undefined;
};

/** One line about the results, with its one action. */
export function Notice({ status, message, action, testID }: NoticeProps) {
	return (
		<Alert status={status} testID={testID}>
			<Alert.Indicator>
				<Icon
					name={status === "danger" || status === "warning" ? "warning-circle" : "info"}
					tone={status === "danger" ? "danger" : status === "warning" ? "warning" : "muted"}
				/>
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
			{action ? (
				<Button size="sm" variant="secondary" onPress={action.onPress}>
					<Button.Label>{action.label}</Button.Label>
				</Button>
			) : null}
		</Alert>
	);
}
