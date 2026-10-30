import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { Button, buttonVariants, InputGroup, Label, Popover, Switch, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";
import { formatTimeSince, publicResumeUrl, summarizeViews } from "@rezumi/resume/sharing";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { AddressField } from "./address-field";
import { CopyLinkButton } from "./copy-link-button";
import { CustomDomainField } from "./custom-domain-field";
import { useShareOrigin } from "./use-share-origin";
import { templates } from "@/dialogs/resume/template/data";
import {
	useCurrentResume,
	useIsResumeLocked,
	usePatchResume,
	useResumeData,
	useUpdateResumeData,
} from "@/features/resume/builder/draft";
import { ResumePasswordDialog } from "@/features/resume/builder/password-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { toastError } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { orpc } from "@/libs/orpc/client";

const toastShareError = (error: unknown) =>
	toastError(error, t`Couldn't update sharing. Try again.`, { allowServerMessage: true });

/**
 * Share: the web page and everything about who sees what. Publishing, the address, the primary resume, the web
 * page's footer, privacy and the numbers. Private is the default; turning the link off keeps the address.
 */
export function SharePanel() {
	const resume = useCurrentResume();
	const { data: session } = authClient.useSession();
	const setting = useShareSetting();
	const { update, isPending } = setting;
	const isPublic = resume.isPublic ?? false;
	const origin = useShareOrigin();
	const username = session?.user.username ?? "";
	const url = publicResumeUrl(origin, { username, slug: resume.slug });

	const setPublic = async (checked: boolean) => {
		const done = await update({ isPublic: checked });
		if (done) toast.add({ description: checked ? t`Your web page is live` : t`Link turned off. The address is kept` });
	};

	const descriptionId = useId();

	return (
		<div className="grid gap-3 p-3">
			<ShareWidget
				icon="globe-hemisphere-west"
				title={<Trans>Public Link</Trans>}
				trailing={
					isPublic && (
						<Switch
							isSelected
							isDisabled={isPending || resume.isLocked}
							onChange={(checked) => void setPublic(checked)}
							aria-label={t`Public link`}
							aria-describedby={descriptionId}
						>
							<Switch.Content>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
							</Switch.Content>
						</Switch>
					)
				}
			>
				{isPublic ? (
					<p id={descriptionId} className="text-xs text-muted">
						{t`On. Anyone with the link can see your web page.`}
					</p>
				) : (
					<div className="grid gap-3">
						<div className="grid gap-1">
							<p className="text-sm font-medium">
								<Trans>Publish Your Resume</Trans>
							</p>
							<p className="text-xs text-muted">
								<Trans>Publish it to share a link that opens on any screen. Only you can see it until then.</Trans>
							</p>
						</div>
						<Button className="w-fit" isDisabled={isPending || resume.isLocked} onPress={() => void setPublic(true)}>
							<Icon name="globe-hemisphere-west" size={18} />
							<Trans>Publish</Trans>
						</Button>
					</div>
				)}

				<AddressField url={url} username={username} update={update} />

				{isPublic && (
					<div className={cn(ENTER_CLASS, "grid grid-cols-2 gap-2")}>
						<a
							href={url}
							target="_blank"
							rel="noopener"
							className={buttonVariants({ variant: "secondary", className: "w-full" })}
						>
							<Icon name="arrow-square-out" size={18} />
							<Trans>Open web page</Trans>
						</a>
						<QrCodeButton url={url} />
					</div>
				)}
			</ShareWidget>

			<AddressesSection origin={origin} username={username} setting={setting} />
			<WebPageSettings />
			<PrivacySettings setting={setting} />
			<ViewsAndDownloads isPublic={isPublic} />
		</div>
	);
}

type ShareWidgetProps = {
	icon: IconName;
	title: ReactNode;
	/** Sits at the end of the header: a switch or a short note. */
	trailing?: ReactNode;
	children: ReactNode;
};

/** One Share group: a labelled region with an icon and title on the gray shell, its content on the white card. */
function ShareWidget({ icon, title, trailing, children }: ShareWidgetProps) {
	const titleId = useId();

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					<Icon name={icon} size={16} className="shrink-0 text-muted" />
					<Widget.Title id={titleId} className="truncate">
						{title}
					</Widget.Title>
				</span>
				{trailing}
			</Widget.Header>
			<Widget.Content className="@container grid gap-4">{children}</Widget.Content>
		</Widget>
	);
}

type ShareSettings = {
	isPublic?: boolean;
	showDownloadButtons?: boolean;
	showInSearchEngines?: boolean;
	hideContactDetails?: boolean;
	isPrimary?: boolean;
	slug?: string;
};

type ShareSetting = ReturnType<typeof useShareSetting>;

/**
 * Saves Share settings that live beside the resume, not in it, and mirrors the result into the open draft. Share
 * makes one, so every switch is disabled while any of them saves.
 */
function useShareSetting() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const queryClient = useQueryClient();
	const { mutateAsync: updateResume, isPending } = useMutation(orpc.resume.update.mutationOptions());

	const update = async (settings: ShareSettings) => {
		try {
			const updated = await updateResume({ id: resume.id, ...settings });
			patchResume((draft) => {
				draft.isPublic = updated.isPublic;
				draft.showDownloadButtons = updated.showDownloadButtons;
				draft.showInSearchEngines = updated.showInSearchEngines;
				draft.hideContactDetails = updated.hideContactDetails;
				draft.isPrimary = updated.isPrimary;
				draft.slug = updated.slug;
			});
			// Another resume may have handed over its primary role.
			if (settings.isPrimary) void queryClient.invalidateQueries({ queryKey: orpc.resume.list.key() });
			return true;
		} catch (error) {
			toastShareError(error);
			return false;
		}
	};

	return { update, isPending };
}

type AddressesSectionProps = { origin: string; username: string; setting: ShareSetting };

/** The short link (`/<username>`) and custom domain, both opening the primary resume. */
function AddressesSection({ origin, username, setting }: AddressesSectionProps) {
	const resume = useCurrentResume();
	const { flags } = useRouteContext({ strict: false });
	const shortLink = publicResumeUrl(origin, { username, slug: resume.slug, isPrimary: true });

	return (
		<ShareWidget icon="link-simple-horizontal" title={<Trans>Short Link and Domain</Trans>}>
			<PrimaryRow setting={setting} />
			<TextField variant="secondary" isReadOnly value={shortLink.replace(/^https?:\/\//, "")}>
				<Label>
					<Trans>Short link</Trans>
				</Label>
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Input dir="ltr" className="font-mono text-[13px]" />
					<InputGroup.Suffix className="pe-1">
						<CopyLinkButton url={shortLink} />
					</InputGroup.Suffix>
				</InputGroup>
			</TextField>
			{flags?.customDomains && <CustomDomainField suggest={flags.olacvSuggestion ?? false} />}
		</ShareWidget>
	);
}

type ShareSettingProps = { setting: ShareSetting };

/** The primary resume opens at the account's short link and custom domain. Only a published resume can be primary. */
function PrimaryRow({ setting: { update, isPending } }: ShareSettingProps) {
	const resume = useCurrentResume();
	const confirm = useConfirm();
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const current = resumes?.find((item) => item.isPrimary && item.id !== resume.id);
	const isPublic = resume.isPublic ?? false;

	const setPrimary = async (checked: boolean) => {
		if (checked && current) {
			const confirmed = await confirm(t`Make this your primary resume?`, {
				description: t`“${current.name}” stops being your primary resume.`,
				confirmText: t`Make primary`,
			});
			if (!confirmed) return;
		}
		await update({ isPrimary: checked });
	};

	return (
		<SwitchRow
			isSelected={resume.isPrimary ?? false}
			isDisabled={isPending || resume.isLocked || (!isPublic && !resume.isPrimary)}
			onChange={(checked) => void setPrimary(checked)}
			label={t`Primary resume`}
			description={
				resume.isPrimary
					? isPublic
						? t`Your short link and custom domain open this resume.`
						: t`Your short link and custom domain say this resume isn't shared until you publish it again.`
					: current
						? t`Your short link and custom domain open “${current.name}”.`
						: t`Publish this resume to open it at your short link and custom domain.`
			}
			className="items-start py-0"
		/>
	);
}

/** The web page uses the resume's template and Design; the footer credit is its one setting of its own. */
function WebPageSettings() {
	const data = useResumeData();
	const updateResumeData = useUpdateResumeData();
	const locked = useIsResumeLocked();
	const template = data?.metadata.template ?? "onyx";

	return (
		<ShareWidget icon="desktop" title={<Trans>Web Page</Trans>}>
			<p className="text-xs text-muted">
				<Trans>
					Uses your {templates[template].name} template and Design, and fits any screen. Change them in Design.
				</Trans>
			</p>
			<SwitchRow
				isSelected={data?.metadata.web?.showCredit !== false}
				isDisabled={locked}
				onChange={(checked) =>
					updateResumeData((draft) => {
						draft.metadata.web = { ...draft.metadata.web, showCredit: checked };
					})
				}
				label={t`Show “Made with Rezumi”`}
				className="py-0"
			/>
		</ShareWidget>
	);
}

/** Who can find the page, open it, reach the author and download the PDF. */
function PrivacySettings({ setting: { update, isPending } }: ShareSettingProps) {
	const resume = useCurrentResume();
	const isPublic = resume.isPublic ?? false;
	const disabled = isPending || resume.isLocked;
	const searchBlocked = !isPublic || (resume.hasPassword ?? false);

	return (
		<ShareWidget icon="lock" title={<Trans>Privacy</Trans>}>
			<PasswordRow />
			<SwitchRow
				isSelected={resume.hideContactDetails ?? false}
				isDisabled={disabled}
				onChange={(checked) => void update({ hideContactDetails: checked })}
				label={t`Hide contact details`}
				description={t`Your email, phone, location and other header details, and references' phone numbers, are left out of the web page, its PDF and search results.`}
				className="items-start py-0"
			/>
			<SwitchRow
				isSelected={(resume.showInSearchEngines ?? false) && !searchBlocked}
				isDisabled={disabled || searchBlocked}
				onChange={(checked) => void update({ showInSearchEngines: checked })}
				label={t`Show in search engines`}
				description={
					searchBlocked
						? resume.hasPassword
							? t`Not available while the resume needs a password.`
							: t`Publish the web page first.`
						: resume.showInSearchEngines
							? t`Search engines such as Google may list your web page. It can take weeks to appear, or to disappear after you turn this off.`
							: t`Off. Let recruiters find you on Google by turning this on.`
				}
				className="items-start py-0"
			/>
			<SwitchRow
				isSelected={resume.showDownloadButtons !== false}
				isDisabled={disabled}
				onChange={(checked) => void update({ showDownloadButtons: checked })}
				label={t`Visitors can download the PDF`}
				className="py-0"
			/>
		</ShareWidget>
	);
}

/** Q3a: visitors enter a password before they see the resume. */
function PasswordRow() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const confirm = useConfirm();
	const [dialogOpen, setDialogOpen] = useState(false);
	const { mutateAsync: setPassword } = useMutation(orpc.resume.setPassword.mutationOptions());
	const { mutateAsync: removePassword } = useMutation(orpc.resume.removePassword.mutationOptions());

	const turnOff = async () => {
		const confirmed = await confirm(t`Remove the password?`, {
			description: t`Anyone with the link will be able to view your resume.`,
			confirmText: t`Remove password`,
		});
		if (!confirmed) return;
		try {
			await removePassword({ id: resume.id });
			patchResume((draft) => {
				draft.hasPassword = false;
			});
			toast.add({ description: t`Password removed` });
		} catch (error) {
			toastShareError(error);
		}
	};

	return (
		<>
			<SwitchRow
				isSelected={resume.hasPassword ?? false}
				isDisabled={resume.isLocked}
				onChange={(checked) => (checked ? setDialogOpen(true) : void turnOff())}
				label={t`Require a password`}
				description={
					resume.hasPassword
						? t`Visitors enter it before they see the resume. Share it only with people you trust.`
						: undefined
				}
				className="py-0"
			/>
			{dialogOpen && (
				<ResumePasswordDialog
					onClose={() => setDialogOpen(false)}
					onSubmit={async (password) => {
						await setPassword({ id: resume.id, password });
						patchResume((draft) => {
							draft.hasPassword = true;
						});
						toast.add({ description: t`Password set` });
					}}
				/>
			)}
		</>
	);
}

function QrCodeButton({ url }: { url: string }) {
	return (
		<Popover>
			<Button variant="secondary" className="w-full">
				<Icon name="qr-code" size={18} />
				<Trans>QR code</Trans>
			</Button>
			<Popover.Content placement="bottom start" className="w-auto">
				<Popover.Dialog className="p-3">
					<QRCodeSVG value={url} size={176} marginSize={2} title={t`QR code for ${url}`} />
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}

/** Only the owner sees these; downloads count successful clicks, including repeats. */
function ViewsAndDownloads({ isPublic }: { isPublic: boolean }) {
	const resume = useCurrentResume();
	const { i18n } = useLingui();
	const { data: statistics } = useQuery(orpc.resume.statistics.getById.queryOptions({ input: { id: resume.id } }));
	const { data: daily } = useQuery({
		...orpc.resume.statistics.getDailyById.queryOptions({ input: { id: resume.id, days: 30 } }),
		enabled: isPublic,
	});
	const summary = summarizeViews(daily ?? []);
	const lastView = statistics?.lastViewedAt ? formatTimeSince(statistics.lastViewedAt, i18n.locale) : "—";
	const firstDay = daily?.[0]?.date;

	return (
		<ShareWidget
			icon="chart-line-up"
			title={<Trans>Visitors</Trans>}
			trailing={
				<Widget.Description className="truncate">
					<Trans>Only you see these</Trans>
				</Widget.Description>
			}
		>
			{isPublic ? (
				<>
					<dl className="grid grid-cols-2 gap-2 @xs:grid-cols-3">
						<Stat value={summary.views} label={t`views · 30 days`} />
						<Stat value={summary.downloads} label={t`downloads`} />
						<Stat value={lastView} label={t`since last view`} className="col-span-2 @xs:col-span-1" />
					</dl>
					<div
						role="img"
						aria-label={t`Daily views over 30 days, peak ${summary.peak}`}
						className="flex h-14 items-end gap-[3px] pt-1"
					>
						{summary.bars.map((bar) => (
							<span
								key={bar.date}
								className="flex-1 rounded-t-sm bg-border"
								style={{ height: `${Math.max(6, Math.round(bar.height * 100))}%` }}
							/>
						))}
					</div>
					<div className="flex justify-between text-xs text-muted tabular-nums">
						<span>
							{firstDay
								? new Date(`${firstDay}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" })
								: ""}
						</span>
						<span>
							<Trans>Today</Trans>
						</span>
					</div>
				</>
			) : (
				<p className="text-sm text-muted">
					<Trans>
						Publish the web page to count views and downloads. Counts are anonymous, and search engines aren't counted.
					</Trans>
				</p>
			)}
			<p className="text-xs text-muted">
				<Trans>Download totals can include repeat clicks.</Trans>
			</p>
		</ShareWidget>
	);
}

type StatProps = { value: number | string; label: string; className?: string };

function Stat({ value, label, className }: StatProps) {
	return (
		<div className={cn("flex flex-col-reverse gap-0.5 rounded-xl bg-surface-secondary p-3", className)}>
			<dt className="text-xs text-muted">{label}</dt>
			<dd className="text-2xl font-semibold tabular-nums">{value}</dd>
		</div>
	);
}
