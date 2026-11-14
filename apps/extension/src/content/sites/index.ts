import type { SiteAdapter } from "./types";
import type { JobSite } from "@rezumi/job-sites/sites";
import { glints } from "./glints";
import { indeed } from "./indeed";
import { jobstreet } from "./jobstreet";
import { linkedin } from "./linkedin";

/** Each job board's reader. */
export const SITE_ADAPTERS: Record<JobSite, SiteAdapter> = { linkedin, indeed, jobstreet, glints };
