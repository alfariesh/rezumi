import type { JobSourceAdapter } from "./shared";
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import { hirebase } from "./hirebase";
import { jobspipe } from "./jobspipe";

export type { JobSourceAdapter, ProviderListing, ProviderSearchOptions, ProviderSearchResult } from "./shared";

/** Every job data provider, by name. Which one answers a search is decided in one place (Phase 02 router). */
export const JOB_SOURCES: Record<JobProvider, JobSourceAdapter> = { hirebase, jobspipe };
