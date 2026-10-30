import { Button, Spinner } from "@heroui/react";
import { Trans } from "@lingui/react/macro";

type AiProviderLoadStateProps = {
	state: { isLoading: boolean; error: unknown; retry: () => void };
};

/** Loading and lookup failures must not be presented as missing saved connections. */
export function AiProviderLoadState({ state }: AiProviderLoadStateProps) {
	if (state.isLoading)
		return (
			<p role="status" className="flex items-center gap-2 p-3 text-sm text-muted">
				<Spinner size="sm" color="current" className="text-muted" aria-hidden />
				<Trans>Loading AI connections…</Trans>
			</p>
		);
	if (!state.error) return null;
	return (
		<div role="alert" className="grid justify-items-start gap-2 rounded-xl bg-default p-3 text-sm text-muted">
			<p>
				<Trans>Couldn't load AI connections. Your saved connections haven't changed.</Trans>
			</p>
			<Button size="sm" variant="secondary" onPress={state.retry}>
				<Trans>Try again</Trans>
			</Button>
		</div>
	);
}
