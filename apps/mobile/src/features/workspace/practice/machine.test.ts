// The practice session's flow (plans/mobile Phase 10): every transition of the reducer, including a refused
// microphone answered by typing and then allowed, a stale transcription, offline and the end of the questions.
import type { PracticeEvent, PracticeState } from "./machine";
import { initialPractice, isBusy, practiceReducer } from "./machine";

const run = (state: PracticeState, ...events: PracticeEvent[]) => events.reduce(practiceReducer, state);
const typed = initialPractice("typed");

describe("practiceReducer", () => {
	it("records, transcribes and returns to idle with the transcript", () => {
		const asking = run(typed, { type: "record", online: true });
		expect(asking).toMatchObject({ phase: "asking", mode: "spoken" });
		expect(isBusy(asking)).toBe(true);
		const recording = run(asking, { type: "started" });
		expect(recording.phase).toBe("recording");
		const transcribing = run(recording, { type: "stopped", result: "recorded", atLimit: true });
		expect(transcribing).toMatchObject({ phase: "transcribing", run: 1, atLimit: true });
		expect(run(transcribing, { type: "transcribed", run: 1 })).toMatchObject({ phase: "idle", error: null });
	});

	it("answers a refused microphone with typing, then records once allowed", () => {
		const denied = run(typed, { type: "record", online: true }, { type: "denied" });
		expect(denied).toMatchObject({ phase: "idle", error: { kind: "denied" }, mode: "spoken" });
		const typing = run(denied, { type: "mode", mode: "typed" });
		expect(typing).toMatchObject({ phase: "idle", mode: "typed", error: null });
		const granted = run(typing, { type: "record", online: true }, { type: "started" });
		expect(granted).toMatchObject({ phase: "recording", mode: "spoken", error: null });
	});

	it("reports a recorder that couldn't start", () => {
		expect(run(typed, { type: "record", online: true }, { type: "start-failed" }).error).toEqual({
			kind: "start-failed",
		});
	});

	it("refuses empty and oversized recordings and unknown audio files", () => {
		const recording = run(typed, { type: "record", online: true }, { type: "started" });
		expect(run(recording, { type: "stopped", result: "empty", atLimit: false }).error).toEqual({
			kind: "audio",
			problem: "empty",
		});
		expect(run(recording, { type: "stopped", result: "too-large", atLimit: true })).toMatchObject({
			phase: "idle",
			atLimit: true,
			error: { kind: "audio", problem: "too-large" },
		});
		expect(run(typed, { type: "file", accepted: false, online: true }).error).toEqual({
			kind: "audio",
			problem: "file-type",
		});
		expect(run(typed, { type: "file", accepted: true, online: true }).phase).toBe("transcribing");
	});

	it("keeps the recording after a failed transcription and retries it", () => {
		const transcribing = run(typed, { type: "file", accepted: true, online: true });
		const failed = run(transcribing, { type: "transcription-failed", run: transcribing.run, offline: false });
		expect(failed).toMatchObject({ phase: "idle", error: { kind: "transcription" } });
		const retry = run(failed, { type: "retry-transcription", online: true });
		expect(retry).toMatchObject({ phase: "transcribing", run: transcribing.run + 1 });
		expect(run(retry, { type: "transcription-failed", run: retry.run, offline: true }).error).toEqual({
			kind: "offline",
		});
	});

	it("drops a transcription that a mode switch made stale", () => {
		const transcribing = run(typed, { type: "file", accepted: true, online: true });
		const switched = run(transcribing, { type: "mode", mode: "typed" });
		expect(switched.phase).toBe("idle");
		expect(run(switched, { type: "transcribed", run: transcribing.run })).toBe(switched);
	});

	it("sends nothing while offline", () => {
		expect(run(typed, { type: "record", online: false })).toMatchObject({ phase: "idle", error: { kind: "offline" } });
		expect(run(typed, { type: "review", online: false })).toMatchObject({ phase: "idle", error: { kind: "offline" } });
		expect(run(typed, { type: "retry-transcription", online: false }).error).toEqual({ kind: "offline" });
	});

	it("cancels a recording", () => {
		const recording = run(typed, { type: "record", online: true }, { type: "started" });
		expect(run(recording, { type: "cancel" }).phase).toBe("idle");
	});

	it("gets feedback, hides it after an edit, and moves on to the end", () => {
		const reviewing = run(typed, { type: "review", online: true });
		expect(reviewing.phase).toBe("reviewing");
		expect(run(reviewing, { type: "review-failed" }).phase).toBe("idle");
		const feedback = run(reviewing, { type: "reviewed" });
		expect(feedback).toMatchObject({ phase: "feedback", answered: 1 });
		expect(run(feedback, { type: "edited" }).phase).toBe("idle");
		expect(run(feedback, { type: "next", last: false })).toMatchObject({ phase: "idle", answered: 1 });
		const finished = run(feedback, { type: "next", last: true });
		expect(finished.phase).toBe("finished");
		expect(run(finished, { type: "mode", mode: "spoken" })).toBe(finished);
		expect(run(finished, { type: "restart" })).toMatchObject({ phase: "idle", answered: 0 });
	});

	it("ignores events that don't fit the phase, and dismisses an error", () => {
		expect(run(typed, { type: "started" })).toBe(typed);
		expect(run(typed, { type: "stopped", result: "recorded", atLimit: false })).toBe(typed);
		expect(run(typed, { type: "reviewed" })).toBe(typed);
		const denied = run(typed, { type: "record", online: true }, { type: "denied" });
		expect(run(denied, { type: "dismiss" }).error).toBeNull();
	});
});
