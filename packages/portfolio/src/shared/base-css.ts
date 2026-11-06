/**
 * Rules every theme shares: reset, tokens' fixed scale, and the shared building blocks (buttons, chips, navigation,
 * metric widget, covers, work detail, CV lists, location card, footer). Themes restyle them through the tokens and
 * their own rules under `.pf[data-theme="<id>"]`. Ported from `mockups/shared.css` (Phase 00), without the parts later
 * phases add (contact form, intro effects). Phase 05 added the video, PDF and link cards and the map picture.
 */
export const BASE_CSS = String.raw`
*,*::before,*::after{box-sizing:border-box}
:root{--pf-text-xs:.8125rem;--pf-text-sm:.9375rem;--pf-text-md:1.0625rem;--pf-text-lg:1.25rem;--pf-text-xl:1.625rem;--pf-text-2xl:clamp(1.875rem,1.4rem + 1.8vw,2.5rem);--pf-text-name:clamp(2.5rem,1.6rem + 4.2vw,4.5rem);--pf-leading-tight:1.08;--pf-leading-body:1.6;--pf-radius:12px;--pf-radius-sm:8px;--pf-max-width:1120px;--pf-space-1:4px;--pf-space-2:8px;--pf-space-3:12px;--pf-space-4:16px;--pf-space-5:24px;--pf-space-6:32px;--pf-space-7:48px;--pf-space-8:72px;--pf-space-9:112px;--pf-gutter:max(16px,env(safe-area-inset-left,0px))}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
body{margin:0;background:var(--pf-bg);color:var(--pf-text);font-family:var(--pf-font-body);font-size:var(--pf-text-md);line-height:var(--pf-leading-body);overflow-wrap:break-word;text-rendering:optimizeLegibility}
img{display:block;max-width:100%;height:auto}
[hidden]{display:none!important}
a{color:inherit}
h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote{margin:0}
h1,h2,h3,h4{font-family:var(--pf-font-heading);text-wrap:balance;line-height:var(--pf-leading-tight)}
p{text-wrap:pretty}
/* User text may be written in another direction than the page (Latin on an Arabic page): each block takes its own. */
p,li,blockquote,h1,h2,h3,dt,dd{unicode-bidi:plaintext}
:focus-visible{outline:2px solid var(--pf-accent-text);outline-offset:3px;border-radius:4px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pf-skip{position:absolute;inset-inline-start:12px;top:-60px;z-index:80;padding:10px 16px;border-radius:999px;background:var(--pf-text);color:var(--pf-bg);font-weight:600;text-decoration:none}
.pf-skip:focus{top:12px}
.pf-wrap{width:100%;max-width:calc(var(--pf-max-width) + 2 * var(--pf-gutter));margin-inline:auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.pf-name{overflow-wrap:anywhere;hyphens:manual;font-stretch:var(--pf-name-stretch);text-transform:var(--pf-name-transform)}
.pf-icon{width:1.05em;height:1.05em;flex:none;vertical-align:-.15em}
[dir="rtl"] .pf-flip{transform:scaleX(-1)}
.pf-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:44px;padding:.65em 1.2em;border:1.5px solid transparent;border-radius:999px;font:600 var(--pf-text-sm)/1.2 var(--pf-font-body);text-decoration:none;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}
.pf-btn--primary{background:var(--pf-accent);color:var(--pf-on-accent)}
.pf-btn--primary:hover{background:color-mix(in oklab,var(--pf-accent) 86%,var(--pf-text))}
.pf-btn--secondary{border-color:var(--pf-border);color:var(--pf-text);background:transparent}
.pf-btn--secondary:hover{border-color:var(--pf-text)}
.pf-btns{display:flex;flex-wrap:wrap;gap:var(--pf-space-3)}
.pf-chip{display:inline-flex;align-items:center;gap:.45em;padding:.3em .75em;border-radius:999px;background:var(--pf-surface);color:var(--pf-text);font-size:var(--pf-text-xs);font-weight:500;line-height:1.4}
.pf-chip--open::before{content:"";width:.55em;height:.55em;border-radius:50%;background:var(--pf-positive);box-shadow:0 0 0 3px color-mix(in oklab,var(--pf-positive) 22%,transparent)}
.pf-chips{display:flex;flex-wrap:wrap;gap:var(--pf-space-2);padding:0;list-style:none}
.pf-tags{display:flex;flex-wrap:wrap;gap:6px;padding:0;list-style:none}
.pf-tags li{padding:2px 8px;border:1px solid var(--pf-border);border-radius:999px;color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-nav{display:flex;align-items:center;justify-content:space-between;gap:var(--pf-space-4);min-height:64px}
.pf-nav__brand{display:inline-flex;align-items:center;gap:10px;min-width:0;font:700 var(--pf-text-md)/1.2 var(--pf-font-heading);text-decoration:none}
.pf-nav__brand>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-nav__links{display:flex;align-items:center;gap:var(--pf-space-5);margin:0;padding:0;list-style:none;font-size:var(--pf-text-sm)}
.pf-nav__links a{color:var(--pf-muted);text-decoration:none}
.pf-nav__links a:hover{color:var(--pf-text)}
.pf-menu{display:none;position:relative}
.pf-menu>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:1px solid var(--pf-border);border-radius:999px;font-size:var(--pf-text-sm);font-weight:600}
.pf-menu>summary::-webkit-details-marker{display:none}
.pf-menu__list{position:absolute;inset-inline-end:0;top:calc(100% + 8px);z-index:30;display:grid;min-width:200px;padding:8px;margin:0;list-style:none;background:var(--pf-bg);border:1px solid var(--pf-border);border-radius:var(--pf-radius);box-shadow:0 12px 32px rgb(0 0 0/.14)}
.pf-menu__list a{display:block;padding:10px 12px;border-radius:8px;text-decoration:none}
.pf-menu__list a:hover{background:var(--pf-surface)}
@media (max-width:760px){.pf-nav__links{display:none}.pf-menu{display:block}}
.pf-section{scroll-margin-top:80px}
.pf-section__title{font-size:var(--pf-text-xl);font-weight:700;letter-spacing:-.01em}
.pf-prose{max-width:66ch}
.pf-prose>*+*{margin-top:.9em}
.pf-prose h2,.pf-prose h3{margin-top:1.6em;font-size:var(--pf-text-lg)}
.pf-prose ul,.pf-prose ol{padding-inline-start:1.2em}
.pf-prose li+li{margin-top:.35em}
.pf-prose a{color:var(--pf-accent-text);text-underline-offset:3px}
.pf-prose blockquote{padding-inline-start:1em;border-inline-start:3px solid var(--pf-accent);font-size:var(--pf-text-lg);font-style:italic}
.pf-metrics{--pf-metric-value:2rem;display:grid;gap:var(--pf-space-4)}
.pf-metric{display:flex;flex-direction:column;gap:6px;min-width:0}
.pf-metric__label{display:flex;align-items:center;gap:8px;color:var(--pf-muted);font-size:var(--pf-text-sm);font-weight:500;line-height:1.35}
.pf-metric__value{font:700 var(--pf-metric-value)/1.05 var(--pf-font-heading);letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pf-metric__row{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px}
.pf-metric__context{color:var(--pf-muted);font-size:var(--pf-text-xs);line-height:1.4}
.pf-metric__chart svg{display:block;width:100%;height:44px;overflow:visible;color:var(--pf-chart)}
.pf-metric__chart .pf-spark-area{stroke:none}
.pf-metric__chart .pf-spark-line{fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.pf-metric__chart .pf-spark-end{fill:none;stroke:currentColor;stroke-width:7;stroke-linecap:round}
.pf-metric__ba{display:none;gap:6px}
.pf-metric__bar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;font-size:var(--pf-text-xs);font-variant-numeric:tabular-nums;color:var(--pf-muted)}
.pf-metric__bar i{display:block;height:8px;width:var(--w);min-width:4px;border-radius:4px;background:color-mix(in oklab,var(--pf-muted) 40%,transparent)}
.pf-metric__bar--after i{background:var(--pf-accent)}
.pf-metric__bar--after{color:var(--pf-text);font-weight:600}
.pf-metric__progress{height:6px;border-radius:3px;background:var(--pf-border);overflow:hidden}
.pf-metric__progress i{display:block;height:100%;width:var(--w);background:var(--pf-accent)}
.pf-trend{display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 6px;border-radius:999px;font:600 var(--pf-text-xs)/1.4 var(--pf-font-body);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--pf-muted);background:color-mix(in oklab,var(--pf-muted) 12%,transparent)}
.pf-trend svg{width:12px;height:12px}
.pf-trend[data-good="true"]{color:var(--pf-positive);background:color-mix(in oklab,var(--pf-positive) 13%,transparent)}
.pf-trend[data-good="false"]{color:var(--pf-negative);background:color-mix(in oklab,var(--pf-negative) 13%,transparent)}
.pf-metrics[data-variant="kpi"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))}
.pf-metrics[data-variant="kpi"] .pf-metric{padding:18px 18px 16px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-bg)}
.pf-metrics[data-variant="kpi"] .pf-metric__chart{margin-top:4px}
.pf-metrics[data-variant="big"]{--pf-metric-value:clamp(2.25rem,1.7rem + 2.2vw,3.25rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:var(--pf-space-6)}
.pf-metrics[data-variant="big"] .pf-metric{gap:8px}
.pf-metrics[data-variant="big"] .pf-metric__label{order:2;color:var(--pf-text);font-size:var(--pf-text-sm)}
.pf-metrics[data-variant="big"] .pf-metric__row{order:1;flex-direction:column;align-items:flex-start;gap:8px}
.pf-metrics[data-variant="big"] .pf-metric__chart{order:3;max-width:160px}
.pf-metrics[data-variant="big"] .pf-metric__chart svg{height:28px}
.pf-metrics[data-variant="big"] .pf-metric__progress{order:3}
.pf-metrics[data-variant="big"] .pf-metric__context{order:4}
.pf-metrics[data-variant="big"] .pf-metric__value{color:var(--pf-accent-text)}
.pf-metrics[data-variant="ba"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:var(--pf-space-5) var(--pf-space-6)}
.pf-metrics[data-variant="ba"] .pf-metric__ba{display:grid;margin-top:4px}
.pf-metrics[data-variant="ba"] .pf-metric__chart svg{height:30px}
.pf-metrics[data-variant="ba"] .pf-metric__value{font-size:calc(var(--pf-metric-value) * .85)}
.pf-work-metric{display:inline-flex;align-items:baseline;gap:6px;max-width:100%;padding:4px 10px;border-radius:999px;background:var(--pf-accent-soft);color:var(--pf-text);font-size:var(--pf-text-xs);line-height:1.4}
.pf-work-metric b{color:var(--pf-accent-text);font-size:var(--pf-text-sm);font-variant-numeric:tabular-nums}
.pf-cover{position:relative;overflow:hidden;background:var(--pf-surface);aspect-ratio:var(--pf-cover-ratio,4/3);max-width:100%}
.pf-cover img{width:100%;height:100%;object-fit:cover}
.pf-detail{display:none;position:fixed;inset:0;z-index:60;overflow-y:auto;overscroll-behavior:contain;background:color-mix(in oklab,#000 55%,transparent);padding:max(24px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.pf-detail:target{display:block}
.pf-detail__panel{position:relative;max-width:960px;margin:0 auto;background:var(--pf-bg);color:var(--pf-text);border-radius:calc(var(--pf-radius) + 6px);--pf-detail-pad:clamp(20px,4vw,48px);padding:var(--pf-detail-pad);display:grid;gap:var(--pf-space-6)}
.pf-detail__bar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;margin:calc(-1 * var(--pf-detail-pad)) calc(-1 * var(--pf-detail-pad)) 0;padding:12px var(--pf-detail-pad);background:color-mix(in oklab,var(--pf-bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--pf-border);border-radius:calc(var(--pf-radius) + 6px) calc(var(--pf-radius) + 6px) 0 0;font-size:var(--pf-text-sm)}
.pf-detail__bar nav{display:flex;gap:6px}
.pf-detail__bar a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:999px;border:1px solid var(--pf-border);text-decoration:none;font-weight:600}
.pf-detail__head{display:grid;gap:var(--pf-space-3)}
.pf-detail__title{font-size:var(--pf-text-2xl);letter-spacing:-.02em}
.pf-detail__title:focus{outline:none}
.pf-detail__summary{color:var(--pf-muted);font-size:var(--pf-text-lg);line-height:1.5}
.pf-detail__meta{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--pf-muted);font-size:var(--pf-text-sm)}
.pf-detail__meta b{color:var(--pf-text);font-weight:600}
.pf-detail__hero{border-radius:var(--pf-radius);--pf-cover-ratio:16/9}
@media (max-width:640px){.pf-detail{padding:0;background:var(--pf-bg)}.pf-detail__panel{border-radius:0;min-height:100%}.pf-detail__bar{border-radius:0;padding-top:max(12px,env(safe-area-inset-top,0px))}}
.pf-blocks{display:grid;gap:var(--pf-space-6)}
.pf-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:var(--pf-space-3)}
.pf-gallery[data-layout="full"]{grid-template-columns:minmax(0,1fr)}
.pf-gallery[data-layout="carousel"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}
.pf-gallery[data-layout="carousel"] figure{flex:0 0 min(85%,560px);scroll-snap-align:start}
.pf-gallery figure{display:grid;gap:8px;align-content:start}
.pf-gallery img{width:100%;border-radius:var(--pf-radius-sm);background:var(--pf-surface)}
.pf-gallery figcaption{color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-zoom{display:block;border-radius:var(--pf-radius-sm);cursor:zoom-in}
.pf-zoom:focus-visible{outline:2px solid var(--pf-accent-text);outline-offset:3px}
.pf-lightbox{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:64px 12px;background:rgba(8,10,14,.96);color:#fff;touch-action:pan-y;overscroll-behavior:contain}
.pf-lightbox[hidden]{display:none}
.pf-lightbox__stage{margin:0;display:grid;gap:12px;justify-items:center;max-width:100%}
.pf-lightbox__stage img{display:block;width:auto;height:auto;max-width:min(100%,1600px);max-height:calc(100dvh - 160px);object-fit:contain;border-radius:6px}
.pf-lightbox__stage figcaption{max-width:60ch;color:rgba(255,255,255,.84);font-size:var(--pf-text-sm);text-align:center}
.pf-lightbox__count{position:absolute;top:max(22px,env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);margin:0;color:rgba(255,255,255,.8);font-size:var(--pf-text-sm);font-variant-numeric:tabular-nums}
.pf-lightbox__btn{position:absolute;display:grid;place-items:center;width:44px;height:44px;padding:0;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;cursor:pointer}
.pf-lightbox__btn:hover{background:rgba(255,255,255,.18)}
.pf-lightbox__btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.pf-lightbox__btn[hidden]{display:none}
.pf-lightbox__btn .pf-icon{width:22px;height:22px}
.pf-lightbox__close{top:max(12px,env(safe-area-inset-top,0px));inset-inline-end:12px}
.pf-lightbox__prev,.pf-lightbox__next{top:50%;transform:translateY(-50%)}
.pf-lightbox__prev{inset-inline-start:12px}
.pf-lightbox__next{inset-inline-end:12px}
@media (max-width:640px){.pf-lightbox__prev,.pf-lightbox__next{top:auto;bottom:max(16px,env(safe-area-inset-bottom,0px));transform:none}}
.pf-video{position:relative;border-radius:var(--pf-radius);overflow:hidden;background:#0b0d12;color:#fff;--pf-cover-ratio:16/9}
.pf-video__open{position:relative;display:block;color:inherit;text-decoration:none;cursor:pointer}
.pf-video .pf-cover{background:radial-gradient(120% 120% at 0% 0%,color-mix(in oklab,var(--pf-accent) 55%,#0b0d12),#0b0d12 70%)}
.pf-video .pf-cover img{opacity:.82;transition:opacity .2s,transform .3s}
.pf-video__open:is(:hover,:focus-visible) .pf-cover img{opacity:.92;transform:scale(1.015)}
.pf-video__play{position:absolute;inset:0;display:grid;place-items:center}
.pf-video__play>span{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:var(--pf-accent);color:var(--pf-on-accent);box-shadow:0 10px 30px rgb(0 0 0/.35);transition:transform .15s}
.pf-video__open:is(:hover,:focus-visible) .pf-video__play>span{transform:scale(1.06)}
.pf-video__icon{width:30px;height:30px;margin-inline-start:4px}
[dir="rtl"] .pf-video__icon{margin-inline-start:0;margin-inline-end:4px}
.pf-video__meta{position:absolute;inset-inline:0;bottom:0;padding:40px 20px 16px;background:linear-gradient(transparent,rgb(0 0 0/.72));font-size:var(--pf-text-sm);line-height:1.35;color:rgb(255 255 255/.86)}
.pf-video__meta b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:#fff;font-size:var(--pf-text-md)}
.pf-video__open:focus-visible{outline:none}
.pf-video:has(.pf-video__open:focus-visible){outline:2px solid var(--pf-accent-text);outline-offset:3px}
.pf-video iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}
@media (max-width:520px){.pf-video__play>span{width:56px;height:56px}.pf-video__icon{width:24px;height:24px}.pf-video__meta{padding:28px 14px 10px;font-size:var(--pf-text-xs)}.pf-video__meta b{-webkit-line-clamp:1;font-size:var(--pf-text-sm)}}
.pf-pdf,.pf-link{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:center;padding:14px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-surface);color:var(--pf-text)}
.pf-pdf__page{display:grid;place-items:center;width:84px;aspect-ratio:800/1131;border-radius:4px;box-shadow:0 2px 8px rgb(0 0 0/.16);overflow:hidden;background:#fff;color:#8a8f98}
.pf-pdf__page img{width:100%;height:100%;object-fit:cover;object-position:top}
.pf-pdf__icon{width:32px;height:32px}
.pf-pdf__text{display:grid;gap:4px;justify-items:start;min-width:0}
.pf-pdf b,.pf-link b{display:block;font-weight:600;line-height:1.35}
.pf-pdf__text>span{color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-pdf .pf-btn{margin-top:8px;min-height:40px;padding:.45em 1em;font-size:var(--pf-text-xs);background:var(--pf-bg)}
.pf-link{text-decoration:none;transition:border-color .15s}
.pf-link:hover{border-color:var(--pf-text)}
.pf-link__site{display:grid;place-items:center;width:52px;height:52px;border-radius:12px;background:var(--pf-bg);border:1px solid var(--pf-border);color:var(--pf-accent-text)}
.pf-link__site svg{width:26px;height:26px}
.pf-link__image{display:block;width:148px;aspect-ratio:1.91/1;border-radius:var(--pf-radius-sm);overflow:hidden;background:var(--pf-bg)}
.pf-link__image img{width:100%;height:100%;object-fit:cover}
.pf-link__text{display:grid;gap:2px;min-width:0}
.pf-link__desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:2px;color:var(--pf-muted);font-size:var(--pf-text-sm);line-height:1.45}
.pf-link__domain{display:inline-flex;align-items:center;gap:6px;margin-top:4px;min-width:0;color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-link__domain .pf-icon{width:.95em;height:.95em}
@media (max-width:520px){.pf-link[data-image]{grid-template-columns:minmax(0,1fr)}.pf-link[data-image] .pf-link__image{width:100%}.pf-pdf__page{width:72px}}
.pf-avatar{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--pf-accent-soft);color:var(--pf-accent-text);font:700 var(--pf-text-sm)/1 var(--pf-font-heading)}
.pf-avatar img{width:100%;height:100%;object-fit:cover}
.pf-person{display:flex;align-items:center;gap:12px;min-width:0}
.pf-person__text b{display:block;font-weight:600;line-height:1.3}
.pf-person__text span{display:block;color:var(--pf-muted);font-size:var(--pf-text-xs);line-height:1.35}
.pf-logos{display:flex;flex-wrap:wrap;gap:var(--pf-space-4) var(--pf-space-6);align-items:center;margin:0;padding:0;list-style:none}
.pf-logo{display:inline-flex;align-items:center;gap:8px;color:var(--pf-muted);font:700 var(--pf-text-md)/1.1 var(--pf-font-heading);letter-spacing:-.01em;text-decoration:none;transition:color .2s,filter .2s,opacity .2s}
.pf-logo svg{width:26px;height:26px;flex:none}
.pf-logo img{height:40px;width:auto;max-width:160px;object-fit:contain}
.pf-logos[data-variant="grayscale"] .pf-logo img{filter:grayscale(1);opacity:.75}
.pf-logos[data-variant="grayscale"] .pf-logo:is(:hover,:focus-visible) img{filter:none;opacity:1}
.pf-logo:is(:hover,:focus-visible){color:var(--pf-text)}
.pf-logo:is(:hover,:focus-visible) svg,.pf-logos[data-variant="color"] .pf-logo svg{color:var(--pf-accent-text)}
.pf-cvlist{display:grid;gap:var(--pf-space-5);margin:0;padding:0;list-style:none}
.pf-cvitem{display:grid;gap:4px}
.pf-cvitem__head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 16px;align-items:baseline}
.pf-cvitem__role{font-weight:600}
.pf-cvitem__when{color:var(--pf-muted);font-size:var(--pf-text-sm);font-variant-numeric:tabular-nums}
.pf-cvitem__org{color:var(--pf-muted);font-size:var(--pf-text-sm)}
.pf-cvitem__org a{text-underline-offset:3px}
.pf-cvitem .pf-prose{margin-top:6px;font-size:var(--pf-text-sm)}
.pf-cvitem__roles{display:grid;gap:10px;margin:8px 0 0;padding-inline-start:14px;border-inline-start:2px solid var(--pf-border);list-style:none}
.pf-cvlist[data-variant="timeline"]{gap:0}
.pf-cvlist[data-variant="timeline"] .pf-cvitem{position:relative;padding:0 0 var(--pf-space-5);padding-inline-start:26px;border-inline-start:2px solid var(--pf-border);margin-inline-start:6px}
.pf-cvlist[data-variant="timeline"] .pf-cvitem:last-child{border-color:transparent;padding-bottom:0}
.pf-cvlist[data-variant="timeline"] .pf-cvitem::before{content:"";position:absolute;inset-inline-start:-8px;top:4px;width:14px;height:14px;border-radius:50%;border:2px solid var(--pf-accent);background:var(--pf-bg)}
.pf-cvlist[data-variant="timeline"] .pf-cvitem:first-child::before{background:var(--pf-accent)}
.pf-skillgroups{display:grid;gap:var(--pf-space-4)}
.pf-skillgroup{display:grid;gap:8px}
.pf-skillgroup b{font-size:var(--pf-text-sm)}
.pf-extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:var(--pf-space-6)}
.pf-extra__title{font-size:var(--pf-text-md);font-weight:700;margin-bottom:12px}
.pf-extra ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pf-extra li{display:grid;gap:1px;font-size:var(--pf-text-sm)}
.pf-extra li span{color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-extra li a{text-underline-offset:3px}
.pf-loc{display:grid;gap:12px;padding:16px;border:1px solid var(--pf-border);border-radius:var(--pf-radius);background:var(--pf-bg)}
.pf-loc[data-map]{padding:12px}
.pf-loc__map{position:relative;overflow:hidden;border-radius:calc(var(--pf-radius) - 4px);aspect-ratio:5/3;max-width:100%;background:var(--pf-surface)}
.pf-loc__map img{width:100%;height:100%;object-fit:cover}
.pf-loc__pin{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--pf-accent);border:4px solid #fff;box-shadow:0 0 0 8px color-mix(in oklab,var(--pf-accent) 26%,transparent),0 4px 10px rgb(0 0 0/.3)}
.pf-loc__attr{position:absolute;inset-inline-end:6px;bottom:6px;padding:1px 6px;border-radius:4px;background:rgb(255 255 255/.85);color:#333;font-size:10px;line-height:1.5}
.pf-loc__body{display:grid;gap:10px}
.pf-loc[data-map] .pf-loc__body{padding:2px 4px 4px}
.pf-loc__open{justify-self:start;color:var(--pf-accent-text);font-size:var(--pf-text-xs);font-weight:600;text-underline-offset:3px}
.pf-loc__city{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;align-items:baseline}
.pf-loc__city b{font:700 var(--pf-text-lg)/1.2 var(--pf-font-heading)}
.pf-loc__time{color:var(--pf-muted);font-size:var(--pf-text-xs);font-variant-numeric:tabular-nums}
.pf-contact-links{display:grid;gap:6px;margin:0;padding:0;list-style:none;font-size:var(--pf-text-sm)}
.pf-contact-links li{display:flex;flex-wrap:wrap;gap:4px 10px}
.pf-contact-links span{min-width:88px;color:var(--pf-muted)}
.pf-contact-links a{text-underline-offset:3px;overflow-wrap:anywhere}
.pf-foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px 24px;padding-block:var(--pf-space-6);color:var(--pf-muted);font-size:var(--pf-text-xs)}
.pf-foot a{color:var(--pf-muted);text-underline-offset:3px}
.pf-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border:1px solid var(--pf-border);border-radius:999px;color:var(--pf-text)!important;text-decoration:none;font-weight:600}
.pf-badge svg{width:20px;height:20px}
`;
