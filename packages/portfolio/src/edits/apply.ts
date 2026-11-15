import type { SchemaIssue } from "./errors";
import type { InputEnv } from "./inputs";
import type { EditItem, ListTarget } from "./lists";
import type {
	AppliedPortfolioEdit,
	FailedPortfolioEdit,
	PortfolioEditContext,
	PortfolioEditPlan,
	PortfolioEditResult,
} from "./types";
import type { PortfolioData, PortfolioDataInput, PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit, PortfolioEditList, PortfolioEditPosition } from "@rezumi/schema/portfolio/edits";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import { writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { portfolioEditSchema } from "@rezumi/schema/portfolio/edits";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { describeIssues, issueKey, PortfolioEditError, refuse } from "./errors";
import { knownImages } from "./images";
import { checkRefForm, finishMetric, newItemInput, REMOVE, resolveSectionKey, setInput, updateInput } from "./inputs";
import { indexOf, itemLabel, LIST_NOUNS, listItems, ownerLabel, placeAt, positionIndex } from "./lists";
import { planFeatureMessage, planWorksMessage, portfolioFeaturesNeeded } from "./plan";

/** The most items each list holds, for a clear refusal before the write check's. */
const LIST_MAX: Record<PortfolioEditList, number> = {
	works: PORTFOLIO_LIMITS.works,
	services: PORTFOLIO_LIMITS.services,
	testimonials: PORTFOLIO_LIMITS.testimonials,
	clients: PORTFOLIO_LIMITS.clients,
	custom: PORTFOLIO_LIMITS.customSections,
	highlights: PORTFOLIO_LIMITS.highlights,
	blocks: PORTFOLIO_LIMITS.blocksPerWork,
	metrics: PORTFOLIO_LIMITS.metricsPerBlock,
};

/** What lasts across one call's edits. */
type CallState = {
	strict: boolean;
	plan: PortfolioEditPlan | undefined;
	original: PortfolioData;
	images: Map<string, PortfolioImage>;
	newId: () => string;
	/** Refs earlier adds named, with their items' ids. */
	refs: Map<string, string>;
	/** Refs of adds that failed, with the edit's index: a later edit naming one is told why it's unknown. */
	failedRefs: Map<string, number>;
};

/** One edit's outcome: the data after it and everything `AppliedPortfolioEdit` reports. */
type Step = Omit<AppliedPortfolioEdit, "index"> & { data: PortfolioData };

type Target = Pick<Extract<PortfolioEdit, { op: "add" }>, "list" | "workId" | "blockId">;

// Reading and writing a path of `set`. Keyed paths end in a key that may hold dots (a resume section's id).

const KEYED_PREFIXES = ["design.variants.", "sections.titles.", "sections.hiddenItems."] as const;

function pathSegments(path: string): string[] {
	const prefix = KEYED_PREFIXES.find((entry) => path.startsWith(entry));
	return prefix ? [...prefix.slice(0, -1).split("."), path.slice(prefix.length)] : path.split(".");
}

function readPath(data: unknown, segments: readonly string[]): unknown {
	let node = data;
	for (const segment of segments) {
		if (!node || typeof node !== "object") return undefined;
		node = (node as Record<string, unknown>)[segment];
	}
	return node;
}

function writePath(data: unknown, segments: readonly string[], value: unknown): void {
	let node = data as Record<string, unknown>;
	for (const segment of segments.slice(0, -1)) {
		const child = node[segment];
		if (!child || typeof child !== "object") node[segment] = {};
		node = node[segment] as Record<string, unknown>;
	}
	const last = segments.at(-1) as string;
	if (value === REMOVE) delete node[last];
	else node[last] = value;
}

/** A value read back for an edit: missing is null (or "resume" for the photo, whose null means no photo). */
function editValue(path: string, value: unknown): unknown {
	if (value === undefined) return path === "basics.picture" ? "resume" : null;
	return structuredClone(value);
}

/** A replayed `set` value as written: null and the photo's "resume" remove the field; the photo's null stays. */
function replayValue(path: string, value: unknown): unknown {
	if (path === "basics.picture") return value === "resume" ? REMOVE : value;
	return value === null ? REMOVE : value;
}

// Comparing items, for the fields an update changed.

function isEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
	for (const key of keys) if (!isEqual(left[key], right[key])) return false;
	return true;
}

/** The fields that turn `from` into `to`: changed ones with their new value, missing ones as null. */
function diffFields(from: Record<string, unknown>, to: Record<string, unknown>): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
		if (to[key] === undefined) {
			if (from[key] !== undefined) fields[key] = null;
		} else if (!isEqual(from[key], to[key])) fields[key] = structuredClone(to[key]);
	}
	return fields;
}

// Checks every edit's result passes.

const baselines = new WeakMap<object, ReadonlySet<string>>();

/** The issues data already had before an edit: when the start of a call is invalid, a message says so. */
function baselineIssues(data: PortfolioData): ReadonlySet<string> {
	let known = baselines.get(data);
	if (!known) {
		const result = writablePortfolioDataSchema.safeParse(data as PortfolioDataInput);
		known = new Set(result.success ? [] : result.error.issues.map((issue) => issueKey(issue as SchemaIssue)));
		baselines.set(data, known);
	}
	return known;
}

/** The data an edit made, checked whole by the write schema and the saved-size limit. */
function validate(next: PortfolioData, before: PortfolioData): PortfolioData {
	const result = writablePortfolioDataSchema.safeParse(next as PortfolioDataInput);
	if (!result.success)
		return refuse(describeIssues(next, result.error.issues as SchemaIssue[], baselineIssues(before)));
	const bytes = portfolioDataBytes(result.data);
	if (bytes > PORTFOLIO_LIMITS.dataBytes)
		refuse(
			`The portfolio would be ${Math.ceil(bytes / 1024)} KB, over its ${PORTFOLIO_LIMITS.dataBytes / 1024} KB limit. Shorten text or remove blocks first.`,
		);
	return result.data;
}

/** Refuses what the plan doesn't allow (strict mode with a plan): new premium features, works past the plan's limit. */
function checkPlan(state: CallState, data: PortfolioData, worksBefore: number | null): void {
	const { plan } = state;
	if (!state.strict || !plan) return;
	const missing = portfolioFeaturesNeeded(state.original, data).find((feature) => !plan.features[feature]);
	if (missing) refuse(planFeatureMessage(missing, data, plan));
	if (worksBefore !== null && plan.maxWorks !== null && data.works.items.length > plan.maxWorks)
		refuse(planWorksMessage(plan, plan.maxWorks, worksBefore));
}

// Cross-references an edit keeps right.

/** A new portfolio section shows where Contact begins, also when the person has ordered the sections themselves. */
function showCustomSection(data: PortfolioData, id: string): void {
	const key: PortfolioSectionKey = `custom:${id}`;
	const { order } = data.sections;
	if (!order.length || order.includes(key) || order.length >= PORTFOLIO_LIMITS.sectionKeys) return;
	const contact = order.indexOf("contact");
	order.splice(contact >= 0 ? contact : order.length, 0, key);
}

/** A removed portfolio section leaves the section order, the hidden list and its custom title. */
function dropCustomSection(data: PortfolioData, id: string): void {
	const key: PortfolioSectionKey = `custom:${id}`;
	data.sections.order = data.sections.order.filter((entry) => entry !== key);
	data.sections.hidden = data.sections.hidden.filter((entry) => entry !== key);
	delete data.sections.titles[key];
	delete data.sections.hiddenItems[key];
}

/** A work's card highlights only a metric its blocks still hold. */
function dropMissingHighlight(work: PortfolioWork): void {
	if (!work.highlightMetricId) return;
	const ids = work.blocks.flatMap((block) => (block.type === "metrics" ? block.items.map((item) => item.id) : []));
	if (!ids.includes(work.highlightMetricId)) delete work.highlightMetricId;
}

/** Every item id in the data, which a ref may not take. */
function itemIds(data: PortfolioData): Set<string> {
	const ids = new Set<string>();
	for (const work of data.works.items) {
		ids.add(work.id);
		for (const block of work.blocks) {
			ids.add(block.id);
			if (block.type === "metrics") for (const metric of block.items) ids.add(metric.id);
		}
	}
	for (const list of [
		data.services.items,
		data.testimonials.items,
		data.clients.items,
		data.custom,
		data.hero.highlights,
	])
		for (const item of list) ids.add(item.id);
	return ids;
}

// The ops.

function targetOf(edit: Target, env: InputEnv): ListTarget {
	return {
		list: edit.list,
		...(edit.workId === undefined ? {} : { workId: env.resolve(edit.workId) }),
		...(edit.blockId === undefined ? {} : { blockId: env.resolve(edit.blockId) }),
	};
}

/** The list fields of a resolved edit. */
function targetFields(target: ListTarget): Target {
	return {
		list: target.list,
		...(target.workId === undefined ? {} : { workId: target.workId }),
		...(target.blockId === undefined ? {} : { blockId: target.blockId }),
	};
}

function resolvePosition(position: PortfolioEditPosition, env: InputEnv): PortfolioEditPosition {
	if (typeof position === "string") return position;
	return "before" in position ? { before: env.resolve(position.before) } : { after: env.resolve(position.after) };
}

function describePosition(position: PortfolioEditPosition, items: readonly EditItem[], list: PortfolioEditList) {
	if (position === "first") return "to the start";
	if (position === "last") return "to the end";
	const [word, id] = "before" in position ? ["before", position.before] : ["after", position.after];
	const anchor = items.find((item) => item.id === id);
	return `${word} ${anchor ? itemLabel(list, anchor) : id}`;
}

function shortValue(value: unknown): string {
	const text = JSON.stringify(value) ?? "";
	return text.length <= 60 ? text : "";
}

function setSummary(path: string, value: unknown): string {
	if (value === undefined)
		return path.startsWith("basics.") ? `Removed ${path}: the page follows the resume again` : `Removed ${path}`;
	if (path === "basics.picture")
		return value === null ? "Set basics.picture to no photo" : "Set basics.picture to an uploaded photo";
	const shown = shortValue(value);
	return shown ? `Set ${path} to ${shown}` : `Changed ${path}`;
}

/** A set path with a portfolio section's ref in its key (`sections.titles.custom:<ref>`) made the section's id. */
function resolvePath(path: string, env: InputEnv): string {
	const prefix = KEYED_PREFIXES.find((entry) => path.startsWith(entry));
	return prefix ? `${prefix}${String(resolveSectionKey(path.slice(prefix.length), env))}` : path;
}

function applySet(
	current: PortfolioData,
	edit: Extract<PortfolioEdit, { op: "set" }>,
	state: CallState,
	env: InputEnv,
): Step {
	const path = state.strict ? resolvePath(edit.path, env) : edit.path;
	const segments = pathSegments(path);
	const before = readPath(current, segments);
	const value = state.strict ? setInput(path, edit.value, env) : replayValue(path, edit.value);
	const next = structuredClone(current);
	writePath(next, segments, value);
	const data = validate(next, current);
	checkPlan(state, data, null);
	const after = readPath(data, segments);
	return {
		data,
		edit: { op: "set", path, value: editValue(path, after) },
		inverse: [{ op: "set", path, value: editValue(path, before) }],
		summary: setSummary(path, after),
	};
}

function applyAdd(
	current: PortfolioData,
	edit: Extract<PortfolioEdit, { op: "add" }>,
	state: CallState,
	env: InputEnv,
	pending: Map<string, string>,
): Step {
	const target = targetOf(edit, env);
	const noun = LIST_NOUNS[edit.list];
	if (edit.ref !== undefined) env.claimRef(edit.ref, "", `The new ${noun}`);
	const next = structuredClone(current);
	const items = listItems(next, target);
	if (items.length >= LIST_MAX[edit.list])
		refuse(`${edit.list} is full${ownerLabel(current, target)}: at most ${LIST_MAX[edit.list]}. Remove one first.`);
	let item: EditItem;
	if (state.strict) {
		item = newItemInput(edit.list, edit.item, env, `The new ${noun}`);
		if (edit.ref !== undefined && pending.has(edit.ref))
			refuse(`The new ${noun}: the ref "${edit.ref}" is used twice in this add. Give each new item its own.`);
	} else {
		item = structuredClone(edit.item) as EditItem;
		if (typeof item.id !== "string") refuse(`A replayed add needs the item's "id".`);
	}
	if (items.some((entry) => entry.id === item.id)) refuse(`${edit.list} already has an item with the id "${item.id}".`);
	if (state.strict && (edit.list === "metrics" || edit.list === "highlights")) finishMetric(item, `The new ${noun}`);
	const at = edit.at === undefined ? undefined : resolvePosition(edit.at, env);
	items.splice(positionIndex(items, at, target), 0, item);
	if (edit.list === "custom") showCustomSection(next, item.id);
	if (edit.ref !== undefined) pending.set(edit.ref, item.id);

	const data = validate(next, current);
	checkPlan(state, data, edit.list === "works" ? current.works.items.length : null);
	const added = listItems(data, target).find((entry) => entry.id === item.id) as EditItem;
	return {
		data,
		edit: {
			op: "add",
			...targetFields(target),
			item: structuredClone(added),
			...(at === undefined ? {} : { at }),
		},
		inverse: [{ op: "remove", ...targetFields(target), id: item.id }],
		summary: `Added ${itemLabel(edit.list, added)}${ownerLabel(data, target)}`,
		id: item.id,
		...(edit.ref === undefined ? {} : { ref: edit.ref }),
		...(pending.size ? { refs: Object.fromEntries(pending) } : {}),
	};
}

/** Replayed update fields: everything but what an update never changes. */
function replayFields(
	list: PortfolioEditList,
	old: EditItem,
	fields: Record<string, unknown>,
): Record<string, unknown> {
	if ("id" in fields) refuse("An update can't change an item's id.");
	if (list === "works" && "blocks" in fields) refuse('Change a work\'s blocks with the "blocks" list.');
	if (list === "blocks" && "type" in fields && fields.type !== old.type) refuse("A block's type can't change.");
	if (list === "blocks" && old.type === "metrics" && "items" in fields)
		refuse('Change a Metrics block\'s numbers with the "metrics" list.');
	return fields;
}

function applyUpdate(
	current: PortfolioData,
	edit: Extract<PortfolioEdit, { op: "update" }>,
	state: CallState,
	env: InputEnv,
): Step {
	const target = targetOf(edit, env);
	const id = env.resolve(edit.id);
	const next = structuredClone(current);
	const items = listItems(next, target);
	const index = indexOf(items, id, target);
	const old = items[index] as EditItem;
	const fields = state.strict
		? updateInput(edit.list, old, edit.fields, env)
		: replayFields(edit.list, old, edit.fields);
	const merged: EditItem = { ...old };
	for (const [key, value] of Object.entries(fields)) {
		if (value === null || value === REMOVE) delete merged[key];
		else merged[key] = value;
	}
	if (state.strict && (edit.list === "metrics" || edit.list === "highlights"))
		finishMetric(merged, itemLabel(edit.list, old));
	items[index] = merged;

	const data = validate(next, current);
	checkPlan(state, data, null);
	const updated = listItems(data, target)[index] as EditItem;
	const changed = diffFields(old, updated);
	const label = `${itemLabel(edit.list, updated)}${ownerLabel(data, target)}`;
	return {
		data,
		edit: { op: "update", ...targetFields(target), id, fields: changed },
		inverse: [{ op: "update", ...targetFields(target), id, fields: diffFields(updated, old) }],
		summary: Object.keys(changed).length
			? `Updated ${label}: ${Object.keys(changed).join(", ")}`
			: `No change to ${label}: it already had these values`,
	};
}

function applyRemove(
	current: PortfolioData,
	edit: Extract<PortfolioEdit, { op: "remove" }>,
	state: CallState,
	env: InputEnv,
): Step {
	const target = targetOf(edit, env);
	const id = env.resolve(edit.id);
	const next = structuredClone(current);
	const items = listItems(next, target);
	const index = indexOf(items, id, target);
	const removed = items[index] as EditItem;
	const label = `${itemLabel(edit.list, removed)}${ownerLabel(current, target)}`;
	if (edit.list === "metrics" && items.length === 1)
		refuse(
			`${label} is its Metrics block's only metric, and the block needs one. Remove the block instead (list "blocks").`,
		);
	items.splice(index, 1);
	const work = target.workId === undefined ? undefined : next.works.items.find((entry) => entry.id === target.workId);
	if (edit.list === "custom") dropCustomSection(next, id);
	if (work && (edit.list === "blocks" || edit.list === "metrics")) dropMissingHighlight(work);

	const data = validate(next, current);
	checkPlan(state, data, null);
	const inverse: PortfolioEdit[] = [
		{ op: "add", ...targetFields(target), item: structuredClone(removed), at: placeAt(items, index) },
	];
	if (edit.list === "custom") {
		const key: PortfolioSectionKey = `custom:${id}`;
		const { sections } = current;
		if (sections.order.length) inverse.push({ op: "set", path: "sections.order", value: [...sections.order] });
		if (sections.hidden.includes(key))
			inverse.push({ op: "set", path: "sections.hidden", value: [...sections.hidden] });
		if (sections.titles[key] !== undefined)
			inverse.push({ op: "set", path: `sections.titles.${key}`, value: sections.titles[key] });
		if (sections.hiddenItems[key] !== undefined)
			inverse.push({ op: "set", path: `sections.hiddenItems.${key}`, value: [...(sections.hiddenItems[key] ?? [])] });
	}
	const highlight = current.works.items.find((entry) => entry.id === target.workId)?.highlightMetricId;
	if (work && highlight !== undefined && !work.highlightMetricId)
		inverse.push({ op: "update", list: "works", id: work.id, fields: { highlightMetricId: highlight } });
	return {
		data,
		edit: { op: "remove", ...targetFields(target), id },
		inverse,
		summary: `Removed ${label}`,
	};
}

function applyMove(
	current: PortfolioData,
	edit: Extract<PortfolioEdit, { op: "move" }>,
	state: CallState,
	env: InputEnv,
): Step {
	const target = targetOf(edit, env);
	const id = env.resolve(edit.id);
	const next = structuredClone(current);
	const items = listItems(next, target);
	const index = indexOf(items, id, target);
	const [item] = items.splice(index, 1) as [EditItem];
	const back = placeAt(items, index);
	const to = resolvePosition(edit.to, env);
	items.splice(positionIndex(items, to, target, id), 0, item);

	const data = validate(next, current);
	checkPlan(state, data, null);
	return {
		data,
		edit: { op: "move", ...targetFields(target), id, to },
		inverse: [{ op: "move", ...targetFields(target), id, to: back }],
		summary: `Moved ${itemLabel(edit.list, item)}${ownerLabel(data, target)} ${describePosition(to, items, edit.list)}`,
	};
}

/** What reading this edit's inputs needs, with the refs it names kept in `pending` until it succeeds. */
function inputEnv(current: PortfolioData, state: CallState, pending: Map<string, string>): InputEnv {
	let ids: Set<string> | undefined;
	const idsNow = () => (ids ??= itemIds(current));
	return {
		data: current,
		original: state.original,
		images: state.images,
		newId: state.newId,
		resolve: (id) => {
			const mapped = pending.get(id) ?? state.refs.get(id);
			if (mapped !== undefined) return mapped;
			const failedAt = state.failedRefs.get(id);
			if (failedAt !== undefined && !idsNow().has(id))
				refuse(`"${id}" names the item edit #${failedAt} was to add, and that edit failed. Fix that edit first.`);
			return id;
		},
		claimRef: (ref, id, what) => {
			const name = checkRefForm(ref, what);
			if (state.refs.has(name) || (pending.has(name) && pending.get(name) !== id))
				refuse(`${what}: the ref "${name}" is already used in this call. Give each new item its own.`);
			if (idsNow().has(name)) refuse(`${what}: "${name}" is already an item's id. Choose another ref.`);
			if (id) pending.set(name, id);
		},
	};
}

/** The refs an edit names for items it creates, to report later edits that use one when it failed. */
function refsNamed(edit: unknown): string[] {
	const refs: string[] = [];
	const visit = (value: unknown) => {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === "object") {
			const record = value as Record<string, unknown>;
			if (typeof record.ref === "string") refs.push(record.ref);
			Object.values(record).forEach(visit);
		}
	};
	visit(edit);
	return refs;
}

/**
 * Applies `edits` in order to a copy of `data`. Each edit applies whole or not at all: one that fails (unknown id,
 * invalid value, list full, plan) is reported in `failed` and the next one still applies. After every edit the data
 * passes the write schema and fits the saved-size limit.
 */
export function applyPortfolioEdits(
	data: PortfolioData,
	edits: readonly PortfolioEdit[],
	context: PortfolioEditContext,
): PortfolioEditResult {
	const strict = context.mode === "strict";
	const state: CallState = {
		strict,
		plan: context.plan,
		original: data,
		images: strict ? knownImages(data, context.images) : new Map(),
		newId: context.newId ?? generateId,
		refs: new Map(),
		failedRefs: new Map(),
	};
	let current = data;
	const applied: AppliedPortfolioEdit[] = [];
	const failed: FailedPortfolioEdit[] = [];

	edits.forEach((raw, index) => {
		const pending = new Map<string, string>();
		try {
			const parsed = portfolioEditSchema.safeParse(raw);
			if (!parsed.success)
				refuse(`This edit isn't in the edit language: ${describeIssues(raw, parsed.error.issues as SchemaIssue[])}.`);
			const edit = parsed.data;
			const env = inputEnv(current, state, pending);
			let step: Step;
			switch (edit.op) {
				case "set":
					step = applySet(current, edit, state, env);
					break;
				case "add":
					step = applyAdd(current, edit, state, env, pending);
					break;
				case "update":
					step = applyUpdate(current, edit, state, env);
					break;
				case "remove":
					step = applyRemove(current, edit, state, env);
					break;
				case "move":
					step = applyMove(current, edit, state, env);
					break;
			}
			const { data: next, ...report } = step;
			current = next;
			for (const [ref, id] of pending) state.refs.set(ref, id);
			applied.push({ index, ...report });
		} catch (error) {
			for (const ref of refsNamed(raw)) if (!state.refs.has(ref)) state.failedRefs.set(ref, index);
			const message =
				error instanceof PortfolioEditError
					? error.message
					: `This edit couldn't be applied: ${error instanceof Error ? error.message : String(error)}`;
			failed.push({ index, error: message });
		}
	});
	return { data: current, applied, failed };
}
