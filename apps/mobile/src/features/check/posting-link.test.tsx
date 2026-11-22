// Saving a pasted posting as an application and linking the resume to it: a failed link is retried without saving
// a second application, and a link under way finishes (and refreshes the draft) even after the screen closes.
import { act, fireEvent, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { SavePostingSheet } from "./save-posting-sheet";
import { useLinkApplication } from "./use-link-application";
import { renderScreen } from "@/test/render-screen";

const mock = {
	create: jest.fn<Promise<string>, [object]>(),
	linkApplication: jest.fn<Promise<void>, [object]>(),
	refresh: jest.fn(async () => undefined),
	blur: jest.fn(async () => undefined),
	toast: jest.fn(),
};

jest.mock("@/api/client", () => ({
	client: { documents: { linkApplication: (input: object) => mock.linkApplication(input) } },
	orpc: {},
}));
jest.mock("@/draft/runtime", () => ({ resume: { refresh: () => mock.refresh(), blur: () => mock.blur() } }));
jest.mock("@/draft", () => {
	const state = {
		document: { id: "r1" },
		locked: false,
		conflict: null,
		status: "saved",
		flush: async () => undefined,
	};
	return { useResumeStore: { getState: () => state } };
});
jest.mock("@/features/applications/queries", () => ({
	useInvalidateApplications: () => jest.fn(async () => undefined),
	useApplicationMutations: () => ({ create: { mutateAsync: (input: object) => mock.create(input), isPending: false } }),
}));
jest.mock("@/ui", () => {
	const { createElement } = require("react");
	const { View } = require("react-native");
	return {
		...jest.requireActual<object>("@/ui"),
		showToast: (options: object) => mock.toast(options),
		Sheet: (props: { isOpen: boolean; children?: unknown; footer?: unknown }) =>
			props.isOpen ? createElement(View, null, props.children, props.footer) : null,
	};
});

beforeEach(() => jest.clearAllMocks());

describe("Save as application", () => {
	it("saves once and, when linking fails, retries only the link", async () => {
		mock.create.mockResolvedValue("app-1");
		const onSaved = jest.fn<Promise<boolean>, [string]>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const onOpenChange = jest.fn();
		await renderScreen(
			<SavePostingSheet resumeId="r1" isOpen onOpenChange={onOpenChange} posting="Designer role" onSaved={onSaved} />,
		);
		await act(async () => {
			await fireEvent.changeText(screen.getByLabelText("Company"), "Studio Kettle");
			await fireEvent.changeText(screen.getByLabelText("Role"), "Designer");
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("save-posting"));
		});
		expect(mock.create).toHaveBeenCalledWith({
			company: "Studio Kettle",
			role: "Designer",
			jobDescription: "Designer role",
			resumeId: "r1",
		});
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByText("Link the application")).toBeTruthy();

		await act(async () => {
			await fireEvent.press(screen.getByTestId("save-posting"));
		});
		expect(mock.create).toHaveBeenCalledTimes(1);
		expect(onSaved.mock.calls).toEqual([["app-1"], ["app-1"]]);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

type Link = (applicationId: string | null) => Promise<boolean>;
type LinkHarnessProps = { onLink: (link: Link) => void };

/** Hands the hook's `link` to the test. */
function LinkHarness({ onLink }: LinkHarnessProps) {
	const { link } = useLinkApplication("r1");
	useEffect(() => onLink(link));
	return null;
}

describe("Linking an application", () => {
	it("finishes and refreshes the draft when the screen closes mid-link", async () => {
		let finish = () => undefined as void;
		mock.linkApplication.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
		);
		const onLink = jest.fn<void, [Link]>();
		const view = await renderScreen(<LinkHarness onLink={onLink} />);
		let linked: Promise<boolean> | undefined;
		await act(async () => {
			linked = onLink.mock.calls.at(-1)?.[0]("app-1");
		});
		await view.unmount();
		await act(async () => finish());
		await expect(linked).resolves.toBe(true);
		expect(mock.linkApplication).toHaveBeenCalledWith({ type: "resume", id: "r1", applicationId: "app-1" });
		expect(mock.refresh).toHaveBeenCalled();
		expect(mock.toast).not.toHaveBeenCalled();
	});
});
