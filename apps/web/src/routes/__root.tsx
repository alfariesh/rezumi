import type { orpc } from "@/libs/orpc/client";
import type { Theme } from "@/libs/theme";
import type { FeatureFlags } from "@rezumi/api/features/flags";
import type { AuthSession } from "@rezumi/auth/types";
import type { Locale } from "@rezumi/utils/locale";
import type { QueryClient } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { I18nProvider, useLingui } from "@lingui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { LazyMotion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { I18nProvider as AriaI18nProvider, RouterProvider as AriaRouterProvider } from "react-aria-components";
import { Toaster } from "@rezumi/ui/components/toast";
import { isAppSectionPath } from "@rezumi/utils/app-paths";
import { isRTL } from "@rezumi/utils/locale";
import { BreakpointIndicator } from "@/components/layout/breakpoint-indicator";
import { DialogManager } from "@/dialogs/manager";
import { CommandPalette } from "@/features/command-palette";
import { useDocumentWebMcpTools } from "@/features/documents/webmcp";
import { ThemeProvider } from "@/features/theme/provider";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { loadRootContext } from "@/libs/root-context";
import { getHomepageMeta } from "@/libs/seo";

type RouterContext = {
	theme: Theme;
	locale: Locale;
	orpc: typeof orpc;
	queryClient: QueryClient;
	session: AuthSession | null;
	flags: FeatureFlags;
};

// Requested now, while the route loads, so animations are ready by the first render without blocking it.
const motionFeatures = import("@/libs/motion-features").then((module) => module.default);
const loadMotionFeatures = () => motionFeatures;

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
	// index.html carries the tags that never change (charset, viewport, icons, manifest); the server adds each page's
	// canonical link, social cards and structured data. The router only keeps the title and description current.
	head: () => {
		const { title, description } = getHomepageMeta();
		return { meta: [{ title }, { name: "description", content: description }] };
	},
	beforeLoad: async ({ context, location, preload }) => {
		const root = await loadRootContext(context.queryClient);
		const { aliasUrl, appUrl } = root.flags;
		// Sign-in and the editor live on APP_URL; the alias (APP_ALIAS_URL) only serves the public pages. The server
		// redirects full page loads; this catches links followed inside the app.
		if (!preload && appUrl && aliasUrl === window.location.origin && isAppSectionPath(location.pathname))
			throw redirect({ href: `${appUrl}${location.href}` });
		return root;
	},
});

function RootComponent() {
	const { theme, locale, queryClient, session } = Route.useRouteContext();
	const router = useRouter();
	const dir = isRTL(locale) ? "rtl" : "ltr";

	// WebMCP: browser agents can list and open the signed-in user's documents from any page.
	useDocumentWebMcpTools(session !== null);

	// The theme class is owned by ThemeProvider, which also follows the system appearance.
	useEffect(() => {
		document.documentElement.lang = locale;
		document.documentElement.dir = dir;
	}, [dir, locale]);

	return (
		<>
			<HeadContent />

			<QueryClientProvider client={queryClient}>
				<MotionConfig reducedMotion="user">
					<LazyMotion features={loadMotionFeatures}>
						<I18nProvider i18n={i18n}>
							{/* HeroUI is built on React Aria: its formats and direction follow the app locale, and its `href`s use the router. */}
							<AriaI18nProvider locale={locale}>
								<AriaRouterProvider navigate={(href) => router.navigate({ href })} useHref={(href) => href}>
									<ThemeProvider theme={theme}>
										<HotkeysProvider>
											<ConfirmDialogProvider>
												<Outlet />

												<DialogManager />
												<CommandPalette />
												<LocalizedToaster />

												{import.meta.env.DEV && <BreakpointIndicator />}
												{import.meta.env.DEV && (
													<TanStackDevtools
														config={{ position: "bottom-left" }}
														plugins={[
															{
																name: "TanStack Query",
																render: <ReactQueryDevtoolsPanel />,
															},
															{
																name: "TanStack Router",
																render: <TanStackRouterDevtoolsPanel />,
															},
														]}
													/>
												)}
											</ConfirmDialogProvider>
										</HotkeysProvider>
									</ThemeProvider>
								</AriaRouterProvider>
							</AriaI18nProvider>
						</I18nProvider>
					</LazyMotion>
				</MotionConfig>
			</QueryClientProvider>
		</>
	);
}

function LocalizedToaster() {
	useLingui();
	return <Toaster closeLabel={t`Close notification`} />;
}
