// The letter adapter's save input (plans/mobile Phase 08): the letter's own sender details travel as `basics`, and
// linked details never do, so the server keeps reading them from the resume or the Profile.
import type { LetterDocument } from "./types";
import { letterAdapter } from "./adapters";

const mockUpdate = jest.fn((input: unknown) => Promise.resolve(input));

jest.mock("@/api/client", () => ({ client: { coverLetters: { update: (input: unknown) => mockUpdate(input) } } }));

const basics = {
	name: "Ada",
	headline: "",
	email: "",
	phone: "",
	location: "",
	website: { url: "", label: "" },
	customFields: [],
};
const letter = (overrides: Partial<LetterDocument>) =>
	({
		id: "letter-1",
		revision: 3,
		senderLinked: false,
		style: { basics, metadata: { template: "atlas", typography: {}, design: {}, page: {} } },
		...overrides,
	}) as unknown as LetterDocument;

const save = (document: LetterDocument, baseline: LetterDocument) =>
	letterAdapter.save(document, baseline, "session", false, "scope");

beforeEach(() => mockUpdate.mockClear());

it("sends the letter's own details when they change", async () => {
	const baseline = letter({});
	await save(letter({ style: { ...baseline.style, basics: { ...basics, name: "Ada King" } } }), baseline);
	expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ basics: { ...basics, name: "Ada King" } }));
});

it("never sends linked details", async () => {
	const baseline = letter({ senderLinked: true });
	await save(letter({ senderLinked: true, style: { ...baseline.style, basics: { ...basics, name: "X" } } }), baseline);
	expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty("basics");
});

it("leaves the details out when only the body changed", async () => {
	const baseline = letter({});
	await save({ ...baseline, content: "<p>Hello</p>" } as LetterDocument, baseline);
	expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty("basics");
});
