import type { PhotoSource, SourceId, SourceInputProblem } from "./model";
import type { IconName } from "@rezumi/ui/components/icon";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { getOrpcErrorMessage } from "@/libs/error-message";

/** Each source's name and icon, as the person knows it. */
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

/** Where an offered photo comes from, under its preview. */
export function photoSourceLabel(source: PhotoSource): string {
	return source === "account" ? t`Your account` : sourceLabel(source);
}

/** What's wrong with a field before anything runs, with the way to fix it. */
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

/** Why a source failed, worded for the person, with what to do next. */
export function sourceErrorMessage(id: SourceId, error: unknown): string {
	// A file's own reader explains itself (a scanned PDF, a cover letter, a type it can't read).
	if (id === "file" && error instanceof Error && !(error instanceof ORPCError) && !(error instanceof TypeError))
		return error.message;

	const code = error instanceof ORPCError ? error.code : null;
	switch (code) {
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
	}
	if (error instanceof TypeError) return t`You seem to be offline. Check your connection and try again.`;
	return getOrpcErrorMessage(error, {
		byCode: {
			...(id === "file" ? { BAD_REQUEST: t`The file couldn't be read as a resume.` } : {}),
			BAD_GATEWAY: t`Couldn't reach the AI provider. Try again in a moment.`,
		},
		// The website's AI refusals ("Test and turn on an AI provider…") are written for people and safe to show.
		allowServerMessage: id === "website",
		fallback: t`Couldn't read ${sourceLabel(id)}. Try again.`,
	});
}

/** A source's notes about its result (`SOURCE_NOTES`); codes this app doesn't know are left out. */
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
