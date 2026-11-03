import { describe, expect, it } from "vite-plus/test";
import { coverLetterDto } from "./cover-letter";

describe("cover letter DTO template input", () => {
	const create = { name: "Letter" };
	const update = { id: "letter-1", expectedRevision: 1 };

	it("takes a template as it is", () => {
		expect(coverLetterDto.create.input.parse({ ...create, template: "linen" }).template).toBe("linen");
		expect(coverLetterDto.update.input.parse({ ...update, template: "senja" }).template).toBe("senja");
	});

	it("saves a former template ID as its successor, for older clients and agents", () => {
		expect(coverLetterDto.create.input.parse({ ...create, template: "onyx" }).template).toBe("meridian");
		expect(coverLetterDto.create.input.parse({ ...create, template: "glalie" }).template).toBe("kirana");
		expect(coverLetterDto.update.input.parse({ ...update, template: "ditgar" }).template).toBe("purnama");
	});

	it("rejects an ID that was never a template", () => {
		expect(coverLetterDto.create.input.safeParse({ ...create, template: "nosepass" }).success).toBe(false);
		expect(coverLetterDto.update.input.safeParse({ ...update, template: "" }).success).toBe(false);
	});

	it("leaves the template out when none is given", () => {
		expect(coverLetterDto.create.input.parse(create).template).toBeUndefined();
	});
});
