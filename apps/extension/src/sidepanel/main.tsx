import { I18nProvider } from "@lingui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { activatePanelLocale, panelLocale } from "./i18n";
import { followSystemTheme } from "./theme";
import "./styles.css";

followSystemTheme();
const i18n = activatePanelLocale(panelLocale(chrome.i18n.getUILanguage()));

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

createRoot(root).render(
	<StrictMode>
		<I18nProvider i18n={i18n}>
			<App />
		</I18nProvider>
	</StrictMode>,
);
