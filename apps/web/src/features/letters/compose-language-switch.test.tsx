// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { letterWordsQueryOptions, useLetterWords } from "./compose";

afterEach(() => cleanup());

type GreetingProps = { locale: string };

function Greeting({ locale }: GreetingProps) {
	return <p>{useLetterWords(locale).teamGreeting}</p>;
}

it("keeps the shown words while another language loads, instead of suspending the editor", async () => {
	const client = new QueryClient();
	await client.ensureQueryData(letterWordsQueryOptions("en-US"));
	const page = (locale: string) => (
		<QueryClientProvider client={client}>
			<Suspense fallback={<p>suspended</p>}>
				<Greeting locale={locale} />
			</Suspense>
		</QueryClientProvider>
	);

	const { rerender } = render(page("en-US"));
	expect(screen.getByRole("paragraph").textContent).toBe("Dear hiring team,");

	rerender(page("de-DE"));
	expect(screen.getByRole("paragraph").textContent).toBe("Dear hiring team,");

	expect((await screen.findByText("Liebes Einstellungsteam,")).textContent).toBe("Liebes Einstellungsteam,");
	expect(screen.queryByText("suspended")).toBeNull();
	client.clear();
});
