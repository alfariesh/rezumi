import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";

/**
 * The intro effects' rules (`01-desain.md` section 18, `02-teknis.md` section 23), written from scratch for Rezumi. A
 * page carries only the rules of the effect it plays. Motion runs only when the device doesn't ask for less of it;
 * without motion every effect is plain, readable text (the gradient stays as a still gradient).
 */
const SHARED = String.raw`
.pfx-w{display:inline-block}
@media (forced-colors:active){[data-pfx]{background:none!important;color:CanvasText!important}}
@keyframes pfx-up{from{opacity:.12;transform:translateY(.35em);filter:blur(6px)}}
`;

const WORDS = String.raw`[data-pfx] .pfx-w{animation:pfx-up .7s cubic-bezier(.2,.7,.2,1) calc(min(var(--i),8) * 90ms) both}`;

export const EFFECT_CSS: Record<Exclude<PortfolioHeroEffect, "none">, string> = {
	"fade-up": String.raw`@media (prefers-reduced-motion:no-preference){${WORDS}}`,
	// The sweep starts and ends on the text's own colour (`currentColor`: the glyphs turn transparent through
	// `-webkit-text-fill-color`, so `color` keeps it), so an accent headline ends in its accent, as without motion.
	shimmer: String.raw`
@media (prefers-reduced-motion:no-preference){[data-pfx="shimmer"]{background:linear-gradient(100deg,currentColor 0 38%,var(--pf-accent-text) 46%,color-mix(in oklab,var(--pf-accent-text) 55%,currentColor) 50%,var(--pf-accent-text) 54%,currentColor 62% 100%) 0 0/280% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:pfx-shimmer 1.6s ease-in-out 3 both}}
@media (forced-colors:active){[data-pfx="shimmer"]{-webkit-text-fill-color:currentColor}}
@keyframes pfx-shimmer{from{background-position:100% 0}to{background-position:0 0}}
`,
	gradient: String.raw`
[data-pfx="gradient"]{background:linear-gradient(90deg,var(--pf-fx-a),var(--pf-fx-b),var(--pf-fx-c),var(--pf-fx-a)) 0 0/300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
[data-bg="image"] [data-pfx="gradient"]{--pf-fx-a:var(--pf-fx-a-dark);--pf-fx-b:var(--pf-fx-b-dark);--pf-fx-c:var(--pf-fx-c-dark)}
@media (prefers-reduced-motion:no-preference){[data-pfx="gradient"]{animation:pfx-gradient 5s ease-in-out both}}
@keyframes pfx-gradient{from{background-position:0 0}to{background-position:100% 0}}
`,
	typewriter: String.raw`
.pfx-type{display:inline-grid;vertical-align:top;max-width:100%}
.pfx-type>*{grid-area:1/1}
.pfx-type__ghost{visibility:hidden}
.pfx-type__out{white-space:pre-wrap}
@media (prefers-reduced-motion:no-preference){.pfx-on .pfx-type__out::after{content:"";display:inline-block;width:2px;height:1em;margin-inline:2px -4px;vertical-align:-.12em;background:var(--pf-accent-text);animation:pfx-caret 1s steps(1) infinite}.pfx-on.pfx-done .pfx-type__out::after{animation:none;opacity:0;transition:opacity .4s}}
@keyframes pfx-caret{50%{opacity:0}}
`,
	scramble: String.raw`
[data-pfx="scramble"]{position:relative}
[data-pfx="scramble"].pfx-hide{color:transparent!important;-webkit-text-fill-color:transparent}
.pfx-layer{position:absolute;inset:0;pointer-events:none;-webkit-text-fill-color:currentColor}
.pfx-layer>span{position:absolute;white-space:pre}
.pfx-layer>.pfx-scr{color:var(--pf-accent-text)}
`,
	"vector-hover": String.raw`
@media (prefers-reduced-motion:no-preference) and ((hover:none) or (pointer:coarse) or (max-width:760px)){${WORDS}}
.pfx-c{position:relative;transition:color .35s}
.pfx-c.pfx-on{color:transparent}
.pfx-vx{position:absolute;inset-inline-start:0;top:0;pointer-events:none;opacity:0;transition:opacity .25s;outline:1px solid var(--pf-accent-text);outline-offset:.02em;direction:ltr;text-transform:none}
.pfx-on>.pfx-vx{opacity:1}
.pfx-vx svg{position:absolute;inset:0;overflow:visible}
.pfx-vx text{fill:none;stroke:var(--pf-accent-text);stroke-width:1.4px;stroke-dasharray:5 3;vector-effect:non-scaling-stroke}
.pfx-vx b{position:absolute;width:7px;height:7px;background:var(--pf-bg);border:1px solid var(--pf-accent-text)}
.pfx-vx b:nth-of-type(1){left:-4px;top:-4px}
.pfx-vx b:nth-of-type(2){right:-4px;top:-4px}
.pfx-vx b:nth-of-type(3){left:-4px;bottom:-4px}
.pfx-vx b:nth-of-type(4){right:-4px;bottom:-4px}
.pfx-vx em{position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);padding:1px 5px;border-radius:3px;background:var(--pf-accent-text);color:var(--pf-bg);font:600 10px/1.4 var(--pf-font-mono);font-style:normal;letter-spacing:0;white-space:nowrap}
`,
};

export { SHARED as EFFECT_SHARED_CSS };
