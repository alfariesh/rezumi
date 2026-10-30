import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
	it("is named by its label and presses", async () => {
		const onPress = vi.fn();
		render(<IconButton icon="x" label="Close" onPress={onPress} />);
		await userEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onPress).toHaveBeenCalledOnce();
	});

	it("shows a spinner and ignores presses while pending", async () => {
		const onPress = vi.fn();
		render(<IconButton icon="x" label="Close" onPress={onPress} isPending />);
		const button = screen.getByRole("button", { name: "Close" });
		expect(button.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
		await userEvent.click(button);
		expect(onPress).not.toHaveBeenCalled();
	});
});
