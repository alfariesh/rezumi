import { PAPER_FIBRE_TEXTURE } from "./texture";

/** A warm paper sheet with the reference portfolio's actual fibre texture, bordered cells and registration marks. */
export const PAPER_CSS = String.raw`
.pf[data-theme="paper"]{--pf-max-width:1082px;--pf-radius:4px;--pf-radius-sm:3px;--pp-pad:clamp(24px,4.2vw,60px);position:relative;isolation:isolate;background:var(--pf-bg);font-size:18px;line-height:1.6}
.pf[data-theme="paper"]::before,.pf[data-theme="paper"] .pf-foot::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;opacity:.55;mix-blend-mode:multiply;background-image:url("${PAPER_FIBRE_TEXTURE}");background-size:1200px 300px}
@media screen{:root[data-pf-scheme="dark"] .pf[data-theme="paper"]::before,:root[data-pf-scheme="dark"] .pf[data-theme="paper"] .pf-foot::before{filter:invert(1);mix-blend-mode:screen}}
@media screen and (prefers-color-scheme:dark){:root[data-pf-scheme="auto"] .pf[data-theme="paper"]::before,:root[data-pf-scheme="auto"] .pf[data-theme="paper"] .pf-foot::before{filter:invert(1);mix-blend-mode:screen}}
.pf[data-theme="paper"] .pp-top{padding-block:20px;--pf-max-width:1321px}
.pf[data-theme="paper"] .pp-brand{font-weight:500}
.pf[data-theme="paper"] .pp-monogram{display:grid;place-items:center;flex:none;width:34px;height:34px;background:var(--pf-text);color:var(--pf-bg);border-radius:6px;font-size:12px;font-weight:700;letter-spacing:-.03em}
.pf[data-theme="paper"] .pf-btn{border-radius:4px;font-size:15px;font-weight:500;min-height:44px;padding:10px 16px}
.pf[data-theme="paper"] .pf-btn--primary{background:var(--pf-text);color:var(--pf-bg);border-color:var(--pf-text)}
.pf[data-theme="paper"] .pf-btn--primary:hover{background:var(--pf-muted);border-color:var(--pf-muted)}
.pf[data-theme="paper"] .pf-btn--secondary{border-color:transparent;text-decoration:underline;text-underline-offset:5px}
.pf[data-theme="paper"] .pf-menu>summary,.pf[data-theme="paper"] .pf-menu__list{border-radius:4px}
.pf[data-theme="paper"] .pp-main{padding-top:clamp(36px,6vw,88px);padding-bottom:72px}
.pf[data-theme="paper"] .pp-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,6vw,80px);align-items:center;padding-block:0 clamp(48px,6vw,80px);min-width:0}
.pf[data-theme="paper"] .pp-hero__copy{container-type:inline-size;display:grid;gap:20px;min-width:0;align-content:center}
.pf[data-theme="paper"] .pp-avatar{width:56px;height:56px;object-fit:cover;border-radius:4px;border:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-name{font-size:max(1.75rem,min(clamp(2.75rem,1.6rem + 3.5vw,4rem),calc(100cqi / (var(--name-word) * .6))));font-weight:700;line-height:1.02;letter-spacing:-.035em}
.pf[data-theme="paper"] .pp-headline{font-size:clamp(1.5rem,1.15rem + 1.2vw,2.125rem);font-weight:500;letter-spacing:-.025em;line-height:1.16;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-greeting{max-width:40ch;color:var(--pf-muted);font-size:17px;line-height:1.65}
.pf[data-theme="paper"] .pp-hero .pf-chip{padding:0;background:transparent;color:var(--pf-muted);font-size:12px;letter-spacing:.02em}
.pf[data-theme="paper"] .pp-hero .pf-chips{gap:12px 18px}
.pf[data-theme="paper"] .pp-hero__visual{position:relative;min-width:0;aspect-ratio:1.15;display:grid;place-items:center;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-hero__visual--photo{padding:32px}
.pf[data-theme="paper"] .pp-photo{width:100%;height:100%;min-height:0;max-height:380px;object-fit:cover;aspect-ratio:4/5;border:1px solid var(--pf-border);border-radius:2px}
.pf[data-theme="paper"] .pp-studio{width:100%;height:auto;overflow:visible;color:var(--pf-muted);stroke-width:1.2}
.pf[data-theme="paper"] .pp-studio path{vector-effect:non-scaling-stroke}
.pf[data-theme="paper"] .pp-studio__sheets{fill:var(--pf-surface);stroke:var(--pf-border)}
.pf[data-theme="paper"] .pp-studio__frames{fill:var(--pf-bg);stroke:currentColor}
.pf[data-theme="paper"] .pp-studio__lines{stroke:var(--pf-border)}
.pf[data-theme="paper"] .pp-studio__accent{fill:var(--pf-accent-soft);stroke:var(--pf-accent-text)}
.pf[data-theme="paper"] .pp-studio__cursor{fill:var(--pf-accent-text);stroke:var(--pf-bg);stroke-width:2}
.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__visual{grid-column:1;grid-row:1}
.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__copy{grid-column:2;grid-row:1}
.pf[data-theme="paper"] .pp-hero[data-bg]:not([data-bg="plain"]){padding:var(--pp-pad);margin-bottom:48px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-hero-bg)}
.pf[data-theme="paper"] .pp-fold{position:absolute;inset-block-start:-1px;inset-inline-end:-1px;width:48px;height:48px;pointer-events:none;background:linear-gradient(45deg,var(--pf-border),var(--pf-surface) 50%,var(--pf-bg) 51%);clip-path:polygon(0 0,100% 0,100% 100%)}
.pf[data-theme="paper"] .pp-stats.pf-metrics{--pf-metric-value:clamp(1.75rem,1.3rem + 1.5vw,2.5rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:0;border:1px solid var(--pf-border);border-bottom:0;background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-stats .pf-metric{padding:28px var(--pp-pad);gap:8px}
.pf[data-theme="paper"] .pp-stats .pf-metric+.pf-metric{border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-stats .pf-metric__value{font-family:var(--pf-font-mono);color:var(--pf-text);letter-spacing:-.05em}
.pf[data-theme="paper"] .pp-stats .pf-metric__label{color:var(--pf-muted);font-size:13px;font-weight:400}
.pf[data-theme="paper"] .pp-stats:last-child{border-bottom:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-block-start:1px solid var(--pf-border);border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-cell{background:var(--pf-bg);position:relative;grid-column:1/-1;min-width:0;padding:var(--pp-pad);display:grid;align-content:start;gap:28px;border-inline-end:1px solid var(--pf-border);border-block-end:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-cell::before,.pf[data-theme="paper"] .pp-cell::after{content:"";position:absolute;width:11px;height:11px;pointer-events:none;z-index:1;background:linear-gradient(var(--pf-muted),var(--pf-muted)) center/11px 1px no-repeat,linear-gradient(var(--pf-muted),var(--pf-muted)) center/1px 11px no-repeat;opacity:.6}
.pf[data-theme="paper"] .pp-cell::before{inset-block-start:-6px;inset-inline-start:-6px}
.pf[data-theme="paper"] .pp-cell::after{inset-block-end:-6px;inset-inline-end:-6px}
.pf[data-theme="paper"] .pp-cell--half{grid-column:span 1}
.pf[data-theme="paper"] .pp-cell__body{min-width:0;display:grid;align-content:start;gap:24px}
.pf[data-theme="paper"] .pf-section__title{font-size:clamp(1.75rem,1.1rem + 2vw,2.75rem);font-weight:500;letter-spacing:-.035em;line-height:1.1}
.pf[data-theme="paper"] .pp-cell--half>.pf-section__title{font-size:13px;line-height:1.4;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-cell--about{grid-template-columns:1fr 1.3fr;gap:48px;align-items:start}
.pf[data-theme="paper"] .pp-lead{font-size:20px;line-height:1.65;letter-spacing:-.015em}
.pf[data-theme="paper"] .pp-lead strong{font-weight:500}
.pf[data-theme="paper"] .pp-cell--work{padding:0;gap:0}
.pf[data-theme="paper"] .pp-cell--work>.pf-section__title{position:relative;isolation:isolate;overflow:hidden;text-align:center;padding:80px 24px 64px;font-size:clamp(2rem,1.25rem + 3vw,3.5rem);background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-cell--work>.pf-section__title::before{content:"";position:absolute;z-index:-1;inset-inline:12%;top:30px;aspect-ratio:1;border:1px solid var(--pf-border);border-radius:50%;background:var(--pf-bg)}
.pf[data-theme="paper"] .pp-works{list-style:none;padding:0;display:grid}
.pf[data-theme="paper"] .pp-work{display:grid;min-width:0;border-top:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-work__card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;color:inherit;text-decoration:none}
.pf[data-theme="paper"] .pp-work__art{--pf-cover-ratio:1/1;min-width:0;border-inline-end:1px solid var(--pf-border);background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-work__art img{transition:transform .3s ease}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__art img{transform:scale(1.025)}
.pf[data-theme="paper"] .pp-work__copy{display:flex;flex-direction:column;align-items:start;justify-content:center;gap:16px;min-width:0;padding:clamp(24px,4vw,56px)}
.pf[data-theme="paper"] .pp-work__meta{display:flex;align-items:baseline;gap:16px;font-size:12px;color:var(--pf-muted);line-height:1.5}
.pf[data-theme="paper"] .pp-number{font:400 11px/1.5 var(--pf-font-mono);flex:none;color:var(--pf-accent-text)}
.pf[data-theme="paper"] .pp-work__title{font-size:clamp(1.5rem,1rem + 1.4vw,2.25rem);font-weight:500;letter-spacing:-.03em;line-height:1.15;overflow-wrap:anywhere}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__title{text-decoration:underline;text-underline-offset:5px;text-decoration-color:var(--pf-accent-text)}
.pf[data-theme="paper"] .pp-work__summary{font-size:16px;line-height:1.6;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-work__cta{display:inline-flex;align-items:center;gap:10px;color:var(--pf-accent-text);font-size:14px;text-decoration:none;margin-top:8px;text-underline-offset:4px}
.pf[data-theme="paper"] .pp-work__card:is(:hover,:focus-visible) .pp-work__cta{text-decoration:underline}
.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__art{grid-column:2;grid-row:1;border-inline-end:0;border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__copy{grid-column:1;grid-row:1}
.pf[data-theme="paper"] .pp-work[data-image="false"] .pp-work__card{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="paper"] .pp-work[data-image="false"] .pp-work__copy{grid-column:1/-1}
.pf[data-theme="paper"] .pp-works[data-variant="grid-2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.pf[data-theme="paper"] .pp-works[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__card{grid-template-columns:minmax(0,1fr);align-content:start}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__art{border-inline-end:0;border-bottom:1px solid var(--pf-border);--pf-cover-ratio:4/3}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__copy{padding:28px}
.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]) .pp-work__title{font-size:24px}
.pf[data-theme="paper"] .pp-services{display:grid;list-style:none;padding:0;gap:0}
.pf[data-theme="paper"] .pf-service{display:grid;gap:12px;padding-block:24px;border-top:1px solid var(--pf-border);min-width:0;align-content:start}
.pf[data-theme="paper"] .pf-service__head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px}
.pf[data-theme="paper"] .pf-service h3{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:500;letter-spacing:-.02em}
.pf[data-theme="paper"] .pf-service__price{font-size:14px;color:var(--pf-muted)}
.pf[data-theme="paper"] .pf-service__desc{max-width:60ch;font-size:16px;color:var(--pf-muted)}
.pf[data-theme="paper"] .pf-service__cta{display:inline-flex;align-items:center;gap:10px;width:fit-content;font-size:14px;color:var(--pf-accent-text);text-underline-offset:4px}
.pf[data-theme="paper"] .pp-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px}
.pf[data-theme="paper"] .pp-services[data-variant="cards"] .pf-service{padding:24px;border:1px solid var(--pf-border);background:var(--pf-surface)}
.pf[data-theme="paper"] .pp-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:32px;list-style:none;padding:0}
.pf[data-theme="paper"] .pf-quote{display:grid;align-content:start;gap:20px;padding-top:20px;border-top:1px solid var(--pf-border);min-width:0}
.pf[data-theme="paper"] .pf-quote blockquote{font-size:22px;line-height:1.5;letter-spacing:-.02em}
.pf[data-theme="paper"] .pf-quote blockquote::before{content:"\201C";display:block;color:var(--pf-accent-text);font-size:40px;line-height:.9}
.pf[data-theme="paper"] .pf-quote__source{font-size:13px;color:var(--pf-muted);text-underline-offset:4px}
.pf[data-theme="paper"] .pp-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}
.pf[data-theme="paper"] .pp-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(88%,440px);scroll-snap-align:start}
.pf[data-theme="paper"] .pf-cvitem__role{font-size:18px;font-weight:500}
.pf[data-theme="paper"] .pf-cvitem__when{font-family:var(--pf-font-mono);font-size:11px;letter-spacing:-.02em}
.pf[data-theme="paper"] .pf-cvitem .pf-prose{font-size:15px}
.pf[data-theme="paper"] .pf-extralist,.pf[data-theme="paper"] .pf-skillgroups{font-size:16px}
.pf[data-theme="paper"] .pf-skillgroups b{font-weight:500}
.pf[data-theme="paper"] .pf-tags li{border:0;padding:0;font-size:13px}
.pf[data-theme="paper"] .pf-tags li+li::before{content:"/";margin-inline-end:8px;color:var(--pf-border)}
.pf[data-theme="paper"] .pp-cell--contact{background:var(--pf-surface);padding-block:clamp(48px,7vw,96px)}
.pf[data-theme="paper"] .pp-cell--contact>.pf-section__title{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--pf-muted)}
.pf[data-theme="paper"] .pp-cta{font-size:clamp(2rem,1.2rem + 3vw,3.75rem);letter-spacing:-.04em;line-height:1.1;max-width:22ch;font-weight:500}
.pf[data-theme="paper"] .pp-cell--contact .pf-loc{max-width:440px;background:var(--pf-bg)}
.pf[data-theme="paper"] .pp-custom__image{width:100%;max-height:560px;object-fit:contain;border:1px solid var(--pf-border)}
.pf[data-theme="paper"] .pf-foot{position:relative;isolation:isolate;background:var(--pf-bg);padding-block:32px 48px;border-top:0;font-size:13px}
.pf[data-theme="paper"] .pf-foot::before{opacity:1}
.pf[data-theme="paper"] .pf-workpage{max-width:1082px}
.pf[data-theme="paper"] .pf-detail__title{font-weight:500;letter-spacing:-.03em}
.pf[data-theme="paper"] :is(.pf-workpage__back,.pf-workpage__step){border-radius:4px}
.pf[data-theme="paper"] .pf-metrics:not(.pp-stats) .pf-metric__value{font-family:var(--pf-font-mono)}
@media (max-width:960px){.pf[data-theme="paper"] .pp-top .pf-nav__links{gap:16px}.pf[data-theme="paper"] .pp-works[data-variant="grid-3"]{grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="paper"] .pp-stats .pf-metric{padding-inline:24px}.pf[data-theme="paper"] .pp-cell--about{gap:32px}}
@media (max-width:760px){.pf[data-theme="paper"]{font-size:17px;--pp-pad:24px}.pf[data-theme="paper"] .pp-top{padding-block:12px}.pf[data-theme="paper"] .pp-main{padding-top:28px;padding-bottom:24px}.pf[data-theme="paper"] .pp-hero{grid-template-columns:minmax(0,1fr);gap:28px;padding-bottom:40px}.pf[data-theme="paper"] .pp-hero__copy{gap:18px}.pf[data-theme="paper"] .pp-name{font-size:max(1.75rem,min(3.25rem,calc(100cqi / (var(--name-word) * .59))))}.pf[data-theme="paper"] .pp-headline{font-size:26px}.pf[data-theme="paper"] .pp-hero__visual:not(.pp-hero__visual--photo){display:none}.pf[data-theme="paper"] .pp-hero__visual--photo{width:180px;aspect-ratio:1;padding:12px;grid-row:1}.pf[data-theme="paper"] .pp-photo{aspect-ratio:1;max-height:180px}.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__copy,.pf[data-theme="paper"] .pp-hero[data-variant="photo-left"] .pp-hero__visual{grid-column:1;grid-row:auto}.pf[data-theme="paper"] .pp-hero .pp-fold{width:28px;height:28px}.pf[data-theme="paper"] .pp-stats.pf-metrics{grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr))}.pf[data-theme="paper"] .pp-stats .pf-metric{padding:20px 16px}.pf[data-theme="paper"] .pp-stats .pf-metric+.pf-metric{border-inline-start:0}.pf[data-theme="paper"] .pp-sheet{grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-cell--half{grid-column:1/-1}.pf[data-theme="paper"] .pp-cell--about{grid-template-columns:minmax(0,1fr);gap:24px}.pf[data-theme="paper"] .pp-lead{font-size:18px}.pf[data-theme="paper"] .pp-cell--work>.pf-section__title{padding:56px 24px 48px}.pf[data-theme="paper"] .pp-work__card,.pf[data-theme="paper"] .pp-works:is([data-variant="grid-2"],[data-variant="grid-3"]){grid-template-columns:minmax(0,1fr)}.pf[data-theme="paper"] .pp-work__art{--pf-cover-ratio:4/3;border-inline:0;border-bottom:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__art,.pf[data-theme="paper"] .pp-works[data-variant="list"] .pp-work:nth-child(even) .pp-work__copy{grid-column:1;grid-row:auto;border-inline:0}.pf[data-theme="paper"] .pp-work__copy{padding:28px 24px;gap:14px}.pf[data-theme="paper"] .pp-work__title{font-size:28px}.pf[data-theme="paper"] .pp-cell--contact{padding-block:48px}.pf[data-theme="paper"] .pp-fold{width:36px;height:36px}.pf[data-theme="paper"] .pp-stats.pf-metrics:has(.pf-metric:nth-child(3):last-child){grid-template-columns:repeat(3,minmax(0,1fr))}.pf[data-theme="paper"] .pp-stats.pf-metrics:has(.pf-metric:nth-child(3):last-child) .pf-metric{padding-inline:10px}.pf[data-theme="paper"] .pp-stats:has(.pf-metric:nth-child(3):last-child) .pf-metric+.pf-metric{border-inline-start:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-stats.pf-metrics:has(.pf-metric:nth-child(4)){grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="paper"] .pp-stats:has(.pf-metric:nth-child(4)) .pf-metric:nth-child(n+3){border-top:1px solid var(--pf-border)}.pf[data-theme="paper"] .pp-stats .pf-metric:nth-child(even){border-inline-start:1px solid var(--pf-border)}}

`;
