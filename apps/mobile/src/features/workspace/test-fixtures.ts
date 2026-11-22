// Fictional records for the workspace's component tests (no real people or companies).
import type { SavedItem } from "./queries";
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";

export const testNow = new Date("2026-11-22T09:00:00Z");

export function testInterview(extra: Partial<InterviewTimelineEntry> = {}): InterviewTimelineEntry {
	return {
		id: "interview-1",
		type: "interview",
		kind: "technical",
		at: new Date("2026-11-24T10:00:00.000Z"),
		durationMinutes: 45,
		location: "Video call",
		notes: "",
		participants: [{ name: "Rina Halim", role: "Design lead" }],
		...extra,
	} as unknown as InterviewTimelineEntry;
}

export function testApplication(extra: Record<string, unknown> = {}): Application {
	return {
		id: "app-1",
		company: "Northwind Studio",
		role: "Product designer",
		status: "saved",
		closedReason: null,
		location: "Remote",
		appliedAt: "2026-11-10T12:00:00.000Z",
		followUpAt: null,
		followUpNote: "",
		activity: [],
		contacts: [],
		tags: [],
		sourceUrl: null,
		createdAt: new Date("2026-11-10T12:00:00Z"),
		updatedAt: new Date("2026-11-10T12:00:00Z"),
		...extra,
	} as unknown as Application;
}

export function testSaved(data: SavedItem["data"], extra: Partial<SavedItem> = {}): SavedItem {
	return {
		id: `saved-${data.kind}`,
		applicationId: "app-1",
		interviewId: null,
		title: `A ${data.kind}`,
		data,
		evidence: { factIds: [], storyIds: [] },
		outdated: false,
		createdAt: new Date("2026-11-21T08:00:00Z"),
		...extra,
	} as unknown as SavedItem;
}
