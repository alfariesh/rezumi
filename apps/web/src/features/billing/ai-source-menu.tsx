import type { CreditAction } from "@rezumi/schema/billing";
import { AlertDialog, Button, Description, Dropdown, Label, buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { Link } from "@tanstack/react-router";
import { create } from "zustand/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { chooseAiSource, creditCost, useAiSource } from "./ai-source";
import { creditCount } from "./credits";

type AiSourceMenuProps = {
	/** The kind of work the action next to it is, for its cost on Rezumi AI. */
	action: CreditAction;
	className?: string;
};

/**
 * Says which AI the action next to it runs on and, on Rezumi AI, what it costs, before the user runs it; it also
 * switches between Rezumi AI and the user's own connection. Shows nothing while the account doesn't choose.
 */
export function AiSourceMenu({ action, className }: AiSourceMenuProps) {
	const { choice, source, balance, own } = useAiSource();
	if (!choice) return null;
	const cost = creditCount(creditCost(action));

	return (
		<Dropdown>
			<Button
				size="sm"
				variant="ghost"
				className={cn("h-auto min-h-0 gap-1 px-2 py-1 text-xs font-normal text-muted", className)}
				aria-label={
					source === "rezumi" ? t`Runs on Rezumi AI for ${cost}. Change` : t`Runs on your AI connection. Change`
				}
			>
				<Icon name="sparkle" size={14} />
				{source === "rezumi" ? <Trans>Rezumi AI · {cost}</Trans> : <Trans>Your AI connection</Trans>}
				<Icon name="caret-down" size={12} />
			</Button>
			<Dropdown.Popover placement="bottom end" className="w-72">
				<Dropdown.Menu
					selectionMode="single"
					selectedKeys={source ? [source] : []}
					onAction={(key) => {
						if (key === "rezumi" || key === "own") chooseAiSource(key);
					}}
				>
					<Dropdown.Item id="rezumi" textValue="Rezumi AI">
						<span className="grid min-w-0 flex-1">
							<Label>Rezumi AI</Label>
							<Description>
								<Trans>
									{cost} each time · {creditCount(balance)} left
								</Trans>
							</Description>
						</span>
						<Dropdown.ItemIndicator />
					</Dropdown.Item>
					<Dropdown.Item id="own" textValue={t`Your AI connection`} isDisabled={own.length === 0}>
						<span className="grid min-w-0 flex-1">
							<Label>
								<Trans>Your AI connection</Trans>
							</Label>
							<Description>
								{own[0] ? own[0].label : <Trans>Add one in Settings to use it without credits</Trans>}
							</Description>
						</span>
						<Dropdown.ItemIndicator />
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

type AiCostNoteProps = {
	action: CreditAction;
	/** The connection the user picked for the action next to it. */
	providerId: string | undefined;
	className?: string;
};

/** For an action whose connection the user picks themselves: its Rezumi AI cost, when Rezumi AI is the one picked. */
export function AiCostNote({ action, providerId, className }: AiCostNoteProps) {
	const { choice, managed, balance } = useAiSource();
	if (!choice || !managed || providerId !== managed.id) return null;
	const cost = creditCount(creditCost(action));
	return (
		<span className={cn("text-xs text-muted", className)}>
			<Trans>
				Rezumi AI · {cost} · {creditCount(balance)} left
			</Trans>
		</span>
	);
}

type CreditsProblem = { required: number; balance: number };

const useCreditsDialogStore = create<{ problem: CreditsProblem | null }>(() => ({ problem: null }));

/** The credits a Rezumi AI action needed and the balance, when `error` says there weren't enough; else null. */
export function getCreditsProblem(error: unknown): CreditsProblem | null {
	if (!(error instanceof ORPCError) || error.code !== "INSUFFICIENT_CREDITS") return null;
	const data = (error.data ?? {}) as Record<string, unknown>;
	return {
		required: typeof data.required === "number" ? data.required : 0,
		balance: typeof data.balance === "number" ? data.balance : 0,
	};
}

/** Opens the credits dialog when `error` says Rezumi AI credits ran short; returns whether it did. */
export function openCreditsDialogForError(error: unknown) {
	const problem = getCreditsProblem(error);
	if (problem) useCreditsDialogStore.setState({ problem });
	return problem !== null;
}

const close = () => useCreditsDialogStore.setState({ problem: null });

/** Mounted once at the root: too few credits offers the user's own connection, Pro AI, or nothing. */
export function CreditsDialog() {
	const problem = useCreditsDialogStore((state) => state.problem);
	const { own } = useAiSource();
	const required = creditCount(problem?.required ?? 0);
	const balance = creditCount(problem?.balance ?? 0);

	return (
		<AlertDialog.Backdrop
			isOpen={problem !== null}
			onOpenChange={(open) => !open && close()}
			isKeyboardDismissDisabled={false}
		>
			<AlertDialog.Container size="sm">
				<AlertDialog.Dialog>
					<AlertDialog.CloseTrigger aria-label={t`Close`} />
					<AlertDialog.Header>
						<AlertDialog.Heading>
							<Trans>Not enough Rezumi AI credits</Trans>
						</AlertDialog.Heading>
					</AlertDialog.Header>
					<AlertDialog.Body>
						<p>
							<Trans>
								This needs {required} and you have {balance}. Use your own AI connection without credits, or get Pro AI
								for 100 credits.
							</Trans>
						</p>
					</AlertDialog.Body>
					<AlertDialog.Footer>
						{own.length > 0 ? (
							<Button
								className="flex-1"
								variant="secondary"
								onPress={() => {
									chooseAiSource("own");
									close();
								}}
							>
								<Trans>Use my connection</Trans>
							</Button>
						) : (
							<Link
								to="/dashboard/settings/app"
								hash="ai-providers"
								className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}
								onClick={close}
							>
								<Trans>Add my connection</Trans>
							</Link>
						)}
						<Link to="/dashboard/settings/billing" className={cn(buttonVariants(), "flex-1")} onClick={close}>
							<Trans>See Pro AI</Trans>
						</Link>
					</AlertDialog.Footer>
				</AlertDialog.Dialog>
			</AlertDialog.Container>
		</AlertDialog.Backdrop>
	);
}
