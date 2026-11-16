import type { ReactNode } from "react";
import { Button, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { lazyRouteComponent } from "@tanstack/react-router";
import { Component, Fragment, Suspense } from "react";
import { useDialogStore } from "./store";

// The dialogs pull in forms, importers and editors; load them on first open so they stay out of every page's bundle.
// A tab left open across a deploy asks for a chunk that no longer exists: like the route chunks, that reloads the page
// once instead of failing.
const DialogContent = lazyRouteComponent(() => import("./renderers"), "DialogContent");

type DialogBoundaryProps = { onRetry: () => void; children: ReactNode };

/**
 * Catches what the open dialog throws. The manager renders in the root component, outside every route's error
 * boundary, so without this one a dialog that fails to load or render takes the whole page down.
 */
class DialogBoundary extends Component<DialogBoundaryProps, { failed: boolean }> {
	override state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	override componentDidCatch(error: unknown) {
		console.error("A dialog failed to load", error);
	}

	override render() {
		if (!this.state.failed) return this.props.children;
		return (
			<Modal.Container size="sm">
				<Modal.Dialog>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Body>
						<p role="alert" className="text-body-sm text-muted">
							<Trans>This part didn't load. Check your connection, then try again.</Trans>
						</p>
					</Modal.Body>
					<Modal.Footer>
						<Button
							variant="secondary"
							onPress={() => {
								this.props.onRetry();
								this.setState({ failed: false });
							}}
						>
							<Trans>Try again</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		);
	}
}

// A failed load stays failed until it is asked for again.
const retryDialogContent = () => void DialogContent.preload?.();

export function DialogManager() {
	const { open, activeDialog, openCount, onOpenChange } = useDialogStore();

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={(isOpen) => onOpenChange(isOpen)}>
			<Fragment key={openCount}>
				{activeDialog && (
					<DialogBoundary onRetry={retryDialogContent}>
						<Suspense>
							<DialogContent dialog={activeDialog} />
						</Suspense>
					</DialogBoundary>
				)}
			</Fragment>
		</Modal.Backdrop>
	);
}
