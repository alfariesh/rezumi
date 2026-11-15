import type { ThinkingOrbMood } from "@rezumi/ui/components/thinking-orb";
import type { ReactNode } from "react";
import { TextShimmer } from "@heroui-pro/react";
import { m } from "motion/react";
import { createContext, use, useState } from "react";
import { ThinkingOrb } from "@rezumi/ui/components/thinking-orb";
import { cn } from "@rezumi/utils/style";
import { D3, EASE_MOVE } from "@/libs/motion";

/**
 * The orb's flight: the empty state's orb above the heading and the first "Thinking…" line share a Motion `layoutId`,
 * so sending the first message shrinks the orb and carries it down to sit beside the words. A fresh id per empty
 * state keeps an orb from flying in from a conversation that is long gone.
 */
const OrbFlight = createContext<string | undefined>(undefined);

let flights = 0;

type OrbFlightProviderProps = {
	/** Changes whenever the empty state comes back (a new chat), so each flight gets its own id. */
	epoch: string | number;
	children: ReactNode;
};

export function OrbFlightProvider({ epoch, children }: OrbFlightProviderProps) {
	const [instance] = useState(() => ++flights);
	return <OrbFlight value={`assistant-orb-${instance}-${epoch}`}>{children}</OrbFlight>;
}

/** How long the flight takes, in seconds. */
const FLIGHT = D3 + 0.24;

/**
 * Resolves once an orb leaving the empty state has landed. Call it as the first message is sent, before the
 * conversation's own view replaces the pending one: the thinking line mounts again there, and an orb still in flight
 * would jump. Resolves at once when no orb is resting on screen or motion is reduced.
 */
export function orbLanding(): Promise<void> {
	const resting = document.querySelector("[data-orb-resting]");
	if (!resting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
	return new Promise((resolve) => window.setTimeout(resolve, FLIGHT * 1000));
}

type OrbSlotProps = {
	size: number;
	mood: ThinkingOrbMood;
	fly: boolean;
	resting?: boolean;
	className?: string | undefined;
};

function OrbSlot({ size, mood, fly, resting = false, className }: OrbSlotProps) {
	const layoutId = use(OrbFlight);
	return (
		<m.span
			{...(fly && layoutId ? { layoutId } : {})}
			transition={{ layout: { duration: FLIGHT, ease: EASE_MOVE } }}
			data-orb-resting={resting || undefined}
			className={cn("inline-grid shrink-0 place-items-center", className)}
			style={{ width: size, height: size }}
		>
			<ThinkingOrb size={size} mood={mood} />
		</m.span>
	);
}

type HeadingOrbProps = { size?: number; className?: string };

/** The resting orb above an assistant's empty-state heading. */
export function HeadingOrb({ size = 64, className }: HeadingOrbProps) {
	return <OrbSlot size={size} mood="idle" fly resting className={className} />;
}

type ThinkingLineProps = {
	children: ReactNode;
	/** `writing` once words are streaming in. */
	mood?: Extract<ThinkingOrbMood, "thinking" | "writing">;
	/** The pending first message's line: the heading's orb flies into it. */
	fly?: boolean;
	className?: string;
};

/** "The assistant is working": a spinning orb and a shimmering line, in place of a spinner. */
export function ThinkingLine({ children, mood = "thinking", fly = false, className }: ThinkingLineProps) {
	return (
		<p
			data-slot="thinking-line"
			className={cn("flex w-fit max-w-full min-w-0 items-center gap-2 text-xs text-muted", className)}
		>
			<OrbSlot size={20} mood={mood} fly={fly} />
			<span className="min-w-0">
				<TextShimmer>{children}</TextShimmer>
			</span>
		</p>
	);
}
