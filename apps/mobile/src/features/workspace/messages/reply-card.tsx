// W16: what they're asking, what isn't confirmed, and a reply to edit and send yourself.
import type { SavedData, SavedItem } from "../queries";
import { useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { View } from "react-native";
import { ActionButton, Block, Caption } from "../blocks";
import { useDraft } from "../drafts";
import { Icon, Label, TextArea, TextField, Typography, showToast } from "@/ui";

export type ReplyItem = SavedItem & { data: SavedData<"reply"> };

type ReplyCardProps = { reply: ReplyItem; readOnly: boolean };

export function ReplyCard({ reply, readOnly }: ReplyCardProps) {
	const { t } = useLingui();
	const draft = useDraft(`reply:${reply.id}`, reply.data.reply);
	const text = readOnly ? reply.data.reply : draft.value;
	const copy = async () => {
		await Clipboard.setStringAsync(text);
		showToast({ title: t`Reply copied`, variant: "success" });
	};
	const label = t`Suggested reply · edit before sending`;
	return (
		<Block title={reply.data.title}>
			{reply.data.asks.map((ask) => (
				<View key={ask} className="flex-row gap-2">
					<Icon name="check" size={18} tone="success" />
					<Typography type="body-sm" className="flex-1">
						{ask}
					</Typography>
				</View>
			))}
			{reply.data.unconfirmed.map((open) => (
				<View key={open} className="flex-row gap-2">
					<Icon name="question" size={18} tone="warning" />
					<Typography type="body-sm" className="flex-1">
						{open}
					</Typography>
				</View>
			))}
			{reply.data.reply ? (
				<>
					<TextField isDisabled={readOnly}>
						<Label>{label}</Label>
						<TextArea
							variant="secondary"
							value={text}
							maxLength={4000}
							accessibilityLabel={label}
							onChangeText={draft.setValue}
						/>
					</TextField>
					<ActionButton icon="copy" label={t`Copy reply`} onPress={() => void copy()} />
					<Caption>{t`You send it from your own email.`}</Caption>
				</>
			) : null}
		</Block>
	);
}
