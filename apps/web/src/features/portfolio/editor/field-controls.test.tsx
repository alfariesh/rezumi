// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ChoiceSelect, SortableCard, SortableList, TextInput } from "./fields";

i18n.loadAndActivate({ locale: "en", messages: {} });

const renderInI18n = (ui: React.ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);

describe("a text field", () => {
	it("draws its icon at the start of a one-line field and pads the input for it", () => {
		const { container } = renderInI18n(
			<TextInput label="Title" icon="text-t" value="" maxLength={80} onChange={() => undefined} />,
		);
		expect(container.querySelector('[data-slot="icon"]')).not.toBeNull();
		expect(screen.getByRole("textbox", { name: "Title" }).className).toContain("ps-9");
	});

	it("has no icon in a text area, which grows with its text instead", () => {
		const { container } = renderInI18n(
			<TextInput label="Greeting" multiline icon="text-t" value="" maxLength={80} onChange={() => undefined} />,
		);
		expect(container.querySelector('[data-slot="icon"]')).toBeNull();
		const field = screen.getByRole("textbox", { name: "Greeting" });
		expect(field.tagName).toBe("TEXTAREA");
		expect(field.className).not.toMatch(/min-h-|ps-9/);
	});

	it("says what is wrong under a field it marks invalid", () => {
		renderInI18n(
			<TextInput
				label="Phone"
				value="1"
				maxLength={20}
				errorMessage="Enter 7 to 15 digits."
				onChange={() => undefined}
			/>,
		);
		expect(screen.getByRole("textbox", { name: "Phone" })).toBeInvalid();
		expect(screen.getByText("Enter 7 to 15 digits.")).toBeInTheDocument();
	});
});

describe("a pick-one cell", () => {
	it("names itself with its label and shows the chosen option, and a warning only when there is one", () => {
		const { rerender } = renderInI18n(
			<ChoiceSelect
				label="Order button"
				value="contact"
				options={[
					{ id: "contact", label: "Go to Contact" },
					{ id: "link", label: "A link" },
				]}
				onChange={() => undefined}
			/>,
		);
		expect(screen.getByRole("button", { name: /Order button/ })).toHaveTextContent("Go to Contact");
		expect(screen.queryByText("Add your number first.")).toBeNull();

		rerender(
			<I18nProvider i18n={i18n}>
				<ChoiceSelect
					label="Order button"
					value="contact"
					options={[{ id: "contact", label: "Go to Contact" }]}
					warning="Add your number first."
					onChange={() => undefined}
				/>
			</I18nProvider>,
		);
		expect(screen.getByText("Add your number first.")).toBeInTheDocument();
	});
});

describe("a draggable card", () => {
	it("offers a handle named after its item, and removes it with its own button", async () => {
		const onRemove = vi.fn();
		renderInI18n(
			<SortableList ids={["a"]} onMove={() => undefined}>
				<SortableCard id="a" list="items" index={0} name="Branding" onRemove={onRemove}>
					<p>Fields</p>
				</SortableCard>
			</SortableList>,
		);

		expect(screen.getByRole("button", { name: "Reorder Branding" })).toBeInTheDocument();
		expect(screen.getByText("Fields")).toBeInTheDocument();
		// There are no move up or down buttons: dragging is the only way to reorder.
		expect(screen.queryByRole("button", { name: /Move .* (up|down)/ })).toBeNull();

		await userEvent.click(screen.getByRole("button", { name: "Remove Branding" }));
		expect(onRemove).toHaveBeenCalledOnce();
	});
});
