/**
 * The intro effects that need a script (`02-teknis.md` section 23): typewriter, scramble and vector outline. Written
 * from scratch for Rezumi (not React Bits). Each one is a self-contained function of the document it runs in: it uses
 * only its parameter and browser globals, so the page inlines its source (`effectScript`) and the editor runs the same
 * function on its preview's document ("Replay"). Keep them free of imports, outer variables and comments inside the
 * bodies, and never assign a function to a name inside them (`const f = () => …`): some transpilers (tsx) wrap such
 * functions in a `__name` helper that only exists in their own module. The source is what visitors download.
 *
 * Every effect leaves the real text in place: the typewriter's phrases are all in the HTML, the scramble draws an
 * `aria-hidden` layer over the name (which keeps its size), and the vector outline wraps letters in spans and labels
 * the heading with the name. Each one stops by itself within five seconds, and none runs when the device asks for
 * less motion.
 */

type EffectRunner = (d: Document) => void;

/** Types the headline's phrases in turn, back to the first one, within about five seconds. */
const typewriter: EffectRunner = (d) => {
	const w = d.defaultView;
	if (!w || w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	d.querySelectorAll<HTMLElement>('[data-pfx="typewriter"]').forEach((el) => {
		const out = el.querySelector<HTMLElement>(".pfx-type__out");
		let list: string[] = [];
		try {
			list = JSON.parse(el.dataset.pfxPhrases || "[]");
		} catch {
			return;
		}
		if (!out || list.length < 2) return;
		(el as HTMLElement & { pfxStop?: () => void }).pfxStop?.();
		const timers: number[] = [];
		const first = [...(list[0] as string)];
		const order = [...list.slice(1), list[0] as string].map((phrase) => [...phrase]);
		let count = 0;
		order.reduce((current, next) => ((count += current.length + next.length), next), first);
		const step = Math.min(55, Math.max(16, 2900 / count));
		let at = 500;
		let current = first;
		const frames: [string, number][] = [];
		for (const next of order) {
			for (let i = current.length - 1; i >= 0; i--) frames.push([current.slice(0, i).join(""), (at += step * 0.6)]);
			for (let i = 1; i <= next.length; i++) frames.push([next.slice(0, i).join(""), (at += step)]);
			at += 600;
			current = next;
		}
		for (const [text, time] of frames) timers.push(w.setTimeout(() => (out.textContent = text), time));
		el.classList.remove("pfx-done");
		el.classList.add("pfx-on");
		out.textContent = first.join("");
		timers.push(w.setTimeout(() => el.classList.add("pfx-done"), at - 600));
		(el as HTMLElement & { pfxStop?: () => void }).pfxStop = () => {
			timers.forEach((timer) => w.clearTimeout(timer));
			out.textContent = first.join("");
			el.classList.add("pfx-done");
		};
	});
};

/** Random letters settle into the name from its start, once, in about 1.1 seconds. */
const scramble: EffectRunner = (d) => {
	const w = d.defaultView;
	if (!w || w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const begin = w.performance.now();
	(d.fonts ? d.fonts.ready : Promise.resolve()).then(() => {
		if (w.performance.now() - begin > 1200) return;
		d.querySelectorAll<HTMLElement>('[data-pfx="scramble"]').forEach((el) => {
			el.querySelector(".pfx-layer")?.remove();
			el.classList.remove("pfx-hide");
			const text = el.textContent || "";
			if (/[֐-ࣿ]/.test(text)) return;
			const box = el.getBoundingClientRect();
			const layer = d.createElement("span");
			layer.className = "pfx-layer";
			layer.setAttribute("aria-hidden", "true");
			layer.style.color = w.getComputedStyle(el).color;
			const cells: [HTMLElement, string][] = [];
			const walker = d.createTreeWalker(el, 4);
			const range = d.createRange();
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const data = node.textContent || "";
				for (let i = 0; i < data.length; i++) {
					const size = (data.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
					const ch = data.slice(i, i + size);
					const from = i;
					i += size - 1;
					if (/\s/.test(ch)) continue;
					range.setStart(node, from);
					range.setEnd(node, from + size);
					const r = range.getBoundingClientRect();
					const cell = d.createElement("span");
					cell.textContent = ch;
					cell.style.cssText = `left:${r.left - box.left}px;top:${r.top - box.top}px;width:${r.width}px;height:${r.height}px;line-height:${r.height}px`;
					layer.append(cell);
					cells.push([cell, ch]);
				}
			}
			const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+<>";
			const start = w.performance.now();
			el.classList.add("pfx-hide");
			el.append(layer);
			const timer = w.setInterval(() => {
				const t = w.performance.now() - start;
				let busy = false;
				cells.forEach(([cell, ch], i) => {
					if (t >= 250 + (i / cells.length) * 850) {
						cell.textContent = ch;
						cell.className = "";
					} else {
						busy = true;
						cell.textContent = glyphs[Math.floor(Math.random() * glyphs.length)] as string;
						cell.className = "pfx-scr";
					}
				});
				if (!busy || t > 2000) {
					w.clearInterval(timer);
					layer.remove();
					el.classList.remove("pfx-hide");
				}
			}, 50);
		});
	});
};

/**
 * On a desktop with a mouse, the letter under the pointer turns into a dashed outline inside a selection box with
 * handles and its size, like a design app; it returns 0.65 seconds after the pointer leaves. On touch screens and phones
 * the CSS plays the gentle fade-up instead.
 */
const vector: EffectRunner = (d) => {
	const w = d.defaultView;
	if (!w || w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	if (!w.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)").matches) return;
	d.querySelectorAll<HTMLElement>('[data-pfx="vector-hover"]').forEach((el) => {
		if (el.dataset.pfxReady) return;
		const text = (el.textContent || "").trim();
		if (/[֐-ࣿ]/.test(text)) {
			el.dataset.pfx = "fade-up";
			return;
		}
		el.dataset.pfxReady = "1";
		el.setAttribute("aria-label", text);
		const walker = d.createTreeWalker(el, 4);
		const nodes: Node[] = [];
		for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
		for (const node of nodes) {
			const parts = d.createDocumentFragment();
			for (const ch of node.textContent || "") {
				if (/\s/.test(ch)) parts.append(ch);
				else {
					const letter = d.createElement("span");
					letter.className = "pfx-c";
					letter.textContent = ch;
					parts.append(letter);
				}
			}
			(node as ChildNode).replaceWith(parts);
		}
		const timers = new Map<Element, number>();
		const svg = "http://www.w3.org/2000/svg";
		el.addEventListener("pointerover", (event) => {
			const letter = (event.target as Element).closest?.(".pfx-c");
			if (!letter) return;
			w.clearTimeout(timers.get(letter));
			if (!letter.querySelector(".pfx-vx")) {
				const r = letter.getBoundingClientRect();
				const probe = d.createElement("i");
				probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
				letter.append(probe);
				const baseline = probe.getBoundingClientRect().top - r.top;
				probe.remove();
				const upper = w.getComputedStyle(letter).textTransform === "uppercase";
				const box = d.createElement("span");
				box.className = "pfx-vx";
				box.setAttribute("aria-hidden", "true");
				box.style.cssText = `width:${r.width}px;height:${r.height}px`;
				const outline = d.createElementNS(svg, "svg");
				outline.setAttribute("width", String(r.width));
				outline.setAttribute("height", String(r.height));
				const glyph = d.createElementNS(svg, "text");
				glyph.setAttribute("y", String(baseline));
				glyph.textContent = upper ? (letter.textContent || "").toUpperCase() : letter.textContent;
				outline.append(glyph);
				const size = d.createElement("em");
				size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
				box.append(
					outline,
					d.createElement("b"),
					d.createElement("b"),
					d.createElement("b"),
					d.createElement("b"),
					size,
				);
				letter.append(box);
			}
			w.requestAnimationFrame(() => letter.classList.add("pfx-on"));
		});
		el.addEventListener("pointerout", (event) => {
			const letter = (event.target as Element).closest?.(".pfx-c");
			if (!letter) return;
			timers.set(
				letter,
				w.setTimeout(() => {
					letter.classList.remove("pfx-on");
					timers.set(
						letter,
						w.setTimeout(() => letter.querySelector(".pfx-vx")?.remove(), 300),
					);
				}, 650),
			);
		});
	});
};

/** The script effects by id; the others are CSS only. */
export const EFFECT_RUNNERS: Partial<Record<string, EffectRunner>> = {
	typewriter,
	scramble,
	"vector-hover": vector,
};
