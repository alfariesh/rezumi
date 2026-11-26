import type { PortfolioImageKind } from "@rezumi/portfolio/editing";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ViewProps } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { PORTFOLIO_IMAGE_KEY_PATTERN } from "@rezumi/schema/portfolio/files";
import { MediaError, pickPictures, uploadPicture } from "./media";
import { useEditor } from "./store";
import { useOnline } from "@/api/online";
import { getCredentials } from "@/auth/session";
import { Button, ListGroup, ListRow, Sheet, Text, showToast } from "@/ui";

type PicturesProps = {
	label: string;
	onPictures: (pictures: PortfolioImage[], names: string[]) => void;
	kind?: PortfolioImageKind;
	limit?: number;
	busy?: boolean;
	inline?: boolean;
};

export function AddPictures({ label, onPictures, kind = "photo", limit = 1, busy, inline }: PicturesProps) {
	const { t } = useLingui();
	const online = useOnline();
	const { scope } = useEditor();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const source = useRef<boolean | undefined>(undefined);
	const choose = async (camera: boolean) => {
		setPending(true);
		try {
			const picked = await pickPictures(camera, limit);
			const pictures: PortfolioImage[] = [];
			const names: string[] = [];
			for (const picture of picked) {
				try {
					pictures.push(
						await uploadPicture(
							{
								uri: picture.uri,
								width: picture.width,
								height: picture.height,
								fileName: picture.fileName ?? null,
								...(picture.mimeType ? { mimeType: picture.mimeType } : {}),
							},
							kind,
							scope,
						),
					);
					names.push(picture.fileName ?? "");
				} catch (error) {
					showToast({
						title: error instanceof MediaError ? error.message : t`Couldn't upload this picture.`,
						variant: "danger",
					});
				}
			}
			if (pictures.length) onPictures(pictures, names);
		} catch (error) {
			showToast({
				title: error instanceof MediaError ? error.message : t`Couldn't open the picture picker.`,
				variant: "danger",
			});
		} finally {
			setPending(false);
		}
	};
	if (inline)
		return (
			<ListGroup>
				<ListRow
					title={t`Take a picture`}
					icon="camera"
					isDisabled={!online || pending}
					onPress={() => void choose(true)}
				/>
				<ListRow
					title={t`Choose from photo library`}
					icon="image"
					isDisabled={!online || pending}
					onPress={() => void choose(false)}
				/>
				{pending ? <Text tone="muted">{t`Uploading pictures…`}</Text> : null}
			</ListGroup>
		);

	return (
		<>
			<Button variant="secondary" isDisabled={!online || pending || busy === true} onPress={() => setOpen(true)}>
				{pending ? t`Uploading pictures…` : label}
			</Button>
			<Sheet
				isOpen={open}
				onOpenChange={setOpen}
				title={label}
				closeLabel={t`Close`}
				onDidDismiss={() => {
					const camera = source.current;
					source.current = undefined;
					if (camera !== undefined) void choose(camera);
				}}
			>
				<ListGroup>
					<ListRow
						title={t`Take a picture`}
						icon="camera"
						onPress={() => {
							source.current = true;
							setOpen(false);
						}}
					/>
					<ListRow
						title={t`Choose from photo library`}
						icon="image"
						onPress={() => {
							source.current = false;
							setOpen(false);
						}}
					/>
				</ListGroup>
			</Sheet>
		</>
	);
}

type PicturePreviewProps = {
	picture: PortfolioImage & { focus?: { x: number; y: number } | undefined };
	cover?: boolean;
	onFocus?: (point: { x: number; y: number }) => void;
};

export function PicturePreview({ picture, cover, onFocus }: PicturePreviewProps) {
	const { t } = useLingui();
	const { scope } = useEditor();
	const size = useRef({ width: 1, height: 1 });
	const key = picture.thumbKey ?? picture.key;
	const credentials = useQuery({
		queryKey: ["portfolio-picture-credentials", scope],
		queryFn: getCredentials,
		gcTime: 0,
		staleTime: 30_000,
	});
	const current = credentials.data;
	if (!current?.accessToken || current.scope !== scope || !PORTFOLIO_IMAGE_KEY_PATTERN.test(key)) return null;
	const image = (
		<Image
			source={{ uri: `${current.server}/api/${key}`, headers: { authorization: `Bearer ${current.accessToken}` } }}
			cachePolicy="none"
			accessibilityLabel={picture.alt || t`Portfolio picture`}
			contentFit={cover ? "cover" : "contain"}
			{...(cover && picture.focus
				? { contentPosition: { left: `${picture.focus.x * 100}%`, top: `${picture.focus.y * 100}%` } }
				: {})}
			className="aspect-video w-full rounded-lg bg-surface-secondary"
		/>
	);
	const layout: ViewProps["onLayout"] = ({ nativeEvent }) => {
		size.current = nativeEvent.layout;
	};
	return onFocus ? (
		<View className="gap-2">
			<Pressable
				onLayout={layout}
				accessible={false}
				onPress={({ nativeEvent }) => {
					const { width, height } = size.current;
					const scale = Math.min(width / (picture.width ?? width), height / (picture.height ?? height));
					const shownWidth = (picture.width ?? width) * scale;
					const shownHeight = (picture.height ?? height) * scale;
					onFocus({
						x: Math.min(1, Math.max(0, (nativeEvent.locationX - (width - shownWidth) / 2) / shownWidth)),
						y: Math.min(1, Math.max(0, (nativeEvent.locationY - (height - shownHeight) / 2) / shownHeight)),
					});
				}}
			>
				{image}
			</Pressable>
			<Text tone="muted">{t`Tap the cover to set its focus point.`}</Text>
			<Button size="sm" variant="secondary" onPress={() => onFocus({ x: 0.5, y: 0.5 })}>{t`Center the cover`}</Button>
		</View>
	) : (
		image
	);
}
