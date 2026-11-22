// What every workspace part receives, which part opens by default, and the workspace's links.
import type { SavedItem } from "./queries";
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import type { WorkspaceTab } from "@rezumi/schema/career";
import { interviewEnded } from "@rezumi/career/applications";
import { currentInterview } from "@rezumi/career/workspace";
import { WORKSPACE_TABS } from "@rezumi/schema/career";
import { routes } from "@/routes";

export type WorkspaceSearch = { version?: string | undefined; speak?: boolean | undefined; story?: string | undefined };

export type WorkspacePartProps = {
	application: Application;
	/** A saved item opened from Saved: the part shows it read-only with "Back to current". */
	version: SavedItem | undefined;
	/** The next interview still to come, or the most recent one if it just ended. */
	interview: InterviewTimelineEntry | undefined;
	/** Practice: open with Speak selected. */
	speak: boolean;
	/** Practice: a story from the Profile to practise. */
	story: string | undefined;
	now: Date;
	go: (tab: WorkspaceTab, search?: WorkspaceSearch) => void;
	/** Opens the interview editor for a new round. */
	addInterview: () => void;
};

export const isWorkspaceTab = (tab: string | undefined): tab is WorkspaceTab =>
	(WORKSPACE_TABS as readonly string[]).includes(tab ?? "");

/** The part a workspace opens on without one named (web `defaultTab`): where the application stands. */
export function defaultPart(application: Pick<Application, "status" | "activity">, now: Date): WorkspaceTab {
	const ended = interviewEnded(currentInterview(application.activity, now), now);
	switch (application.status) {
		case "saved":
			return "fit";
		case "applied":
			return "apply";
		case "screening":
		case "interview":
			return ended ? "debrief" : "prepare";
		case "offer":
			return "messages";
		case "closed":
			return "saved";
	}
}

/** `/applications/<id>/<part>?version=…&speak=1&story=…` */
export function workspaceHref(id: string, tab: WorkspaceTab, search: WorkspaceSearch = {}) {
	const query = [
		search.version ? `version=${encodeURIComponent(search.version)}` : "",
		search.speak ? "speak=1" : "",
		search.story ? `story=${encodeURIComponent(search.story)}` : "",
	].filter(Boolean);
	return `${routes.application(id, tab)}${query.length > 0 ? `?${query.join("&")}` : ""}` as const;
}

/** The saved kind each part opens read-only (`?version=`); Saved opens none. */
export const archiveKinds = {
	fit: "fit",
	apply: "answers",
	prepare: "briefing",
	practise: "practice",
	debrief: "debrief",
	messages: "reply",
	saved: null,
} satisfies Record<WorkspaceTab, SavedItem["data"]["kind"] | null>;
