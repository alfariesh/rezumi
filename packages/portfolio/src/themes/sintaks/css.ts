/**
 * Sintaks: a developer's dark workspace. A faint grid and an accent glow behind the top of the page, the intro and
 * Contact as terminal windows, works as repository cards, the career as a commit graph, and a mono face for every
 * label, path and figure. Scoped entirely to `.pf[data-theme="sintaks"]`; prefix `sk-`.
 */
export const SINTAKS_CSS = String.raw`
.pf[data-theme="sintaks"]{--pf-max-width:1120px;--pf-radius:12px;--pf-radius-sm:8px;--sk-pad:clamp(20px,3.2vw,40px);--sk-gap:clamp(72px,9vw,120px);--sk-shadow:0 28px 64px -36px rgb(0 0 0/.55);position:relative;isolation:isolate;background:var(--pf-bg)}
.pf[data-theme="sintaks"]::before{content:"";position:absolute;inset:0 0 auto;z-index:-1;height:820px;pointer-events:none;background:radial-gradient(46% 52% at 72% 0%,color-mix(in oklab,var(--pf-accent) 16%,transparent),transparent 72%),linear-gradient(var(--pf-border) 1px,transparent 1px) 0 0/44px 44px,linear-gradient(90deg,var(--pf-border) 1px,transparent 1px) 0 0/44px 44px;-webkit-mask-image:radial-gradient(ellipse 85% 75% at 50% 0%,#000 25%,transparent 78%);mask-image:radial-gradient(ellipse 85% 75% at 50% 0%,#000 25%,transparent 78%);opacity:.6}
.pf[data-theme="sintaks"] .sk-top{padding-block:14px}
.pf[data-theme="sintaks"] .pf-nav{min-height:56px}
.pf[data-theme="sintaks"] .sk-brand{gap:12px;font:700 15px/1.2 var(--pf-font-mono);letter-spacing:-.01em}
.pf[data-theme="sintaks"] .sk-mark{display:grid;place-items:center;flex:none;width:34px;height:34px;border:1px solid var(--pf-border);border-radius:8px;background:var(--pf-surface);color:var(--pf-accent-text);font:700 13px/1 var(--pf-font-mono);letter-spacing:-.08em}
.pf[data-theme="sintaks"] .pf-nav__links{gap:4px;font:400 13px/1.2 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-nav__links a{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border-radius:8px}
.pf[data-theme="sintaks"] .pf-nav__links a::before{content:"./";content:"./"/"";direction:ltr;unicode-bidi:isolate;color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .pf-nav__links a:hover{background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-menu>summary{border-radius:8px;background:var(--pf-surface);font:400 13px/1 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-menu__list{border-radius:12px;background:var(--pf-surface);font:400 14px/1.3 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-menu__list a:hover{background:var(--pf-bg)}
.pf[data-theme="sintaks"] .pf-btn{min-height:44px;padding:.7em 1.15em;border-radius:8px;font:700 14px/1.2 var(--pf-font-mono);letter-spacing:-.01em}
.pf[data-theme="sintaks"] .pf-btn--secondary{border-color:var(--pf-border);background:transparent}
.pf[data-theme="sintaks"] .pf-btn--secondary:hover{border-color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .sk-main{display:grid;gap:var(--sk-gap);padding-block:clamp(24px,4vw,56px) clamp(56px,7vw,96px)}
.pf[data-theme="sintaks"] .sk-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,300px);gap:clamp(16px,2.6vw,32px);align-items:start;min-width:0}
.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,300px) minmax(0,1fr)}
.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"] .sk-photo{grid-column:1;grid-row:1}
.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"] .sk-term{grid-column:2;grid-row:1}
.pf[data-theme="sintaks"] .sk-hero[data-variant="big-name"]{grid-template-columns:minmax(0,1fr)}
.pf[data-theme="sintaks"] .sk-hero[data-bg]:not([data-bg="plain"]){padding:var(--sk-pad);border:1px solid var(--pf-border);border-radius:18px;background:var(--pf-hero-bg)}
.pf[data-theme="sintaks"] .sk-win{min-width:0;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface);box-shadow:var(--sk-shadow)}
.pf[data-theme="sintaks"] .sk-hero[data-bg]:not([data-bg="plain"]) .sk-win{background:color-mix(in oklab,var(--pf-bg) 84%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.pf[data-theme="sintaks"] .sk-win__bar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--pf-border);color:var(--pf-muted);font:400 12px/1.2 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-win__bar i{flex:none;width:12px;height:12px;border-radius:50%;background:#FF5F57}
.pf[data-theme="sintaks"] .sk-win__bar i:nth-child(2){background:#FEBC2E}
.pf[data-theme="sintaks"] .sk-win__bar i:nth-child(3){background:#28C840}
.pf[data-theme="sintaks"] .sk-win__bar span{flex:1;min-width:0;overflow:hidden;padding-inline-end:52px;text-align:center;text-overflow:ellipsis;white-space:nowrap}
.pf[data-theme="sintaks"] .sk-term__body{container-type:inline-size;display:grid;justify-items:start;gap:14px;min-width:0;padding:var(--sk-pad)}
.pf[data-theme="sintaks"] .sk-term__body>*{max-width:100%}
.pf[data-theme="sintaks"] .sk-cmd{margin-bottom:-6px;color:var(--pf-muted);font:400 14px/1.6 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-cmd:not(:first-child){margin-top:10px}
.pf[data-theme="sintaks"] .sk-ps1{color:var(--pf-accent-text);font-weight:700}
.pf[data-theme="sintaks"] .sk-caret{display:inline-block;width:.62em;height:1.15em;margin-inline-start:.5em;vertical-align:-.22em;background:var(--pf-accent-text);animation:sk-blink 1s steps(1) 6}
@keyframes sk-blink{50%{opacity:0}}
.pf[data-theme="sintaks"] .sk-name{font-size:max(1.75rem,min(clamp(2.75rem,1.5rem + 3.8vw,4.75rem),calc(100cqi / (var(--name-word) * .62))));font-weight:700;line-height:1.02;letter-spacing:-.045em}
.pf[data-theme="sintaks"] .sk-hero[data-variant="big-name"] .sk-name{font-size:max(1.75rem,min(clamp(3rem,1.4rem + 5.4vw,6.5rem),calc(100cqi / (var(--name-word) * .62))));letter-spacing:-.055em}
.pf[data-theme="sintaks"] .sk-headline{color:var(--pf-accent-text);font:400 clamp(1.05rem,.95rem + .5vw,1.3rem)/1.45 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-greeting{max-width:62ch;margin-top:4px;color:var(--pf-muted);font:400 15px/1.7 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-greeting::before{content:"# ";content:"# "/""}
.pf[data-theme="sintaks"] .sk-term .pf-chips{gap:8px;margin-top:8px}
.pf[data-theme="sintaks"] .pf-chip{padding:5px 10px;border:1px solid var(--pf-border);border-radius:6px;background:transparent;color:var(--pf-text);font:400 12.5px/1.4 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-chip--open{border-color:color-mix(in oklab,var(--pf-positive) 55%,var(--pf-border));color:var(--pf-positive)}
.pf[data-theme="sintaks"] .sk-term .pf-opento{font:400 13px/1.6 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-term .pf-opento__label{color:var(--pf-accent-text);font-weight:700}
.pf[data-theme="sintaks"] .sk-term .pf-btns{gap:10px;margin-top:10px}
.pf[data-theme="sintaks"] .sk-photo{display:grid}
.pf[data-theme="sintaks"] .sk-photo__img{width:100%;aspect-ratio:1;object-fit:cover}
.pf[data-theme="sintaks"] .sk-hero+.sk-stats{margin-top:calc(24px - var(--sk-gap))}
.pf[data-theme="sintaks"] .sk-stats.pf-metrics{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:1px;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-border)}
.pf[data-theme="sintaks"] .sk-stats .pf-metric{gap:4px;padding:20px 24px;border:0;border-radius:0;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .sk-stats .pf-metric__row{order:-1}
.pf[data-theme="sintaks"] .sk-stats .pf-metric__value{color:var(--pf-accent-text);font:700 clamp(1.5rem,1.2rem + 1vw,2rem)/1.1 var(--pf-font-mono);letter-spacing:-.04em}
.pf[data-theme="sintaks"] .sk-stats .pf-metric__label{color:var(--pf-muted);font:400 12.5px/1.4 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-section{display:grid;gap:28px;min-width:0;scroll-margin-top:24px}
.pf[data-theme="sintaks"] :is(.sk-section>.pf-section__title,.sk-extra>.pf-extra__title){display:flex;align-items:baseline;gap:12px;margin:0;font:700 clamp(1.25rem,1.1rem + .6vw,1.5rem)/1.25 var(--pf-font-mono);letter-spacing:-.02em}
.pf[data-theme="sintaks"] :is(.sk-section>.pf-section__title,.sk-extra>.pf-extra__title)::before{content:"##";content:"##"/"";color:var(--pf-accent-text);font-weight:400}
.pf[data-theme="sintaks"] .sk-section>.pf-section__title::after{content:"";flex:1 1 40px;align-self:center;height:1px;background:var(--pf-border)}
.pf[data-theme="sintaks"] .sk-lead{max-width:70ch;font-size:clamp(1.1rem,1rem + .35vw,1.25rem);line-height:1.75}
.pf[data-theme="sintaks"] .sk-lead strong{font-weight:600}
.pf[data-theme="sintaks"] .pf-prose ul>li::marker,.pf[data-theme="sintaks"] .pf-prose ol>li::marker{color:var(--pf-accent-text);font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-prose blockquote{border-color:var(--pf-accent-text);color:var(--pf-text);font-size:var(--pf-text-md);font-style:normal}
.pf[data-theme="sintaks"] .sk-glyph{flex:none;width:18px;height:18px}
.pf[data-theme="sintaks"] .sk-repos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:0;padding:0;list-style:none}
.pf[data-theme="sintaks"] .sk-repos[data-variant="grid-3"]{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.pf[data-theme="sintaks"] .sk-repo{position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface);transition:border-color .15s,translate .15s}
.pf[data-theme="sintaks"] .sk-repo:hover{border-color:color-mix(in oklab,var(--pf-accent-text) 60%,var(--pf-border));translate:0 -2px}
.pf[data-theme="sintaks"] .sk-repo:has(.sk-repo__link:focus-visible){outline:2px solid var(--pf-accent-text);outline-offset:3px}
.pf[data-theme="sintaks"] .sk-repo__cover{--pf-cover-ratio:16/10;flex:none;border-bottom:1px solid var(--pf-border);background:var(--pf-bg)}
.pf[data-theme="sintaks"] .sk-repo__cover img{transition:transform .3s}
.pf[data-theme="sintaks"] .sk-repo:hover .sk-repo__cover img{transform:scale(1.02)}
.pf[data-theme="sintaks"] .sk-repo__body{display:flex;flex:1;flex-direction:column;align-items:start;gap:10px;min-width:0;padding:20px 22px}
.pf[data-theme="sintaks"] .sk-repo__title{font:700 17px/1.4 var(--pf-font-mono);letter-spacing:-.015em}
.pf[data-theme="sintaks"] .sk-repo__link{display:inline-flex;align-items:flex-start;gap:10px;color:var(--pf-accent-text);text-decoration:none}
.pf[data-theme="sintaks"] .sk-repo__link:focus-visible{outline:none}
.pf[data-theme="sintaks"] .sk-repo__link::after{content:"";position:absolute;inset:0;z-index:1}
.pf[data-theme="sintaks"] .sk-repo__link .sk-glyph{margin-top:2px;color:var(--pf-muted)}
.pf[data-theme="sintaks"] .sk-repo:hover .sk-repo__link>span{text-decoration:underline;text-underline-offset:4px}
.pf[data-theme="sintaks"] .sk-repo__meta{color:var(--pf-muted);font:400 12.5px/1.5 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-repo__summary{color:var(--pf-muted);font-size:15px;line-height:1.6}
.pf[data-theme="sintaks"] .pf-work-metric{padding:4px 10px;border-radius:6px;font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-repo__foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;width:100%;margin-top:auto;padding-top:8px}
.pf[data-theme="sintaks"] .sk-langs{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:0;color:var(--pf-muted);font:400 12.5px/1.5 var(--pf-font-mono);list-style:none}
.pf[data-theme="sintaks"] .sk-langs li{display:inline-flex;align-items:center;gap:6px}
.pf[data-theme="sintaks"] .sk-langs i{flex:none;width:10px;height:10px;border-radius:50%;background:var(--sk-dot);box-shadow:inset 0 0 0 1px rgb(0 0 0/.18)}
.pf[data-theme="sintaks"] .sk-repo__code{position:relative;z-index:2;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 12px;border:1px solid var(--pf-border);border-radius:8px;background:var(--pf-bg);color:var(--pf-text);font:400 12.5px/1.3 var(--pf-font-mono);text-decoration:none}
.pf[data-theme="sintaks"] .sk-repo__code .sk-glyph{width:15px;height:15px;color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .sk-repo__code:hover{border-color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"]{grid-template-columns:minmax(0,1fr);gap:0;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo{flex-direction:row;border:0;border-radius:0;background:transparent;translate:none}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo+.sk-repo{border-top:1px solid var(--pf-border)}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo:hover{background:color-mix(in oklab,var(--pf-bg) 45%,var(--pf-surface))}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo:has(.sk-repo__link:focus-visible){outline-offset:-3px}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo__cover{--pf-cover-ratio:16/10;order:2;width:220px;align-self:center;margin:16px;margin-inline-start:0;border:1px solid var(--pf-border);border-radius:10px}
.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo__body{padding:20px 24px}
.pf[data-theme="sintaks"] .sk-log{display:grid;margin:0;padding:0;list-style:none}
.pf[data-theme="sintaks"] .sk-commit{position:relative;display:grid;gap:8px;min-width:0}
.pf[data-theme="sintaks"] .sk-log>.sk-commit{padding-bottom:30px;padding-inline-start:34px}
.pf[data-theme="sintaks"] .sk-log>.sk-commit:last-child{padding-bottom:0}
.pf[data-theme="sintaks"] .sk-log>.sk-commit::before{content:"";position:absolute;top:22px;bottom:-6px;inset-inline-start:7px;width:2px;background:var(--pf-border)}
.pf[data-theme="sintaks"] .sk-log>.sk-commit:last-child::before{display:none}
.pf[data-theme="sintaks"] .sk-log>.sk-commit::after{content:"";position:absolute;top:5px;inset-inline-start:1px;box-sizing:border-box;width:14px;height:14px;border:2px solid var(--pf-accent-text);border-radius:50%;background:var(--pf-bg)}
.pf[data-theme="sintaks"] .sk-log>.sk-commit:first-child::after{background:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]{gap:22px}
.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]>.sk-commit{padding:0 0 22px;border-bottom:1px dashed var(--pf-border)}
.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]>.sk-commit:last-child{padding-bottom:0;border-bottom:0}
.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]>.sk-commit::before,.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]>.sk-commit::after{display:none}
.pf[data-theme="sintaks"] .sk-commit__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;min-width:0}
.pf[data-theme="sintaks"] .sk-hash{color:var(--pf-accent-text);font:400 13px/1.5 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-ref{padding:0 6px;border:1px solid currentColor;border-radius:4px;color:var(--pf-accent-text);font:700 11px/1.6 var(--pf-font-mono)}
.pf[data-theme="sintaks"] :is(.sk-commit__title,.sk-commit__when,.sk-langs li,.sk-stack li){unicode-bidi:plaintext}
.pf[data-theme="sintaks"] .sk-commit__title{font-size:17px;font-weight:600;line-height:1.4}
.pf[data-theme="sintaks"] .sk-commit__org{color:var(--pf-muted);font-weight:400}
.pf[data-theme="sintaks"] .sk-commit__org a{color:inherit;text-underline-offset:3px}
.pf[data-theme="sintaks"] .sk-commit__when{margin-inline-start:auto;color:var(--pf-muted);font:400 12.5px/1.5 var(--pf-font-mono);white-space:nowrap}
.pf[data-theme="sintaks"] .sk-commit__body{max-width:72ch;font-size:15px;line-height:1.7}
.pf[data-theme="sintaks"] .sk-commit__roles{display:grid;gap:16px;margin:6px 0 0;padding:0;padding-inline-start:18px;border-inline-start:1px dashed var(--pf-border);list-style:none}
.pf[data-theme="sintaks"] .sk-commit--role .sk-commit__title{font-size:15px}
.pf[data-theme="sintaks"] .pf-tags{gap:8px}
.pf[data-theme="sintaks"] .pf-tags li{padding:5px 11px;border-color:var(--pf-border);border-radius:6px;background:var(--pf-surface);color:var(--pf-text);font:400 13px/1.5 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .sk-stack{gap:10px}
.pf[data-theme="sintaks"] .sk-stack li{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;font-size:14px}
.pf[data-theme="sintaks"] .sk-stack i{flex:none;width:9px;height:9px;border-radius:50%;background:var(--sk-dot);box-shadow:inset 0 0 0 1px rgb(0 0 0/.18)}
.pf[data-theme="sintaks"] .pf-skillgroups{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px 32px}
.pf[data-theme="sintaks"] .pf-skillgroup{align-content:start;gap:10px}
.pf[data-theme="sintaks"] .pf-skillgroup b{color:var(--pf-muted);font:400 13px/1.4 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-skillgroup b::before{content:"// ";content:"// "/"";color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .sk-services{display:grid;gap:16px;margin:0;padding:0;list-style:none}
.pf[data-theme="sintaks"] .pf-service{display:grid;align-content:start;gap:10px;min-width:0;padding:22px 24px;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-service__head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 16px}
.pf[data-theme="sintaks"] .pf-service h3{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700;letter-spacing:-.025em}
.pf[data-theme="sintaks"] .pf-service h3 .pf-icon{color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .pf-service__price{color:var(--pf-accent-text);font:400 13px/1.4 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-service__desc{max-width:64ch;color:var(--pf-muted);font-size:15px;line-height:1.6}
.pf[data-theme="sintaks"] .pf-service__cta{display:inline-flex;align-items:center;gap:8px;width:fit-content;min-height:36px;color:var(--pf-accent-text);font:700 13px/1.3 var(--pf-font-mono);text-underline-offset:4px}
.pf[data-theme="sintaks"] .sk-services[data-variant="cards"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"]{gap:0;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service{grid-template-columns:minmax(0,1fr) auto;column-gap:32px;border:0;border-radius:0;background:transparent}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service+.pf-service{border-top:1px solid var(--pf-border)}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service>*{grid-column:1}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service__head{justify-content:flex-start}
.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service>.pf-service__cta{grid-column:2;grid-row:1/span 2;align-self:center}
.pf[data-theme="sintaks"] .sk-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;margin:0;padding:0;list-style:none}
.pf[data-theme="sintaks"] .pf-quote{display:grid;align-content:start;gap:20px;min-width:0;padding:24px;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-quote blockquote{padding-inline-start:16px;border-inline-start:2px solid var(--pf-accent-text);font-size:16.5px;line-height:1.65}
.pf[data-theme="sintaks"] .pf-avatar{width:40px;height:40px;border-radius:8px;font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-person__text span{font-family:var(--pf-font-mono);font-size:12px}
.pf[data-theme="sintaks"] .pf-quote__source{color:var(--pf-muted);font:400 12px/1.4 var(--pf-font-mono);text-underline-offset:3px}
.pf[data-theme="sintaks"] .sk-quotes[data-variant="carousel"]{display:flex;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x mandatory}
.pf[data-theme="sintaks"] .sk-quotes[data-variant="carousel"] .pf-quote{flex:0 0 min(88%,440px);scroll-snap-align:start}
.pf[data-theme="sintaks"] .pf-logos{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:0;overflow:hidden;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-logos>li{display:grid;min-width:0;margin-bottom:-1px;margin-inline-end:-1px;border-bottom:1px solid var(--pf-border);border-inline-end:1px solid var(--pf-border)}
.pf[data-theme="sintaks"] .pf-logo{justify-content:center;min-height:88px;padding:16px 20px;font:700 15px/1.25 var(--pf-font-mono);text-align:center}
.pf[data-theme="sintaks"] .pf-logo img{height:34px;max-width:100%}
@media screen{:root[data-pf-scheme="dark"] .pf[data-theme="sintaks"] .pf-logos[data-variant="grayscale"] .pf-logo img{filter:grayscale(1) invert(1);opacity:.78}:root[data-pf-scheme="dark"] .pf[data-theme="sintaks"] .pf-logos[data-variant="grayscale"] .pf-logo:is(:hover,:focus-visible) img{filter:grayscale(1) invert(1);opacity:1}}
@media screen and (prefers-color-scheme:dark){:root[data-pf-scheme="auto"] .pf[data-theme="sintaks"] .pf-logos[data-variant="grayscale"] .pf-logo img{filter:grayscale(1) invert(1);opacity:.78}:root[data-pf-scheme="auto"] .pf[data-theme="sintaks"] .pf-logos[data-variant="grayscale"] .pf-logo:is(:hover,:focus-visible) img{filter:grayscale(1) invert(1);opacity:1}}
.pf[data-theme="sintaks"] .sk-custom__image{width:100%;max-height:560px;object-fit:cover;border:1px solid var(--pf-border);border-radius:14px}
.pf[data-theme="sintaks"] .sk-extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px}
.pf[data-theme="sintaks"] .sk-extra{display:grid;align-content:start;gap:16px;min-width:0;padding:22px 24px;border:1px solid var(--pf-border);border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .sk-extra>.pf-extra__title{font-size:15px}
.pf[data-theme="sintaks"] .pf-extralist{gap:12px}
.pf[data-theme="sintaks"] .pf-extralist li b{font-weight:600}
.pf[data-theme="sintaks"] .pf-extralist li span{font-family:var(--pf-font-mono);font-size:12px}
.pf[data-theme="sintaks"] .sk-term--contact .sk-term__body{gap:22px}
.pf[data-theme="sintaks"] .sk-term--contact .sk-cmd{margin-bottom:-10px}
.pf[data-theme="sintaks"] .sk-cta{max-width:26ch;font:700 clamp(1.5rem,1.15rem + 1.6vw,2.5rem)/1.15 var(--pf-font-heading);letter-spacing:-.035em}
.pf[data-theme="sintaks"] .pf-form input:not([type=hidden]),.pf[data-theme="sintaks"] .pf-form textarea{border-width:1px;border-radius:8px;background:var(--pf-bg)}
.pf[data-theme="sintaks"] .pf-form label{font:400 13px/1.4 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-contact-links{gap:8px;font:400 14px/1.6 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-contact-links span{min-width:120px}
.pf[data-theme="sintaks"] .pf-loc{max-width:460px;border-radius:12px;background:var(--pf-bg)}
.pf[data-theme="sintaks"] .pf-loc__map{border-radius:8px}
.pf[data-theme="sintaks"] .pf-loc__time,.pf[data-theme="sintaks"] .pf-loc__open{font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-metrics:not(.sk-stats) .pf-metric__value{font-family:var(--pf-font-mono);letter-spacing:-.04em}
.pf[data-theme="sintaks"] .pf-metrics[data-variant="kpi"]:not(.sk-stats) .pf-metric{border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-trend{border-radius:6px;font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-metric__context,.pf[data-theme="sintaks"] .pf-metric__bar{font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] :is(.pf-video,.pf-pdf,.pf-link,.pf-embed__open,.pf-embed iframe){border-radius:14px}
.pf[data-theme="sintaks"] .pf-video{border:1px solid var(--pf-border)}
.pf[data-theme="sintaks"] .pf-video__play>span{border-radius:14px}
.pf[data-theme="sintaks"] .pf-link__site{border-radius:8px}
.pf[data-theme="sintaks"] :is(.pf-link__domain,.pf-pdf__text>span,.pf-embed__note,.pf-embed__action,.pf-video__meta){font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-embed__media{background:radial-gradient(color-mix(in oklab,var(--pf-accent) 30%,transparent) 1px,transparent 1.4px) 0 0/16px 16px,var(--pf-bg)}
.pf[data-theme="sintaks"] .pf-embed__provider{font-family:var(--pf-font-mono)}
.pf[data-theme="sintaks"] :is(.pf-gallery img,.pf-zoom){border-radius:10px}
.pf[data-theme="sintaks"] .pf-workpage{max-width:880px;gap:36px;padding-block:8px 16px}
.pf[data-theme="sintaks"] .pf-workpage__back{border-radius:8px;background:var(--pf-surface);font:400 13px/1 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-workpage__back:hover{border-color:var(--pf-accent-text)}
.pf[data-theme="sintaks"] .pf-detail__head{gap:16px;padding-bottom:28px;border-bottom:1px solid var(--pf-border)}
.pf[data-theme="sintaks"] .pf-detail__title{font-size:clamp(2.25rem,1.5rem + 3vw,3.75rem);font-weight:700;line-height:1.04;letter-spacing:-.045em}
.pf[data-theme="sintaks"] .pf-detail__summary{font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.55}
.pf[data-theme="sintaks"] .pf-detail__meta{font:400 13px/1.5 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-detail__meta b{font-weight:700}
.pf[data-theme="sintaks"] .pf-detail__hero{border:1px solid var(--pf-border);border-radius:14px}
.pf[data-theme="sintaks"] .pf-workpage .pf-prose{max-width:72ch;font-size:17px;line-height:1.75}
.pf[data-theme="sintaks"] .pf-workpage .pf-prose :is(h2,h3,h4){margin-top:1.8em;font-family:var(--pf-font-mono);font-size:19px;letter-spacing:-.02em}
.pf[data-theme="sintaks"] .pf-workpage .pf-prose>:is(h2,h3,h4):first-child{margin-top:0}
.pf[data-theme="sintaks"] .pf-workpage .pf-prose h2::before{content:"## ";content:"## "/"";color:var(--pf-accent-text);font-weight:400}
.pf[data-theme="sintaks"] .pf-workpage .pf-prose h3::before{content:"### ";content:"### "/"";color:var(--pf-accent-text);font-weight:400}
.pf[data-theme="sintaks"] .pf-workpage .pf-btns{padding-top:4px}
.pf[data-theme="sintaks"] .pf-workpage__more{gap:16px}
.pf[data-theme="sintaks"] .pf-workpage__step{padding:18px 22px;border-radius:14px;background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-workpage__step:hover{border-color:var(--pf-accent-text);background:var(--pf-surface)}
.pf[data-theme="sintaks"] .pf-workpage__step span{font:400 12px/1.4 var(--pf-font-mono);letter-spacing:0;text-transform:none}
.pf[data-theme="sintaks"] .pf-workpage__step b{color:var(--pf-accent-text);font-family:var(--pf-font-mono);font-size:16px;letter-spacing:-.015em}
.pf[data-theme="sintaks"] .pf-foot{width:calc(100% - 2 * var(--pf-gutter));max-width:var(--pf-max-width);padding:24px 0 40px;border-top:1px solid var(--pf-border);font:400 12px/1.5 var(--pf-font-mono)}
.pf[data-theme="sintaks"] .pf-badge{border-radius:8px;background:var(--pf-surface)}
@media (max-width:960px){.pf[data-theme="sintaks"] .sk-hero{grid-template-columns:minmax(0,1fr) minmax(0,220px)}.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,220px) minmax(0,1fr)}.pf[data-theme="sintaks"] .sk-repos[data-variant="grid-3"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.pf[data-theme="sintaks"]{--sk-pad:20px;--sk-gap:64px}.pf[data-theme="sintaks"] .sk-top{padding-block:8px}.pf[data-theme="sintaks"] .sk-main{padding-top:16px}.pf[data-theme="sintaks"] .sk-hero,.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"]{grid-template-columns:minmax(0,1fr);gap:16px}.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"] .sk-photo,.pf[data-theme="sintaks"] .sk-hero[data-variant="photo-left"] .sk-term{grid-column:1;grid-row:auto}.pf[data-theme="sintaks"] .sk-photo{width:min(100%,200px)}.pf[data-theme="sintaks"] .sk-win__bar span{padding-inline-end:0;text-align:start}.pf[data-theme="sintaks"] .sk-term__body{gap:12px}.pf[data-theme="sintaks"] .sk-cmd{font-size:13px}.pf[data-theme="sintaks"] .sk-name,.pf[data-theme="sintaks"] .sk-hero[data-variant="big-name"] .sk-name{font-size:max(1.5rem,min(3.25rem,calc(100cqi / (var(--name-word) * .6))))}.pf[data-theme="sintaks"] .sk-greeting{font-size:14px}.pf[data-theme="sintaks"] .sk-term .pf-btns{width:100%}.pf[data-theme="sintaks"] .sk-term .pf-btn{flex:1 1 auto}.pf[data-theme="sintaks"] .sk-stats.pf-metrics{grid-template-columns:minmax(0,1fr);grid-auto-flow:row}.pf[data-theme="sintaks"] .sk-stats .pf-metric{flex-direction:row;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 18px}.pf[data-theme="sintaks"] .sk-stats .pf-metric__row{order:0;flex:none}.pf[data-theme="sintaks"] .sk-stats .pf-metric__value{font-size:1.375rem}.pf[data-theme="sintaks"] .sk-section{gap:22px}.pf[data-theme="sintaks"] .sk-repos,.pf[data-theme="sintaks"] .sk-repos[data-variant="grid-3"]{grid-template-columns:minmax(0,1fr);gap:14px}.pf[data-theme="sintaks"] .sk-repo__body{padding:18px}.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo{flex-direction:column}.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo__cover{order:0;width:auto;align-self:stretch;margin:16px 16px 0}.pf[data-theme="sintaks"] .sk-repos[data-variant="list"] .sk-repo__body{padding:16px 18px 18px}.pf[data-theme="sintaks"] .sk-log>.sk-commit{padding-inline-start:28px}.pf[data-theme="sintaks"] .sk-log[data-variant="compact"]>.sk-commit{padding-inline-start:0}.pf[data-theme="sintaks"] .sk-commit__when{flex-basis:100%;margin-inline-start:0}.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service{grid-template-columns:minmax(0,1fr)}.pf[data-theme="sintaks"] .sk-services[data-variant="list"] .pf-service>.pf-service__cta{grid-column:1;grid-row:auto}.pf[data-theme="sintaks"] .pf-service,.pf[data-theme="sintaks"] .pf-quote,.pf[data-theme="sintaks"] .sk-extra{padding:20px}.pf[data-theme="sintaks"] .pf-logos{grid-template-columns:repeat(2,minmax(0,1fr))}.pf[data-theme="sintaks"] .pf-logo{min-height:72px;padding:12px}.pf[data-theme="sintaks"] .pf-contact-links span{min-width:96px}}
@media (prefers-reduced-motion:reduce){.pf[data-theme="sintaks"] .sk-caret{animation:none}.pf[data-theme="sintaks"] .sk-repo:hover{translate:none}}
@media print{.pf[data-theme="sintaks"]::before,.pf[data-theme="sintaks"] .sk-caret{display:none}.pf[data-theme="sintaks"] .sk-win{box-shadow:none}}
`;
