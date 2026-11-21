// The interface fonts, bundled: static Google Sans 400–700 and Google Sans Code 400, cut from the OFL variable fonts
// the web loads (@fontsource-variable/google-sans, Latin, Latin Extended and Vietnamese; licences next to the files).
// Scripts they do not draw fall back to the system font. Each weight is its own family (global.css `--font-*`).
export const fontAssets = {
	"GoogleSans-Regular": require("../../assets/fonts/GoogleSans-Regular.ttf"),
	"GoogleSans-Medium": require("../../assets/fonts/GoogleSans-Medium.ttf"),
	"GoogleSans-SemiBold": require("../../assets/fonts/GoogleSans-SemiBold.ttf"),
	"GoogleSans-Bold": require("../../assets/fonts/GoogleSans-Bold.ttf"),
	"GoogleSansCode-Regular": require("../../assets/fonts/GoogleSansCode-Regular.ttf"),
};
