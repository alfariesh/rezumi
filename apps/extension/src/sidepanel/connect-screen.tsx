import type { TypographyProps } from "@heroui/react";
import { Button, linkVariants, Typography } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { rezumiLink } from "../shared/config";

/** HeroUI's Typography takes its look from `type` and its element from `render` (as apps/web/src/libs/typography.tsx). */
type TypographyRender = NonNullable<TypographyProps["render"]>;
const renderAsH1: TypographyRender = ({ children, ...props }) => <h1 {...props}>{children}</h1>;

/**
 * 01-desain.md §3.1: not connected yet. The button starts the sign-in flow from Phase 02; in Phase 01 it does nothing.
 */
export function ConnectScreen() {
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

			<div className="flex w-full max-w-xs flex-col items-center gap-y-3">
				<Button fullWidth>
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
