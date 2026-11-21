// The file source on a phone: a picked PDF, Word file, LinkedIn export or resume JSON, read into Profile data for
// review without saving a resume. PDF and Word go to the account's AI when it has a working connection (the request
// asks for consent first, as every AI call does); without one a PDF's text layer and every other format are read by
// the server (`profile.sources.file`), the way the web reads them in the browser. Word needs AI.
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { t } from "@lingui/core/macro";
import { File } from "expo-file-system";
import { profileFromResume } from "@rezumi/resume/profile";
import { client, rest } from "@/api/client";
import { ImportError, jsonImportFormat } from "@/features/documents/import-file";

/** A document from `expo-document-picker`, as far as reading it needs. */
export type PickedFile = { name: string; uri: string; size?: number; mimeType?: string; lastModified?: number };

const MAX_BYTES = 10 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ServerFormat = "PDF" | "LINKEDIN" | "JSON_RESUME" | "REACTIVE_RESUME" | "REACTIVE_RESUME_V4";

/** What the file holds, from its name and type (JSON from its shape). */
export function fileKind(file: Pick<PickedFile, "name" | "mimeType">): "pdf" | "docx" | "doc" | "zip" | "json" {
	const name = file.name.toLowerCase();
	if (name.endsWith(".pdf") || file.mimeType === "application/pdf") return "pdf";
	if (name.endsWith(".doc") || file.mimeType === "application/msword") return "doc";
	if (name.endsWith(".docx") || file.mimeType === DOCX) return "docx";
	if (name.endsWith(".zip") || file.mimeType === "application/zip") return "zip";
	return "json";
}

const fromResume = (data: Parameters<typeof profileFromResume>[0]): SourceResult => ({
	data: profileFromResume(data),
	photoUrl: null,
	notes: [],
});

async function readOnServer(body: Blob | File, name: string, format: ServerFormat): Promise<SourceResult> {
	const form = new FormData();
	form.append("file", body, name);
	form.append("format", format);
	const response = await rest("/profile/sources/file", { method: "POST", body: form });
	if (response.ok) return (await response.json()) as SourceResult;
	if (response.status === 413) throw new ImportError(t`The file is too large. Choose one up to 10 MB.`);
	if (response.status === 429) throw new ImportError(t`Too many files in a short time. Wait a minute, then try again.`);
	if (response.status === 401) throw new ImportError(t`Your session ended. Sign in again, then try again.`);
	if (response.status === 400)
		throw new ImportError(
			format === "PDF"
				? t`This PDF has no text to read (a scan or a picture). Try the Word version, or add LinkedIn or GitHub instead.`
				: t`This file couldn't be read as a resume.`,
		);
	throw new ImportError(t`Couldn't read the file. Try again.`);
}

/**
 * Reads `picked` into Profile data. `aiAvailable`: the account has a working AI connection this app may use (on iOS,
 * never Rezumi AI).
 */
export async function readResumeFile(picked: PickedFile, aiAvailable: boolean): Promise<SourceResult> {
	const file = new File(picked.uri);
	if ((picked.size ?? 0) > MAX_BYTES || file.size > MAX_BYTES)
		throw new ImportError(t`The file is too large. Choose one up to 10 MB.`);

	switch (fileKind(picked)) {
		case "doc":
			throw new ImportError(t`Open the file in Word and save it as .docx first.`);
		case "docx":
			if (!aiAvailable)
				throw new ImportError(
					t`Reading Word files needs an AI connection. Add one in Settings → AI providers, or choose a PDF instead.`,
				);
			return fromResume(
				await client.ai.parseDocx({ mediaType: DOCX, file: { name: picked.name, data: await file.base64() } }),
			);
		case "pdf":
			if (aiAvailable)
				return fromResume(await client.ai.parsePdf({ file: { name: picked.name, data: await file.base64() } }));
			return readOnServer(file, picked.name, "PDF");
		case "zip":
			return readOnServer(file, picked.name, "LINKEDIN");
		case "json": {
			let json: unknown;
			try {
				json = JSON.parse(await file.text());
			} catch {
				throw new ImportError(
					t`This file can't be read. Choose a PDF, Word file, LinkedIn export (.zip) or resume JSON.`,
				);
			}
			const format = jsonImportFormat(json);
			if (format === "LETTER")
				throw new ImportError(t`This is a cover letter. Add a resume or a LinkedIn export instead.`);
			if (!format || format === "PDF" || format === "DOCX" || format === "LINKEDIN")
				throw new ImportError(t`This JSON isn't a resume Rezumi can read.`);
			// An account archive wraps the resume in `data`: send the resume itself.
			const wrapped =
				json && typeof json === "object" && "data" in json && !("sections" in json) && !("metadata" in json);
			const body = wrapped
				? new Blob([JSON.stringify((json as { data: unknown }).data)], { type: "application/json" })
				: file;
			return readOnServer(body, picked.name, format);
		}
	}
}
