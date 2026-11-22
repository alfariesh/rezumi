// A row that picks one of the user's resumes or letters (or None) from a searchable sheet: Mark as applied and Save a
// job use it for the documents sent.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { useDocuments } from "../queries";
import { ListRow, PickerSheet } from "@/ui";

type DocumentChoiceProps = {
	type: "resume" | "letter";
	label: string;
	/** A document id, or "" for none. */
	value: string;
	onChange: (id: string) => void;
	isDisabled?: boolean | undefined;
};

export function DocumentChoice({ type, label, value, onChange, isDisabled }: DocumentChoiceProps) {
	const { t } = useLingui();
	const documents = useDocuments();
	const [open, setOpen] = useState(false);
	const none = "__none__";
	const options = [
		{ value: none, label: t`None` },
		...(documents.data ?? [])
			.filter((document) => document.type === type)
			.map((document) => ({ value: document.id, label: document.name })),
	];
	const picked = options.find((option) => option.value === value)?.label ?? t`None`;
	return (
		<>
			<ListRow
				title={label}
				value={documents.isPending ? t`Loading…` : picked}
				isDisabled={isDisabled}
				onPress={() => setOpen(true)}
				testID={`document-choice-${type}`}
			/>
			<PickerSheet
				isOpen={open}
				onOpenChange={setOpen}
				title={label}
				closeLabel={t`Close`}
				searchLabel={type === "resume" ? t`Search resumes` : t`Search letters`}
				emptyLabel={(query) => t`Nothing matches “${query}”.`}
				options={options}
				value={value || none}
				onPick={(id) => {
					setOpen(false);
					onChange(id === none ? "" : id);
				}}
			/>
		</>
	);
}
