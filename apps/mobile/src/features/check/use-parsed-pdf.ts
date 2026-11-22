import type { AtsResult } from "@/features/ats-checker/check";
import { useLingui } from "@lingui/react/macro";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { runAtsCheck } from "@/features/ats-checker/check";

type ParsedState = {
	/** The latest result, kept while a newer PDF is read (marked stale). */
	result: { pdf: Uint8Array; value: AtsResult } | null;
	pending: boolean;
	error: string | null;
};

/**
 * Sends the rendered PDF to the server's checker once the person opts in, again whenever the page renders anew. The
 * server reads it in memory and stores nothing. Offline, the last result stays.
 */
export function useParsedPdf(pdf: Uint8Array | null, enabled: boolean) {
	const { t } = useLingui();
	const [state, setState] = useState<ParsedState>({ result: null, pending: false, error: null });
	const [attempt, setAttempt] = useState(0);
	const controller = useRef<AbortController | null>(null);

	useEffect(() => {
		if (!pdf || !enabled) return;
		const request = new AbortController();
		controller.current = request;
		const file = new File(Paths.cache, `check-parser-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
		void (async () => {
			try {
				await file.write(pdf);
				if (request.signal.aborted) return;
				setState((current) => ({ ...current, pending: true, error: null }));
				const value = await runAtsCheck(file.uri, "resume.pdf", "", request.signal);
				if (!request.signal.aborted) setState({ result: { pdf, value }, pending: false, error: null });
			} catch (error) {
				if (!request.signal.aborted)
					setState((current) => ({
						...current,
						pending: false,
						error: error instanceof Error ? error.message : t`Couldn't read the exported PDF.`,
					}));
			} finally {
				try {
					if (file.exists) file.delete();
				} catch {
					// The OS clears the cache directory eventually.
				}
			}
		})();
		return () => request.abort();
	}, [pdf, enabled, attempt, t]);

	return {
		...state,
		stale: !!state.result && state.result.pdf !== pdf,
		retry: () => setAttempt((value) => value + 1),
		cancel: () => {
			controller.current?.abort();
			setState((current) => ({ ...current, pending: false, error: t`PDF check canceled. Retry when ready.` }));
		},
	};
}
