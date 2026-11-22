import type { Version } from "./format";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { getVersionTitle } from "./format";
import { Button, ConfirmDialog, Input, Label, ListRow, ListSection, Sheet, TextField } from "@/ui";

type VersionOptionsProps = {
	version: Version | null;
	onClose: () => void;
	onRename: (version: Version, name: string) => void;
	onDelete: (version: Version) => void;
};

/** Named versions are the person's own: they can be renamed or deleted. The rest expire on their own. */
export function VersionOptions({ version, onClose, onRename, onDelete }: VersionOptionsProps) {
	const { t } = useLingui();
	const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu");
	const [name, setName] = useState("");
	// Each version opens on the menu, with its own name in the rename field.
	const [shown, setShown] = useState<Version | null>(null);
	if (version !== shown) {
		setShown(version);
		setMode("menu");
		setName(version?.name ?? "");
	}
	const title = version ? getVersionTitle(version) : "";
	const trimmed = name.trim();

	return (
		<>
			<Sheet
				isOpen={!!version && mode !== "delete"}
				onOpenChange={(open) => (open ? undefined : onClose())}
				title={mode === "rename" ? t`Rename version` : title}
				closeLabel={t`Close`}
				padded={mode === "rename"}
				footer={
					mode === "rename" ? (
						<Button
							isDisabled={!trimmed || trimmed === version?.name}
							onPress={() => {
								if (version) onRename(version, trimmed);
								onClose();
							}}
						>
							<Button.Label>{t`Save`}</Button.Label>
						</Button>
					) : undefined
				}
			>
				{mode === "rename" ? (
					<TextField>
						<Label>{t`Name`}</Label>
						<Input
							variant="secondary"
							accessibilityLabel={t`Name`}
							value={name}
							onChangeText={setName}
							maxLength={80}
							autoFocus
						/>
					</TextField>
				) : (
					<ListSection>
						<ListRow title={t`Rename…`} icon="pencil-simple" onPress={() => setMode("rename")} />
						<ListRow title={t`Delete`} icon="trash" tone="danger" onPress={() => setMode("delete")} />
					</ListSection>
				)}
			</Sheet>
			<ConfirmDialog
				isOpen={!!version && mode === "delete"}
				onOpenChange={(open) => (open ? undefined : onClose())}
				title={t`Delete “${title}”?`}
				message={t`Named versions are kept until you delete them. This can't be undone.`}
				confirmLabel={t`Delete version`}
				cancelLabel={t`Keep version`}
				destructive
				onConfirm={() => {
					if (version) onDelete(version);
					onClose();
				}}
			/>
		</>
	);
}
