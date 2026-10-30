import { AlertDialog, Button, Input } from "@heroui/react";
import { t } from "@lingui/core/macro";
import * as React from "react";
import { HoldButton } from "@rezumi/ui/components/hold-button";
import { isImeComposing } from "@/libs/keyboard";

type AskOptions = {
	description?: string;
	confirmText?: string;
	cancelText?: string;
	/** Prompts only: the text the field starts with. */
	defaultValue?: string;
	/** Confirmations only: the confirm button must be held, for actions that can't be undone. */
	hold?: boolean;
};

type AskState = AskOptions & {
	open: boolean;
	title: string;
	/** A prompt asks for text; a confirmation only for yes or no. */
	withInput: boolean;
	resolve: ((value: string | null) => void) | null;
};

type Ask = (title: string, options: AskOptions | undefined, withInput: boolean) => Promise<string | null>;

const AskContext = React.createContext<Ask | null>(null);

/** One dialog answers both `useConfirm` and `usePrompt`: a question, and a text field when it's a prompt. */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = React.useState<AskState>({ open: false, title: "", withInput: false, resolve: null });
	const [value, setValue] = React.useState("");

	const ask: Ask = (title, options, withInput) =>
		new Promise((resolve) => {
			setValue(options?.defaultValue ?? "");
			setState({ ...options, open: true, title, withInput, resolve });
		});

	// Cancelling answers null; confirming answers the text (empty for a confirmation). The state stays while closing.
	const answer = (result: string | null) => {
		state.resolve?.(result);
		setState((previous) => ({ ...previous, open: false, resolve: null }));
	};

	return (
		<AskContext.Provider value={ask}>
			{children}

			<AlertDialog.Backdrop
				isOpen={state.open}
				onOpenChange={(open) => !open && answer(null)}
				isKeyboardDismissDisabled={false}
			>
				<AlertDialog.Container size="sm">
					<AlertDialog.Dialog>
						<AlertDialog.Header>
							{state.hold && <AlertDialog.Icon status="danger" />}
							<AlertDialog.Heading>{state.title}</AlertDialog.Heading>
						</AlertDialog.Header>

						{(state.description || state.withInput) && (
							<AlertDialog.Body className="grid gap-3">
								{state.description && <p>{state.description}</p>}
								{state.withInput && (
									<Input
										fullWidth
										value={value}
										aria-label={state.title}
										onChange={(event) => setValue(event.target.value)}
										onKeyDown={(event) => {
											if (isImeComposing(event)) return;
											if (event.key === "Enter") answer(value);
										}}
									/>
								)}
							</AlertDialog.Body>
						)}

						<AlertDialog.Footer>
							<Button slot="close" variant="tertiary">
								{state.cancelText ?? t`Cancel`}
							</Button>
							{state.hold ? (
								<HoldButton variant="danger" onConfirm={() => answer("")}>
									{state.confirmText}
								</HoldButton>
							) : (
								<Button onPress={() => answer(state.withInput ? value : "")}>{state.confirmText ?? t`Confirm`}</Button>
							)}
						</AlertDialog.Footer>
					</AlertDialog.Dialog>
				</AlertDialog.Container>
			</AlertDialog.Backdrop>
		</AskContext.Provider>
	);
}

function useAsk() {
	const ask = React.use(AskContext);
	if (!ask) throw new Error("useConfirm and usePrompt must be used within a <ConfirmDialogProvider />.");
	return ask;
}

/** Resolves true when the user confirms. */
export function useConfirm() {
	const ask = useAsk();
	return async (title: string, options?: Omit<AskOptions, "defaultValue">) =>
		(await ask(title, options, false)) !== null;
}

/** Resolves with the text entered, or null when the user cancels. */
export function usePrompt() {
	const ask = useAsk();
	return (title: string, options?: Omit<AskOptions, "hold">) => ask(title, options, true);
}
