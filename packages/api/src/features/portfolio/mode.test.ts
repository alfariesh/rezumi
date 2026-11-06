import { describe, expect, it, vi } from "vite-plus/test";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";

const fixture = vi.hoisted(() => ({ mode: undefined as string | undefined }));
vi.mock("@rezumi/env/server", () => ({
	env: {
		get PORTFOLIO_MODE() {
			return fixture.mode;
		},
	},
}));

describe("portfolio mode", () => {
	it("is off unless the environment says otherwise", () => {
		fixture.mode = undefined;
		expect(getPortfolioMode()).toBe("off");
		fixture.mode = "admins";
		expect(getPortfolioMode()).toBe("admins");
	});

	it("opens portfolios to nobody when off, admins while testing, and every signed-up account when on", () => {
		const member = { role: "user", isAnonymous: false };
		const admin = { role: "admin", isAnonymous: false };
		const guest = { role: "admin", isAnonymous: true };
		expect([member, admin, guest].map((account) => isPortfolioEnabledFor(account, "off"))).toEqual([
			false,
			false,
			false,
		]);
		expect([member, admin, guest].map((account) => isPortfolioEnabledFor(account, "admins"))).toEqual([
			false,
			true,
			false,
		]);
		expect([member, admin, guest].map((account) => isPortfolioEnabledFor(account, "on"))).toEqual([true, true, false]);
		expect(isPortfolioEnabledFor({ role: null }, "on")).toBe(true);
	});
});
