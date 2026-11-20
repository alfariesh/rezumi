import z from "zod";
import { fitDataSchema } from "../career";

/**
 * A person's AI fit check of one listing (K8): `fit` is null until they run one. `outdated` once their Profile changed
 * after it ran; checking again then costs again, while an up-to-date check is given back for free.
 */
export const jobListingFitSchema = z.object({
	fit: fitDataSchema.nullable(),
	outdated: z.boolean(),
	checkedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type JobListingFit = z.infer<typeof jobListingFitSchema>;
