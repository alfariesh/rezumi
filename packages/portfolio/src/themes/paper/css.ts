import { PAPER_FIBRE_TEXTURE } from "./texture";

/** A 24px stroke icon as a CSS mask, drawn in the text colour where it is used. */
const icon = (d: string) =>
	`url("data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`,
	)}")`;

/** The short sections' label icons, original line drawings in the reference's stroke style. */
const SECTION_ICONS: Record<string, string> = {
	experience: "M3.5 8.5h17v11h-17zM8.5 8.5v-3h7v3M3.5 13.5h17",
	education: "M2.5 9 12 4.5 21.5 9 12 13.5zM6.5 11v5c3 2.2 8 2.2 11 0v-5",
	awards: "M12 14.5a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9.2 13.7 7.5 20.5l4.5-2.6 4.5 2.6-1.7-6.8",
	skills: "M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z",
	certifications: "M5.5 3.5h13v17h-13zM9 12l2 2 4-4",
	languages:
		"M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17",
	publications: "M3.5 5.5h6.5a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3.5zM20.5 5.5H14a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6.5z",
	volunteer: "M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z",
	interests: "M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z",
	profiles: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};

const sectionIcons = Object.entries(SECTION_ICONS)
	.map(
		([kind, d]) =>
			`.pf[data-theme="paper"] .pp-cell--${kind}.pp-cell--short>.pf-section__title::before{-webkit-mask-image:${icon(d)};mask-image:${icon(d)}}`,
	)
	.join("\n");

/**
 * The backdrop's paper folds, from the reference: one tall tile of 45° triangles and half-diamonds entering from either
 * edge, a shade lighter than the sheet so the margins change as the page scrolls.
 */
const folds = (fill: string, opacity: number) =>
	`url("data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='480' viewBox='0 0 100 480'><path d='M0 0H100L0 100Z M100 130V230L50 180Z M0 200L70 270L0 340Z M100 330V480H0V430Z' fill='${fill}' fill-opacity='${opacity}'/></svg>`,
	)}")`;

const ruler = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns='http://www.w3.org/2000/svg' width='30' height='120'><path d='M2 .25H29M2 10.25H16M2 20.25H16M2 30.25H22M2 40.25H16M2 50.25H16M2 60.25H26M2 70.25H16M2 80.25H16M2 90.25H22M2 100.25H16M2 110.25H16' stroke='#000' stroke-width='.5' stroke-linecap='round'/></svg>`,
)}")`;

const DARK = (rules: string) =>
	`@media screen{:root[data-pf-scheme="dark"] ${rules}}\n@media screen and (prefers-color-scheme:dark){:root[data-pf-scheme="auto"] ${rules}}`;

/**
 * Paper, after the author's own portfolio: a deeper sheet with lighter folds and the fibre texture, an edge ruler, a
 * wide intro over a design tool's window, then one bordered grid of white cells with 12px registration squares where
 * the lines meet, bold Google Sans titles, JetBrains Mono figures and orange ink for links.
 */
export const PAPER_CSS = String.raw`
.pf[data-theme="paper"]{--pf-max-width:1082px;--pf-radius:4px;--pf-radius-sm:3px;--pp-pad:60px;--pp-grid:1082px;position:relative;isolation:isolate;background:${folds("#ffffff", 0.72)} 0 0/100% auto repeat-y,var(--pf-surface);font-size:18px;line-height:28px}
.pf[data-theme="paper"]::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;opacity:.55;mix-blend-mode:multiply;background-image:url("${PAPER_FIBRE_TEXTURE}");background-size:1200px 300px}
.pf[data-theme="paper"]::after{content:"";position:absolute;inset-block:0;inset-inline-end:0;width:30px;pointer-events:none;z-index:-1;opacity:.4;background:var(--pf-text);-webkit-mask:${ruler} 0 0/30px 120px repeat-y;mask:${ruler} 0 0/30px 120px repeat-y}
${DARK(`.pf[data-theme="paper"]{background:${folds("#ffffff", 0.025)} 0 0/100% auto repeat-y,var(--pf-surface)}`)}
${DARK(`.pf[data-theme="paper"]::before{filter:invert(1);mix-blend-mode:screen;opacity:.35}`)}
.pf[data-theme="paper"] .pp-top{padding-block:14px}
.pf[data-theme="paper"] .pp-brand{font-size:19px;font-weight:500;letter-spacing:-.01em}
.pf[data-theme="paper"] .pp-monogram{display:grid;place-items:center;flex:none;width:30px;height:30px;background:var(--pf-accent);color:var(--pf-on-accent);border-radius:6px;font-size:12px;font-weight:700;letter-spacing:-.02em}
.pf[data-theme="paper"] .pp-top .pf-nav__links{gap:28px;font-size:17px}
.pf[data-theme="paper"] .pp-hello{margin-inline-start:20px}
.pf[data-theme="paper"] .pp-top .pf-nav__links>li:has(+.pp-hello){display:none}
@media (min-width:761px){.pf[data-theme="paper"] .pp-top{max-width:var(--pp-grid);padding-inline:24px;position:sticky;top:0;z-index:20;background:color-mix(in oklab,var(--pf-surface) 86%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}}
@supports (animation-timeline:scroll()){@media (min-width:761px){.pf[data-theme="paper"] .pp-top{animation:pp-stuck linear both;animation-timeline:scroll(root);animation-range:0 96px}}}
@keyframes pp-stuck{to{background:color-mix(in oklab,var(--pf-bg) 92%,transparent);box-shadow:0 1px 0 var(--pf-border),1px 0 0 var(--pf-border),-1px 0 0 var(--pf-border)}}
.pf[data-theme="paper"] .pp-hello .pf-btn{min-height:0;padding:0;margin:0;border:0;border-radius:0;background:none;color:var(--pf-text);font:500 17px/28px var(--pf-font-body)}
.pf[data-theme="paper"] .pp-hello .pf-btn::after{content:"\2192";margin-inline-start:2px}
.pf[data-theme="paper"][dir="rtl"] .pp-hello .pf-btn::after,[dir="rtl"] .pf[data-theme="paper"] .pp-hello .pf-btn::after{content:"\2190"}
.pf[data-theme="paper"] .pp-hello .pf-btn:hover{background:none;color:var(--pf-accent-text)}
.pf[data-theme="paper"] .pf-btn{min-height:40px;padding:6px 14px;border-radius:4px;font:500 18px/28px var(--pf-font-body);gap:8px}
.pf[data-theme="paper"] .pf-btn--primary{background:var(--pf-text);color:var(--pf-bg);border-color:var(--pf-text)}
.pf[data-theme="paper"] .pf-btn--primary:hover{background:var(--pf-text);filter:brightness(1.25)}
.pf[data-theme="paper"] .pf-btn--secondary{padding-inline:2px;border-color:transparent;background:none;color:var(--pf-muted)}
.pf[data-theme="paper"] .pf-btn--secondary:hover{border-color:transparent;color:var(--pf-text)}
.pf[data-theme="paper"] .pf-btn:active{transform:translateY(1px)}
.pf[data-theme="paper"] .pf-btns{gap:12px 24px;align-items:center}
.pf[data-theme="paper"] .pf-menu>summary,.pf[data-theme="paper"] .pf-menu__list{border-radius:4px}
.pf[data-theme="paper"] .pp-main{padding-top:clamp(40px,6vw,84px);padding-bottom:clamp(64px,8vw,112px)}
.pf[data-theme="paper"] .pp-hero{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(32px,5vw,64px);align-items:center;min-width:0;padding-inline:var(--pp-pad)}
.pf[data-theme="paper"] .pp-hero:has(.pp-hero__visual){grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
.pf[data-theme="paper"] .pp-hero:has(.pp-hero__stats){grid-template-columns:minmax(0,1fr) minmax(240px,320px);align-items:end}
.pf[data-theme="paper"] .pp-hero__stats{position:relative;min-width:0;border:1px solid var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="paper"] .pp-hero__stats .pp-handle{width:12px;height:12px;border-color:var(--pf-border);border-radius:1px}
.pf[data-theme="paper"] .pp-hero__stats .pp-stats.pf-metrics{--pf-metric-value:40px;grid-template-columns:minmax(0,1fr);gap:0}
.pf[data-theme="paper"] .pp-hero__stats .pf-metric{padding:24px 28px}
.pf[data-theme="paper"] .pp-hero__stats .pf-metric+.pf-metric{border-top:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-hero__copy{container-type:inline-size;display:flex;flex-direction:column;align-items:flex-start;gap:18px;min-width:0}
.pf[data-theme="paper"] .pp-avatar-frame{position:relative;display:block;margin:4px 0;padding:6px;border:1px solid var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="paper"] .pp-avatar-frame .pp-handle{width:9px;height:9px;border-color:var(--pf-border);border-radius:1px}
.pf[data-theme="paper"] .pp-avatar{display:block;width:80px;height:80px;object-fit:cover}
.pf[data-theme="paper"] .pp-name{max-width:16ch;font-size:max(2.25rem,min(clamp(2.5rem,5.2vw,4.25rem),calc(100cqi / (var(--name-word) * .58))));font-weight:700;line-height:1.08;letter-spacing:-.025em;text-wrap:balance}
.pf[data-theme="paper"] .pp-headline{max-width:24ch;margin-top:-10px;font:700 clamp(1.625rem,1rem + 2.4vw,3rem)/1.12 var(--pf-font-heading);letter-spacing:-.025em;color:var(--pf-muted);text-wrap:balance}
.pf[data-theme="paper"] .pp-greeting{max-width:600px;color:var(--pf-muted);font-size:20px;line-height:30px;text-wrap:pretty}
.pf[data-theme="paper"] .pp-hero .pf-btns{margin-top:12px}
.pf[data-theme="paper"] .pp-hero .pf-chip{padding:4px 12px;border:1px solid var(--pf-border);background:var(--pf-bg);color:var(--pf-muted);font-size:14px;line-height:20px;font-weight:400}
.pf[data-theme="paper"] .pp-hero .pf-chips{gap:8px}
.pf[data-theme="paper"] .pp-hero .pf-opento{color:var(--pf-muted);font-size:16px}
.pf[data-theme="paper"] .pp-hero[data-bg]:not([data-bg="plain"]){padding:var(--pp-pad);border-radius:12px;box-shadow:0 0 0 1px var(--pf-border);background:var(--pf-hero-bg)}
.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__visual{grid-column:1;grid-row:1}
.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"]:has(.pp-hero__visual){grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)}
.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__copy{grid-column:2;grid-row:1}
.pf[data-theme="paper"] .pp-hero__visual{position:relative;min-width:0;display:grid;place-items:center;padding:clamp(32px,4vw,56px);border-radius:12px;background:radial-gradient(var(--pf-border) 1px,transparent 1.2px) 0 0/16px 16px,var(--pf-surface);box-shadow:0 0 0 1px var(--pf-border),0 30px 30px -24px rgb(0 0 0/.12)}
.pf[data-theme="paper"] .pp-photo{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.pf[data-theme="paper"] .pp-artboard{position:relative;width:100%;background:var(--pf-bg);outline:1px solid var(--pf-accent);box-shadow:0 1px 2px rgb(0 0 0/.06),0 8px 24px -8px rgb(0 0 0/.12)}
.pf[data-theme="paper"] .pp-artboard--photo{max-width:380px}
.pf[data-theme="paper"] .pp-handle{position:absolute;z-index:1;width:8px;height:8px;border:1px solid var(--pf-accent);background:var(--pf-bg);translate:-50% -50%}
.pf[data-theme="paper"] .pp-handle--tl{top:0;left:0}
.pf[data-theme="paper"] .pp-handle--tr{top:0;left:100%}
.pf[data-theme="paper"] .pp-handle--bl{top:100%;left:0}
.pf[data-theme="paper"] .pp-handle--br{top:100%;left:100%}
.pf[data-theme="paper"] .pp-sheet{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:var(--pp-grid);margin:clamp(64px,8vw,104px) auto 0;border-block-start:1px solid var(--pf-border);border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-sheet::before,.pf[data-theme="paper"] .pp-sheet::after,.pf[data-theme="paper"] .pp-cell::before,.pf[data-theme="paper"] .pp-cell::after{content:"";position:absolute;z-index:3;width:12px;height:12px;translate:-50% -50%;border:1px solid var(--pf-border);border-radius:1px;background:var(--pf-bg);pointer-events:none}
.pf[data-theme="paper"] .pp-sheet::before,.pf[data-theme="paper"] .pp-sheet::after{top:-.5px}
.pf[data-theme="paper"] .pp-sheet::before{left:-.5px}
.pf[data-theme="paper"] .pp-sheet::after{left:calc(100% - .5px)}
.pf[data-theme="paper"] .pp-cell{position:relative;grid-column:1/-1;min-width:0;display:grid;align-content:start;gap:24px;padding:var(--pp-pad);background:var(--pf-bg);border-inline-end:1px solid var(--pf-border);border-block-end:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-cell::before,.pf[data-theme="paper"] .pp-cell::after{top:calc(100% - .5px)}
.pf[data-theme="paper"] .pp-cell::before{left:-.5px}
.pf[data-theme="paper"] .pp-cell::after{left:calc(100% - .5px)}
.pf[data-theme="paper"] .pp-cell--half{grid-column:span 1}
.pf[data-theme="paper"] .pp-cell__body{position:relative;z-index:1;min-width:0;display:grid;align-content:start;gap:24px}
.pf[data-theme="paper"] .pf-section__title{position:relative;z-index:1;max-width:18ch;font-size:clamp(2.25rem,1.6rem + 1.8vw,3.25rem);font-weight:700;line-height:1.05;letter-spacing:-.025em;text-wrap:balance}
.pf[data-theme="paper"] .pp-cell--short>.pf-section__title{display:flex;align-items:center;gap:8px;max-width:none;font-size:14px;line-height:20px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-cell--short>.pf-section__title::before{content:"";flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:no-repeat center/contain;mask:no-repeat center/contain}
${sectionIcons}
.pf[data-theme="paper"] .pp-cell--stats{padding-block:48px}
.pf[data-theme="paper"] .pp-stats.pf-metrics{--pf-metric-value:40px;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:28px 24px}
.pf[data-theme="paper"] .pp-stats .pf-metric{gap:10px}
.pf[data-theme="paper"] .pp-stats .pf-metric__value{font:700 var(--pf-metric-value)/1 var(--pf-font-mono);letter-spacing:-.04em;color:var(--pf-text)}
.pf[data-theme="paper"] .pp-stats .pf-metric__label{max-width:20ch;color:var(--pf-muted);font-size:18px;line-height:24px;font-weight:400}
.pf[data-theme="paper"] .pp-cell--about{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:48px;align-items:start;padding-block:clamp(56px,7vw,96px)}
.pf[data-theme="paper"] .pp-lead{font-size:20px;line-height:30px;text-wrap:pretty}
.pf[data-theme="paper"] .pp-lead p+p{margin-top:16px}
.pf[data-theme="paper"] .pp-lead strong{font-weight:500}
.pf[data-theme="paper"] .pp-fold{position:absolute;z-index:2;top:0;inset-inline-end:0;width:72px;height:72px;pointer-events:none;background:linear-gradient(to bottom left,var(--pf-surface) 50%,transparent 50%);filter:drop-shadow(-2px 3px 3px rgb(35 37 29/.08))}
.pf[data-theme="paper"] .pp-fold::before{content:"";position:absolute;inset:0;clip-path:polygon(0 0,100% 100%,0 100%);background:linear-gradient(to top right,var(--pf-bg) 10%,color-mix(in oklab,var(--pf-border) 55%,var(--pf-bg)) 50%)}
[dir="rtl"] .pf[data-theme="paper"] .pp-fold,.pf[data-theme="paper"][dir="rtl"] .pp-fold{scale:-1 1}
.pf[data-theme="paper"] .pp-cell--work{padding:0;gap:0}
.pf[data-theme="paper"] .pp-cell--work>.pf-section__title{overflow:hidden;isolation:isolate;display:grid;place-items:center;max-width:none;aspect-ratio:2/1;min-height:180px;padding:12% 24px 0;text-align:center;font-size:clamp(2.5rem,1.6rem + 2.6vw,3.75rem);background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-cell--work>.pf-section__title::before{content:"";position:absolute;z-index:-1;left:0;top:0;width:100%;aspect-ratio:1;border-radius:50%;background:var(--pf-bg);box-shadow:0 0 0 1px var(--pf-border)}
.pf[data-theme="paper"] .pp-works{display:grid;padding:0;list-style:none}
.pf[data-theme="paper"] .pp-work{display:grid;min-width:0;border-top:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-work__card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;color:inherit;text-decoration:none}
.pf[data-theme="paper"] .pp-work__art{display:grid;place-items:center;min-width:0;padding:clamp(28px,4vw,52px);border-inline-end:1px solid var(--pf-border);background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-work__frame{--pf-cover-ratio:4/3;width:100%;border-radius:6px;background:var(--pf-bg);box-shadow:0 0 0 1px var(--pf-border),0 1px 2px rgb(0 0 0/.05),0 18px 32px -18px rgb(0 0 0/.22);transition:translate .3s ease,box-shadow .3s ease}
.pf[data-theme="paper"] .pp-work__frame img{opacity:1}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__frame{translate:0 -4px;box-shadow:0 0 0 1px var(--pf-border),0 1px 2px rgb(0 0 0/.05),0 26px 40px -20px rgb(0 0 0/.28)}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__frame img{transform:none}
.pf[data-theme="paper"] .pp-work__copy{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:16px;min-width:0;padding:var(--pp-pad)}
.pf[data-theme="paper"] .pp-work__meta{display:flex;align-items:baseline;gap:12px;color:var(--pf-muted);font-size:16px;line-height:24px}
.pf[data-theme="paper"] .pp-number{flex:none;color:var(--pf-accent-text);font:500 13px/24px var(--pf-font-mono)}
.pf[data-theme="paper"] .pp-work__title{font-size:clamp(1.75rem,1.2rem + 1.4vw,2.5rem);font-weight:700;letter-spacing:-.025em;line-height:1.1;overflow-wrap:anywhere;text-wrap:balance}
.pf[data-theme="paper"] .pp-work__summary{color:var(--pf-muted);font-size:18px;line-height:28px;text-wrap:pretty}
.pf[data-theme="paper"] .pp-work__cta{display:inline-flex;align-items:center;gap:8px;margin-top:8px;color:var(--pf-accent-text);font-size:18px;text-underline-offset:4px}
.pf[data-theme="paper"] .pp-work__cta svg{width:16px;height:16px;transition:translate .2s ease}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__cta{text-decoration:underline}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__cta svg{translate:3px 0}
.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__art{grid-column:2;grid-row:1;border-inline-end:0;border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__copy{grid-column:1;grid-row:1}
.pf[data-theme="paper"] .pp-work[data-image="false"] .pp-work__card{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="paper"] .pp-works[data-variant="grid-2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.pf[data-theme="paper"] .pp-works[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work:not(:nth-child(2n+1)){border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-works[data-variant="grid-3"] .pp-work{border-inline-start:0!important}
.pf[data-theme="paper"] .pp-works[data-variant="grid-3"] .pp-work:not(:nth-child(3n+1)){border-inline-start:1px solid var(--pf-border)!important}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__card{grid-template-columns:minmax(0,1fr);align-content:start}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__art{border-inline-end:0;border-bottom:1px solid var(--pf-border);padding:28px}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__copy{justify-content:flex-start;padding:32px}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__title{font-size:26px}
.pf[data-theme="paper"] .pp-services{display:grid;gap:0;padding:0;list-style:none}
.pf[data-theme="paper"] .pf-service{display:grid;align-content:start;gap:8px;min-width:0;padding-block:24px;border-top:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pf-service__head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 16px}
.pf[data-theme="paper"] .pf-service h3{display:flex;align-items:center;gap:12px;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-.015em}
.pf[data-theme="paper"] .pf-service__price{color:var(--pf-muted);font:400 14px/24px var(--pf-font-mono)}
.pf[data-theme="paper"] .pf-service__desc{max-width:60ch;color:var(--pf-muted);font-size:18px;line-height:28px}
.pf[data-theme="paper"] .pf-service__cta{display:inline-flex;align-items:center;gap:8px;width:fit-content;color:var(--pf-accent-text);font-size:17px;text-decoration:none}
.pf[data-theme="paper"] .pf-service__cta:hover{text-decoration:underline;text-underline-offset:4px}
.pf[data-theme="paper"] .pp-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:20px}
.pf[data-theme="paper"] .pp-services[data-variant="cards"] .pf-service{padding:24px;border:1px solid var(--pf-border);border-radius:6px;background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px;padding:0;list-style:none}
.pf[data-theme="paper"] .pf-quote{display:grid;align-content:start;gap:20px;min-width:0;padding:28px;border:1px solid var(--pf-border);border-radius:6px;background:var(--pf-bg);box-shadow:0 12px 24px -20px rgb(0 0 0/.18)}
.pf[data-theme="paper"] .pf-quote blockquote{font-size:20px;line-height:30px;letter-spacing:-.01em;text-wrap:pretty}
.pf[data-theme="paper"] .pf-quote blockquote::before{content:"\201C";display:block;height:28px;color:var(--pf-accent-text);font:700 48px/1 var(--pf-font-heading)}
.pf[data-theme="paper"] .pf-quote__source{color:var(--pf-muted);font-size:14px;text-underline-offset:4px}
.pf[data-theme="paper"] .pp-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}
.pf[data-theme="paper"] .pp-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(88%,420px);scroll-snap-align:start}
.pf[data-theme="paper"] .pf-cvlist,.pf[data-theme="paper"] .pf-extralist{gap:20px}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"]){gap:0}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem{display:grid;grid-template-columns:200px minmax(0,1fr);column-gap:40px;padding-block:24px;border-top:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem:first-child{padding-top:0;border-top:0}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem:last-child{padding-bottom:0}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>*{grid-column:2}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head{display:contents}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__role{grid-column:2;grid-row:1;font-size:20px}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{grid-column:1;grid-row:1}
.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem .pf-prose{margin-top:10px;max-width:62ch}
.pf[data-theme="paper"] .pf-cvitem{gap:2px}
.pf[data-theme="paper"] .pf-cvitem__role{font-size:18px;line-height:28px;font-weight:500}
.pf[data-theme="paper"] .pf-cvitem__when{color:var(--pf-muted);font:400 14px/28px var(--pf-font-mono);letter-spacing:-.01em}
.pf[data-theme="paper"] .pf-cvitem__org{color:var(--pf-muted);font-size:16px;line-height:24px}
.pf[data-theme="paper"] .pf-cvitem .pf-prose{color:var(--pf-muted);font-size:16px;line-height:24px}
.pf[data-theme="paper"] .pf-extralist,.pf[data-theme="paper"] .pf-skillgroups{font-size:16px}
.pf[data-theme="paper"] .pf-skillgroups{gap:20px}
.pf[data-theme="paper"] .pf-skillgroups b{display:block;margin-bottom:10px;font-weight:500}
.pf[data-theme="paper"] .pf-tags{gap:8px}
.pf[data-theme="paper"] .pf-tags li{padding:4px 12px;border:1px solid var(--pf-border);border-radius:999px;background:var(--pf-bg);color:var(--pf-muted);font-size:15px;line-height:22px}
.pf[data-theme="paper"] .pp-work .pf-tags li{padding:2px 10px;font-size:13px;line-height:20px}
.pf[data-theme="paper"] .pf-work-metric b{font-family:var(--pf-font-mono);letter-spacing:-.02em}
.pf[data-theme="paper"] .pp-cell--custom{aspect-ratio:2/1;align-content:center;justify-items:center;text-align:center;padding-block:48px 15%}
.pf[data-theme="paper"] .pp-cell--custom>.pf-section__title{max-width:20ch}
.pf[data-theme="paper"] .pp-cell--custom .pp-cell__body{justify-items:center;max-width:620px}
.pf[data-theme="paper"] .pp-cell--custom .pf-btns{justify-content:center}
.pf[data-theme="paper"] .pp-orbit{position:absolute;inset:0;z-index:0;overflow:clip;pointer-events:none;background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-orbit::before{content:"";position:absolute;left:0;top:0;width:100%;aspect-ratio:1;translate:0 -50%;border-radius:50%;background:var(--pf-bg);box-shadow:0 0 0 1px var(--pf-border)}
.pf[data-theme="paper"] .pp-cell--contact{padding-block:clamp(64px,8vw,104px)}
.pf[data-theme="paper"] .pp-cell--contact>.pf-section__title{max-width:none;font-size:14px;line-height:20px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body{gap:20px;margin-top:-4px}
.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body:has(>.pf-loc){grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);column-gap:56px;align-items:start}
.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body:has(>.pf-loc)>*{grid-column:1}
.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body:has(>.pf-loc)>.pf-loc{grid-column:2;grid-row:1/span 4;width:100%}
.pf[data-theme="paper"] .pp-cell--contact .pf-contact-links{margin-top:8px;font-size:16px}
.pf[data-theme="paper"] .pp-cell--contact .pf-loc{width:min(100%,440px);background:var(--pf-bg)}
.pf[data-theme="paper"] .pp-cta{max-width:18ch;font:700 clamp(2.25rem,1.4rem + 2.8vw,3.5rem)/1.05 var(--pf-font-heading);letter-spacing:-.025em;text-wrap:balance}
.pf[data-theme="paper"] .pp-cell--clients{justify-items:center;padding-block:56px;background:var(--pf-surface);text-align:center}
.pf[data-theme="paper"] .pp-cell--clients>.pf-section__title{max-width:none;color:var(--pf-muted);font-size:20px;line-height:30px;font-weight:400;letter-spacing:0}
.pf[data-theme="paper"] .pp-cell--clients .pp-cell__body{justify-items:center;width:100%}
.pf[data-theme="paper"] .pp-cell--clients .pf-logos{justify-content:center;gap:24px 48px}
.pf[data-theme="paper"] .pp-custom__image{width:100%;max-height:560px;object-fit:contain;border-radius:6px;box-shadow:0 0 0 1px var(--pf-border)}
.pf[data-theme="paper"] .pf-foot{position:relative;isolation:isolate;padding-block:28px 48px;border-top:0;background:transparent;font-size:14px}
.pf[data-theme="paper"] .pf-foot::before{display:none}
.pf[data-theme="paper"] .pf-workpage{max-width:1082px}
.pf[data-theme="paper"] .pf-detail__title{font-weight:700;letter-spacing:-.025em}
.pf[data-theme="paper"] :is(.pf-workpage__back,.pf-workpage__step){border-radius:4px}
.pf[data-theme="paper"] .pf-metrics:not(.pp-stats) .pf-metric__value{font-family:var(--pf-font-mono)}
@media (max-width:960px){.pf[data-theme="paper"]::after{display:none}.pf[data-theme="paper"]{--pp-pad:40px}.pf[data-theme="paper"] .pp-top .pf-nav__links{gap:18px}.pf[data-theme="paper"] .pp-works[data-variant="grid-3"]{grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="paper"] .pp-works[data-variant="grid-3"] .pp-work:not(:nth-child(3n+1)){border-inline-start:0!important}.pf[data-theme="paper"] .pp-works[data-variant="grid-3"] .pp-work:nth-child(even){border-inline-start:1px solid var(--pf-border)!important}.pf[data-theme="paper"] .pp-cell--about{gap:28px}}
@media (max-width:760px){.pf[data-theme="paper"]{font-size:17px;line-height:26px;--pp-pad:24px}.pf[data-theme="paper"] .pp-top{padding-block:10px}.pf[data-theme="paper"] .pp-main{padding-top:28px;padding-bottom:72px}.pf[data-theme="paper"] .pp-hero,.pf[data-theme="paper"] .pp-hero:has(.pp-hero__visual),.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"]:has(.pp-hero__visual){grid-template-columns:minmax(0,1fr);gap:28px}.pf[data-theme="paper"] .pp-hero__copy{gap:14px}.pf[data-theme="paper"] .pp-name{font-size:max(2rem,min(2.75rem,calc(100cqi / (var(--name-word) * .58))))}.pf[data-theme="paper"] .pp-headline{margin-top:-6px;font-size:24px}.pf[data-theme="paper"] .pp-greeting{font-size:18px;line-height:28px}.pf[data-theme="paper"] .pp-hero__visual,.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__visual{grid-column:1;grid-row:1;justify-self:start;width:200px;padding:20px}.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__copy{grid-column:1;grid-row:auto}.pf[data-theme="paper"] .pp-sheet{grid-template-columns:minmax(0,1fr);margin-top:48px}.pf[data-theme="paper"] .pp-cell--half{grid-column:1/-1}.pf[data-theme="paper"] .pp-cell--stats{padding-block:32px}.pf[data-theme="paper"] .pp-stats.pf-metrics{--pf-metric-value:32px;grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="paper"] .pp-stats .pf-metric__label{font-size:16px;line-height:22px}.pf[data-theme="paper"] .pf-section__title{font-size:34px}.pf[data-theme="paper"] .pp-cell--about{grid-template-columns:minmax(0,1fr);gap:20px}.pf[data-theme="paper"] .pp-lead{font-size:18px;line-height:28px}.pf[data-theme="paper"] .pp-cell--work>.pf-section__title{overflow:hidden;isolation:isolate;display:grid;place-items:center;max-width:none;aspect-ratio:2/1;min-height:180px;padding:12% 24px 0;text-align:center;font-size:clamp(2.5rem,1.6rem + 2.6vw,3.75rem);background:var(--pf-surface)}.pf[data-theme="paper"] .pp-work__card,.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]){grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-works .pp-work{border-inline-start:0!important}.pf[data-theme="paper"] .pp-work__art{padding:24px;border-inline:0;border-bottom:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__art,.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__copy{grid-column:1;grid-row:auto;border-inline:0}.pf[data-theme="paper"] .pp-work__copy{padding:28px 24px 32px;gap:12px}.pf[data-theme="paper"] .pp-work__title{font-size:28px}.pf[data-theme="paper"] .pp-cta{font-size:34px}.pf[data-theme="paper"] .pp-fold{width:44px;height:44px}.pf[data-theme="paper"] .pf-quote{padding:22px}.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body:has(>.pf-loc){grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-cell--contact .pp-cell__body:has(>.pf-loc)>.pf-loc{grid-column:1;grid-row:auto}.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem{grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>*,.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>*{grid-column:1!important;grid-row:auto!important}.pf[data-theme="paper"] .pp-cell:not(.pp-cell--half) .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{order:-1}.pf[data-theme="paper"] .pp-orbit{display:none}.pf[data-theme="paper"] .pp-cell--custom{aspect-ratio:auto;padding-block:48px}.pf[data-theme="paper"] .pp-hero:has(.pp-hero__stats){grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-hero__stats .pp-stats.pf-metrics{--pf-metric-value:30px;grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="paper"] .pp-hero__stats .pf-metric{padding:18px 20px}.pf[data-theme="paper"] .pp-hero__stats .pf-metric+.pf-metric{border-top:0}.pf[data-theme="paper"] .pp-hero__stats .pf-metric:nth-child(n+3){border-top:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-hero__stats .pf-metric:nth-child(even){border-inline-start:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-hero__stats .pf-metric:last-child:nth-child(odd){grid-column:1/-1}}
`;
