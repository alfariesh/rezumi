// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiKey = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() }));
const toasts = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@/libs/auth/client", () => ({ authClient: { apiKey } }));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: { add: toasts.add, close: vi.fn() } }));
const plan = vi.hoisted(() => ({ apiLocked: false }));
vi.mock("@/features/billing/plan", () => ({ usePlanFeature: () => !plan.apiLocked }));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

const { ApiKeysSection } = await import("./api-keys");

const key = {
	id: "key-1",
	name: "Claude Desktop",
	start: "rr_abc",
	enabled: true,
	lastRequest: null,
	expiresAt: null,
	createdAt: new Date("2026-08-16T10:00:00Z"),
};

type ToastOptions = { actionProps: { onClick: () => Promise<void> }; onClose: () => void };

async function revoke() {
	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ApiKeysSection />
			</QueryClientProvider>
		</I18nProvider>,
	);
	await waitFor(() => expect(screen.getByText("Claude Desktop")).toBeTruthy());
	expect(screen.getAllByText("Never")).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Revoke Claude Desktop" }));
	await waitFor(() => expect(toasts.add).toHaveBeenCalled());
	return toasts.add.mock.calls.at(-1)?.[0] as ToastOptions;
}

describe("API keys", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		plan.apiLocked = false;
		apiKey.list.mockResolvedValue({ data: { apiKeys: [key] }, error: null });
		apiKey.update.mockResolvedValue({ error: null });
		apiKey.delete.mockResolvedValue({ error: null });
	});

	it("turns a revoked key off at once, and Undo turns it back on without deleting it", async () => {
		const toast = await revoke();
		expect(apiKey.update).toHaveBeenCalledWith({ keyId: "key-1", enabled: false });

		await toast.actionProps.onClick();
		toast.onClose();
		expect(apiKey.update).toHaveBeenLastCalledWith({ keyId: "key-1", enabled: true });
		expect(apiKey.delete).not.toHaveBeenCalled();
	});

	it("warns that keys won't work until the plan includes API access, and links to plans", async () => {
		const renderSection = () =>
			render(
				<I18nProvider i18n={i18n}>
					<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
						<ApiKeysSection />
					</QueryClientProvider>
				</I18nProvider>,
			);
		const { unmount } = renderSection();
		await waitFor(() => expect(screen.getByText("Claude Desktop")).toBeTruthy());
		expect(screen.queryByText("API keys need the Plus or Pro AI plan")).toBeNull();
		unmount();

		plan.apiLocked = true;
		renderSection();
		expect(screen.getByText("API keys need the Plus or Pro AI plan")).toBeTruthy();
		expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/dashboard/settings/billing");
	});
});
