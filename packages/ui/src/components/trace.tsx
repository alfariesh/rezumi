import type { ComponentProps } from "react";
import { TextShimmer } from "@heroui-pro/react";
import { createContext, use } from "react";
import { cn } from "@rezumi/utils/style";

type TraceStatus = "running" | "error" | "pending" | undefined;

const TraceStatusContext = createContext<TraceStatus>(undefined);

type TraceLineProps = ComponentProps<"p"> & { status?: TraceStatus };

/**
 * One quiet line per step an agent took ("Read the resume", "Searching the web…"). A running step's title shimmers
 * (HeroUI Pro `TextShimmer`, which holds still under reduced motion), an error turns danger, a step that never
 * finished is dimmed.
 */
function TraceLine({ className, status, ...props }: TraceLineProps) {
	return (
		<TraceStatusContext value={status}>
			<p
				data-slot="trace-line"
				data-status={status}
				className={cn(
					"flex w-fit max-w-full min-w-0 items-center gap-1.5 text-xs text-muted data-[status=error]:text-danger data-[status=pending]:opacity-70",
					className,
				)}
				{...props}
			/>
		</TraceStatusContext>
	);
}

/** A fixed 14px slot, so the title doesn't shift when a spinner turns into a check. */
function TraceIcon({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="trace-icon"
			aria-hidden="true"
			className={cn("grid size-3.5 shrink-0 place-items-center", className)}
			{...props}
		/>
	);
}

function TraceTitle({ className, children, ...props }: ComponentProps<"span">) {
	const status = use(TraceStatusContext);
	return (
		<span data-slot="trace-title" className={cn("min-w-0", className)} {...props}>
			{status === "running" ? <TextShimmer>{children}</TextShimmer> : children}
		</span>
	);
}

export { TraceIcon, TraceLine, TraceTitle };
