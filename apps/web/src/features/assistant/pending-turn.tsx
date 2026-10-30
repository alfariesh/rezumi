import { ChatMessage } from "@heroui-pro/react";
import { Spinner } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { TraceIcon, TraceLine, TraceTitle } from "@rezumi/ui/components/trace";
import { cn } from "@rezumi/utils/style";

type PendingTurnProps = { text: string; className?: string };

/**
 * A first message on its way: the question and "Thinking…" show at once, while the conversation is created and opened
 * (two requests) and before the thread's own view can take over.
 */
export function PendingTurn({ text, className }: PendingTurnProps) {
	return (
		<div className={cn("grid content-start gap-3", className)}>
			<ChatMessage.User className="ps-8">
				<ChatMessage.Bubble className="max-w-full rounded-2xl rounded-ee-none bg-accent">
					<ChatMessage.Content className="wrap-anywhere whitespace-pre-wrap text-accent-foreground">
						{text}
					</ChatMessage.Content>
				</ChatMessage.Bubble>
			</ChatMessage.User>
			<TraceLine status="running">
				<TraceIcon>
					<Spinner size="sm" color="current" aria-hidden />
				</TraceIcon>
				<TraceTitle>
					<Trans>Thinking…</Trans>
				</TraceTitle>
			</TraceLine>
		</div>
	);
}
