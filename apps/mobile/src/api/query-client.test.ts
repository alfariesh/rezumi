import { ORPCError } from "@orpc/client";
import { isOnline, shouldRetry } from "./query-client";

jest.mock("./client", () => ({ SessionChangedError: class SessionChangedError extends Error {} }));

describe("shouldRetry", () => {
	it("retries network and server failures twice", () => {
		const error = new TypeError("Network request failed");
		expect(shouldRetry(0, error)).toBe(true);
		expect(shouldRetry(1, new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }))).toBe(true);
		expect(shouldRetry(2, error)).toBe(false);
	});

	it("never retries answers that would come back the same", () => {
		expect(shouldRetry(0, new ORPCError("NOT_FOUND", { status: 404 }))).toBe(false);
		expect(shouldRetry(0, new ORPCError("UNAUTHORIZED", { status: 401 }))).toBe(false);
	});

	it("never retries after the signed-in account changed", () => {
		const { SessionChangedError } = jest.requireMock<typeof import("./client")>("./client");
		expect(shouldRetry(0, new SessionChangedError())).toBe(false);
	});
});

describe("isOnline", () => {
	it("treats an unknown reachability as online", () => {
		expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
		expect(isOnline({ isConnected: undefined, isInternetReachable: undefined })).toBe(true);
	});

	it("is offline when either signal says so", () => {
		expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
		expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
	});
});
