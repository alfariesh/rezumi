import { beforeEach, describe, expect, it } from "vite-plus/test";
import { openCoachPanel, useCoachPanelStore } from "./store";

const state = () => useCoachPanelStore.getState();

beforeEach(() => {
	useCoachPanelStore.setState({ open: false, conversationId: undefined, offerIds: [], lastHref: undefined });
});

describe("coach panel store", () => {
	it("opens on the conversation shown last when nothing is named", () => {
		state().showConversation("thread-1");
		openCoachPanel();
		expect(state()).toMatchObject({ open: true, conversationId: "thread-1", offerIds: [] });
	});

	it("opens a named conversation, or a new one for null", () => {
		openCoachPanel({ conversationId: "thread-2", offerIds: ["offer-a"] });
		expect(state()).toMatchObject({ open: true, conversationId: "thread-2", offerIds: ["offer-a"] });
		openCoachPanel({ conversationId: null });
		expect(state()).toMatchObject({ conversationId: undefined, offerIds: [] });
	});

	it("starts a new conversation with offers as context", () => {
		state().showConversation("thread-1");
		openCoachPanel({ offerIds: ["offer-a", "offer-b"] });
		expect(state()).toMatchObject({ conversationId: undefined, offerIds: ["offer-a", "offer-b"] });
	});

	it("toggles and closes without forgetting the conversation", () => {
		openCoachPanel({ conversationId: "thread-3" });
		state().toggle();
		expect(state()).toMatchObject({ open: false, conversationId: "thread-3" });
	});
});
