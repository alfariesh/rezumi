import type * as React from "react";
import { inputVariants } from "@heroui/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/** The platform select, restyled like an input, with a 20px chevron at the end. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
	return (
		<div data-slot="native-select" className="relative inline-flex w-full">
			<select
				className={cn(
					inputVariants({ fullWidth: true }),
					"h-9 cursor-pointer appearance-none ps-3 pe-9 pointer-coarse:h-11",
					className,
				)}
				{...props}
			>
				{children}
			</select>
			<Icon
				name="caret-down"
				className="pointer-events-none absolute inset-e-2.5 top-1/2 -translate-y-1/2 text-ink-3"
			/>
		</div>
	);
}

export { NativeSelect };
