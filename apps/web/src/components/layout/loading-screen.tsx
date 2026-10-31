import { TextShimmer } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { cn } from "@rezumi/utils/style";

const QUOTE_INTERVAL = 3200;

/** Words for the wait: short, hopeful, about the search itself. */
function useQuotes() {
	return [
		t`Your next opportunity is already looking for you.`,
		t`Every application is a step closer.`,
		t`You only need one yes.`,
		t`Good things take time. Keep going.`,
		t`The right role is out there.`,
		t`Small steps, every day, add up.`,
		t`Rejection is just redirection.`,
		t`Show up. Apply. Repeat.`,
		t`Your story is worth telling well.`,
	];
}

export function LoadingScreen() {
	// Fades in on in-app navigations. On first load it takes over from the identical HTML loader in index.html, which
	// hides the moment React renders, so there it appears at full opacity instead of blinking the logo. That loader
	// reserves the quote's height (6rem), so the logo stays put.
	const router = useRouter({ warn: false });
	const hasNavigated = router?.state.resolvedLocation !== undefined;
	const quotes = useQuotes();
	const [index, setIndex] = useState(() => Math.floor(Math.random() * quotes.length));

	useEffect(() => {
		const timer = setInterval(() => setIndex((current) => (current + 1) % quotes.length), QUOTE_INTERVAL);
		return () => clearInterval(timer);
	}, [quotes.length]);

	return (
		<div
			role="status"
			className={cn(
				"fixed inset-0 z-50 flex h-svh w-svw flex-col items-center justify-center gap-y-6 bg-background",
				hasNavigated && "transition-opacity duration-standard ease-enter starting:opacity-0",
			)}
		>
			<BrandIcon variant="icon" className="size-12" />
			<span className="sr-only">{t`Loading`}</span>
			{/* Fixed height, top-aligned: one- and two-line quotes both sit right under the logo without moving it. */}
			<div aria-hidden="true" className="flex h-24 w-[min(34rem,calc(100vw-3rem))] items-start justify-center">
				<TextShimmer
					key={index}
					className="text-center text-2xl leading-tight font-semibold tracking-tight text-balance transition-opacity duration-500 ease-enter sm:text-3xl starting:opacity-0"
				>
					{quotes[index]}
				</TextShimmer>
			</div>
		</div>
	);
}
