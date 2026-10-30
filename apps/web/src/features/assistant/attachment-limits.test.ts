import { beforeEach, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { checkUploads, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "./attachment-limits";

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

beforeEach(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

it("accepts files within the limits", () => {
	const result = checkUploads([file("a.txt", 10), file("b.pdf", MAX_ATTACHMENT_BYTES)], 0);
	expect(result.accepted.map((item) => item.name)).toEqual(["a.txt", "b.pdf"]);
	expect(result.problems).toEqual([]);
});

it("rejects empty and oversized files, naming each", () => {
	const result = checkUploads([file("empty.txt", 0), file("big.zip", MAX_ATTACHMENT_BYTES + 1), file("ok.txt", 1)], 0);
	expect(result.accepted.map((item) => item.name)).toEqual(["ok.txt"]);
	expect(result.problems).toEqual(["empty.txt is empty.", "big.zip is larger than 5 MB."]);
});

it("counts files already attached against the per-message limit", () => {
	const files = [file("a.txt", 1), file("b.txt", 1), file("c.txt", 1)];
	const result = checkUploads(files, MAX_ATTACHMENTS_PER_MESSAGE - 2);
	expect(result.accepted.map((item) => item.name)).toEqual(["a.txt", "b.txt"]);
	expect(result.problems).toHaveLength(1);
	expect(checkUploads(files, MAX_ATTACHMENTS_PER_MESSAGE).accepted).toEqual([]);
});
