import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Toaster, toast } from "./toast";

afterEach(() => {
	act(() => toast.close("sign-in"));
});

describe("toast", () => {
	it("updates the toast on screen when added again with the same id", async () => {
		render(<Toaster closeLabel="Close" />);

		act(() => {
			toast.add({ type: "loading", description: "Signing in…", id: "sign-in" });
		});
		expect(await screen.findByText("Signing in…")).toBeInTheDocument();

		act(() => {
			toast.add({ type: "error", description: "Wrong password", id: "sign-in" });
		});
		expect(await screen.findByText("Wrong password")).toBeInTheDocument();
		expect(screen.queryByText("Signing in…")).not.toBeInTheDocument();
	});

	it("runs the action and names the close button", async () => {
		const undo = vi.fn();
		render(<Toaster closeLabel="Close notification" />);

		act(() => {
			toast.add({ description: "Moved to trash", actionProps: { children: "Undo", onClick: undo }, id: "sign-in" });
		});
		await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
		expect(undo).toHaveBeenCalledOnce();
		expect(screen.getAllByRole("button", { name: "Close notification" }).length).toBeGreaterThan(0);
	});
});
