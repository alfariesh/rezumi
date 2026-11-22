// What onboarding says about each source: its name and icon, why a field can't run, why a read failed (with what to do
// next), and what a read found. The same sentences as the web's (apps/web/src/features/profile/sources/messages.ts).
import type { IconName } from "@/ui";
import type { PhotoSource, SourceId, SourceInputProblem } from "@rezumi/resume/profile-sources";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { sourceErrorCode, sourceFindings } from "@rezumi/resume/profile-sources";
import { ImportError } from "@/features/documents/import-file";
import { SECTION_TITLES } from "@/features/entries/fields";

export function sourceLabel(id: SourceId): string {
	switch (id) {
		case "file":
			return t`Resume file`;
		case "linkedin":
			return "LinkedIn";
		case "github":
			return "GitHub";
		case "website":
			return t`Your website`;
	}
}

export const SOURCE_ICONS: Record<SourceId, IconName> = {
	file: "file-text",
	linkedin: "linkedin-logo",
	github: "github-logo",
	website: "globe",
};

export const photoSourceLabel = (source: PhotoSource) => (source === "account" ? t`Your account` : sourceLabel(source));

export function inputProblemMessage(id: Exclude<SourceId, "file">, problem: SourceInputProblem): string {
	if (problem === "unconfirmed") return t`Confirm this is your own profile.`;
	switch (id) {
		case "linkedin":
			return t`Paste your profile link, like linkedin.com/in/your-name.`;
		case "github":
			return t`Enter a GitHub username, like octocat.`;
		case "website":
			return t`Enter your site's address, like yourname.com.`;
	}
}

/** The person declined the AI consent dialog: nothing was sent. */
export const isDeclined = (error: unknown) => error instanceof Error && error.name === "AbortError";

/** A request that never reached the server. */
const isOffline = (error: unknown) =>
	error instanceof TypeError || (error instanceof Error && /network request failed/i.test(error.message));

export function sourceErrorMessage(id: SourceId, error: unknown): string {
	if (isDeclined(error)) return t`You chose not to share it, so it wasn't read. Retry to choose again.`;
	// A file's own reader explains itself (a scan, a cover letter, a type it can't read).
	if (error instanceof ImportError) return error.message;

	switch (sourceErrorCode(error)) {
		case "SOURCE_UNAVAILABLE":
			return id === "linkedin"
				? t`LinkedIn import isn't available right now. Add your LinkedIn export or a resume file instead.`
				: t`This isn't available for your account.`;
		case "SOURCE_NOT_FOUND":
			if (id === "linkedin") return t`That profile wasn't found, or it isn't public. Check the link.`;
			if (id === "github") return t`There's no GitHub account with that username.`;
			return t`Nothing was found at that address. Check it and try again.`;
		case "SOURCE_INVALID":
			return inputProblemMessage(id === "file" ? "website" : id, "invalid");
		case "SOURCE_LIMIT":
			return id === "linkedin"
				? t`You've used today's LinkedIn imports. Try again tomorrow, or add your LinkedIn export.`
				: t`You've used this as often as you can today. Try again tomorrow.`;
		case "SOURCE_FAILED":
			return t`${sourceLabel(id)} didn't answer in time. Try again in a moment.`;
		case "INSUFFICIENT_CREDITS":
			return t`Not enough Rezumi AI credits to read it.`;
		case "AI_SOURCE_REQUIRED":
			return t`Add your own AI connection in Settings, or choose Rezumi AI.`;
		case "REZUMI_AI_UNAVAILABLE":
			return t`Rezumi AI isn't available right now. Use your own AI connection, or add a resume file instead.`;
		case "TOO_MANY_REQUESTS":
			return t`Too many tries in a short time. Wait a minute, then try again.`;
		case "BAD_GATEWAY":
			return t`Couldn't reach the AI provider. Try again in a moment.`;
		case "BAD_REQUEST":
			if (id === "file") return t`The file couldn't be read as a resume.`;
	}
	if (isOffline(error)) return t`You seem to be offline. Check your connection and try again.`;
	// The consent step's own refusals ("Choose a tested AI provider…") are written for people.
	if (error instanceof Error && !sourceErrorCode(error) && error.message) return error.message;
	return t`Couldn't read ${sourceLabel(id)}. Try again.`;
}

export function sourceNoteMessage(note: string): string | null {
	switch (note) {
		case "private-profile":
			return t`Most of this profile is private, so little came in.`;
		case "no-public-repos":
			return t`No public repositories of your own, so no projects came in.`;
		case "truncated":
			return t`The page is long, so only its first part was read.`;
		default:
			return null;
	}
}

/** "Found: Experience 4 · Skills 12 · Summary · Details 2", or that nothing came in. */
export function describeFindings(data: ProfileData): string {
	const findings = sourceFindings(data);
	const parts = [
		...findings.sections.map(({ type, count }) => `${i18n._(SECTION_TITLES[type])} ${count}`),
		...(findings.summary ? [i18n._(SECTION_TITLES.summary)] : []),
		...(findings.details > 0 ? [`${t`Details`} ${findings.details}`] : []),
	];
	if (parts.length === 0) return t`Nothing to add from here.`;
	const list = parts.join(" · ");
	return t`Found: ${list}`;
}
