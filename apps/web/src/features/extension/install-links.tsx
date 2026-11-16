import type { ExtensionStore, ExtensionStoreUrls } from "./install";
import { buttonVariants, Link } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { currentExtensionInstall } from "./install";

/** The guide that explains saving from the browser (docs/guides/saving-jobs-from-your-browser.mdx). */
export const EXTENSION_GUIDE_PATH = "/docs/guides/saving-jobs-from-your-browser";

function storeLabel(store: ExtensionStore) {
	return store === "edge" ? <Trans>Add to Edge</Trans> : <Trans>Add to Chrome</Trans>;
}

type ExtensionInstallButtonProps = {
	size?: "sm" | "md";
	variant?: "primary" | "secondary";
	/** The store addresses; the real ones unless a test passes its own. */
	urls?: ExtensionStoreUrls;
};

/** The store button for this visitor's browser. Nothing until the extension is published and the browser can use it. */
export function ExtensionInstallButton({ size = "sm", variant = "secondary", urls }: ExtensionInstallButtonProps) {
	const { url, store } = currentExtensionInstall(urls);
	if (!url || !store) return null;

	return (
		<a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size, variant })}>
			<Icon name="plugs-connected" size={size === "sm" ? 16 : 18} />
			{storeLabel(store)}
		</a>
	);
}

type ExtensionInstallHintProps = { className?: string; urls?: ExtensionStoreUrls };

/**
 * A quiet line under the Save job form: the extension saves from the job site itself, so someone pasting links
 * one at a time is told about it. Hidden until the extension is published, and on browsers that can't install it.
 */
export function ExtensionInstallHint({ className, urls }: ExtensionInstallHintProps) {
	const { url } = currentExtensionInstall(urls);
	if (!url) return null;

	return (
		<p className={cn("flex flex-wrap items-center gap-x-1.5 text-body-xs text-muted", className)}>
			<Icon name="plugs-connected" size={16} className="shrink-0" />
			<span>
				<Trans>Saving from LinkedIn, Indeed, JobStreet or Glints?</Trans>
			</span>
			<Link href={url} target="_blank" rel="noopener noreferrer" className="text-body-xs">
				<Trans>Save in one click with the browser extension</Trans>
				<Link.Icon />
			</Link>
		</p>
	);
}
