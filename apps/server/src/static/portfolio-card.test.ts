import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({
	findPublicPortfolio: vi.fn(),
	/** What the server reads for each picture address: its bytes as a data URI, or nothing when it can't. */
	pictures: new Map<string, string>(),
	loads: [] as string[],
}));

vi.mock("@rezumi/api/features/portfolio/public", () => ({ findPublicPortfolio: mocks.findPublicPortfolio }));
vi.mock("./resume-page", () => ({ serveResumePage: vi.fn() }));
vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return { env: { ...env, APP_URL: "https://rezumi.example", APP_ALIAS_URL: undefined } };
});
vi.mock("@rezumi/api/features/storage", () => ({ readUploadedFont: vi.fn() }));
// The card's fonts and photo as the server loads them; no font files, so only shapes are drawn.
vi.mock("@rezumi/pdf/server", () => ({
	loadResumeCardAssets: async (data: ResumeData) => {
		const source = data.picture.url && !data.picture.hidden ? data.picture.url : undefined;
		if (source) mocks.loads.push(source);
		return {
			fonts: [],
			headingFamily: data.metadata.typography.heading.fontFamily,
			bodyFamily: data.metadata.typography.body.fontFamily,
			picture: source ? mocks.pictures.get(source) : undefined,
		};
	},
}));
vi.mock("@rezumi/pdf/web-page-card", async (original) => {
	const actual = await original<typeof import("@rezumi/pdf/web-page-card")>();
	return { ...actual, resumeCardSvg: vi.fn(actual.resumeCardSvg) };
});

const { resumeCardSvg } = await import("@rezumi/pdf/web-page-card");
const { handlePortfolioCard } = await import("./portfolio-card");

const upload = (name: string) => `uploads/user-1/pictures/portfolio/${name}`;
const url = (name: string) => `https://rezumi.example/${upload(name)}`;
// A 1×1 picture of each kind, as the server would read it.
const JPEG =
	"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

let counter = 0;
function portfolio(picture: { key: string; thumbKey?: string } | null): PublicPortfolio {
	// A new name each time: the card cache keys on what is drawn.
	counter++;
	return {
		id: "pf1",
		userId: "user-1",
		username: "nadia",
		ownerName: `Nadia ${counter}`,
		data: parsePortfolioData({
			basics: { picture: picture ? { ...picture, width: 1600, height: 1600 } : null },
		}),
		updatedAt: new Date("2026-11-06T00:00:00Z"),
		entitlements: { hidePortfolioCredit: false },
		indexable: true,
		customDomain: null,
		resume: null,
	};
}

const card = () => handlePortfolioCard(new Request("https://rezumi.example/cards/nadia.png"), "nadia");
const drawnPicture = () => vi.mocked(resumeCardSvg).mock.lastCall?.[0].picture;

beforeEach(() => {
	mocks.findPublicPortfolio.mockReset();
	mocks.pictures.clear();
	mocks.loads.length = 0;
	vi.mocked(resumeCardSvg).mockClear();
});

describe("the portfolio card's photo", () => {
	it("is the JPEG small copy of a WebP photo, read straight from the app's own storage address", async () => {
		mocks.pictures.set(url("photo-sm.jpg"), JPEG);
		mocks.findPublicPortfolio.mockResolvedValue(
			portfolio({ key: upload("photo.webp"), thumbKey: upload("photo-sm.jpg") }),
		);
		const response = await card();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(mocks.loads).toEqual([url("photo-sm.jpg")]);
		expect(drawnPicture()).toBe(JPEG);
	});

	it("is left out when there's only WebP, which the renderer can't draw, and the card is still made", async () => {
		mocks.pictures.set(url("photo.webp"), WEBP);
		mocks.pictures.set(url("photo-sm.webp"), WEBP);
		mocks.findPublicPortfolio.mockResolvedValue(
			portfolio({ key: upload("photo.webp"), thumbKey: upload("photo-sm.webp") }),
		);
		const response = await card();
		expect(response.status).toBe(200);
		expect(new Uint8Array(await response.arrayBuffer()).subarray(1, 4)).toEqual(new TextEncoder().encode("PNG"));
		expect(mocks.loads).toEqual([]);
		expect(drawnPicture()).toBeUndefined();
	});

	it("is left out, and the card made again next time, when the picture read turns out to be WebP", async () => {
		mocks.pictures.set(url("photo.png"), WEBP);
		const page = portfolio({ key: upload("photo.png") });
		mocks.findPublicPortfolio.mockResolvedValue(page);
		expect((await card()).status).toBe(200);
		expect(drawnPicture()).toBeUndefined();
		expect((await card()).status).toBe(200);
		expect(mocks.loads).toEqual([url("photo.png"), url("photo.png")]);
	});

	it("is tried again on the next request when it couldn't be read; a card that drew it is kept", async () => {
		const page = portfolio({ key: upload("photo.jpg") });
		mocks.findPublicPortfolio.mockResolvedValue(page);
		await card();
		expect(drawnPicture()).toBeUndefined();
		mocks.pictures.set(url("photo.jpg"), JPEG);
		await card();
		expect(drawnPicture()).toBe(JPEG);
		await card();
		expect(mocks.loads).toHaveLength(2);
	});

	it("is none for a portfolio that shows no photo", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio(null));
		expect((await card()).status).toBe(200);
		expect(mocks.loads).toEqual([]);
		expect(drawnPicture()).toBeUndefined();
	});
});
