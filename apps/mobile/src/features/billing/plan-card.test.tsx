import type { ComponentProps } from "react";
import { screen } from "@testing-library/react-native";
import { PlanCard } from "./plan-card";
import { renderScreen } from "@/test/render-screen";

type Plan = ComponentProps<typeof PlanCard>["plan"];
const end = new Date("2026-11-05T12:00:00Z");
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const fixture = {
	planId: "free",
	currentPeriodEndsAt: null,
	source: null,
	renews: false,
	paymentMethod: null,
	subscription: null,
	upcoming: [],
} satisfies Plan;

describe("PlanCard", () => {
	it("shows Free without an end date", async () => {
		await renderScreen(<PlanCard plan={fixture} formatDate={formatDate} />);
		expect(screen.getByText("Free")).toBeOnTheScreen();
		expect(screen.getByText("No end date")).toBeOnTheScreen();
	});

	it("shows a card subscription and its renewal date", async () => {
		const plan = {
			...fixture,
			planId: "plus",
			source: "subscription",
			renews: true,
			currentPeriodEndsAt: end,
		} satisfies Plan;
		await renderScreen(<PlanCard plan={plan} formatDate={formatDate} />);
		expect(screen.getByText("Card subscription")).toBeOnTheScreen();
		expect(screen.getByText("Renews on 2026-11-05")).toBeOnTheScreen();
	});

	it("shows the end of a QRIS pass and the next period", async () => {
		const next = new Date("2026-12-05T12:00:00Z");
		const plan = {
			...fixture,
			planId: "pro-ai",
			source: "period",
			paymentMethod: "qris",
			currentPeriodEndsAt: end,
			upcoming: [{ planId: "plus", startsAt: end, endsAt: next }],
		} satisfies Plan;
		await renderScreen(<PlanCard plan={plan} formatDate={formatDate} />);
		expect(screen.getByText("QRIS pass")).toBeOnTheScreen();
		expect(screen.getByText("Active until 2026-11-05")).toBeOnTheScreen();
		expect(screen.getByText("Then Plus")).toBeOnTheScreen();
	});

	it("shows the expiry of a previous subscription on Free", async () => {
		const plan = { ...fixture, subscription: { status: "expired", currentPeriodEnd: end } } satisfies Plan;
		await renderScreen(<PlanCard plan={plan} formatDate={formatDate} />);
		expect(screen.getByText("Free")).toBeOnTheScreen();
		expect(screen.getByText("Previous card subscription")).toBeOnTheScreen();
		expect(screen.getByText("Ended on 2026-11-05")).toBeOnTheScreen();
	});

	it("shows an expired QRIS pass after the account falls back to Free", async () => {
		const plan = { ...fixture, qrisPass: { active: false, lastEndedAt: end } } satisfies Plan;
		await renderScreen(<PlanCard plan={plan} formatDate={formatDate} />);
		expect(screen.getByText("Previous QRIS pass")).toBeOnTheScreen();
		expect(screen.getByText("Ended on 2026-11-05")).toBeOnTheScreen();
	});
});
