/**
 * Prima: formal and wide (1160 px), square-ish 6 px corners, white cards on a light grey page, a sticky translucent
 * navigation, the intro beside the photo, a joined KPI strip, and every section as a two-column row (220 px title |
 * content). Values from `mockups/prima.html`; the variants the theme offers (`PORTFOLIO_THEME_INFO.prima.variants`)
 * are data attributes.
 */
export const PRIMA_CSS = String.raw`
.pf[data-theme="prima"]{--pf-max-width:1160px;--pf-radius:6px;--pf-radius-sm:4px;--pf-hero-ground:var(--pf-surface);--pf-hero-shade:rgb(8 10 14/.68),rgb(8 10 14/.76)}
.pf[data-theme="prima"] .pf-btn{border-radius:var(--pf-radius)}
.pf[data-theme="prima"] .pf-btn--primary{border-color:color-mix(in oklab,var(--pf-accent) 78%,var(--pf-text))}
.pf[data-theme="prima"] .pf-chip{border-radius:var(--pf-radius-sm);background:var(--pf-surface);border:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pf-tags li{border-radius:var(--pf-radius-sm);background:var(--pf-surface)}
.pf[data-theme="prima"] :is(.pf-trend,.pf-work-metric){border-radius:var(--pf-radius-sm)}
.pf[data-theme="prima"] :is(.pf-skip,.pf-badge,.pf-menu>summary,.pf-detail__bar a){border-radius:var(--pf-radius)}
.pf[data-theme="prima"] .pf-menu__list{border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="prima"] .pf-menu__list a{border-radius:var(--pf-radius-sm)}
.pf[data-theme="prima"] .pf-menu__list a:hover{background:var(--pf-bg)}
.pf[data-theme="prima"] .pf-metrics[data-variant="kpi"] .pf-metric{background:var(--pf-surface)}
.pf[data-theme="prima"] .pr-head{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:color-mix(in oklab,var(--pf-bg) 92%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pr-brand{font-size:1.125rem;font-weight:600;letter-spacing:-.005em}
.pf[data-theme="prima"] .pf-nav__links{gap:22px}
.pf[data-theme="prima"] .pf-nav__links .pr-head__cta a{min-height:38px;padding:.45em 1em;font-size:var(--pf-text-xs);color:var(--pf-on-accent)}
@media (max-width:960px){.pf[data-theme="prima"] .pr-head__cta{display:none}}
.pf[data-theme="prima"] .pr-hero{--pr-pad:0px;--pr-inner:calc(min(100vw - 32px,1160px) - 2 * var(--pr-pad));--pr-col:calc((var(--pr-inner) - clamp(32px,6vw,88px)) * .66);display:grid;gap:clamp(40px,6vw,64px);min-width:0;padding-block:clamp(40px,7vw,96px) clamp(40px,6vw,72px)}
.pf[data-theme="prima"] .pr-hero__grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:clamp(32px,6vw,88px);align-items:center;min-width:0}
.pf[data-theme="prima"] .pr-hero__text{display:grid;gap:20px;justify-items:start;align-content:center;min-width:0}
.pf[data-theme="prima"] .pr-hero__text>*{max-width:100%}
.pf[data-theme="prima"] .pr-headline{order:-1;font-size:var(--pf-text-xs);font-weight:600;line-height:1.5;letter-spacing:.12em;text-transform:uppercase;color:var(--pf-accent-text)}
.pf[data-theme="prima"] .pr-name{font-size:min(clamp(2.6rem,1.6rem + 4vw,4.4rem),calc(var(--pr-col) / (var(--name-word) * .6)));font-weight:600;letter-spacing:-.025em;line-height:1.02;margin-top:-4px}
.pf[data-theme="prima"] .pr-greeting{font-size:var(--pf-text-lg);line-height:1.55;max-width:40ch}
.pf[data-theme="prima"] .pr-photo{display:grid;gap:10px;justify-self:end;width:100%;max-width:360px;min-width:0}
.pf[data-theme="prima"] .pr-photo img{width:100%;aspect-ratio:4/5;object-fit:cover;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="prima"] .pr-photo figcaption{padding-inline-start:12px;border-inline-start:2px solid var(--pf-accent-text);color:var(--pf-muted);font-size:var(--pf-text-xs);line-height:1.5}
.pf[data-theme="prima"] .pr-hero[data-variant="photo-left"] .pr-hero__grid{grid-template-columns:minmax(0,.65fr) minmax(0,1.35fr)}
.pf[data-theme="prima"] .pr-hero[data-variant="photo-left"] .pr-photo{order:-1;justify-self:start}
.pf[data-theme="prima"] .pr-hero[data-variant="no-photo"]{--pr-col:var(--pr-inner)}
.pf[data-theme="prima"] .pr-hero[data-variant="no-photo"] .pr-hero__grid{grid-template-columns:minmax(0,1fr)}
@media (max-width:820px){.pf[data-theme="prima"] .pr-hero{--pr-col:var(--pr-inner)}.pf[data-theme="prima"] .pr-hero[data-variant] .pr-hero__grid{grid-template-columns:minmax(0,1fr)}.pf[data-theme="prima"] .pr-hero[data-variant] .pr-photo{order:-1;justify-self:start;max-width:200px}}
.pf[data-theme="prima"] .pr-hero[data-bg]:not([data-bg="plain"]){--pr-pad:clamp(24px,5vw,56px);position:relative;margin-block:clamp(16px,3vw,32px) clamp(40px,6vw,72px);padding:var(--pr-pad);border:1px solid var(--pf-border);border-radius:calc(var(--pf-radius) + 4px);overflow:hidden;background:var(--pf-hero-bg)}
.pf[data-theme="prima"] .pr-hero[data-bg="image"]{border-color:transparent}
.pf[data-theme="prima"] .pr-hero[data-bg="image"] .pr-headline{color:color-mix(in oklab,var(--pf-accent-text) 40%,#fff)}
.pf[data-theme="prima"] .pr-hero[data-bg="image"] .pr-kpis .pf-metric{background:rgb(8 10 14/.5)}
.pf[data-theme="prima"] .pr-kpis{min-width:0}
.pf[data-theme="prima"] .pr-kpis .pf-metrics{grid-template-columns:repeat(var(--pr-kpis,4),minmax(0,1fr));gap:1px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-border);overflow:hidden}
.pf[data-theme="prima"] .pr-kpis .pf-metric{padding:22px 24px;border:0;border-radius:0}
.pf[data-theme="prima"] .pr-kpis .pf-metric__value{font-size:clamp(1.75rem,1.4rem + 1.2vw,2.25rem)}
@media (max-width:900px){.pf[data-theme="prima"] .pr-kpis .pf-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="prima"] .pr-kpis .pf-metric:last-child:nth-child(odd){grid-column:span 2}}
@media (max-width:560px){.pf[data-theme="prima"] .pr-kpis .pf-metric{padding:16px}.pf[data-theme="prima"] .pr-kpis .pf-metric__value{font-size:1.375rem;overflow-wrap:break-word}}
.pf[data-theme="prima"] .pr-row{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px 48px;min-width:0;padding-block:clamp(36px,5vw,64px);border-top:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pr-row:last-child{border-bottom:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pr-row .pf-section__title{font-size:var(--pf-text-xl);font-weight:600;letter-spacing:-.01em;line-height:1.2}
.pf[data-theme="prima"] .pr-row__body{display:grid;gap:20px;align-content:start;min-width:0}
.pf[data-theme="prima"] .pr-facts>.pf-extras{grid-column:2;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:28px}
@media (max-width:820px){.pf[data-theme="prima"] .pr-row{grid-template-columns:minmax(0,1fr)}.pf[data-theme="prima"] .pr-facts>.pf-extras{grid-column:1}}
.pf[data-theme="prima"] .pf-extra__title{margin-bottom:12px;color:var(--pf-muted);font:600 var(--pf-text-xs)/1.4 var(--pf-font-body);letter-spacing:.08em;text-transform:uppercase}
.pf[data-theme="prima"] .pf-extra .pf-extralist{gap:12px}
.pf[data-theme="prima"] .pr-row__body>.pr-list ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:14px 28px;margin:0;padding:0;list-style:none}
.pf[data-theme="prima"] .pr-row__body>.pr-list li{display:grid;gap:1px;font-size:var(--pf-text-sm)}
.pf[data-theme="prima"] .pr-row__body>.pr-list li span{color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf[data-theme="prima"] .pr-list li a{text-underline-offset:3px}
.pf[data-theme="prima"] .pr-lead{font-size:var(--pf-text-lg);line-height:1.6}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem{position:relative;display:grid;grid-template-columns:150px 16px minmax(0,1fr);gap:4px 18px;margin:0;padding:0 0 28px;border:0}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem:last-child{padding-bottom:0}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>.pf-cvitem__head{display:contents}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{grid-column:1;grid-row:1;padding-top:3px}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__role{grid-column:3;grid-row:1;font:600 var(--pf-text-lg)/1.3 var(--pf-font-heading)}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>:not(.pf-cvitem__head){grid-column:3}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::before{content:"";position:relative;z-index:1;grid-column:2;grid-row:1;width:16px;height:16px;margin-top:5px;border:2px solid var(--pf-accent-text);border-radius:50%;background:var(--pf-bg)}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem:first-child::before{background:var(--pf-accent-text)}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::after{content:"";position:absolute;inset-inline-start:175px;top:12px;bottom:-6px;width:2px;background:var(--pf-border)}
.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem:last-child::after{content:none}
@media (max-width:560px){.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem{grid-template-columns:16px minmax(0,1fr);column-gap:14px}.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{grid-column:2;padding-top:1px}.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__role{grid-column:2;grid-row:2}.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem>:not(.pf-cvitem__head){grid-column:2}.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::before{grid-column:1;margin-top:4px}.pf[data-theme="prima"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::after{inset-inline-start:7px;top:10px}}
.pf[data-theme="prima"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem+.pf-cvitem{padding-top:20px;border-top:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pr-works{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,max(260px,calc((100% - 20px) / 2))),1fr));gap:20px;margin:0;padding:0;list-style:none}
.pf[data-theme="prima"] .pr-works[data-variant="grid-3"]{grid-template-columns:repeat(auto-fill,minmax(min(100%,max(220px,calc((100% - 40px) / 3))),1fr))}
.pf[data-theme="prima"] .pr-works[data-variant="list"]{grid-template-columns:minmax(0,1fr);gap:16px}
.pf[data-theme="prima"] .pr-work{display:grid;min-width:0}
.pf[data-theme="prima"] .pr-card{display:grid;grid-template-rows:auto 1fr;height:100%;overflow:hidden;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-surface);color:inherit;text-decoration:none;transition:border-color .2s,box-shadow .2s}
.pf[data-theme="prima"] .pr-card:is(:hover,:focus-visible){border-color:color-mix(in oklab,var(--pf-accent-text) 50%,var(--pf-border));box-shadow:0 8px 24px rgb(15 23 42/.08)}
.pf[data-theme="prima"] .pr-work[data-noimg] .pr-card{grid-template-rows:1fr;box-shadow:inset 0 2px var(--pf-accent)}
.pf[data-theme="prima"] .pr-work[data-noimg] .pr-card:is(:hover,:focus-visible){box-shadow:inset 0 2px var(--pf-accent),0 8px 24px rgb(15 23 42/.08)}
.pf[data-theme="prima"] .pr-card__cover{--pf-cover-ratio:16/10;border-bottom:1px solid var(--pf-border)}
.pf[data-theme="prima"] .pr-card__body{display:grid;gap:8px;align-content:start;min-width:0;padding:20px 22px 22px}
.pf[data-theme="prima"] .pr-card__meta{color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf[data-theme="prima"] .pr-card__title{font:600 var(--pf-text-lg)/1.3 var(--pf-font-heading);letter-spacing:-.005em}
.pf[data-theme="prima"] .pr-card:is(:hover,:focus-visible) .pr-card__title{text-decoration:underline;text-decoration-color:var(--pf-accent-text);text-decoration-thickness:1px;text-underline-offset:4px}
.pf[data-theme="prima"] .pr-card__summary{color:var(--pf-muted);font-size:var(--pf-text-sm);line-height:1.5}
.pf[data-theme="prima"] .pr-card .pf-work-metric{justify-self:start;margin-top:4px}
.pf[data-theme="prima"] .pr-works[data-variant="list"] .pr-card{grid-template-columns:minmax(0,240px) minmax(0,1fr);grid-template-rows:auto}
.pf[data-theme="prima"] .pr-works[data-variant="list"] .pr-work[data-noimg] .pr-card{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="prima"] .pr-works[data-variant="list"] .pr-card__cover{align-self:stretch;aspect-ratio:auto;min-height:150px;border-bottom:0;border-inline-end:1px solid var(--pf-border)}
@media (max-width:560px){.pf[data-theme="prima"] .pr-works[data-variant="list"] .pr-card{grid-template-columns:minmax(0,1fr)}.pf[data-theme="prima"] .pr-works[data-variant="list"] .pr-card__cover{aspect-ratio:16/10;min-height:0;border-inline-end:0;border-bottom:1px solid var(--pf-border)}}
.pf[data-theme="prima"] .pr-services{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:16px;margin:0;padding:0;list-style:none}
.pf[data-theme="prima"] .pf-service{display:grid;gap:8px;align-content:start;min-width:0;padding:22px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="prima"] .pf-service__head{display:grid;gap:4px}
.pf[data-theme="prima"] .pf-service h3{display:flex;align-items:center;gap:10px;font-size:var(--pf-text-md);font-weight:600;line-height:1.3}
.pf[data-theme="prima"] .pf-service h3 svg{width:22px;height:22px;flex:none;color:var(--pf-accent-text)}
.pf[data-theme="prima"] .pf-service__price{color:var(--pf-accent-text);font-size:var(--pf-text-sm);font-weight:600;font-variant-numeric:tabular-nums}
.pf[data-theme="prima"] .pf-service p{color:var(--pf-muted);font-size:var(--pf-text-sm)}
.pf[data-theme="prima"] .pf-service__cta{display:inline-flex;align-items:center;gap:6px;width:fit-content;margin-top:6px;color:var(--pf-accent-text);font-size:var(--pf-text-sm);font-weight:600;text-underline-offset:4px}
.pf[data-theme="prima"] .pr-services[data-variant="list"]{grid-template-columns:minmax(0,1fr);gap:0}
.pf[data-theme="prima"] .pr-services[data-variant="list"] .pf-service{padding:20px 0;border:0;border-top:1px solid var(--pf-border);border-radius:0;background:none}
.pf[data-theme="prima"] .pr-services[data-variant="list"] .pf-service:first-child{padding-top:0;border-top:0}
.pf[data-theme="prima"] .pr-services[data-variant="list"] .pf-service:last-child{padding-bottom:0}
.pf[data-theme="prima"] .pr-services[data-variant="list"] .pf-service__head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 16px}
.pf[data-theme="prima"] .pr-services[data-variant="list"] .pf-service h3{font:600 var(--pf-text-lg)/1.3 var(--pf-font-heading)}
.pf[data-theme="prima"] .pr-quotes{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:16px;margin:0;padding:0;list-style:none}
.pf[data-theme="prima"] .pr-quotes .pf-quote{display:flex;flex-direction:column;gap:18px;min-width:0;padding:24px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-surface)}
.pf[data-theme="prima"] .pr-quotes blockquote{flex:1;font:italic 400 var(--pf-text-md)/1.6 var(--pf-font-heading)}
.pf[data-theme="prima"] .pf-quote__source{align-self:flex-start;color:var(--pf-muted);font-size:var(--pf-text-xs);text-underline-offset:3px}
.pf[data-theme="prima"] .pr-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}
.pf[data-theme="prima"] .pr-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(86%,420px);scroll-snap-align:start}
.pf[data-theme="prima"] .pf-logos{gap:16px 36px}
.pf[data-theme="prima"] .pr-custom__image{border:1px solid var(--pf-border);border-radius:var(--pf-radius)}
.pf[data-theme="prima"] .pr-custom .pf-btns{justify-self:start}
.pf[data-theme="prima"] .pr-custom .pf-prose ol{display:grid;gap:12px;padding:0;list-style:none;counter-reset:pr-step}
.pf[data-theme="prima"] .pr-custom .pf-prose ol>li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:0 14px;margin:0;font:400 var(--pf-text-lg)/1.45 var(--pf-font-heading);counter-increment:pr-step}
.pf[data-theme="prima"] .pr-custom .pf-prose ol>li>*{grid-column:2}
.pf[data-theme="prima"] .pr-custom .pf-prose ol>li::before{content:counter(pr-step);display:grid;place-items:center;width:30px;height:30px;margin-top:-1px;border:1.5px solid var(--pf-accent-text);border-radius:50%;color:var(--pf-accent-text);font:600 var(--pf-text-xs)/1 var(--pf-font-body)}
.pf[data-theme="prima"] .pr-contact{display:grid;gap:20px;align-items:start;min-width:0}
.pf[data-theme="prima"] .pr-contact[data-loc]{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);grid-template-rows:repeat(6,auto) 1fr;gap:0 40px}
.pf[data-theme="prima"] .pr-contact[data-loc]>*{grid-column:1}
.pf[data-theme="prima"] .pr-contact[data-loc]>*+*{margin-top:20px}
.pf[data-theme="prima"] .pr-contact[data-loc]>.pf-loc{grid-column:2;grid-row:1/-1;margin-top:0}
@media (max-width:900px){.pf[data-theme="prima"] .pr-contact[data-loc]{grid-template-columns:minmax(0,1fr);grid-template-rows:none}.pf[data-theme="prima"] .pr-contact[data-loc]>.pf-loc{grid-column:1;grid-row:auto;max-width:420px;margin-top:24px}}
.pf[data-theme="prima"] .pr-cta{max-width:32ch;font:600 var(--pf-text-xl)/1.3 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="prima"] .pf-loc{background:var(--pf-surface)}
.pf[data-theme="prima"] .pf-detail__panel{max-width:920px;border-radius:calc(var(--pf-radius) + 2px)}
.pf[data-theme="prima"] .pf-detail__bar{border-radius:calc(var(--pf-radius) + 2px) calc(var(--pf-radius) + 2px) 0 0}
.pf[data-theme="prima"] .pf-detail__title{font-weight:600}
.pf[data-theme="prima"] .pf-detail__hero{border:1px solid var(--pf-border)}
@media (max-width:640px){.pf[data-theme="prima"] :is(.pf-detail__panel,.pf-detail__bar){border-radius:0}}
`;
