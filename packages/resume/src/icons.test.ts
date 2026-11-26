import { describe, expect, it } from "vite-plus/test";
import { getBrandIcon, getContactIcon, getNetworkIcon } from "./icons";

describe("getNetworkIcon", () => {
	it("matches Twitter and X variants", () => {
		expect(getNetworkIcon("twitter")).toBe("new-twitter");
		expect(getNetworkIcon("x")).toBe("new-twitter");
		expect(getNetworkIcon("x.com")).toBe("new-twitter");
	});

	it("matches a network named inside a longer label", () => {
		expect(getNetworkIcon("My GitHub Profile")).toBe("github");
	});

	it.each(["Xing", "Dropbox", "Stack Exchange", "Mixcloud", "Fox"])("does not give %s the X logo", (network) => {
		expect(getNetworkIcon(network)).not.toBe("new-twitter");
	});
});

describe("getBrandIcon", () => {
	it.each([
		["React", "react"],
		["react.js", "react"],
		["MS Excel", "office-365"],
		["Adobe Photoshop", "adobe-photoshop"],
		["TypeScript", "typescript-01"],
		["C++", "c++"],
	])("gives %s its logo", (text, icon) => {
		expect(getBrandIcon(text)).toBe(icon);
	});

	it.each(["Leadership", "Reactivity", "Excellent communication"])("gives %s none", (text) => {
		expect(getBrandIcon(text)).toBe("");
	});
});

it("gives a network without a logo no icon", () => {
	expect(getNetworkIcon("Personal blog")).toBe("");
});

describe("getContactIcon", () => {
	it("gives a network's logo for its address", () => {
		expect(getContactIcon("github.com/dkowalski-dev")).toBe("github");
		expect(getContactIcon("https://www.linkedin.com/in/someone")).toBe("linkedin-02");
	});

	it("gives a globe for any other web address", () => {
		expect(getContactIcon("itch.io/dkowalski")).toBe("globe-02");
		expect(getContactIcon("https://portfolio.example.com")).toBe("globe-02");
	});

	it("gives no icon for plain text", () => {
		expect(getContactIcon("")).toBe("");
		expect(getContactIcon("Indonesian, English")).toBe("");
		expect(getContactIcon("Open to relocation.")).toBe("");
	});
});
