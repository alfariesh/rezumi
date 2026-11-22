// One question at a time, answered typed or spoken (web practise.tsx). The flow is the reducer in machine.ts; this
// component wires it to the device: the microphone primer (only when Record is tapped), the recorder, transcription
// by the person's AI connection, and feedback saved as an attempt. The question and answer are kept on the device.
import type { SavedData } from "../queries";
import type { Recording, RecordStop, VoiceSettings } from "../voice";
import type { Spoken } from "./answer-editor";
import type { PracticeMode } from "./machine";
import type { Question } from "./question-card";
import { useLingui } from "@lingui/react/macro";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { View } from "react-native";
import { acceptedAudioType } from "@rezumi/career/workspace";
import { ActionButton, Actions, Caption } from "../blocks";
import { useDraft } from "../drafts";
import { useGenerate } from "../queries";
import { afterTranscribed } from "../state";
import { deleteQuietly, microphone, transcribe, usePlayer, useRecorder } from "../voice";
import { AnswerPanel } from "./answer-panel";
import { FeedbackCard } from "./feedback-card";
import { HearIt } from "./hear-it";
import { initialPractice, practiceReducer } from "./machine";
import { QuestionCard } from "./question-card";
import { SessionSummary } from "./session-summary";
import { client } from "@/api/client";
import { isOnline } from "@/api/online";
import { askPermission } from "@/shell/permissions";
import { showToast } from "@/ui";

type Practice = SavedData<"practice">;
type PracticeDraft = { question: Question; answer: string; spoken: Spoken | null };

export type SessionProps = {
	applicationId: string;
	interviewId: string | null;
	questions: Question[];
	storyId: string | undefined;
	storyTitle: string | undefined;
	voice: VoiceSettings;
	initialMode: PracticeMode;
};

export function Session({
	applicationId,
	interviewId,
	questions,
	voice,
	initialMode,
	storyId,
	storyTitle,
}: SessionProps) {
	const { t } = useLingui();
	const generate = useGenerate(applicationId);
	const first = questions[0] ?? {
		text: t`Tell me about a piece of work you're proud of.`,
		origin: "simulated" as const,
	};
	const draft = useDraft<PracticeDraft>(`practice:${applicationId}:${interviewId ?? "none"}:${storyId ?? "general"}`, {
		question: first,
		answer: "",
		spoken: null,
	});
	const { question, answer, spoken } = draft.value;
	const [state, dispatch] = useReducer(practiceReducer, initialMode, initialPractice);
	const [feedback, setFeedback] = useState<{ answer: string; data: Practice } | null>(null);
	const [audio, setAudio] = useState<Recording | null>(null);
	const player = usePlayer();
	const transcriber = voice.settings.transcribe;
	const index = Math.max(
		0,
		questions.findIndex((item) => item.text === question.text),
	);
	// Refs, not render state: transcription finishes after later renders and must see things as they are then.
	const alive = useRef(true);
	const live = useRef({ state, audio, keep: voice.settings.keep });
	useLayoutEffect(() => {
		live.current = { state, audio, keep: voice.settings.keep };
	});
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			const kept = live.current;
			if (kept.audio && !kept.keep) deleteQuietly(new File(kept.audio.uri));
		};
	}, []);
	const replaceAudio = (next: Recording | null) => {
		const previous = live.current.audio;
		if (previous && previous.uri !== next?.uri) deleteQuietly(new File(previous.uri));
		live.current = { ...live.current, audio: next };
		setAudio(next);
	};
	const patch = (next: Partial<PracticeDraft>) => draft.setValue((current) => ({ ...current, ...next }));

	// Each transcription run sends the recording on screen; a result for an older run is dropped by the reducer.
	const sendRun = (run: number) => {
		const recording = live.current.audio;
		if (!recording || !transcriber) return dispatch({ type: "transcription-failed", run, offline: false });
		transcribe({ recording, providerId: transcriber.providerId, model: transcriber.model, applicationId })
			.then((result) => {
				if (!alive.current || live.current.state.run !== run) return;
				patch({ answer: result.text, spoken: { id: result.id, text: result.text, seconds: recording.seconds } });
				dispatch({ type: "transcribed", run });
				// Without Keep, the file just uploaded goes, even if another recording has replaced it on screen since.
				const next = afterTranscribed({
					uploaded: recording,
					current: live.current.audio,
					keep: live.current.keep,
					remove: (uploaded) => deleteQuietly(new File(uploaded.uri)),
				});
				live.current = { ...live.current, audio: next };
				setAudio(next);
			})
			.catch(() => {
				if (alive.current) dispatch({ type: "transcription-failed", run, offline: !isOnline() });
			});
	};
	const send = useRef(sendRun);
	useLayoutEffect(() => {
		send.current = sendRun;
	});
	useEffect(() => {
		if (state.phase === "transcribing") send.current(state.run);
	}, [state.phase, state.run]);

	const recorder = useRecorder((result: RecordStop) => {
		if (result.kind === "recorded") {
			if (result.atLimit) showToast({ title: t`Recording stopped at the 2-minute limit. Transcribing what you said.` });
			replaceAudio(result.recording);
		}
		dispatch({ type: "stopped", result: result.kind, atLimit: result.atLimit });
	});

	const record = async () => {
		const online = isOnline();
		dispatch({ type: "record", online });
		if (!online) return;
		patch({ spoken: null });
		// The primer explains the microphone first; a refusal is answered on this screen (type instead, Settings).
		const allowed = await askPermission("microphone", microphone, true);
		if (!alive.current) return;
		if (!allowed) return dispatch({ type: "denied" });
		const started = await recorder.start();
		if (!alive.current) return void recorder.cancel();
		dispatch(started === "started" ? { type: "started" } : { type: "start-failed" });
	};
	const chooseFile = async () => {
		const picked = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true }).catch(
			() => null,
		);
		const asset = picked && !picked.canceled ? picked.assets[0] : undefined;
		if (!asset) return;
		const type = acceptedAudioType(asset.mimeType, asset.size);
		if (!type) deleteQuietly(new File(asset.uri));
		else replaceAudio({ uri: asset.uri, seconds: null, name: asset.name, type });
		dispatch({ type: "file", accepted: type !== null, online: isOnline() });
	};
	const chooseMode = (mode: PracticeMode) => {
		if (state.phase === "recording" || state.phase === "asking") void recorder.cancel();
		dispatch({ type: "mode", mode });
	};
	const getFeedback = () => {
		const online = isOnline();
		dispatch({ type: "review", online });
		if (!online) return;
		const text = answer.trim();
		// Corrections to a transcript are kept with it, so the server's copy matches what was reviewed.
		if (spoken && text !== spoken.text)
			void client.career.voice.saveTranscript({ id: spoken.id, text }).catch(() => undefined);
		generate
			.run({
				task: "practice",
				interviewId,
				...(storyId ? { storyId } : {}),
				question: question.text,
				origin: question.origin,
				mode: spoken ? "spoken" : "typed",
				answer: text,
			})
			.then(({ item }) => {
				if (item?.data.kind !== "practice") return dispatch({ type: "review-failed" });
				setFeedback({ answer, data: item.data });
				dispatch({ type: "reviewed" });
			})
			.catch(() => dispatch({ type: "review-failed" }));
	};
	const goTo = (next: Question | undefined) => {
		if (next) draft.setValue({ question: next, answer: "", spoken: null });
		setFeedback(null);
	};

	if (state.phase === "finished")
		return (
			<SessionSummary
				answered={state.answered}
				total={questions.length}
				onRestart={() => {
					goTo(questions[0]);
					dispatch({ type: "restart" });
				}}
			/>
		);

	return (
		<View className="gap-4">
			<QuestionCard
				question={question}
				position={index + 1}
				total={questions.length}
				storyTitle={storyTitle}
				hear={<HearIt key={question.text} text={question.text} voice={voice} player={player} />}
			/>
			<AnswerPanel
				state={state}
				answer={answer}
				spoken={spoken}
				audio={audio}
				player={player}
				voice={voice}
				seconds={recorder.seconds}
				feedbackBusy={generate.isPending}
				onAnswer={(next) => {
					patch({ answer: next });
					dispatch({ type: "edited" });
				}}
				onMode={chooseMode}
				onRecord={() => void record()}
				onStop={() => void recorder.stop()}
				onCancel={() => chooseMode("typed")}
				onChooseFile={() => void chooseFile()}
				onRetry={() => dispatch({ type: "retry-transcription", online: isOnline() })}
				onFeedback={getFeedback}
			/>
			{feedback && state.phase === "feedback" ? (
				<FeedbackCard data={feedback.data}>
					<Actions>
						<ActionButton
							label={t`Try again with this`}
							onPress={() => {
								chooseMode("typed");
								patch({ spoken: null, answer: feedback.data.opening });
							}}
						/>
						<ActionButton
							variant="ghost"
							icon="arrow-right"
							label={index + 1 >= questions.length ? t`Finish` : t`Next question`}
							onPress={() => {
								const last = index + 1 >= questions.length;
								if (!last) goTo(questions[index + 1]);
								dispatch({ type: "next", last });
							}}
							testID="practice-next"
						/>
					</Actions>
					<Caption>{t`Saved to Saved · Practice`}</Caption>
				</FeedbackCard>
			) : null}
		</View>
	);
}
