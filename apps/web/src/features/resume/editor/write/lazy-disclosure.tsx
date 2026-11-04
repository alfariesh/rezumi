import type { ReactNode } from "react";
import { Disclosure } from "@heroui/react";
import { useState } from "react";

type LazyDisclosureProps = { open: boolean; children: ReactNode };

/**
 * A disclosure whose content mounts the first time it opens and then stays, for the closing animation and the next
 * opening. React Aria renders a closed panel's content too, so a long resume would otherwise mount every entry's
 * fields, rich text editors included, as the panel loads.
 */
export function LazyDisclosure({ open, children }: LazyDisclosureProps) {
	const [opened, setOpened] = useState(open);
	if (open && !opened) setOpened(true);

	return (
		<Disclosure isExpanded={open}>
			<Disclosure.Content>
				<Disclosure.Body>{opened && children}</Disclosure.Body>
			</Disclosure.Content>
		</Disclosure>
	);
}
