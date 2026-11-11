import type { SelectOption } from "@/components/input/select-field";
import { t } from "@lingui/core/macro";

type DocumentRow = { id: string; name: string; type: string };

/** The choices for "Resume submitted" or "Cover letter submitted": none, then every document of that type. */
export function documentOptions(
	documents: readonly DocumentRow[] | undefined,
	type: "resume" | "letter",
): SelectOption[] {
	return [
		{ value: "", label: t`None` },
		...(documents ?? [])
			.filter((document) => document.type === type)
			.map((document) => ({ value: document.id, label: document.name })),
	];
}
