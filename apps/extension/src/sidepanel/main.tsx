import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { activatePanelLocale, panelLocale } from "./i18n";
import { followSystemTheme } from "./theme";
import "./styles.css";

followSystemTheme();
const i18n = activatePanelLocale(panelLocale(chrome.i18n.getUILanguage()));

const queryClient = new QueryClient({
	defaultOptions: {
		// One retry for a passing blip; the panel shows what failed after that (01-desain.md §3.7).
		queries: { retry: 1, refetchOnWindowFocus: false },
	},
});

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<I18nProvider i18n={i18n}>
				<App />
			</I18nProvider>
		</QueryClientProvider>
	</StrictMode>,
);
