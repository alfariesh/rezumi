import type { UIMessage } from "ai";
import { expect, it } from "vite-plus/test";
import { isBlankReply } from "./chat";

const message = (role: UIMessage["role"], parts: UIMessage["parts"]): UIMessage => ({ id: "m", role, parts });

it("treats a reply with nothing to show yet as blank, so the transcript leaves it out", () => {
	expect(isBlankReply(message("assistant", []))).toBe(true);
	expect(isBlankReply(message("assistant", [{ type: "step-start" }]))).toBe(true);
	expect(isBlankReply(message("assistant", [{ type: "reasoning", text: "" }]))).toBe(true);
	// Text that has started but has no words yet.
	expect(isBlankReply(message("assistant", [{ type: "step-start" }, { type: "text", text: "" }]))).toBe(true);
});

it("shows a reply once it has words or a tool call, and never hides the user's message", () => {
	expect(isBlankReply(message("assistant", [{ type: "step-start" }, { type: "text", text: "Hi" }]))).toBe(false);
	expect(
		isBlankReply(
			message("assistant", [
				{
					type: "tool-read_resume",
					toolCallId: "t",
					state: "input-available",
					input: {},
				} as UIMessage["parts"][number],
			]),
		),
	).toBe(false);
	expect(isBlankReply(message("user", []))).toBe(false);
});
