import type { LetterWords } from "@rezumi/resume/cover-letter";
import type { CoverLetter } from "@rezumi/schema/cover-letter/data";
import { setupI18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { composeCoverLetter, createCoverLetterResumeData } from "@rezumi/resume/cover-letter";
import { getLocaleMessages, resolveLocale } from "@/libs/locale";

/** Document translations stay independent of the app's active language. */
export async function createLetterWordsForLocale(locale: string): Promise<LetterWords> {
	const i18n = setupI18n();
	i18n.loadAndActivate(await getLocaleMessages(locale));

	return {
		greeting: (name: string) => t(i18n)`Dear ${name},`,
		teamGreeting: t(i18n)`Dear hiring team,`,
		hiringTeam: t(i18n)`Hiring team`,
		signOff: t(i18n)`Kind regards,`,
		formatDate: (date: string) =>
			new Date(`${date}T12:00:00Z`).toLocaleDateString(i18n.locale, {
				day: "numeric",
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}),
	};
}

export const letterWordsQueryOptions = (locale: string) =>
	queryOptions({
		queryKey: ["letter-words", resolveLocale(locale)],
		queryFn: () => createLetterWordsForLocale(locale),
		staleTime: Infinity,
	});

/**
 * The letter's fixed words in its own language. A language not loaded yet (switching it, or a history version in
 * another one) keeps the words already shown until it arrives, a moment later: suspending here would swap the whole
 * editor for the full-screen loader. Only the first language suspends, and the route's loader has fetched it.
 */
export function useLetterWords(locale: string): LetterWords {
	const queryClient = useQueryClient();
	const ready = queryClient.getQueryData(letterWordsQueryOptions(locale).queryKey) !== undefined;
	const [shown, setShown] = useState(locale);
	// A loaded language becomes the fallback for the next switch.
	if (ready && shown !== locale) setShown(locale);

	useEffect(() => {
		if (ready) return;
		let live = true;
		// A failed load keeps the words already shown; the next change of language tries again.
		void queryClient
			.ensureQueryData(letterWordsQueryOptions(locale))
			.then(() => {
				if (live) setShown(locale);
			})
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, [locale, queryClient, ready]);

	return useSuspenseQuery(letterWordsQueryOptions(ready ? locale : shown)).data;
}

/** The letter as a one-section document the PDF renderer draws: sender header, recipient, greeting, body, sign-off. */
export const letterPageData = (letter: CoverLetter, words: LetterWords) =>
	createCoverLetterResumeData({ ...letter, ...composeCoverLetter(letter, words) });
