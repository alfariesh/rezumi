import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";
import { createNoindexFollowMeta } from "@/libs/seo";

/** The first run, outside the dashboard shell. Home sends a new account here once (`shouldStartOnboarding`). */
export const Route = createFileRoute("/onboarding")({
	component: RouteComponent,
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect({ to: "/auth/login", search: { callbackURL: location.href }, replace: true });
		return { session: context.session };
	},
	head: () => ({
		meta: [createNoindexFollowMeta()],
	}),
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	return <OnboardingPage session={session} />;
}
