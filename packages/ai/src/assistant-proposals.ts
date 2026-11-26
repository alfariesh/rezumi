import type { Proposal } from "@rezumi/resume/proposals";

type ProposeEditsOutput = {
	edits?: Array<Omit<Proposal, "source" | "target"> & { target: Record<string, string | undefined> }>;
	skipped?: unknown[];
};

export type ToolPart = {
	type: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

export const isProposeEdits = (part: { type: string; state?: unknown }): part is ToolPart =>
	part.type === "tool-propose_edits" && part.state === "output-available";

export const skippedCount = (part: ToolPart) => (part.output as ProposeEditsOutput | undefined)?.skipped?.length ?? 0;

/** The edits in a `propose_edits` result, with what the user has done with each since. */
export function toProposals(
	part: ToolPart,
	statuses: ReadonlyMap<string, Proposal["status"]>,
	locationOf?: (proposal: Proposal) => string | undefined,
): Proposal[] {
	const output = part.output as ProposeEditsOutput | undefined;
	return (output?.edits ?? []).map((edit) => {
		const proposal: Proposal = {
			...edit,
			target: {
				sectionId: edit.target.sectionId ?? "",
				field: edit.target.field ?? "",
				...(edit.target.itemId === undefined ? {} : { itemId: edit.target.itemId }),
				...(edit.target.roleId === undefined ? {} : { roleId: edit.target.roleId }),
			},
			status: statuses.get(edit.id) ?? edit.status,
			source: "assistant",
		};
		return { ...proposal, location: locationOf?.(proposal) ?? edit.location };
	});
}
