import type { Portfolio } from "./queries";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PortfolioLoadState, PortfolioPage } from "./layout";
import { openPortfolioLink, setPublished, usePortfolio, usePortfolioAction, usePortfolioAddress } from "./queries";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { CustomDomain } from "@/features/share/custom-domain";
import { routes } from "@/routes";
import {
	Button,
	ConfirmDialog,
	EmptyState,
	Input,
	Label,
	ListRow,
	ListSection,
	PickerSheet,
	Screen,
	Switch,
	Text,
	TextField,
	Typography,
} from "@/ui";

export function PortfolioPublishScreen() {
	const { t } = useLingui();
	const online = useOnline();
	const query = usePortfolio();
	return (
		<PortfolioPage title={t`Publishing settings`}>
			{!query.data ? (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			) : query.data.portfolio ? (
				<PublishSettings key={query.data.portfolio.id} portfolio={query.data.portfolio} refresh={query.refetch} />
			) : (
				<Screen>
					<EmptyState kind="page" title={t`You don't have a portfolio yet.`} />
				</Screen>
			)}
		</PortfolioPage>
	);
}

type PublishSettingsProps = { portfolio: Portfolio; refresh: () => Promise<unknown> };

function PublishSettings({ portfolio, refresh }: PublishSettingsProps) {
	const { t } = useLingui();
	const online = useOnline();
	const router = useRouter();
	const { url, server, live } = usePortfolioAddress(portfolio);
	const action = usePortfolioAction();
	const [sourcePicker, setSourcePicker] = useState(false);
	const [editingPassword, setEditingPassword] = useState(false);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState<"delete" | "unpublish" | "password" | null>(null);
	const resumes = useQuery({ ...orpc.resume.list.queryOptions(), enabled: sourcePicker && online });
	const disabled = !online || action.isPending;
	const source =
		portfolio.sourceResume?.name ??
		(portfolio.data.useProfileSource === false
			? t`No source`
			: portfolio.sourceResumeId
				? t`Resume unavailable`
				: t`Your Profile`);

	const savePassword = () =>
		action.mutate(async () => {
			await client.portfolio.setPassword({ password });
			setPassword("");
			setEditingPassword(false);
		});
	const deletePortfolio = () =>
		action.mutate(async () => {
			await client.portfolio.delete();
			if (router.canGoBack()) router.back();
			else router.replace(routes.portfolio());
		});
	const vcard = portfolio.data.contact.saveContact;
	return (
		<Screen onRefresh={refresh}>
			<ListSection title={t`Public address`}>
				<ListRow
					title={url || t`Loading your public address…`}
					description={t`Your address follows your username or connected domain.`}
				/>
				<ListRow
					title={t`Publish portfolio`}
					description={
						portfolio.suspendedAt
							? t`This portfolio has been taken down.`
							: live
								? t`Visitors can open your page.`
								: t`Only you can preview this draft.`
					}
					trailing={
						<Switch
							testID="portfolio-publish-switch"
							accessibilityLabel={t`Publish portfolio`}
							isSelected={live}
							isDisabled={disabled || Boolean(portfolio.suspendedAt)}
							onSelectedChange={(value) => (value ? action.mutate(setPublished(true)) : setConfirm("unpublish"))}
						/>
					}
				/>
				<ListRow
					title={t`Show in search engines`}
					trailing={
						<Switch
							accessibilityLabel={t`Show in search engines`}
							isSelected={portfolio.showInSearchEngines}
							isDisabled={disabled}
							onSelectedChange={(value) =>
								action.mutate(async () => {
									await client.portfolio.updateSettings({ showInSearchEngines: value });
								})
							}
						/>
					}
				/>
			</ListSection>
			<ListSection title={t`Content source`}>
				<ListRow
					title={source}
					description={
						portfolio.sourceResume?.inTrash
							? t`This resume is in Trash. Choose another source.`
							: t`Choose where career and contact details come from.`
					}
					isDisabled={disabled}
					onPress={() => setSourcePicker(true)}
				/>
			</ListSection>
			<ListSection title={t`Contact`}>
				<ListRow
					title={t`Save contact button`}
					description={t`Let visitors download a contact card from your page.`}
					trailing={
						<Switch
							accessibilityLabel={t`Save contact button`}
							isSelected={vcard}
							isDisabled={disabled}
							onSelectedChange={(value) =>
								action.mutate(async () => {
									await client.portfolio.update({
										data: { ...portfolio.data, contact: { ...portfolio.data.contact, saveContact: value } },
										expectedUpdatedAt: portfolio.updatedAt,
									});
								})
							}
						/>
					}
				/>
			</ListSection>
			<ListSection title={t`Visitor password`}>
				<ListRow
					title={portfolio.hasPassword ? t`Change password` : t`Set password`}
					isDisabled={disabled}
					onPress={() => setEditingPassword(true)}
				/>
				{portfolio.hasPassword ? (
					<ListRow title={t`Remove password`} isDisabled={disabled} onPress={() => setConfirm("password")} />
				) : null}
			</ListSection>
			{editingPassword ? (
				<View className="gap-3">
					<TextField isDisabled={disabled}>
						<Label>{t`New visitor password`}</Label>
						<Input
							accessibilityLabel={t`New visitor password`}
							secureTextEntry
							autoCapitalize="none"
							autoCorrect={false}
							value={password}
							onChangeText={setPassword}
							maxLength={64}
						/>
						<Text tone="muted" size="xs">{t`Use 6 to 64 characters.`}</Text>
					</TextField>
					<View className="flex-row gap-2">
						<Button isDisabled={disabled || password.length < 6} onPress={savePassword}>{t`Save password`}</Button>
						<Button
							variant="tertiary"
							isDisabled={action.isPending}
							onPress={() => {
								setEditingPassword(false);
								setPassword("");
							}}
						>{t`Cancel`}</Button>
					</View>
				</View>
			) : null}
			<View className="gap-2">
				<Typography.Heading type="h6">{t`Custom domain`}</Typography.Heading>
				<CustomDomain offline={!online} readOnly />
				<Button
					variant="tertiary"
					className="self-start"
					isDisabled={!online}
					onPress={() => void openPortfolioLink(`${server}/dashboard/portfolio`)}
				>{t`Manage domain on the web`}</Button>
			</View>
			<Button
				variant="danger-soft"
				className="self-start"
				isDisabled={disabled || Boolean(portfolio.suspendedAt)}
				onPress={() => setConfirm("delete")}
			>{t`Delete portfolio`}</Button>
			<PickerSheet
				isOpen={sourcePicker}
				onOpenChange={setSourcePicker}
				title={t`Choose a source`}
				closeLabel={t`Close`}
				searchLabel={t`Find a source`}
				emptyLabel={() => t`No matching sources.`}
				options={[
					{ value: "profile", label: t`Your Profile` },
					...(resumes.data ?? []).map((resume) => ({ value: resume.id, label: resume.name })),
				]}
				value={portfolio.sourceResumeId ?? (portfolio.data.useProfileSource === false ? null : "profile")}
				onPick={(id) =>
					action.mutate(async () => {
						await client.portfolio.updateSettings({ sourceResumeId: id === "profile" ? null : id });
					})
				}
			/>
			<ConfirmDialog
				isOpen={confirm !== null}
				onOpenChange={(open) => {
					if (!open) setConfirm(null);
				}}
				title={
					confirm === "delete"
						? t`Delete your portfolio?`
						: confirm === "password"
							? t`Remove visitor password?`
							: t`Unpublish your portfolio?`
				}
				message={
					confirm === "delete"
						? t`Your page, uploads and messages will be permanently deleted.`
						: confirm === "password"
							? t`Anyone with the link can open your published portfolio.`
							: t`Visitors will lose access. You can publish it again later.`
				}
				confirmLabel={
					confirm === "delete" ? t`Delete portfolio` : confirm === "password" ? t`Remove password` : t`Unpublish`
				}
				cancelLabel={t`Cancel`}
				destructive={confirm === "delete"}
				onConfirm={() => {
					if (disabled) return;
					if (confirm === "delete") deletePortfolio();
					if (confirm === "unpublish") action.mutate(setPublished(false));
					if (confirm === "password")
						action.mutate(async () => {
							await client.portfolio.removePassword({});
						});
				}}
			/>
		</Screen>
	);
}
