import type * as React from "react";
import { NativeSelect as HeroNativeSelect } from "@heroui-pro/react";
import { cn } from "@rezumi/utils/style";

type NativeSelectProps = React.ComponentProps<"select"> & {
	/** Classes for the field wrapper; `className` styles the `<select>`. */
	wrapperClassName?: string | undefined;
};

/**
 * The platform select in HeroUI Pro's NativeSelect frame, full width. Props go to the `<select>`, so FormControl's
 * `id`, `aria-describedby` and `aria-invalid` land on the real control; the frame mirrors the invalid state.
 */
function NativeSelect({ className, wrapperClassName, children, ...props }: NativeSelectProps) {
	const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

	return (
		<HeroNativeSelect fullWidth data-invalid={invalid || undefined} className={wrapperClassName}>
			<HeroNativeSelect.Trigger className={cn("pointer-coarse:min-h-11", className)} {...props}>
				{children}
				<HeroNativeSelect.Indicator />
			</HeroNativeSelect.Trigger>
		</HeroNativeSelect>
	);
}

export { NativeSelect, type NativeSelectProps };
