// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { SelectField } from "./select-field";

afterEach(cleanup);

const options = [
	{ value: "", label: "None" },
	{ value: "a", label: "Alpha" },
	{ value: "b", label: "Beta", isDisabled: true },
];

/** The trigger's visible value text. */
const triggerText = () => screen.getByRole("button").textContent;

it("shows the label of the chosen option, including the empty one", () => {
	const { rerender } = render(<SelectField label="Resume" value="a" onChange={vi.fn()} options={options} />);
	expect(triggerText()).toContain("Alpha");
	rerender(<SelectField label="Resume" value="" onChange={vi.fn()} options={options} />);
	expect(triggerText()).toContain("None");
});

it("shows the placeholder when the value is empty and no option stands for it", () => {
	render(
		<SelectField aria-label="Pick" value="" placeholder="Choose one" onChange={vi.fn()} options={options.slice(1)} />,
	);
	expect(triggerText()).toContain("Choose one");
});

it("opens the list and reports a pick as a plain string, with the empty option as ''", () => {
	const onChange = vi.fn();
	render(<SelectField label="Resume" value="a" onChange={onChange} options={options} />);
	fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
	fireEvent.click(screen.getByRole("option", { name: "None" }));
	expect(onChange).toHaveBeenCalledWith("");
});

it("keeps disabled options out of reach", () => {
	render(<SelectField label="Resume" value="a" onChange={vi.fn()} options={options} />);
	fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
	expect(screen.getByRole("option", { name: "Beta" }).getAttribute("aria-disabled")).toBe("true");
});
