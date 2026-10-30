import type { ReactNode } from "react";
import { Command } from "@heroui-pro/react";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../store";

type Props = {
	page?: string;
	heading: ReactNode;
	children: ReactNode;
};

export const BaseCommandGroup = ({ page, heading, children }: Props) => {
	const pages = useCommandPaletteStore((state) => state.pages);
	const currentPage = pages[pages.length - 1];
	const isEnabled = currentPage === page;

	if (!isEnabled) return null;

	return <Command.Group heading={heading}>{children}</Command.Group>;
};

/** HeroUI's filter is a substring match on `textValue`, so keywords are folded into it. */
export const searchText = (label: string, keywords: ReadonlyArray<string | null | undefined> = []) =>
	[label, ...keywords].filter(Boolean).join(" ");

type PaletteItemProps = {
	id: string;
	textValue: string;
	onAction: () => void;
	isDisabled?: boolean;
	checked?: boolean;
	children: ReactNode;
};

/** One palette row: icon/label children, plus a check mark at the end when `checked`. */
export function PaletteItem({ id, textValue, onAction, isDisabled, checked, children }: PaletteItemProps) {
	return (
		<Command.Item
			id={id}
			textValue={textValue}
			onAction={onAction}
			isDisabled={isDisabled ?? false}
			className="group gap-3 px-2 py-3"
		>
			{children}
			{checked ? <Icon name="check" className="ms-auto text-accent-text" /> : null}
		</Command.Item>
	);
}
