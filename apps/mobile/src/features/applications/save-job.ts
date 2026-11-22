// Save a job's state and requests (the legacy add sheet's behaviour): read a link or pasted posting
// (`applications.ai.parsePosting`: a link uses the page's own job data without AI, pasted text needs an AI provider),
// fill empty fields from the description with AI, and create the application. One request at a time; closing the
// sheet cancels a read, and an answer for another account is dropped.
import type { RouterOutput } from "@/api/client";
import { ORPCError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import { parseDateOnly, todayKey } from "./date";
import { applicationError, saveJobError } from "./error";
import { useApplicationMutations } from "./queries";
import { client } from "@/api/client";
import { getServer, useSession } from "@/auth/session";

export type ParsedPosting = RouterOutput["applications"]["ai"]["parsePosting"];
export type SaveMode = "link" | "text";
export type SaveStage = "saved" | "applied" | "interview";
/** The server keeps up to this many characters of a description. */
export const MAX_DESCRIPTION = 20_000;

export const isLink = (value: string) => {
	try {
		const url = new URL(value.trim());
		return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
	} catch {
		return false;
	}
};

const emptyFields = {
	company: "",
	role: "",
	location: "",
	salary: "",
	source: "",
	sourceUrl: "",
	description: "",
	resumeId: "",
	letterId: "",
	notes: "",
};
export type SaveFields = typeof emptyFields;

export function useSaveJob(initialUrl = "") {
	const session = useSession();
	const { create } = useApplicationMutations();
	const [mode, setModeValue] = useState<SaveMode>("link");
	const [input, setInputValue] = useState(initialUrl);
	const [parsed, setParsed] = useState<ParsedPosting | null>(null);
	const [fields, setFields] = useState(emptyFields);
	const [stage, setStage] = useState<SaveStage>("saved");
	const [stageDate, setStageDate] = useState<string | null>(todayKey);
	const [tags, setTags] = useState<string[]>([]);
	const [reviewing, setReviewing] = useState(false);
	const [busy, setBusy] = useState<"read" | "fill" | "save" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const lock = useRef(false);
	const live = useRef(true);
	const controller = useRef<AbortController | null>(null);
	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
			controller.current?.abort();
		};
	}, []);

	const set = (key: keyof SaveFields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));
	const fillEmpty = (found: { company: string; role: string; location: string; salary: string }) =>
		setFields((current) => ({
			...current,
			company: current.company || found.company,
			role: current.role || found.role,
			location: current.location || found.location,
			salary: current.salary || found.salary,
		}));
	const current = (signal: AbortSignal) => live.current && !signal.aborted && getServer() === session.server;

	const run = async (action: NonNullable<typeof busy>, work: (signal: AbortSignal) => Promise<void>) => {
		if (lock.current) return;
		lock.current = true;
		setBusy(action);
		setError(null);
		const request = new AbortController();
		controller.current = request;
		try {
			await work(request.signal);
		} catch (cause) {
			if (!current(request.signal)) return;
			// An unreadable link: keep it as the posting link and let the person paste the text instead.
			if (action === "read" && mode === "link" && cause instanceof ORPCError && cause.code === "POSTING_UNREADABLE") {
				setFields((value) => ({ ...value, sourceUrl: input.trim(), description: "" }));
				setModeValue("text");
				setInputValue("");
				setParsed(null);
			}
			setError(action === "save" ? saveJobError(cause) : applicationError(cause));
		} finally {
			lock.current = false;
			if (live.current) setBusy(null);
		}
	};

	const validDate = stage === "saved" || (!!stageDate && !!parseDateOnly(stageDate));
	const validUrl = !fields.sourceUrl.trim() || isLink(fields.sourceUrl);
	const clipped = fields.description.length > MAX_DESCRIPTION;

	return {
		mode,
		input,
		parsed,
		fields,
		stage,
		stageDate,
		tags,
		reviewing,
		busy,
		error,
		validDate,
		validUrl,
		clipped,
		ready: Boolean(fields.company.trim() && fields.role.trim() && validDate && validUrl && !busy),
		dirty: Boolean(input.trim() || parsed || Object.values(fields).some(Boolean) || tags.length || stage !== "saved"),
		set,
		setStage,
		setStageDate,
		setTags,
		setMode: (next: SaveMode) => {
			if (lock.current) return;
			setModeValue(next);
			setInputValue("");
			setParsed(null);
			setError(null);
		},
		setInput: (value: string) => {
			setInputValue(value);
			setParsed(null);
			setError(null);
		},
		cancel: () => controller.current?.abort(),
		back: () => setReviewing(false),
		/** Fill in by hand: a pasted link becomes the posting link, pasted text the description. */
		byHand: () => {
			if (mode === "link" && isLink(input)) set("sourceUrl")(input.trim());
			if (mode === "text" && input.trim()) set("description")(input);
			setReviewing(true);
		},
		read: () =>
			void run("read", async (signal) => {
				const result = await client.applications.ai.parsePosting({ input: input.trim() }, { signal });
				if (!current(signal)) return;
				setParsed(result);
				fillEmpty(result);
				setFields((value) => ({
					...value,
					sourceUrl: result.sourceUrl ?? (mode === "link" ? input.trim() : value.sourceUrl),
					description: result.jobDescription,
				}));
				setReviewing(true);
			}),
		fill: () =>
			void run("fill", async (signal) => {
				const result = await client.applications.ai.autofill({ jobDescription: fields.description.trim() }, { signal });
				if (current(signal)) fillEmpty(result);
			}),
		save: (onSaved: (id: string) => void) =>
			void run("save", async (signal) => {
				const text = fields.description.slice(0, MAX_DESCRIPTION);
				const id = await create.mutateAsync({
					company: fields.company.trim(),
					role: fields.role.trim(),
					status: stage,
					location: fields.location.trim() || null,
					salary: fields.salary.trim() || null,
					source: fields.source.trim() || null,
					sourceUrl: fields.sourceUrl.trim() || null,
					jobDescription: text || null,
					requirements: parsed?.requirements ?? [],
					postingSource:
						(parsed
							? {
									...parsed.postingSource,
									...(clipped ? { truncated: true, completeness: "incomplete" as const } : {}),
								}
							: null) ??
						(text
							? {
									method: "paste",
									format: "text",
									truncated: clipped,
									completeness: clipped ? "incomplete" : "unknown",
								}
							: null),
					...(stage !== "saved" && stageDate ? { stageEnteredAt: stageDate } : {}),
					resumeId: fields.resumeId || null,
					coverLetterId: stage !== "saved" ? fields.letterId || null : null,
					tags,
					notes: fields.notes || null,
				});
				if (current(signal)) onSaved(id);
			}),
	};
}

export type SaveJob = ReturnType<typeof useSaveJob>;
