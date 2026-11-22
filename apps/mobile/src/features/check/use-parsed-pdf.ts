import type { AtsResult } from "@/features/ats-checker/check";
import { useLingui } from "@lingui/react/macro";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AtsCheckError, runAtsCheck } from "@/features/ats-checker/check";

type ParsedState = {
	/** The latest result and the resume version it was read from, kept while a newer PDF is read (marked stale). */
	result: { version: unknown; value: AtsResult } | null;
	pending: boolean;
	error: string | null;
};

export type ParsedPdf = ReturnType<typeof useParsedPdf>;

/** No version read yet (or a retry asked to read it again). */
const NOT_READ = Symbol("not read");

/**
 * Sends the rendered PDF to the server's checker while `enabled` (the person opted in and the parser view shows),
 * again whenever the resume changes. `version` is the resume the PDF was rendered from: a version already read is
 * not sent again, so switching views keeps the result. The server reads the file in memory and stores nothing.
 * Offline, the last result stays.
 */
export function useParsedPdf(pdf: Uint8Array | null, version: unknown, enabled: boolean) {
	const { t } = useLingui();
	const [state, setState] = useState<ParsedState>({ result: null, pending: false, error: null });
	const [attempt, setAttempt] = useState(0);
	const controller = useRef<AbortController | null>(null);
	const read = useRef<unknown>(NOT_READ);

	useEffect(() => {
		if (!pdf || !enabled || read.current === version) return;
		const request = new AbortController();
		controller.current = request;
		const file = new File(Paths.cache, `check-parser-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
		void (async () => {
			try {
				await file.write(pdf);
				if (request.signal.aborted) return;
				setState((current) => ({ ...current, pending: true, error: null }));
				const value = await runAtsCheck(file.uri, "resume.pdf", "", request.signal);
				if (request.signal.aborted) return;
				read.current = version;
				setState({ result: { version, value }, pending: false, error: null });
			} catch (error) {
				if (!request.signal.aborted)
					setState((current) => ({
						...current,
						pending: false,
						error: error instanceof AtsCheckError ? error.message : t`Couldn't read the exported PDF.`,
					}));
			} finally {
				try {
					if (file.exists) file.delete();
				} catch {
					// The OS clears the cache directory eventually.
				}
			}
		})();
		return () => {
			request.abort();
			// Disabled or replaced mid-read: the spinner stops; a newer read sets it again.
			setState((current) => (current.pending ? { ...current, pending: false } : current));
		};
	}, [pdf, version, enabled, attempt, t]);

	return {
		...state,
		stale: !!state.result && state.result.version !== version,
		retry: () => {
			read.current = NOT_READ;
			setAttempt((value) => value + 1);
		},
		cancel: () => {
			controller.current?.abort();
			setState((current) => ({ ...current, pending: false, error: t`PDF check canceled. Retry when ready.` }));
		},
	};
}
