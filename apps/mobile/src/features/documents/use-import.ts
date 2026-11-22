// Import from New: pick a file (PDF, Word, Rezumi or JSON Resume, cover letter JSON, LinkedIn export), read it with
// `import-file.ts`, then report what was found, as the web's import step. A newer run or Cancel drops the older one.
import type { ImportedDocument } from "./import-file";
import type { DocumentPickerAsset } from "expo-document-picker";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { getNetworkStateAsync } from "expo-network";
import { useEffect, useRef, useState } from "react";
import { forEachDatedEntry } from "@rezumi/schema/resume/dates";
import { ImportError, importDocument } from "./import-file";
import { useNewDocuments } from "./new-documents";
import { documentError } from "./queries";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { describeImportedDesign, usePlan } from "@/features/billing/plan";
import { showToast } from "@/ui";

export type ImportSummary = { sections: number; entries: number; flagged: number };

export type ImportStep =
	| { name: "idle" }
	| { name: "importing"; file: DocumentPickerAsset }
	| { name: "imported"; file: DocumentPickerAsset; document: ImportedDocument; summary: ImportSummary | null }
	| { name: "failed"; file: DocumentPickerAsset | null; message: string };

const ACCEPT = [
	"application/pdf",
	"application/json",
	"application/zip",
	"application/x-zip-compressed",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type ImportOptions = { aiAvailable: boolean; aiPdf: boolean; applicationId?: string | undefined };

export function useImport({ aiAvailable, aiPdf, applicationId }: ImportOptions) {
	const { t } = useLingui();
	const session = useSession();
	const queryClient = useQueryClient();
	const plan = usePlan();
	const [step, setStep] = useState<ImportStep>({ name: "idle" });
	const attempt = useRef(0);
	const abort = useRef<AbortController | null>(null);
	const cached = useRef<File | null>(null);

	const dropFile = () => {
		try {
			cached.current?.delete();
		} catch {
			/* Cache eviction is best effort; the picker's copy is in the cache directory. */
		}
		cached.current = null;
	};
	useEffect(
		() => () => {
			abort.current?.abort();
			dropFile();
		},
		[],
	);

	const read = async (file: DocumentPickerAsset) => {
		const run = ++attempt.current;
		const current = () => attempt.current === run && getServer() === session.server;
		abort.current?.abort();
		const controller = new AbortController();
		abort.current = controller;
		setStep({ name: "importing", file });
		try {
			const network = await getNetworkStateAsync();
			if (network.isConnected === false || network.isInternetReachable === false)
				throw new ImportError(t`You're offline. Try again when you reconnect.`);
			const document = await importDocument(file, aiAvailable, aiPdf, controller.signal);
			if (getServer() !== session.server) return;
			useNewDocuments.getState().markNew(document);
			if (!current()) {
				// Canceled or replaced after the server made it: the document exists, so the library still shows it.
				void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
				return;
			}
			// The server fits an imported design to the plan; say what changed.
			const notice = document.design ? describeImportedDesign(plan, document.design) : null;
			if (notice) showToast({ title: notice });
			if (applicationId) {
				// The document exists either way: a failed link must not lead to a second import.
				try {
					await client.documents.linkApplication({ type: document.type, id: document.id, applicationId });
				} catch {
					showToast({
						title: t`Couldn't link the application. Check Applications before retrying.`,
						variant: "warning",
					});
				}
				void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
			}
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			dropFile();
			const summary = document.type === "resume" ? await summarize(document.id, controller.signal) : null;
			if (current()) setStep({ name: "imported", file, document, summary });
		} catch (cause) {
			if (!current() || controller.signal.aborted) return;
			setStep({
				name: "failed",
				file,
				message: cause instanceof ImportError ? cause.message : documentError(cause),
			});
		}
	};

	const choose = async () => {
		const result = await getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: ACCEPT });
		const picked = result.canceled ? undefined : result.assets[0];
		if (!picked) return;
		dropFile();
		cached.current = new File(picked.uri);
		await read(picked);
	};

	return {
		step,
		choose: () =>
			void choose().catch(() => setStep({ name: "failed", file: null, message: t`Couldn't open the file.` })),
		cancel: () => {
			attempt.current++;
			abort.current?.abort();
			setStep({ name: "idle" });
			// The server may have finished the import before the request was dropped.
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			showToast({
				title: t`Import canceled. Refresh Documents before retrying if the upload had finished.`,
				variant: "warning",
			});
		},
	};
}

/** Sections and entries the import found, and the dates it couldn't read; a failure here never fails the import. */
async function summarize(id: string, signal: AbortSignal): Promise<ImportSummary | null> {
	try {
		const resume = await client.resume.getById({ id }, { signal });
		const sections = [...Object.values(resume.data.sections), ...resume.data.customSections].filter(
			(section) => section.items.length,
		);
		let flagged = 0;
		forEachDatedEntry(resume.data, (entry) => {
			if (entry.dates?.raw) flagged++;
		});
		const entries = sections.reduce((total, section) => total + section.items.length, 0);
		return { sections: sections.length, entries, flagged };
	} catch {
		return null;
	}
}
