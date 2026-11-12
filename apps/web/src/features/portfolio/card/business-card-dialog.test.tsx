// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { BusinessCardDialog } from "./business-card-dialog";

const mocks = vi.hoisted(() => ({ saveFile: vi.fn() }));
vi.mock("../save-file", () => ({ saveFile: mocks.saveFile }));

i18n.loadAndActivate({ locale: "en", messages: {} });

describe("the business card", () => {
	it("shows the card with a QR code to the tagged address, and saves the code as SVG and PNG", async () => {
		HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
			callback(new Blob(["png"], { type: "image/png" }));
		};
		render(
			<I18nProvider i18n={i18n}>
				<BusinessCardDialog
					name="Nadia Rahmawati"
					headline="Product Manager"
					username="nadia"
					pageUrl="https://rezumi.app/nadia"
					onClose={() => {}}
				/>
			</I18nProvider>,
		);

		expect(await screen.findByRole("dialog", { name: "Business card" })).toBeTruthy();
		expect(screen.getByText("Nadia Rahmawati")).toBeTruthy();
		expect(screen.getByText("rezumi.app/nadia")).toBeTruthy();
		expect(screen.getByTitle("QR code for rezumi.app/nadia")).toBeTruthy();

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Download QR (SVG)" }));
		const [svg, svgName] = mocks.saveFile.mock.calls.at(-1) ?? [];
		expect(svgName).toBe("nadia-qr.svg");
		expect((svg as Blob).type).toBe("image/svg+xml");
		expect(await (svg as Blob).text()).toContain("<svg");

		await user.click(screen.getByRole("button", { name: "Download QR (PNG)" }));
		expect(mocks.saveFile.mock.calls.at(-1)?.[1]).toBe("nadia-qr.png");
	});
});
