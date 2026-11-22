// Which connection transcribes answers and which reads questions, their models, and keeping the recording. Kept on
// this device, per server.
import type { VoiceSettings } from "../voice";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Caption } from "../blocks";
import { ListRow, ListSection, Sheet, Switch } from "@/ui";

type Option = { value: string; label: string };
type VoiceSettingsSheetProps = { voice: VoiceSettings; isOpen: boolean; onOpenChange: (open: boolean) => void };

export function VoiceSettingsSheet({ voice, isOpen, onOpenChange }: VoiceSettingsSheetProps) {
	const { t } = useLingui();
	const { settings, update, transcribers, readers } = voice;
	const transcribe = settings.transcribe;
	const reader = settings.speak;
	const models = (list: readonly string[]): Option[] => list.map((model) => ({ value: model, label: model }));
	const keepLabel = t`Keep the recording on this device so I can share it`;
	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Voice settings`}
			closeLabel={t`Close`}
			detents={[0.75, 1]}
		>
			<View className="gap-5">
				{transcribers.length > 0 && transcribe ? (
					<Choice
						title={t`Transcribe answers with`}
						value={transcribe.providerId}
						options={transcribers.map((provider) => ({ value: provider.id, label: provider.label }))}
						onPick={(transcribeWith) => update({ transcribeWith, transcribeModel: undefined })}
					/>
				) : null}
				{transcribe && transcribe.models.length > 1 ? (
					<Choice
						title={t`Transcription model`}
						value={transcribe.model}
						options={models(transcribe.models)}
						onPick={(transcribeModel) => update({ transcribeModel })}
					/>
				) : null}
				<Choice
					title={t`Read questions with`}
					value={reader?.providerId ?? "off"}
					options={[
						...readers.map((provider) => ({ value: provider.id, label: provider.label })),
						{ value: "off", label: t`Text only` },
					]}
					onPick={(speakWith) => update({ speakWith, speakModel: undefined })}
				/>
				{reader && reader.models.length > 1 ? (
					<Choice
						title={t`Speech model`}
						value={reader.model}
						options={models(reader.models)}
						onPick={(speakModel) => update({ speakModel })}
					/>
				) : null}
				<ListSection>
					<ListRow
						title={keepLabel}
						trailing={
							<Switch
								isSelected={settings.keep}
								accessibilityLabel={keepLabel}
								onSelectedChange={(keep) => update({ keep })}
							/>
						}
					/>
				</ListSection>
				<Caption>
					{t`Speech may be billed separately by your provider. Without a speech connection, type your answer instead. The server keeps transcripts, never recordings.`}
				</Caption>
			</View>
		</Sheet>
	);
}

type ChoiceProps = { title: string; value: string; options: Option[]; onPick: (value: string) => void };

function Choice({ title, value, options, onPick }: ChoiceProps) {
	return (
		<ListSection title={title}>
			{options.map((option) => (
				<ListRow
					key={option.value}
					title={option.label}
					isSelected={option.value === value}
					chevron={false}
					onPress={() => onPick(option.value)}
				/>
			))}
		</ListSection>
	);
}
