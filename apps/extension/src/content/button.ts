import type { PageState } from "../shared/messages";

/**
 * The on-page "Save to Rezumi" button and "Saved · <status>" chip (01-desain.md §4). Drawn in a closed Shadow DOM so
 * the board's styles and ours never touch, with the brand mark as inline SVG (no web-accessible resources). It sits
 * beside the board's own Save/Apply buttons when the board's reader finds them, else floats in the corner.
 */

const TEXT = {
	en: {
		save: "Save to Rezumi",
		saved: "Saved",
		open: "Opens the Rezumi side panel",
		hide: "Hide this button on this site",
		toolbar: "Click the Rezumi icon in the toolbar to save",
		statuses: {
			saved: "Saved",
			applied: "Applied",
			screening: "Screening",
			interview: "Interview",
			offer: "Offer",
			closed: "Closed",
		},
	},
	id: {
		save: "Simpan ke Rezumi",
		saved: "Tersimpan",
		open: "Membuka panel samping Rezumi",
		hide: "Sembunyikan tombol ini di situs ini",
		toolbar: "Klik ikon Rezumi di toolbar untuk menyimpan",
		statuses: {
			saved: "Disimpan",
			applied: "Dilamar",
			screening: "Penyaringan",
			interview: "Wawancara",
			offer: "Penawaran",
			closed: "Tertutup",
		},
	},
} as const;

/** The label the button shows: "Save to Rezumi", or "Saved · Applied" once the posting is saved. */
export function buttonLabel(state: Pick<PageState, "saved" | "locale">): string {
	const text = TEXT[state.locale];
	if (!state.saved) return text.save;
	const status = text.statuses[state.saved.status as keyof typeof text.statuses] ?? state.saved.status;
	return status === text.statuses.saved ? text.saved : `${text.saved} · ${status}`;
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * Builds the icons with DOM calls, never `innerHTML`: some boards enforce Trusted Types, and nothing from a string is
 * parsed on their pages.
 */
function svgIcon(kind: "mark" | "check"): SVGSVGElement {
	const svg = document.createElementNS(SVG, "svg");
	const size = kind === "mark" ? "16" : "14";
	for (const [name, value] of Object.entries({ width: size, height: size, "aria-hidden": "true", focusable: "false" }))
		svg.setAttribute(name, value);
	const shape = (tag: string, attributes: Record<string, string>) => {
		const element = document.createElementNS(SVG, tag);
		for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
		svg.append(element);
	};
	if (kind === "mark") {
		// The Rezumi mark (public/icon), simplified to one path for 16 px.
		svg.setAttribute("viewBox", "0 0 24 24");
		shape("rect", { width: "24", height: "24", rx: "6", fill: "currentColor" });
		shape("path", {
			d: "M8 6.5h5.2a4 4 0 0 1 1.3 7.8L17 17.5h-2.8l-2.2-3H10.4v3H8z M10.4 8.7v3.6h2.7a1.8 1.8 0 0 0 0-3.6z",
			fill: "var(--rz-mark-ink)",
			"fill-rule": "evenodd",
		});
	} else {
		svg.setAttribute("viewBox", "0 0 16 16");
		shape("path", {
			d: "M3.5 8.5l3 3 6-7",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		});
	}
	return svg;
}

const STYLE = `
:host { all: initial; display: inline-flex; vertical-align: middle; margin-inline-start: 8px; }
:host([data-floating]) { position: fixed; inset-inline-end: 20px; inset-block-end: 20px; z-index: 2147483000; margin: 0; }
.wrap { display: inline-flex; align-items: center; gap: 4px; font: 600 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 6px 14px 6px 10px; border-radius: 999px; background: #18181b; color: #fafafa; --rz-mark-ink: #18181b; white-space: nowrap; transition: background-color .15s ease; }
button.main:hover { background: #3f3f46; }
button.main[data-saved] { background: #dcfce7; color: #14532d; --rz-mark-ink: #dcfce7; }
button.main[data-saved]:hover { background: #bbf7d0; }
button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
:host([data-floating]) button.main { box-shadow: 0 6px 20px rgba(0,0,0,.25); }
button.hide { min-height: 24px; width: 24px; padding: 0; justify-content: center; border-radius: 999px; background: #f4f4f5; color: #3f3f46; font-size: 14px; }
button.hide:hover { background: #e4e4e7; }
.hint { position: absolute; inset-block-end: calc(100% + 8px); inset-inline-end: 0; max-width: 260px; padding: 8px 10px; border-radius: 8px; background: #18181b; color: #fafafa; font: 500 12px/1.4 system-ui, sans-serif; white-space: normal; }
@media (prefers-color-scheme: dark) {
	button.main { background: #fafafa; color: #18181b; --rz-mark-ink: #fafafa; }
	button.main:hover { background: #e4e4e7; }
	button.main[data-saved] { background: #14532d; color: #dcfce7; --rz-mark-ink: #14532d; }
	button.main[data-saved]:hover { background: #166534; }
	button.hide { background: #27272a; color: #e4e4e7; }
}
`;

type ButtonOptions = {
	/** The person pressed the button: open the side panel. Resolves to whether it opened. */
	onPress: () => Promise<boolean>;
	/** The person closed the floating button on this board. */
	onHide: () => void;
};

export type SaveButton = {
	/** Shows the state, beside `anchor` or floating when it is null. */
	render(state: PageState, anchor: Element | null): void;
	remove(): void;
};

export function createSaveButton({ onPress, onHide }: ButtonOptions): SaveButton {
	const host = document.createElement("rezumi-save-button");
	const root = host.attachShadow({ mode: "closed" });
	const style = document.createElement("style");
	style.textContent = STYLE;
	const wrap = document.createElement("span");
	wrap.className = "wrap";
	wrap.style.position = "relative";
	const main = document.createElement("button");
	main.type = "button";
	main.className = "main";
	wrap.append(main);
	root.append(style, wrap);
	let hide: HTMLButtonElement | null = null;
	let current: PageState | null = null;
	let hint: HTMLElement | null = null;

	main.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		void onPress().then((opened) => {
			if (opened || !current) return;
			// The browser refused to open the panel from the page: point at the toolbar icon instead.
			hint?.remove();
			hint = document.createElement("span");
			hint.className = "hint";
			hint.setAttribute("role", "status");
			hint.textContent = TEXT[current.locale].toolbar;
			wrap.append(hint);
			if (__DEV__) host.dataset.rezumiHint = "toolbar";
			setTimeout(() => hint?.remove(), 6_000);
		});
	});

	const paint = (state: PageState, floating: boolean) => {
		const text = TEXT[state.locale];
		const label = buttonLabel(state);
		const caption = document.createElement("span");
		caption.textContent = label;
		main.replaceChildren(svgIcon(state.saved ? "check" : "mark"), caption);
		main.toggleAttribute("data-saved", Boolean(state.saved));
		// Development builds only: the shadow root is closed, so tests read the label here. Store builds never tell the
		// page anything about the person's applications.
		if (__DEV__) host.dataset.rezumiState = label;
		main.title = text.open;
		main.setAttribute("aria-label", `${label}. ${text.open}`);

		hide?.remove();
		hide = null;
		if (floating) {
			hide = document.createElement("button");
			hide.type = "button";
			hide.className = "hide";
			hide.textContent = "×";
			hide.title = text.hide;
			hide.setAttribute("aria-label", text.hide);
			hide.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				host.remove();
				onHide();
			});
			wrap.append(hide);
		}
	};

	return {
		render(state, anchor) {
			current = state;
			const floating = !anchor;
			if (!state.button || (floating && !state.floating)) {
				host.remove();
				return;
			}
			paint(state, floating);
			host.toggleAttribute("data-floating", floating);
			if (anchor) {
				if (host.parentElement !== anchor) anchor.append(host);
			} else if (host.parentElement !== document.body) {
				document.body.append(host);
			}
		},
		remove() {
			host.remove();
		},
	};
}
