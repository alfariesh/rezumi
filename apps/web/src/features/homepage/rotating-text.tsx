import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const segmenter =
	typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
// Inline-block letters break joining scripts (for example Arabic); those slide as one shaped word.
const separateLetters =
	/^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Mark}\p{Number}\p{Punctuation}\p{Separator}]*$/u;

type RotatingTextProps = {
	texts: string[];
	rotationInterval?: number;
};

/** React Bits' slide-up preset and last-to-first character stagger, with content-sized width and no background. */
export function RotatingText({ texts, rotationInterval = 2500 }: RotatingTextProps) {
	const [index, setIndex] = useState(0);
	const reducedMotion = useReducedMotion();
	const rootRef = useRef<HTMLSpanElement>(null);
	const inView = useInView(rootRef);
	const measureRef = useRef<HTMLSpanElement>(null);
	const width = useMotionValue<number | string>("auto");
	const text = texts[index % Math.max(texts.length, 1)] ?? "";
	const characters = separateLetters.test(text)
		? segmenter
			? Array.from(segmenter.segment(text), (part) => part.segment)
			: Array.from(text)
		: [text];

	useEffect(() => {
		if (reducedMotion !== false || !inView || texts.length < 2) return;
		let timer: number | undefined;
		const syncTimer = () => {
			window.clearInterval(timer);
			if (document.visibilityState === "visible") {
				timer = window.setInterval(() => setIndex((current) => current + 1), rotationInterval);
			}
		};
		syncTimer();
		document.addEventListener("visibilitychange", syncTimer);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", syncTimer);
		};
	}, [reducedMotion, inView, rotationInterval, texts.length]);

	useIsomorphicLayoutEffect(() => {
		const content = measureRef.current;
		if (!content) return;
		let controls: ReturnType<typeof animate> | undefined;
		let settled = false;
		const fit = () => {
			const target = content.getBoundingClientRect().width;
			if (!target) return;
			controls?.stop();
			if (!settled || reducedMotion) {
				width.set(target);
				settled = true;
			} else {
				controls = animate(width, target, { type: "spring", damping: 34, stiffness: 320 });
			}
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(content);
		return () => {
			observer.disconnect();
			controls?.stop();
		};
	}, [reducedMotion, width]);

	return (
		<motion.span
			ref={rootRef}
			dir="auto"
			aria-hidden="true"
			className="relative inline-flex overflow-hidden align-baseline text-accent"
			style={{ width }}
		>
			<span ref={measureRef} className="inline-flex w-max shrink-0 pb-[0.12em] whitespace-pre">
				<AnimatePresence mode="wait" initial={false}>
					<motion.span key={text} className="relative inline-flex whitespace-pre">
						{characters.map((character, characterIndex) => (
							<motion.span
								key={`${characterIndex}-${character}`}
								className="inline-block"
								initial={{ y: "100%", opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: "-120%", opacity: 0 }}
								transition={
									reducedMotion
										? { duration: 0 }
										: {
												type: "spring",
												damping: 25,
												stiffness: 300,
												delay: (characters.length - 1 - characterIndex) * 0.025,
											}
								}
							>
								{character}
							</motion.span>
						))}
					</motion.span>
				</AnimatePresence>
			</span>
		</motion.span>
	);
}
