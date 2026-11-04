import type { IconStyle } from "@rezumi/schema/resume/data";
import { Button, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { lazyRouteComponent } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { cn } from "@rezumi/utils/style";
import { ResumeIconGlyph } from "./resume-icon";

// The icon list, its search and the virtual list load when the picker is about to open.
const IconPickerGrid = lazyRouteComponent(() => import("./icon-picker-grid"), "IconPickerGrid");
const preloadGrid = () => void IconPickerGrid.preload?.();

type IconPickerProps = Omit<React.ComponentProps<typeof Button>, "children" | "value" | "onChange"> &
	Pick<React.AriaAttributes, "aria-hidden"> & { tabIndex?: number } & {
		value: string;
		onChange: (icon: string) => void;
		/** The resume's icon style, so the icons look as they print. */
		iconStyle?: IconStyle | undefined;
		popoverProps?: {
			open?: boolean;
			onOpenChange?: (open: boolean) => void;
			/** Accepted for compatibility; React Aria popovers manage focus themselves. */
			modal?: boolean;
		};
	};

export function IconPicker({
	value,
	onChange,
	iconStyle = "standard",
	popoverProps,
	className,
	...props
}: IconPickerProps) {
	const { open, onOpenChange } = popoverProps ?? {};
	// Kept between openings, like the search.
	const [search, setSearch] = useState("");
	const [group, setGroup] = useState("all");

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
				<ResumeIconGlyph name={value} variant={iconStyle} className="size-4" />
			</Button>

			<Popover.Content placement="bottom start" className="h-[380px] w-[300px] p-0">
				<Popover.Dialog className="h-full p-0 outline-hidden">
					<Suspense>
						<IconPickerGrid
							search={search}
							onSearchChange={setSearch}
							group={group}
							onGroupChange={setGroup}
							value={value}
							iconStyle={iconStyle}
							onChange={onChange}
						/>
					</Suspense>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
