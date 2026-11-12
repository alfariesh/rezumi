/**
 * Warta: a magazine. Ink rules instead of boxes, a masthead with the name large and centred, small capital labels
 * (kickers, rubrics, bylines, folios) in the body face, and a serif for everything people read slowly: headlines,
 * About with its drop cap, pull quotes and the work pages. Scoped entirely to `.pf[data-theme="warta"]`; prefix `wt-`.
 * The drop caps stay off on right-to-left pages, whose scripts have no such letter.
 */
export const WARTA_CSS = String.raw`
.pf[data-theme="warta"]{--pf-max-width:1160px;--pf-radius:2px;--pf-radius-sm:2px;--wt-gap:clamp(64px,8vw,112px);--wt-caps:700 11.5px/1.5 var(--pf-font-body);background:var(--pf-bg)}
.pf[data-theme="warta"] .pf-nav{min-height:60px}
.pf[data-theme="warta"] .wt-top .pf-nav{border-bottom:1px solid var(--pf-text)}
.pf[data-theme="warta"] .wt-brand{font:600 19px/1.15 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="warta"] .pf-nav__links{gap:clamp(14px,2vw,28px)}
.pf[data-theme="warta"] .pf-nav__links a{display:inline-flex;align-items:center;min-height:44px;color:var(--pf-text);font:var(--wt-caps);letter-spacing:.14em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-nav__links a:hover{color:var(--pf-accent-text)}
.pf[data-theme="warta"] .pf-menu>summary{border-color:var(--pf-text);border-radius:2px;font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-menu__list{border-color:var(--pf-text);border-radius:2px;box-shadow:none}
.pf[data-theme="warta"] .pf-btn{min-height:46px;padding:.8em 1.45em;border-radius:2px;font:700 12.5px/1.2 var(--pf-font-body);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-btn--secondary{border-color:var(--pf-text)}
.pf[data-theme="warta"] .pf-btn--secondary:hover{background:var(--pf-text);color:var(--pf-bg)}
.pf[data-theme="warta"] .wt-main{display:grid;gap:var(--wt-gap);padding-block:clamp(24px,3.5vw,44px) clamp(64px,8vw,104px)}
.pf[data-theme="warta"] .wt-hero{display:grid;justify-items:center;gap:28px;min-width:0;padding-top:clamp(20px,3vw,36px);border-top:3px solid var(--pf-text);text-align:center}
.pf[data-theme="warta"] .wt-hero[data-bg]:not([data-bg="plain"]){padding:clamp(28px,5vw,64px);background:var(--pf-hero-bg)}
.pf[data-theme="warta"] .wt-masthead{container-type:inline-size;display:grid;justify-items:center;gap:20px;width:100%;min-width:0}
.pf[data-theme="warta"] .wt-masthead>*{max-width:100%}
.pf[data-theme="warta"] .wt-kicker{max-width:56ch;color:var(--pf-accent-text);font:700 12.5px/1.6 var(--pf-font-body);letter-spacing:.2em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-name{font-size:max(1.75rem,min(clamp(3.5rem,1.2rem + 8vw,9rem),calc(100cqi / (var(--name-word) * .56))));font-weight:500;line-height:.94;letter-spacing:-.04em}
.pf[data-theme="warta"] .wt-dateline{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 16px;width:min(100%,760px);padding-block:12px;border-block:1px solid var(--pf-border)}
.pf[data-theme="warta"] .wt-byline{flex:none;width:44px;height:44px;border-radius:50%;object-fit:cover;filter:grayscale(1)}
.pf[data-theme="warta"] .wt-dateline .pf-chips{justify-content:center;gap:4px 0}
.pf[data-theme="warta"] .wt-dateline .pf-chip{padding:0;border-radius:0;background:transparent;color:var(--pf-text);font:var(--wt-caps);letter-spacing:.14em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-dateline .pf-chip .pf-icon{display:none}
.pf[data-theme="warta"] .wt-dateline .pf-chip--open{color:var(--pf-accent-text)}
.pf[data-theme="warta"] .wt-dateline .pf-chip--open::before{content:none}
.pf[data-theme="warta"] .wt-dateline .pf-chip+.pf-chip::before{content:"·";content:"·"/"";width:auto;height:auto;margin-inline:14px;border-radius:0;background:none;box-shadow:none;color:var(--pf-muted)}
.pf[data-theme="warta"] .wt-masthead .pf-opento{max-width:60ch;color:var(--pf-muted);font-size:15px;line-height:1.6}
.pf[data-theme="warta"] .wt-standfirst{max-width:38ch;font:400 clamp(1.25rem,1.05rem + .8vw,1.625rem)/1.45 var(--pf-font-heading);text-wrap:balance}
.pf[data-theme="warta"] .wt-masthead .pf-btns{justify-content:center;gap:12px}
.pf[data-theme="warta"] .wt-portrait{width:min(100%,176px);aspect-ratio:1;border-radius:50%;object-fit:cover}
.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo]{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:center;justify-items:stretch;gap:clamp(28px,5vw,72px);text-align:start}
.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-portrait{width:100%;aspect-ratio:4/5;border-radius:0}
.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-masthead{justify-items:start}
.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] :is(.wt-dateline,.wt-dateline .pf-chips,.pf-btns){justify-content:flex-start}
.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-name{font-size:max(1.75rem,min(clamp(3rem,1rem + 5.4vw,6.75rem),calc(100cqi / (var(--name-word) * .56))))}
.pf[data-theme="warta"] .wt-hero+.wt-stats{margin-top:calc(36px - var(--wt-gap))}
.pf[data-theme="warta"] .wt-stats.pf-metrics{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0;padding-block:26px;border-block:1px solid var(--pf-text)}
.pf[data-theme="warta"] .wt-stats .pf-metric{align-items:center;gap:10px;padding-inline:20px;text-align:center}
.pf[data-theme="warta"] .wt-stats .pf-metric+.pf-metric{border-inline-start:1px solid var(--pf-border)}
.pf[data-theme="warta"] .wt-stats .pf-metric__row{align-items:center}
.pf[data-theme="warta"] .wt-stats .pf-metric__value{color:var(--pf-text);font:500 clamp(2.25rem,1.6rem + 2.2vw,3.5rem)/1 var(--pf-font-heading);letter-spacing:-.035em}
.pf[data-theme="warta"] .wt-stats .pf-metric__label{justify-content:center;color:var(--pf-muted);font:var(--wt-caps);letter-spacing:.14em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-section{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:32px 24px;min-width:0;padding-top:18px;border-top:1px solid var(--pf-text);scroll-margin-top:24px}
.pf[data-theme="warta"] .wt-section>.pf-section__title{grid-column:1;font-size:clamp(2rem,1.35rem + 2.3vw,3.25rem);font-weight:500;line-height:1.04;letter-spacing:-.03em}
.pf[data-theme="warta"] .wt-folio{grid-column:2;grid-row:1;color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.16em}
.pf[data-theme="warta"] .wt-section__body{display:grid;grid-column:1/-1;gap:32px;min-width:0}
.pf[data-theme="warta"] .wt-lead{max-width:34em;font:400 clamp(1.2rem,1.05rem + .6vw,1.6rem)/1.6 var(--pf-font-heading)}
.pf[data-theme="warta"] .wt-lead strong{font-weight:600}
:root:not([dir="rtl"]) .pf[data-theme="warta"] :is(.wt-lead,.pf-workpage .pf-blocks>.pf-prose:first-child)>p:first-of-type::first-letter{float:left;margin:.07em .08em 0 0;padding:0;color:var(--pf-accent-text);font:500 4.5em/.76 var(--pf-font-heading)}
.pf[data-theme="warta"] .pf-prose a{text-decoration-thickness:1px;text-underline-offset:4px}
.pf[data-theme="warta"] .pf-prose blockquote{margin-block:1.4em;padding:20px 0;border:0;border-block:2px solid var(--pf-text);color:var(--pf-text);font:400 clamp(1.45rem,1.2rem + .9vw,2rem)/1.3 var(--pf-font-heading);letter-spacing:-.01em;text-align:center}
.pf[data-theme="warta"] .wt-stories{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:48px 36px;margin:0;padding:0;list-style:none}
.pf[data-theme="warta"] .wt-story{display:grid;min-width:0;padding-top:20px;border-top:1px solid var(--pf-border)}
.pf[data-theme="warta"] .wt-story__link{display:grid;align-content:start;gap:18px;color:inherit;text-decoration:none}
.pf[data-theme="warta"] .wt-story__cover{--pf-cover-ratio:3/2}
.pf[data-theme="warta"] .wt-story__cover img{transition:transform .5s ease}
.pf[data-theme="warta"] .wt-story__link:is(:hover,:focus-visible) .wt-story__cover img{transform:scale(1.03)}
.pf[data-theme="warta"] .wt-story__text{display:grid;justify-items:start;align-content:start;gap:10px;min-width:0}
.pf[data-theme="warta"] .wt-rubric{color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.16em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-story__title{font-size:clamp(1.3rem,1.15rem + .5vw,1.6rem);font-weight:600;line-height:1.18;letter-spacing:-.015em}
.pf[data-theme="warta"] .wt-story__link:is(:hover,:focus-visible) .wt-story__title{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px}
.pf[data-theme="warta"] .wt-story__dek{color:var(--pf-muted);font-size:15.5px;line-height:1.6}
.pf[data-theme="warta"] :is(.wt-rubric,.wt-story__dek,.wt-story__byline){unicode-bidi:plaintext}
.pf[data-theme="warta"] .wt-story__byline{color:var(--pf-muted);font:700 11px/1.6 var(--pf-font-body);letter-spacing:.1em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-work-metric{gap:8px;padding:0;border-radius:0;background:transparent;color:var(--pf-muted);font-size:13px}
.pf[data-theme="warta"] .pf-work-metric b{color:var(--pf-accent-text);font:500 22px/1 var(--pf-font-heading);letter-spacing:-.02em}
.pf[data-theme="warta"] .wt-story--lead{grid-column:1/-1;padding-top:0;border-top:0}
.pf[data-theme="warta"] .wt-story--lead .wt-story__link{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:center;gap:clamp(24px,4vw,56px)}
.pf[data-theme="warta"] .wt-story--lead .wt-story__cover{--pf-cover-ratio:4/3}
.pf[data-theme="warta"] .wt-story--lead .wt-story__text{gap:16px}
.pf[data-theme="warta"] .wt-story--lead .wt-story__title{font-size:clamp(2rem,1.3rem + 2.6vw,3.5rem);font-weight:500;line-height:1.04;letter-spacing:-.03em}
.pf[data-theme="warta"] .wt-story--lead .wt-story__dek{color:var(--pf-text);font:400 clamp(1.1rem,1rem + .4vw,1.3rem)/1.5 var(--pf-font-heading)}
.pf[data-theme="warta"] .wt-story--lead[data-image="false"] .wt-story__link{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}
.pf[data-theme="warta"] .wt-story--lead[data-image="false"] .wt-story__text{justify-items:center;max-width:820px}
.pf[data-theme="warta"] .wt-stories[data-variant="grid-2"]{grid-template-columns:repeat(2,minmax(0,1fr));gap:56px 48px}
.pf[data-theme="warta"] :is(.wt-stories[data-variant="grid-2"],.wt-stories[data-variant="list"]) .wt-story__title{font-size:clamp(1.5rem,1.2rem + 1vw,2.1rem);font-weight:500}
.pf[data-theme="warta"] .wt-stories[data-variant="list"]{grid-template-columns:minmax(0,1fr);gap:0}
.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story{padding-block:28px}
.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story:first-child{padding-top:0;border-top:0}
.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story__link{grid-template-columns:minmax(0,1fr) minmax(0,260px);align-items:start;gap:clamp(20px,4vw,48px)}
.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story__cover{--pf-cover-ratio:4/3;order:2}
.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story[data-image="false"] .wt-story__link{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="warta"] .wt-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:48px;margin:0;padding:0;list-style:none}
.pf[data-theme="warta"] .pf-quote{display:grid;align-content:start;gap:20px;min-width:0}
.pf[data-theme="warta"] .wt-quotes[data-variant="cards"]>.pf-quote:not(:only-child){padding-top:22px;border-top:2px solid var(--pf-text)}
.pf[data-theme="warta"] .pf-quote blockquote{font:400 clamp(1.35rem,1.15rem + .8vw,1.8rem)/1.32 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="warta"] .pf-quote blockquote::before{content:"\201C";content:"\201C"/"";display:block;height:.42em;color:var(--pf-accent-text);font:500 3.4em/1 var(--pf-font-heading)}
.pf[data-theme="warta"] .wt-quotes>.pf-quote:only-child{justify-items:center;width:100%;max-width:920px;margin-inline:auto;text-align:center}
.pf[data-theme="warta"] .wt-quotes>.pf-quote:only-child blockquote{font-size:clamp(1.75rem,1.25rem + 2vw,2.875rem);line-height:1.22}
.pf[data-theme="warta"] .pf-avatar img{filter:grayscale(1)}
.pf[data-theme="warta"] .pf-person__text b{font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-person__text span{font-size:13.5px}
.pf[data-theme="warta"] .pf-quote__source{color:var(--pf-muted);font-size:13px;text-underline-offset:4px}
.pf[data-theme="warta"] .wt-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;padding-bottom:12px;scroll-snap-type:x mandatory}
.pf[data-theme="warta"] .wt-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(86%,520px);padding-inline-end:40px;border-inline-end:1px solid var(--pf-border);scroll-snap-align:start}
.pf[data-theme="warta"] .wt-quotes[data-variant="carousel"] .pf-quote:last-child{border-inline-end:0}
.pf[data-theme="warta"] .wt-services{display:grid;gap:0;margin:0;padding:0;list-style:none}
.pf[data-theme="warta"] .pf-service{display:grid;align-content:start;gap:10px;min-width:0;padding-block:24px;border-top:1px solid var(--pf-border)}
.pf[data-theme="warta"] .wt-services[data-variant="list"] .pf-service:first-child{padding-top:0;border-top:0}
.pf[data-theme="warta"] .pf-service__head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 24px}
.pf[data-theme="warta"] .pf-service h3{display:flex;align-items:center;gap:12px;font-size:clamp(1.4rem,1.2rem + .6vw,1.75rem);font-weight:500;line-height:1.2;letter-spacing:-.015em}
.pf[data-theme="warta"] .pf-service h3 .pf-icon{color:var(--pf-accent-text)}
.pf[data-theme="warta"] .pf-service__price{color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-service__desc{max-width:62ch;color:var(--pf-muted);font-size:16px;line-height:1.6}
.pf[data-theme="warta"] .pf-service__cta{display:inline-flex;align-items:center;gap:8px;width:fit-content;min-height:36px;color:var(--pf-text);font:var(--wt-caps);letter-spacing:.12em;text-decoration:underline;text-decoration-color:var(--pf-accent-text);text-decoration-thickness:2px;text-transform:uppercase;text-underline-offset:6px}
.pf[data-theme="warta"] .wt-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:36px}
.pf[data-theme="warta"] .wt-services[data-variant="cards"] .pf-service{padding:22px 0 0;border-top:3px solid var(--pf-text)}
.pf[data-theme="warta"] .pf-logos{justify-content:center;gap:24px 56px;padding-block:28px;border-block:1px solid var(--pf-border)}
.pf[data-theme="warta"] .pf-logo{font:500 21px/1.2 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="warta"] .pf-logo img{height:36px}
.pf[data-theme="warta"] .pf-cvlist{gap:0}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem{grid-template-columns:minmax(0,10rem) minmax(0,1fr);align-items:baseline;column-gap:clamp(20px,3vw,40px);row-gap:6px;padding-block:24px;border-top:1px solid var(--pf-border)}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem:first-child{padding-top:0;border-top:0}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>*{grid-column:2}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head{display:contents}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__role{grid-column:2;grid-row:1}
.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{grid-column:1;grid-row:1}
.pf[data-theme="warta"] .pf-cvlist[data-variant="timeline"]>.pf-cvitem{padding-bottom:32px}
.pf[data-theme="warta"] .pf-cvitem__role{font:500 clamp(1.25rem,1.1rem + .5vw,1.5rem)/1.25 var(--pf-font-heading);letter-spacing:-.01em}
.pf[data-theme="warta"] .pf-cvitem__roles .pf-cvitem__role{font-size:1.1rem}
.pf[data-theme="warta"] .pf-cvitem__when{color:var(--pf-muted);font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-cvitem__org{font-size:16px;font-style:italic}
.pf[data-theme="warta"] .pf-cvitem .pf-prose{max-width:62ch;font-size:16px;line-height:1.65}
.pf[data-theme="warta"] .pf-tags li{padding:4px 10px;border-color:var(--pf-border);border-radius:2px;color:var(--pf-text);font:var(--wt-caps);letter-spacing:.1em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-skillgroups{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:28px 40px}
.pf[data-theme="warta"] .pf-skillgroup{align-content:start;gap:10px;padding-top:14px;border-top:1px solid var(--pf-text)}
.pf[data-theme="warta"] .pf-skillgroup b{font:var(--wt-caps);letter-spacing:.16em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-skillgroup .pf-tags{display:block}
.pf[data-theme="warta"] .pf-skillgroup .pf-tags li{display:inline;padding:0;border:0;color:var(--pf-text);font:400 18px/1.6 var(--pf-font-heading);letter-spacing:0;text-transform:none}
.pf[data-theme="warta"] .pf-skillgroup .pf-tags li+li::before{content:", ";content:", "/""}
.pf[data-theme="warta"] .pf-extralist{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px 40px}
.pf[data-theme="warta"] .pf-extralist li{gap:4px;font-size:16px}
.pf[data-theme="warta"] .pf-extralist li b{font:500 19px/1.3 var(--pf-font-heading)}
.pf[data-theme="warta"] .pf-extralist li span{font-size:13.5px}
.pf[data-theme="warta"] .wt-section--publications .pf-extralist{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:32px 40px}
.pf[data-theme="warta"] .wt-section--publications .pf-extralist li{gap:10px;padding-top:16px;border-top:1px solid var(--pf-text)}
.pf[data-theme="warta"] .wt-section--publications .pf-extralist li b{font-size:clamp(1.3rem,1.15rem + .5vw,1.6rem);line-height:1.2}
.pf[data-theme="warta"] .wt-section--publications .pf-extralist li span{font:var(--wt-caps);letter-spacing:.1em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-brief{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:32px 40px;padding-top:20px;border-top:3px double var(--pf-text)}
.pf[data-theme="warta"] .wt-brief__item{min-width:0}
.pf[data-theme="warta"] .wt-brief__item>.pf-extra__title{margin-bottom:16px;color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.16em;text-transform:uppercase}
.pf[data-theme="warta"] .wt-brief .pf-extralist{grid-template-columns:minmax(0,1fr);gap:14px}
.pf[data-theme="warta"] .wt-brief .pf-extralist li b{font-size:17px}
.pf[data-theme="warta"] .wt-custom__image{width:100%;max-height:600px;object-fit:cover}
.pf[data-theme="warta"] .wt-letters{display:grid;justify-items:start;gap:28px;min-width:0}
.pf[data-theme="warta"] .wt-letters>*{max-width:100%}
.pf[data-theme="warta"] .wt-cta{max-width:24ch;font:400 clamp(1.75rem,1.2rem + 2.4vw,3.25rem)/1.12 var(--pf-font-heading);letter-spacing:-.025em}
.pf[data-theme="warta"] .pf-form input:not([type=hidden]),.pf[data-theme="warta"] .pf-form textarea{border-width:1px;border-radius:0;background:var(--pf-surface)}
.pf[data-theme="warta"] .pf-form label{font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-contact-links{gap:10px;font-size:16px}
.pf[data-theme="warta"] .pf-contact-links span{min-width:120px;font:var(--wt-caps);line-height:1.9;letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-loc{max-width:460px;border-color:var(--pf-text);border-radius:0;background:var(--pf-surface)}
.pf[data-theme="warta"] .pf-loc__city b{font-weight:500}
.pf[data-theme="warta"] :is(.pf-video,.pf-pdf,.pf-link,.pf-embed__open,.pf-embed iframe,.pf-gallery img,.pf-zoom,.pf-detail__hero,.pf-loc__map,.pf-link__site,.pf-link__image){border-radius:0}
.pf[data-theme="warta"] :is(.pf-pdf,.pf-link,.pf-embed__open){border-color:var(--pf-border);background:var(--pf-surface)}
.pf[data-theme="warta"] .pf-gallery figcaption{font-size:13.5px;font-style:italic}
.pf[data-theme="warta"] .pf-embed__note{font-style:italic}
.pf[data-theme="warta"] .pf-embed__provider{font-weight:500}
.pf[data-theme="warta"] .pf-metrics:not(.wt-stats) .pf-metric__value{font-weight:500;letter-spacing:-.03em}
.pf[data-theme="warta"] .pf-metrics[data-variant="kpi"] .pf-metric{border-radius:0;background:var(--pf-surface)}
.pf[data-theme="warta"] .pf-trend{border-radius:2px}
.pf[data-theme="warta"] .pf-workpage{max-width:1040px;gap:40px;padding-block:8px 16px}
.pf[data-theme="warta"] .pf-workpage>:is(.pf-detail__head,.pf-btns){width:min(100%,720px);justify-self:center}
.pf[data-theme="warta"] .pf-workpage__back{justify-self:center;min-height:44px;padding:0;border:0;border-radius:0;color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.14em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-workpage__back:hover{background:transparent;text-decoration:underline;text-underline-offset:5px}
.pf[data-theme="warta"] .pf-detail__head{justify-items:center;gap:18px;padding-bottom:30px;border-bottom:1px solid var(--pf-border);text-align:center}
.pf[data-theme="warta"] .pf-detail__title{font-size:clamp(2.5rem,1.6rem + 3.6vw,4.75rem);font-weight:500;line-height:1;letter-spacing:-.035em}
.pf[data-theme="warta"] .pf-detail__summary{max-width:36ch;color:var(--pf-text);font:400 clamp(1.2rem,1.05rem + .6vw,1.5rem)/1.45 var(--pf-font-heading)}
.pf[data-theme="warta"] .pf-detail__meta{justify-content:center;font:var(--wt-caps);letter-spacing:.12em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-detail__head .pf-tags{justify-content:center}
.pf[data-theme="warta"] .pf-workpage .pf-blocks{grid-template-columns:minmax(0,1fr) min(100%,720px) minmax(0,1fr);gap:36px 0}
.pf[data-theme="warta"] .pf-workpage .pf-blocks>*{grid-column:2}
.pf[data-theme="warta"] .pf-workpage .pf-blocks>:is(.pf-gallery,.pf-video,.pf-embed[data-shape="wide"]){grid-column:1/-1}
.pf[data-theme="warta"] .pf-workpage .pf-prose{max-width:none;font:400 clamp(1.1rem,1.02rem + .3vw,1.25rem)/1.75 var(--pf-font-heading)}
.pf[data-theme="warta"] .pf-workpage .pf-prose :is(h2,h3,h4){margin-top:1.7em;color:var(--pf-accent-text);font:700 12.5px/1.5 var(--pf-font-body);letter-spacing:.16em;text-transform:uppercase}
.pf[data-theme="warta"] .pf-workpage .pf-prose>:is(h2,h3,h4):first-child{margin-top:0}
.pf[data-theme="warta"] .pf-workpage .pf-btns{justify-content:center}
.pf[data-theme="warta"] .pf-workpage__more{gap:24px 48px;padding-top:24px;border-top:3px double var(--pf-text)}
.pf[data-theme="warta"] .pf-workpage__step{padding:4px 0;border:0;border-radius:0}
.pf[data-theme="warta"] .pf-workpage__step:hover{background:transparent}
.pf[data-theme="warta"] .pf-workpage__step:hover b{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px}
.pf[data-theme="warta"] .pf-workpage__step span{color:var(--pf-accent-text);font:var(--wt-caps);letter-spacing:.14em}
.pf[data-theme="warta"] .pf-workpage__step b{font-size:clamp(1.25rem,1.1rem + .6vw,1.6rem);font-weight:500;line-height:1.2}
.pf[data-theme="warta"] .pf-foot{justify-content:center;gap:12px 28px;width:calc(100% - 2 * var(--pf-gutter));max-width:var(--pf-max-width);padding:28px 0 48px;border-top:1px solid var(--pf-text);font:var(--wt-caps);letter-spacing:.12em;text-align:center;text-transform:uppercase}
.pf[data-theme="warta"] .pf-badge{border-radius:2px;letter-spacing:.06em}
@media (max-width:960px){.pf[data-theme="warta"] .wt-stories{grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="warta"] .wt-story--lead .wt-story__link{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){.pf[data-theme="warta"]{--wt-gap:64px}.pf[data-theme="warta"] .wt-main{padding-top:16px}.pf[data-theme="warta"] .wt-hero{gap:22px}.pf[data-theme="warta"] .wt-masthead{gap:16px}.pf[data-theme="warta"] .wt-name,.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-name{font-size:max(1.5rem,min(4rem,calc(100cqi / (var(--name-word) * .56))))}.pf[data-theme="warta"] .wt-kicker{font-size:11.5px;letter-spacing:.16em}.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo]{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-portrait{width:min(100%,280px)}.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] .wt-masthead{justify-items:center}.pf[data-theme="warta"] .wt-hero[data-variant="photo-left"][data-photo] :is(.wt-dateline,.wt-dateline .pf-chips,.pf-btns){justify-content:center}.pf[data-theme="warta"] .wt-masthead .pf-btns{width:100%}.pf[data-theme="warta"] .wt-masthead .pf-btn{flex:1 1 auto}.pf[data-theme="warta"] .wt-stats.pf-metrics{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:row;row-gap:24px;padding-block:22px}.pf[data-theme="warta"] .wt-stats .pf-metric{padding-inline:12px}.pf[data-theme="warta"] .wt-stats .pf-metric+.pf-metric{border-inline-start:0}.pf[data-theme="warta"] .wt-stats .pf-metric:nth-child(even){border-inline-start:1px solid var(--pf-border)}.pf[data-theme="warta"] .wt-stats .pf-metric:last-child:nth-child(odd){grid-column:1/-1}.pf[data-theme="warta"] .wt-section{gap:24px 16px;padding-top:14px}.pf[data-theme="warta"] .wt-stories,.pf[data-theme="warta"] .wt-stories[data-variant="grid-2"]{grid-template-columns:minmax(0,1fr);gap:36px}.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story__link{grid-template-columns:minmax(0,1fr) 104px;gap:16px}.pf[data-theme="warta"] .wt-stories[data-variant="list"] .wt-story__title{font-size:1.3rem}.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem{grid-template-columns:minmax(0,1fr)}.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>*,.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__role,.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{grid-column:1;grid-row:auto}.pf[data-theme="warta"] .pf-cvlist:not([data-variant="timeline"])>.pf-cvitem>.pf-cvitem__head>.pf-cvitem__when{order:-1}.pf[data-theme="warta"] .wt-quotes{gap:36px}.pf[data-theme="warta"] .wt-dateline .pf-chips{flex-direction:column;align-items:center;gap:6px}.pf[data-theme="warta"] .wt-dateline .pf-chip+.pf-chip::before{content:none}}
`;
