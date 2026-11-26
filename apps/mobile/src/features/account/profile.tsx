import type { RouterOutput } from "@/api/client";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { View } from "react-native";
import { getInitials } from "@rezumi/utils/string";
import { client, orpc, rest } from "@/api/client";
import { useSession } from "@/auth/session";
import { askPermission } from "@/shell/permissions";
import { useUnsavedChangesGuard } from "@/shell/unsaved-changes";
import { Avatar, Button, Description, FieldError, Input, Label, ListRow, Sheet, TextField, showToast } from "@/ui";

type Profile = RouterOutput["auth"]["getProfile"];
type ProfileFieldProps = { field: "name" | "username"; value: string; server: string };

function ProfileField({ field, value, server }: ProfileFieldProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [edit, setEdit] = useState<string | null>(null);
	const draft = edit ?? value;
	const [touched, setTouched] = useState(false);
	const trimmed = draft.trim();
	const invalid = field === "name" ? !trimmed || trimmed.length > 64 : !/^[a-z0-9._-]{3,64}$/.test(trimmed);
	const mutation = useMutation({
		mutationKey: ["settings", "profile", field],
		mutationFn: async () => {
			const result = await client.auth.updateProfile({ [field]: trimmed });
			if (!result.status) throw new Error("Profile update rejected");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: orpc.auth.getProfile.key() });
			setEdit(null);
		},
	});
	// An edit that can't be saved (invalid, or the save failed) asks before the screen closes; a valid one saves on blur.
	useUnsavedChangesGuard({ dirty: edit !== null && trimmed !== value && (invalid || mutation.isError) });
	const commit = () => {
		setTouched(true);
		if (!invalid && trimmed !== value && !mutation.isPending) mutation.mutate();
	};
	const error =
		touched && invalid
			? field === "name"
				? t`Enter a name, up to 64 characters.`
				: t`Use 3 to 64 lowercase letters, numbers, dots, hyphens and underscores.`
			: mutation.isError
				? "code" in mutation.error && mutation.error.code === "USERNAME_IS_ALREADY_TAKEN"
					? t`This username is already taken.`
					: t`Couldn't save. Try again.`
				: undefined;
	const label = field === "name" ? t`Name` : t`Username`;
	return (
		<TextField isInvalid={!!error}>
			<Label>{label}</Label>
			<Input
				variant="secondary"
				accessibilityLabel={label}
				value={draft}
				onChangeText={(next) => {
					setEdit(next);
					mutation.reset();
				}}
				onBlur={commit}
				submitBehavior="blurAndSubmit"
				editable={!mutation.isPending}
				autoCapitalize={field === "username" ? "none" : "words"}
				autoCorrect={field !== "username"}
				textContentType={field === "name" ? "name" : "username"}
				returnKeyType="done"
			/>
			{mutation.isPending ? <Description>{t`Saving…`}</Description> : null}
			{field === "username" && !mutation.isPending ? (
				<Description>{t`Your public links begin with ${server}/`}</Description>
			) : null}
			<FieldError>{error}</FieldError>
		</TextField>
	);
}

type ProfileEditorProps = { profile: Profile };
export function ProfileEditor({ profile }: ProfileEditorProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const queryClient = useQueryClient();
	const [choosePhoto, setChoosePhoto] = useState(false);
	const photoAction = useRef<"library" | "camera" | "remove" | null>(null);
	const pick = (source: NonNullable<typeof photoAction.current>) => {
		photoAction.current = source;
		setChoosePhoto(false);
	};
	const photo = useMutation({
		mutationKey: ["settings", "photo"],
		mutationFn: async (source: "library" | "camera" | "remove") => {
			let image: string | null = null;
			if (source !== "remove") {
				if (
					source === "camera" &&
					!(await askPermission("camera", {
						get: () => ImagePicker.getCameraPermissionsAsync(),
						request: () => ImagePicker.requestCameraPermissionsAsync(),
					}))
				)
					return;
				const options: ImagePicker.ImagePickerOptions = {
					mediaTypes: ["images"],
					allowsEditing: true,
					aspect: [1, 1],
					quality: 0.9,
				};
				const result =
					source === "camera"
						? await ImagePicker.launchCameraAsync(options)
						: await ImagePicker.launchImageLibraryAsync(options);
				if (result.canceled) return;
				const asset = result.assets[0];
				if (!asset) throw new Error(t`Couldn't upload the photo.`);
				const file = new File(asset.uri);
				if (file.size > 10 * 1024 * 1024) throw new Error(t`Choose a photo smaller than 10 MB.`);
				const form = new FormData();
				form.append("file", file);
				const response = await rest("/files", { method: "POST", body: form });
				if (!response.ok) throw new Error(t`Couldn't upload the photo.`);
				const uploaded: unknown = await response.json();
				if (!uploaded || typeof uploaded !== "object" || !("url" in uploaded) || typeof uploaded.url !== "string") {
					throw new Error(t`Couldn't upload the photo.`);
				}
				const url = new URL(uploaded.url);
				if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(t`Couldn't upload the photo.`);
				image = url.href;
			}
			const result = await client.auth.updateProfile({ image });
			if (!result.status) throw new Error(t`Couldn't save. Try again.`);
		},
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: orpc.auth.getProfile.key() }),
		onError: () =>
			showToast({
				title: t`Couldn't update the photo. Check camera permissions, choose a photo smaller than 10 MB, and try again.`,
			}),
	});
	return (
		<>
			<View className="gap-3 p-4">
				<View className="items-center gap-2">
					<Avatar alt={profile.name} size="lg">
						{profile.image ? <Avatar.Image source={{ uri: profile.image }} /> : null}
						<Avatar.Fallback>{getInitials(profile.name)}</Avatar.Fallback>
					</Avatar>
					<Button variant="ghost" isDisabled={photo.isPending} onPress={() => setChoosePhoto(true)}>
						<Button.Label>{photo.isPending ? t`Uploading photo…` : t`Change photo`}</Button.Label>
					</Button>
				</View>
				<ProfileField field="name" value={profile.name} server={server} />
				<ProfileField field="username" value={profile.username} server={server} />
			</View>
			<Sheet
				isOpen={choosePhoto}
				onOpenChange={setChoosePhoto}
				title={t`Profile photo`}
				closeLabel={t`Close`}
				onDidDismiss={() => {
					const source = photoAction.current;
					photoAction.current = null;
					if (source) photo.mutate(source);
				}}
			>
				<ListRow title={t`Take photo`} icon="camera" chevron={false} onPress={() => pick("camera")} />
				<ListRow title={t`Choose from library`} icon="image" chevron={false} onPress={() => pick("library")} />
				{profile.image ? (
					<ListRow title={t`Remove photo`} icon="trash" tone="danger" onPress={() => pick("remove")} />
				) : null}
			</Sheet>
		</>
	);
}
