import type { Theme } from "@/libs/theme";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../../store";
import { BaseCommandGroup, PaletteItem, searchText } from "../base";
import { useTheme } from "@/features/theme/provider";

export function ThemeCommandPage() {
	const { theme: currentTheme, setTheme } = useTheme();
	const setOpen = useCommandPaletteStore((state) => state.setOpen);

	const handleThemeChange = (theme: Theme) => {
		setTheme(theme, { playSound: false });
		setOpen(false);
	};

	return (
		<BaseCommandGroup page="theme" heading={<Trans>Theme</Trans>}>
			<PaletteItem
				id="theme.light"
				textValue={searchText(t`Light theme`, [t`Theme`])}
				checked={currentTheme === "light"}
				onAction={() => handleThemeChange("light")}
			>
				<Icon name="sun" />
				<Trans>Light theme</Trans>
			</PaletteItem>

			<PaletteItem
				id="theme.dark"
				textValue={searchText(t`Dark theme`, [t`Theme`])}
				checked={currentTheme === "dark"}
				onAction={() => handleThemeChange("dark")}
			>
				<Icon name="moon" />
				<Trans>Dark theme</Trans>
			</PaletteItem>

			<PaletteItem
				id="theme.system"
				textValue={searchText(t`Match system theme`, [t`Theme`])}
				checked={currentTheme === "system"}
				onAction={() => handleThemeChange("system")}
			>
				<Icon name="circle-half" />
				<Trans>Match system theme</Trans>
			</PaletteItem>
		</BaseCommandGroup>
	);
}
