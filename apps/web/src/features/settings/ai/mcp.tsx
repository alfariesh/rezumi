import { Button, InputGroup, Link, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { Swap } from "@rezumi/ui/components/swap";
import { SettingsSection } from "../section";

export function McpSection() {
	const address = `${window.location.origin}/mcp`;
	const [copied, setCopied] = useState(false);
	const [, copy] = useCopyToClipboard();

	return (
		<SettingsSection
			id="mcp"
			title={<Trans>MCP server</Trans>}
			description={
				<Trans>Let AI clients like Claude or Cursor read and edit your resumes, using an API key above.</Trans>
			}
		>
			<TextField fullWidth isReadOnly value={address} aria-label={t`MCP server address`}>
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Input spellCheck={false} dir="ltr" className="truncate font-mono text-sm font-medium" />
					<InputGroup.Suffix className="pe-1">
						<Button
							size="sm"
							variant="secondary"
							aria-live="polite"
							onPress={async () => {
								await copy(address);
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
						>
							<Swap swapped={copied} from={<Trans>Copy</Trans>} to={<Trans>Copied</Trans>} />
						</Button>
					</InputGroup.Suffix>
				</InputGroup>
			</TextField>
			<Link
				href="https://docs.rezumi.app/guides/using-the-mcp-server"
				target="_blank"
				rel="noopener noreferrer"
				className="w-fit text-sm"
			>
				<Trans>Setup guide</Trans>
				<Link.Icon />
			</Link>
		</SettingsSection>
	);
}
