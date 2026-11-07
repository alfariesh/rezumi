import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { Chip, Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useId } from "react";
import { RENDERED_PORTFOLIO_THEMES } from "@rezumi/portfolio/editor";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { themeAudience, themeDescription } from "./themes";

/**
 * A theme's gallery picture (`pnpm --filter @rezumi/tooling portfolio:previews`): the top of its sample page with a
 * fictional persona. Indonesian pages show the Indonesian one, every other language the English one.
 */
const themePicture = (theme: PortfolioTheme, locale: string) =>
	`/portfolio-themes/thumb/${locale.split("-")[0] === "id" ? "id/" : ""}${theme}.webp`;

type ThemeGalleryProps = {
	value: PortfolioTheme;
	onChange: (theme: PortfolioTheme) => void;
	/** Two cards a row where there's room (the create dialog); one in the narrow Design panel. */
	columns?: 1 | 2;
};

/**
 * The theme gallery in the create dialog and the Design tab: each theme's picture, name, what it looks like and whom
 * it suits. Plus themes carry a "Plus" label; plan limits apply from Phase 07 (`01-desain.md` section 2). One radio
 * group: a single Tab stop, arrow keys move between themes.
 */
export function ThemeGallery({ value, onChange, columns = 1 }: ThemeGalleryProps) {
	const { i18n } = useLingui();
	const id = useId();

	return (
		<RadioGroup
			aria-label={t`Theme`}
			value={value}
			onChange={(next) => {
				const theme = RENDERED_PORTFOLIO_THEMES.find((candidate) => candidate === next);
				if (theme) onChange(theme);
			}}
			className={cn("grid gap-3 **:data-[slot=radio]:mt-0", columns === 2 && "sm:grid-cols-2")}
		>
			{RENDERED_PORTFOLIO_THEMES.map((theme) => {
				const info = PORTFOLIO_THEME_INFO[theme];
				return (
					<Radio
						key={theme}
						value={theme}
						aria-labelledby={`${id}-${theme}-name ${id}-${theme}-plan`}
						aria-describedby={`${id}-${theme}-description`}
						className="w-full"
					>
						<Radio.Content
							className={({ isSelected, isFocusVisible }) =>
								cn(
									"group grid w-full content-start gap-2 overflow-hidden rounded-2xl border p-2 text-start",
									isSelected ? "border-accent bg-accent-soft" : "border-separator hover:bg-default",
									isFocusVisible && "ring-2 ring-focus",
								)
							}
						>
							<img
								src={themePicture(theme, i18n.locale)}
								alt=""
								width={640}
								height={400}
								loading="lazy"
								decoding="async"
								className="aspect-[16/10] w-full rounded-xl border border-separator bg-default object-cover object-top"
							/>
							<span className="grid gap-1 px-1 pb-1">
								<span className="flex items-center gap-2 text-sm font-semibold">
									<span id={`${id}-${theme}-name`}>{info.name}</span>
									<Chip size="sm" variant="soft" color={info.plan === "plus" ? "accent" : "default"}>
										<span id={`${id}-${theme}-plan`}>{info.plan === "plus" ? "Plus" : <Trans>Free</Trans>}</span>
									</Chip>
									{theme === value && <Icon name="check-circle" size={18} className="ms-auto text-accent" />}
								</span>
								<span id={`${id}-${theme}-description`} className="grid gap-1">
									<span className="text-xs text-foreground">{themeDescription(theme)}</span>
									<span className="text-xs text-muted">{themeAudience(theme)}</span>
								</span>
							</span>
						</Radio.Content>
					</Radio>
				);
			})}
		</RadioGroup>
	);
}
