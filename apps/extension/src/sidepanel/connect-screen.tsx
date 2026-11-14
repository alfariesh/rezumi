import type { TypographyProps } from "@heroui/react";
import { Alert, Button, linkVariants, Typography } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { askWorker } from "./api";

/** HeroUI's Typography takes its look from `type` and its element from `render` (as apps/web/src/libs/typography.tsx). */
type TypographyRender = NonNullable<TypographyProps["render"]>;
const renderAsH1: TypographyRender = ({ children, ...props }) => <h1 {...props}>{children}</h1>;

type ConnectScreenProps = {
	/** The server ended the previous connection (01-desain.md §3.7 "Session ended"). */
	expired?: boolean;
};

/**
 * 01-desain.md §3.1: not connected yet. The button opens Rezumi's sign-in in a browser window (the service worker runs
 * it); once approved, the panel switches to the connected screen by itself.
 */
export function ConnectScreen({ expired = false }: ConnectScreenProps) {
	const { t } = useLingui();
	const connect = useMutation({ mutationFn: () => askWorker({ type: "connect" }) });
	const failure = connect.isError ? "failed" : connect.data?.ok === false ? connect.data.code : null;
	// Closing the sign-in window is a choice, not a failure.
	const message =
		failure === null || failure === "cancelled"
			? null
			: failure === "network"
				? t`You're offline. Check your connection and try again.`
				: t`Couldn't connect to Rezumi. Try again.`;

	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-y-6 px-6 py-10 text-center">
			<BrandIcon variant="icon" className="size-14" />

			<div className="space-y-2">
				<Typography type="h4" align="center" render={renderAsH1}>
					<Trans comment="Title of the browser extension's side panel before the account is connected">
						Save jobs to Rezumi
					</Trans>
				</Typography>
				<p className="text-sm text-balance text-muted">
					<Trans comment="Lead sentence in the browser extension's side panel before the account is connected">
						Save job postings from any site to your application tracker.
					</Trans>
				</p>
			</div>

			{expired || message ? (
				<Alert status={message ? "danger" : "warning"} className="w-full max-w-xs text-start">
					<Alert.Indicator>
						<Icon name="warning-circle" />
					</Alert.Indicator>
					<Alert.Content>
						<Alert.Description>
							{message ?? (
								<Trans comment="Browser extension: the server ended the connection (signed out or access revoked)">
									The connection to Rezumi ended. Connect again to continue.
								</Trans>
							)}
						</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}

			<div className="flex w-full max-w-xs flex-col items-center gap-y-3">
				<Button fullWidth isPending={connect.isPending} onPress={() => connect.mutate()}>
					<Trans comment="Button in the browser extension that signs in to Rezumi">Connect to Rezumi</Trans>
				</Button>
				<p className="text-sm text-muted">
					<Trans comment="Link in the browser extension to create a Rezumi account in a new tab">
						No account yet?{" "}
						<a
							href={rezumiLink("/auth/register")}
							target="_blank"
							rel="noreferrer"
							className={linkVariants().base({ className: "px-1" })}
						>
							Sign up free
						</a>
					</Trans>
				</p>
			</div>
		</main>
	);
}
