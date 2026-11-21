// Share's public link (plans/mobile Phase 08): publishing, the address with its availability check, copy, share, the
// web page and its QR code, then the web page settings and the visitor numbers.
import type { ResumeDocument } from "@/draft/types";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Linking, Share, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Rect } from "react-native-svg";
import {
	formatTimeSince,
	normalizeSlug,
	publicResumeUrl,
	isValidSlug,
	MAX_SLUG_LENGTH,
	summarizeViews,
} from "@rezumi/resume/sharing";
import { ShareNotice } from "./custom-domain";
import { flushResume } from "./document";
import { WebPageSettings } from "./web-page";
import { client, orpc } from "@/api/client";
import { useFlags } from "@/api/flags";
import { getServer } from "@/auth/session";
import { useResumeStore } from "@/draft";
import { resume as draftResume } from "@/draft/runtime";
import { useDocumentOperations } from "@/features/documents/queries";
import {
	Button,
	Card,
	FieldError,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	Sheet,
	Skeleton,
	Switch,
	Text,
	TextField,
	Typography,
	haptics,
	showToast,
	size,
	space,
	useThemeColor,
} from "@/ui";

/** Sharing settings: saved beside the resume, not in its data. */
export type ShareSettings = Partial<
	Pick<
		ResumeDocument,
		"isPublic" | "slug" | "showDownloadButtons" | "showInSearchEngines" | "hideContactDetails" | "isPrimary"
	>
>;

type LinkProps = { resume: ResumeDocument; offline: boolean };

export function LinkTab({ resume, offline }: LinkProps) {
	const { t } = useLingui();
	const operations = useDocumentOperations();
	const [slug, setSlug] = useState(resume.slug);
	const savedSlug = useRef(resume.slug);
	const [slugState, setSlugState] = useState<"idle" | "checking" | "saving" | "taken" | "error">("idle");
	const [suggestion, setSuggestion] = useState<string>();
	const [takenBy, setTakenBy] = useState<string>();
	const [retry, setRetry] = useState(0);
	const [qrOpen, setQrOpen] = useState(false);
	const profile = useQuery({ ...orpc.auth.getProfile.queryOptions(), enabled: !offline });
	const username = profile.data?.username;
	// Shared links use the app's alias (`APP_ALIAS_URL`) when the server has one; every public page works there too.
	const flags = useFlags();
	const origin = flags.data?.aliasUrl ?? getServer();
	const url = username ? publicResumeUrl(origin, { username, slug: resume.slug }) : "";
	const changed = slug !== resume.slug;
	const saveStatus = useResumeStore((state) => state.status);
	const shareable =
		!!url && resume.isPublic && !changed && !offline && !operations.busy && ["saved", "idle"].includes(saveStatus);
	const disabled = resume.isLocked || offline || operations.busy;

	useEffect(() => {
		const previous = savedSlug.current;
		savedSlug.current = resume.slug;
		setSlug((value) => (value === previous ? resume.slug : value));
	}, [resume.slug]);

	// Every sharing setting saves one way, like web: straight to the server and never through the draft's undo, after
	// the draft's pending edits so the version check holds; then the draft reloads the server copy.
	const save = (settings: ShareSettings, cancelled = () => false) =>
		operations.run(async () => {
			const current = await flushResume(resume.id);
			if (cancelled()) return;
			await client.resume.update({ id: resume.id, ...settings, expectedUpdatedAt: current.updatedAt });
			await draftResume.refresh();
		});
	const saveCheckedSlug = useEffectEvent((value: string, cancelled: () => boolean) => save({ slug: value }, cancelled));

	useEffect(() => {
		if (!changed || !isValidSlug(slug) || !resume.isPublic || resume.isLocked || offline) return;
		let cancelled = false;
		const timer = setTimeout(() => {
			setSlugState("checking");
			setSuggestion(undefined);
			setTakenBy(undefined);
			void (async () => {
				try {
					const result = await client.resume.checkSlug({ resumeId: resume.id, slug });
					if (cancelled) return;
					if (result.status === "taken") {
						setSuggestion(result.suggestion);
						setTakenBy(result.takenBy);
						setSlugState("taken");
						return;
					}
					setSlugState("saving");
					const success = await saveCheckedSlug(slug, () => cancelled);
					setSlugState(success ? "idle" : "error");
				} catch {
					if (!cancelled) setSlugState("error");
				}
			})();
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [slug, changed, resume.id, resume.isPublic, resume.isLocked, offline, retry]);

	const addressError =
		changed && !slug
			? t`Add an address.`
			: changed && slug.length > MAX_SLUG_LENGTH
				? t`Use at most 64 characters.`
				: changed && !isValidSlug(slug)
					? t`Use lowercase letters, numbers and single dashes.`
					: slugState === "taken"
						? takenBy
							? t`You already use this for “${takenBy}”.`
							: t`Another of your resumes uses this address.`
						: slugState === "error"
							? t`Couldn't check or save this address. Try again.`
							: undefined;
	const addressHelp = !resume.isPublic
		? t`Turn on the link to choose an address.`
		: changed
			? t`Checking… Copy is available after saving.`
			: url
				? t`Live at ${url}`
				: t`Loading your public address…`;

	return (
		<View className="gap-4">
			{operations.error ? <ShareNotice status="danger">{operations.error}</ShareNotice> : null}
			<ListSection title={t`Public link`}>
				<ListRow
					title={t`Public link`}
					description={
						resume.isPublic ? t`On. Anyone with the link can see your web page.` : t`Off. Only you can see this resume.`
					}
					trailing={
						<Switch
							isSelected={resume.isPublic}
							isDisabled={disabled}
							accessibilityLabel={t`Public link`}
							onSelectedChange={(value) => void save({ isPublic: value })}
						/>
					}
				/>
			</ListSection>
			<TextField
				isDisabled={!resume.isPublic || disabled || slugState === "saving"}
				isInvalid={resume.isPublic && !!addressError}
			>
				<Label>{t`Address`}</Label>
				<Input
					accessibilityLabel={t`Address`}
					value={slug}
					onChangeText={(value) => setSlug(normalizeSlug(value))}
					autoCapitalize="none"
					autoCorrect={false}
					className="font-mono"
				/>
				{resume.isPublic && addressError ? (
					<FieldError>{addressError}</FieldError>
				) : (
					<Text size="xs" tone="muted" selectable>
						{addressHelp}
					</Text>
				)}
			</TextField>
			{suggestion && slugState === "taken" ? (
				<Button
					variant="ghost"
					size="sm"
					className="self-start"
					isDisabled={disabled}
					onPress={() => setSlug(suggestion)}
				>
					<Button.Label>{t`Try ${suggestion}`}</Button.Label>
				</Button>
			) : null}
			{slugState === "error" ? (
				<Button variant="secondary" size="sm" className="self-start" onPress={() => setRetry((value) => value + 1)}>
					<Button.Label>{t`Retry`}</Button.Label>
				</Button>
			) : null}
			{profile.isError ? (
				<View className="gap-2">
					<ShareNotice status="danger">{t`Couldn't load your public address.`}</ShareNotice>
					<Button variant="secondary" size="sm" className="self-start" onPress={() => void profile.refetch()}>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : null}
			<View className="flex-row flex-wrap gap-2">
				<Button
					variant="secondary"
					isDisabled={!shareable}
					onPress={() =>
						void operations.run(async () => {
							await Clipboard.setStringAsync(url);
							haptics.light();
							showToast({ title: t`Link copied` });
						})
					}
				>
					<Icon name="copy" size={16} />
					<Button.Label>{t`Copy`}</Button.Label>
				</Button>
				<Button
					variant="secondary"
					isDisabled={!shareable}
					onPress={() => void operations.run(() => Share.share({ title: resume.name, message: url, url }))}
				>
					<Icon name="export" size={16} />
					<Button.Label>{t`Share via…`}</Button.Label>
				</Button>
			</View>
			{resume.isPublic ? (
				<ListSection>
					<ListRow
						title={t`Open web page`}
						icon="arrow-square-out"
						isDisabled={!shareable}
						onPress={() => void operations.run(() => Linking.openURL(url))}
					/>
					<ListRow title={t`QR code`} icon="qr-code" isDisabled={!shareable} onPress={() => setQrOpen(true)} />
				</ListSection>
			) : null}
			<WebPageSettings
				resume={resume}
				offline={offline}
				username={username}
				origin={origin}
				flags={flags.data}
				operations={operations}
				save={save}
			/>
			<Statistics id={resume.id} isPublic={resume.isPublic} offline={offline} />
			<Sheet isOpen={qrOpen} onOpenChange={setQrOpen} title={t`QR code`} closeLabel={t`Close`}>
				<View accessible accessibilityLabel={t`QR code for ${url}`} className="items-center gap-3 pb-4">
					{/* A printed code is dark on white in both themes, so it stays on paper. */}
					<View className="rounded-xl bg-paper p-3">
						{url ? <QRCode value={url} size={size.hit * 4} quietZone={space[2]} /> : null}
					</View>
					<Text mono selectable>
						{url}
					</Text>
				</View>
			</Sheet>
		</View>
	);
}

type StatisticsProps = { id: string; isPublic: boolean; offline: boolean };

function Statistics({ id, isPublic, offline }: StatisticsProps) {
	const { t, i18n } = useLingui();
	const accent = useThemeColor("accent");
	const daily = useQuery({
		...orpc.resume.statistics.getDailyById.queryOptions({ input: { id, days: 30 } }),
		enabled: isPublic && !offline,
	});
	const total = useQuery({
		...orpc.resume.statistics.getById.queryOptions({ input: { id } }),
		enabled: isPublic && !offline,
	});
	const summary = summarizeViews(daily.data ?? []);
	const bars = Math.max(1, summary.bars.length);
	const numbers = [
		{ value: i18n.number(summary.views), label: t`views · 30 days` },
		{ value: i18n.number(summary.downloads), label: t`downloads` },
		{
			value: total.data?.lastViewedAt ? formatTimeSince(total.data.lastViewedAt, i18n.locale) : "—",
			label: t`since last view`,
		},
	];

	return (
		<Card className="gap-3">
			<View className="flex-row items-center gap-2">
				<Icon name="chart-line-up" size={20} tone="muted" />
				<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
					{t`Visitors`}
				</Typography.Heading>
				<Text size="xs" tone="muted">{t`Only you see these`}</Text>
			</View>
			{!isPublic ? (
				<Typography type="body-sm" className="text-muted">
					{t`Publish the web page to count views and downloads. Counts are anonymous, and search engines aren't counted.`}
				</Typography>
			) : offline && !daily.data ? (
				<Typography type="body-sm" className="text-muted">{t`Statistics need a connection.`}</Typography>
			) : daily.isError || total.isError ? (
				<View className="gap-2">
					<ShareNotice status="danger">{t`Couldn't load statistics.`}</ShareNotice>
					<Button
						variant="secondary"
						size="sm"
						className="self-start"
						onPress={() => {
							void daily.refetch();
							void total.refetch();
						}}
					>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : daily.isPending || total.isPending ? (
				<View className="gap-3" accessibilityLabel={t`Loading`}>
					<Skeleton variant="none" className="h-10 w-2/3 rounded-md" />
					<Skeleton variant="none" className="h-16 w-full rounded-md" />
				</View>
			) : (
				<>
					<View className="flex-row flex-wrap gap-5">
						{numbers.map((number) => (
							<View key={number.label}>
								<Text size="base" weight="semibold" tabular>
									{number.value}
								</Text>
								<Text size="xs" tone="muted">
									{number.label}
								</Text>
							</View>
						))}
					</View>
					<View
						accessible
						accessibilityRole="image"
						accessibilityLabel={t`Daily views over 30 days, peak ${summary.peak}`}
					>
						<Svg width="100%" height={size.hit * 1.5} viewBox="0 0 300 60" preserveAspectRatio="none">
							{summary.bars.map((bar, index) => (
								<Rect
									key={bar.date}
									x={(index * 300) / bars}
									y={60 - Math.max(3, bar.height * 60)}
									width={300 / bars - 2}
									height={Math.max(3, bar.height * 60)}
									rx={1.5}
									fill={accent}
									opacity={bar.views > 0 ? 1 : 0.25}
								/>
							))}
						</Svg>
					</View>
					<View className="flex-row justify-between">
						<Text size="xs" tone="muted">
							{daily.data?.[0]?.date}
						</Text>
						<Text size="xs" tone="muted">{t`Today`}</Text>
					</View>
				</>
			)}
			<Text size="xs" tone="muted">{t`Download totals can include repeat clicks.`}</Text>
		</Card>
	);
}
