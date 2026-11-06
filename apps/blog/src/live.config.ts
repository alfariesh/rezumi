import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

// EmDash serves every collection through this one live collection; pages query it with getEmDashCollection() and
// getEmDashEntry().
export const collections = {
	_emdash: defineLiveCollection({ loader: emdashLoader() }),
};
