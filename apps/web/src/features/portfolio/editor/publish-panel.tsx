import type { SettingOptions } from "./settings";
import type { PortfolioRecord } from "./store";
import type { Locale } from "@rezumi/utils/locale";
import {
	Alert,
	Button,
	buttonVariants,
	InputGroup,
	Label,
	ListBox,
	Modal,
	Popover,
	Select,
	TextField,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";
import { publicResumeUrl } from "@rezumi/resume/sharing";
import { PORTFOLIO_LIMITS, portfolioIndexableFrom } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { toast } from "@rezumi/ui/components/toast";
import { portfolioErrorMessage } from "../errors";
import { invalidatePortfolioQueries, isPortfolioLive } from "../status";
import { pageLocaleOf, usePortfolioOwner, useSourceResume } from "./context";
import { PanelGroup, TextInput } from "./fields";
import { changeSetting } from "./settings";
import { editPortfolio, usePortfolioData, usePortfolioRecord } from "./store";
import { useEditorView } from "./use-view";
import { Combobox } from "@/components/ui/combobox";
import { getLocaleOptions } from "@/features/locale/locale-options";
import { CopyLinkButton } from "@/features/resume/share/copy-link-button";
import { CustomDomainField } from "@/features/resume/share/custom-domain-field";
import { useShareOrigin } from "@/features/resume/share/use-share-origin";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { client, orpc } from "@/libs/orpc/client";

/** The portfolio's address: `/<username>` on the app (or its alias). */
export function usePortfolioUrl(): string {
	const origin = useShareOrigin();
	const { username } = usePortfolioOwner();
	return `${origin}/${encodeURIComponent(username)}`;
}

/** Changes a setting that lives beside the data (`changeSetting`), saying what went wrong when it couldn't. */
function useSettingAction() {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);

	const run = async (action: () => Promise<PortfolioRecord>, fallback: string, options: SettingOptions = {}) => {
		setPending(true);
		try {
			if ((await changeSetting(action, options)) === "unsaved") {
				toast.add({
					type: "error",
					description: t`Your latest changes aren't saved, so nothing was changed. Check the save status at the top, then try again.`,
				});
				return false;
			}
			void invalidatePortfolioQueries(queryClient);
			return true;
		} catch (error) {
			toast.add({ type: "error", description: portfolioErrorMessage(error, { fallback }) });
			return false;
		} finally {
			setPending(false);
		}
	};

	return { run, pending };
}

/** Publish: going live, the address, search engines, the page's language and the resume it comes from. */
export function PublishPanel() {
	return (
		<div className="grid gap-3 p-3">
			<PublishGroup />
			<DomainGroup />
			<SearchGroup />
			<LanguageGroup />
			<SourceGroup />
		</div>
	);
}

function PublishGroup() {
	const record = usePortfolioRecord();
	const url = usePortfolioUrl();
	const confirm = useConfirm();
	const { run, pending } = useSettingAction();
	const [dialogOpen, setDialogOpen] = useState(false);
	const suspended = record.suspendedAt !== null;
	const live = isPortfolioLive(record);

	const unpublish = async () => {
		const confirmed = await confirm(t`Unpublish your portfolio?`, {
			description: t`Visitors can't see it anymore. Your short link opens your primary resume again, if you have a published one.`,
			confirmText: t`Unpublish`,
		});
		if (!confirmed) return;
		const done = await run(() => client.portfolio.setPublic({ isPublic: false }), t`Couldn't unpublish. Try again.`);
		if (done) toast.add({ description: t`Your portfolio is no longer published` });
	};

	return (
		<PanelGroup icon="globe-hemisphere-west" title={<Trans>Publish</Trans>}>
			{suspended && (
				<Alert status="danger">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							<Trans>This portfolio was taken down</Trans>
						</Alert.Title>
						<Alert.Description>
							{record.suspendedReason ?? t`It can't be published. Contact support to appeal.`}
						</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			{record.isPublic ? (
				// Still on while taken down, so it can be switched off; visitors can't see it either way.
				<SwitchRow
					isSelected
					isDisabled={pending}
					onChange={() => void unpublish()}
					label={t`Published`}
					description={
						live
							? t`Anyone with the link can see your portfolio. Changes show as soon as they're saved.`
							: t`Visitors can't see it while it's taken down.`
					}
					className="items-start py-0"
				/>
			) : (
				<div className="grid gap-3">
					<div className="grid gap-1">
						<p className="text-sm font-medium">
							<Trans>Not published yet</Trans>
						</p>
						<p className="text-xs text-muted">
							<Trans>Only you can see it until you publish. After that, changes show as soon as they're saved.</Trans>
						</p>
					</div>
					<Button className="w-fit" isDisabled={pending || suspended} onPress={() => setDialogOpen(true)}>
						<Icon name="globe-hemisphere-west" size={18} />
						<Trans>Publish</Trans>
					</Button>
				</div>
			)}

			<TextField variant="secondary" isReadOnly value={url.replace(/^https?:\/\//, "")}>
				<Label>
					<Trans>Address</Trans>
				</Label>
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Input dir="ltr" className="font-mono text-sm" />
					<InputGroup.Suffix className="pe-1">
						<CopyLinkButton url={url} />
					</InputGroup.Suffix>
				</InputGroup>
			</TextField>

			{live && (
				<div className="grid grid-cols-2 gap-2">
					<a
						href={url}
						target="_blank"
						rel="noopener"
						className={buttonVariants({ variant: "secondary", className: "w-full" })}
					>
						<Icon name="arrow-square-out" size={18} />
						<Trans>Open page</Trans>
					</a>
					<QrCodeButton url={url} />
				</div>
			)}
			{dialogOpen && <PublishDialog onClose={() => setDialogOpen(false)} />}
		</PanelGroup>
	);
}

/** The account's own domain, the same control as in a resume's Share panel. */
function DomainGroup() {
	const { flags } = useRouteContext({ strict: false });
	if (!flags?.customDomains) return null;
	return (
		<PanelGroup icon="globe" title={<Trans>Your domain</Trans>}>
			<CustomDomainField suggest={flags.olacvSuggestion ?? false} />
		</PanelGroup>
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

/** The young-account rule in words, or null once the account is old enough to be indexed. */
function useIndexingDelay(): string | null {
	const owner = usePortfolioOwner();
	const { i18n } = useLingui();
	// When the editor opened is close enough: the date it names is days away.
	const [now] = useState(() => Date.now());
	if (!owner.createdAt) return null;
	const from = portfolioIndexableFrom(owner.createdAt);
	if (from.getTime() <= now) return null;
	const date = from.toLocaleDateString(i18n.locale, { day: "numeric", month: "long", year: "numeric" });
	return t`Your account is new, so search engines are kept away until ${date}, even with this on. It keeps fake pages out of Google.`;
}

const searchDescription = () =>
	t`Lets Google and other search engines list your portfolio, so recruiters can find you by name. It can take weeks to appear, or to disappear after you turn this off.`;

/**
 * Going live: the address, whether search engines may list it (on by default, owner decision #5) and, when the short
 * link opened the primary resume until now, where the resume moves to.
 */
function PublishDialog({ onClose }: { onClose: () => void }) {
	const id = useId();
	const record = usePortfolioRecord();
	const owner = usePortfolioOwner();
	const url = usePortfolioUrl();
	const origin = useShareOrigin();
	const delay = useIndexingDelay();
	const { run, pending } = useSettingAction();
	const [searchable, setSearchable] = useState(record.showInSearchEngines);
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const primary = resumes?.find((resume) => resume.isPrimary && resume.isPublic);
	const resumeUrl = primary ? publicResumeUrl(origin, { username: owner.username, slug: primary.slug }) : null;

	const resend = async () => {
		const { error } = await authClient.sendVerificationEmail({
			email: owner.email,
			callbackURL: "/builder/portfolio?mode=share",
		});
		toast.add(
			error
				? { type: "error", description: t`Couldn't send the email. Try again.` }
				: { type: "success", description: t`We sent a new verification link to ${owner.email}.` },
		);
	};

	const publish = async () => {
		const done = await run(
			async () => {
				if (searchable !== record.showInSearchEngines)
					await client.portfolio.updateSettings({ showInSearchEngines: searchable });
				return client.portfolio.setPublic({ isPublic: true });
			},
			t`Couldn't publish. Try again.`,
			{ saveFirst: true },
		);
		if (!done) return;
		toast.add({ type: "success", description: t`Your portfolio is live` });
		onClose();
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && !pending && onClose()}>
			<Modal.Container size="md">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					{!pending && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							<Trans>Publish your portfolio</Trans>
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body className="grid gap-4">
						<div className="grid gap-1">
							<span className="text-sm font-medium">
								<Trans>Your address</Trans>
							</span>
							<span dir="ltr" className="font-mono text-sm break-all">
								{url.replace(/^https?:\/\//, "")}
							</span>
						</div>
						{resumeUrl && (
							<Alert status="accent">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>
										<Trans>This address will open your portfolio</Trans>
									</Alert.Title>
									<Alert.Description>
										<Trans>
											Until now it opened your resume. Your resume stays at{" "}
											<span dir="ltr" className="font-mono break-all">
												{resumeUrl.replace(/^https?:\/\//, "")}
											</span>
											, and your portfolio links to it.
										</Trans>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
						<SwitchRow
							isSelected={searchable}
							onChange={setSearchable}
							label={t`Show in search engines`}
							description={delay ? `${searchDescription()} ${delay}` : searchDescription()}
							className="items-start py-0"
						/>
						{!owner.emailVerified && (
							<Alert status="warning">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>
										<Trans>Verify your email address first</Trans>
									</Alert.Title>
									<Alert.Description>
										<Trans>
											We sent a link to {owner.email}.{" "}
											<button type="button" className="underline" onClick={() => void resend()}>
												Send it again
											</button>
										</Trans>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
					</Modal.Body>
					<Modal.Footer>
						<Button variant="secondary" isDisabled={pending} onPress={onClose}>
							<Trans>Cancel</Trans>
						</Button>
						<Button isPending={pending} isDisabled={!owner.emailVerified} onPress={() => void publish()}>
							<Icon name="globe-hemisphere-west" size={18} />
							<Trans>Publish</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

function SearchGroup() {
	const record = usePortfolioRecord();
	const { seo } = usePortfolioData();
	const view = useEditorView();
	const delay = useIndexingDelay();
	const { run, pending } = useSettingAction();

	return (
		<PanelGroup icon="magnifying-glass" title={<Trans>Search engines</Trans>}>
			<SwitchRow
				isSelected={record.showInSearchEngines}
				isDisabled={pending}
				onChange={(checked) =>
					void run(
						() => client.portfolio.updateSettings({ showInSearchEngines: checked }),
						t`Couldn't change this setting. Try again.`,
					)
				}
				label={t`Show in search engines`}
				description={
					record.showInSearchEngines
						? delay
							? `${searchDescription()} ${delay}`
							: searchDescription()
						: t`Off. Search engines won't list your portfolio, but anyone with the link can still open it.`
				}
				className="items-start py-0"
			/>
			<TextInput
				label={t`Title in search results`}
				value={seo.title ?? ""}
				maxLength={PORTFOLIO_LIMITS.text.seoTitle}
				placeholder={view.seo.title}
				description={t`Empty uses your name and headline.`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							if (value.trim()) draft.seo.title = value;
							else delete draft.seo.title;
						},
						{ key: "seo.title" },
					)
				}
			/>
			<TextInput
				label={t`Description in search results`}
				multiline
				value={seo.description ?? ""}
				maxLength={PORTFOLIO_LIMITS.text.seoDescription}
				placeholder={view.seo.description}
				description={t`Empty uses your greeting or About me.`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							if (value.trim()) draft.seo.description = value;
							else delete draft.seo.description;
						},
						{ key: "seo.description" },
					)
				}
			/>
		</PanelGroup>
	);
}

/** A language's name in the app's language ("Indonesian", "Bahasa Indonesia" in Indonesian), else its code. */
function languageName(locale: string, appLocale: string): string {
	try {
		return new Intl.DisplayNames([appLocale, "en"], { type: "language" }).of(locale) ?? locale;
	} catch {
		return locale;
	}
}

function LanguageGroup() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const { i18n } = useLingui();
	// The resume's language by name (the placeholder's name stays, so its translations do).
	const resumeLocale = source.data
		? languageName(pageLocaleOf({ ...data, locale: undefined }, source.data), i18n.locale)
		: null;
	const languageId = useId();

	return (
		<PanelGroup icon="translate" title={<Trans>Page language</Trans>}>
			<div className="grid gap-1.5">
				<label htmlFor={languageId} className="text-sm font-medium">
					<Trans>Language of the page's own words</Trans>
				</label>
				<Combobox
					variant="secondary"
					id={languageId}
					showClear
					options={getLocaleOptions()}
					value={data.locale ?? null}
					placeholder={resumeLocale ? t`Same as my resume (${resumeLocale})` : t`Same as my resume`}
					onValueChange={(locale) =>
						editPortfolio((draft) => {
							if (locale) draft.locale = locale as Locale;
							else delete draft.locale;
						})
					}
				/>
				<span className="text-xs text-muted">
					<Trans>
						Changes section titles and button labels such as “View resume”, not your own text. Empty follows your
						resume.
					</Trans>
				</span>
			</div>
		</PanelGroup>
	);
}

const NO_RESUME = "none";

function SourceGroup() {
	const record = usePortfolioRecord();
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const { run, pending } = useSettingAction();
	const inTrash = record.sourceResume?.inTrash ?? false;
	const options = [
		...(resumes ?? []).map((resume) => ({ id: resume.id, label: resume.name })),
		{ id: NO_RESUME, label: t`No resume` },
	];
	const value = record.sourceResumeId && !inTrash ? record.sourceResumeId : NO_RESUME;

	return (
		<PanelGroup icon="file-text" title={<Trans>Source resume</Trans>}>
			{inTrash && (
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							<Trans>Your source resume is in Trash</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>
								Your portfolio still shows its own content. Choose another resume to fill Experience, Education and the
								other sections again.
							</Trans>
						</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			<Select
				value={value}
				isDisabled={pending}
				onChange={(key) => {
					if (typeof key !== "string" || key === value) return;
					void run(
						() => client.portfolio.updateSettings({ sourceResumeId: key === NO_RESUME ? null : key }),
						t`Couldn't change the source resume. Try again.`,
					);
				}}
				className="grid w-full gap-1.5"
			>
				<Label>
					<Trans>Career sections come from</Trans>
				</Label>
				<Select.Trigger>
					<Select.Value />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{options.map((option) => (
							<ListBox.Item key={option.id} id={option.id} textValue={option.label}>
								{option.label}
								<ListBox.ItemIndicator />
							</ListBox.Item>
						))}
					</ListBox>
				</Select.Popover>
			</Select>
			<p className="text-xs text-muted">
				<Trans>
					Your name, photo, experience, education, skills and contact details follow this resume as it changes. Your
					portfolio's own text, work and design stay as they are.
				</Trans>
			</p>
		</PanelGroup>
	);
}
