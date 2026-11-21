import type { AuthStep } from "./errors";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { authErrorMessage } from "./errors";
import { haptics } from "@/ui";

/**
 * Runs one sign-in step for a screen: `pending` while it runs (a second press is ignored), then `error` with the
 * sentence to show. Development builds log the cause (codes only; requests never carry secrets into errors).
 */
export function useAuthAction(step: AuthStep) {
	const { i18n } = useLingui();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const running = useRef(false);

	const run = async <T>(action: () => Promise<T>): Promise<T | undefined> => {
		if (running.current) return undefined;
		running.current = true;
		setPending(true);
		setError(null);
		try {
			return await action();
		} catch (cause) {
			if (__DEV__) console.warn(`Auth step ${step} failed`, cause);
			haptics.error();
			setError(authErrorMessage(i18n, cause, step));
			return undefined;
		} finally {
			running.current = false;
			setPending(false);
		}
	};

	return { pending, error, setError, run };
}
