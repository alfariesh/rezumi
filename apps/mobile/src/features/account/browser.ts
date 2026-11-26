import { useLingui } from "@lingui/react/macro";
import { openBrowserAsync } from "expo-web-browser";
import { showToast } from "@/ui";

export function useBrowserLink() {
	const { t } = useLingui();

	return (url: string) =>
		openBrowserAsync(url).catch(() =>
			showToast({ title: t`Couldn't open the browser. Try again.`, variant: "danger" }),
		);
}
