import { useRef, useState } from "react";
import { IconButton } from "./button";
import { ListGroup, ListRow } from "./lists";
import { Sheet } from "./sheet";

type SheetMenuProps = {
	label: string;
	closeLabel: string;
	items: readonly { label: string; onPress: () => void; destructive?: boolean }[];
};

/** Message and conversation actions stay reachable inside a native sheet as well as on an inline panel. */
export function SheetMenu({ label, closeLabel, items }: SheetMenuProps) {
	const [open, setOpen] = useState(false);
	const next = useRef<(() => void) | null>(null);
	return (
		<>
			<IconButton icon="dots-three" size="sm" label={label} onPress={() => setOpen(true)} />
			<Sheet
				isOpen={open}
				onOpenChange={setOpen}
				title={label}
				closeLabel={closeLabel}
				onDidDismiss={() => {
					const action = next.current;
					next.current = null;
					action?.();
				}}
			>
				<ListGroup>
					{items.map((item) => (
						<ListRow
							key={item.label}
							title={item.label}
							tone={item.destructive ? "danger" : "default"}
							chevron={false}
							onPress={() => {
								next.current = item.onPress;
								setOpen(false);
							}}
						/>
					))}
				</ListGroup>
			</Sheet>
		</>
	);
}
