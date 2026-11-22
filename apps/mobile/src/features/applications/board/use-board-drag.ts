// Dragging a card: a long press lifts it (medium haptic) into a copy that follows the finger above the board; holding
// it at the board's left or right edge pages to the previous or next column, and letting go drops it. The card's own
// position runs on the UI thread; React hears only the lift, edge crossings and the drop.
import type { ApplicationSummary } from "@/features/applications/types";
import type { ComponentRef } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useEffect, useRef, useState } from "react";
import { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptics, useReducedMotion } from "@/ui";

/** How close to the board's side the finger pages the columns, and how often while it stays there. */
const EDGE = 32;
const EDGE_REPEAT_MS = 700;

export type DragPoint = { absoluteX: number; absoluteY: number; x: number; y: number };

export type DragHandlers = {
	start: (application: ApplicationSummary, point: DragPoint, width: number) => void;
	end: (drop: boolean, absoluteX: number) => void;
	motion: { x: SharedValue<number>; y: SharedValue<number>; finger: SharedValue<number>; active: SharedValue<boolean> };
};

type Lifted = { application: ApplicationSummary; left: number; top: number; width: number };

type DragOptions = {
	/** Where the card was let go: the finger's x in the window, and the board's left edge in the window. */
	onDrop: (application: ApplicationSummary, absoluteX: number, boardX: number) => void;
	/** The finger reached (or stays at) an edge: page one column that way. */
	onEdge: (direction: -1 | 1) => void;
};

export function useBoardDrag({ onDrop, onEdge }: DragOptions) {
	const reduced = useReducedMotion();
	const board = useRef<ComponentRef<typeof View>>(null);
	const rect = useRef({ x: 0, y: 0 });
	const [lifted, setLifted] = useState<Lifted | null>(null);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const finger = useSharedValue(0);
	const active = useSharedValue(false);
	const lift = useSharedValue(1);
	const bounds = useSharedValue({ x: 0, width: 0 });
	const repeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

	const measure = (then?: () => void) =>
		board.current?.measureInWindow((left, top, width) => {
			rect.current = { x: left, y: top };
			bounds.set({ x: left, width });
			then?.();
		});

	const edge = (direction: -1 | 0 | 1) => {
		clearInterval(repeat.current);
		if (direction === 0) return;
		onEdge(direction);
		repeat.current = setInterval(() => onEdge(direction), EDGE_REPEAT_MS);
	};

	const handlers: DragHandlers = {
		motion: { x, y, finger, active },
		start: (application, point, width) => {
			haptics.medium();
			lift.set(withSpring(reduced ? 1 : 1.03, { duration: 260, dampingRatio: 0.8 }));
			const cornerX = point.absoluteX - point.x;
			const cornerY = point.absoluteY - point.y;
			const place = () =>
				setLifted({ application, left: cornerX - rect.current.x, top: cornerY - rect.current.y, width });
			place();
			measure(place);
		},
		end: (drop, absoluteX) => {
			edge(0);
			const application = lifted?.application;
			lift.set(1);
			setLifted(null);
			if (drop && application) onDrop(application, absoluteX, rect.current.x);
		},
	};
	// Cards hold a proxy that never changes, so a re-render mid-drag doesn't rebuild (and cancel) their gesture.
	const latest = useRef(handlers);
	useEffect(() => {
		latest.current = handlers;
	});
	const [stable] = useState<DragHandlers>(() => ({
		motion: handlers.motion,
		start: (...args) => latest.current.start(...args),
		end: (...args) => latest.current.end(...args),
	}));
	const latestEdge = useRef(edge);
	useEffect(() => {
		latestEdge.current = edge;
	});
	const [edgeProxy] = useState(() => (direction: -1 | 0 | 1) => latestEdge.current(direction));
	useEffect(() => () => clearInterval(repeat.current), []);

	useAnimatedReaction(
		() => {
			if (!active.get()) return 0;
			const area = bounds.get();
			const at = finger.get();
			return at < area.x + EDGE ? -1 : at > area.x + area.width - EDGE ? 1 : 0;
		},
		(current, previous) => {
			if (current !== previous) scheduleOnRN(edgeProxy, current as -1 | 0 | 1);
		},
	);

	const liftedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: lift.get() }],
	}));

	return { boardRef: board, onBoardLayout: () => measure(), lifted, handlers: stable, liftedStyle };
}
