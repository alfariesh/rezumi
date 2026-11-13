/**
 * Neobrutalism's flat fills, heavy outlines and hard offset depth, scoped entirely to Brutal: a loud intro and ticker,
 * long sections open under huge numbered titles, short ones as cards two to a row, an ink band for testimonials and a
 * full accent block for contact.
 */
export const BRUTAL_CSS = String.raw`
.pf[data-theme="brutal"]{--pf-max-width:1160px;--pf-radius:4px;--pf-radius-sm:3px;--br-stroke:3px;--br-shadow:6px 6px 0 var(--pf-border);--br-pad:clamp(22px,3.5vw,40px);overflow-x:clip;background:var(--pf-bg);font-size:17px}
.pf[data-theme="brutal"] .br-top{padding-block:20px;border-bottom:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .pf-nav{gap:24px}
.pf[data-theme="brutal"] .br-brand{font-weight:800;font-size:20px;letter-spacing:-.04em}
.pf[data-theme="brutal"] .br-mark{display:grid;place-items:center;flex:none;width:44px;height:44px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:3px 3px 0 var(--pf-border);font-size:14px;letter-spacing:-.04em;rotate:-4deg}
.pf[data-theme="brutal"] .pf-nav__links{gap:8px}
.pf[data-theme="brutal"] .pf-nav__links a{display:inline-flex;min-height:44px;align-items:center;padding:6px 12px;border:2px solid transparent;color:var(--pf-text);font-weight:700;text-transform:uppercase;font-size:13px;letter-spacing:.04em}
.pf[data-theme="brutal"] .pf-nav__links a:is(:hover,:focus-visible){background:var(--pf-accent);color:var(--pf-on-accent);border-color:var(--pf-border);box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-btn{min-height:52px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);font-weight:800;font-size:15px;padding:12px 20px;text-transform:uppercase;letter-spacing:.03em;transition:translate .15s,box-shadow .15s}
.pf[data-theme="brutal"] .pf-btn--primary{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .pf-btn--secondary{background:var(--pf-surface);color:var(--pf-text)}
.pf[data-theme="brutal"] .pf-btn:is(:hover,:focus-visible){translate:3px 3px;box-shadow:1px 1px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-btns{gap:16px;padding-bottom:4px}
.pf[data-theme="brutal"] .pf-chip{border:2px solid var(--pf-border);border-radius:3px;padding:7px 10px;background:var(--pf-surface);color:var(--pf-text);font-weight:700;font-size:13px}
.pf[data-theme="brutal"] .pf-chip--open{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .pf-chip--open::before{background:currentColor;box-shadow:none}
.pf[data-theme="brutal"] .pf-opento{font-size:15px}
.pf[data-theme="brutal"] .pf-menu>summary{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-menu__list{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .pf-menu__list a{border-radius:0}
.pf[data-theme="brutal"] .br-main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:28px;row-gap:clamp(56px,7vw,96px);padding-block:clamp(40px,5vw,64px) 0}
.pf[data-theme="brutal"] .br-main>*{grid-column:1/-1;min-width:0}
.pf[data-theme="brutal"] .br-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);gap:clamp(28px,5vw,64px);align-items:center;min-width:0}
.pf[data-theme="brutal"] .br-intro{container-type:inline-size;min-width:0;display:grid;gap:22px;align-content:center;justify-items:start}
.pf[data-theme="brutal"] .br-name{font-size:max(2rem,min(clamp(3.5rem,7.4vw,7.5rem),calc(100cqi / (var(--name-word) * .64))));font-weight:800;line-height:.9;letter-spacing:-.06em;text-transform:uppercase}
.pf[data-theme="brutal"] .br-headline{display:inline;padding:4px 12px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:4px 4px 0 var(--pf-border);font-size:clamp(1.25rem,1rem + 1vw,1.85rem);font-weight:800;line-height:1.25;letter-spacing:-.03em;rotate:-1.2deg;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.pf[data-theme="brutal"] .br-greeting{max-width:46ch;font-size:19px;line-height:1.6;font-weight:500}
.pf[data-theme="brutal"] .br-visual{position:relative;min-width:0;margin:0 20px 20px 0;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:10px 10px 0 var(--pf-border);rotate:2.5deg;aspect-ratio:4/5;display:grid;place-items:center}
.pf[data-theme="brutal"] .br-photo{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08)}
.pf[data-theme="brutal"] .br-monogram{font:800 clamp(4rem,11vw,9rem)/1 var(--pf-font-heading);letter-spacing:-.08em;overflow-wrap:anywhere;max-width:100%}
.pf[data-theme="brutal"] .br-burst{position:absolute;width:96px;height:96px;inset-inline-end:-30px;top:-30px;color:var(--pf-accent);stroke:var(--pf-border);stroke-width:3;overflow:visible;rotate:14deg;pointer-events:none}
.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-visual{grid-column:1;grid-row:1;rotate:-2.5deg}
.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,.85fr) minmax(0,1.35fr)}
.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-intro{grid-column:2;grid-row:1}
.pf[data-theme="brutal"] .br-hero[data-variant="big-name"]{grid-template-columns:minmax(0,1fr) minmax(0,220px)}
.pf[data-theme="brutal"] .br-hero[data-variant="big-name"] .br-name{font-size:max(2rem,min(clamp(4rem,10vw,9.5rem),calc(100cqi / (var(--name-word) * .64))))}
.pf[data-theme="brutal"] .br-hero[data-bg]:not([data-bg="plain"]){padding:var(--br-pad);border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:var(--br-shadow);background:var(--pf-hero-bg)}
.pf[data-theme="brutal"] .br-stats.pf-metrics{--pf-metric-value:clamp(2.25rem,1.6rem + 2.4vw,3.5rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:0;margin-top:calc(-1 * clamp(24px,3vw,48px));border:var(--br-stroke) solid var(--pf-border);box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .br-stats .pf-metric{padding:24px 28px;gap:8px;background:var(--pf-surface);color:var(--pf-text)}
.pf[data-theme="brutal"] .br-stats .pf-metric+.pf-metric{border-inline-start:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-stats .pf-metric:nth-child(3n+1){background:var(--pf-text);color:var(--pf-bg)}
.pf[data-theme="brutal"] .br-stats .pf-metric:nth-child(3n+2){background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .br-stats .pf-metric__value{font-family:var(--pf-font-mono);letter-spacing:-.05em}
.pf[data-theme="brutal"] .br-stats .pf-metric__value,.pf[data-theme="brutal"] .br-stats .pf-metric__label{color:inherit}
.pf[data-theme="brutal"] .br-stats .pf-metric__label{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.pf[data-theme="brutal"] .br-ticker{width:100vw;margin-inline:calc(50% - 50vw);overflow:hidden;border-block:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);rotate:-1.5deg}
.pf[data-theme="brutal"] .br-ticker__track{display:flex;width:max-content;animation:br-ticker 40s linear infinite}
.pf[data-theme="brutal"] .br-ticker__run{display:flex;flex:none}
.pf[data-theme="brutal"] .br-ticker__run>span{display:inline-flex;align-items:center;gap:28px;padding:14px 0 14px 28px;font:800 clamp(1.25rem,1rem + 1vw,1.75rem)/1 var(--pf-font-heading);letter-spacing:-.02em;text-transform:uppercase;white-space:nowrap}
.pf[data-theme="brutal"] .br-ticker__run i{width:16px;height:16px;flex:none;background:currentColor;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)}
@keyframes br-ticker{to{transform:translateX(-50%)}}
[dir="rtl"] .pf[data-theme="brutal"] .br-ticker__track,.pf[data-theme="brutal"][dir="rtl"] .br-ticker__track{animation-direction:reverse}
.pf[data-theme="brutal"] .br-section{position:relative;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:18px;align-items:center;align-content:start}
.pf[data-theme="brutal"] .br-section>.pf-section__title{grid-column:2;grid-row:1;font-size:clamp(2.5rem,1.6rem + 3.4vw,4.75rem);font-weight:800;line-height:.95;letter-spacing:-.055em;text-transform:uppercase;overflow-wrap:anywhere}
.pf[data-theme="brutal"] .br-section__number{grid-column:1;grid-row:1;display:grid;place-items:center;width:clamp(48px,5vw,64px);aspect-ratio:1;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:4px 4px 0 var(--pf-border);font:700 clamp(15px,1.4vw,19px)/1 var(--pf-font-mono);rotate:-6deg}
.pf[data-theme="brutal"] .br-section__body{grid-column:1/-1;grid-row:2;display:grid;align-content:start;gap:24px;min-width:0;margin-top:28px;padding-top:28px;border-top:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-section--card{align-self:start;column-gap:12px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-surface);box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .br-section--card>.pf-section__title{padding:18px var(--br-pad) 18px 0;font-size:clamp(1.35rem,1.1rem + .8vw,1.75rem);letter-spacing:-.035em}
.pf[data-theme="brutal"] .br-section--card .br-section__number{width:40px;margin:14px 0 14px var(--br-pad);font-size:13px;box-shadow:2px 2px 0 var(--pf-border);rotate:0deg}
.pf[data-theme="brutal"] .br-section--card .br-section__body{margin-top:0;padding:var(--br-pad)}
.pf[data-theme="brutal"] .br-section--half{grid-column:span 1}
.pf[data-theme="brutal"] .br-section--card:not(.br-section--half) :is(.pf-extralist,.pf-cvlist){display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:18px 32px}
.pf[data-theme="brutal"] .br-section--skills .pf-tags li{padding:8px 14px;font-size:16px;box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .br-lead{max-width:34ch;font:700 clamp(1.5rem,1.1rem + 1.4vw,2.35rem)/1.25 var(--pf-font-heading);letter-spacing:-.03em}
.pf[data-theme="brutal"] .br-lead p+p{margin-top:.8em}
.pf[data-theme="brutal"] .br-lead p+p,.pf[data-theme="brutal"] .br-lead li{font:500 18px/1.65 var(--pf-font-body);letter-spacing:0;max-width:60ch}
.pf[data-theme="brutal"] .br-lead strong{background:linear-gradient(transparent 70%,var(--pf-accent) 70%,var(--pf-accent) 96%,transparent 96%);color:inherit}
.pf[data-theme="brutal"] .br-works{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;padding:0}
.pf[data-theme="brutal"] .br-work{min-width:0;display:grid}
.pf[data-theme="brutal"] .br-work__link{display:flex;flex-direction:column;min-width:0;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-surface);color:var(--pf-text);box-shadow:var(--br-shadow);border-radius:3px;text-decoration:none;transition:translate .15s,box-shadow .15s}
.pf[data-theme="brutal"] .br-work__link:is(:hover,:focus-visible){translate:5px 5px;box-shadow:1px 1px 0 var(--pf-border)}
.pf[data-theme="brutal"] .br-work__cover{--pf-cover-ratio:16/10;position:relative;border-bottom:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-work__number{position:absolute;top:14px;inset-inline-start:14px;padding:4px 9px;border:2px solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:2px 2px 0 var(--pf-border);font:700 13px/1.4 var(--pf-font-mono)}
.pf[data-theme="brutal"] .br-work__body{display:flex;flex:1;flex-direction:column;align-items:start;gap:14px;min-width:0;padding:24px 26px 26px}
.pf[data-theme="brutal"] .br-work__meta{color:var(--pf-muted);font:600 12px/1.5 var(--pf-font-mono);text-transform:uppercase;letter-spacing:.02em}
.pf[data-theme="brutal"] .br-work__title{font:800 clamp(1.5rem,1.15rem + 1vw,2.1rem)/1.08 var(--pf-font-heading);letter-spacing:-.04em;overflow-wrap:anywhere}
.pf[data-theme="brutal"] .br-work__summary{font-size:16px;line-height:1.6;color:var(--pf-muted)}
.pf[data-theme="brutal"] .br-work__tags{display:flex;flex-wrap:wrap;gap:6px}
.pf[data-theme="brutal"] .br-work__tags>span{border:2px solid var(--pf-border);padding:3px 8px;font-size:12px;font-weight:700;line-height:1.4;background:var(--pf-bg)}
.pf[data-theme="brutal"] .br-work__cta{display:inline-flex;align-items:center;gap:8px;margin-top:auto;padding-top:6px;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
.pf[data-theme="brutal"] .br-work__cta svg{width:18px;height:18px;transition:translate .15s}
.pf[data-theme="brutal"] .br-work__link:is(:hover,:focus-visible) .br-work__cta svg{translate:4px 0}
.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child{grid-column:1/-1}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__link{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__cover{border-bottom:0;border-inline-end:var(--br-stroke) solid var(--pf-border);height:100%}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__body{justify-content:center;padding:clamp(24px,4vw,48px)}
.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__title{font-size:clamp(1.75rem,1.2rem + 1.8vw,3rem)}
.pf[data-theme="brutal"] .br-works[data-variant="list"]{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__link{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);align-items:stretch}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__cover{border-bottom:0;border-inline-end:var(--br-stroke) solid var(--pf-border);height:100%}
.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work[data-image="false"] .br-work__body{grid-column:1/-1}
.pf[data-theme="brutal"] .br-services{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px;counter-reset:br-service}
.pf[data-theme="brutal"] .pf-service{position:relative;display:grid;align-content:start;gap:14px;min-width:0;padding:26px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-surface);box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .br-services[data-variant="cards"] .pf-service:nth-child(2){background:var(--pf-accent);color:var(--pf-on-accent)}
.pf[data-theme="brutal"] .br-services[data-variant="cards"] .pf-service:nth-child(2) :is(.pf-service__price,.pf-service__desc,.pf-service__cta){color:inherit}
.pf[data-theme="brutal"] .pf-service__head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:12px}
.pf[data-theme="brutal"] .pf-service h3{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:800;letter-spacing:-.035em;line-height:1.15}
.pf[data-theme="brutal"] .pf-service__price{display:inline-block;padding:2px 8px;border:2px solid currentColor;font:700 13px/1.5 var(--pf-font-mono);color:var(--pf-text)}
.pf[data-theme="brutal"] .pf-service__desc{font-size:16px;line-height:1.6;color:var(--pf-muted)}
.pf[data-theme="brutal"] .pf-service__cta{display:inline-flex;align-items:center;gap:8px;width:fit-content;color:var(--pf-text);font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;text-underline-offset:4px}
.pf[data-theme="brutal"] .br-services[data-variant="list"]{grid-template-columns:minmax(0,1fr);gap:0}
.pf[data-theme="brutal"] .br-services[data-variant="list"] .pf-service{box-shadow:none;border-width:0 0 var(--br-stroke);padding:22px 0;background:transparent}
.pf[data-theme="brutal"] .br-services[data-variant="list"] .pf-service:last-child{border-bottom:0}
.pf[data-theme="brutal"] .br-section--testimonials{width:100vw;margin-inline:calc(50% - 50vw);padding:clamp(56px,7vw,96px) max(var(--pf-gutter,16px),calc((100vw - var(--pf-max-width)) / 2));background:var(--pf-text);color:var(--pf-bg);border-block:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-section--testimonials .br-section__body{border-top-color:var(--pf-bg)}
.pf[data-theme="brutal"] .br-section--testimonials .br-section__number{border-color:var(--pf-bg);box-shadow:4px 4px 0 var(--pf-bg)}
.pf[data-theme="brutal"] .br-quotes{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:28px}
.pf[data-theme="brutal"] .pf-quote{display:grid;align-content:start;gap:20px;min-width:0;padding:26px;border:var(--br-stroke) solid var(--pf-border);box-shadow:6px 6px 0 var(--pf-accent);background:var(--pf-surface);color:var(--pf-text)}
.pf[data-theme="brutal"] .pf-quote:nth-child(even){rotate:1deg}
.pf[data-theme="brutal"] .pf-quote:nth-child(odd){rotate:-.8deg}
.pf[data-theme="brutal"] .pf-quote blockquote{font:700 21px/1.45 var(--pf-font-heading);letter-spacing:-.02em}
.pf[data-theme="brutal"] .pf-quote blockquote::before{content:"\201C";display:block;height:34px;font:800 64px/1 var(--pf-font-heading);color:var(--pf-text)}
.pf[data-theme="brutal"] .pf-avatar{border:2px solid var(--pf-border);border-radius:3px}
.pf[data-theme="brutal"] .pf-quote__source{color:var(--pf-muted);font-size:12px;text-underline-offset:4px}
.pf[data-theme="brutal"] .br-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding:8px 10px 14px 4px}
.pf[data-theme="brutal"] .br-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(88%,460px);scroll-snap-align:start}
.pf[data-theme="brutal"] .pf-logos{gap:16px}
.pf[data-theme="brutal"] .pf-logo{border:var(--br-stroke) solid var(--pf-border);padding:14px 20px;background:var(--pf-surface);min-height:72px;box-shadow:4px 4px 0 var(--pf-border);font-weight:800}
.pf[data-theme="brutal"] .pf-cvlist{gap:22px}
.pf[data-theme="brutal"] .pf-cvitem__role{font-size:20px;font-weight:800;letter-spacing:-.025em}
.pf[data-theme="brutal"] .pf-cvitem__when{display:inline-block;padding:2px 8px;border:2px solid var(--pf-border);background:var(--pf-accent);color:var(--pf-on-accent);font:700 12px/1.5 var(--pf-font-mono)}
.pf[data-theme="brutal"] .pf-cvitem__org{font-weight:600}
.pf[data-theme="brutal"] .br-section--experience .pf-cvlist[data-variant="compact"]>.pf-cvitem,.pf[data-theme="brutal"] .br-section--volunteer:not(.br-section--card) .pf-cvlist>.pf-cvitem{padding:22px 24px;border:var(--br-stroke) solid var(--pf-border);background:var(--pf-surface);box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem{border-inline-start-width:var(--br-stroke);border-inline-start-color:var(--pf-border)}
.pf[data-theme="brutal"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem::before{width:14px;height:14px;border:var(--br-stroke) solid var(--pf-border);border-radius:0;background:var(--pf-accent)}
.pf[data-theme="brutal"] .pf-extralist{gap:14px}
.pf[data-theme="brutal"] .pf-tags{gap:8px}
.pf[data-theme="brutal"] .pf-tags li{border:2px solid var(--pf-border);border-radius:3px;background:var(--pf-bg);color:var(--pf-text);padding:5px 10px;font-size:13px;font-weight:700;box-shadow:2px 2px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-skillgroups b{display:block;margin-bottom:8px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:.05em}
.pf[data-theme="brutal"] .pf-work-metric{border:2px solid var(--pf-border);border-radius:3px;font-weight:700;background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-work-metric b{font-family:var(--pf-font-mono)}
.pf[data-theme="brutal"] .pf-metrics:not(.br-stats) .pf-metric{padding:20px;border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-trend,.pf[data-theme="brutal"] .pf-metric__bar i,.pf[data-theme="brutal"] .pf-metric__progress{border-radius:2px}
.pf[data-theme="brutal"] .pf-video,.pf[data-theme="brutal"] .pf-pdf,.pf[data-theme="brutal"] .pf-link,.pf[data-theme="brutal"] .pf-embed__open,.pf[data-theme="brutal"] .pf-embed iframe{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="brutal"] .pf-video__play>span{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-pdf__page{border:2px solid var(--pf-border);border-radius:2px;box-shadow:3px 3px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-link__site{border-radius:3px;border:2px solid var(--pf-border)}
.pf[data-theme="brutal"] .pf-workpage{max-width:1040px}
.pf[data-theme="brutal"] :is(.pf-workpage__back,.pf-workpage__step){border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-surface);box-shadow:4px 4px 0 var(--pf-border)}
.pf[data-theme="brutal"] .pf-detail__title{font-weight:800;letter-spacing:-.045em}
.pf[data-theme="brutal"] .pf-loc{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;background:var(--pf-surface);color:var(--pf-text);box-shadow:var(--br-shadow);max-width:480px}
.pf[data-theme="brutal"] .br-custom__image{border:var(--br-stroke) solid var(--pf-border);border-radius:3px;max-height:560px;object-fit:contain;background:var(--pf-bg);box-shadow:var(--br-shadow)}
.pf[data-theme="brutal"] .br-section--custom .pf-prose{max-width:62ch;font-size:18px}
.pf[data-theme="brutal"] .br-section--contact{width:100vw;margin-inline:calc(50% - 50vw);padding:clamp(56px,7vw,96px) max(var(--pf-gutter,16px),calc((100vw - var(--pf-max-width)) / 2));background:var(--pf-accent);color:var(--pf-on-accent);border-top:var(--br-stroke) solid var(--pf-border)}
.pf[data-theme="brutal"] .br-section--contact .br-section__number{background:var(--pf-text);color:var(--pf-bg)}
.pf[data-theme="brutal"] .br-section--contact .br-section__body:has(>.pf-loc){grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);column-gap:48px;align-items:start}
.pf[data-theme="brutal"] .br-section--contact .br-section__body:has(>.pf-loc)>*{grid-column:1}
.pf[data-theme="brutal"] .br-section--contact .br-section__body:has(>.pf-loc)>.pf-loc{grid-column:2;grid-row:1/span 4;width:100%;rotate:1.5deg}
.pf[data-theme="brutal"] .br-section--contact .pf-btn--primary{background:var(--pf-text);color:var(--pf-bg)}
.pf[data-theme="brutal"] .br-section--contact .pf-contact-links{font-size:16px;font-weight:600}
.pf[data-theme="brutal"] .br-section--contact .pf-contact-links span{color:inherit;opacity:.75}
.pf[data-theme="brutal"] .br-section--contact .pf-contact-links a{color:inherit}
.pf[data-theme="brutal"] .br-cta{font:800 clamp(2.25rem,1.3rem + 3.6vw,4.5rem)/1 var(--pf-font-heading);letter-spacing:-.05em;max-width:20ch}
.pf[data-theme="brutal"] .br-main:has(>.br-section--contact:last-child){padding-bottom:0}
.pf[data-theme="brutal"] .pf-foot{font-weight:700;border-top:var(--br-stroke) solid var(--pf-border);padding-block:28px 44px;gap:20px}
.pf[data-theme="brutal"] .pf-badge{border:2px solid var(--pf-border);border-radius:3px;box-shadow:3px 3px 0 var(--pf-border);background:var(--pf-surface);color:var(--pf-text)}
@media (max-width:960px){.pf[data-theme="brutal"] .pf-nav__links{gap:2px}.pf[data-theme="brutal"] .pf-nav__links a{padding-inline:6px;font-size:12px}.pf[data-theme="brutal"] .br-hero{gap:32px;grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.pf[data-theme="brutal"]{--br-stroke:2px;--br-pad:20px;--br-shadow:4px 4px 0 var(--pf-border);font-size:16px}.pf[data-theme="brutal"] .br-top{padding-block:12px}.pf[data-theme="brutal"] .br-brand{font-size:17px}.pf[data-theme="brutal"] .br-mark{width:36px;height:36px;font-size:11px}.pf[data-theme="brutal"] .br-main{grid-template-columns:minmax(0,1fr);row-gap:56px;padding-top:24px}.pf[data-theme="brutal"] .br-section--half{grid-column:1/-1}.pf[data-theme="brutal"] .br-hero,.pf[data-theme="brutal"] .br-hero[data-variant="big-name"],.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,1fr);gap:36px}.pf[data-theme="brutal"] .br-intro{gap:18px}.pf[data-theme="brutal"] .br-name{font-size:max(2rem,min(4rem,calc(100cqi / (var(--name-word) * .62))))}.pf[data-theme="brutal"] .br-hero[data-variant="big-name"] .br-name{font-size:max(2rem,min(4.75rem,calc(100cqi / (var(--name-word) * .62))))}.pf[data-theme="brutal"] .br-headline{font-size:20px}.pf[data-theme="brutal"] .br-greeting{font-size:17px}.pf[data-theme="brutal"] .br-visual{width:min(78%,280px);margin:0 auto 12px;rotate:2deg}.pf[data-theme="brutal"] .br-burst{width:68px;height:68px;inset-inline-end:-20px;top:-20px}.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-visual,.pf[data-theme="brutal"] .br-hero[data-variant="photo-left"] .br-intro{grid-column:1;grid-row:auto}.pf[data-theme="brutal"] .br-stats.pf-metrics{margin-top:0;grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="brutal"] .br-stats .pf-metric{padding:18px;--pf-metric-value:2rem}.pf[data-theme="brutal"] .br-stats .pf-metric+.pf-metric{border-inline-start:0}.pf[data-theme="brutal"] .br-stats .pf-metric:nth-child(even){border-inline-start:var(--br-stroke) solid var(--pf-border)}.pf[data-theme="brutal"] .br-stats .pf-metric:nth-child(n+3){border-top:var(--br-stroke) solid var(--pf-border)}.pf[data-theme="brutal"] .br-stats .pf-metric:last-child:nth-child(odd){grid-column:1/-1}.pf[data-theme="brutal"] .br-ticker__run>span{padding-block:10px;font-size:18px}.pf[data-theme="brutal"] .br-section>.pf-section__title{font-size:clamp(2rem,9vw,2.75rem)}.pf[data-theme="brutal"] .br-section--card>.pf-section__title{font-size:22px}.pf[data-theme="brutal"] .br-section__body{margin-top:20px;padding-top:20px}.pf[data-theme="brutal"] .br-works,.pf[data-theme="brutal"] .br-works[data-variant="grid-3"]{grid-template-columns:minmax(0,1fr);gap:24px}.pf[data-theme="brutal"] .br-work__body{padding:20px}.pf[data-theme="brutal"] .br-works[data-variant="featured-grid"] .br-work:first-child .br-work__link,.pf[data-theme="brutal"] .br-works[data-variant="list"] .br-work__link{display:flex}.pf[data-theme="brutal"] .br-works:is([data-variant="featured-grid"],[data-variant="list"]) .br-work__cover{height:auto;border-inline-end:0;border-bottom:var(--br-stroke) solid var(--pf-border)}.pf[data-theme="brutal"] .br-lead{font-size:22px}.pf[data-theme="brutal"] .pf-service,.pf[data-theme="brutal"] .pf-quote{padding:20px}.pf[data-theme="brutal"] .pf-quote{rotate:0deg!important}.pf[data-theme="brutal"] .pf-quote blockquote{font-size:19px}.pf[data-theme="brutal"] .br-section--contact .br-section__body:has(>.pf-loc){grid-template-columns:minmax(0,1fr)}.pf[data-theme="brutal"] .br-section--contact .br-section__body:has(>.pf-loc)>.pf-loc{grid-column:1;grid-row:auto;rotate:0deg}}
@media (prefers-reduced-motion:reduce){.pf[data-theme="brutal"] .br-work__link:is(:hover,:focus-visible),.pf[data-theme="brutal"] .pf-btn:is(:hover,:focus-visible){translate:none}.pf[data-theme="brutal"] .br-ticker__track{animation:none}}
`;
