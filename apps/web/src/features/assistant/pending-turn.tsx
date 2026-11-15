import { ChatMessage } from "@heroui-pro/react";
import { Trans } from "@lingui/react/macro";
import { cn } from "@rezumi/utils/style";
import { ThinkingLine } from "./orb";

type PendingTurnProps = {
	text: string;
	/** Only the first pending view, right after the empty state, catches the orb; later ones take over in place. */
	fly?: boolean;
	className?: string;
};

/**
 * A first message on its way: the question and "Thinking…" show at once, while the conversation is created and opened
 * (two requests) and before the thread's own view can take over. The empty state's orb flies into the thinking line.
 */
export function PendingTurn({ text, fly = true, className }: PendingTurnProps) {
	return (
		<div className={cn("grid content-start gap-3", className)}>
			<ChatMessage.User className="ps-8">
				<ChatMessage.Bubble className="max-w-full rounded-2xl rounded-ee-none bg-accent">
					<ChatMessage.Content className="wrap-anywhere whitespace-pre-wrap text-accent-foreground">
						{text}
					</ChatMessage.Content>
				</ChatMessage.Bubble>
			</ChatMessage.User>
			<ThinkingLine fly={fly}>
				<Trans>Thinking…</Trans>
			</ThinkingLine>
		</div>
	);
}
