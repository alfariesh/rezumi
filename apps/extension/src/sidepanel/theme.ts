const darkQuery = "(prefers-color-scheme: dark)";

/** The panel follows the browser's light or dark appearance, as the web app's "System" theme does. */
export function followSystemTheme() {
	const media = matchMedia(darkQuery);
	const apply = () => {
		document.documentElement.classList.toggle("dark", media.matches);
		document.documentElement.style.colorScheme = media.matches ? "dark" : "light";
	};
	apply();
	media.addEventListener("change", apply);
}
