import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Locale } from "@rezumi/utils/locale";
import { useQuery } from "@tanstack/react-query";
import { portfolioPageLocale } from "@rezumi/portfolio/view";
import { usePortfolioRecord } from "./store";
import { authClient } from "@/libs/auth/client";
import { orpc } from "@/libs/orpc/client";

/** The source resume while it exists outside Trash; its sections fill the page. Null for a portfolio without one. */
export function useSourceResume() {
	const { sourceResume } = usePortfolioRecord();
	const id = sourceResume && !sourceResume.inTrash ? sourceResume.id : null;
	const query = useQuery({
		...orpc.resume.getById.queryOptions({ input: { id: id ?? "" } }),
		enabled: id !== null,
	});
	return {
		/** The resume's data, or null when there's none (yet). */
		data: (id ? (query.data?.data ?? null) : null) as ResumeData | null,
		resume: id ? query.data : undefined,
		isLoading: id !== null && query.isPending,
	};
}

/** Whose portfolio this is, for the page's last-resort name and its address. */
export function usePortfolioOwner() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	return {
		name: user?.name ?? "",
		username: user?.username ?? "",
		email: user?.email ?? "",
		emailVerified: user?.emailVerified ?? false,
		// The session arrives as JSON, so the date may still be text.
		createdAt: user?.createdAt ? new Date(user.createdAt) : null,
	};
}

/** The page's language, as the renderer decides it (`portfolioPageLocale`). */
export function pageLocaleOf(data: PortfolioData, resume: ResumeData | null): Locale {
	return portfolioPageLocale(data, resume);
}
