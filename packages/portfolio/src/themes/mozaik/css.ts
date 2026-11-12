/**
 * Mozaik: `--pf-surface` tiles with a 26 px radius on a green-grey page, 14 px apart; pill buttons and chips; the
 * intro and the works as bentos. Values from `mockups/mozaik.html`. The grid areas of the intro and the spans of the
 * works come from the markup (`layout.ts`), as custom properties, so every combination of tiles closes neatly.
 * Container query units size the name and the stat values to their tile.
 */
export const MOZAIK_CSS = String.raw`
.pf[data-theme="mozaik"]{--pf-max-width:1200px;--pf-radius:26px;--pf-radius-sm:14px;--pf-hero-ground:var(--pf-surface);--pf-hero-shade:rgb(8 10 14/.7),rgb(8 10 14/.78);--mz-gap:14px;--mz-pad:clamp(18px,2.4vw,28px);--mz-rim:inset 0 0 0 1px color-mix(in oklab,var(--pf-text) 8%,transparent)}
.pf[data-theme="mozaik"] .pf-btn{border-radius:999px}
.pf[data-theme="mozaik"] .pf-btn--secondary{background:var(--pf-surface)}
.pf[data-theme="mozaik"] .pf-btn--primary{box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .pf-chip{background:var(--pf-bg)}
.pf[data-theme="mozaik"] .pf-tags li{background:var(--pf-bg);border-color:transparent;color:var(--pf-text)}
.pf[data-theme="mozaik"] .pf-menu>summary{background:var(--pf-surface);border-color:transparent}
.pf[data-theme="mozaik"] .pf-menu__list{background:var(--pf-surface);border-color:transparent;border-radius:20px}
.pf[data-theme="mozaik"] .pf-menu__list a:hover{background:var(--pf-bg)}
.pf[data-theme="mozaik"] .mz-top{padding-block:10px}
.pf[data-theme="mozaik"] .mz-brand{gap:0}
.pf[data-theme="mozaik"] .mz-dot{position:relative;flex:none;width:22px;height:14px;margin-inline-end:10px}
.pf[data-theme="mozaik"] .mz-dot::before,.pf[data-theme="mozaik"] .mz-dot::after{content:"";position:absolute;top:0;width:14px;height:14px;border-radius:50%}
.pf[data-theme="mozaik"] .mz-dot::before{inset-inline-start:8px;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-dot::after{inset-inline-start:0;background:var(--pf-accent);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .pf-nav__links .pf-btn--primary{color:var(--pf-on-accent);min-height:40px;padding:.55em 1.1em}
@media (max-width:900px){.pf[data-theme="mozaik"] .pf-nav__links li:has(>.pf-btn){display:none}}
.pf[data-theme="mozaik"] .mz-main{display:grid;gap:clamp(48px,7vw,88px);padding-block:12px 40px}
.pf[data-theme="mozaik"] .mz-main>*{min-width:0}
.pf[data-theme="mozaik"] .mz-tile{min-width:0;padding:var(--mz-pad);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="mozaik"] .mz-tile__title{margin-bottom:14px;font-size:var(--pf-text-md);font-weight:700;letter-spacing:-.005em}
.pf[data-theme="mozaik"] .mz-title{font-size:clamp(1.5rem,1.1rem + 1.4vw,2.25rem);font-weight:800;letter-spacing:-.03em}
.pf[data-theme="mozaik"] .mz-sec{display:grid;gap:20px}

.pf[data-theme="mozaik"] .mz-bento{display:grid;gap:var(--mz-gap);grid-template-columns:repeat(4,minmax(0,1fr));grid-template-areas:var(--mz-areas)}
.pf[data-theme="mozaik"] .mz-intro{grid-area:intro;container-type:inline-size;display:grid;gap:16px;align-content:end;justify-items:start;padding:clamp(22px,3.4vw,40px)}
.pf[data-theme="mozaik"] .mz-intro>*{max-width:100%}
.pf[data-theme="mozaik"] .mz-name{font-size:min(clamp(2.4rem,1.3rem + 4.2vw,4.4rem),calc(100cqi / (var(--name-word) * .62)));font-weight:800;letter-spacing:-.035em;line-height:.98}
.pf[data-theme="mozaik"] .mz-headline{color:var(--pf-accent-text);font:700 var(--pf-text-lg)/1.3 var(--pf-font-heading)}
.pf[data-theme="mozaik"] .mz-greeting{max-width:42ch;color:var(--pf-muted);font-size:var(--pf-text-md)}
.pf[data-theme="mozaik"] .mz-intro .pf-btns{margin-top:4px}
.pf[data-theme="mozaik"] .mz-intro[data-bg]:not([data-bg="plain"]){background:var(--pf-hero-bg)}
.pf[data-theme="mozaik"] .mz-intro[data-bg="image"]{--pf-bg:rgb(255 255 255/.14)}
.pf[data-theme="mozaik"] .mz-intro[data-bg="image"] .pf-btn--secondary{background:transparent}
.pf[data-theme="mozaik"] .mz-photo{grid-area:photo;position:relative;min-height:300px;padding:0;overflow:hidden}
.pf[data-theme="mozaik"] .mz-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.pf[data-theme="mozaik"] .mz-stat{container-type:inline-size;display:grid;align-content:end;min-height:132px}
.pf[data-theme="mozaik"] .mz-s1{grid-area:s1;background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-s2{grid-area:s2;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-stat .pf-metrics{grid-template-columns:minmax(0,1fr);gap:12px}
.pf[data-theme="mozaik"] .mz-stat .pf-metric{gap:6px}
.pf[data-theme="mozaik"] .mz-stat .pf-metric__value{color:inherit;font-size:clamp(1.9rem,21cqi,3.6rem);font-weight:800;line-height:1;letter-spacing:-.03em}
.pf[data-theme="mozaik"] .mz-stat .pf-metric__label{color:inherit;font-size:var(--pf-text-sm);font-weight:500}
.pf[data-theme="mozaik"] .mz-s2:not([data-count="1"]) .pf-metric__value{font-size:clamp(1.5rem,14cqi,2.4rem)}
.pf[data-theme="mozaik"] .mz-stat .pf-metric+.pf-metric{padding-top:12px;border-top:1px solid color-mix(in oklab,currentColor 16%,transparent)}
.pf[data-theme="mozaik"] .mz-about{grid-area:about}
.pf[data-theme="mozaik"] .mz-about .pf-prose{font-size:var(--pf-text-md)}
.pf[data-theme="mozaik"] .mz-loc{grid-area:loc;container-type:inline-size;padding:0}
.pf[data-theme="mozaik"] .mz-loc .pf-loc{height:100%;align-content:start;padding:var(--mz-pad);border:0;background:transparent}
.pf[data-theme="mozaik"] .mz-loc .pf-loc[data-map]{padding:10px}
.pf[data-theme="mozaik"] .mz-loc .pf-loc__map{border-radius:18px}
.pf[data-theme="mozaik"] .mz-loc .pf-loc__body{padding:4px 8px 8px}
.pf[data-theme="mozaik"] .mz-loc .pf-loc:not([data-map]) .pf-loc__body{padding:0}
@container (min-width:520px){.pf[data-theme="mozaik"] .mz-loc .pf-loc[data-map]{grid-template-columns:minmax(0,min(420px,52%)) minmax(0,1fr);align-items:center;gap:16px}}
.pf[data-theme="mozaik"] .mz-links{grid-area:links}
.pf[data-theme="mozaik"] .mz-links__list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:6px;margin:0;padding:0;list-style:none}
.pf[data-theme="mozaik"] .mz-link{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 14px;border-radius:14px;background:var(--pf-bg);font-size:var(--pf-text-sm);font-weight:600;text-decoration:none;transition:background-color .15s}
.pf[data-theme="mozaik"] .mz-link>span{min-width:0;overflow-wrap:anywhere}
.pf[data-theme="mozaik"] a.mz-link:is(:hover,:focus-visible){background:var(--pf-accent-soft)}
.pf[data-theme="mozaik"] a.mz-link .pf-icon{color:var(--pf-accent-text)}
@media (max-width:900px){.pf[data-theme="mozaik"] .mz-bento{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:var(--mz-areas-tablet)}.pf[data-theme="mozaik"] .mz-photo{min-height:260px}.pf[data-theme="mozaik"] .mz-photo[data-wide]{min-height:clamp(260px,48vw,420px)}}
@media (max-width:560px){.pf[data-theme="mozaik"] .mz-bento{grid-template-areas:var(--mz-areas-phone)}.pf[data-theme="mozaik"] .mz-photo:not([data-wide]){min-height:220px}.pf[data-theme="mozaik"] .mz-stat{min-height:112px}}

.pf[data-theme="mozaik"] .mz-works{display:grid;gap:var(--mz-gap);margin:0;padding:0;list-style:none}
.pf[data-theme="mozaik"] .mz-works>li{min-width:0}
.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:clamp(180px,19vw,250px)}
.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]>li{grid-column:span var(--c,1);grid-row:span var(--r,1)}
.pf[data-theme="mozaik"] .mz-work>a,.pf[data-theme="mozaik"] .mz-more>a{position:relative;display:block;height:100%;overflow:hidden;border-radius:var(--pf-radius);background:var(--pf-surface);text-decoration:none}
.pf[data-theme="mozaik"] .mz-work__img{position:absolute;inset:0;height:100%;aspect-ratio:auto}
.pf[data-theme="mozaik"] .mz-work__img img{transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.pf[data-theme="mozaik"] .mz-work>a:is(:hover,:focus-visible) .mz-work__img img{transform:scale(1.04)}
.pf[data-theme="mozaik"] .mz-work__cap{position:absolute;inset-inline:10px;bottom:10px;display:grid;justify-items:start;gap:6px;max-width:calc(100% - 20px);padding:12px 14px;border-radius:18px;background:var(--pf-surface);box-shadow:0 6px 20px rgb(0 0 0/.12)}
.pf[data-theme="mozaik"] .mz-work__title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;font:700 var(--pf-text-sm)/1.25 var(--pf-font-heading);letter-spacing:-.005em}
.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]>li:first-child .mz-work__title{font-size:var(--pf-text-lg)}
.pf[data-theme="mozaik"] .mz-work .pf-work-metric{max-width:100%}
.pf[data-theme="mozaik"] .mz-work .pf-work-metric span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf[data-theme="mozaik"] .mz-work[data-noimg]>a{display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:10px;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-work[data-noimg] .mz-work__cap{position:static;box-shadow:none}
.pf[data-theme="mozaik"] .mz-work__summary{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;min-height:0;padding:10px 10px 0;color:var(--pf-muted);font-size:var(--pf-text-sm);line-height:1.45}
.pf[data-theme="mozaik"] .mz-more>a{display:grid;align-content:end;gap:6px;padding:24px;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-more b{font:800 var(--pf-text-xl)/1.1 var(--pf-font-heading);letter-spacing:-.02em;overflow-wrap:anywhere}
.pf[data-theme="mozaik"] .mz-more span{display:inline-flex;align-items:center;gap:6px;min-width:0;color:var(--pf-accent-text-soft);font-weight:600;overflow-wrap:anywhere}
.pf[data-theme="mozaik"] .mz-more>a:is(:hover,:focus-visible) span{text-decoration:underline;text-underline-offset:4px}
.pf[data-theme="mozaik"] .mz-works[data-variant="grid-2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.pf[data-theme="mozaik"] .mz-card{display:grid;align-content:start;gap:14px;height:100%;padding:10px 10px 20px;border-radius:var(--pf-radius);background:var(--pf-surface);text-decoration:none}
.pf[data-theme="mozaik"] .mz-card .pf-cover{border-radius:18px}
.pf[data-theme="mozaik"] .mz-card .pf-cover img{transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.pf[data-theme="mozaik"] .mz-card:is(:hover,:focus-visible) .pf-cover img{transform:scale(1.03)}
.pf[data-theme="mozaik"] .mz-card__body{display:grid;gap:6px;padding-inline:10px}
.pf[data-theme="mozaik"] .mz-work[data-noimg] .mz-card{padding-top:20px;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-card .mz-work__title{font-size:var(--pf-text-lg)}
.pf[data-theme="mozaik"] .mz-card__summary{color:var(--pf-muted);font-size:var(--pf-text-sm);line-height:1.5}
.pf[data-theme="mozaik"] .mz-card__meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:4px;color:var(--pf-muted);font-size:var(--pf-text-xs)}
@media (max-width:900px){.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:clamp(170px,40vw,260px)}.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]>li{grid-column:span var(--ct,1);grid-row:span var(--rt,1)}}
@media (max-width:560px){.pf[data-theme="mozaik"] .mz-works[data-variant="bento"],.pf[data-theme="mozaik"] .mz-works[data-variant="grid-2"]{grid-template-columns:minmax(0,1fr);grid-auto-rows:auto}.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]>li{grid-column:auto;grid-row:auto}.pf[data-theme="mozaik"] .mz-work>a{height:auto;aspect-ratio:4/3}.pf[data-theme="mozaik"] .mz-work[data-noimg]>a{aspect-ratio:auto;min-height:160px}.pf[data-theme="mozaik"] .mz-works[data-variant="bento"]>li:first-child .mz-work__title{font-size:var(--pf-text-md)}.pf[data-theme="mozaik"] .mz-more>a{min-height:140px}}

.pf[data-theme="mozaik"] .mz-services{display:grid;gap:var(--mz-gap);margin:0;padding:0;list-style:none}
.pf[data-theme="mozaik"] .mz-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.pf[data-theme="mozaik"] .mz-service{display:flex;flex-direction:column;gap:10px;min-width:0}
.pf[data-theme="mozaik"] .mz-services[data-variant="cards"] .mz-service{padding:var(--mz-pad);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="mozaik"] .mz-services[data-variant="list"]{gap:0;padding:4px var(--mz-pad);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="mozaik"] .mz-services[data-variant="list"] .mz-service{padding-block:20px}
.pf[data-theme="mozaik"] .mz-services[data-variant="list"] .mz-service+.mz-service{border-top:1px solid var(--pf-border)}
.pf[data-theme="mozaik"] .mz-service__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 16px}
.pf[data-theme="mozaik"] .mz-service h3{display:flex;align-items:center;gap:10px;min-width:0;font:700 var(--pf-text-lg)/1.2 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="mozaik"] .mz-service h3 svg{flex:none;width:22px;height:22px;color:var(--pf-accent-text)}
.pf[data-theme="mozaik"] .mz-service p{color:var(--pf-muted);font-size:var(--pf-text-sm)}
.pf[data-theme="mozaik"] .mz-service__foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-top:auto;padding-top:6px}
.pf[data-theme="mozaik"] .pf-service__price{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--pf-accent-soft);font-size:var(--pf-text-xs);font-weight:700;font-variant-numeric:tabular-nums}
.pf[data-theme="mozaik"] .pf-service__cta{display:inline-flex;align-items:center;gap:6px;color:var(--pf-accent-text);font-size:var(--pf-text-sm);font-weight:600;text-underline-offset:4px}

.pf[data-theme="mozaik"] .mz-pair{display:grid;gap:var(--mz-gap);grid-template-columns:minmax(0,1fr)}
.pf[data-theme="mozaik"] .mz-pair[data-count="2"]{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
.pf[data-theme="mozaik"] .mz-pair[data-count="2"][data-first="clients"]{grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)}
.pf[data-theme="mozaik"] .mz-quotes{margin:0;padding:0;list-style:none}
.pf[data-theme="mozaik"] .mz-quotes[data-variant="carousel"]{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(min(100%,260px),min(82%,460px));gap:12px;padding-bottom:6px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory}
.pf[data-theme="mozaik"] .mz-quotes[data-variant="cards"]{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
.pf[data-theme="mozaik"] .mz-quotes .pf-quote{display:grid;align-content:space-between;gap:16px;padding:20px;border-radius:20px;background:var(--pf-bg);scroll-snap-align:start}
.pf[data-theme="mozaik"] .mz-quotes blockquote{font:400 var(--pf-text-md)/1.55 var(--pf-font-body)}
.pf[data-theme="mozaik"] .mz-quotes blockquote::before{content:"\201C";display:block;height:.55em;color:var(--pf-accent-text);font:800 2em/1 var(--pf-font-heading)}
.pf[data-theme="mozaik"] .mz-quote__foot{display:grid;gap:10px}
.pf[data-theme="mozaik"] .pf-quote__source{justify-self:start;color:var(--pf-muted);font-size:var(--pf-text-xs);text-underline-offset:3px}
.pf[data-theme="mozaik"] .mz-clients-tile{container-type:inline-size}
.pf[data-theme="mozaik"] .mz-clients-tile .pf-logos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@container (min-width:620px){.pf[data-theme="mozaik"] .mz-clients-tile .pf-logos{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}}
.pf[data-theme="mozaik"] .mz-clients-tile .pf-logos>li{min-width:0}
.pf[data-theme="mozaik"] .mz-clients-tile .pf-logo{display:flex;align-items:center;justify-content:center;gap:8px;height:100%;min-height:60px;padding:12px;border-radius:14px;background:var(--pf-bg);font-size:var(--pf-text-sm);text-align:center;overflow-wrap:anywhere}
.pf[data-theme="mozaik"] .mz-clients-tile .pf-logo img{height:32px;max-width:100%}
.pf[data-theme="mozaik"] .mz-clients-tile .pf-logo svg{width:22px;height:22px}

.pf[data-theme="mozaik"] .mz-cv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--mz-gap)}
.pf[data-theme="mozaik"] .mz-cv>[data-shape="tall"]{grid-row:span 2}
.pf[data-theme="mozaik"] .mz-cv>[data-shape="wide"],.pf[data-theme="mozaik"] .mz-cv>.mz-extras{grid-column:1/-1}
.pf[data-theme="mozaik"] .mz-extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:24px 32px}
.pf[data-theme="mozaik"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::before{background:var(--pf-surface)}
.pf[data-theme="mozaik"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem:first-child::before{background:var(--pf-accent)}
.pf[data-theme="mozaik"] .pf-skillgroup b{font-weight:600}
@media (max-width:900px){.pf[data-theme="mozaik"] .mz-pair[data-count="2"],.pf[data-theme="mozaik"] .mz-pair[data-count="2"][data-first="clients"],.pf[data-theme="mozaik"] .mz-cv{grid-template-columns:minmax(0,1fr)}.pf[data-theme="mozaik"] .mz-cv>[data-shape="tall"]{grid-row:auto}}

.pf[data-theme="mozaik"] .mz-custom__body{display:grid;gap:18px}
.pf[data-theme="mozaik"] .mz-custom__image{width:100%;border-radius:20px}
.pf[data-theme="mozaik"] .mz-custom__body .pf-prose{max-width:none}
.pf[data-theme="mozaik"] .mz-custom__body .pf-prose>:not(ol){max-width:66ch}
.pf[data-theme="mozaik"] .mz-custom__body .pf-prose>ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px;padding:0;list-style:none;counter-reset:mz-step}
.pf[data-theme="mozaik"] .mz-custom__body .pf-prose>ol>li{display:grid;align-content:start;gap:8px;margin:0;padding:18px;border-radius:20px;background:var(--pf-bg);counter-increment:mz-step}
.pf[data-theme="mozaik"] .mz-custom__body .pf-prose>ol>li::before{content:counter(mz-step);display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--pf-accent);color:var(--pf-on-accent);font:800 var(--pf-text-sm)/1 var(--pf-font-heading)}
.pf[data-theme="mozaik"] .mz-custom__body .pf-btns{justify-self:start}
.pf[data-theme="mozaik"] .mz-wide .pf-cvlist{max-width:80ch}

.pf[data-theme="mozaik"] .mz-contact__main{display:grid;align-content:start;gap:20px;background:var(--pf-accent-soft);box-shadow:var(--mz-rim)}
.pf[data-theme="mozaik"] .mz-contact__main>*{grid-column:1;min-width:0}
.pf[data-theme="mozaik"] .mz-contact__main .mz-title{max-width:22ch;margin:0}
.pf[data-theme="mozaik"] .mz-contact__main[data-note] .mz-title{color:var(--pf-accent-text-soft);font-size:var(--pf-text-sm);font-weight:700;letter-spacing:.01em}
.pf[data-theme="mozaik"] .mz-cta{max-width:22ch;font:800 clamp(1.5rem,1.1rem + 1.4vw,2.25rem)/1.15 var(--pf-font-heading);letter-spacing:-.03em;text-wrap:balance}
.pf[data-theme="mozaik"] .mz-contact__main>.pf-contact-links{gap:4px;padding:16px 18px;border-radius:20px;background:var(--pf-surface)}
.pf[data-theme="mozaik"] .mz-contact__main>.pf-contact-links li{padding-block:4px}
.pf[data-theme="mozaik"] .mz-contact__main>.pf-contact-links li+li{border-top:1px solid var(--pf-border);padding-top:8px}
@media (min-width:901px){.pf[data-theme="mozaik"] .mz-contact__main:has(>.pf-contact-links){grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);grid-template-rows:auto auto auto 1fr;column-gap:clamp(24px,4vw,56px)}.pf[data-theme="mozaik"] .mz-contact__main>.pf-contact-links{grid-column:2;grid-row:1/span 4;align-self:start}}

.pf[data-theme="mozaik"] .pf-detail__panel{background:var(--pf-surface)}
.pf[data-theme="mozaik"] .pf-detail__bar{background:color-mix(in oklab,var(--pf-surface) 92%,transparent)}
.pf[data-theme="mozaik"] .pf-detail__bar a{border-color:transparent;background:var(--pf-bg)}
.pf[data-theme="mozaik"] .pf-detail__hero,.pf[data-theme="mozaik"] .pf-video{border-radius:20px}
.pf[data-theme="mozaik"] .pf-gallery img,.pf[data-theme="mozaik"] .pf-zoom{border-radius:var(--pf-radius-sm)}
.pf[data-theme="mozaik"] .pf-metrics[data-variant="kpi"] .pf-metric{border-color:transparent;border-radius:20px;background:var(--pf-bg)}
.pf[data-theme="mozaik"] .pf-pdf,.pf[data-theme="mozaik"] .pf-link{border-color:transparent;border-radius:20px;background:var(--pf-bg)}
.pf[data-theme="mozaik"] .pf-link:hover{border-color:var(--pf-border)}
.pf[data-theme="mozaik"] .pf-link__site{background:var(--pf-surface);border-color:transparent}
.pf[data-theme="mozaik"] .pf-pdf .pf-btn{background:var(--pf-surface)}
@media (max-width:640px){.pf[data-theme="mozaik"] .pf-detail{background:var(--pf-surface)}}
@media (hover:none){.pf[data-theme="mozaik"] .mz-work>a .mz-work__img img{transform:none}}
`;
