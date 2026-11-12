/** Every Kanvas rule is scoped under the theme's root. */
const K = '.pf[data-theme="kanvas"]';

/**
 * Kanvas: dark by default, 1400 px wide, 4 px corners; pictures are the content and the text around them stays small
 * and calm. Values from `mockups/kanvas.html`; the variants the theme offers (`PORTFOLIO_THEME_INFO.kanvas.variants`)
 * are data attributes.
 *
 * The mockup draws the name in Archivo at 72% width. The page loads static font files without a width axis, so
 * `font-stretch` has no effect: the name gets tighter tracking instead, and its long-word cap uses a wider letter
 * factor (`--kv-k`) for Archivo's capitals. Serif pairs set display text lighter (`--kv-display`), and weights a font
 * lacks are never faked (`font-synthesis-weight`).
 *
 * Gallery pictures show whole, one per row, at their own ratio (tall ones capped at the screen's height) rather than
 * the mockup's 3:2 crop: the page rule is that a gallery shows pictures uncut (`01-desain.md` section 3).
 *
 * Work tiles: phones and touch screens (`hover: none`) get one picture per row (two from 641 px) with the caption
 * below; pointer screens from 641 px get fixed-height rows with the caption over the picture on hover or focus.
 */
export const KANVAS_CSS = String.raw`
${K}{--pf-max-width:1400px;--pf-radius:4px;--pf-radius-sm:3px;--kv-display:800;--kv-strong:700;--kv-k:.6;--kv-track:-.03em;font-synthesis-weight:none}
${K}[data-font-pair="archivo"]{--kv-k:.76;--kv-track:-.045em}
${K}[data-font-pair="bodoni-work"]{--kv-display:600;--kv-strong:600;--kv-track:-.035em}
${K}[data-font-pair="instrument"]{--kv-display:400;--kv-strong:400;--kv-track:-.02em;--kv-k:.48}
${K}[data-font-pair="syne-dm"]{--kv-k:1.1}
${K}[data-font-pair="bricolage-dm"]{--kv-k:.64}
${K} .pf-btn,${K} .pf-menu>summary,${K} .pf-menu__list,${K} .pf-detail__bar a{border-radius:var(--pf-radius)}
${K} .pf-menu__list a{border-radius:var(--pf-radius-sm)}
${K} .pf-btn--primary{border-color:color-mix(in oklab,var(--pf-accent) 82%,var(--pf-text))}
${K} .kv-top{padding-block:8px}
${K} .kv-brand{font:600 var(--pf-text-xs)/1.2 var(--pf-font-body);letter-spacing:.14em;text-transform:uppercase}
${K} .kv-label{font:600 var(--pf-text-xs)/1.5 var(--pf-font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--pf-muted)}
${K}:is(:lang(ar),:lang(fa),:lang(ur)) :is(.kv-brand,.kv-label,.kv-name,.kv-cta,.pf-detail__title){letter-spacing:0}
${K} .kv-main{padding-bottom:clamp(24px,4vw,48px)}

${K} .kv-hero{display:grid;gap:clamp(24px,3vw,40px);padding-block:clamp(24px,5vw,56px) clamp(32px,5vw,56px);min-width:0;container-type:inline-size}
${K} .kv-name{font-size:min(clamp(3.2rem,.6rem + 11.5vw,11rem),calc(min(100vw - 32px,1400px) / (var(--name-word) * var(--kv-k))));font-size:min(clamp(3.2rem,.6rem + 11.5vw,11rem),calc(100cqi / (var(--name-word) * var(--kv-k))));font-weight:var(--kv-display);line-height:.92;letter-spacing:var(--kv-track);max-width:100%}
${K}[data-font-pair="archivo"] .kv-name{line-height:.86}
${K} .kv-hero__row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr);grid-template-areas:"who greet side";gap:24px 48px;align-items:start;padding-top:24px;border-top:1px solid var(--pf-border)}
${K} .kv-hero__who{grid-area:who;display:flex;align-items:center;gap:14px;min-width:0}
${K} .kv-photo{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none;filter:grayscale(.2)}
${K} .kv-headline{min-width:0;font-weight:600;font-size:var(--pf-text-md);line-height:1.35}
${K} .kv-greeting{grid-area:greet;font-size:var(--pf-text-lg);line-height:1.5;max-width:40ch}
${K} .kv-hero__side{grid-area:side;display:grid;gap:18px;justify-items:start;min-width:0}
@media (max-width:900px){${K} .kv-hero__row{grid-template-columns:minmax(0,1fr);grid-template-areas:none}${K} .kv-hero__row>*{grid-area:auto}}
${K} .kv-stats.pf-metrics{--pf-metric-value:clamp(1.75rem,1.3rem + 1.6vw,2.5rem);display:flex;flex-wrap:wrap;gap:16px 56px}
${K} .kv-stats .pf-metric{gap:6px}
${K} .kv-stats .pf-metric__label{font-size:var(--pf-text-sm)}
@media (max-width:560px){${K} .kv-stats.pf-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}${K} .kv-stats .pf-metric__label{font-size:var(--pf-text-xs)}}
${K} .kv-hero[data-bg]:not([data-bg="plain"]){margin-block:clamp(8px,2vw,16px);padding:clamp(24px,5vw,56px) clamp(20px,4vw,48px);border-radius:var(--pf-radius);background:var(--pf-hero-bg)}

${K} .kv-work{display:grid;gap:24px;min-width:0}
${K} .kv-sec+.kv-work{padding-block:clamp(32px,4vw,56px) 0;border-top:1px solid var(--pf-border)}
${K} .kv-work+.kv-sec{margin-top:clamp(56px,8vw,112px)}
${K} .kv-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:28px 12px}
${K} .kv-tile{min-width:0}
${K} .kv-tile>a{display:grid;gap:12px;border-radius:var(--pf-radius);color:var(--pf-text);text-decoration:none}
${K} .kv-tile__img{--pf-cover-ratio:4/3;border-radius:var(--pf-radius)}
${K} .kv-cap{display:grid;gap:6px;justify-items:start;min-width:0;padding-inline:2px}
${K} .kv-cap__title{font:var(--kv-strong) var(--pf-text-lg)/1.2 var(--pf-font-heading);letter-spacing:-.005em;unicode-bidi:plaintext}
${K} .kv-cap__meta{color:var(--pf-muted);font-size:var(--pf-text-xs)}
${K} .kv-tile[data-noimg]>a{min-height:160px;align-content:end;padding:20px;background:var(--pf-surface)}
${K} .kv-tile[data-noimg] .kv-cap{padding:0}
${K} .kv-tile[data-noimg] .kv-cap__title{font-size:var(--pf-text-xl)}
${K} .kv-tile>a:is(:hover,:focus-visible) .kv-cap__title{text-decoration:underline;text-decoration-color:var(--pf-accent-text);text-decoration-thickness:2px;text-underline-offset:4px}
@media (min-width:641px){
${K} .kv-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:first-child{grid-column:1/-1}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:first-child .kv-cap__title{font-size:var(--pf-text-xl)}
}
@media (min-width:641px) and (max-width:1023px),(min-width:641px) and (hover:none){${K} .kv-grid[data-variant="featured-grid"] .kv-tile:nth-child(even):last-child{grid-column:1/-1}}
@media (min-width:1024px){${K} .kv-grid[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (hover:hover) and (min-width:641px){
${K} .kv-grid{gap:12px;grid-auto-rows:clamp(200px,34vw,320px)}
${K} .kv-grid:is([data-variant="grid-2"],[data-variant="grid-3"]){grid-auto-rows:auto}
${K} .kv-tile>a{position:relative;display:block;height:100%;overflow:hidden;background:var(--pf-surface)}
${K} .kv-grid:is([data-variant="grid-2"],[data-variant="grid-3"]) .kv-tile>a{height:auto;aspect-ratio:4/3}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:first-child{grid-row:span 2}
${K} .kv-tile__img{position:absolute;inset:0;height:100%;aspect-ratio:auto}
${K} .kv-tile__img img{transition:transform .6s cubic-bezier(.2,.7,.2,1)}
${K} .kv-tile>a:is(:hover,:focus-visible) .kv-tile__img img{transform:scale(1.03)}
${K} .kv-cap{position:absolute;inset-inline:0;bottom:0;padding:48px 20px 18px;background:linear-gradient(transparent,rgb(0 0 0/.55) 45%,rgb(0 0 0/.82));color:#fff;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}
${K} .kv-tile>a:is(:hover,:focus-visible) .kv-cap{opacity:1;transform:none}
${K} .kv-tile>a:is(:hover,:focus-visible) .kv-cap__title{text-decoration:none}
${K} .kv-cap__meta{color:inherit;opacity:.85}
${K} .kv-cap .pf-work-metric{background:rgb(255 255 255/.16);color:#fff;backdrop-filter:blur(6px)}
${K} .kv-cap .pf-work-metric b{color:#fff}
${K} .kv-tile[data-noimg]>a{display:grid;align-content:end;min-height:0;padding:0}
${K} .kv-tile[data-noimg] .kv-cap{position:static;opacity:1;transform:none;padding:clamp(18px,2vw,28px);background:none;color:var(--pf-text)}
${K} .kv-tile[data-noimg] .kv-cap__meta{color:var(--pf-muted);opacity:1}
${K} .kv-tile[data-noimg] .kv-cap .pf-work-metric{background:var(--pf-accent-soft);color:var(--pf-text);backdrop-filter:none}
${K} .kv-tile[data-noimg] .kv-cap .pf-work-metric b{color:var(--pf-accent-text-soft)}
${K} .kv-tile[data-noimg]>a:is(:hover,:focus-visible) .kv-cap__title{text-decoration:underline}
}
@media (hover:hover) and (min-width:1024px){
${K} .kv-grid[data-variant="featured-grid"]{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:clamp(200px,17vw,280px)}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile{grid-column:span 2}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:first-child{grid-column:span 4;grid-row:span 2}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:first-child:last-child,${K} .kv-grid[data-variant="featured-grid"] .kv-tile:nth-child(3n+4):last-child{grid-column:1/-1}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:nth-child(2):last-child{grid-row:span 2}
${K} .kv-grid[data-variant="featured-grid"] .kv-tile:nth-child(3n+4):nth-last-child(2),${K} .kv-grid[data-variant="featured-grid"] .kv-tile:nth-child(3n+5):last-child{grid-column:span 3}
}

${K} .kv-sec{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,3fr);gap:20px 48px;padding-block:clamp(32px,4vw,56px);border-top:1px solid var(--pf-border);min-width:0}
${K} .kv-sec__body{min-width:0;max-width:980px}
@media (max-width:820px){${K} .kv-sec{grid-template-columns:minmax(0,1fr)}}
${K} .kv-extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:28px}
${K} .kv-extras .pf-extra__title{font:var(--kv-strong) var(--pf-text-md)/1.3 var(--pf-font-heading);margin-bottom:10px}
${K} .kv-lead{font-size:clamp(1.25rem,1rem + .9vw,1.6rem);line-height:1.45;max-width:38ch}
${K} .kv-lead strong{font-weight:600}
${K} .kv-services{list-style:none;margin:0;padding:0;display:grid}
${K} .kv-services .pf-service{display:grid;gap:6px;min-width:0}
${K} .kv-services[data-variant="list"] .pf-service{grid-template-columns:minmax(0,1.2fr) minmax(0,2fr) auto;grid-template-areas:"head desc cta";gap:8px 32px;align-items:baseline;padding-block:18px;border-bottom:1px solid var(--pf-border)}
${K} .kv-services[data-variant="list"]{grid-template-columns:minmax(0,1.2fr) minmax(0,2fr) auto;column-gap:32px}
${K} .kv-services[data-variant="list"] .pf-service{grid-column:1/-1;grid-template-columns:subgrid}
${K} .kv-services[data-variant="list"] .pf-service:first-child{padding-top:0}
${K} .kv-services[data-variant="list"] .pf-service:last-child{padding-bottom:0;border-bottom:0}
${K} .pf-service__head{grid-area:head;display:grid;gap:2px;min-width:0}
${K} .kv-services h3{display:flex;align-items:center;gap:10px;font:var(--kv-strong) var(--pf-text-lg)/1.25 var(--pf-font-heading)}
${K} .kv-services h3 svg{width:22px;height:22px;flex:none;color:var(--pf-accent-text)}
${K} .pf-service__price{color:var(--pf-accent-text);font-size:var(--pf-text-sm);font-variant-numeric:tabular-nums}
${K} .pf-service__desc{grid-area:desc;color:var(--pf-muted);font-size:var(--pf-text-sm)}
${K} .pf-service__cta{grid-area:cta;display:inline-flex;align-items:center;gap:6px;width:fit-content;font-weight:600;font-size:var(--pf-text-sm);white-space:nowrap;text-underline-offset:4px}
@media (max-width:820px){${K} .kv-services[data-variant="list"],${K} .kv-services[data-variant="list"] .pf-service{grid-template-columns:minmax(0,1fr);grid-template-areas:none}${K} .kv-services .pf-service>*{grid-area:auto}${K} .pf-service__cta{white-space:normal}}
${K} .kv-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}
${K} .kv-services[data-variant="cards"] .pf-service{align-content:start;gap:10px;padding:20px;border:1px solid var(--pf-border);border-radius:var(--pf-radius)}
${K} .kv-services[data-variant="cards"] .pf-service>*{grid-area:auto}
${K} .kv-quotes{list-style:none;margin:0;padding:0;display:grid;gap:40px}
${K} .kv-quotes .pf-quote{display:grid;gap:16px;align-content:start;min-width:0}
${K} .kv-quotes blockquote{font:500 clamp(1.25rem,1rem + 1vw,1.75rem)/1.35 var(--pf-font-heading);letter-spacing:-.01em;max-width:34ch}
${K} .kv-quotes .pf-avatar{background:var(--pf-surface);color:var(--pf-text)}
${K} .kv-quotes[data-variant="carousel"]{display:flex;gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding-bottom:12px}
${K} .kv-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(86%,520px);scroll-snap-align:start;padding:24px;border:1px solid var(--pf-border);border-radius:var(--pf-radius)}
${K} .pf-quote__source{justify-self:start;color:var(--pf-muted);font-size:var(--pf-text-xs);text-underline-offset:3px}
${K} .kv-custom{display:grid;gap:20px;justify-items:start;min-width:0}
${K} .kv-custom__image{border-radius:var(--pf-radius)}
${K} .kv-contact{display:grid;gap:22px;align-items:start;min-width:0}
${K} .kv-cta{font:var(--kv-display) clamp(1.75rem,1.2rem + 2.4vw,3.25rem)/1 var(--pf-font-heading);text-transform:var(--pf-name-transform);letter-spacing:-.015em;max-width:18ch}
@media (min-width:901px){${K} .kv-contact:has(>.pf-loc){grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);grid-template-rows:repeat(6,auto) 1fr;gap:0 32px}${K} .kv-contact:has(>.pf-loc)>:not(.pf-loc)+:not(.pf-loc){margin-top:22px}${K} .kv-contact>:not(.pf-loc){grid-column:1}${K} .kv-contact>.pf-loc{grid-column:2;grid-row:1/-1}}

${K} .pf-detail{padding:0 env(safe-area-inset-right,0px) 0 env(safe-area-inset-left,0px);background:var(--pf-bg)}
${K} .pf-detail__panel{max-width:none;min-height:100%;border-radius:0;background:var(--pf-bg);--pf-detail-pad:clamp(16px,4vw,48px)}
${K} .pf-detail__panel>*{width:100%;max-width:1200px;justify-self:center}
${K} .pf-detail__panel>.pf-detail__bar{width:auto;max-width:none;justify-self:stretch;border-radius:0;padding-top:max(12px,env(safe-area-inset-top,0px));padding-inline:calc(var(--pf-detail-pad) + max(0px,(100% - 1200px) / 2))}
${K} .pf-detail__title{font:var(--kv-display) clamp(2.25rem,1.2rem + 4vw,4.5rem)/.92 var(--pf-font-heading);text-transform:var(--pf-name-transform);letter-spacing:var(--kv-track)}
${K} .pf-detail__hero{border-radius:var(--pf-radius)}
${K} .pf-blocks>.pf-prose{font-size:var(--pf-text-lg)}
${K} .pf-gallery:not([data-layout="carousel"]){grid-template-columns:minmax(0,1fr)}
${K} .pf-gallery[data-layout="carousel"] figure{flex-basis:min(85%,720px)}
${K} .pf-gallery img{max-height:min(88vh,1100px);object-fit:contain;border-radius:var(--pf-radius);background:none}
@media print{${K} .kv-cap{opacity:1;transform:none}}
`;
