import { describe, expect, it } from "vite-plus/test";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { headingHintPlaces } from "./heading-hints";

const schema = getSchema([StarterKit]);
// Tests run without a DOM, so documents are built from nodes instead of HTML.
const content = (text: string) => (text ? [schema.text(text)] : []);
const h2 = (text: string) => schema.node("heading", { level: 2 }, content(text));
const p = (text = "") => schema.node("paragraph", null, content(text));
const doc = (...nodes: ReturnType<typeof p>[]) => schema.node("doc", null, nodes);
const hintFor = (heading: string) => (heading === "The problem" ? "What wasn't working?" : undefined);

describe("hints under headings", () => {
	it("goes in the empty paragraph right after a heading that has one", () => {
		const places = headingHintPlaces(doc(h2("The problem"), p(), h2("Other"), p()), hintFor);
		expect(places).toEqual([{ from: 13, to: 15, hint: "What wasn't working?" }]);
	});

	it("leaves written paragraphs, later paragraphs and paragraphs before the heading alone", () => {
		expect(headingHintPlaces(doc(h2("The problem"), p("Checkout failed.")), hintFor)).toEqual([]);
		expect(headingHintPlaces(doc(h2("The problem"), p("One"), p()), hintFor)).toEqual([]);
		expect(headingHintPlaces(doc(p(), h2("The problem")), hintFor)).toEqual([]);
	});
});
