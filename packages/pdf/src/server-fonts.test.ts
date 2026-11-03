import { afterEach, expect, it, vi } from "vite-plus/test";
import { act } from "react";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { createResumePdfFile } from "./server";

// Stub only the PDF engine; exercise the real server entry, renderer and font fetch path.
vi.mock("@formepdf/core", () => ({
	prepareFont: undefined,
	renderSerializedDocWithLayout: () =>
		Promise.resolve({ pdf: new Uint8Array([1]), layout: { pages: [] }, warnings: [] }),
}));

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

it.each([
	[undefined, "https://cdn.jsdelivr.net/gh/bitmaks/cm-web-fonts@latest"],
	[" https://fonts.example.com/cm/// ", "https://fonts.example.com/cm"],
])("applies server font configuration %s through the rendering pipeline", async (baseUrl, expectedBase) => {
	vi.stubEnv("WEB_FONT_BASE_URL", baseUrl);
	const requested: string[] = [];
	vi.stubGlobal("fetch", (source: URL | string) => {
		requested.push(String(source));
		return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
	});
	const data = structuredClone(defaultResumeData);
	data.basics.name = "Font mirror";
	data.metadata.typography.body.fontFamily = "Computer Modern Bright";
	data.metadata.typography.heading.fontFamily = "Computer Modern Bright";
	const file = await act(() => createResumePdfFile({ data, filename: "mirror.pdf" }));
	expect(file.type).toBe("application/pdf");
	expect(requested).toContain(`${expectedBase}/font/Bright/cmunbmr.woff`);
	expect(
		requested.filter((url) => url.includes("/font/Bright/")).every((url) => url.startsWith(`${expectedBase}/`)),
	).toBe(true);
});

it("reads uploaded fonts from storage and never fetches a font address a document names", async () => {
	const requested: string[] = [];
	vi.stubGlobal("fetch", (source: URL | string) => {
		requested.push(String(source));
		return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
	});
	const read: string[] = [];
	const own = "https://rezumi.app/api/uploads/member/fonts/0b6c3f4e.ttf";
	const foreign = "https://internal.example/api/uploads/member/fonts/0b6c3f4e.ttf";
	const data = structuredClone(defaultResumeData);
	data.metadata.typography.body.fontFamily = "Brand Sans";
	data.metadata.typography.heading.fontFamily = "Other Sans";
	data.metadata.typography.customFonts = [
		{ family: "Brand Sans", weight: "400", italic: false, url: own },
		{ family: "Other Sans", weight: "400", italic: false, url: foreign },
	];
	const render = () =>
		act(() =>
			createResumePdfFile({
				data,
				filename: "fonts.pdf",
				uploadOrigin: "https://rezumi.app",
				readUploadedFont: (key) => {
					read.push(key);
					return Promise.resolve(new Uint8Array([0, 1, 0, 0]));
				},
			}),
		);
	// A font on another origin is refused, not fetched, so the export says which font failed.
	await expect(render()).rejects.toThrow("Fonts could not be loaded: Other Sans");
	data.metadata.typography.heading.fontFamily = "Brand Sans";
	await render();
	expect(read).toEqual(["uploads/member/fonts/0b6c3f4e.ttf", "uploads/member/fonts/0b6c3f4e.ttf"]);
	expect(requested.some((url) => url.includes("/api/uploads/"))).toBe(false);
});
