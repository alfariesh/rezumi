import type { agentWebSources } from "@rezumi/ai/tools/agent-tool-contracts";
import { ChatSource, ChatSources } from "@heroui-pro/react";
import { Trans } from "@lingui/react/macro";

type MessageSourcesProps = { sources: ReturnType<typeof agentWebSources> };

/**
 * The pages a web search or page read cited. Links open in a new tab; the hover preview and favicons are off, since
 * both would send the pages' domains to a third party before the reader chose to open one.
 */
export function MessageSources({ sources }: MessageSourcesProps) {
	return (
		<ChatSources defaultExpanded>
			<ChatSources.Trigger>
				<Trans>Sources</Trans>
			</ChatSources.Trigger>
			<ChatSources.Content>
				<ChatSources.List>
					{sources.map((source) => (
						<ChatSource
							key={source.url}
							href={source.url}
							title={source.title?.trim() || source.url}
							enablePreview={false}
						>
							<ChatSource.Trigger target="_blank" rel="noreferrer" />
						</ChatSource>
					))}
				</ChatSources.List>
			</ChatSources.Content>
		</ChatSources>
	);
}
