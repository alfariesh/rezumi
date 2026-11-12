import type { PortfolioClient } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { getBrandIcon } from "@rezumi/resume/icons";
import { renameClient } from "./clients";

const brand = getBrandIcon("Stripe");

describe("renaming a client", () => {
	it("keeps the brand logo through a longer name or a typo, and brings it back when the name matches again", () => {
		if (!brand) throw new Error("Expected the icon set to know Stripe.");
		const client: PortfolioClient = { id: "c1", name: "Stripe", logo: { brandIcon: brand } };
		renameClient(client, "Stripe I", true);
		expect(client.logo).toBeUndefined();
		renameClient(client, "Stripe", true);
		expect(client.logo).toEqual({ brandIcon: brand });
	});

	it("shows no brand logo the person didn't switch on", () => {
		const client: PortfolioClient = { id: "c2", name: "Stri" };
		renameClient(client, "Stripe", false);
		expect(client.logo).toBeUndefined();
	});

	it("never touches an uploaded logo", () => {
		const logo = { key: "pictures/portfolio/u/logo.webp", width: 200, height: 80, alt: "Logo" };
		const client: PortfolioClient = { id: "c3", name: "Acme", logo };
		renameClient(client, "Stripe", true);
		expect(client.logo).toBe(logo);
	});
});
