import { describe, expect, it } from "vite-plus/test";
import { isIpAddress, rateLimitAddress } from "./client-address";

describe("rateLimitAddress", () => {
	it("keeps an IPv4 address as it is", () => {
		expect(rateLimitAddress(" 203.0.113.7 ")).toBe("203.0.113.7");
	});

	it("counts every address of one IPv6 /64 together", () => {
		const a = rateLimitAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
		expect(a).toBe("2001:db8:1:2::/64");
		expect(rateLimitAddress("2001:0DB8:0001:0002::1")).toBe(a);
		expect(rateLimitAddress("[2001:db8:1:2::ffff]")).toBe(a);
		expect(rateLimitAddress("2001:db8:1:2::1%eth0")).toBe(a);
		expect(rateLimitAddress("2001:db8:1:3::1")).not.toBe(a);
		expect(rateLimitAddress("::1")).toBe("0:0:0:0::/64");
	});

	it("reads an IPv4 address written as IPv6 as that IPv4 address", () => {
		expect(rateLimitAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
		expect(rateLimitAddress("::ffff:cb00:7107")).toBe("203.0.113.7");
	});

	it("has nothing to count without a usable address", () => {
		for (const value of [undefined, "", "unknown", "example.com", "1.2.3", "256.1.1.1", "1::2::3", "1:2:3:4:5:6:7:8:9"])
			expect(rateLimitAddress(value)).toBeNull();
	});
});

describe("isIpAddress", () => {
	it("accepts IPv4 and IPv6 addresses only", () => {
		expect(isIpAddress("203.0.113.7")).toBe(true);
		expect(isIpAddress("2001:db8::1")).toBe(true);
		expect(isIpAddress("unknown")).toBe(false);
		expect(isIpAddress(undefined)).toBe(false);
	});
});
