import type { ImportKind } from "./read-file";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { ImportError, readResumeFile } from "./read-file";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { orpc } from "@/libs/orpc/client";

/** A file kind import can read, or the reason it can't, worded for the person importing. */
export function requireImportKind(kind: ImportKind | null): ImportKind {
	if (!kind) {
		throw new ImportError(
			t`This file type can't be imported. Use a PDF, Word, Rezumi or JSON Resume file, or a LinkedIn export (.zip).`,
		);
	}
	return kind;
}

/**
 * Reads a resume from a file with the account's AI connections: PDFs and Word files go to a working provider (or
 * Rezumi AI, by the user's choice) when there is one, and PDFs are read in the browser otherwise. Shared by New
 * document's import and the Profile's.
 */
export function useReadResumeFile() {
	const queryClient = useQueryClient();
	const providerState = useHasUsableAiProvider();
	const ai = useAiSource();

	return async (
		file: File,
		kind: Exclude<ImportKind, "cover-letter-json">,
		onRead?: (note: string) => void,
	): Promise<ResumeData> => {
		let aiAvailable = providerState.hasUsableProvider;
		if ((kind === "docx" || kind === "pdf") && providerState.isUnavailable) {
			try {
				const providers = await queryClient.fetchQuery({ ...orpc.aiProviders.list.queryOptions(), staleTime: 0 });
				aiAvailable = providers.some((provider) => provider.enabled && provider.testStatus === "success");
			} catch {
				// PDFs have a browser-only reader; a connection outage must not block that local path.
				if (kind !== "pdf")
					throw new ImportError(t`Couldn't load AI connections. Try again before importing this file.`);
				aiAvailable = false;
			}
		}
		return readResumeFile(file, kind, {
			aiAvailable,
			...(onRead ? { onRead } : {}),
			aiFields: aiSourceFields(ai),
		});
	};
}
