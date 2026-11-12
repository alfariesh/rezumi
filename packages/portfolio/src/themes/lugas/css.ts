/**
 * Lugas: one calm 680 px column, pill buttons, a big bold name, works as a ruled list. Values from
 * `mockups/lugas.html`; the variants the theme offers (`PORTFOLIO_THEME_INFO.lugas.variants`) are data attributes.
 */
export const LUGAS_CSS = String.raw`
.pf[data-theme="lugas"]{--pf-max-width:680px;--pf-radius:14px}
.pf[data-theme="lugas"] .lg-top{padding-block:12px}
.pf[data-theme="lugas"] .lg-mono{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--pf-text);color:var(--pf-bg);font-size:12px;letter-spacing:.02em;flex:none}
.pf[data-theme="lugas"] .lg-brand{font-size:var(--pf-text-sm)}
.pf[data-theme="lugas"] .lg-main{display:grid;gap:clamp(72px,9vw,112px);padding-block:clamp(32px,6vw,72px) 40px}
.pf[data-theme="lugas"] .lg-hero{display:grid;gap:22px;justify-items:start;min-width:0}
.pf[data-theme="lugas"] .lg-hero>*{max-width:100%}
.pf[data-theme="lugas"] .lg-photo{width:88px;height:88px;border-radius:50%;object-fit:cover}
.pf[data-theme="lugas"] .lg-hero__text{display:grid;gap:12px;min-width:0}
.pf[data-theme="lugas"] .lg-name{font-size:min(clamp(2.6rem,1.4rem + 5.2vw,4.4rem),calc(min(100vw - 32px,680px) / (var(--name-word) * .62)));font-weight:800;letter-spacing:-.035em;line-height:1}
.pf[data-theme="lugas"] .lg-headline{font-size:var(--pf-text-lg);color:var(--pf-muted);font-weight:500;line-height:1.35}
.pf[data-theme="lugas"] .lg-greeting{font-size:clamp(1.125rem,1rem + .5vw,1.3rem);line-height:1.5;max-width:36ch}
.pf[data-theme="lugas"] .lg-stats{width:100%;padding-block:28px 4px;border-top:1px solid var(--pf-border);margin-top:6px}
.pf[data-theme="lugas"] .lg-stats.pf-metrics{--pf-metric-value:clamp(2rem,1.5rem + 2vw,2.75rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:24px}
@media (max-width:560px){.pf[data-theme="lugas"] .lg-stats.pf-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;--pf-metric-value:1.7rem}.pf[data-theme="lugas"] .lg-stats .pf-metric__label{font-size:var(--pf-text-xs)}}
.pf[data-theme="lugas"] .lg-hero[data-variant="photo-left"]{grid-template-columns:auto minmax(0,1fr);column-gap:28px;align-items:center}
.pf[data-theme="lugas"] .lg-hero[data-variant="photo-left"] .lg-photo{width:120px;height:120px}
.pf[data-theme="lugas"] .lg-hero[data-variant="photo-left"]>:not(.lg-photo):not(.lg-hero__text){grid-column:1/-1}
@media (max-width:520px){.pf[data-theme="lugas"] .lg-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,1fr)}.pf[data-theme="lugas"] .lg-hero[data-variant="photo-left"] .lg-photo{width:88px;height:88px}}
.pf[data-theme="lugas"] .lg-hero[data-bg]:not([data-bg="plain"]){position:relative;padding:clamp(24px,5vw,40px);border-radius:calc(var(--pf-radius) + 6px);overflow:hidden;background:var(--pf-hero-bg)}
.pf[data-theme="lugas"] .lg-sec{display:grid;gap:28px;min-width:0}
.pf[data-theme="lugas"] .lg-sec .pf-section__title{font-size:clamp(1.5rem,1.2rem + 1vw,1.875rem);letter-spacing:-.025em;font-weight:800}
.pf[data-theme="lugas"] .lg-lead{font-size:var(--pf-text-lg);line-height:1.6}
.pf[data-theme="lugas"] .lg-works{list-style:none;padding:0;margin:0;display:grid}
.pf[data-theme="lugas"] .lg-work>a{display:grid;grid-template-columns:120px minmax(0,1fr);gap:20px;align-items:start;padding-block:22px;border-top:1px solid var(--pf-border);text-decoration:none}
.pf[data-theme="lugas"] .lg-work:last-child>a{border-bottom:1px solid var(--pf-border)}
.pf[data-theme="lugas"] .lg-work[data-noimg]>a{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="lugas"] .lg-work__cover{border-radius:10px}
.pf[data-theme="lugas"] .lg-work__body{display:grid;gap:6px;min-width:0}
.pf[data-theme="lugas"] .lg-work__title{font:700 var(--pf-text-lg)/1.25 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="lugas"] .lg-work>a:is(:hover,:focus-visible) .lg-work__title{text-decoration:underline;text-decoration-color:var(--pf-accent-text);text-underline-offset:4px;text-decoration-thickness:2px}
.pf[data-theme="lugas"] .lg-work__summary{color:var(--pf-muted);font-size:var(--pf-text-sm);line-height:1.5}
.pf[data-theme="lugas"] .lg-work__meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:4px;font-size:var(--pf-text-xs);color:var(--pf-muted)}
@media (max-width:520px){.pf[data-theme="lugas"] .lg-work>a{grid-template-columns:84px minmax(0,1fr);gap:14px}}
.pf[data-theme="lugas"] .lg-works:is([data-variant="grid-2"],[data-variant="featured-grid"]){grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 20px}
.pf[data-theme="lugas"] .lg-works:is([data-variant="grid-2"],[data-variant="featured-grid"]) .lg-work>a{grid-template-columns:minmax(0,1fr);gap:14px;padding:0;border:0}
.pf[data-theme="lugas"] .lg-works[data-variant="featured-grid"] .lg-work:first-child{grid-column:1/-1}
.pf[data-theme="lugas"] .lg-works[data-variant="featured-grid"] .lg-work:first-child .lg-work__cover{--pf-cover-ratio:16/9}
.pf[data-theme="lugas"] .lg-works[data-variant="featured-grid"] .lg-work:first-child .lg-work__title{font-size:var(--pf-text-xl)}
@media (max-width:520px){.pf[data-theme="lugas"] .lg-works:is([data-variant="grid-2"],[data-variant="featured-grid"]){grid-template-columns:minmax(0,1fr)}}
.pf[data-theme="lugas"] .lg-services{list-style:none;padding:0;margin:0;display:grid}
.pf[data-theme="lugas"] .pf-service{display:grid;gap:6px;padding-block:20px;border-top:1px solid var(--pf-border)}
.pf[data-theme="lugas"] .pf-service:last-child{border-bottom:1px solid var(--pf-border)}
.pf[data-theme="lugas"] .pf-service__head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 16px}
.pf[data-theme="lugas"] .pf-service h3{display:flex;align-items:center;gap:10px;font-size:var(--pf-text-lg);font-weight:700}
.pf[data-theme="lugas"] .pf-service h3 svg{width:22px;height:22px;color:var(--pf-accent-text)}
.pf[data-theme="lugas"] .pf-service__price{font-weight:600;font-variant-numeric:tabular-nums;color:var(--pf-accent-text);font-size:var(--pf-text-sm)}
.pf[data-theme="lugas"] .pf-service p{color:var(--pf-muted);font-size:var(--pf-text-sm)}
.pf[data-theme="lugas"] .pf-service__cta{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:var(--pf-text-sm);color:var(--pf-accent-text);text-underline-offset:4px;width:fit-content}
.pf[data-theme="lugas"] .lg-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}
.pf[data-theme="lugas"] .lg-services[data-variant="cards"] .pf-service{padding:20px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);align-content:start}
.pf[data-theme="lugas"] .lg-quotes{list-style:none;padding:0;margin:0;display:grid;gap:36px}
.pf[data-theme="lugas"] .pf-quote{display:grid;gap:16px;align-content:start}
.pf[data-theme="lugas"] .lg-quotes blockquote{font:500 var(--pf-text-lg)/1.5 var(--pf-font-heading);letter-spacing:-.005em}
.pf[data-theme="lugas"] .lg-quotes blockquote::before{content:"\201C";display:block;height:.6em;color:var(--pf-accent-text);font-size:2.2em;line-height:1}
.pf[data-theme="lugas"] .lg-quotes[data-variant="carousel"]{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}
.pf[data-theme="lugas"] .lg-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(86%,520px);scroll-snap-align:start;padding:22px;border:1px solid var(--pf-border);border-radius:var(--pf-radius)}
.pf[data-theme="lugas"] .pf-quote__source{font-size:var(--pf-text-xs);color:var(--pf-muted);text-underline-offset:3px}
.pf[data-theme="lugas"] .lg-custom{padding:28px;border-radius:var(--pf-radius);background:var(--pf-surface);gap:16px}
.pf[data-theme="lugas"] .lg-custom__image{border-radius:var(--pf-radius-sm)}
.pf[data-theme="lugas"] .lg-custom .pf-btn{justify-self:start}
.pf[data-theme="lugas"] .lg-cta{font:800 clamp(1.5rem,1.1rem + 1.6vw,2.25rem)/1.15 var(--pf-font-heading);letter-spacing:-.025em;max-width:22ch}
.pf[data-theme="lugas"] #contact{gap:24px}
.pf[data-theme="lugas"] #contact .pf-loc{max-width:420px}
.pf[data-theme="lugas"] .pf-workpage{max-width:820px}
`;
