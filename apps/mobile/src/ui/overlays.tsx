// Overlays: HeroUI's Dialog (a form or a decision), Menu (light choices from a trigger) and Popover (a short note or a
// few controls by a trigger) as shipped. ConfirmDialog is the only addition: the alert for actions that cannot be
// undone, like the web's AlertDialog (`use-confirm`). Reversible actions never confirm; they offer Undo in a toast.
import { Button, Dialog } from "heroui-native";
import { View } from "react-native";
import { haptics } from "./motion";

export { Dialog, Menu, Popover, SubMenu, useDialog, useMenu, usePopover } from "heroui-native";
export type {
	DialogContentProps,
	DialogRootProps,
	MenuItemProps,
	MenuKey,
	MenuRootProps,
	PopoverContentProps,
	PopoverRootProps,
} from "heroui-native";

export type ConfirmDialogProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The question, naming the thing: "Delete “Product designer”?" */
	title: string;
	/** What happens, and what cancel keeps: "The resume and its 3 versions are gone for good." */
	message?: string | undefined;
	/** The action in a verb: "Delete forever". */
	confirmLabel: string;
	/** What cancel keeps: "Keep resume", not a bare "Cancel" when a better word exists. */
	cancelLabel: string;
	/** Runs once; the dialog closes itself afterwards. */
	onConfirm: () => void;
	/** A destructive action: the confirm button turns danger and confirming plays the warning haptic. */
	destructive?: boolean | undefined;
};

/** Confirms an irreversible action. The confirm button sits first (thumb reach), cancel under it. */
export function ConfirmDialog({
	isOpen,
	onOpenChange,
	title,
	message,
	confirmLabel,
	cancelLabel,
	onConfirm,
	destructive = false,
}: ConfirmDialogProps) {
	const confirm = () => {
		if (destructive) haptics.warning();
		onConfirm();
		onOpenChange(false);
	};
	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay />
				<Dialog.Content>
					<View className="gap-1.5">
						<Dialog.Title>{title}</Dialog.Title>
						{message ? <Dialog.Description>{message}</Dialog.Description> : null}
					</View>
					<View className="mt-5 gap-2">
						<Button variant={destructive ? "danger" : "primary"} onPress={confirm}>
							{confirmLabel}
						</Button>
						<Button variant="tertiary" onPress={() => onOpenChange(false)}>
							{cancelLabel}
						</Button>
					</View>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
}
