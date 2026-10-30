// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { useState } from "react";
import { PromptBox } from "./prompt-box";

const onSubmit = vi.fn();
const onStop = vi.fn();

type HarnessProps = { streaming?: boolean; disabled?: boolean };

function Harness({ streaming = false, disabled = false }: HarnessProps) {
	const [value, setValue] = useState("");
	return (
		<PromptBox
			value={value}
			onValueChange={setValue}
			onSubmit={onSubmit}
			onStop={onStop}
			streaming={streaming}
			disabled={disabled}
			canSend={value.trim().length > 0}
			placeholder="Ask"
			label="Message"
			maxHeight={160}
		/>
	);
}

const box = () => screen.getByRole("textbox", { name: "Message" });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

beforeEach(() => {
	vi.clearAllMocks();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});
afterEach(cleanup);

it("sends on Enter and breaks the line on Shift+Enter", () => {
	render(<Harness />);
	type("hello");
	fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
	expect(onSubmit).not.toHaveBeenCalled();
	fireEvent.keyDown(box(), { key: "Enter" });
	expect(onSubmit).toHaveBeenCalledTimes(1);
});

it("doesn't send the Enter that confirms an IME conversion", () => {
	render(<Harness />);
	type("こんにちは");
	// Chrome and Firefox report the composing flag; Safari's confirming Enter arrives after compositionend as keyCode 229.
	fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
	fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });
	expect(onSubmit).not.toHaveBeenCalled();
});

it("stops a streaming reply on Escape and on the stop button, and keeps Enter from sending meanwhile", () => {
	render(<Harness streaming />);
	type("next question");
	fireEvent.keyDown(box(), { key: "Enter" });
	expect(onSubmit).not.toHaveBeenCalled();
	fireEvent.keyDown(box(), { key: "Escape" });
	expect(onStop).toHaveBeenCalledTimes(1);
	fireEvent.click(screen.getByRole("button", { name: "Stop" }));
	expect(onStop).toHaveBeenCalledTimes(2);
});

it("keeps the box typeable while a reply streams", () => {
	render(<Harness streaming />);
	expect((box() as HTMLTextAreaElement).disabled).toBe(false);
});

it("disables Send until there is text, and everything while disabled", () => {
	const { rerender } = render(<Harness />);
	const send = screen.getByRole("button", { name: "Send" });
	expect(send.hasAttribute("disabled") || send.getAttribute("aria-disabled") === "true").toBe(true);
	type("hello");
	expect(send.hasAttribute("disabled") || send.getAttribute("aria-disabled") === "true").toBe(false);
	rerender(<Harness disabled />);
	expect((box() as HTMLTextAreaElement).disabled).toBe(true);
});
