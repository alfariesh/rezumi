import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { importVideoThumbnail } from "./remote";

const mocks = vi.hoisted(() => ({
	fetchRemoteImage: vi.fn(),
	uploadPortfolioImage: vi.fn(),
}));

vi.mock("@/libs/orpc/client", () => ({
	client: { portfolio: { fetchRemoteImage: (...args: unknown[]) => mocks.fetchRemoteImage(...args) } },
}));
vi.mock("../images/upload", async () => {
	const actual = await vi.importActual<typeof import("../images/upload")>("../images/upload");
	return { ...actual, uploadPortfolioImage: (...args: unknown[]) => mocks.uploadPortfolioImage(...args) };
});

i18n.loadAndActivate({ locale: "en", messages: {} });

const youtube = { provider: "youtube", videoId: "abcdefghijk", title: "Demo" } as const;
const image = { key: "pictures/portfolio/u/a.webp", width: 1280, height: 720, alt: "Demo" };

beforeEach(() => {
	mocks.fetchRemoteImage = vi.fn();
	mocks.uploadPortfolioImage = vi.fn();
});

describe("copying a video's thumbnail", () => {
	it("falls back from YouTube's largest picture to its standard one", async () => {
		mocks.fetchRemoteImage
			.mockRejectedValueOnce(new ORPCError("PORTFOLIO_LINK_UNREADABLE", { message: "404" }))
			.mockResolvedValueOnce(new File(["x"], "thumb.jpg", { type: "image/jpeg" }));
		mocks.uploadPortfolioImage.mockResolvedValue(image);
		const onFailure = vi.fn();
		await expect(importVideoThumbnail(youtube, undefined, onFailure)).resolves.toEqual(image);
		expect(mocks.fetchRemoteImage).toHaveBeenCalledTimes(2);
		expect(onFailure).not.toHaveBeenCalled();
	});

	it("stops at full storage instead of trying the next picture, and says why to whoever asked", async () => {
		const full = new ORPCError("PORTFOLIO_STORAGE_FULL", { message: "full" });
		mocks.fetchRemoteImage.mockResolvedValue(new File(["x"], "thumb.jpg", { type: "image/jpeg" }));
		mocks.uploadPortfolioImage.mockRejectedValue(full);
		const onFailure = vi.fn();
		await expect(importVideoThumbnail(youtube, undefined, onFailure)).resolves.toBeUndefined();
		expect(mocks.uploadPortfolioImage).toHaveBeenCalledTimes(1);
		expect(onFailure).toHaveBeenCalledWith(full);
	});

	it("passes a cancel on, without reporting it as a failure", async () => {
		const controller = new AbortController();
		mocks.fetchRemoteImage.mockImplementation(() => {
			controller.abort();
			return Promise.reject(new DOMException("Aborted", "AbortError"));
		});
		const onFailure = vi.fn();
		await expect(importVideoThumbnail(youtube, controller.signal, onFailure)).rejects.toThrow();
		expect(onFailure).not.toHaveBeenCalled();
	});
});
