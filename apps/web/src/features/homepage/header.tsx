import type { Key } from "react-aria-components";
import { buttonVariants, Dropdown, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { Container } from "./ui";
import { ThemeToggleButton } from "@/features/theme/toggle-button";
import { changeLocale, localeMap } from "@/libs/locale";

/** The interface language, as a compact menu: every locale by its own name, the current one checked. */
function LanguageMenu() {
	const { i18n } = useLingui();
	const onSelectionChange = (keys: "all" | Set<Key>) => {
		const [locale] = keys === "all" ? [] : [...keys];
		if (typeof locale === "string" && locale !== i18n.locale) void changeLocale(locale);
	};

	return (
		<Dropdown>
			<IconButton icon="translate" label={t`Change language`} />
			<Dropdown.Popover placement="bottom end" className="max-h-96 min-w-56 overflow-y-auto">
				<Dropdown.Menu
					aria-label={t`Language`}
					selectionMode="single"
					selectedKeys={new Set([i18n.locale])}
					onSelectionChange={onSelectionChange}
				>
					{Object.entries(localeMap).map(([value, label]) => (
						<Dropdown.Item key={value} id={value} textValue={i18n.t(label)}>
							<Label>{i18n.t(label)}</Label>
							<Dropdown.ItemIndicator />
						</Dropdown.Item>
					))}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

/** The bar over the hero: the brand, language and theme, and the way back in. It scrolls away with the hero. */
export function LandingHeader() {
	return (
		<header id="top" className="relative z-20">
			<Container className="flex h-16 items-center gap-1">
				<a href="#top" className="me-auto flex items-center gap-2.5 rounded-lg" aria-label={t`Rezumi, back to top`}>
					<BrandIcon variant="icon" className="size-8" alt="" />
					<span className="text-lg font-semibold tracking-tight">Rezumi</span>
				</a>
				<LanguageMenu />
				<ThemeToggleButton />
				<Link to="/auth/login" className={buttonVariants({ variant: "ghost" })}>
					{t`Log in`}
				</Link>
			</Container>
		</header>
	);
}
