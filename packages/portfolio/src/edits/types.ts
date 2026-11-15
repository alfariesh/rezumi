import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { ResumeData } from "@rezumi/schema/resume/data";

/** The plan features a portfolio edit can need, as `assertPortfolioPlan` checks them on save. */
export type PortfolioPlanFeature = "premiumPortfolioThemes" | "premiumHeroEffects" | "hidePortfolioCredit";

/** What the account's plan allows, for refusing an edit before the save would. Null: plans don't apply. */
export type PortfolioEditPlan = {
	/** Works the plan allows; null for no limit beyond the technical one. */
	maxWorks: number | null;
	features: Record<PortfolioPlanFeature, boolean>;
	/** The plan's name for messages, e.g. "Free". */
	name: string;
} | null;

export type PortfolioEditContext = {
	/**
	 * `strict`: edits from a model or an API caller. Images must be known (in the data or `images`), new ids are made,
	 * the plan is checked. `replay`: edits this engine already resolved (`AppliedPortfolioEdit.edit`), applied again on
	 * another copy (the editor's store): ids and full image objects are taken as given, the plan isn't checked.
	 */
	mode: "strict" | "replay";
	plan?: PortfolioEditPlan | undefined;
	/** Uploaded images an edit may place besides those already in the data (strict mode). */
	images?: readonly PortfolioImage[] | undefined;
	/** Makes ids for new items; `generateId` by default. */
	newId?: (() => string) | undefined;
};

export type AppliedPortfolioEdit = {
	/** The edit's position in the call. */
	index: number;
	/**
	 * The edit as applied: ids and refs resolved, new items with their ids (nested ones too), work slugs set, image
	 * refs as full image objects, video and embed links parsed. Replaying it (`mode: "replay"`) on the same data gives
	 * the same result.
	 */
	edit: PortfolioEdit;
	/** Edits that undo this one on the data it produced, in the order to apply them. */
	inverse: PortfolioEdit[];
	/** One short English line for a model or a log, e.g. `Added work "Lumen redesign"`. */
	summary: string;
	/** The id of the item an add created. */
	id?: string | undefined;
	ref?: string | undefined;
	/**
	 * Every ref this edit named, with the id it stands for: the add's own `ref` and those of blocks and metrics created
	 * inside it (`{ "type": "metrics", "ref": "results", "items": [{ "ref": "conversion", … }] }`).
	 */
	refs?: Record<string, string> | undefined;
};

export type FailedPortfolioEdit = {
	index: number;
	/** Why, for a model to act on: which field and what's wrong, or what to read again. */
	error: string;
};

export type PortfolioEditResult = {
	/** The data after the applied edits: always valid for the write schema. */
	data: PortfolioData;
	applied: AppliedPortfolioEdit[];
	failed: FailedPortfolioEdit[];
};

/** An image uploaded to the portfolio and not placed anywhere yet, which an edit may place. */
export type PortfolioUpload = PortfolioImage & { uploadedAt?: string | undefined };

export type PortfolioAiViewInput = {
	data: PortfolioData;
	/** Where the career sections and basics come from: the source resume, or the Profile read as resume data. */
	source: { from: "resume" | "profile"; name: string | null; resume: ResumeData | null };
	plan: PortfolioEditPlan | undefined;
	/** Uploads not placed yet. */
	uploads: readonly PortfolioUpload[];
	status: { published: boolean; url: string | null };
};
