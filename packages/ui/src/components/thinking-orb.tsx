import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@rezumi/utils/style";

/**
 * Rezumi's thinking orb: a dotted sphere in the logo's sky blue with an orange "sun" drifting over its surface and two
 * comets (orange and blue) on tilted rings. Inspired by Libraries.dev's MIT `thinking-orbs` (Jakub Antalik): honestly
 * 3D (rotated, depth-shaded, z-sorted), drawn with plain 2D canvas arcs only, so it looks the same in every browser.
 *
 * - `idle` turns slowly and breathes; one faint comet circles it. For empty states, above a heading.
 * - `thinking` spins up, a ripple runs pole to pole and both comets race. For "the assistant is working" lines.
 *
 * Switching moods eases between them instead of jumping. Depth is carried by dot size and alpha only, so the orb reads
 * on light and dark surfaces without knowing the theme. The canvas draws at the size it is shown at (it measures
 * itself each frame), so it stays crisp while a layout animation scales it. Every orb pauses offscreen and in hidden
 * tabs; reduced motion gets one still frame.
 */

export type ThinkingOrbMood = "idle" | "thinking";

type ThinkingOrbProps = {
	/** CSS pixels, width and height. */
	size?: number;
	mood?: ThinkingOrbMood;
	className?: string;
	style?: CSSProperties;
	/** Announced as an image when given; otherwise the orb is decorative (the words beside it carry the meaning). */
	label?: string;
};

type Rgb = readonly [number, number, number];

const SKY: Rgb = [0, 186, 255];
const ORANGE: Rgb = [255, 128, 32];
const DOTS = 96;
const TILT = 0.42;
const ENERGY: Record<ThinkingOrbMood, number> = { idle: 0.16, thinking: 1 };

/** Fibonacci lattice: stable, evenly spread directions on the unit sphere. */
const LATTICE = Array.from({ length: DOTS }, (_, index) => {
	const y = 1 - (2 * (index + 0.5)) / DOTS;
	const ring = Math.sqrt(1 - y * y);
	const angle = index * Math.PI * (3 - Math.sqrt(5));
	return [ring * Math.cos(angle), y, ring * Math.sin(angle)] as const;
});

type Vec = readonly [number, number, number];

function normalize([x, y, z]: Vec): Vec {
	const length = Math.hypot(x, y, z) || 1;
	return [x / length, y / length, z / length];
}

/** Two unit vectors spanning the plane whose normal is `normal`. */
function planeOf(normal: Vec): [Vec, Vec] {
	const [nx, ny, nz] = normalize(normal);
	const u = normalize([-ny, nx, 0]);
	const v: Vec = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]];
	return [u, v];
}

const COMETS = [
	{ plane: planeOf([0.35, 1, 0.2]), color: ORANGE, direction: 1 },
	{ plane: planeOf([-0.7, 0.75, 0.35]), color: SKY, direction: -1.35 },
] as const;
const TRAIL = 8;

type Phase = { spin: number; sun: number; wave: number; comet: number; time: number };

/**
 * The phase the last orb drew at. A new orb picks up from it, so an orb that replaces another (the empty state's orb
 * flying into the "Thinking" line) carries on mid-turn instead of snapping back.
 */
const lastPhase: Phase = { spin: 0.9, sun: 0.4, wave: 0, comet: 0.6, time: 0 };
/** The last orb's energy and when it drew: an orb replacing one that was just on screen keeps its pace too. */
const lastDraw = { energy: 0, at: -Infinity };

function advance(phase: Phase, dt: number, energy: number) {
	phase.spin += dt * (0.22 + 1.05 * energy);
	phase.sun += dt * (0.3 + 0.55 * energy);
	phase.wave += dt * (0.5 + 3 * energy);
	phase.comet += dt * (0.55 + 2.1 * energy);
	phase.time += dt;
}

const smoothstep = (from: number, to: number, value: number) => {
	const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
	return t * t * (3 - 2 * t);
};

const rgba = (color: Rgb, alpha: number) => `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(3)})`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
	Math.round(a[0] + (b[0] - a[0]) * t),
	Math.round(a[1] + (b[1] - a[1]) * t),
	Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Sky to orange through a warm white, like dawn light: a straight blend would pass through a muddy gray. */
const DAWN: Rgb = [255, 226, 190];
const warmColor = (warmth: number): Rgb =>
	warmth < 0.5 ? mix(SKY, DAWN, (warmth * 2) ** 1.5 * 0.85) : mix(DAWN, ORANGE, 0.15 + 0.85 * (warmth * 2 - 1));

type Mark = { x: number; y: number; z: number; r: number; color: Rgb; alpha: number };

/** Draws one frame of an orb `size` CSS pixels wide (the context is already scaled to CSS pixels). */
function paint(context: CanvasRenderingContext2D, size: number, phase: Phase, energy: number) {
	const center = size / 2;
	const breathe = 1 + 0.035 * Math.sin(phase.time * 1.6) * (1 - 0.6 * energy);
	const radius = size * 0.335 * breathe;
	const dot = 0.35 + size * 0.019;

	// Spin about the vertical axis, then tilt toward the viewer; orthographic.
	const sy = Math.sin(phase.spin);
	const cy = Math.cos(phase.spin);
	const st = Math.sin(TILT);
	const ct = Math.cos(TILT);
	const project = (x: number, y: number, z: number): Vec => {
		const x1 = x * cy + z * sy;
		const z1 = -x * sy + z * cy;
		return [center + x1, center - (y * ct - z1 * st), y * st + z1 * ct];
	};

	context.clearRect(0, 0, size, size);

	// A soft halo, blue at the heart and warm at the rim; too faint to matter at inline sizes.
	if (size >= 28) {
		const halo = context.createRadialGradient(center, center, radius * 0.3, center, center, size / 2);
		halo.addColorStop(0, rgba(SKY, 0.14 + 0.1 * energy));
		halo.addColorStop(0.62, rgba(ORANGE, 0.04 + 0.06 * energy));
		halo.addColorStop(1, rgba(SKY, 0));
		context.fillStyle = halo;
		context.fillRect(0, 0, size, size);
	}

	const marks: Mark[] = [];

	// The sun: an orange cap drifting over the surface, wider while thinking.
	const sun = normalize([Math.cos(phase.sun), 0.45 * Math.sin(phase.sun * 0.7), Math.sin(phase.sun)]);
	const ripple = 0.015 + 0.07 * energy;
	for (const [x, y, z] of LATTICE) {
		const lift = radius * (1 + ripple * Math.sin(y * 5 - phase.wave));
		const [px, py, pz] = project(x * lift, y * lift, z * lift);
		const depth = (pz / lift + 1) / 2;
		const warmth = smoothstep(0.1 - 0.25 * energy, 0.8, x * sun[0] + y * sun[1] + z * sun[2]);
		marks.push({
			x: px,
			y: py,
			z: pz,
			r: dot * (0.42 + 0.78 * depth) * (1 + 0.25 * warmth),
			color: warmColor(warmth),
			alpha: 0.12 + 0.88 * depth ** 1.4,
		});
	}

	// Comets with fading tails, just outside the sphere.
	const ring = radius * 1.3;
	COMETS.forEach(({ plane: [u, v], color, direction }, index) => {
		const strength = index === 0 ? 0.3 + 0.7 * energy : energy ** 1.5;
		if (strength < 0.03) return;
		const head = phase.comet * direction + index * Math.PI;
		for (let step = 0; step < TRAIL; step++) {
			const angle = head - Math.sign(direction) * step * 0.12;
			const cos = Math.cos(angle) * ring;
			const sin = Math.sin(angle) * ring;
			const [px, py, pz] = project(u[0] * cos + v[0] * sin, u[1] * cos + v[1] * sin, u[2] * cos + v[2] * sin);
			const depth = (pz / ring + 1) / 2;
			const fade = (1 - step / TRAIL) ** 1.6;
			marks.push({
				x: px,
				y: py,
				z: pz,
				r: dot * (1.55 - step * 0.13) * (0.7 + 0.5 * depth),
				color,
				alpha: strength * fade * (0.35 + 0.65 * depth),
			});
		}
	});

	marks.sort((a, b) => a.z - b.z);
	for (const mark of marks) {
		if (mark.alpha < 0.02) continue;
		context.fillStyle = rgba(mark.color, mark.alpha);
		context.beginPath();
		context.arc(mark.x, mark.y, Math.max(0.3, mark.r), 0, Math.PI * 2);
		context.fill();
	}
}

export function ThinkingOrb({ size = 64, mood = "thinking", className, style, label }: ThinkingOrbProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const target = useRef(ENERGY[mood]);

	useEffect(() => {
		target.current = ENERGY[mood];
	}, [mood]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;

		const ratio = Math.min(2, window.devicePixelRatio || 1);
		const phase: Phase = { ...lastPhase };
		// A thinking orb spins up from idle as it appears, so it visibly gets going, unless it takes over from an orb
		// that was drawing a moment ago (the same "Thinking" line mounted again), which keeps its pace.
		const takeover = performance.now() - lastDraw.at < 200;
		let energy = Math.min(target.current, takeover ? lastDraw.energy : ENERGY.idle);
		let previous = performance.now();

		const draw = () => {
			// The size it is shown at, transforms included: crisp while a layout animation scales it.
			const shown = canvas.getBoundingClientRect().width || size;
			const pixels = Math.max(1, Math.round(shown * ratio));
			if (canvas.width !== pixels) {
				canvas.width = pixels;
				canvas.height = pixels;
			}
			context.setTransform(pixels / shown, 0, 0, pixels / shown, 0, 0);
			paint(context, shown, phase, energy);
		};

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			energy = target.current;
			draw();
			return;
		}

		let frame = 0;
		let running = false;
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - previous) / 1000);
			previous = now;
			energy += (target.current - energy) * (1 - Math.exp(-dt * 3.5));
			advance(phase, dt, energy);
			Object.assign(lastPhase, phase);
			lastDraw.energy = energy;
			lastDraw.at = now;
			draw();
			if (running) frame = requestAnimationFrame(loop);
		};
		const start = () => {
			if (running) return;
			running = true;
			previous = performance.now();
			frame = requestAnimationFrame(loop);
		};
		const stop = () => {
			running = false;
			cancelAnimationFrame(frame);
		};

		draw();
		let visible = true;
		const observer =
			typeof IntersectionObserver === "undefined"
				? null
				: new IntersectionObserver(([entry]) => {
						visible = entry?.isIntersecting ?? true;
						if (visible && document.visibilityState === "visible") start();
						else stop();
					});
		observer?.observe(canvas);
		if (!observer) start();
		const onVisibility = () => {
			if (document.visibilityState === "hidden") stop();
			else if (visible) start();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			stop();
			observer?.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [size]);

	return (
		<canvas
			ref={canvasRef}
			data-slot="thinking-orb"
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
			className={cn("block shrink-0", className)}
			style={{ width: size, height: size, ...style }}
		/>
	);
}
