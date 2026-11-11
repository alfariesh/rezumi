// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import { SuggestInput } from "./suggest-input";

afterEach(cleanup);

type HarnessProps = { onKeyDown?: () => void };

function Harness({ onKeyDown }: HarnessProps) {
	const [value, setValue] = useState("");
	return (
		<SuggestInput
			aria-label="Source"
			value={value}
			onChange={setValue}
			suggestions={["LinkedIn", "Indeed"]}
			{...(onKeyDown ? { onKeyDown } : {})}
		/>
	);
}

it("takes any typed text, not only the suggestions", () => {
	render(<Harness />);
	const input = screen.getByRole("combobox") as HTMLInputElement;
	fireEvent.change(input, { target: { value: "A friend" } });
	expect(input.value).toBe("A friend");
});

it("lists the suggestions and writes a picked one into the field", () => {
	render(<Harness />);
	const input = screen.getByRole("combobox") as HTMLInputElement;
	fireEvent.focus(input);
	fireEvent.keyDown(input, { key: "ArrowDown" });
	fireEvent.click(screen.getByRole("option", { name: "Indeed" }));
	expect(input.value).toBe("Indeed");
});

it("passes the input's own key handler through", () => {
	const onKeyDown = vi.fn();
	render(<Harness onKeyDown={onKeyDown} />);
	fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
	expect(onKeyDown).toHaveBeenCalled();
});
