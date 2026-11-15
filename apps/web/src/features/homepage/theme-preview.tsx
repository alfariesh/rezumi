import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { buttonVariants, Chip, Modal, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { portfolioThemeLineup } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { themeDescription, themeSample } from "@/features/portfolio/themes";

type Device = "desktop" | "phone";

type ThemePreviewProps = {
	/** The theme shown; null keeps the dialog closed. */
	theme: PortfolioTheme | null;
	onThemeChange: (theme: PortfolioTheme | null) => void;
	billingEnabled: boolean;
};

/**
 * A theme's whole sample page in a dialog, scrollable as a visitor reads it, on a desktop or a phone width, with the
 * other themes one arrow away. The page is a still document (`themeSample`) in a sandboxed frame: nothing on it runs.
 */
export function ThemePreview({ theme, onThemeChange, billingEnabled }: ThemePreviewProps) {
	const { i18n } = useLingui();
	const titleId = useId();
	const [device, setDevice] = useState<Device>("desktop");
	const [documents, setDocuments] = useState<Readonly<Record<string, string>>>({});
	const [failedUrl, setFailedUrl] = useState<string | null>(null);

	const url = theme ? themeSample(theme, i18n.locale) : null;
	const sample = url ? documents[url] : undefined;
	const index = portfolioThemeLineup.findIndex((item) => item.id === theme);
	const info = portfolioThemeLineup[index];

	useEffect(() => {
		if (!url || documents[url] !== undefined) return;
		const controller = new AbortController();
		fetch(url, { signal: controller.signal })
			.then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
			.then((html) => setDocuments((loaded) => ({ ...loaded, [url]: html })))
			.catch(() => {
				if (!controller.signal.aborted) setFailedUrl(url);
			});
		return () => controller.abort();
	}, [url, documents]);

	const step = (by: number) => {
		const next = portfolioThemeLineup[(index + by + portfolioThemeLineup.length) % portfolioThemeLineup.length];
		if (next) onThemeChange(next.id);
	};

	return (
		<Modal.Backdrop isOpen={theme !== null} onOpenChange={(open) => !open && onThemeChange(null)}>
			<Modal.Container size="full">
				<Modal.Dialog aria-labelledby={titleId} className="flex h-full flex-col gap-0 overflow-hidden p-0">
					<Modal.CloseTrigger aria-label={t`Close`} />
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-separator py-3 ps-4 pe-14">
						<div className="flex items-center gap-1">
							<IconButton
								icon="caret-left"
								variant="ghost"
								size="sm"
								label={t`Previous theme`}
								onPress={() => step(-1)}
							/>
							<IconButton icon="caret-right" variant="ghost" size="sm" label={t`Next theme`} onPress={() => step(1)} />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<Modal.Heading id={titleId} className="truncate text-lg font-semibold">
									{info?.name}
								</Modal.Heading>
								{billingEnabled && info && (
									<Chip size="sm" variant="soft" color={info.plan === "free" ? "success" : "accent"}>
										{info.plan === "free" ? t`Free` : "Plus"}
									</Chip>
								)}
							</div>
							{theme && <p className="truncate text-sm text-muted max-sm:hidden">{themeDescription(theme)}</p>}
						</div>
						<ToggleButtonGroup
							aria-label={t`Screen size`}
							size="sm"
							selectionMode="single"
							disallowEmptySelection
							selectedKeys={new Set([device])}
							onSelectionChange={(keys) => {
								const [next] = keys;
								if (next === "desktop" || next === "phone") setDevice(next);
							}}
							className="max-md:hidden"
						>
							<ToggleButton id="desktop" aria-label={t`Desktop`}>
								<Icon name="desktop" size={16} />
							</ToggleButton>
							<ToggleButton id="phone" aria-label={t`Phone`}>
								<ToggleButtonGroup.Separator />
								<Icon name="device-mobile" size={16} />
							</ToggleButton>
						</ToggleButtonGroup>
						<Link to="/auth/register" className={buttonVariants({ size: "sm", className: "max-sm:hidden" })}>
							{t`Use this theme`}
							<Icon name="arrow-right" size={16} />
						</Link>
					</div>

					<div className="flex min-h-0 flex-1 justify-center bg-surface-secondary p-3 md:p-4">
						<div
							className={cn(
								"relative w-full overflow-hidden rounded-xl bg-surface shadow-surface transition-[max-width] duration-standard ease-enter",
								device === "phone" ? "md:max-w-[390px]" : "max-w-full",
							)}
						>
							{sample !== undefined ? (
								// Sandboxed without scripts, as the editor's preview: the sample's links lead nowhere and nothing runs.
								<iframe
									key={url}
									title={t`${info?.name ?? ""} portfolio theme sample`}
									srcDoc={sample}
									sandbox="allow-same-origin"
									className="size-full border-0"
								/>
							) : failedUrl === url ? (
								<div role="alert" className="grid size-full place-items-center p-6 text-center text-sm text-muted">
									{t`The sample couldn't be loaded. Check your connection and try again.`}
								</div>
							) : (
								<div className="grid size-full place-items-center">
									<Spinner size="md" color="current" />
								</div>
							)}
						</div>
					</div>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
