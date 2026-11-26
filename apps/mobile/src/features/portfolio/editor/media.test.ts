import { i18n } from "@lingui/core";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { pickPdf, uploadPicture } from "./media";

const mockFile = { size: 0, slice: jest.fn(), delete: jest.fn(), exists: true };
const mockUpload = jest.fn();
const mockOpenPdf = jest.fn();

jest.mock("expo-file-system", () => ({
	File: function File() {
		return mockFile;
	},
}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-document-picker", () => ({
	getDocumentAsync: async () => ({ canceled: false, assets: [{ name: "Work.pdf", uri: "file:///fixture.pdf" }] }),
}));
jest.mock("../../../../modules/pdf-pages", () => ({
	pdfPages: { open: (...args: unknown[]) => mockOpenPdf(...args) },
}));
jest.mock("@/api/client", () => ({ portfolioUpload: (...args: unknown[]) => mockUpload(...args) }));

beforeAll(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));
beforeEach(() => jest.clearAllMocks());

it("refuses an oversized image before reading it or uploading bytes", async () => {
	mockFile.size = 51 * 1024 * 1024;
	await expect(uploadPicture({ uri: "file:///picture.jpg" }, "photo", "account")).rejects.toThrow(
		"This picture is too large.",
	);
	expect(mockFile.slice).not.toHaveBeenCalled();
	expect(mockUpload).not.toHaveBeenCalled();
});

it("refuses an oversized PDF before opening it and clears the copied file", async () => {
	mockFile.size = PORTFOLIO_UPLOAD.pdfBytes + 1;
	await expect(pickPdf("account")).rejects.toThrow("This PDF is too large.");
	expect(mockOpenPdf).not.toHaveBeenCalled();
	expect(mockUpload).not.toHaveBeenCalled();
	expect(mockFile.delete).toHaveBeenCalledTimes(1);
});
