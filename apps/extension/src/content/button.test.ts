// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vite-plus/test";
import { buttonLabel, createSaveButton } from "./button";

// The build defines it; store builds are what matter here.
vi.stubGlobal("__DEV__", false);

const state = { button: true, floating: true, connected: true, saved: null, locale: "en" as const };

describe("buttonLabel", () => {
	it.each([
		[{ saved: null, locale: "en" as const }, "Save to Rezumi"],
		[{ saved: null, locale: "id" as const }, "Simpan ke Rezumi"],
		[{ saved: { id: "a", status: "saved" }, locale: "en" as const }, "Saved"],
		[{ saved: { id: "a", status: "applied" }, locale: "id" as const }, "Tersimpan · Dilamar"],
		[{ saved: { id: "a", status: "interview" }, locale: "en" as const }, "Saved · Interview"],
	])("%j → %s", (input, label) => {
		expect(buttonLabel(input)).toBe(label);
	});
});

describe("createSaveButton", () => {
	it("goes beside the board's buttons, or floats with a close button, and hides when turned off", () => {
		const onHide = vi.fn();
		const button = createSaveButton({ onPress: async () => true, onHide });
		const anchor = document.createElement("div");
		document.body.append(anchor);

		button.render(state, anchor);
		const host = anchor.querySelector("rezumi-save-button");
		expect(host).not.toBeNull();
		// Closed shadow root: the page cannot reach inside.
		expect(host?.shadowRoot).toBeNull();

		button.render(state, null);
		expect(document.body.querySelector(":scope > rezumi-save-button")?.hasAttribute("data-floating")).toBe(true);

		button.render({ ...state, floating: false }, null);
		expect(document.querySelector("rezumi-save-button")).toBeNull();

		button.render(state, anchor);
		button.render({ ...state, button: false }, anchor);
		expect(document.querySelector("rezumi-save-button")).toBeNull();
	});
});
