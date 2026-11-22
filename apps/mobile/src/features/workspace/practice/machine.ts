// The practice session's flow as a pure reducer (no React, no device): idle → asking (the microphone primer and the
// recorder starting) → recording → transcribing → idle with a transcript → reviewing (feedback running) → feedback →
// the next question, or finished after the last one. Errors leave the flow at idle with what went wrong, so the
// screen can offer typing, Settings or a retry. The answer text itself lives in the draft (kept on the device).

export type PracticeMode = "typed" | "spoken";

export type PracticeError =
	/** The microphone was refused: offer typing and the device's Settings. */
	| { kind: "denied" }
	/** The recorder couldn't start. */
	| { kind: "start-failed" }
	/** A recording that's empty, over 2 MB, or a chosen file in another format. */
	| { kind: "audio"; problem: "empty" | "too-large" | "file-type" }
	/** Transcription failed; the recording is kept for a retry. */
	| { kind: "transcription" }
	/** The device is offline; nothing was sent. */
	| { kind: "offline" };

export type PracticePhase = "idle" | "asking" | "recording" | "transcribing" | "reviewing" | "feedback" | "finished";

export type PracticeState = {
	phase: PracticePhase;
	mode: PracticeMode;
	error: PracticeError | null;
	/** Bumped by each transcription and each mode switch, so an older, slower result can't land over newer input. */
	run: number;
	/** The last recording stopped itself at the 2-minute limit. */
	atLimit: boolean;
	/** Questions answered with feedback in this session. */
	answered: number;
};

export type PracticeEvent =
	| { type: "mode"; mode: PracticeMode }
	| { type: "record"; online: boolean }
	| { type: "denied" }
	| { type: "start-failed" }
	| { type: "started" }
	| { type: "stopped"; result: "recorded" | "empty" | "too-large"; atLimit: boolean }
	| { type: "cancel" }
	| { type: "file"; accepted: boolean; online: boolean }
	| { type: "retry-transcription"; online: boolean }
	| { type: "transcribed"; run: number }
	| { type: "transcription-failed"; run: number; offline: boolean }
	| { type: "review"; online: boolean }
	| { type: "reviewed" }
	| { type: "review-failed" }
	| { type: "edited" }
	| { type: "next"; last: boolean }
	| { type: "restart" }
	| { type: "dismiss" };

export const initialPractice = (mode: PracticeMode): PracticeState => ({
	phase: "idle",
	mode,
	error: null,
	run: 0,
	atLimit: false,
	answered: 0,
});

/** Busy: a control that would start something else stays disabled. */
export const isBusy = (state: PracticeState) =>
	state.phase === "asking" ||
	state.phase === "recording" ||
	state.phase === "transcribing" ||
	state.phase === "reviewing";

const idle = (state: PracticeState, error: PracticeError | null = null): PracticeState => ({
	...state,
	phase: "idle",
	error,
});

export function practiceReducer(state: PracticeState, event: PracticeEvent): PracticeState {
	switch (event.type) {
		case "mode":
			// Switching drops a recording in progress and any transcription still running (its result is stale now).
			if (state.phase === "reviewing" || state.phase === "finished") return state;
			return { ...state, mode: event.mode, phase: "idle", error: null, run: state.run + 1 };
		case "record":
			if (state.phase !== "idle" && state.phase !== "feedback") return state;
			if (!event.online) return idle({ ...state, mode: "spoken" }, { kind: "offline" });
			return { ...state, mode: "spoken", phase: "asking", error: null, atLimit: false };
		case "denied":
			return state.phase === "asking" ? idle(state, { kind: "denied" }) : state;
		case "start-failed":
			return state.phase === "asking" ? idle(state, { kind: "start-failed" }) : state;
		case "started":
			return state.phase === "asking" ? { ...state, phase: "recording", error: null } : state;
		case "stopped":
			if (state.phase !== "recording") return state;
			if (event.result !== "recorded")
				return idle({ ...state, atLimit: event.atLimit }, { kind: "audio", problem: event.result });
			return { ...state, phase: "transcribing", error: null, run: state.run + 1, atLimit: event.atLimit };
		case "cancel":
			return state.phase === "recording" || state.phase === "asking" ? idle(state) : state;
		case "file":
			if (state.phase !== "idle") return state;
			if (!event.accepted) return idle(state, { kind: "audio", problem: "file-type" });
			if (!event.online) return idle(state, { kind: "offline" });
			return { ...state, phase: "transcribing", error: null, run: state.run + 1, atLimit: false };
		case "retry-transcription":
			if (state.phase !== "idle") return state;
			if (!event.online) return idle(state, { kind: "offline" });
			return { ...state, phase: "transcribing", error: null, run: state.run + 1 };
		case "transcribed":
			return state.phase === "transcribing" && event.run === state.run ? idle(state) : state;
		case "transcription-failed":
			if (state.phase !== "transcribing" || event.run !== state.run) return state;
			return idle(state, event.offline ? { kind: "offline" } : { kind: "transcription" });
		case "review":
			if (state.phase !== "idle") return state;
			if (!event.online) return idle(state, { kind: "offline" });
			return { ...state, phase: "reviewing", error: null };
		case "reviewed":
			return state.phase === "reviewing" ? { ...state, phase: "feedback", answered: state.answered + 1 } : state;
		case "review-failed":
			return state.phase === "reviewing" ? idle(state) : state;
		case "edited":
			// Changing the answer after feedback hides it: asking again for other words is a new attempt.
			return state.phase === "feedback" ? idle(state) : state;
		case "next":
			if (state.phase !== "feedback" && state.phase !== "idle") return state;
			return event.last
				? { ...state, phase: "finished", error: null }
				: { ...state, phase: "idle", error: null, run: state.run + 1, atLimit: false };
		case "restart":
			return { ...initialPractice(state.mode), run: state.run + 1 };
		case "dismiss":
			return { ...state, error: null };
	}
}
