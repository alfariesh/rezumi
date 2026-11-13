import type { Locale } from "@rezumi/utils/locale";
import { Alert, Button, buttonVariants, InputGroup, Label, Modal, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useId, useState } from "react";
import { publicResumeUrl } from "@rezumi/resume/sharing";
import { PORTFOLIO_LIMITS, portfolioIndexableFrom } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { toast } from "@rezumi/ui/components/toast";
import { countPortfolioPlaceholders } from "../ai/apply";
import { BusinessCardButton } from "../card/business-card-dialog";
import { usePortfolioPageUrl } from "../card/use-page-url";
import { isPortfolioLive } from "../status";
import { languageName, pageLocaleOf, usePortfolioOwner, usePortfolioSource } from "./context";
import { PanelGroup, TextInput } from "./fields";
import { PasswordGroup } from "./password-group";
import { useSettingAction } from "./setting-action";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore, usePortfolioRecord } from "./store";
import { useEditorView } from "./use-view";
import { CellSelectField } from "@/components/input/select-field";
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

/** Publish: going live, the address, search engines, the page's language and the resume it comes from. */
export function PublishPanel() {
	return (
		<div className="grid gap-6 p-3">
			<PublishGroup />
			<PasswordGroup />
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
							<span className="block">{record.suspendedReason ?? t`It can't be published right now.`}</span>
							<span className="mt-1 block">
								<Trans>
									Only the Rezumi team can lift this. To appeal, email{" "}
									<a className="underline" href="mailto:hi@rezumi.app">
										hi@rezumi.app
									</a>
									.
								</Trans>
							</span>
						</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			{/* Still on while taken down, so it can be switched off; visitors can't see it either way. */}
			<CellSwitchRow
				label={t`Published`}
				isSelected={record.isPublic}
				isDisabled={pending || (suspended && !record.isPublic)}
				onChange={(checked) => (checked ? setDialogOpen(true) : void unpublish())}
			/>

			<TextField variant="secondary" isReadOnly value={url.replace(/^https?:\/\//, "")}>
				<Label>
					<Trans>Address</Trans>
				</Label>
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Prefix>
						<Icon name="link-simple-horizontal" size={18} className="text-muted" />
					</InputGroup.Prefix>
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
					<EditorBusinessCard />
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

/** The business card from the editor: the name and headline the page shows, and the address visitors use. */
function EditorBusinessCard() {
	const view = useEditorView();
	const { username } = usePortfolioOwner();
	const pageUrl = usePortfolioPageUrl(username);
	return (
		<BusinessCardButton name={view.basics.name} headline={view.basics.headline} username={username} pageUrl={pageUrl} />
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
	const placeholders = countPortfolioPlaceholders(record.data);
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const primary = resumes?.find((resume) => resume.isPrimary && resume.isPublic);
	const resumeUrl = primary ? publicResumeUrl(origin, { username: owner.username, slug: primary.slug }) : null;

	// One more link per dialog is enough; a second press while it's on its way sends nothing.
	const [resent, setResent] = useState<"no" | "sending" | "sent">("no");
	const resend = async () => {
		if (resent !== "no") return;
		setResent("sending");
		const { error } = await authClient.sendVerificationEmail({
			email: owner.email,
			callbackURL: "/builder/portfolio?mode=share",
		});
		setResent(error ? "no" : "sent");
		toast.add(
			error
				? { type: "error", description: t`Couldn't send the email. Try again.` }
				: { type: "success", description: t`We sent a new verification link to ${owner.email}.` },
		);
	};

	const publish = async () => {
		const done = await run(
			async () => {
				if (!record.hasPassword && searchable !== record.showInSearchEngines) {
					// Taken at once: when publishing then fails (email not verified, a plan), this switch has changed anyway.
					const updated = await client.portfolio.updateSettings({ showInSearchEngines: searchable });
					usePortfolioEditorStore.getState().applySettings(updated);
				}
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
						{record.hasPassword ? (
							<Alert status="accent">
								<Alert.Indicator>
									<Icon name="lock" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Title>
										<Trans>Only people with the password can see it</Trans>
									</Alert.Title>
									<Alert.Description>
										<Trans>
											Search engines don't list it, and link previews show a general picture. Remove the password in
											Publish → Password to change that.
										</Trans>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						) : (
							<>
								<CellSwitchRow isSelected={searchable} onChange={setSearchable} label={t`Show in search engines`} />
								{delay && <p className="px-1 text-body-xs text-muted">{delay}</p>}
							</>
						)}
						{placeholders > 0 && (
							<Alert status="warning">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>
										<Trans>Some parts are still to fill in</Trans>
									</Alert.Title>
									<Alert.Description>
										<Plural
											value={placeholders}
											one="# place written in [brackets] will show on your page as it is."
											other="# places written in [brackets] will show on your page as they are."
										/>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
						{owner.loaded && !owner.emailVerified && (
							<Alert status="warning">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>
										<Trans>Verify your email address first</Trans>
									</Alert.Title>
									<Alert.Description>
										{resent === "sent" ? (
											<Trans>We sent a new link to {owner.email}. Open it, then publish.</Trans>
										) : (
											<Trans>
												We sent a link to {owner.email}.{" "}
												<button
													type="button"
													className="underline disabled:opacity-60"
													disabled={resent === "sending"}
													onClick={() => void resend()}
												>
													Send it again
												</button>
											</Trans>
										)}
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
			{/* A password keeps search engines away whatever this says, so it shows off and can't be changed meanwhile. */}
			<CellSwitchRow
				isSelected={record.showInSearchEngines && !record.hasPassword}
				isDisabled={pending || record.hasPassword}
				onChange={(checked) =>
					void run(
						() => client.portfolio.updateSettings({ showInSearchEngines: checked }),
						t`Couldn't change this setting. Try again.`,
					)
				}
				label={t`Show in search engines`}
			/>
			{record.hasPassword ? (
				<p className="px-1 text-body-xs text-muted">
					<Trans>Off while your portfolio has a password.</Trans>
				</p>
			) : (
				record.showInSearchEngines && delay && <p className="px-1 text-body-xs text-muted">{delay}</p>
			)}
			<TextInput
				label={t`Title in search results`}
				value={seo.title ?? ""}
				maxLength={PORTFOLIO_LIMITS.text.seoTitle}
				icon="text-t"
				placeholder={view.seo.title}
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

function LanguageGroup() {
	const data = usePortfolioData();
	const source = usePortfolioSource();
	const { i18n } = useLingui();
	// The language the page takes without a choice, by name (the placeholder's name stays, so its translations do):
	// the source resume's, or the default one when the content comes from the Profile, which has no language.
	const automatic = languageName(pageLocaleOf({ ...data, locale: undefined }, source.designData), i18n.locale);
	const resumeLocale = source.designData ? automatic : null;

	return (
		<PanelGroup icon="translate" title={<Trans>Page language</Trans>}>
			<CellSelectField
				label={t`Language`}
				// The flag and the language's name; the code in the list view would crowd a cell.
				options={[
					{
						value: "",
						label: resumeLocale
							? t`Same as my resume (${resumeLocale})`
							: source.from === "profile"
								? t`Default (${automatic})`
								: t`Same as my resume`,
					},
					...getLocaleOptions().map(({ value, icon, textValue }) => ({ value, icon, label: textValue })),
				]}
				value={data.locale ?? ""}
				onChange={(locale) =>
					editPortfolio((draft) => {
						if (locale) draft.locale = locale as Locale;
						else delete draft.locale;
					})
				}
			/>
		</PanelGroup>
	);
}

// The Profile choice; resume ids are UUIDs, so it can't clash.
const FROM_PROFILE = "profile";

/** Where the career sections and details come from: the Profile (the default) or one resume. */
function SourceGroup() {
	const record = usePortfolioRecord();
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const { run, pending } = useSettingAction();
	const inTrash = record.sourceResume?.inTrash ?? false;
	const options = [
		{ id: FROM_PROFILE, label: t`Your Profile` },
		...(resumes ?? []).map((resume) => ({ id: resume.id, label: resume.name })),
	];
	// A source resume in Trash is no choice to show; the list asks for another.
	const value = inTrash ? "" : (record.sourceResumeId ?? FROM_PROFILE);

	return (
		<PanelGroup icon="file-text" title={<Trans>Source</Trans>}>
			{inTrash && (
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							<Trans>Your source resume is in Trash</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>
								Your portfolio still shows its own content. Choose your Profile or another resume to fill Experience,
								Education and the other sections again.
							</Trans>
						</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			{!inTrash && (
				<p className="px-1 text-body-xs text-muted">
					{value === FROM_PROFILE ? (
						<Trans>Experience, education and your other sections follow your Profile.</Trans>
					) : (
						<Trans>Experience, education and your other sections follow this resume.</Trans>
					)}
				</p>
			)}
			<CellSelectField
				label={t`Content from`}
				value={value}
				isDisabled={pending}
				options={options.map((option) => ({ value: option.id, label: option.label }))}
				onChange={(key) => {
					if (key === value) return;
					void run(
						() => client.portfolio.updateSettings({ sourceResumeId: key === FROM_PROFILE ? null : key }),
						t`Couldn't change the source. Try again.`,
					);
				}}
			/>
		</PanelGroup>
	);
}
