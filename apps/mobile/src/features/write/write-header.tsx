// The top of Write: the locked note with Unlock, the import summary, and the Basics card that opens the details.
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { summarizeContent } from "@rezumi/resume/write";
import { useUnlock } from "./hooks";
import { useSession } from "@/auth/session";
import { resolvePictureUrl } from "@/features/entries/photo-field";
import { useWriteData } from "@/features/entries/source";
import { initialsOf } from "@/features/onboarding/photo-url";
import { Alert, Avatar, Button, Icon, IconButton, Text } from "@/ui";

/** Locked resumes read as they print; Unlock is one tap and reversible. */
export function LockedNote() {
	const { t } = useLingui();
	const unlock = useUnlock();
	return (
		<Alert status="accent">
			<Alert.Indicator>
				<Icon name="lock" tone="accent" />
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Title>{t`Locked. Unlock to edit.`}</Alert.Title>
			</Alert.Content>
			<Button
				size="sm"
				variant="secondary"
				isDisabled={unlock.isPending}
				onPress={() => unlock.mutate()}
				accessibilityLabel={t`Unlock editing`}
				testID="write-unlock"
			>
				{unlock.isPending ? t`Unlocking…` : t`Unlock`}
			</Button>
		</Alert>
	);
}

type ImportedNoteProps = { source: string; onDismiss: () => void };

/** After an import: what came in and how many fields still ask for a look; it keeps up as they're fixed. */
export function ImportedNote({ source, onDismiss }: ImportedNoteProps) {
	const { t } = useLingui();
	const summary = useWriteData((data) => {
		const { sections, entries, toCheck } = summarizeContent(data);
		return `${sections}/${entries}/${toCheck}`;
	}, "0/0/0");
	const [sections = 0, entries = 0, toCheck = 0] = summary.split("/").map(Number);
	const counts = `${plural(sections, { one: "# section", other: "# sections" })}, ${plural(entries, { one: "# entry", other: "# entries" })}.`;
	const next =
		toCheck > 0
			? plural(toCheck, { one: "# field needs a look.", other: "# fields need a look." })
			: t`Review each section before using this resume.`;
	return (
		<Alert status="success">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{`${t`Imported from ${source}.`} ${counts} ${next}`}</Alert.Description>
			</Alert.Content>
			<IconButton icon="x" size="sm" label={t`Dismiss`} onPress={onDismiss} />
		</Alert>
	);
}

type BasicsCardProps = { onOpen: () => void };

/** Basics: the photo or initials, the name and "headline · location"; opens the details full screen. */
export function BasicsCard({ onOpen }: BasicsCardProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const name = useWriteData((data) => data.basics.name, "");
	const line = useWriteData(
		(data) => [data.basics.headline, data.basics.location].filter((part) => part.trim()).join(" · "),
		"",
	);
	const picture = useWriteData((data) => data.picture.url, "");
	const photo = resolvePictureUrl(picture, server);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[t`Basics`, name, line].filter(Boolean).join(", ")}
			onPress={onOpen}
			className="flex-row items-center gap-3 rounded-2xl bg-surface p-3"
			testID="write-basics"
		>
			<Avatar size="md" alt={name || t`Photo`}>
				{photo ? <Avatar.Image source={{ uri: photo }} /> : null}
				<Avatar.Fallback>{initialsOf(name) || "?"}</Avatar.Fallback>
			</Avatar>
			<View className="flex-1 gap-0.5">
				<Text weight="medium">{t`Basics`}</Text>
				<Text size="xs" tone="muted" numberOfLines={1}>
					{[name || t`Your name`, line].filter(Boolean).join(" · ")}
				</Text>
			</View>
			<Icon name="caret-right" tone="muted" />
		</Pressable>
	);
}
