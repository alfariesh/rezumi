import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { SwitchRow } from "./switch";

describe("SwitchRow", () => {
	it("makes the whole row the switch, named by its label and described by its description", async () => {
		const onChange = vi.fn();
		render(
			<SwitchRow
				label="Visitors can download the PDF"
				description="Download is hidden when this is off."
				onChange={onChange}
			/>,
		);

		const row = screen.getByRole("switch", { name: "Visitors can download the PDF" });
		expect(row).toHaveAccessibleDescription("Download is hidden when this is off.");

		await userEvent.click(screen.getByText("Visitors can download the PDF"));
		expect(onChange).toHaveBeenCalledWith(true);
	});
});
