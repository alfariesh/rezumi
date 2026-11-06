import type { ReactNode } from "react";
import { useRender } from "./context";

/** Interface icons the page draws itself, as 24 × 24 stroke paths (from the Phase 00 mockups). */
const UI_ICONS = {
	"arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
	"arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
	menu: <path d="M4 7h16M4 12h16M4 17h16" />,
	pin: (
		<>
			<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
			<circle cx="12" cy="9.5" r="2.5" />
		</>
	),
	resume: (
		<>
			<path d="M6 3h9l3 3v15H6z" />
			<path d="M9 10h6M9 14h6M9 18h4" />
		</>
	),
	pdf: (
		<>
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" />
		</>
	),
	mail: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="2" />
			<path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
		</>
	),
	whatsapp: (
		<>
			<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z" />
			<path d="M9 10.5c.5 1.8 2 3.3 3.8 3.8l1.2-1.1 2 .9c-.2 1.2-1.2 2-2.4 1.9A6.5 6.5 0 0 1 8.4 10c0-1.2.7-2.2 1.9-2.4l.9 2z" />
		</>
	),
	link: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
	"trend-up": <path d="M6 10l6-6 6 6M12 4v16" />,
	"trend-down": <path d="M6 14l6 6 6-6M12 20V4" />,
	"trend-flat": <path d="M4 12h16M14 6l6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type UiIconName = keyof typeof UI_ICONS;

type UiIconProps = { name: UiIconName; className?: string; flip?: boolean };

export function UiIcon(props: UiIconProps) {
	return (
		<svg
			className={[props.className ?? "pf-icon", props.flip ? "pf-flip" : ""].filter(Boolean).join(" ")}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{UI_ICONS[props.name]}
		</svg>
	);
}

type ResumeIconProps = { name: string | null | undefined; className?: string };

/** An icon from the resume icon set (service icons, metric icons, brand logos), when its shapes were loaded. */
export function ResumeIcon(props: ResumeIconProps) {
	const { icon } = useRender();
	const markup = icon(props.name);
	if (!markup) return null;
	return (
		<svg
			className={props.className ?? "pf-icon"}
			viewBox="0 0 24 24"
			aria-hidden="true"
			focusable="false"
			// oxlint-disable-next-line react/no-danger -- shapes from the app's own icon set, never from the portfolio's data.
			dangerouslySetInnerHTML={{ __html: markup }}
		/>
	);
}

/** The Rezumi mark, for the footer credit. */
export function RezumiMark() {
	return (
		<svg viewBox="17.25 -12.7 36 36" aria-hidden="true" focusable="false">
			<path
				fill="currentColor"
				opacity=".4"
				transform="translate(48 0) scale(-1 1)"
				d="M20.434 3.63c.415.415.772.773 1.027 1.096.271.345.489.728.531 1.202a1.74 1.74 0 0 1 0 .403c-.042.473-.26.856-.531 1.201-.255.324-.612.682-1.027 1.097l-1.122 1.122-5.061-5.061 1.122-1.122c.415-.415.773-.773 1.097-1.027.345-.272.727-.489 1.201-.531a1.74 1.74 0 0 1 .403 0c.474.042.856.259 1.202.531.323.254.743.674 1.158 1.089ZM18.251 10.811l-7.813 7.814c-.769.769-1.303 1.303-1.994 1.59-.692.286-1.448.286-2.536.286H4.251a.75.75 0 0 1-.75-.75v-1.658c0-1.087-.001-1.843.285-2.535.287-.691.822-1.226 1.591-1.995l7.814-7.812 5.06 5.06Z"
			/>
			<path
				fill="currentColor"
				transform="translate(48 0) scale(-1 1)"
				d="M18.074 2.009c.474.043.856.259 1.202.53.323.255.743.674 1.158 1.089s.772.773 1.027 1.097c.271.345.489.727.531 1.201.012.134.012.27 0 .404-.042.474-.26.856-.531 1.202-.255.323-.612.681-1.027 1.096l-1.122 1.121-5.061-5.06 1.122-1.121c.415-.415.773-.774 1.097-1.029.345-.271.727-.487 1.201-.53.134-.012.269-.012.403 0Z"
			/>
			<path
				fill="currentColor"
				d="M38.712-9.872c11.815 1.207 15.452 14.746 5.807 20.069-.759.365-1.213.531-2.016.804-1.865-1.7-3.756-3.524-5.587-5.267 2.788-.019 5.934-1.596 5.817-4.581-.27-6.946-11.958-2.771-16.048-4.479-2.069-.862-6.033-5.023-7.686-6.585z"
			/>
		</svg>
	);
}
