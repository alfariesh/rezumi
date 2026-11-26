import type { RouterOutput } from "@/api/client";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { openBrowserAsync } from "expo-web-browser";
import { Linking } from "react-native";
import { portfolioPageUrl } from "@rezumi/portfolio/sharing";
import { isPortfolioLive } from "@rezumi/resume/sharing";
import { AiConsentDeclined } from "@/api/ai-consent";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { useSession } from "@/auth/session";
import { showToast } from "@/ui";

export type Portfolio = NonNullable<RouterOutput["portfolio"]["get"]["portfolio"]>;
export type PortfolioMessage = RouterOutput["portfolio"]["messages"]["list"]["items"][number];

export function usePortfolio() {
	const online = useOnline();
	return useQuery({ ...orpc.portfolio.get.queryOptions(), enabled: online });
}

export function usePortfolioAddress(portfolio: Portfolio | null | undefined) {
	const { server } = useSession();
	const online = useOnline();
	const account = useQuery({ ...orpc.auth.getProfile.queryOptions(), enabled: Boolean(portfolio) && online });
	const domain = useQuery({ ...orpc.customDomain.get.queryOptions(), enabled: Boolean(portfolio) && online });
	const username = account.data?.username;
	const live = isPortfolioLive(portfolio);
	const url = username ? portfolioPageUrl(server, username, live, domain.data) : "";
	return { server, username, url, live };
}

export function portfolioFailure(error: unknown) {
	switch (error instanceof ORPCError ? error.code : "") {
		case "PORTFOLIO_EMAIL_NOT_VERIFIED":
			return t`Verify your email before publishing.`;
		case "PORTFOLIO_SUSPENDED":
			return t`This portfolio has been taken down.`;
		case "PORTFOLIO_EXISTS":
			return t`This account already has a portfolio.`;
		case "PORTFOLIO_SOURCE_INVALID":
			return t`Choose a different source. This one is unavailable.`;
		case "PORTFOLIO_VERSION_CONFLICT":
			return t`Your portfolio changed on another device. Reload it and try again.`;
		case "PLAN_LIMIT_REACHED":
		case "PLAN_FEATURE_REQUIRED":
			return t`This option isn't included in your current plan.`;
		case "PORTFOLIO_TOO_LARGE":
			return t`Your portfolio is too large to save these changes.`;
		default:
			return t`Couldn't complete the action. Try again.`;
	}
}

export function usePortfolioAction() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (run: () => Promise<void>) => run(),
		onError: (error) => {
			if (!(error instanceof AiConsentDeclined)) showToast({ title: portfolioFailure(error), variant: "danger" });
		},
		onSettled: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: orpc.portfolio.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.resume.list.key() }),
			]);
		},
	});
}

export async function openPortfolioLink(url: string) {
	try {
		if (url.startsWith("https:") || url.startsWith("http:")) await openBrowserAsync(url);
		else await Linking.openURL(url);
	} catch {
		showToast({ title: t`Couldn't open the link. Try again.`, variant: "danger" });
	}
}

export const setPublished = (isPublic: boolean) => async () => {
	await client.portfolio.setPublic({ isPublic });
};
