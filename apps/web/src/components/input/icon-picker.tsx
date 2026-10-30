import { Button, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { lazyRouteComponent } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { cn } from "@rezumi/utils/style";

// The icon list, its search index and the virtual grid load when the picker is about to open.
const IconPickerGrid = lazyRouteComponent(() => import("./icon-picker-grid"), "IconPickerGrid");
const preloadGrid = () => void IconPickerGrid.preload?.();

type IconPickerProps = Omit<React.ComponentProps<typeof Button>, "children" | "value" | "onChange"> &
	Pick<React.AriaAttributes, "aria-hidden"> & { tabIndex?: number } & {
		value: string;
		onChange: (icon: string) => void;
		popoverProps?: {
			open?: boolean;
			onOpenChange?: (open: boolean) => void;
			/** Accepted for compatibility; React Aria popovers manage focus themselves. */
			modal?: boolean;
		};
	};

export function IconPicker({ value, onChange, popoverProps, className, ...props }: IconPickerProps) {
	const { open, onOpenChange } = popoverProps ?? {};
	const [search, setSearch] = useState("");

	return (
		<Popover {...(open !== undefined && { isOpen: open })} {...(onOpenChange && { onOpenChange })}>
			<Button
				variant="secondary"
				isIconOnly
				aria-label={t`Pick an icon`}
				// `min-w-0` on every element lets a flex row squeeze this square into a tall pill; it never shrinks.
				className={cn("shrink-0", typeof className === "string" && className)}
				onHoverStart={preloadGrid}
				onFocus={preloadGrid}
				{...props}
			>
				<i className={cn("ph size-4 text-base", `ph-${value}`)} />
			</Button>

			<Popover.Content placement="bottom start" className="h-[326px] w-[290px] p-0">
				<Popover.Dialog className="h-full p-0 outline-hidden">
					<Suspense>
						<IconPickerGrid search={search} onSearchChange={setSearch} onChange={onChange} />
					</Suspense>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
