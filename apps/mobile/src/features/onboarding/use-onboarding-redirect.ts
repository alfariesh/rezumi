import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { shouldStartOnboarding } from "./queries";
import { getAccountScope, useSession } from "@/auth/session";
import { routes } from "@/routes";

/**
 * Home hands a new account over to onboarding (and an onboarding left at the first resume back to it). Checked when
 * Home opens for an account; a failed read leaves Home as it is.
 */
export function useOnboardingRedirect() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { status, server } = useSession();

	useEffect(() => {
		if (status !== "signed-in") return;
		let live = true;
		const scope = getAccountScope();
		void shouldStartOnboarding(queryClient, server, scope).then((start) => {
			if (live && start && getAccountScope() === scope) router.push(routes.onboarding());
		});
		return () => {
			live = false;
		};
	}, [status, server, queryClient, router]);
}
