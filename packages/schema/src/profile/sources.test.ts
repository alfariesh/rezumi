import { describe, expect, it } from "vite-plus/test";
import { gitHubLogin, linkedInProfileId, linkedInProfileUrl } from "./sources";

describe("linkedInProfileId", () => {
	it.each([
		["https://www.linkedin.com/in/rina-saraswati-123/", "rina-saraswati-123"],
		["linkedin.com/in/rina-saraswati", "rina-saraswati"],
		["http://id.linkedin.com/in/rina?trk=public", "rina"],
		["https://linkedin.com/in/jos%C3%A9-ortega", "josé-ortega"],
		["rina-saraswati", "rina-saraswati"],
	])("reads %s", (input, id) => {
		expect(linkedInProfileId(input)).toBe(id);
	});

	it.each([
		"https://example.com/in/rina",
		"https://linkedin.com.evil.example/in/rina",
		"https://www.linkedin.com/company/kopi-nusantara",
		"https://www.linkedin.com/in/rina/details/experience",
		"https://user:pass@www.linkedin.com/in/rina",
		"https://www.linkedin.com:8443/in/rina",
		"javascript:alert(1)",
		"ri",
		"rina saraswati",
		"",
	])("refuses %s", (input) => {
		expect(linkedInProfileId(input)).toBeNull();
	});

	it("writes the canonical address", () => {
		expect(linkedInProfileUrl("josé-ortega")).toBe("https://www.linkedin.com/in/jos%C3%A9-ortega");
	});
});

describe("gitHubLogin", () => {
	it.each([
		["octo-cat", "octo-cat"],
		["@octo-cat", "octo-cat"],
		["github.com/octo-cat", "octo-cat"],
		["https://github.com/octo-cat/", "octo-cat"],
	])("reads %s", (input, login) => {
		expect(gitHubLogin(input)).toBe(login);
	});

	it.each(["-octo", "octo cat", "https://gitlab.com/octo", "https://github.com/octo/repo", "a".repeat(40), ""])(
		"refuses %s",
		(input) => {
			expect(gitHubLogin(input)).toBeNull();
		},
	);
});
