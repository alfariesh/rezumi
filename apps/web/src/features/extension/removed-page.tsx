import type { ExtensionStoreUrls } from "./install";
import { buttonVariants, Link as TextLink, Typography } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { EXTENSION_GUIDE_PATH, ExtensionInstallButton } from "./install-links";
import { renderAsH1 } from "@/libs/typography";

const SUPPORT_EMAIL = "hi@rezumi.app";
// Lingui macros take literals, so the subject lives here once. Nothing about the visitor goes in it.
const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Rezumi browser extension feedback")}`;

type ExtensionRemovedPageProps = { urls?: ExtensionStoreUrls };

/**
 * Where the browser sends someone who removes the Rezumi extension (`chrome.runtime.setUninstallURL`, plan
 * `.agents/docs/plans/plugin-browser`, aturan turunan #10). Nothing is collected: no form, no tracking, no data about
 * the visitor. Feedback is an email they choose to write.
 */
export function ExtensionRemovedPage({ urls }: ExtensionRemovedPageProps) {
	return (
		<main id="main-content" className="min-h-svh bg-background px-4 pt-28 pb-16">
			<div className="mx-auto grid max-w-xl gap-8">
				<header className="grid gap-3">
					<span className="grid size-12 place-items-center rounded-2xl bg-surface-secondary text-muted">
						<Icon name="plugs-connected" size={24} />
					</span>
					<Typography type="h2" render={renderAsH1} className="text-balance">
						<Trans>The Rezumi extension was removed</Trans>
					</Typography>
					<p className="text-body-sm text-pretty text-muted">
						<Trans>Your saved jobs, notes and reminders are still in your Rezumi account. Nothing was deleted.</Trans>
					</p>
				</header>

				<section aria-labelledby="removed-help" className="grid gap-3">
					<h2 id="removed-help" className="text-base font-medium">
						<Trans>Was something in the way?</Trans>
					</h2>
					<ul className="grid gap-2 text-body-sm">
						<li>
							<TextLink href={`${EXTENSION_GUIDE_PATH}#a-job-site-is-not-read-correctly`}>
								<Trans>A job site wasn't read correctly</Trans>
							</TextLink>
						</li>
						<li>
							<TextLink href={`${EXTENSION_GUIDE_PATH}#why-does-the-extension-need-linkedin-access`}>
								<Trans>It asked for more access than I expected</Trans>
							</TextLink>
						</li>
					</ul>
				</section>

				<section aria-labelledby="removed-access" className="grid gap-3">
					<h2 id="removed-access" className="text-base font-medium">
						<Trans>Also end its access to your account</Trans>
					</h2>
					<p className="text-body-sm text-muted">
						<Trans>
							Removing the extension doesn't sign it out of Rezumi on the server. To end its access, revoke it under
							Connected applications in Settings.
						</Trans>
					</p>
					<Link
						to="/dashboard/settings/app"
						hash="connected-apps"
						className={buttonVariants({ variant: "secondary", className: "w-fit" })}
					>
						<Trans>Open Connected applications</Trans>
					</Link>
				</section>

				<section aria-labelledby="removed-feedback" className="grid gap-3">
					<h2 id="removed-feedback" className="text-base font-medium">
						<Trans>Tell us why, if you like</Trans>
					</h2>
					<p className="text-body-sm text-muted">
						<Trans>
							This page doesn't ask for anything and doesn't know who you are. If you want us to know what to fix, write
							to us. We read every message.
						</Trans>
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<a href={FEEDBACK_MAILTO} className={buttonVariants({ variant: "secondary" })}>
							<Icon name="envelope-simple" size={18} />
							<Trans>Email {SUPPORT_EMAIL}</Trans>
						</a>
						<ExtensionInstallButton size="md" variant="secondary" {...(urls ? { urls } : {})} />
						<Link to="/dashboard/applications" className={buttonVariants({ variant: "ghost" })}>
							<Trans>Back to Rezumi</Trans>
						</Link>
					</div>
				</section>
			</div>
		</main>
	);
}
