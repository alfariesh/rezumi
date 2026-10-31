import { linkVariants, Typography } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { androidCallbackIntent } from "@/features/auth/native-callback";
import { renderAsH1 } from "@/libs/typography";

export const Route = createFileRoute("/auth/native-callback")({
	component: NativeCallbackPage,
});

function openApp() {
	// Build only at navigation time: authorization codes must never enter rendered markup.
	window.location.assign(
		/Android/i.test(navigator.userAgent) ? androidCallbackIntent(window.location.search) : window.location.href,
	);
}

function NativeCallbackPage() {
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (/Android/i.test(navigator.userAgent) && params.has("state") && (params.has("code") || params.has("error")))
			openApp();
	}, []);

	return (
		<div className="space-y-4 text-center">
			<Typography type="h3" render={renderAsH1}>
				<Trans>Open the Rezumi app</Trans>
			</Typography>
			<p className="text-sm text-muted">
				<Trans>If the app did not open, try again on a device where it is installed.</Trans>
			</p>
			<a
				href="/auth/native-callback"
				className={linkVariants().base({ className: "min-h-11 underline" })}
				onClick={(event) => {
					event.preventDefault();
					openApp();
				}}
			>
				<Trans>Try opening the app again</Trans>
			</a>
		</div>
	);
}
