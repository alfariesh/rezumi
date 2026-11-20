import type { JobSourceAdapter, ProviderListing, ProviderSearchResult } from "./providers";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import type { JobSearchInput } from "@rezumi/schema/jobs/search";

/** Test doubles for job providers: never calls treg. */

export function fakeListing(
	provider: JobProvider,
	index: number,
	overrides: Partial<ProviderListing> = {},
): ProviderListing {
	return {
		provider,
		externalId: `${provider}-${index}`,
		title: `${provider} job ${index}`,
		company: { name: `Company ${index}` },
		location: { city: "Berlin", country: "Germany", countryCode: "DE", text: "Berlin, Germany" },
		description: `Description ${index}`,
		skills: [],
		postingUrl: `https://jobs.example.com/${provider}/${index}`,
		raw: {},
		...overrides,
	};
}

export type FakePage = ProviderListing[] | Error | ((input: JobSearchInput, limit: number) => ProviderListing[]);

/**
 * A provider that answers from a list of pages: page N for its Nth call, or for a cursor "N". Counts calls and records
 * what it was asked.
 */
export function fakeSource(provider: JobProvider, pages: FakePage[], options: { delayMs?: number } = {}) {
	const calls: { input: JobSearchInput; limit: number }[] = [];
	const adapter: JobSourceAdapter = {
		provider,
		pricePerListingUsd: 0.001,
		async search(input, searchOptions): Promise<ProviderSearchResult> {
			calls.push({ input, limit: searchOptions.limit });
			if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
			const index = input.cursor ? Number(input.cursor) - 1 : 0;
			const page = pages[index] ?? [];
			if (page instanceof Error) throw page;
			const listings = (typeof page === "function" ? page(input, searchOptions.limit) : page).slice(
				0,
				searchOptions.limit,
			);
			return {
				provider,
				listings,
				cursor: index + 1 < pages.length ? String(index + 2) : undefined,
				total: undefined,
				costMicro: listings.length * 1_000,
				ms: 5,
				dropped: 0,
			};
		},
		count: () => Promise.resolve(undefined),
	};
	return { adapter, calls };
}

/** `count` fitting listings from a provider, numbered from `from`. */
export const listings = (provider: JobProvider, count: number, from = 1) =>
	Array.from({ length: count }, (_, index) => fakeListing(provider, from + index));
