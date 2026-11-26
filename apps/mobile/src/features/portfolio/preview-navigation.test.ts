import { previewNavigation } from "./preview-navigation";

const base = "https://portfolio-preview.invalid/";
const page = {
	origin: "https://rezumi.example",
	homePath: "/delia",
	works: [{ id: "w1", path: "/delia/work/report" }],
};
const navigate = (url: string) => previewNavigation(url, base, page);

it("loads only the synthetic document and handles same-portfolio links in the preview", () => {
	expect(navigate(base)).toEqual({ kind: "load" });
	expect(navigate("about:blank")).toEqual({ kind: "load" });
	expect(navigate("https://rezumi.example/delia")).toEqual({ kind: "preview" });
	expect(navigate("https://rezumi.example/delia/work/report")).toEqual({ kind: "preview", workId: "w1" });
	expect(navigate(base + "elsewhere")).toEqual({ kind: "ignore" });
});

it("opens web, mail and telephone links externally, and suppresses private media addresses", () => {
	for (const url of ["https://example.test/", "mailto:review@example.test", "tel:+621234"]) {
		expect(navigate(url)).toEqual({ kind: "external", url });
	}
	expect(navigate("https://rezumi.example/api/uploads/owner/pictures/portfolio/image.webp?preview=signed")).toEqual({
		kind: "ignore",
	});
});

it("rejects file access, custom schemes, and URLs containing credentials", () => {
	for (const url of ["file:///tmp/file", "javascript:void(0)", "app.rezumi://home", "https://name@rezumi.example/"]) {
		expect(navigate(url)).toEqual({ kind: "ignore" });
	}
});
