import { Alert, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { useResumeStore } from "@/features/resume/builder/draft";
import { ENTER_CLASS } from "@/libs/motion";

/** A save state's words: read out with the state, shown on hover, never on screen. The bar shows the icon. */
export const STATUS_WORDS = "sr-only";

/**
 * The save state beside the document name, as an icon: Saved, Saving…, Offline · saved on this device, or Not saved ·
 * Retry (Retry stays visible: it's the one thing to do).
 */
export function SaveStatus() {
	const status = useResumeStore((state) => state.saveStatus);
	const retrySave = useResumeStore((state) => state.retrySave);
	const words = {
		saving: t`Saving…`,
		saved: t`Saved`,
		idle: t`Saved`,
		offline: t`Offline · saved on this device`,
		error: t`Not saved`,
	}[status];

	return (
		<span
			role="status"
			aria-live="polite"
			title={words}
			className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-muted"
		>
			{status === "saving" && (
				<>
					<Spinner size="sm" color="current" aria-hidden />
					<span className={STATUS_WORDS}>
						<Trans>Saving…</Trans>
					</span>
				</>
			)}
			{(status === "saved" || status === "idle") && (
				<>
					<Icon name="cloud-check" size={16} />
					<span className={STATUS_WORDS}>
						<Trans>Saved</Trans>
					</span>
				</>
			)}
			{status === "offline" && (
				<span className={cn(ENTER_CLASS, "flex min-w-0 items-center gap-1.5 text-warning")}>
					<Icon name="cloud-slash" size={16} />
					<span className={cn("truncate", STATUS_WORDS)}>
						<Trans>Offline · saved on this device</Trans>
					</span>
				</span>
			)}
			{status === "error" && (
				<span className={cn(ENTER_CLASS, "flex min-w-0 items-center gap-1.5 text-danger")}>
					<Icon name="cloud-warning" size={16} />
					<span className={STATUS_WORDS}>
						<Trans>Not saved</Trans>
					</span>
					<span aria-hidden="true" className={STATUS_WORDS}>
						·
					</span>
					<button
						type="button"
						onClick={retrySave}
						aria-label={t`Retry saving`}
						className="cursor-(--cursor-interactive) rounded-sm font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus"
					>
						<Trans>Retry</Trans>
					</button>
				</span>
			)}
		</span>
	);
}

/** Shown at the top of the panel while offline: editing carries on, Download and Share wait for a connection. */
export function OfflineBanner({ className }: { className?: string }) {
	const offline = useResumeStore((state) => state.saveStatus === "offline");
	if (!offline) return null;

	return (
		<Alert status="warning" role="status" className={cn(ENTER_CLASS, className)}>
			<Alert.Indicator>
				<Icon name="wifi-slash" size={20} />
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Description>
					<Trans>
						You can keep editing. Changes sync when you're back online. Download and Share need a connection.
					</Trans>
				</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
