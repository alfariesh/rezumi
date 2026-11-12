import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Component, lazy, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";

/**
 * A lazily loaded part (the rich text editor, the map, a metric's preview) that can be loaded again: React keeps a
 * failed `lazy` failed, so each try gets a component of its own. Call it with the boundary's `attempt`.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- the same constraint React's own `lazy` uses
export function retryableLazy<T extends ComponentType<any>>(
	load: () => Promise<{ default: T }>,
): (attempt: number) => LazyExoticComponent<T> {
	const made = new Map<number, LazyExoticComponent<T>>();
	return (attempt) => {
		let component = made.get(attempt);
		if (!component) {
			component = lazy(load);
			made.set(attempt, component);
		}
		return component;
	};
}

type BoundaryProps = { onRetry: () => void; children: ReactNode };

/** Catches what its part throws, so one part that didn't load doesn't take the whole editor down with it. */
class Boundary extends Component<BoundaryProps, { failed: boolean }> {
	override state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	override componentDidCatch(error: unknown) {
		console.error("A part of the portfolio editor failed to load", error);
	}

	override render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div
				role="alert"
				className="flex flex-wrap items-center gap-3 rounded-xl border border-separator p-3 text-body-sm text-muted"
			>
				<Icon name="warning-circle" size={18} className="shrink-0 text-danger" />
				<span className="min-w-0 flex-1">
					<Trans>This part didn't load. Check your connection, then try again.</Trans>
				</span>
				<Button size="sm" variant="secondary" onPress={this.props.onRetry}>
					<Trans>Try again</Trans>
				</Button>
			</div>
		);
	}
}

type ChunkBoundaryProps = {
	/** The part, drawn for a try: pass `attempt` to the `retryableLazy` it uses. */
	children: (attempt: number) => ReactNode;
};

/** Shows a lazily loaded part, or a short message with "Try again" where it failed to load. */
export function ChunkBoundary({ children }: ChunkBoundaryProps) {
	const [attempt, setAttempt] = useState(0);
	return (
		<Boundary key={attempt} onRetry={() => setAttempt((count) => count + 1)}>
			{children(attempt)}
		</Boundary>
	);
}
