import type { CSSProperties } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@rezumi/utils/style";

/**
 * Rezumi's AI orb: about a hundred dots that take a shape for each thing the assistant can be doing.
 *
 * - `idle`: the logo's "R" as a constellation (the bowl in sky blue, the pencil leg in orange), its stars linked, a
 *   signal of light running down the letter and the letter swaying a little. For empty states, above a heading.
 * - `thinking`: a spinning 3D sphere with an orange dawn drifting over it, a ripple running pole to pole and two comets
 *   (orange and blue) on tilted rings. For "the assistant is working" lines and AI buttons that are waiting.
 * - `writing`: a dotted Rubik's cube in Rezumi's colors turning slowly while its slices scramble in quick quarter
 *   turns, then replay in reverse until every face clicks back solved, rest, and go again (after the `solving` state of
 *   Libraries.dev's orbs). For "Writing an answer…", while words stream in.
 * - `error`: a glitch: the sphere loses its spin and dims to slate while its slices tear sideways and flash red, then
 *   snap back; a hard tear as the error lands, a smaller stutter every few seconds after. Beside an error message.
 *
 * Moving between moods, each dot leaves its shape at its own moment, so shapes dissolve into each other instead of
 * jumping. An orb that mounts as another leaves (the same "Thinking" line mounted again by the next view) starts from
 * that orb's shape, dot by dot, and pace, so the change reads as one orb carrying on.
 *
 * The sphere follows Libraries.dev's MIT `thinking-orbs` (Jakub Antalik): honestly 3D (rotated, depth-shaded,
 * z-sorted), drawn with plain 2D canvas arcs and lines only. Depth is carried by dot size and alpha, so the orb reads on
 * light and dark surfaces without knowing the theme; `tone="current"` draws it in the text color instead, for filled
 * buttons. The canvas draws at the size it is shown at (it measures itself each frame), so it stays crisp while a layout
 * animation scales it. Every orb pauses offscreen and in hidden tabs, and a settled idle or error orb draws at 30 fps;
 * reduced motion (followed live) gets one still frame per mood.
 */

export type ThinkingOrbMood = "idle" | "thinking" | "writing" | "error";

type ThinkingOrbProps = {
	/** CSS pixels, width and height. */
	size?: number;
	mood?: ThinkingOrbMood;
	/** `brand`: sky blue and orange. `current`: the text color, for an orb on a filled button. */
	tone?: "brand" | "current";
	className?: string;
	style?: CSSProperties;
	/** Announced as an image when given; otherwise the orb is decorative (the words beside it carry the meaning). */
	label?: string;
};

type Rgb = readonly [number, number, number];
type Vec = readonly [number, number, number];

const SKY: Rgb = [0, 186, 255];
const ORANGE: Rgb = [255, 128, 32];
/** Sky to orange passes through this warm white, like dawn light: a straight blend would pass through a muddy gray. */
const DAWN: Rgb = [255, 226, 190];
const SLATE: Rgb = [140, 154, 176];
const ALARM: Rgb = [242, 72, 52];
const TILT = 0.42;

// The shapes, as indexes into each dot's weights.
const LETTER = 0;
const SPHERE = 1;
const CUBE = 2;
const ERROR = 3;
const FORMS = 4;
const FORM_OF: Record<ThinkingOrbMood, number> = { idle: LETTER, thinking: SPHERE, writing: CUBE, error: ERROR };
/** How fast everything turns in each mood. */
const ENERGY: Record<ThinkingOrbMood, number> = { idle: 0.16, thinking: 1, writing: 0.7, error: 0.05 };
/** Seconds for a change of mood to finish, the last dot included. */
const MORPH = 0.9;

// ---- The logo, sampled to dots ----

// The logo's two shapes in its own 36-unit view box: the "R" bowl and the pencil that forms its leg (mirrored).
const LOGO_BOX = { x: 17.25, y: -12.7, size: 36 };
const LOGO_BOWL =
	"M38.712-9.872c11.815 1.207 15.452 14.746 5.807 20.069-.759.365-1.213.531-2.016.804-1.865-1.7-3.756-3.524-5.587-5.267 2.788-.019 5.934-1.596 5.817-4.581-.27-6.946-11.958-2.771-16.048-4.479-2.069-.862-6.033-5.023-7.686-6.585z";
const LOGO_PENCIL =
	"M20.434 3.63c.415.415.772.773 1.027 1.096.271.345.489.728.531 1.202a1.74 1.74 0 0 1 0 .403c-.042.473-.26.856-.531 1.201-.255.324-.612.682-1.027 1.097l-1.122 1.122-5.061-5.061 1.122-1.122c.415-.415.773-.773 1.097-1.027.345-.272.727-.489 1.201-.531a1.74 1.74 0 0 1 .403 0c.474.042.856.259 1.202.531.323.254.743.674 1.158 1.089ZM18.251 10.811l-7.813 7.814c-.769.769-1.303 1.303-1.994 1.59-.692.286-1.448.286-2.536.286H4.251a.75.75 0 0 1-.75-.75v-1.658c0-1.087-.001-1.843.285-2.535.287-.691.822-1.226 1.591-1.995l7.814-7.812 5.06 5.06Z";
/** About this many dots draw the letter; every other shape uses the same dots. */
const TARGET_DOTS = 104;

/** A stable pseudo-random number in [0, 1) for two integers. */
const hashOf = (a: number, b: number) => {
	const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
	return h - Math.floor(h);
};

type Glyph = { x: number; y: number; pencil: boolean };
type Shape = {
	glyph: Glyph[];
	/** The sphere point each dot goes to, paired top to bottom so the morph travels short distances. */
	lattice: Vec[];
	/** When each dot leaves its shape during a change of mood, 0–1. */
	stagger: number[];
	/** Neighbouring stars of the constellation, as index pairs. */
	links: [number, number][];
	/** The cube point each dot goes to (on a 4×4 grid per face) and the face it colors. */
	cube: { point: Vec; face: number }[];
};

let shape: Shape | null = null;

/** Samples the logo onto a hexagonal grid of dots (once, in the browser), centred and scaled to the unit square. */
function logoShape(): Shape {
	if (shape) return shape;
	const raster = 120;
	const canvas = document.createElement("canvas");
	canvas.width = raster;
	canvas.height = raster;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	let glyph: Glyph[] = [];
	let spacing = 12;
	if (context) {
		const scale = raster / LOGO_BOX.size;
		context.setTransform(scale, 0, 0, scale, -LOGO_BOX.x * scale, -LOGO_BOX.y * scale);
		context.fillStyle = "#f00";
		context.fill(new Path2D(LOGO_BOWL));
		context.transform(-1, 0, 0, 1, 48, 0);
		context.globalCompositeOperation = "lighter";
		context.fillStyle = "#0f0";
		context.fill(new Path2D(LOGO_PENCIL));
		const { data } = context.getImageData(0, 0, raster, raster);
		const sample = (step: number) => {
			const found: Glyph[] = [];
			const rowStep = step * 0.866;
			for (let row = 0, y = rowStep / 2; y < raster; row++, y += rowStep)
				for (let x = (row % 2 ? step / 2 : 0) + step / 4; x < raster; x += step) {
					const at = (Math.floor(y) * raster + Math.floor(x)) * 4;
					const pencil = (data[at + 1] ?? 0) > 127;
					if (pencil || (data[at] ?? 0) > 127) found.push({ x, y, pencil });
				}
			return found;
		};
		// The widest spacing that still gives enough dots.
		while (spacing > 2 && sample(spacing).length < TARGET_DOTS) spacing -= 0.1;
		glyph = sample(spacing);
	}
	if (glyph.length === 0) glyph = [{ x: 0, y: 0, pencil: false }];

	const xs = glyph.map((dot) => dot.x);
	const ys = glyph.map((dot) => dot.y);
	const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
	const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
	const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;
	for (const dot of glyph) {
		dot.x = (dot.x - cx) / half;
		dot.y = (dot.y - cy) / half;
	}
	glyph.sort((a, b) => a.y - b.y || a.x - b.x);

	const count = glyph.length;
	const lattice = glyph.map((_, index): Vec => {
		const y = 1 - (2 * (index + 0.5)) / count;
		const ring = Math.sqrt(1 - y * y);
		const angle = index * Math.PI * (3 - Math.sqrt(5));
		return [ring * Math.cos(angle), y, ring * Math.sin(angle)];
	});
	const stagger = glyph.map((_, index) => hashOf(index, 0));
	const reach = (spacing / half) * 1.15;
	const links: [number, number][] = [];
	glyph.forEach((a, i) => {
		for (let j = i + 1; j < count; j++) {
			const b = glyph[j];
			if (b && Math.hypot(a.x - b.x, a.y - b.y) < reach) links.push([i, j]);
		}
	});

	// The cube's stickers: 6 faces × 16, top first; a few dots double up on a sticker when there are more dots than 96.
	const steps = [-0.75, -0.25, 0.25, 0.75];
	const stickers: { point: Vec; face: number }[] = [];
	for (let axis = 0; axis < 3; axis++)
		for (const sign of [-1, 1])
			for (const u of steps)
				for (const v of steps) {
					const point: Vec = axis === 0 ? [sign, u, v] : axis === 1 ? [u, sign, v] : [u, v, sign];
					stickers.push({ point, face: axis * 2 + (sign > 0 ? 1 : 0) });
				}
	stickers.sort((a, b) => b.point[1] - a.point[1]);
	const cube = glyph.map(
		(_, index) => stickers[Math.floor((index * stickers.length) / count)] ?? { point: [0, 0, 1] as Vec, face: 0 },
	);

	shape = { glyph, lattice, stagger, links, cube };
	return shape;
}

// ---- Small helpers ----

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

/** Each face of the cube: opposite faces are the same hue, light and deep. */
const FACES: Rgb[] = [SKY, [0, 112, 214], DAWN, [255, 172, 64], ORANGE, [150, 220, 255]];

// The cube's solver heartbeat: rapid eased quarter turns scramble it, then replay in reverse so every face clicks back
// solved, a rest, and again (Libraries.dev `thinking-orbs`, MIT).
type Move = { axis: 0 | 1 | 2; low: number; high: number; angle: number };
const MOVES: Move[] = Array.from({ length: 8 }, (_, index) => {
	const pick = (salt: number) => hashOf(index, salt);
	const axis = Math.min(2, Math.floor(pick(2.3) * 3)) as 0 | 1 | 2;
	const low = -1 + 0.5 * Math.min(3, Math.floor(pick(5.9) * 4));
	// The outer slices take the face itself (a coordinate of exactly ±1) too.
	return {
		axis,
		low: low === -1 ? -1.01 : low,
		high: low === 0.5 ? 1.01 : low + 0.5,
		angle: ((pick(7.7) < 0.5 ? 1 : -1) * Math.PI) / 2,
	};
});
const MOVE_TIME = 0.34;
const MOVE_REST = 0.9;

/** How far each move has turned at `time` (0–1), and the move turning now. */
function solveCycle(time: number) {
	const count = MOVES.length;
	const cycle = 2 * count * MOVE_TIME + MOVE_REST;
	const at = time % cycle;
	const amount = Array.from({ length: count }, () => 0);
	let active = -1;
	if (at < 2 * count * MOVE_TIME) {
		const slot = Math.floor(at / MOVE_TIME);
		const eased = 1 - (1 - Math.min(1, (at - slot * MOVE_TIME) / MOVE_TIME / 0.7)) ** 3;
		const move = slot < count ? slot : 2 * count - 1 - slot;
		for (let i = 0; i < move; i++) amount[i] = 1;
		amount[move] = slot < count ? eased : 1 - eased;
		active = move;
	}
	return { amount, active };
}

/** A cube point after the moves so far; whether it sits in the slice turning now. */
function turnPoint([px, py, pz]: Vec, cycle: ReturnType<typeof solveCycle>): [number, number, number, boolean] {
	let x = px;
	let y = py;
	let z = pz;
	let turning = false;
	MOVES.forEach((move, index) => {
		const amount = cycle.amount[index] ?? 0;
		if (amount <= 0) return;
		const coord = move.axis === 0 ? x : move.axis === 1 ? y : z;
		if (coord < move.low || coord >= move.high) return;
		if (index === cycle.active) turning = true;
		const cos = Math.cos(move.angle * amount);
		const sin = Math.sin(move.angle * amount);
		if (move.axis === 0) [y, z] = [y * cos - z * sin, y * sin + z * cos];
		else if (move.axis === 1) [x, z] = [x * cos + z * sin, -x * sin + z * cos];
		else [x, y] = [x * cos - y * sin, x * sin + y * cos];
	});
	return [x, y, z, turning];
}

const smoothstep = (from: number, to: number, value: number) => {
	const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
	return t * t * (3 - 2 * t);
};

const rgba = (color: Rgb, alpha: number) =>
	`rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha.toFixed(3)})`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
];

const warmColor = (warmth: number): Rgb =>
	warmth < 0.5 ? mix(SKY, DAWN, (warmth * 2) ** 1.5 * 0.85) : mix(DAWN, ORANGE, 0.15 + 0.85 * (warmth * 2 - 1));

let swatch: CanvasRenderingContext2D | null = null;

/** Any CSS color (the theme's are oklch) as RGB, by painting one pixel with it. */
function resolveColor(value: string): Rgb | null {
	if (!swatch) {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		swatch = canvas.getContext("2d", { willReadFrequently: true });
	}
	if (!swatch) return null;
	swatch.clearRect(0, 0, 1, 1);
	swatch.fillStyle = value;
	swatch.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0, a = 0] = swatch.getImageData(0, 0, 1, 1).data;
	return a === 0 ? null : [r, g, b];
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
	const query = window.matchMedia(REDUCED_MOTION);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

// ---- Time ----

type Phase = { spin: number; sun: number; wave: number; comet: number; time: number };

function advance(phase: Phase, dt: number, energy: number) {
	phase.spin += dt * (0.22 + 1.05 * energy);
	phase.sun += dt * (0.3 + 0.55 * energy);
	phase.wave += dt * (0.5 + 3 * energy);
	phase.comet += dt * (0.55 + 2.1 * energy);
	phase.time += dt;
}

/**
 * The last orb that left the screen: when, and its phase, pace and each dot's shape (every orb has the same dots). An
 * orb mounting within moments of it carries on from there, so it reads as the same orb. Orbs on screen together never
 * take each other's shape.
 */
const lastGone: { at: number; energy: number; phase: Phase; weights: Float32Array | null } = {
	at: Number.NEGATIVE_INFINITY,
	energy: 0,
	phase: { spin: 0.9, sun: 0.4, wave: 0, comet: 0.6, time: 0 },
	weights: null,
};

// ---- Drawing ----

type Mark = { x: number; y: number; z: number; r: number; color: Rgb; alpha: number };

type Frame = {
	size: number;
	phase: Phase;
	energy: number;
	/** Each dot's weight per shape, `FORMS` numbers per dot; they sum to 1. */
	weights: Float32Array;
	/** Seconds since the orb last went into `error`, for its glitch. */
	sinceError: number;
	/** Every mark in this color instead of the brand's (`tone="current"`). */
	ink: Rgb | null;
};

/** Draws one frame (the context is already scaled to CSS pixels). */
function paint(context: CanvasRenderingContext2D, frame: Frame) {
	const { size, phase, energy, weights } = frame;
	const { glyph, lattice, links, cube } = logoShape();
	const count = glyph.length;
	const center = size / 2;
	const breathe = 1 + 0.035 * Math.sin(phase.time * 1.6) * (1 - 0.6 * energy);
	const radius = size * 0.335 * breathe;
	const dot = 0.35 + size * 0.018;
	const letter = radius * 1.12;

	// How much of the orb is in each shape, for what belongs to a shape as a whole (comets, ink, links, halo).
	const share = [0, 0, 0, 0];
	for (let i = 0; i < count * FORMS; i++) share[i % FORMS] = (share[i % FORMS] ?? 0) + (weights[i] ?? 0) / count;
	const [letterShare = 0, sphereShare = 0, , errorShare = 0] = share;

	// The glitch: a hard tear once the dots have mostly turned (0.45 s in), then a smaller stutter every 2.4 s; the tear pattern changes 12 times a
	// second while it lasts.
	const since = frame.sinceError;
	const glitch = Number.isFinite(since)
		? Math.max(Math.exp(-((since - 0.45) ** 2) / 0.02), 0.8 * Math.exp(-(((since % 2.4) - 0.45) ** 2) / 0.012))
		: 0;
	const tearSeed = Math.floor(phase.time * 12);

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

	// A soft halo, blue at the heart and warm at the rim (red and dimmer in error); too faint to matter at inline sizes.
	if (size >= 28 && !frame.ink) {
		const halo = context.createRadialGradient(center, center, radius * 0.3, center, center, size / 2);
		const calm = 1 - errorShare;
		halo.addColorStop(0, rgba(mix(SKY, ALARM, errorShare), (0.12 + 0.1 * energy) * (0.5 + 0.5 * calm)));
		halo.addColorStop(0.62, rgba(mix(ORANGE, ALARM, errorShare), 0.03 + 0.06 * energy));
		halo.addColorStop(1, rgba(SKY, 0));
		context.fillStyle = halo;
		context.fillRect(0, 0, size, size);
	}

	// The letter sways a little; a band of dawn light sweeps across it now and then, and a signal runs down its stars.
	const sway = 0.38 * Math.sin(phase.time * 0.7);
	const swayCos = Math.cos(sway);
	const swaySin = Math.sin(sway);
	const sweep = ((phase.time * 0.45) % 3) * 2.4 - 3.2;
	const signal = (phase.time * 0.9) % 1;

	// The sphere's sun: an orange cap drifting over the surface, wider while thinking.
	const sun = normalize([Math.cos(phase.sun), 0.45 * Math.sin(phase.sun * 0.7), Math.sin(phase.sun)]);
	const ripple = 0.015 + 0.07 * energy;

	// The cube turns slowly on its own, tilted toward the viewer, while its slices scramble and solve.
	const cycle = solveCycle(phase.time);
	const half = radius * 0.74;
	const cubeYaw = phase.spin * 0.45 + 0.6;
	const cubeSin = Math.sin(cubeYaw);
	const cubeCos = Math.cos(cubeYaw);
	const cubeTilt = 0.5 + 0.08 * Math.sin(phase.time * 0.9);
	const tiltSin = Math.sin(cubeTilt);
	const tiltCos = Math.cos(cubeTilt);

	const marks: Mark[] = [];
	const stars: Mark[] = [];
	for (let i = 0; i < count; i++) {
		const point = glyph[i] ?? { x: 0, y: 0, pencil: false };
		const w = (form: number) => weights[i * FORMS + form] ?? 0;
		let x = 0;
		let y = 0;
		let z = 0;
		let r = 0;
		let alpha = 0;
		let color: Rgb = [0, 0, 0];
		const add = (weight: number, mark: Mark) => {
			if (weight < 0.001) return;
			x += mark.x * weight;
			y += mark.y * weight;
			z += mark.z * weight;
			r += mark.r * weight;
			alpha += mark.alpha * weight;
			color = [color[0] + mark.color[0] * weight, color[1] + mark.color[1] * weight, color[2] + mark.color[2] * weight];
		};

		const light = Math.exp(-((point.x + point.y - sweep) ** 2) * 6);
		const base = point.pencil ? ORANGE : SKY;
		const lx = center + point.x * letter * swayCos;
		const ly = center + point.y * letter;
		const lz = -point.x * letter * swaySin;

		const pulse = Math.exp(-((i / count - signal) ** 2) * 160);
		add(w(LETTER), {
			x: lx,
			y: ly,
			z: lz,
			r: dot * (0.62 + 0.35 * light) * (1 + 0.5 * pulse),
			color: mix(base, DAWN, Math.min(1, light * 0.7 + pulse * 0.5)),
			alpha: 0.95,
		});

		if (w(SPHERE) >= 0.001) {
			const [ux, uy, uz] = lattice[i] ?? [0, 0, 1];
			const lift = radius * (1 + ripple * Math.sin(uy * 5 - phase.wave));
			const [sx, sy2, sz] = project(ux * lift, uy * lift, uz * lift);
			const depth = (sz / lift + 1) / 2;
			const warmth = smoothstep(0.1 - 0.25 * energy, 0.8, ux * sun[0] + uy * sun[1] + uz * sun[2]);
			add(w(SPHERE), {
				x: sx,
				y: sy2,
				z: sz,
				r: dot * (0.42 + 0.78 * depth) * (1 + 0.25 * warmth),
				color: warmColor(warmth),
				alpha: 0.12 + 0.88 * depth ** 1.4,
			});
		}

		if (w(CUBE) >= 0.001) {
			const sticker = cube[i] ?? { point: [0, 0, 1] as Vec, face: 0 };
			const [cx0, cy0, cz0, turning] = turnPoint(sticker.point, cycle);
			const x1 = cx0 * cubeCos + cz0 * cubeSin;
			const z1 = -cx0 * cubeSin + cz0 * cubeCos;
			const y2 = cy0 * tiltCos - z1 * tiltSin;
			const z2 = cy0 * tiltSin + z1 * tiltCos;
			const depth = (z2 / 1.74 + 1) / 2;
			add(w(CUBE), {
				x: center + x1 * half,
				y: center - y2 * half,
				z: z2 * half,
				r: dot * (0.5 + 0.75 * depth) * (turning ? 1.2 : 1),
				color: mix(FACES[sticker.face] ?? SKY, DAWN, turning ? 0.25 : 0),
				alpha: 0.18 + 0.82 * depth ** 1.3,
			});
		}

		if (w(ERROR) >= 0.001) {
			// The sphere, stalled and dimmed, its horizontal slices torn sideways (and red) during a glitch.
			const [ux, uy, uz] = lattice[i] ?? [0, 0, 1];
			const [ex, ey, ez] = project(ux * radius, uy * radius, uz * radius);
			const depth = (ez / radius + 1) / 2;
			const band = Math.floor((uy + 1) * 4);
			const tears = hashOf(band, 3) > 0.45;
			const shift = tears ? (hashOf(band, tearSeed) - 0.5) * size * 0.22 * glitch : 0;
			const hot = Math.min(1, Math.abs(shift) / (size * 0.06));
			add(w(ERROR), {
				x: ex + shift,
				y: ey,
				z: ez,
				r: dot * (0.42 + 0.78 * depth),
				color: mix(SLATE, ALARM, hot),
				alpha: (0.12 + 0.88 * depth ** 1.4) * (0.65 + 0.35 * hot),
			});
		}

		const mark = { x, y, z, r, color, alpha };
		stars.push(mark);
		marks.push(mark);
	}

	// The constellation's links: drawn under the stars, fading as the stars leave the letter.
	if (letterShare > 0.01) {
		context.lineWidth = Math.max(0.4, size * 0.006);
		for (const [i, j] of links) {
			const a = stars[i];
			const b = stars[j];
			if (!a || !b) continue;
			const hold = Math.min(weights[i * FORMS + LETTER] ?? 0, weights[j * FORMS + LETTER] ?? 0);
			const pulse = Math.exp(-((i / count - signal) ** 2) * 160);
			const alpha = (0.45 + 0.55 * pulse) * hold;
			if (alpha < 0.02) continue;
			context.strokeStyle = rgba(frame.ink ?? mix(a.color, DAWN, pulse * 0.6), alpha * (frame.ink ? 0.6 : 1));
			context.beginPath();
			context.moveTo(a.x, a.y);
			context.lineTo(b.x, b.y);
			context.stroke();
		}
	}

	// Comets with fading tails, just outside the sphere.
	const ring = radius * 1.3;
	COMETS.forEach(({ plane: [u, v], color, direction }, index) => {
		const strength = sphereShare * (index === 0 ? smoothstep(0.25, 0.8, energy) : energy ** 1.5);
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
		context.fillStyle = rgba(frame.ink ?? mark.color, Math.min(1, mark.alpha));
		context.beginPath();
		context.arc(mark.x, mark.y, Math.max(0.3, mark.r), 0, Math.PI * 2);
		context.fill();
	}
}

export function ThinkingOrb({
	size = 64,
	mood = "thinking",
	tone = "brand",
	className,
	style,
	label,
}: ThinkingOrbProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const moodRef = useRef(mood);
	const reduced = useSyncExternalStore(
		subscribeReducedMotion,
		() => window.matchMedia(REDUCED_MOTION).matches,
		() => false,
	);
	const redrawRef = useRef<() => void>(() => undefined);

	useEffect(() => {
		moodRef.current = mood;
		redrawRef.current();
	}, [mood]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;

		const { glyph, stagger } = logoShape();
		const count = glyph.length;
		const ratio = Math.min(2, window.devicePixelRatio || 1);
		const now = performance.now();
		// Carry on from an orb that just left; otherwise start as the "R" at rest and get going.
		const takeover = now - lastGone.at < 200;
		const phase: Phase = takeover ? { ...lastGone.phase } : { spin: 0.9, sun: 0.4, wave: 0, comet: 0.6, time: 0 };
		let energy = takeover ? lastGone.energy : ENERGY.idle;
		const weights = new Float32Array(count * FORMS);
		if (takeover && lastGone.weights?.length === weights.length) weights.set(lastGone.weights);
		else for (let i = 0; i < count; i++) weights[i * FORMS + LETTER] = 1;
		let from = weights.slice();
		let form = -1;
		let progress = 1;
		let errorAt = Number.NEGATIVE_INFINITY;
		let ink: Rgb | null = null;
		let inkReadAt = Number.NEGATIVE_INFINITY;
		let drawnAt = Number.NEGATIVE_INFINITY;

		/** Starts a change of shape when the mood changed. */
		const follow = () => {
			const next = FORM_OF[moodRef.current];
			if (next === form) return;
			from = weights.slice();
			progress = 0;
			if (next === ERROR) errorAt = phase.time;
			form = next;
		};

		/** Moves every dot along its own share of the change, so shapes dissolve dot by dot. */
		const settle = (dt: number) => {
			progress = Math.min(1, progress + dt / MORPH);
			for (let i = 0; i < count; i++) {
				const own = smoothstep(0, 1, progress * 1.7 - (stagger[i] ?? 0) * 0.7);
				for (let f = 0; f < FORMS; f++) {
					const at = i * FORMS + f;
					weights[at] = (from[at] ?? 0) * (1 - own) + (f === form ? own : 0);
				}
			}
		};

		const draw = (time: number) => {
			if (tone === "current" && time - inkReadAt > 500) {
				ink = resolveColor(getComputedStyle(canvas).color);
				inkReadAt = time;
			}
			// The size it is shown at, transforms included: crisp while a layout animation scales it.
			const shown = canvas.getBoundingClientRect().width || size;
			const needed = Math.max(1, Math.round(shown * ratio));
			// Grow the backing store as needed, shrink it only when far too big: a flight scales it every frame.
			// A new canvas starts at the default 300×150, so a non-square store is resized too.
			if (canvas.width < needed || canvas.width > needed * 2 || canvas.height !== canvas.width) {
				canvas.width = needed;
				canvas.height = needed;
			}
			const scale = canvas.width / shown;
			context.setTransform(scale, 0, 0, scale, 0, 0);
			paint(context, { size: shown, phase, energy, weights, sinceError: phase.time - errorAt, ink });
		};

		if (reduced) {
			// One still frame per mood, in its final shape.
			redrawRef.current = () => {
				follow();
				progress = 1;
				from.fill(0);
				settle(0);
				energy = ENERGY[moodRef.current];
				errorAt = Number.NEGATIVE_INFINITY;
				draw(performance.now());
			};
			redrawRef.current();
			return () => {
				redrawRef.current = () => undefined;
			};
		}

		follow();
		let previous = now;
		let raf = 0;
		let running = false;
		const tick = (time: number) => {
			// A settled idle or error orb moves slowly: 30 fps is enough.
			const calm = progress === 1 && (form === LETTER || form === ERROR) && phase.time - errorAt > 1;
			if (calm && time - drawnAt < 32) {
				if (running) raf = requestAnimationFrame(tick);
				return;
			}
			drawnAt = time;
			const dt = Math.min(0.05, (time - previous) / 1000);
			previous = time;
			follow();
			settle(dt);
			energy += (ENERGY[moodRef.current] - energy) * (1 - Math.exp(-dt * 3.5));
			advance(phase, dt, energy);
			draw(time);
			if (running) raf = requestAnimationFrame(tick);
		};
		const play = () => {
			if (running) return;
			running = true;
			previous = performance.now();
			raf = requestAnimationFrame(tick);
		};
		const pause = () => {
			running = false;
			cancelAnimationFrame(raf);
		};

		draw(now);
		let visible = true;
		const observer =
			typeof IntersectionObserver === "undefined"
				? null
				: new IntersectionObserver((entries) => {
						visible = entries.at(-1)?.isIntersecting ?? true;
						if (visible && document.visibilityState === "visible") play();
						else pause();
					});
		observer?.observe(canvas);
		if (!observer) play();
		const onVisibility = () => {
			if (document.visibilityState === "hidden") pause();
			else if (visible) play();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			pause();
			Object.assign(lastGone, { at: performance.now(), energy, phase: { ...phase }, weights: weights.slice() });
			observer?.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [size, tone, reduced]);

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
