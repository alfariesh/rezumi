// The photo: taken with the camera or chosen from the library, cropped square, uploaded, then written to the source.
// The previous photo stays until an upload succeeds. How the photo looks on a page is the CV builder's business.
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { View } from "react-native";
import { useWriteData, useWriteSource } from "./source";
import { client, rest } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { initialsOf, photoUrl } from "@/features/onboarding/photo-url";
import { askPermission } from "@/shell/permissions";
import { Avatar, Button, ListRow, ListSection, Sheet, Text, showToast } from "@/ui";

const MAX_UPLOAD = 10 * 1024 * 1024;

class PhotoTooLarge extends Error {}

/** Uploaded pictures are server-relative (`/uploads/…`) and load through the server's `/api`, as on the web. */
export function resolvePictureUrl(url: string, server: string): string {
	if (!url) return "";
	try {
		const parsed = new URL(photoUrl(server, url));
		if (parsed.origin === new URL(server).origin && parsed.pathname.startsWith("/uploads/"))
			return `${parsed.origin}/api${parsed.pathname}${parsed.search}`;
		return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
	} catch {
		return "";
	}
}

type PhotoFieldProps = { disabled?: boolean | undefined };

export function PhotoField({ disabled = false }: PhotoFieldProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const { update } = useWriteSource();
	const url = useWriteData((data) => data.picture.url, "");
	const name = useWriteData((data) => data.basics.name, "");
	const [choosing, setChoosing] = useState(false);
	const shown = resolvePictureUrl(url, server);

	const setUrl = (next: string) =>
		update(
			(draft) => {
				draft.picture.url = next;
			},
			{ newStep: true },
		);

	const upload = useMutation({
		mutationKey: ["entries", "photo"],
		mutationFn: async (source: "library" | "camera") => {
			const startedOn = getServer();
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
			if (!asset) throw new Error("No image");
			const file = new File(asset.uri);
			if (file.size > MAX_UPLOAD) throw new PhotoTooLarge();
			const form = new FormData();
			form.append("file", file);
			const response = await rest("/files", { method: "POST", body: form });
			if (!response.ok) throw new Error("Upload failed");
			const uploaded: unknown = await response.json();
			if (!uploaded || typeof uploaded !== "object" || !("url" in uploaded) || typeof uploaded.url !== "string")
				throw new Error("Upload failed");
			if (!resolvePictureUrl(uploaded.url, server)) throw new Error("Upload failed");
			// Switching account while it uploaded: the result belongs to nobody.
			if (getServer() !== startedOn) return;
			setUrl(uploaded.url);
		},
		onError: (error, source) =>
			showToast({
				title: error instanceof PhotoTooLarge ? t`Choose a photo smaller than 10 MB.` : t`Couldn't upload the photo.`,
				variant: "danger",
				undo: { label: t`Try again`, onUndo: () => upload.mutate(source) },
			}),
	});

	const remove = () => {
		setChoosing(false);
		if (!url) return;
		try {
			const parsed = new URL(photoUrl(server, url));
			const filename = parsed.pathname.split("/").pop();
			// Only files on this server are ours to delete.
			if (filename && parsed.origin === new URL(server).origin)
				void client.storage.deleteFile({ filename }).catch(() => undefined);
		} catch {
			// An unreadable address is just cleared.
		}
		setUrl("");
	};

	const pick = (source: "library" | "camera") => {
		setChoosing(false);
		upload.mutate(source);
	};

	return (
		<View className="flex-row items-center gap-4">
			<Avatar size="lg" alt={name || t`Photo`}>
				{shown ? <Avatar.Image source={{ uri: shown }} /> : null}
				<Avatar.Fallback>{initialsOf(name) || "?"}</Avatar.Fallback>
			</Avatar>
			<View className="flex-1 gap-1">
				<Text weight="medium">{t`Photo`}</Text>
				<Text size="xs" tone="muted">
					{shown
						? t`Each resume decides whether to show it.`
						: t`Optional. Some regions expect one; most ATS ignore it.`}
				</Text>
			</View>
			<Button
				variant="secondary"
				size="sm"
				isDisabled={disabled || upload.isPending}
				onPress={() => setChoosing(true)}
				testID="photo-change"
			>
				{upload.isPending ? t`Uploading…` : shown ? t`Change` : t`Add`}
			</Button>
			<Sheet isOpen={choosing} onOpenChange={setChoosing} title={t`Photo`} closeLabel={t`Close`} padded={false}>
				<ListSection>
					<ListRow title={t`Take photo`} icon="camera" chevron={false} onPress={() => pick("camera")} />
					<ListRow title={t`Choose from library`} icon="image" chevron={false} onPress={() => pick("library")} />
					{url ? <ListRow title={t`Remove photo`} icon="trash" tone="danger" onPress={remove} /> : null}
				</ListSection>
			</Sheet>
		</View>
	);
}
