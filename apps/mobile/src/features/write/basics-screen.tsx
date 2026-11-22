// Basics, full screen (the web's About card): the photo row that opens the page photo settings, then the details
// form with a Profile marker beside each part that differs from the Profile.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { ProfileMarker } from "./profile-link";
import { useSession } from "@/auth/session";
import { BasicsForm } from "@/features/entries/basics-form";
import { EditorFrame } from "@/features/entries/entry-editor";
import { resolvePictureUrl } from "@/features/entries/photo-field";
import { useWriteData, useWriteSource } from "@/features/entries/source";
import { initialsOf } from "@/features/onboarding/photo-url";
import { routes } from "@/routes";
import { Alert, Avatar, Button, Card, Text } from "@/ui";

type BasicsScreenProps = { id: string; focusField?: string | undefined };

export function Basics({ id, focusField }: BasicsScreenProps) {
	const { t } = useLingui();
	const locked = useWriteSource().useLocked();
	return (
		<EditorFrame title={t`Basics`}>
			{locked ? (
				<Alert status="default">
					<Alert.Content>
						<Alert.Title>{t`Locked. Unlock to edit.`}</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			<PhotoRow id={id} locked={locked} />
			<Card>
				<Card.Body>
					<BasicsForm disabled={locked} focusField={focusField} marker={(part) => <ProfileMarker part={part} />} />
				</Card.Body>
			</Card>
		</EditorFrame>
	);
}

type PhotoRowProps = { id: string; locked: boolean };

function PhotoRow({ id, locked }: PhotoRowProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { server } = useSession();
	const url = useWriteData((data) => data.picture.url, "");
	const hidden = useWriteData((data) => data.picture.hidden, false);
	const name = useWriteData((data) => data.basics.name, "");
	const photo = resolvePictureUrl(url, server);
	return (
		<Card>
			<Card.Body className="flex-row items-center gap-3">
				<Avatar size="md" alt={name || t`Photo`}>
					{photo ? <Avatar.Image source={{ uri: photo }} /> : null}
					<Avatar.Fallback>{initialsOf(name) || "?"}</Avatar.Fallback>
				</Avatar>
				<Text size="xs" tone="muted" className="flex-1">
					{!url
						? t`No photo. Most ATS ignore photos; some regions expect one.`
						: hidden
							? t`Photo hidden from the page.`
							: t`Photo on the page.`}
				</Text>
				<View className="flex-row items-center">
					<ProfileMarker part={{ kind: "picture" }} />
					<Button
						size="sm"
						variant="secondary"
						isDisabled={locked}
						onPress={() => router.push(routes.entry(id, "basics", "picture"))}
						testID="basics-photo"
					>
						{url ? t`Edit` : t`Add`}
					</Button>
				</View>
			</Card.Body>
		</Card>
	);
}
