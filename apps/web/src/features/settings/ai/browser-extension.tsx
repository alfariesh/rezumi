import type { ExtensionStoreUrls } from "../../extension/install";
import { Link } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { currentExtensionInstall, EXTENSION_STORE_URLS } from "../../extension/install";
import { EXTENSION_GUIDE_PATH, ExtensionInstallButton } from "../../extension/install-links";
import { SettingsRow, SettingsSection } from "../section";

type BrowserExtensionSectionProps = { urls?: ExtensionStoreUrls };

/**
 * The browser extension: save jobs from the job site itself. The whole section stays hidden until the extension is
 * published (the store addresses in `extension/install.ts` are empty), so nobody is asked to install what can't be
 * installed yet.
 */
export function BrowserExtensionSection({ urls = EXTENSION_STORE_URLS }: BrowserExtensionSectionProps) {
	const { published, url } = currentExtensionInstall(urls);
	if (!published) return null;

	return (
		<SettingsSection
			icon="plugs-connected"
			id="browser-extension"
			title={<Trans>Browser extension</Trans>}
			description={<Trans>Save jobs from LinkedIn, Indeed, JobStreet, Glints and other job sites in one click.</Trans>}
		>
			<SettingsRow
				icon="globe-simple"
				title={<Trans>Rezumi for Chrome and Edge</Trans>}
				description={
					url ? (
						<Trans>Free on every plan. It reads a job page only when you ask, and clicks nothing for you.</Trans>
					) : (
						<Trans>
							Open Rezumi in Chrome or Edge on a computer to add it. Firefox, Safari and phones can't use it yet.
						</Trans>
					)
				}
			>
				{url ? (
					<ExtensionInstallButton urls={urls} />
				) : (
					<div className="flex flex-wrap gap-3 text-sm">
						{urls.chrome && (
							<Link href={urls.chrome} target="_blank" rel="noopener noreferrer">
								<Trans>Chrome Web Store</Trans>
								<Link.Icon />
							</Link>
						)}
						{urls.edge && (
							<Link href={urls.edge} target="_blank" rel="noopener noreferrer">
								<Trans>Edge Add-ons</Trans>
								<Link.Icon />
							</Link>
						)}
					</div>
				)}
			</SettingsRow>
			<Link href={EXTENSION_GUIDE_PATH} target="_blank" rel="noopener noreferrer" className="w-fit text-sm">
				<Trans>How saving from your browser works</Trans>
				<Link.Icon />
			</Link>
		</SettingsSection>
	);
}
