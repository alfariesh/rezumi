import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Locale } from "@rezumi/utils/locale";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { portfolioPageLocale } from "@rezumi/portfolio/view";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { usePortfolioRecord } from "./store";
import { profileQueryOptions } from "@/features/profile/queries";
import { authClient } from "@/libs/auth/client";
import { orpc } from "@/libs/orpc/client";

/**
 * Where the page's career sections and contact details come from: the source resume while it exists outside Trash,
 * or, for a portfolio without one, the account's Profile (as resume data). A source resume in Trash leaves the page
 * without them; it never falls back to the Profile.
 */
export function usePortfolioSource() {
	const { sourceResume } = usePortfolioRecord();
	const id = sourceResume && !sourceResume.inTrash ? sourceResume.id : null;
	const fromProfile = sourceResume === null;
	const query = useQuery({
		...orpc.resume.getById.queryOptions({ input: { id: id ?? "" } }),
		enabled: id !== null,
	});
	const profile = useQuery({ ...profileQueryOptions(), enabled: fromProfile });
	const profileData = useMemo(() => (profile.data ? resumeDataFromProfile(profile.data.data) : null), [profile.data]);
	const data = (id ? (query.data?.data ?? null) : fromProfile ? profileData : null) as ResumeData | null;
	return {
		/** The source's content as resume data, or null when there's none (yet). */
		data,
		/** What the content comes from; null while there's none. */
		from: (id ? "resume" : fromProfile ? "profile" : null) as PortfolioSource["from"] | null,
		/** The source resume's data only: what may lend the page its language, accent and fonts. */
		designData: id ? data : null,
		resume: id ? query.data : undefined,
		isLoading: id !== null ? query.isPending : fromProfile && profile.isPending,
	};
}

/** Whose portfolio this is, for the page's last-resort name and its address. */
export function usePortfolioOwner() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	return {
		/** The session has arrived: until then the fields below are empty, not the person's. */
		loaded: user !== undefined,
		name: user?.name ?? "",
		username: user?.username ?? "",
		email: user?.email ?? "",
		emailVerified: user?.emailVerified ?? false,
		// The session arrives as JSON, so the date may still be text.
		createdAt: user?.createdAt ? new Date(user.createdAt) : null,
	};
}

/** A language's name in the app's language ("Indonesian", "Bahasa Indonesia" in Indonesian), else its code. */
export function languageName(locale: string, appLocale: string): string {
	try {
		return new Intl.DisplayNames([appLocale, "en"], { type: "language" }).of(locale) ?? locale;
	} catch {
		return locale;
	}
}

/**
 * The page's language, as the renderer decides it (`portfolioPageLocale`). Pass the source resume's data only
 * (`designData`): the Profile has no language.
 */
export function pageLocaleOf(data: PortfolioData, resume: ResumeData | null): Locale {
	return portfolioPageLocale(data, resume);
}
