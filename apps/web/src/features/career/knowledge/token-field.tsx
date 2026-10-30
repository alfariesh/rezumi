import type { ReactNode } from "react";
import { Chip } from "@heroui/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

type TokenFrameProps = { children: ReactNode; className?: string };

/** The frame of a field that holds removable tokens next to a bare input: a secondary HeroUI field fill and focus ring. */
export function TokenFrame({ children, className }: TokenFrameProps) {
	return (
		<div
			className={cn(
				"flex min-h-10 flex-wrap items-center gap-1 rounded-field bg-default p-1.5 text-field-foreground transition-[background-color,box-shadow] duration-quick focus-within:ring-2 focus-within:ring-focus hover:bg-default-hover",
				className,
			)}
		>
			{children}
		</div>
	);
}

type TokenProps = { children: ReactNode; removeLabel: string; onRemove: () => void };

/** One chosen value in a `TokenFrame`, with its own remove button. */
export function Token({ children, removeLabel, onRemove }: TokenProps) {
	return (
		<Chip size="md" variant="soft" color="accent" className="h-7 gap-1 ps-2 pe-0.5">
			<span className="flex items-center gap-1">{children}</span>
			<button
				type="button"
				aria-label={removeLabel}
				onClick={onRemove}
				className="touch-target relative grid size-6 cursor-(--cursor-interactive) place-items-center rounded-lg outline-none hover:bg-accent-soft-hover focus-visible:ring-2 focus-visible:ring-focus"
			>
				<Icon name="x" size={14} />
			</button>
		</Chip>
	);
}

/** Shared by the token fields' bare inputs. */
export const tokenInputClass =
	"h-8 min-w-40 flex-1 border-none bg-transparent px-2 py-0 shadow-none ring-0 hover:bg-transparent focus:bg-transparent focus:ring-0";
