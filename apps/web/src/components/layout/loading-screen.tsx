import { Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useRouter } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { cn } from "@rezumi/utils/style";

export function LoadingScreen() {
	// Fades in on in-app navigations. On first load it takes over from the identical HTML loader in index.html, which
	// hides the moment React renders, so there it appears at full opacity instead of blinking the logo.
	const router = useRouter({ warn: false });
	const hasNavigated = router?.state.resolvedLocation !== undefined;

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex h-svh w-svw flex-col items-center justify-center gap-y-6 bg-bg",
				hasNavigated && "transition-opacity duration-standard ease-enter starting:opacity-0",
			)}
		>
			<BrandIcon variant="icon" className="size-12" />
			<Spinner size="md" color="current" aria-label={t`Loading`} />
		</div>
	);
}
