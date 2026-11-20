// @vitest-environment happy-dom
import type { JobListingFit } from "@rezumi/schema/jobs/fit";
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
	fit: vi.fn(),
	checkFit: vi.fn(),
	provider: { id: "rezumi-ai", label: "Rezumi AI" } as { id: string; label: string } | null,
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		jobs: {
			fit: {
				queryOptions: ({ input }: { input: { id: string } }) => ({
					queryKey: ["jobs", "fit", input.id],
					queryFn: () => api.fit(input),
				}),
			},
			checkFit: { mutationOptions: () => ({ mutationFn: api.checkFit }) },
		},
	},
}));
vi.mock("@/features/career/hooks", () => ({
	useDefaultProvider: () => ({ provider: api.provider, isUnavailable: false }),
}));
vi.mock("@/features/billing/ai-source", () => ({
	useAiSource: () => ({ choice: true, source: "rezumi", balance: 20, managed: null, own: [] }),
	aiSourceFields: () => ({ aiSource: "rezumi", idempotencyKey: "key-1" }),
}));
vi.mock("@/features/billing/ai-source-menu", () => ({
	AiSourceMenu: ({ action }: { action: string }) => <span>costs {action}</span>,
	getCreditsProblem: () => null,
}));

import { ListingFit } from "./listing-fit";

const listing: JobListingCard = {
	id: "listing-1",
	provider: "hirebase",
	externalId: "hb-1",
	title: "Data Analyst",
	company: { name: "Acme" },
	location: { text: "London" },
	skills: ["SQL"],
	postingUrl: "https://jobs.example.com/1",
	firstSeenAt: "2026-11-20T00:00:00.000Z",
	lastVerifiedAt: "2026-11-20T00:00:00.000Z",
	closedAt: null,
};

const checked = (outdated = false): JobListingFit => ({
	fit: {
		kind: "fit",
		headline: "A close match, with one question",
		summary: "Most requirements are backed by your facts.",
		requirements: [
			{ text: "SQL", origin: "posting", status: "supported", evidence: "You write SQL weekly.", factIds: [] },
			{ text: "Kubernetes", origin: "posting", status: "missing", evidence: "Not in your Profile yet.", factIds: [] },
		],
		checks: [{ label: "Location", met: null, text: "The posting doesn't say." }],
		ask: { person: "", text: "How many office days?" },
	},
	outdated,
	checkedAt: "2026-11-20T10:00:00.000Z",
});

function mount() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<I18nProvider i18n={i18n}>
				<ListingFit listing={listing} />
			</I18nProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	api.provider = { id: "rezumi-ai", label: "Rezumi AI" };
	api.fit.mockResolvedValue({ fit: null, outdated: false, checkedAt: null });
});
afterEach(cleanup);

describe("ListingFit", () => {
	it("offers a check with what it sends and costs, and shows the answer", async () => {
		api.checkFit.mockResolvedValue(checked());
		mount();
		fireEvent.click(await screen.findByRole("button", { name: "Check fit" }));
		expect(screen.getByText(/Sends this job's posting and your Profile/)).toBeTruthy();
		expect(screen.getByText("costs review")).toBeTruthy();
		expect(await screen.findByText("A close match, with one question")).toBeTruthy();
		expect(api.checkFit.mock.calls[0]?.[0]).toEqual({
			id: "listing-1",
			locale: "en-US",
			aiSource: "rezumi",
			idempotencyKey: "key-1",
		});
		expect(screen.getByText("1 supported")).toBeTruthy();
		expect(screen.getByText("No evidence yet")).toBeTruthy();
		expect(screen.getByText(/Track this job to add evidence/)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
	});

	it("shows a kept check without running it, and offers checking again once the Profile changed", async () => {
		api.fit.mockResolvedValue(checked(true));
		mount();
		expect(await screen.findByText("A close match, with one question")).toBeTruthy();
		expect(screen.getByText(/Your Profile changed since this check/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
		expect(api.checkFit).not.toHaveBeenCalled();
	});

	it("points to Settings without an AI connection", async () => {
		api.provider = null;
		mount();
		expect(await screen.findByRole("link", { name: /Connect an AI provider/ })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Check fit" })).toBeNull();
	});
});
