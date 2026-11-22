// "Your answer": Type or Speak, the field or the recorder, voice settings, and Get feedback with what it sends.
import type { Recording, usePlayer, VoiceSettings } from "../voice";
import type { Spoken } from "./answer-editor";
import type { PracticeMode, PracticeState } from "./machine";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { ConnectAi, PrivacyLine } from "../ai-notice";
import { ActionButton, Actions, Block, Caption, Notice } from "../blocks";
import { useWorking, workingSteps } from "../working";
import { AnswerEditor } from "./answer-editor";
import { isBusy } from "./machine";
import { RecorderControl } from "./recorder-control";
import { VoiceSettingsSheet } from "./voice-settings-sheet";
import { useHasAIProvider } from "@/features/ai/providers";
import { Segment, Skeleton } from "@/ui";

type AnswerPanelProps = {
	state: PracticeState;
	answer: string;
	spoken: Spoken | null;
	audio: Recording | null;
	player: ReturnType<typeof usePlayer>;
	voice: VoiceSettings;
	seconds: number;
	feedbackBusy: boolean;
	onAnswer: (answer: string) => void;
	onMode: (mode: PracticeMode) => void;
	onRecord: () => void;
	onStop: () => void;
	onCancel: () => void;
	onChooseFile: () => void;
	onRetry: () => void;
	onFeedback: () => void;
};

export function AnswerPanel(props: AnswerPanelProps) {
	const { state, answer, spoken, voice } = props;
	const { t } = useLingui();
	const provider = useHasAIProvider().defaultProvider;
	const [settingsOpen, setSettingsOpen] = useState(false);
	const transcriber = voice.settings.transcribe;
	const busy = isBusy(state);
	const label = useWorking(props.feedbackBusy, workingSteps("practice"), t`Get feedback`);
	// Asking again for the same words would only save a duplicate attempt.
	const ready =
		answer.trim().length >= 10 && (state.mode === "typed" || spoken !== null) && !busy && state.phase !== "feedback";
	const providerName = provider?.label ?? t`your AI connection`;
	const transcriberName = transcriber?.label ?? "";
	const editor = (
		<AnswerEditor
			answer={answer}
			onChange={props.onAnswer}
			spoken={state.mode === "spoken" ? spoken : null}
			audio={props.audio}
			player={props.player}
			onRecordAgain={props.onRecord}
			disabled={state.phase === "reviewing"}
		/>
	);
	const spokenBody = voice.providerState.isLoading ? (
		<Skeleton variant="none" className="h-20 rounded-2xl" />
	) : !transcriber ? (
		<View className="gap-2">
			<Notice
				status="warning"
				message={t`None of your AI connections can transcribe speech (OpenAI, Google Gemini, Mistral, xAI, Groq or Vercel AI Gateway can). Add one, or type your answer.`}
			/>
			<Actions>
				<ConnectAi />
				<ActionButton variant="ghost" icon="keyboard" label={t`Type instead`} onPress={() => props.onMode("typed")} />
			</Actions>
		</View>
	) : spoken && state.phase !== "asking" && state.phase !== "recording" && state.phase !== "transcribing" ? (
		editor
	) : (
		<RecorderControl
			state={state}
			seconds={props.seconds}
			model={transcriber.model}
			hasAudio={props.audio !== null}
			onRecord={props.onRecord}
			onStop={props.onStop}
			onCancel={props.onCancel}
			onChooseFile={props.onChooseFile}
			onRetry={props.onRetry}
			onType={() => props.onMode("typed")}
		/>
	);

	return (
		<Block title={t`Your answer`}>
			<Segment<PracticeMode>
				accessibilityLabel={t`Answer by`}
				value={state.mode}
				isDisabled={state.phase === "reviewing"}
				options={[
					{ value: "typed", label: t`Type`, icon: "keyboard" },
					{ value: "spoken", label: t`Speak`, icon: "microphone" },
				]}
				onValueChange={props.onMode}
			/>
			{state.mode === "typed" ? (
				<>
					{editor}
					{state.error?.kind === "offline" ? (
						<Notice
							status="warning"
							message={t`You're offline, so nothing was sent. Try again when you're back online.`}
						/>
					) : null}
				</>
			) : (
				spokenBody
			)}
			{state.mode === "spoken" && transcriber ? (
				<PrivacyLine>
					{t`Your recording goes to ${transcriberName} after you stop, to be transcribed. Your provider may charge. The server keeps transcripts, never recordings.`}
				</PrivacyLine>
			) : null}
			{state.mode === "spoken" && !voice.providerState.isUnavailable ? (
				<ActionButton
					variant="ghost"
					icon="sliders-horizontal"
					label={t`Voice settings`}
					disabled={busy}
					onPress={() => setSettingsOpen(true)}
				/>
			) : null}
			<View className="gap-2">
				<ActionButton
					full
					size="md"
					variant="primary"
					label={label}
					disabled={!ready || !provider}
					busy={props.feedbackBusy}
					onPress={props.onFeedback}
					testID="practice-feedback-button"
				/>
				<Caption>{t`Compared with your stories and the posting.`}</Caption>
				{provider ? (
					<PrivacyLine>
						{t`Get feedback sends the question, your answer, this posting and your stories to ${providerName}.`}
					</PrivacyLine>
				) : (
					<>
						<PrivacyLine>{t`Feedback needs an AI connection. Nothing is sent until you ask.`}</PrivacyLine>
						<ConnectAi />
					</>
				)}
			</View>
			<VoiceSettingsSheet voice={voice} isOpen={settingsOpen} onOpenChange={setSettingsOpen} />
		</Block>
	);
}
