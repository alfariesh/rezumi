import { describe, expect, it, vi } from "vite-plus/test";
import { shouldStartOnboarding } from "./redirect";

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		profile: { get: { queryOptions: () => ({ queryKey: ["profile"] }) } },
		documents: { list: { queryOptions: () => ({ queryKey: ["documents"] }) } },
	},
}));
vi.mock("@/features/profile/queries", () => ({ profileQueryOptions: () => ({ queryKey: ["profile"] }) }));

describe("when Home hands over to onboarding", () => {
	const session = (isAnonymous: boolean) => ({ user: { isAnonymous } }) as never;
	const client = (profile: unknown, documents: unknown[] | Error) =>
		({
			ensureQueryData: vi.fn(async ({ queryKey }: { queryKey: string[] }) => {
				if (queryKey[0] === "profile") return profile;
				if (documents instanceof Error) throw documents;
				return documents;
			}),
		}) as never;

	it("reads the documents only for a Profile never saved", async () => {
		const saved = client({ updatedAt: new Date() }, []);
		expect(await shouldStartOnboarding(saved, session(false))).toBe(false);
		expect((saved as { ensureQueryData: ReturnType<typeof vi.fn> }).ensureQueryData).toHaveBeenCalledTimes(1);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), session(false))).toBe(true);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, [{ id: "r1" }]), session(false))).toBe(false);
	});

	it("never sends guests or signed-out visitors, and lets Home open when a read fails", async () => {
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), session(true))).toBe(false);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), null)).toBe(false);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, new Error("offline")), session(false))).toBe(false);
	});
});
