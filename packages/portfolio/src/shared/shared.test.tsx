import type { PortfolioView, PortfolioViewSection } from "../view";
import type { RenderContext } from "./context";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { fullPortfolioData, fullTestResume, renderTestPage, testImage } from "../fixtures.test-helpers";
import { RenderContextValue } from "./context";
import { IntroChips, introLocation, useIntroBackground } from "./intro";
import { ServiceList, TestimonialList } from "./offers";
import { WorkDetails } from "./parts";
import { ResumeSectionBody } from "./resume";
import { Navigation } from "./shell";

type Draw = { data?: PortfolioDataInput; imageUrl?: (src: string) => string | undefined };

/** Renders a shared part inside a page's render context, built from test data. */
function draw(
	part: (view: PortfolioView) => ReactNode,
	{ data = fullPortfolioData, imageUrl = (src) => src }: Draw = {},
) {
	const { view, messages } = renderTestPage(data, { resume: fullTestResume() });
	const context: RenderContext = {
		view,
		messages,
		locale: view.locale,
		icon: () => null,
		imageUrl,
		nextId: (prefix) => `${prefix}-1`,
	};
	return renderToStaticMarkup(<RenderContextValue.Provider value={context}>{part(view)}</RenderContextValue.Provider>);
}

const sectionOf = <K extends PortfolioViewSection["kind"]>(view: PortfolioView, kind: K) => {
	const found = view.sections.find(
		(section): section is Extract<PortfolioViewSection, { kind: K }> => section.kind === kind,
	);
	if (!found) throw new Error(`No ${kind} section.`);
	return found;
};

function Background() {
	return <div {...useIntroBackground()} />;
}

describe("the intro's background", () => {
	const withBackground = (background: NonNullable<PortfolioDataInput["hero"]>["background"]) => ({
		...fullPortfolioData,
		hero: { ...fullPortfolioData.hero, background },
	});

	it("names its kind, and passes a picture's address to the CSS as a quoted, encoded URL", () => {
		expect(draw(() => <Background />)).toBe('<div data-bg="plain"></div>');
		expect(draw(() => <Background />, { data: withBackground({ kind: "pattern" }) })).toBe(
			'<div data-bg="pattern"></div>',
		);
		const image = withBackground({ kind: "image", image: testImage("hero-bg") });
		expect(draw(() => <Background />, { data: image, imageUrl: (src) => `${src}?x="y"` })).toBe(
			'<div data-bg="image" style="--pf-hero-image:url(&quot;https://rezumi.example/uploads/user-1/pictures/portfolio/hero-bg.webp?x=%22y%22&quot;)"></div>',
		);
	});

	it("leaves the intro plain when the page may not load its picture", () => {
		const image = withBackground({ kind: "image", image: testImage("hero-bg") });
		expect(draw(() => <Background />, { data: image, imageUrl: () => undefined })).toBe('<div data-bg="plain"></div>');
	});
});

describe("the intro's chips", () => {
	it("shows the place and the availability, in the order the theme reads them, and nothing without either", () => {
		expect(draw(() => <IntroChips location="" availability={null} />)).toBe("");
		const place = draw((view) => <IntroChips location={introLocation(view)} availability="Open to work" />);
		expect(place).toMatch(
			/^<ul class="pf-chips"><li class="pf-chip"><svg[^]*<\/svg>Jakarta, Indonesia<\/li><li class="pf-chip pf-chip--open">Open to work<\/li><\/ul>$/,
		);
		const first = draw(() => <IntroChips location="Bali" availability="Open to work" availabilityFirst />);
		expect(first.indexOf("pf-chip--open")).toBeLessThan(first.indexOf("Bali"));
	});
});

describe("services", () => {
	const data: PortfolioDataInput = {
		...fullPortfolioData,
		services: {
			items: [
				{ id: "s1", title: "Audit", description: "Fixes.", price: "Rp7.5m", cta: { kind: "contact" } },
				{ id: "s2", title: "Workshop", description: "", price: "Rp2m", cta: { kind: "whatsapp" } },
			],
		},
		contact: { ...fullPortfolioData.contact, whatsapp: { show: false, number: "" } },
	};

	it("puts the price beside the title and the order button last, by default", () => {
		const html = draw(
			(view) => <ServiceList section={sectionOf(view, "services")} className="x-services" variant="list" />,
			{ data },
		);
		expect(html).toContain(
			'<ul class="x-services" data-variant="list"><li class="pf-service"><div class="pf-service__head"><h3>Audit</h3><span class="pf-service__price">Rp7.5m</span></div><p class="pf-service__desc">Fixes.</p><a class="pf-service__cta" href="#contact">',
		);
		// No WhatsApp number: the second service has no button.
		expect(html).toContain('<h3>Workshop</h3><span class="pf-service__price">Rp2m</span></div></li>');
	});

	it("gives a theme its own classes, and a footer row for the button and, in cards, the price", () => {
		const props = { className: "mz-services", classNames: { item: "pf-service mz-service", head: "mz-service__head" } };
		const cards = draw(
			(view) => (
				<ServiceList
					section={sectionOf(view, "services")}
					{...props}
					variant="cards"
					foot={{ className: "mz-service__foot", price: true }}
				/>
			),
			{ data },
		);
		expect(cards).toContain(
			'<li class="pf-service mz-service"><div class="mz-service__head"><h3>Audit</h3></div><p class="pf-service__desc">Fixes.</p><div class="mz-service__foot"><span class="pf-service__price">Rp7.5m</span><a class="pf-service__cta"',
		);
		expect(cards).toContain(
			'<h3>Workshop</h3></div><div class="mz-service__foot"><span class="pf-service__price">Rp2m</span></div>',
		);
		const list = draw(
			(view) => (
				<ServiceList
					section={sectionOf(view, "services")}
					{...props}
					variant="list"
					foot={{ className: "mz-service__foot", price: false }}
				/>
			),
			{ data },
		);
		// The price beside the title; without a button there is no footer row.
		expect(list).toContain('<h3>Workshop</h3><span class="pf-service__price">Rp2m</span></div></li>');
		expect(list).toContain(
			'<span class="pf-service__price">Rp7.5m</span></div><p class="pf-service__desc">Fixes.</p><div class="mz-service__foot"><a',
		);
	});
});

describe("testimonials", () => {
	it("draws the person's initials without a photo, and can hold the person and source in a footer row", () => {
		const plain = draw((view) => (
			<TestimonialList section={sectionOf(view, "testimonials")} className="x-quotes" variant="cards" />
		));
		expect(plain).toContain('<span class="pf-avatar" aria-hidden="true">DW</span>');
		expect(plain).toMatch(
			/<\/div><a class="pf-quote__source" href="https:\/\/www\.linkedin\.example\.test\/in\/damar"[^>]*>linkedin\.example\.test<\/a><\/li>/,
		);
		const footed = draw((view) => (
			<TestimonialList
				section={sectionOf(view, "testimonials")}
				className="x-quotes"
				variant="cards"
				footClassName="x-foot"
			/>
		));
		expect(footed).toMatch(
			/<blockquote>Calm and clear\.<\/blockquote><div class="x-foot"><div class="pf-person">[^]*<\/a><\/div><\/li>/,
		);
	});
});

describe("the navigation", () => {
	it("links the first sections and Contact, with the theme's brand, labels and message button", () => {
		const html = draw(() => (
			<Navigation
				className="x-head"
				innerClassName="pf-wrap"
				brandClassName="x-brand"
				brandMark={<i className="x-mark" />}
				label={(section) => section.title.toUpperCase()}
				message={{ anchor: "contact", className: "x-cta" }}
			/>
		));
		expect(html).toMatch(
			/^<header class="x-head"><div class="pf-wrap"><nav class="pf-nav" aria-label="[^"]+"><a class="pf-nav__brand x-brand" href="#main"><i class="x-mark"><\/i><span>Nadia Rahmawati<\/span><\/a>/,
		);
		// Four sections and Contact, in the bar and in the phone menu; the button only in the bar.
		expect(html.match(/<li><a href="#/g)).toHaveLength(10);
		expect(html).toContain('<li class="x-cta"><a class="pf-btn pf-btn--primary" href="#contact">');
		expect(html.match(/pf-btn--primary/g)).toHaveLength(1);
	});

	it("is only the name when there is nothing to link to", () => {
		const html = draw(() => (
			<Navigation className="x-head" brandClassName="x-brand" sections={[]} message={{ anchor: "contact" }} />
		));
		expect(html).not.toContain("pf-nav__links");
		expect(html).not.toContain("pf-menu");
	});
});

describe("the works' details", () => {
	it("steps from each work to the one before and after it, around, and adds the viewer for galleries", () => {
		const data: PortfolioDataInput = {
			...fullPortfolioData,
			works: {
				items: [
					...(fullPortfolioData.works?.items ?? []),
					{ id: "w4", slug: "third", title: "Third work", blocks: [] },
				],
			},
		};
		const html = draw(() => <WorkDetails />, { data });
		expect(html.match(/<section class="pf-detail"/g)).toHaveLength(3);
		expect(html).toMatch(
			/id="work-kopi-app"[^]*?href="#work-third"[^]*?data-previous[^]*?href="#work-no-cover"[^]*?data-next/,
		);
		expect(html).toContain('class="pf-lightbox"');
		expect(
			draw(() => <WorkDetails />, {
				data: { ...data, works: { items: [{ id: "w", slug: "w", title: "Only", blocks: [] }] } },
			}),
		).not.toMatch(/pf-lightbox|data-previous/);
		expect(draw(() => <WorkDetails />, { data: { works: { items: [] } } })).toBe("");
	});
});

describe("sections from the resume", () => {
	it("draw a job list in order, and a custom section like the standard section of its type", () => {
		const experience = draw((view) => <ResumeSectionBody section={sectionOf(view, "experience")} />);
		expect(experience).toMatch(/^<ol class="pf-cvlist" data-variant="compact">/);
		const tools = draw((view) => {
			const section = view.sections.find((item) => item.kind === "resume" && item.type === "skills");
			return section?.kind === "resume" ? <ResumeSectionBody section={section} /> : null;
		});
		expect(tools).toBe(
			'<div class="pf-skillgroups" data-variant="groups"><div class="pf-skillgroup"><b>Design tools</b><ul class="pf-tags"><li>Figma</li><li>Sketch</li></ul></div></div>',
		);
	});
});
