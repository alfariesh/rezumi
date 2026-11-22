// The answer as text: typed, or the transcript of a spoken one to check and correct (numbers as digits, record again,
// play or share the kept recording).
import type { Recording } from "../voice";
import type { usePlayer } from "../voice";
import { useLingui } from "@lingui/react/macro";
import * as Sharing from "expo-sharing";
import { View } from "react-native";
import { clock, writeNumbersAsDigits } from "@rezumi/career/workspace";
import { ActionButton, Actions, Caption } from "../blocks";
import { Label, TextArea, TextField, showToast } from "@/ui";

export type Spoken = { id: string; text: string; seconds: number | null };

type AnswerEditorProps = {
	answer: string;
	onChange: (answer: string) => void;
	/** The transcript this answer came from, if it was spoken. */
	spoken: Spoken | null;
	audio: Recording | null;
	player: ReturnType<typeof usePlayer>;
	onRecordAgain: () => void;
	disabled: boolean;
};

export function AnswerEditor({ answer, onChange, spoken, audio, player, onRecordAgain, disabled }: AnswerEditorProps) {
	const { t } = useLingui();
	const spokenFor = spoken?.seconds != null ? clock(spoken.seconds) : t`audio file`;
	return (
		<View className="gap-2">
			{spoken ? <Caption>{t`Transcribed · ${spokenFor} · check numbers and names before using it`}</Caption> : null}
			<TextField isDisabled={disabled}>
				<Label>{t`Your answer`}</Label>
				<TextArea
					variant="secondary"
					value={answer}
					maxLength={6000}
					numberOfLines={5}
					placeholder={t`About 90 seconds when spoken`}
					accessibilityLabel={t`Your answer`}
					onChangeText={onChange}
					testID="practice-answer"
				/>
			</TextField>
			{spoken ? (
				<Actions>
					<ActionButton label={t`Write numbers as digits`} onPress={() => onChange(writeNumbersAsDigits(answer))} />
					<ActionButton
						variant="ghost"
						icon="microphone"
						label={t`Record again`}
						disabled={disabled}
						onPress={onRecordAgain}
					/>
					{audio ? (
						<>
							<ActionButton
								variant="ghost"
								icon={player.playing ? "stop" : "play"}
								label={player.playing ? t`Stop audio` : t`Play recording`}
								onPress={() => (player.playing ? player.stop() : void player.play(audio.uri))}
							/>
							<ActionButton
								variant="ghost"
								icon="share-network"
								label={t`Share recording`}
								onPress={() =>
									void Sharing.shareAsync(audio.uri, { mimeType: "audio/mp4", UTI: "public.mpeg-4-audio" }).catch(() =>
										showToast({ title: t`Couldn't share the recording. Try again.`, variant: "danger" }),
									)
								}
							/>
						</>
					) : null}
				</Actions>
			) : null}
		</View>
	);
}
