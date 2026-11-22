// Check's count on its mode comes from the resume layout, so it stays while another pane is open. The draft store is a
// small real zustand store; the checks are the real `@rezumi/resume/check`.
import { act, screen } from "@testing-library/react-native";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { CheckBadge } from "./check-badge";
import { slot } from "./slots";
import { renderScreen } from "@/test/render-screen";
import { Text } from "@/ui";

jest.mock("@/draft", () => {
	const { create } = require("zustand");
	const store = create(() => ({ document: null, data: null, status: "idle", locked: false }));
	return { useResumeStore: store };
});

const { useResumeStore } = jest.requireMock<{ useResumeStore: { setState: (next: object) => void } }>("@/draft");

function Badge() {
	const slots = slot.useSlot();
	return <Text testID="badge">{String(slots.badges?.check ?? "none")}</Text>;
}

describe("CheckBadge", () => {
	it("puts the open issues of the resume in the builder on Check's mode", async () => {
		await renderScreen(
			<slot.Provider>
				<CheckBadge id="r1" />
				<Badge />
			</slot.Provider>,
		);
		expect(screen.getByTestId("badge")).toHaveTextContent("0");

		// An almost empty resume: a name and nothing else leaves issues open.
		const data = produce(defaultResumeData, (draft) => {
			draft.basics.name = "Jordan Reyes";
		});
		await act(() => useResumeStore.setState({ document: { id: "r1" }, data }));
		const open = Number(screen.getByTestId("badge").props.children);
		expect(open).toBeGreaterThan(0);

		// Another resume in the store isn't this builder's.
		await act(() => useResumeStore.setState({ document: { id: "r2" } }));
		expect(screen.getByTestId("badge")).toHaveTextContent("0");
	});
});
