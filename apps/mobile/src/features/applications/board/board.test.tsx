// The Board (plans/mobile Phase 10): phones page one stage at a time, every card moves without dragging (screen-reader
// actions and its menu), Closed asks for the reason, and a dropped card stays in its new column until the list has it.
import type { ApplicationSummary } from "@/features/applications/types";
import type { ReactNode } from "react";
import type { MeasureOnSuccessCallback } from "react-native";
import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react-native";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { View } from "react-native";
import { BoardBody } from "./board-view";
import { CloseReasonList } from "./close-reason-sheet";
import { useBoard } from "./use-board";
import { useApplicationMutations, useApplications } from "@/features/applications/queries";
import { useIsTablet } from "@/shell/use-is-tablet";
import { renderScreen } from "@/test/render-screen";

const mockOpen = jest.fn();
const mockMutate = jest.fn();

jest.mock("@/features/applications/queries", () => ({
	useApplications: jest.fn(),
	useApplicationMutations: jest.fn(),
}));
jest.mock("@/features/settings/queries", () => ({ useProfile: () => ({ data: { timezone: "America/Los_Angeles" } }) }));
jest.mock("@/features/applications/frame", () => ({ useOpenApplication: () => mockOpen }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: jest.fn(() => false) }));

const withLingui = ({ children }: { children: ReactNode }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>;

const application = (overrides: Partial<ApplicationSummary>) =>
	({
		id: "a",
		role: "Product designer",
		company: "Acme",
		location: null,
		status: "saved",
		closedReason: null,
		activity: [],
		appliedAt: new Date("2026-11-01T12:00:00Z"),
		updatedAt: new Date("2026-11-01T12:00:00Z"),
		createdAt: new Date("2026-11-01T12:00:00Z"),
		followUpAt: null,
		followUpNote: null,
		tags: [],
		contacts: [],
		resumeId: null,
		coverLetterId: null,
		source: null,
		...overrides,
	}) as ApplicationSummary;

let rows: ApplicationSummary[] = [];
const refetch = jest.fn();

beforeEach(() => {
	rows = [
		application({ id: "a", role: "Product designer", company: "Acme", status: "saved" }),
		application({ id: "b", role: "UX researcher", company: "Globex", status: "applied" }),
	];
	jest
		.mocked(useApplications)
		.mockImplementation(
			() =>
				({ data: rows, isPending: false, isError: false, refetch }) as unknown as ReturnType<typeof useApplications>,
		);
	jest
		.mocked(useApplicationMutations)
		.mockReturnValue({ update: { mutate: mockMutate } } as unknown as ReturnType<typeof useApplicationMutations>);
});
afterEach(() => jest.clearAllMocks());

describe("Board on a phone", () => {
	it("shows one stage at a time and pages to the next and back", async () => {
		await renderScreen(<BoardBody />);
		const pager = screen.getByTestId("board-pager");
		expect(within(pager).getByLabelText("Saved, 1 application. Stage 1 of 6")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Previous stage" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Next stage: Applied" }));
		expect(within(pager).getByLabelText("Applied, 1 application. Stage 2 of 6")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Closed" }));
		expect(within(pager).getByLabelText("Closed, 0 applications. Stage 6 of 6")).toBeOnTheScreen();
		expect(screen.getByText("Nothing in Closed")).toBeOnTheScreen();
	});

	it("gives every card screen-reader moves and opens it on tap", async () => {
		await renderScreen(<BoardBody />);
		const card = screen.getByLabelText(/^Product designer, Acme\./);
		const names = (card.props.accessibilityActions as { name: string; label: string }[]).map((action) => action.label);
		expect(names).toEqual(["Move to Applied", "Move to Screening", "Move to Interview", "Move to Offer", "Close…"]);
		await fireEvent.press(card);
		expect(mockOpen).toHaveBeenCalledWith("a");
		await fireEvent(card, "accessibilityAction", { nativeEvent: { actionName: "next" } });
		expect(mockMutate).toHaveBeenCalledWith({ id: "a", status: "applied" }, expect.anything());
		// The card shows in Applied at once, before the list has the move.
		await fireEvent.press(screen.getByRole("button", { name: "Next stage: Applied" }));
		expect(screen.getByLabelText("Applied, 2 applications. Stage 2 of 6")).toBeOnTheScreen();
	});

	it("asks for a reason before closing, from the card's actions", async () => {
		await renderScreen(<BoardBody />);
		const card = screen.getByLabelText(/^Product designer, Acme\./);
		await fireEvent(card, "accessibilityAction", { nativeEvent: { actionName: "move:closed" } });
		expect(mockMutate).not.toHaveBeenCalled();
	});

	it("moves a card from its menu", async () => {
		// A popover menu opens once it has measured its trigger; Jest's host views never call back on their own.
		const measure = jest
			.spyOn(View.prototype, "measure")
			.mockImplementation((...args: unknown[]) => (args[0] as MeasureOnSuccessCallback)(0, 0, 120, 48, 16, 120));
		await renderScreen(<BoardBody />);
		await fireEvent.press(screen.getByRole("button", { name: "Move Product designer" }));
		await fireEvent(screen.getByTestId("board-menu-a"), "layout", {
			nativeEvent: { layout: { x: 16, y: 180, width: 220, height: 240 } },
		});
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move to Screening" }));
		expect(mockMutate).toHaveBeenCalledWith({ id: "a", status: "screening" }, expect.anything());
		measure.mockRestore();
	});
});

describe("Board on a tablet", () => {
	it("shows every stage side by side", async () => {
		jest.mocked(useIsTablet).mockReturnValue(true);
		await renderScreen(<BoardBody />);
		expect(screen.queryByTestId("board-pager")).toBeNull();
		for (const stage of ["saved", "applied", "screening", "interview", "offer", "closed"])
			expect(screen.getByTestId(`board-column-${stage}`)).toBeOnTheScreen();
		expect(screen.getByLabelText("Applied, 1 application")).toBeOnTheScreen();
		jest.mocked(useIsTablet).mockReturnValue(false);
	});
});

describe("useBoard", () => {
	it("closes only with a reason", async () => {
		const { result } = await renderHook(() => useBoard(), { wrapper: withLingui });
		const first = rows[0];
		if (!first) throw new Error("fixture");
		await act(() => result.current.moveTo(first, "closed"));
		expect(result.current.closing?.id).toBe("a");
		expect(mockMutate).not.toHaveBeenCalled();
		await act(() => result.current.close("withdrew"));
		expect(mockMutate).toHaveBeenCalledWith({ id: "a", status: "closed", closedReason: "withdrew" }, expect.anything());
		expect(result.current.closing).toBeNull();
	});

	it("keeps a moved card in its new column until the list has it, and puts it back if the move fails", async () => {
		const { result, rerender } = await renderHook(() => useBoard(), { wrapper: withLingui });
		const moved = rows[1];
		if (!moved) throw new Error("fixture");
		await act(() => result.current.moveTo(moved, "screening"));
		const ids = (stage: string) =>
			result.current.columns.find((column) => column.status === stage)?.data.map((row) => row.id);
		expect(ids("screening")).toEqual(["b"]);
		expect(ids("applied")).toEqual([]);
		await rerender({});
		expect(ids("screening")).toEqual(["b"]);

		const callbacks = mockMutate.mock.calls[0]?.[1] as { onError: (error: unknown) => void };
		await act(() => callbacks.onError(new Error("offline")));
		expect(ids("applied")).toEqual(["b"]);

		await act(() => result.current.moveTo(moved, "screening"));
		rows = rows.map((row) => (row.id === "b" ? { ...row, status: "screening" } : row));
		await rerender({});
		expect(ids("screening")).toEqual(["b"]);
		expect(result.current.stageOf(moved)).toBe("applied");
	});

	it("offers Undo after a move, which puts the stage back", async () => {
		const { result } = await renderHook(() => useBoard(), { wrapper: withLingui });
		const moved = rows[1];
		if (!moved) throw new Error("fixture");
		await act(() => result.current.moveTo(moved, "interview"));
		const callbacks = mockMutate.mock.calls[0]?.[1] as { onSuccess: () => void };
		expect(callbacks.onSuccess).toEqual(expect.any(Function));
	});
});

describe("CloseReasonList", () => {
	it("closes with the reason picked", async () => {
		const onPick = jest.fn();
		const first = rows[0];
		if (!first) throw new Error("fixture");
		await renderScreen(<CloseReasonList application={first} onPick={onPick} />);
		expect(screen.getByText("Why did Product designer at Acme close?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Not selected"));
		await waitFor(() => expect(onPick).toHaveBeenCalledWith("not-selected"));
	});
});
