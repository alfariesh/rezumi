/** Neobrutalism's flat fills, heavy outlines and hard offset depth, scoped entirely to Brutal. */
export const BRUTAL_CSS = String.raw`
.pf[data-theme="brutal"]{--pf-max-width:1160px;--pf-radius:4px;--pf-radius-sm:3px;--br-stroke:3px;--br-shadow:6px 6px 0 var(--pf-border);--br-pad:clamp(22px,3.5vw,40px);background:var(--pf-bg);padding-bottom:20px}
.pf[data-theme="brutal"] .br-top{padding-block:24px}
.pf[data-theme="brutal"] .pf-nav{gap:24px}
.pf[data-theme="brutal"] .br-brand{font-weight:800;font-size:20px;letter-spacing:-.04em}
.pf[data-theme="brutal"] .br-mark{display:grid;place-items:center;flex:none;width:44px;height:44px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:3px 3px 0 var(--pf-border);font-size:14px;letter-spacing:-.04em}
.pf[data-theme="brutal"] .pf-nav__links{gap:12px}
.pf[data-theme="brutal"] .pf-nav__links a{display:inline-flex;min-height:44px;align-items:center;padding:6px 10px;border:2px solid transparent;color:var(--pf-text);font-weight:600}
.pf[data-theme="brutal"] .pf-nav__links a:is(:hover,:focus-visible){background:var(--pf-accent);color:var(--pf-on-accent);border-color:var(--pf-border);box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-btn{min-height:48px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);font-weight:700;padding:12px 18px;transition:translate .15s,box-shadow .15s}
.pf[data-theme="brutal"] .pf-btn--primary{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .pf-btn--secondary{background:var(--pf-surface);color:var(--pf-text)}
.pf[data-theme="brutal"] .pf-btn:is(:hover,:focus-visible){translate:3px 3px;box-shadow:1px 1px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-btns{gap:16px;padding-bottom:4px}
.pf[data-theme="brutal"] .pf-chip{border:2px solid var(--pf-border);border-radius:3px;padding:7px 10px;background:var(--pf-surface);color:var(--pf-text);font-weight:600}
.pf[data-theme="brutal"] .pf-chip--open{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .pf-chip--open::before{background:currentColor;box-shadow:none}
.pf[data-theme="brutal"] .pf-menu>summary{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-menu__list{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .pf-menu__list a{border-radius:0}
.pf[data-theme="brutal"] .br-main{display:grid;gap:56px;padding-block:40px 64px;padding-inline-end:max(24px,env(safe-area-inset-right,0px))}
.pf[data-theme="brutal"] .br-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.9fr);gap:clamp(28px,5vw,64px);align-items:center;min-width:0;padding-block:12px 8px}
.pf[data-theme="brutal"] .br-intro{container-type:inline-size;min-width:0;display:grid;gap:24px;align-content:center}
.pf[data-theme="brutal"] .br-name{font-size:max(1.75rem,min(clamp(3rem,5.6vw,5.25rem),calc(100cqi / (var(--name-word) * .66))));font-weight:800;line-height:.98;letter-spacing:-.055em;text-transform:uppercase}
.pf[data-theme="brutal"] .br-headline{font-size:clamp(1.35rem,1rem + 1.2vw,2rem);font-weight:700;line-height:1.15;letter-spacing:-.03em}
.pf[data-theme="brutal"] .br-greeting{max-width:45ch;font-size:17px;line-height:1.65;color:var(--pf-muted)}
.pf[data-theme="brutal"] .br-visual{position:relative;min-width:0;margin-inline-end:20px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:8px 8px 0 var(--pf-border);rotate:2deg}
.pf[data-theme="brutal"] .br-visual__bar{display:flex;align-items:center;gap:6px;padding:12px 16px;border-bottom:var(--br-stroke) solid var(--pf-border);font:700 12px/1 var(--pf-font-mono);background:var(--pf-surface);color:var(--pf-text)}
.pf[data-theme="brutal"] .br-visual__bar i{width:10px;height:10px;border:2px solid currentColor;border-radius:50%;background:var(--pf-accent)}
.pf[data-theme="brutal"] .br-visual__bar span{margin-inline-start:auto}
.pf[data-theme="brutal"] .br-visual__canvas{position:relative;min-width:0;aspect-ratio:1;display:grid;place-items:center;padding:26px}
.pf[data-theme="brutal"] .br-photo{width:100%;height:100%;aspect-ratio:1;object-fit:cover;border:var(--br-stroke) solid var(--pf-border);filter:grayscale(1)}
.pf[data-theme="brutal"] .br-monogram{font:800 clamp(3rem,9vw,7rem)/1 var(--pf-font-heading);letter-spacing:-.08em;overflow-wrap:anywhere;max-width:100%}
.pf[data-theme="brutal"] .br-burst{position:absolute;width:84px;height:84px;inset-inline-end:-20px;bottom:-22px;color:var(--pf-accent);stroke:var(--pf-border);stroke-width:3;overflow:visible;rotate:12deg;pointer-events:none}
.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-visual{grid-column:1;grid-row:1;rotate:-2deg}
.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-intro{grid-column:2;grid-row:1}
.pf[data-theme="brutal"] .br-hero[data-variant="big-name"]{grid-template-columns:minmax(0,1fr) minmax(0,240px)}
.pf[data-theme="brutal"] .br-hero[data-variant="big-name"] .br-name{font-size:max(1.75rem,min(clamp(3.5rem,8vw,7.5rem),calc(100cqi / (var(--name-word) * .66))))}
.pf[data-theme="brutal"] .br-hero[data-bg]:not([data-bg="plain"]){padding:var(--br-pad);border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:var(--br-shadow);background:var(--pf-hero-bg)}
.pf[data-theme="brutal"] .br-stats.pf-metrics{--pf-metric-value:clamp(1.75rem,1.3rem + 2vw,2.75rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:20px}
.pf[data-theme="brutal"] .br-stats .pf-metric{padding:24px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-surface);color:var(--pf-text);box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .br-stats .pf-metric:nth-child(2n){background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .br-stats .pf-metric__value,.pf[data-theme="brutal"] .br-stats .pf-metric__label{color:inherit}
.pf[data-theme="brutal"] .br-stats .pf-metric__label{font-size:14px;font-weight:600}
.pf[data-theme="brutal"] .br-section{position:relative;min-width:0;display:grid;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-surface);box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .br-section>.pf-section__title{font-size:clamp(1.5rem,1.15rem + 1.5vw,2.25rem);font-weight:800;letter-spacing:-.04em;text-transform:uppercase;padding:20px var(--br-pad);padding-inline-end:76px;border-bottom:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent-soft)}
.pf[data-theme="brutal"] .br-section__number{position:absolute;top:20px;inset-inline-end:var(--br-pad);font:700 13px/1.6 var(--pf-font-mono);border:2px solid var(--pf-border);background:var(--pf-surface);padding:2px 6px}
.pf[data-theme="brutal"] .br-section__body{display:grid;align-content:start;gap:24px;min-width:0;padding:var(--br-pad)}
.pf[data-theme="brutal"] .br-section--work{border:0;border-radius:0;box-shadow:none;background:transparent}
.pf[data-theme="brutal"] .br-section--work>.pf-section__title{border:var(--br-stroke) solid var(--pf-border);box-shadow:var(--br-shadow);margin-bottom:32px;background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .br-section--work .br-section__body{padding:0}
.pf[data-theme="brutal"] .br-lead{font-size:20px;line-height:1.7;max-width:70ch}
.pf[data-theme="brutal"] .br-works{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;padding:0}
.pf[data-theme="brutal"] .br-work{min-width:0;display:grid}
.pf[data-theme="brutal"] .br-work__link{display:flex;flex-direction:column;min-width:0;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-surface);color:var(--pf-text);box-shadow:5px 5px 0 var(--pf-border);border-radius:3px;text-decoration:none;transition:translate .15s,box-shadow .15s}
.pf[data-theme="brutal"] .br-work__link:is(:hover,:focus-visible){translate:4px 4px;box-shadow:1px 1px 0 var(--pf-border)}
.pf[data-theme="brutal"] .br-work__cover{--pf-cover-ratio:16/10;border-bottom:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-work__body{display:flex;flex-direction:column;align-items:start;gap:16px;min-width:0;padding:24px}
.pf[data-theme="brutal"] .br-work__meta{display:flex;align-items:baseline;gap:12px;color:var(--pf-muted);font-size:12px;line-height:1.5}
.pf[data-theme="brutal"] .br-work__number{flex:none;font:700 12px/1.5 var(--pf-font-mono);color:var(--pf-text);border:2px solid var(--pf-border);padding:1px 6px;background:var(--pf-accent-soft)}
.pf[data-theme="brutal"] .br-work__title{display:flex;align-items:start;justify-content:space-between;gap:12px;width:100%;font:700 clamp(1.35rem,1.1rem + .7vw,1.75rem)/1.15 var(--pf-font-heading);letter-spacing:-.035em;overflow-wrap:anywhere}
.pf[data-theme="brutal"] .br-work__title .pf-icon{flex:none;margin-top:3px}
.pf[data-theme="brutal"] .br-work__summary{font-size:15px;line-height:1.6;color:var(--pf-muted)}
.pf[data-theme="brutal"] .br-work__tags{display:flex;flex-wrap:wrap;gap:6px}
.pf[data-theme="brutal"] .br-work__tags>span{border:2px solid var(--pf-border);padding:3px 7px;font-size:11px;font-weight:600;line-height:1.4;background:var(--pf-accent-soft)}
.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child{grid-column:1/-1}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__cover{--pf-cover-ratio:21/9}
.pf[data-theme="brutal"] .br-works[data-variant="list"]{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__link{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);align-items:stretch}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__cover{border-bottom:0;border-inline-end:var(--br-stroke) solid var(--pf-border);height:100%}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work[data-image="false"] .br-work__body{grid-column:1/-1}
.pf[data-theme="brutal"] .br-services{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px}
.pf[data-theme="brutal"] .pf-service{display:grid;align-content:start;gap:14px;min-width:0;padding:24px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-bg);box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-service__head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:12px}
.pf[data-theme="brutal"] .pf-service h3{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;letter-spacing:-.03em}
.pf[data-theme="brutal"] .pf-service__price{font-size:13px;font-weight:700;color:var(--pf-accent-text)}
.pf[data-theme="brutal"] .pf-service__desc{font-size:15px;color:var(--pf-muted);line-height:1.6}
.pf[data-theme="brutal"] .pf-service__cta{display:inline-flex;align-items:center;gap:8px;width:fit-content;color:var(--pf-accent-text);font-size:14px;font-weight:700;text-underline-offset:4px}
.pf[data-theme="brutal"] .br-services[data-variant="list"]{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="brutal"] .br-services[data-variant="list"] .pf-service{box-shadow:none;border-width:0 0 2px;padding:20px 0;background:transparent}
.pf[data-theme="brutal"] .br-services[data-variant="list"] .pf-service:last-child{border-bottom:0}
.pf[data-theme="brutal"] .br-quotes{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}
.pf[data-theme="brutal"] .pf-quote{display:grid;align-content:start;gap:20px;min-width:0;padding:24px;border:var(--br-stroke) solid var(--pf-border);box-shadow:4px 4px 0 var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-quote blockquote{font:600 22px/1.5 var(--pf-font-heading);letter-spacing:-.02em}
.pf[data-theme="brutal"] .pf-quote blockquote::before{content:"\201C";display:block;font-size:48px;line-height:.8;color:var(--pf-accent-text)}
.pf[data-theme="brutal"] .pf-avatar{border:2px solid var(--pf-border);border-radius:3px}
.pf[data-theme="brutal"] .pf-quote__source{color:var(--pf-muted);font-size:12px;text-underline-offset:4px}
.pf[data-theme="brutal"] .br-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 8px 10px 0}
.pf[data-theme="brutal"] .br-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(88%,460px);scroll-snap-align:start}
.pf[data-theme="brutal"] .pf-logos{gap:24px}
.pf[data-theme="brutal"] .pf-logo{border:2px solid var(--pf-border);padding:14px 18px;background:var(--pf-bg);min-height:64px}
.pf[data-theme="brutal"] .pf-cvitem__role{font-size:20px;font-weight:700;letter-spacing:-.025em}
.pf[data-theme="brutal"] .pf-cvitem__when{font-size:12px;font-family:var(--pf-font-mono);color:var(--pf-muted)}
.pf[data-theme="brutal"] .pf-tags li{border:2px solid var(--pf-border);border-radius:3px;background:var(--pf-bg);color:var(--pf-text);padding:5px 9px;font-size:12px;font-weight:600}
.pf[data-theme="brutal"] .pf-work-metric{border:2px solid var(--pf-border);border-radius:3px;font-weight:600}
.pf[data-theme="brutal"] .pf-metrics:not(.br-stats) .pf-metric{padding:20px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-trend,.pf[data-theme="brutal"] .pf-metric__bar i,.pf[data-theme="brutal"] .pf-metric__progress{border-radius:2px}
.pf[data-theme="brutal"] .pf-video,.pf[data-theme="brutal"] .pf-pdf,.pf[data-theme="brutal"] .pf-link{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-video__play>span{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-pdf__page{border:2px solid var(--pf-border);border-radius:2px;box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-link__site{border-radius:3px;border:2px solid var(--pf-border)}
.pf[data-theme="brutal"] .pf-detail__panel{max-width:1040px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:8px 8px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-detail__bar{border-bottom:var(--br-stroke) solid var(--pf-border);border-radius:0;backdrop-filter:none;background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-detail__bar a{border:2px solid var(--pf-border);border-radius:3px;background:var(--pf-surface)}
.pf[data-theme="brutal"] .pf-detail__title{font-weight:800;letter-spacing:-.045em}
.pf[data-theme="brutal"] .pf-loc{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-bg);box-shadow:4px 4px 0 var(--pf-border);max-width:480px}
.pf[data-theme="brutal"] .br-custom__image{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;max-height:560px;object-fit:contain;background:var(--pf-bg)}
.pf[data-theme="brutal"] .br-section--contact>.pf-section__title{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .br-cta{font:800 clamp(2rem,1.3rem + 2.8vw,3.75rem)/1.08 var(--pf-font-heading);letter-spacing:-.045em;max-width:24ch}
.pf[data-theme="brutal"] .pf-foot{font-weight:600;border-top:3px solid var(--pf-border);padding-block:28px 44px;gap:20px}
.pf[data-theme="brutal"] .pf-badge{border:2px solid var(--pf-border);border-radius:3px;box-shadow:3px 3px 0 var(--pf-border);background:var(--pf-surface);color:var(--pf-text)}
@media (max-width:960px){.pf[data-theme="brutal"] .pf-nav__links{gap:2px}.pf[data-theme="brutal"] .pf-nav__links a{padding-inline:6px;font-size:13px}.pf[data-theme="brutal"] .br-hero{gap:32px;grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.pf[data-theme="brutal"]{--br-stroke:2px;--br-pad:20px;--br-shadow:4px 4px 0 var(--pf-border)}.pf[data-theme="brutal"] .br-top{padding-block:12px}.pf[data-theme="brutal"] .br-brand{font-size:17px}.pf[data-theme="brutal"] .br-mark{width:36px;height:36px;font-size:11px}.pf[data-theme="brutal"] .br-main{gap:36px;padding-top:24px}.pf[data-theme="brutal"] .br-hero,.pf[data-theme="brutal"] .br-hero[data-variant="big-name"]{grid-template-columns:minmax(0,1fr);gap:32px}.pf[data-theme="brutal"] .br-intro{gap:20px}.pf[data-theme="brutal"] .br-name{font-size:max(1.75rem,min(3.5rem,calc(100cqi / (var(--name-word) * .65))))}.pf[data-theme="brutal"] .br-hero[data-variant="big-name"] .br-name{font-size:max(1.75rem,min(4.25rem,calc(100cqi / (var(--name-word) * .65))))}.pf[data-theme="brutal"] .br-visual{width:min(86%,300px);margin-inline:auto;rotate:1deg}.pf[data-theme="brutal"] .br-visual__canvas{padding:18px}.pf[data-theme="brutal"] .br-burst{width:64px;height:64px;inset-inline-end:-14px;bottom:-14px}.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-visual,.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-intro{grid-column:1;grid-row:auto}.pf[data-theme="brutal"] .br-stats.pf-metrics{grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));gap:16px}.pf[data-theme="brutal"] .br-stats .pf-metric{padding:18px;--pf-metric-value:1.75rem}.pf[data-theme="brutal"] .br-section>.pf-section__title{font-size:26px;padding:16px 20px;padding-inline-end:66px}.pf[data-theme="brutal"] .br-section__number{top:17px;inset-inline-end:16px;font-size:11px}.pf[data-theme="brutal"] .br-works,.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:minmax(0,1fr)}.pf[data-theme="brutal"] .br-work__body{padding:20px}.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__cover{--pf-cover-ratio:16/10}.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__link{display:flex}.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__cover{height:auto;border-inline-end:0;border-bottom:var(--br-stroke) solid var(--pf-border)}.pf[data-theme="brutal"] .br-lead{font-size:18px}.pf[data-theme="brutal"] .pf-service,.pf[data-theme="brutal"] .pf-quote{padding:20px}.pf[data-theme="brutal"] .pf-quote blockquote{font-size:20px}}
@media (prefers-reduced-motion:reduce){.pf[data-theme="brutal"] .br-work__link:is(:hover,:focus-visible),.pf[data-theme="brutal"] .pf-btn:is(:hover,:focus-visible){translate:none}}
`;
