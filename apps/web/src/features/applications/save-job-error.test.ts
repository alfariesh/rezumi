import { beforeEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { saveJobErrorMessage } from "./save-job-error";

beforeEach(() => {
	i18n.load("en", {});
	i18n.activate("en");
});

describe("saveJobErrorMessage", () => {
	it("tells the person to pick another document when the chosen one is gone", () => {
		expect(saveJobErrorMessage(new ORPCError("NOT_FOUND", { data: { document: "resume" } }))).toBe(
			"The chosen resume or letter is no longer available. Choose another one, or None.",
		);
	});

	it("asks for a retry when the server was briefly unable to save", () => {
		expect(saveJobErrorMessage(new ORPCError("SERVICE_UNAVAILABLE"))).toBe(
			"Couldn't save the job just now. Your details are still here. Try again.",
		);
	});

	it("never stays silent: a bare server error still gets a message", () => {
		expect(saveJobErrorMessage(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(
			"Couldn't save the job. Your details are still here. Try again.",
		);
		expect(saveJobErrorMessage(new TypeError("Failed to fetch"))).toBe(
			"Couldn't save the job. Your details are still here. Try again.",
		);
	});
});
