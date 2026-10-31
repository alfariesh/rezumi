import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { ChatAttachment, ChatAttachmentGroup, PromptInput } from "@heroui-pro/react";
import { Tag, TagGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useRef } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { isImeComposing } from "@/libs/keyboard";

export type PromptChip = {
	key: string;
	icon: IconName;
	label: string;
	/** What a screen reader hears on the remove button. */
	removeLabel: string;
	onRemove: () => void;
};

export type PromptFile = {
	key: string;
	name: string;
	mimeType: string;
	/** The size as the reader's locale writes it, when known. */
	sizeLabel?: string | undefined;
	removeLabel: string;
	onRemove: () => void;
};

type PromptBoxProps = {
	value: string;
	onValueChange: (value: string) => void;
	/** Called for Enter and the send button, when there is something to send and no reply is streaming. */
	onSubmit: () => void;
	onStop: () => void;
	streaming: boolean;
	disabled: boolean;
	/** There is text to send and nothing is uploading. */
	canSend: boolean;
	placeholder: string;
	label: string;
	/** Tallest the box grows before it scrolls, in px. */
	maxHeight: number;
	/** Primary on a page-colored panel; secondary on a surface card. */
	variant?: "primary" | "secondary";
	/** Removable chips above the text: what is sent along (a document, a posting). */
	chips?: readonly PromptChip[];
	/** Uploaded files above the text, each removable. */
	files?: readonly PromptFile[];
	/** Controls above the text, before the chips (the coach's what-to-share switches). The toolbar can't wrap, so they live here. */
	context?: ReactNode;
	/** More controls in the toolbar after attach: the coach's connection picker. */
	toolbar?: ReactNode;
	/** Shows the attach button when set. */
	attach?: { isDisabled: boolean; isPending: boolean; onFiles: (files: File[]) => void } | undefined;
};

/**
 * The message box of the assistant and the coach: HeroUI Pro `PromptInput` with the app's rules on top. Enter sends
 * and Shift+Enter breaks the line (unless an IME is composing: `PromptInput.TextArea` doesn't check for one), Escape
 * stops a reply, and the box stays typeable while one streams.
 */
export function PromptBox(props: PromptBoxProps) {
	const { streaming, chips = [], files = [], attach } = props;
	const fileInput = useRef<HTMLInputElement>(null);
	const sendLabel = streaming ? t`Stop` : t`Send`;

	return (
		<PromptInput
			variant={props.variant ?? "secondary"}
			status={streaming ? "streaming" : "ready"}
			lockInputOnRun={false}
			maxHeight={props.maxHeight}
			isDisabled={props.disabled}
			value={props.value}
			onValueChange={props.onValueChange}
			onSubmit={props.onSubmit}
			onStop={props.onStop}
		>
			<PromptInput.Shell>
				<PromptInput.Content
					onKeyDownCapture={(event) => {
						// Stops the Enter that confirms an IME conversion before the text area treats it as send.
						if (event.key === "Enter" && isImeComposing(event)) event.stopPropagation();
					}}
				>
					{(chips.length > 0 || files.length > 0 || props.context) && (
						<PromptInput.Attachments>
							{props.context}
							{chips.length > 0 && (
								<TagGroup
									size="sm"
									aria-label={t`Sent with your message`}
									onRemove={(keys) => {
										for (const chip of chips) if (keys.has(chip.key)) chip.onRemove();
									}}
								>
									<TagGroup.List className="flex-wrap">
										{chips.map((chip) => (
											<Tag key={chip.key} id={chip.key} textValue={chip.label}>
												<Icon name={chip.icon} size={14} />
												<span className="max-w-40 truncate">{chip.label}</span>
												<Tag.RemoveButton aria-label={chip.removeLabel} />
											</Tag>
										))}
									</TagGroup.List>
								</TagGroup>
							)}
							{files.length > 0 && (
								<ChatAttachmentGroup>
									{files.map((file) => (
										<ChatAttachment key={file.key} name={file.name} mimeType={file.mimeType}>
											<ChatAttachment.Preview />
											<ChatAttachment.Info>
												<ChatAttachment.Name />
												{file.sizeLabel && <ChatAttachment.Size>{file.sizeLabel}</ChatAttachment.Size>}
											</ChatAttachment.Info>
											<ChatAttachment.Remove aria-label={file.removeLabel} onPress={file.onRemove} />
										</ChatAttachment>
									))}
								</ChatAttachmentGroup>
							)}
						</PromptInput.Attachments>
					)}
					<PromptInput.TextArea
						aria-label={props.label}
						placeholder={props.placeholder}
						onKeyDown={(event) => {
							if (event.key === "Escape" && streaming) {
								event.preventDefault();
								props.onStop();
							}
						}}
					/>
				</PromptInput.Content>
				<PromptInput.Toolbar>
					<PromptInput.ToolbarStart>
						{attach && (
							<>
								<PromptInput.Action
									aria-label={t`Attach a file`}
									tooltip={t`Attach a file`}
									className="size-8 min-w-0"
									isDisabled={attach.isDisabled || attach.isPending}
									onPress={() => fileInput.current?.click()}
								>
									<Icon name="paperclip" size={16} />
								</PromptInput.Action>
								<input
									ref={fileInput}
									type="file"
									multiple
									className="hidden"
									onChange={(event) => {
										const files = Array.from(event.target.files ?? []);
										// Picking the same file twice in a row still fires a change.
										event.target.value = "";
										if (files.length > 0) attach.onFiles(files);
									}}
								/>
							</>
						)}
						{props.toolbar}
					</PromptInput.ToolbarStart>
					<PromptInput.ToolbarEnd>
						<PromptInput.Send aria-label={sendLabel} isDisabled={streaming ? false : props.disabled || !props.canSend}>
							{/* Stop is the one filled glyph: a solid square. */}
							<Icon name={streaming ? "stop" : "arrow-up"} variant={streaming ? "duotone" : "stroke"} size={18} />
						</PromptInput.Send>
					</PromptInput.ToolbarEnd>
				</PromptInput.Toolbar>
			</PromptInput.Shell>
		</PromptInput>
	);
}
