import { Button, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { copySourceToClipboard } from "./editor-extensions";

type ToolbarButtonProps = {
	label: string;
	disabled?: boolean;
	onClick(): void;
	children: React.ReactNode;
};

function ToolbarButton({ label, disabled, onClick, children }: ToolbarButtonProps) {
	return (
		<Tooltip>
			<Button isIconOnly size="sm" variant="ghost" aria-label={label} isDisabled={disabled ?? false} onPress={onClick}>
				{children}
			</Button>
			<Tooltip.Content>{label}</Tooltip.Content>
		</Tooltip>
	);
}

export type StylesheetToolbarProps = {
	source: string;
	canUndo: boolean;
	canRedo: boolean;
	focused: boolean;
	disabled?: boolean;
	onUndo(): void;
	onRedo(): void;
	onFormat(): void;
	onFocusToggle(): void;
};

export function StylesheetToolbar({
	source,
	canUndo,
	canRedo,
	focused,
	disabled = false,
	onUndo,
	onRedo,
	onFormat,
	onFocusToggle,
}: StylesheetToolbarProps) {
	return (
		<div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t`Stylesheet editor`}>
			<ToolbarButton label={t`Undo resume change`} disabled={disabled || !canUndo} onClick={onUndo}>
				<Icon name="arrow-u-up-left" size={16} />
			</ToolbarButton>
			<ToolbarButton label={t`Redo resume change`} disabled={disabled || !canRedo} onClick={onRedo}>
				<Icon name="arrow-u-up-right" size={16} />
			</ToolbarButton>
			<ToolbarButton label={t`Copy stylesheet`} onClick={() => void copySourceToClipboard(source)}>
				<Icon name="copy" size={16} />
			</ToolbarButton>
			<ToolbarButton label={t`Format stylesheet`} disabled={disabled} onClick={onFormat}>
				<Icon name="magic-wand" size={16} />
			</ToolbarButton>
			<ToolbarButton label={focused ? t`Exit focus mode` : t`Open focus mode`} onClick={onFocusToggle}>
				{focused ? <Icon name="arrows-in-simple" size={16} /> : <Icon name="arrows-out-simple" size={16} />}
			</ToolbarButton>
		</div>
	);
}
