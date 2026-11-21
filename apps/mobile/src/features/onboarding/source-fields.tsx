import type { SourcesStatus } from "./queries";
// "Bring what you have": a LinkedIn link, a resume file, a GitHub username and a personal website, any of them or none.
// The web's SourceFields on a phone: the file comes from the system document picker instead of a drop zone.
import type { PickedFile } from "./read-file";
import type { IconName } from "@/ui";
import type { SourceAvailability, SourceId, SourceInputProblem, SourceInputs } from "@rezumi/resume/profile-sources";
import { useLingui } from "@lingui/react/macro";
import { getDocumentAsync } from "expo-document-picker";
import { View } from "react-native";
import { inputProblemMessage } from "./messages";
import { initialsOf, photoUrl } from "./photo-url";
import { useSession } from "@/auth/session";
import {
	Avatar,
	Button,
	Checkbox,
	ControlField,
	Description,
	FieldError,
	Icon,
	IconButton,
	InputGroup,
	Label,
	Text,
	TextField,
	Typography,
} from "@/ui";

const FILE_TYPES = [
	"application/pdf",
	"application/json",
	"application/zip",
	"application/x-zip-compressed",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type SourceFieldsProps = {
	inputs: SourceInputs<PickedFile>;
	onChange: (patch: Partial<SourceInputs<PickedFile>>) => void;
	availability: SourceAvailability;
	problems: Partial<Record<SourceId, SourceInputProblem>>;
	/** The username of the account's GitHub sign-in, which the GitHub field starts with. */
	accountGithub: string | null;
	/** A file read before the app closed, shown until it's removed or replaced. */
	restoredFile: boolean;
	onRemoveRestoredFile: () => void;
};

export function SourceFields(props: SourceFieldsProps) {
	const { inputs, onChange, availability, problems, accountGithub } = props;
	const { t } = useLingui();
	const githubFromAccount = Boolean(accountGithub) && inputs.github.trim() === accountGithub;

	return (
		<View className="gap-6">
			{availability.linkedin ? (
				<View className="gap-3">
					<SourceTextField
						icon="linkedin-logo"
						label={t`LinkedIn profile link`}
						placeholder="linkedin.com/in/your-name"
						value={inputs.linkedin}
						onChange={(linkedin) => onChange({ linkedin })}
						error={problems.linkedin === "invalid" ? inputProblemMessage("linkedin", "invalid") : undefined}
						keyboard="url"
						testID="source-linkedin"
					/>
					{inputs.linkedin.trim() ? (
						<ControlField
							isSelected={inputs.linkedinOwn}
							onSelectedChange={(linkedinOwn) => onChange({ linkedinOwn })}
							isInvalid={problems.linkedin === "unconfirmed"}
							testID="source-linkedin-own"
						>
							<ControlField.Indicator>
								<Checkbox />
							</ControlField.Indicator>
							<View className="flex-1">
								<Label>{t`This is my own profile`}</Label>
								{problems.linkedin === "unconfirmed" ? (
									<FieldError>{inputProblemMessage("linkedin", "unconfirmed")}</FieldError>
								) : null}
							</View>
						</ControlField>
					) : null}
				</View>
			) : null}

			<FileField
				file={inputs.file}
				restored={props.restoredFile}
				onChange={(file) => onChange({ file })}
				onRemoveRestored={props.onRemoveRestoredFile}
			/>

			{availability.github ? (
				<SourceTextField
					icon="github-logo"
					label={t`GitHub username`}
					placeholder="octocat"
					value={inputs.github}
					onChange={(github) => onChange({ github })}
					error={problems.github ? inputProblemMessage("github", problems.github) : undefined}
					description={githubFromAccount ? t`From your GitHub sign-in.` : t`Adds your own public projects.`}
					testID="source-github"
				/>
			) : null}

			{availability.website ? (
				<SourceTextField
					icon="globe"
					label={t`Personal website`}
					placeholder="yourname.com"
					value={inputs.website}
					onChange={(website) => onChange({ website })}
					error={problems.website ? inputProblemMessage("website", problems.website) : undefined}
					description={t`Read with AI. Only what's on the page comes in.`}
					keyboard="url"
					testID="source-website"
				/>
			) : null}
		</View>
	);
}

type SourceTextFieldProps = {
	icon: IconName;
	label: string;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	error: string | undefined;
	description?: string | undefined;
	keyboard?: "url" | undefined;
	testID: string;
};

function SourceTextField(props: SourceTextFieldProps) {
	const { icon, label, placeholder, value, onChange, error, description, keyboard, testID } = props;
	return (
		<TextField isInvalid={error !== undefined}>
			<Label>{label}</Label>
			<InputGroup>
				<InputGroup.Prefix isDecorative>
					<Icon name={icon} size={18} tone="muted" />
				</InputGroup.Prefix>
				<InputGroup.Input
					value={value}
					onChangeText={onChange}
					placeholder={placeholder}
					accessibilityLabel={label}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="off"
					spellCheck={false}
					keyboardType={keyboard === "url" ? "url" : "default"}
					variant="secondary"
					testID={testID}
				/>
			</InputGroup>
			{description && !error ? <Description>{description}</Description> : null}
			<FieldError>{error}</FieldError>
		</TextField>
	);
}

/** "1.2 MB", "340 KB": Hermes can't format units, so the number and the unit are put together here. */
function fileSize(bytes: number, locale: string) {
	const number = (value: number, digits: number) =>
		new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
	return bytes >= 1_000_000 ? `${number(bytes / 1_000_000, 1)} MB` : `${number(Math.max(1, bytes / 1000), 0)} KB`;
}

type FileFieldProps = {
	file: PickedFile | null;
	restored: boolean;
	onChange: (file: PickedFile | null) => void;
	onRemoveRestored: () => void;
};

function FileField({ file, restored, onChange, onRemoveRestored }: FileFieldProps) {
	const { t, i18n } = useLingui();

	const pick = async () => {
		const result = await getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: FILE_TYPES });
		const picked = result.canceled ? null : result.assets[0];
		if (picked)
			onChange({
				name: picked.name,
				uri: picked.uri,
				...(picked.size !== undefined ? { size: picked.size } : {}),
				...(picked.mimeType ? { mimeType: picked.mimeType } : {}),
				...(picked.lastModified !== undefined ? { lastModified: picked.lastModified } : {}),
			});
	};

	const chosen = file
		? {
				name: file.name,
				meta: file.size ? fileSize(file.size, i18n.locale) : "",
				remove: () => onChange(null),
				pdf: file.name.toLowerCase().endsWith(".pdf"),
			}
		: restored
			? {
					name: t`Your resume file`,
					meta: t`Read before. Choose another to replace it.`,
					remove: onRemoveRestored,
					pdf: false,
				}
			: null;

	return (
		<View className="gap-1.5">
			<Text weight="medium">{t`Resume file`}</Text>
			{chosen ? (
				<View className="min-h-14 flex-row items-center gap-3 rounded-field bg-background py-2 ps-3 pe-1">
					<Icon name={chosen.pdf ? "file-pdf" : "file-text"} tone="muted" />
					<View className="min-w-0 flex-1">
						<Text weight="medium" numberOfLines={1}>
							{chosen.name}
						</Text>
						{chosen.meta ? (
							<Text size="xs" tone="muted" tabular numberOfLines={2}>
								{chosen.meta}
							</Text>
						) : null}
					</View>
					<IconButton icon="x" label={t`Remove ${chosen.name}`} variant="ghost" onPress={chosen.remove} />
				</View>
			) : (
				<View className="min-h-14 flex-row items-center gap-3 rounded-field border border-dashed border-border px-3 py-2">
					<Icon name="file-arrow-up" tone="muted" />
					<Text size="xs" tone="muted" className="flex-1">
						{t`PDF, Word, a LinkedIn export or a Rezumi file`}
					</Text>
					<Button size="sm" variant="secondary" onPress={() => void pick()} testID="source-file">
						<Button.Label>{t`Choose`}</Button.Label>
					</Button>
				</View>
			)}
		</View>
	);
}

type AccountSummaryProps = { account: SourcesStatus["account"] };

/** What the account already gives the Profile: the name, email and photo from signing up or signing in. */
export function AccountSummary({ account }: AccountSummaryProps) {
	const { t } = useLingui();
	const { server } = useSession();
	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-1.5">
				<Icon name="check-circle" size={16} tone="success" />
				<Text size="xs" weight="semibold" tone="muted">
					{t`From your account`}
				</Text>
			</View>
			<View className="flex-row items-center gap-3">
				<Avatar alt={account.name} size="lg">
					{account.image ? <Avatar.Image source={{ uri: photoUrl(server, account.image) }} /> : null}
					<Avatar.Fallback>{initialsOf(account.name)}</Avatar.Fallback>
				</Avatar>
				<View className="min-w-0 flex-1">
					<Text weight="semibold" numberOfLines={1}>
						{account.name}
					</Text>
					<Text size="xs" tone="muted" numberOfLines={1}>
						{account.email}
					</Text>
				</View>
			</View>
		</View>
	);
}

type SourcesNoteProps = { availability: SourceAvailability };

/** Who reads what, and when: only on the person's request, and nothing is saved before they check it. */
export function SourcesNote({ availability }: SourcesNoteProps) {
	const { t } = useLingui();
	return (
		<Typography type="body-xs" color="muted">
			{availability.linkedin
				? t`We only read what you add here, once you continue: LinkedIn profiles through treg or Apify, GitHub accounts through GitHub, websites with AI. Nothing goes into your Profile until you check it.`
				: availability.website
					? t`We only read what you add here, once you continue: GitHub accounts through GitHub, websites with AI. Nothing goes into your Profile until you check it.`
					: t`We only read what you add here, once you continue. Nothing goes into your Profile until you check it.`}
		</Typography>
	);
}
