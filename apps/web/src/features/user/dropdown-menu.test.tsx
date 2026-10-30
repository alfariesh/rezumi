// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type SignOutOptions = { fetchOptions: { onSuccess: () => void } };

const router = vi.hoisted(() => ({ invalidate: vi.fn(), navigate: vi.fn() }));
const signOut = vi.hoisted(() =>
	vi.fn(({ fetchOptions }: SignOutOptions) => {
		fetchOptions.onSuccess();
	}),
);

vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));
vi.mock("@/libs/auth/client", () => ({
	authClient: { signOut, useSession: () => ({ data: { user: { id: "user-1" } } }) },
}));
vi.mock("@/features/theme/provider", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() } }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const { UserDropdownMenu } = await import("./dropdown-menu");

describe("UserDropdownMenu", () => {
	it("clears the previous user's cached queries when signing out", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(["resumes"], [{ id: "resume-1" }]);

		render(
			<I18nProvider i18n={i18n}>
				<QueryClientProvider client={queryClient}>
					<UserDropdownMenu>{() => <button type="button">Account</button>}</UserDropdownMenu>
				</QueryClientProvider>
			</I18nProvider>,
		);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Account" }));
		await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

		await waitFor(() => expect(router.invalidate).toHaveBeenCalled());
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	});
});
