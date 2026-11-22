// Share's web page settings (plans/mobile Phase 08): preview, the short link and custom domain, the footer credit and
// privacy. Switches that decide who sees what save straight to the server, never through the draft's undo.
import type { ShareSettings } from "./link";
import type { RouterOutput } from "@/api/client";
import type { ResumeDocument } from "@/draft/types";
import type { useDocumentOperations } from "@/features/documents/queries";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { portfolioHoldsShortLink, publicResumeUrl } from "@rezumi/resume/sharing";
import { CustomDomain, ShareNotice } from "./custom-domain";
import { flushResume } from "./document";
import { client, orpc } from "@/api/client";
import { useResumeStore } from "@/draft";
import { resume as draftResume } from "@/draft/runtime";
import {
	Button,
	ConfirmDialog,
	FieldError,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	Sheet,
	Spinner,
	Switch,
	Text,
	TextField,
	haptics,
	showToast,
} from "@/ui";

type WebPageSettingsProps = {
	resume: ResumeDocument;
	offline: boolean;
	username: string | undefined;
	/** Where shared links point: the app's alias (`APP_ALIAS_URL`) when the server has one. */
	origin: string;
	flags: RouterOutput["flags"]["get"] | undefined;
	/** Share's one queue: actions run one at a time and report into its banner. */
	operations: ReturnType<typeof useDocumentOperations>;
	save: (settings: ShareSettings) => Promise<boolean>;
};

type PrimaryTextInput = {
	resume: Pick<ResumeDocument, "isPrimary" | "isPublic">;
	otherPrimary: string | undefined;
	portfolioHolds: boolean;
};

/** What the short link and custom domain open, as the server decides it: the live portfolio first, then the primary resume. */
function primaryText({ resume, otherPrimary, portfolioHolds }: PrimaryTextInput) {
	if (portfolioHolds)
		return resume.isPrimary
			? t`Your published portfolio opens at your short link and custom domain. This resume is shown there if the portfolio is unpublished.`
			: t`Your published portfolio opens at your short link and custom domain.`;
	if (resume.isPrimary)
		return resume.isPublic
			? t`Your short link and custom domain open this resume.`
			: t`Your short link and custom domain say this resume isn't shared until you publish it again.`;
	return otherPrimary
		? t`Your short link and custom domain open “${otherPrimary}”.`
		: t`Publish this resume to open it at your short link and custom domain.`;
}

export function WebPageSettings({ resume, offline, username, origin, flags, operations, save }: WebPageSettingsProps) {
	const { t } = useLingui();
	const updateData = useResumeStore((state) => state.update);
	const list = useQuery({ ...orpc.resume.list.queryOptions(), enabled: !offline });
	const portfolio = useQuery({ ...orpc.portfolio.status.queryOptions(), enabled: !offline });
	const portfolioHolds = portfolioHoldsShortLink(portfolio.data);
	const [dialog, setDialog] = useState<"primary" | "password" | "remove-password" | null>(null);
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const disabled = resume.isLocked || offline || operations.busy;
	const otherPrimary = list.data?.find((item) => item.isPrimary && item.id !== resume.id);
	const searchBlocked = !resume.isPublic || resume.hasPassword;
	const shortLink = username ? publicResumeUrl(origin, { username, slug: resume.slug, isPrimary: true }) : undefined;
	const passwordValid = password.length >= 6 && password.length <= 64 && password === confirmation;

	const preview = () =>
		operations.run(async () => {
			const url = await client.resume.previewUrl({ id: resume.id });
			await openBrowserAsync(url);
		});

	const closePassword = () => {
		setDialog(null);
		setPassword("");
		setConfirmation("");
	};
	// The password has endpoints of its own, but saves like the switches: after the draft's pending edits, then a reload.
	const savePassword = async (remove = false) => {
		if (!remove && !passwordValid) return;
		const success = await operations.run(async () => {
			await flushResume(resume.id);
			if (remove) await client.resume.removePassword({ id: resume.id });
			else await client.resume.setPassword({ id: resume.id, password });
			await draftResume.refresh();
		});
		if (success) closePassword();
	};

	return (
		<View className="gap-4">
			<Button variant="secondary" isDisabled={offline || operations.busy} onPress={() => void preview()}>
				<Icon name="eye" size={16} />
				<Button.Label>{t`Preview web page`}</Button.Label>
			</Button>

			<ListSection title={t`Short link and domain`}>
				<ListRow
					title={t`Primary resume`}
					description={primaryText({ resume, otherPrimary: otherPrimary?.name, portfolioHolds })}
					trailing={
						<Switch
							isSelected={resume.isPrimary}
							isDisabled={disabled || (!resume.isPublic && !resume.isPrimary)}
							accessibilityLabel={t`Primary resume`}
							onSelectedChange={(value) =>
								value && otherPrimary ? setDialog("primary") : void save({ isPrimary: value })
							}
						/>
					}
				/>
				{shortLink ? (
					<ListRow
						title={shortLink.replace(/^https?:\/\//, "")}
						description={portfolioHolds ? t`Short link · opens your portfolio` : t`Short link`}
						icon="link-simple-horizontal"
						trailing={<Icon name="copy" size={16} tone="muted" />}
						accessibilityHint={t`Copies it`}
						isDisabled={offline}
						onPress={() =>
							void operations.run(async () => {
								await Clipboard.setStringAsync(shortLink);
								haptics.light();
								showToast({ title: t`Link copied` });
							})
						}
					/>
				) : null}
			</ListSection>
			{flags?.customDomains ? <CustomDomain offline={offline} /> : null}

			<ListSection
				title={t`Web page`}
				footer={t`Uses your resume's template and Design, and fits any screen. Change them in Design.`}
			>
				<ListRow
					title={t`Show “Made with Rezumi”`}
					trailing={
						<Switch
							isSelected={resume.data.metadata.web?.showCredit !== false}
							isDisabled={resume.isLocked}
							accessibilityLabel={t`Show “Made with Rezumi”`}
							onSelectedChange={(value) =>
								updateData((draft) => {
									draft.metadata.web = { ...draft.metadata.web, showCredit: value };
								})
							}
						/>
					}
				/>
			</ListSection>

			<ListSection title={t`Privacy`}>
				<ListRow
					title={t`Require a password`}
					description={
						resume.hasPassword
							? t`Visitors enter it before they see the resume. Share it only with people you trust.`
							: undefined
					}
					trailing={
						<Switch
							isSelected={resume.hasPassword}
							isDisabled={disabled}
							accessibilityLabel={t`Require a password`}
							onSelectedChange={(value) => {
								setPassword("");
								setConfirmation("");
								setDialog(value ? "password" : "remove-password");
							}}
						/>
					}
				/>
				<ListRow
					title={t`Hide contact details`}
					description={t`Your email, phone, location and other header details, and references' phone numbers, are left out of the web page, its PDF and search results.`}
					trailing={
						<Switch
							isSelected={resume.hideContactDetails}
							isDisabled={disabled}
							accessibilityLabel={t`Hide contact details`}
							onSelectedChange={(value) => void save({ hideContactDetails: value })}
						/>
					}
				/>
				<ListRow
					title={t`Show in search engines`}
					description={
						searchBlocked
							? resume.hasPassword
								? t`Not available while the resume needs a password.`
								: t`Publish the web page first.`
							: resume.showInSearchEngines
								? t`Search engines such as Google may list your web page. It can take weeks to appear, or to disappear after you turn this off.`
								: t`Off. Let recruiters find you on Google by turning this on.`
					}
					trailing={
						<Switch
							isSelected={resume.showInSearchEngines && !searchBlocked}
							isDisabled={disabled || searchBlocked}
							accessibilityLabel={t`Show in search engines`}
							onSelectedChange={(value) => void save({ showInSearchEngines: value })}
						/>
					}
				/>
				<ListRow
					title={t`Visitors can download the PDF`}
					trailing={
						<Switch
							isSelected={resume.showDownloadButtons}
							isDisabled={disabled}
							accessibilityLabel={t`Visitors can download the PDF`}
							onSelectedChange={(value) => void save({ showDownloadButtons: value })}
						/>
					}
				/>
			</ListSection>

			<ConfirmDialog
				isOpen={dialog === "primary"}
				onOpenChange={(open) => {
					if (!open) setDialog(null);
				}}
				title={t`Make this your primary resume?`}
				message={otherPrimary ? t`“${otherPrimary.name}” stops being your primary resume.` : undefined}
				confirmLabel={t`Make primary`}
				cancelLabel={t`Keep it as it is`}
				onConfirm={() => void save({ isPrimary: true })}
			/>
			<Sheet
				isOpen={dialog === "password"}
				onOpenChange={(open) => {
					if (!open) closePassword();
				}}
				title={t`Require a password`}
				closeLabel={t`Close`}
				canDismiss={!operations.busy}
				footer={
					<Button isDisabled={!passwordValid || disabled} onPress={() => void savePassword()}>
						{operations.busy ? <Spinner size="sm" /> : null}
						<Button.Label>{t`Set password`}</Button.Label>
					</Button>
				}
			>
				<View className="gap-3">
					<TextField isDisabled={operations.busy}>
						<Label>{t`Password`}</Label>
						<Input
							variant="secondary"
							accessibilityLabel={t`Password`}
							value={password}
							onChangeText={setPassword}
							secureTextEntry
							autoComplete="off"
							autoCorrect={false}
							autoCapitalize="none"
							maxLength={64}
						/>
						<Text size="xs" tone="muted">{t`Use 6–64 characters.`}</Text>
					</TextField>
					<TextField isDisabled={operations.busy} isInvalid={!!confirmation && confirmation !== password}>
						<Label>{t`Confirm password`}</Label>
						<Input
							variant="secondary"
							accessibilityLabel={t`Confirm password`}
							value={confirmation}
							onChangeText={setConfirmation}
							secureTextEntry
							autoComplete="off"
							autoCorrect={false}
							autoCapitalize="none"
							maxLength={64}
						/>
						<FieldError>{t`Passwords do not match.`}</FieldError>
					</TextField>
					{operations.error ? <ShareNotice status="danger">{operations.error}</ShareNotice> : null}
				</View>
			</Sheet>
			<ConfirmDialog
				isOpen={dialog === "remove-password"}
				onOpenChange={(open) => {
					if (!open) setDialog(null);
				}}
				title={t`Remove the password?`}
				message={t`Anyone with the link will be able to view your resume.`}
				confirmLabel={t`Remove password`}
				cancelLabel={t`Keep the password`}
				onConfirm={() => void savePassword(true)}
			/>
		</View>
	);
}
