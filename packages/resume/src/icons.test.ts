import { describe, expect, it } from "vite-plus/test";
import { getBrandIcon, getNetworkIcon } from "./icons";

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
