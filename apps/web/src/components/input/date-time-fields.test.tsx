// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import { DatePickerField, TimePickerField } from "./date-time-fields";

afterEach(cleanup);

/** Types digits into a date or time segment, as the keyboard does. */
function typeInto(segment: HTMLElement, digits: string) {
	fireEvent.focus(segment);
	for (const data of digits) {
		fireEvent(
			segment,
			new InputEvent("beforeinput", { data, inputType: "insertText", bubbles: true, cancelable: true }),
		);
	}
}

type HarnessProps = { onValue: (value: string) => void };

/** Holds the value the way a form does, so each completed edit comes back as the field's value. */
function DateHarness({ onValue }: HarnessProps) {
	const [value, setValue] = useState("");
	return (
		<DatePickerField
			label="Date"
			value={value}
			onChange={(next) => {
				setValue(next);
				onValue(next);
			}}
		/>
	);
}

function TimeHarness({ onValue }: HarnessProps) {
	const [value, setValue] = useState("");
	return (
		<TimePickerField
			label="Time"
			value={value}
			onChange={(next) => {
				setValue(next);
				onValue(next);
			}}
		/>
	);
}

it("shows an ISO date in the date segments", () => {
	render(<DatePickerField label="Application date" value="2026-11-10" onChange={vi.fn()} />);
	expect(screen.getByRole("group", { name: "Application date" }).textContent).toContain("11/10/2026");
});

it("shows an empty field for an empty or unreadable value instead of throwing", () => {
	render(<DatePickerField aria-label="Empty" value="" onChange={vi.fn()} />);
	render(<DatePickerField aria-label="Broken" value="not a date" onChange={vi.fn()} />);
	for (const name of ["Empty", "Broken"]) {
		expect(screen.getByRole("group", { name }).textContent).toContain("mm/dd/yyyy");
	}
});

it("reports a completed date as an ISO string", () => {
	const onChange = vi.fn();
	render(<DateHarness onValue={onChange} />);
	const date = within(screen.getAllByRole("group", { name: "Date" }).at(0) as HTMLElement);
	typeInto(date.getByRole("spinbutton", { name: /^month/ }), "3");
	typeInto(date.getByRole("spinbutton", { name: /^day/ }), "28");
	typeInto(date.getByRole("spinbutton", { name: /^year/ }), "2027");
	expect(onChange).toHaveBeenLastCalledWith("2027-03-28");
});

it("names the calendar after the field's label", () => {
	render(<DatePickerField label="Follow-up date" value="2026-11-10" onChange={vi.fn()} />);
	fireEvent.click(screen.getByRole("button", { name: /calendar/i }));
	const calendar = screen.getByRole("application");
	const names = (calendar.getAttribute("aria-labelledby") ?? "")
		.split(" ")
		.map((id) => document.getElementById(id)?.textContent);
	expect(names).toContain("Follow-up date");
});

it("calls onBlur when focus leaves the date field", () => {
	const onBlur = vi.fn();
	render(<DatePickerField label="Date" value="2026-11-10" onChange={vi.fn()} onBlur={onBlur} />);
	const month = within(screen.getAllByRole("group", { name: "Date" }).at(0) as HTMLElement).getByRole("spinbutton", {
		name: /^month/,
	});
	act(() => month.focus());
	act(() => month.blur());
	expect(onBlur).toHaveBeenCalled();
});

it("reports a completed time as HH:mm, converting the 12-hour clock", () => {
	const onChange = vi.fn();
	render(<TimeHarness onValue={onChange} />);
	const time = within(screen.getAllByRole("group", { name: "Time" }).at(0) as HTMLElement);
	typeInto(time.getByRole("spinbutton", { name: /^hour/ }), "09");
	typeInto(time.getByRole("spinbutton", { name: /^minute/ }), "05");
	typeInto(time.getByRole("spinbutton", { name: /^AM\/PM/ }), "P");
	expect(onChange).toHaveBeenLastCalledWith("21:05");
});
