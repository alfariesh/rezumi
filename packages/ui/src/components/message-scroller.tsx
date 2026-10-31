/*
 * Message scroller: a chat transcript that follows a streaming reply only while the reader is at the live edge,
 * settles each new turn near the top, reopens a saved thread on its last turn, and offers a way back to the latest
 * message. Behaviour adapted from shadcn/react's message scroller (MIT License, Copyright (c) 2023 shadcn)
 * and owned here (see `message-scroller-controller.ts` and `message-scroller-logic.ts`); drawn with HeroUI tokens.
 *
 * Wrap every direct child of the content in `MessageScrollerItem`.
 */
import type { DefaultScrollPosition, Flag } from "./message-scroller-controller";
import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@heroui/react";
import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@rezumi/utils/style";
import { MessageScrollerController } from "./message-scroller-controller";
import { isScrollKey } from "./message-scroller-logic";

const MessageScrollerContext = createContext<MessageScrollerController | null>(null);

function useMessageScrollerController() {
	const controller = useContext(MessageScrollerContext);
	if (!controller) throw new Error("Message scroller parts must be used inside a MessageScrollerProvider.");
	return controller;
}

function useFlag(flag: Flag) {
	return useSyncExternalStore(flag.subscribe, flag.get, flag.get);
}

type MessageScrollerProviderProps = {
	children?: ReactNode;
	/** Follow new content, but only while the reader is at the latest message. */
	autoScroll?: boolean;
	/** Where a thread opens: at its end, or on its last turn's first row (the end when that turn fits). Read once. */
	defaultScrollPosition?: DefaultScrollPosition;
};

/** Owns the scroll state shared by the parts below. Wrap the scroller and anything else that sits beside it. */
function MessageScrollerProvider({
	autoScroll = false,
	defaultScrollPosition = "end",
	children,
}: MessageScrollerProviderProps) {
	const [controller] = useState(() => new MessageScrollerController({ autoScroll, defaultScrollPosition }));

	// The parts attach their elements first (children's refs and layout effects run before this), so by now there is
	// something to scroll.
	useLayoutEffect(() => {
		controller.mount();
		return () => controller.unmount();
	}, [controller]);
	useLayoutEffect(() => {
		controller.setAutoScroll(autoScroll);
	}, [controller, autoScroll]);

	return <MessageScrollerContext value={controller}>{children}</MessageScrollerContext>;
}

/** The frame: fills its parent, so put it in a height-constrained container. */
function MessageScroller({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="message-scroller"
			className={cn("group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden", className)}
			{...props}
		/>
	);
}

type MessageScrollerViewportProps = Omit<ComponentProps<"div">, "aria-label" | "ref"> & {
	/** Names the scrollable region; translate it. */
	"aria-label": string;
};

/** The scrolling region; it stays hidden until a saved thread has opened at its starting position. */
function MessageScrollerViewport({
	className,
	onKeyDown,
	onScroll,
	onTouchMove,
	onWheel,
	...props
}: MessageScrollerViewportProps) {
	const controller = useMessageScrollerController();
	const pendingScroll = useFlag(controller.pendingScroll);
	const attachViewport = useCallback((node: HTMLDivElement | null) => controller.attachViewport(node), [controller]);

	return (
		<div
			ref={attachViewport}
			role="region"
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be reachable by keyboard.
			tabIndex={0}
			{...props}
			data-slot="message-scroller-viewport"
			data-pending-scroll={pendingScroll ? "" : undefined}
			className={cn(
				"size-full min-h-0 min-w-0 scroll-fade-b [scrollbar-width:none] overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px] data-pending-scroll:invisible [&::-webkit-scrollbar]:hidden",
				className,
			)}
			onScroll={(event) => {
				controller.handleScroll();
				onScroll?.(event);
			}}
			onWheel={(event) => {
				controller.handleUserScrollIntent();
				onWheel?.(event);
			}}
			onTouchMove={(event) => {
				controller.handleUserScrollIntent();
				onTouchMove?.(event);
			}}
			onKeyDown={(event) => {
				if (isScrollKey(event.key)) controller.handleUserScrollIntent();
				onKeyDown?.(event);
			}}
		/>
	);
}

/** The transcript (`role="log"`): new rows are announced, streamed text is not read out token by token. */
function MessageScrollerContent({ className, children, ...props }: Omit<ComponentProps<"div">, "ref">) {
	const controller = useMessageScrollerController();
	const attachContent = useCallback((node: HTMLDivElement | null) => controller.attachContent(node), [controller]);
	const attachSpacer = useCallback((node: HTMLDivElement | null) => controller.attachSpacer(node), [controller]);

	return (
		<div
			ref={attachContent}
			role="log"
			aria-relevant="additions"
			{...props}
			data-slot="message-scroller-content"
			className={cn("flex h-max min-h-full flex-col", className)}
		>
			{children}
			<div ref={attachSpacer} aria-hidden="true" hidden data-slot="message-scroller-spacer" />
		</div>
	);
}

type MessageScrollerItemProps = ComponentProps<"div"> & {
	/** Identifies the row (`data-message-id`). */
	messageId?: string;
	/** Marks a row that starts a turn (the person's message): a new one settles near the top. */
	scrollAnchor?: boolean;
};

/** One transcript row. */
function MessageScrollerItem({ className, messageId, scrollAnchor = false, ...props }: MessageScrollerItemProps) {
	return (
		<div
			// The scroll logic reads `data-scroll-anchor` back from the DOM (see `isScrollAnchor`).
			data-message-id={messageId}
			data-scroll-anchor={scrollAnchor ? "true" : "false"}
			{...props}
			data-slot="message-scroller-item"
			className={cn("min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]", className)}
		/>
	);
}

type MessageScrollerButtonProps = Omit<ComponentProps<"button">, "children"> & {
	/** The label; pass it translated. */
	children: ReactNode;
};

function prefersReducedMotion() {
	return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * "Latest": appears while there is newer content below and returns the reader to the live edge, which resumes
 * following. Inert, and out of the tab order, while there is nothing to scroll to.
 */
function MessageScrollerButton({ className, onClick, tabIndex, ...props }: MessageScrollerButtonProps) {
	const controller = useMessageScrollerController();
	const active = useFlag(controller.canScrollToEnd);

	return (
		<button
			type="button"
			{...props}
			inert={!active}
			tabIndex={active ? tabIndex : -1}
			data-slot="message-scroller-button"
			data-active={active ? "true" : "false"}
			// Joined, not merged: the button variant's classes sit beside these, as they do on a plain HeroUI button.
			className={`${cn(
				"absolute inset-s-1/2 bottom-3 -translate-x-1/2 bg-overlay shadow-overlay transition-[translate,opacity] duration-standard ease-enter data-[active=false]:pointer-events-none data-[active=false]:translate-y-2 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:opacity-100 rtl:translate-x-1/2",
				className,
			)} ${buttonVariants({ variant: "secondary", size: "sm" })}`}
			onClick={(event) => {
				if (!active) return;
				onClick?.(event);
				if (event.defaultPrevented) return;
				event.currentTarget.blur();
				controller.scrollToEnd({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
			}}
		/>
	);
}

export {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
};
