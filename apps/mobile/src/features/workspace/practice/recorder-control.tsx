// Speaking an answer: one button records and stops (so the control that started it is the one that stops it), the
// running clock against the 2-minute limit, Cancel, Choose an audio file, and what went wrong with a way forward:
// typing, the device's Settings for a refused microphone, or Try again for a failed transcription.
import type { PracticeState } from "./machine";
import { useLingui } from "@lingui/react/macro";
import { Linking, Pressable, View } from "react-native";
import { MAX_SECONDS, clock } from "@rezumi/career/workspace";
import { ActionButton, Actions, Notice } from "../blocks";
import { Icon, ProgressBar, Spinner, Text, cx } from "@/ui";

type RecorderControlProps = {
	state: PracticeState;
	seconds: number;
	/** The transcription model, named while it works. */
	model: string;
	hasAudio: boolean;
	onRecord: () => void;
	onStop: () => void;
	onCancel: () => void;
	onChooseFile: () => void;
	onRetry: () => void;
	onType: () => void;
};

export function RecorderControl(props: RecorderControlProps) {
	const { state, seconds, model, hasAudio } = props;
	const { t } = useLingui();
	const recording = state.phase === "recording";
	const asking = state.phase === "asking";
	if (state.phase === "transcribing")
		return (
			<View accessibilityRole="progressbar" className="flex-row items-center gap-2" testID="practice-transcribing">
				<Spinner size="sm" />
				<Text tone="muted">{t`Transcribing with ${model}…`}</Text>
			</View>
		);
	const elapsed = clock(seconds);
	return (
		<View className="gap-3">
			<View
				className={cx(
					"flex-row items-center gap-3 rounded-2xl p-3",
					recording ? "bg-danger-soft" : "bg-surface-secondary",
				)}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={recording ? t`Stop recording` : t`Record your answer`}
					accessibilityState={{ busy: asking, disabled: asking }}
					disabled={asking}
					onPress={recording ? props.onStop : props.onRecord}
					className="size-14 items-center justify-center rounded-full bg-danger active:opacity-80"
					testID="practice-record"
				>
					{asking ? (
						<Spinner size="sm" />
					) : (
						<Icon name={recording ? "stop" : "microphone"} size={24} tone="danger-foreground" />
					)}
				</Pressable>
				<View className="flex-1 gap-0.5">
					<Text weight="semibold" tone={recording ? "danger" : "default"}>
						{recording ? t`Recording · ${elapsed}` : t`Record your answer`}
					</Text>
					<Text size="xs" tone="muted">
						{recording ? t`Stop when you're done. Nothing is sent until then.` : t`Up to 2 minutes · 2 MB maximum.`}
					</Text>
				</View>
			</View>
			{recording ? (
				<>
					<ProgressBar value={(seconds / MAX_SECONDS) * 100} color="danger" accessibilityLabel={t`Recording time`} />
					<ActionButton variant="ghost" label={t`Cancel recording`} onPress={props.onCancel} />
				</>
			) : (
				<ActionButton
					variant="ghost"
					icon="file-arrow-up"
					label={t`Choose an audio file`}
					disabled={asking}
					onPress={props.onChooseFile}
				/>
			)}
			<Problem state={state} hasAudio={hasAudio} onRetry={props.onRetry} onType={props.onType} />
		</View>
	);
}

type ProblemProps = { state: PracticeState; hasAudio: boolean; onRetry: () => void; onType: () => void };

function Problem({ state, hasAudio, onRetry, onType }: ProblemProps) {
	const { t } = useLingui();
	const error = state.error;
	if (!error) return null;
	const type = (
		<ActionButton
			variant="ghost"
			icon="keyboard"
			label={t`Type instead`}
			onPress={onType}
			testID="practice-type-instead"
		/>
	);
	if (error.kind === "denied")
		return (
			<View className="gap-2" testID="practice-denied">
				<Notice status="warning" message={t`Allow microphone access in your device's Settings, or type your answer.`} />
				<Actions>
					<ActionButton label={t`Open Settings`} onPress={() => void Linking.openSettings()} />
					{type}
				</Actions>
			</View>
		);
	if (error.kind === "transcription" || error.kind === "offline")
		return (
			<View className="gap-2" testID={`practice-${error.kind}`}>
				<Notice
					status={error.kind === "offline" ? "warning" : "danger"}
					message={
						error.kind === "offline"
							? t`You're offline, so nothing was sent. Try again when you're back online, or type your answer.`
							: t`Couldn't transcribe. Your recording is still here.`
					}
				/>
				<Actions>
					{hasAudio ? <ActionButton label={t`Try again`} onPress={onRetry} /> : null}
					{type}
				</Actions>
			</View>
		);
	const message =
		error.kind === "start-failed"
			? t`Couldn't start recording. Try again, or type your answer.`
			: error.problem === "file-type"
				? t`Choose a WebM, MP4, MP3, WAV or Ogg file up to 2 MB.`
				: t`That recording was empty or over 2 MB. Try a shorter answer.`;
	return (
		<View className="gap-2" testID="practice-audio-problem">
			<Notice status="danger" message={message} />
			<Actions>{type}</Actions>
		</View>
	);
}
