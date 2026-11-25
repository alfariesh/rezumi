import type { ChatAttachment } from "./chat";
import type { ScopedChatViewProps } from "./chat-view";
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { errorText } from "./errors";
import { FileChip } from "./messages";
import { client } from "@/api/client";
import { cx, Icon, IconButton, Text, showToast } from "@/ui";
import { ChatInput } from "@/ui/chat-input";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

type Upload = ChatAttachment & { size: number; busy?: boolean };

type ComposerProps = Pick<ScopedChatViewProps, "chips" | "privacy" | "placeholder" | "scope" | "sourceNote"> & {
	streaming: boolean;
	disabled: boolean;
	ensureThread: () => Promise<string>;
	/** True once the message is on its way; false keeps it in the box. */
	onSend: (text: string, attachments: ChatAttachment[]) => boolean | Promise<boolean>;
	onStop: () => void;
};

/** Context chips and attachments, a box that grows to six lines, attach, and Send (Stop while a reply streams). */
export function Composer(props: ComposerProps) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const [attachments, setAttachments] = useState<Upload[]>([]);
	const [picking, setPicking] = useState(false);
	const uploading = picking || attachments.some((attachment) => attachment.busy);
	const hasText = text.trim().length > 0;

	const submit = async () => {
		const value = text.trim();
		if (!value || props.streaming || props.disabled || uploading) return;
		const sent = await props.onSend(
			value,
			attachments.map(({ id, filename, mediaType }) => ({ id, filename, mediaType })),
		);
		if (!sent) return;
		setText("");
		setAttachments([]);
	};

	const pickFiles = async (signal: AbortSignal) => {
		const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
		if (picked.canceled || signal.aborted) return;
		// Sizes are checked before any file is read: 5 MB a file (the app's limit; the server takes 25) and 100 MB in all.
		let budget = MAX_TOTAL_BYTES - attachments.reduce((total, item) => total + item.size, 0);
		let room = MAX_FILES - attachments.length;
		const files: { asset: DocumentPicker.DocumentPickerAsset; key: string; size: number }[] = [];
		const skipped = { count: 0, big: false, total: false };
		for (const [index, asset] of picked.assets.entries()) {
			const size = asset.size ?? new File(asset.uri).size;
			if (room === 0) skipped.count++;
			else if (size > MAX_FILE_BYTES) skipped.big = true;
			else if (size > budget) skipped.total = true;
			else {
				files.push({ asset, key: `upload-${Date.now()}-${index}`, size });
				budget -= size;
				room--;
			}
		}
		if (skipped.count > 0) showToast({ title: t`Attach up to 10 files to a message.` });
		if (skipped.big) showToast({ title: t`Files can be up to 5 MB each.` });
		if (skipped.total) showToast({ title: t`Attachments can be up to 100 MB in all.` });
		if (files.length === 0) return;
		setAttachments((current) => [
			...current,
			...files.map(({ asset, key, size }) => ({
				id: key,
				filename: asset.name,
				mediaType: asset.mimeType ?? "application/octet-stream",
				size,
				busy: true,
			})),
		]);
		const drop = (key: string) => setAttachments((current) => current.filter((item) => item.id !== key));
		let threadId: string;
		try {
			threadId = await props.ensureThread();
		} catch (error) {
			for (const { key } of files) drop(key);
			showToast({ title: errorText(error, t`Couldn't attach the file. Try again.`) });
			return;
		}
		// One file at a time: only one base64 copy is in memory at once.
		for (const { asset, key } of files) {
			if (signal.aborted) return;
			try {
				signal.throwIfAborted();
				const attachment = await client.agent.attachments.create(
					{
						threadId,
						filename: asset.name,
						mediaType: asset.mimeType ?? "application/octet-stream",
						data: await new File(asset.uri).base64(),
					},
					{ context: { scope: props.scope }, signal },
				);
				setAttachments((current) =>
					current.map((item) =>
						item.id === key
							? { id: attachment.id, filename: attachment.filename, mediaType: attachment.mediaType, size: item.size }
							: item,
					),
				);
			} catch (error) {
				drop(key);
				if (signal.aborted) return;
				showToast({ title: errorText(error, t`Couldn't attach the file. Try again.`) });
			}
		}
	};

	const sendDisabled = !props.streaming && (!hasText || props.disabled || uploading);

	const attachmentRequest = useRef<AbortController | null>(null);
	useEffect(() => () => attachmentRequest.current?.abort(), []);
	const attach = async () => {
		if (attachmentRequest.current) return;
		const controller = new AbortController();
		attachmentRequest.current = controller;
		setPicking(true);
		try {
			await pickFiles(controller.signal);
		} catch (error) {
			if (!controller.signal.aborted) showToast({ title: errorText(error, t`Couldn't attach the file. Try again.`) });
		} finally {
			attachmentRequest.current = null;
			setPicking(false);
		}
	};

	return (
		<View className="gap-2 border-t border-separator bg-surface px-4 pt-2 pb-3">
			{props.chips || attachments.length ? (
				<View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
					{props.chips}
					{attachments.map((file) => (
						<FileChip
							key={file.id}
							name={file.filename}
							busy={file.busy}
							onRemove={
								file.busy
									? undefined
									: () => {
											setAttachments((current) => current.filter((item) => item.id !== file.id));
											void props
												.ensureThread()
												.then(() =>
													client.agent.attachments.delete({ id: file.id }, { context: { scope: props.scope } }),
												)
												.catch(() => undefined);
										}
							}
						/>
					))}
				</View>
			) : null}
			<View className="flex-row items-end gap-1 rounded-field bg-surface-secondary p-1">
				<IconButton
					icon="paperclip"
					label={t`Attach a file`}
					isDisabled={props.disabled || props.streaming || uploading}
					onPress={() => void attach()}
				/>
				<ChatInput
					testID="assistant-message"
					accessibilityLabel={t`Message the assistant`}
					placeholder={props.placeholder}
					value={text}
					onChangeText={setText}
					editable={!props.disabled}
				/>
				<IconButton
					testID={props.streaming ? "assistant-stop" : "assistant-send"}
					icon={props.streaming ? "stop" : "arrow-up"}
					label={props.streaming ? t`Stop` : t`Send`}
					variant={props.streaming ? "secondary" : "primary"}
					isDisabled={sendDisabled}
					onPress={props.streaming ? props.onStop : () => void submit()}
				/>
			</View>
			{props.sourceNote ? (
				<Text size="xs" weight="medium">
					{props.sourceNote}
				</Text>
			) : null}
			<Text size="xs" tone="muted" numberOfLines={4}>
				{props.privacy}
			</Text>
		</View>
	);
}

type ContextChipProps = {
	icon: IconName;
	label: string;
	onRemove?: () => void;
	removeLabel?: string;
	pressed?: boolean;
	onPress?: () => void;
};

export function ContextChip({ icon, label, onRemove, removeLabel, pressed, onPress }: ContextChipProps) {
	const content = (
		<>
			<Icon name={icon} size={16} tone={pressed ? "accent" : "muted"} />
			<Text size="xs" numberOfLines={1} className="shrink" tone={pressed ? "accent" : "muted"}>
				{label}
			</Text>
		</>
	);
	const layout = "max-w-48 flex-row items-center gap-1 rounded-full px-2";
	return onPress ? (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={label}
			accessibilityState={{ checked: !!pressed }}
			className={cx(layout, "min-h-8", pressed ? "bg-accent-soft" : "bg-surface-secondary")}
			hitSlop={6}
			onPress={onPress}
		>
			{content}
		</Pressable>
	) : (
		<View className={cx(layout, "min-h-8 bg-surface-secondary")}>
			{content}
			{onRemove ? <IconButton icon="x" label={removeLabel ?? label} size="sm" onPress={onRemove} /> : null}
		</View>
	);
}
