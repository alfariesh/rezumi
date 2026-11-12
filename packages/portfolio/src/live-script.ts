/**
 * What a published page adds to the page script (`02-teknis.md` sections 9 and 10), inline and allowed by its hash like
 * the rest. The editor's preview never ships it, so a preview counts nothing and sends nothing.
 *
 * - counts clicks on `[data-pf-event]` and works opened (`[data-pf-work]`) with `sendBeacon`: no cookie, nothing kept in
 *   the browser (`JSON.stringify` leaves out an absent id);
 * - a page the browser prerendered counts nothing until the visitor actually opens it: then it sends one `view` (the
 *   server never counted the prerender request as a visit) and the work its address opens, if any. A normal load sends
 *   no `view`: the server counts that visit itself;
 * - loads Turnstile only when the form comes near the screen or takes focus, so a visitor who never reaches it never
 *   asks Cloudflare's challenge service for anything;
 * - sends the form in place, says how it went, and puts a service's name in the message when its order button is used.
 *
 * Keep it free of backticks and `${`: it is a template literal here and inline in the page. It reads the form's address
 * as `form.action`, so no field of the form may be named `action`.
 */
export const PORTFOLIO_LIVE_SCRIPT = `(()=>{const d=document,R=d.querySelector("[data-pf-live]");if(!R)return;const U=R.dataset.pfLive,B=(k,i)=>{try{navigator.sendBeacon(U,JSON.stringify({kind:k,id:i}))}catch{}},W=()=>{let t=null;try{t=location.hash.length>1?d.getElementById(decodeURIComponent(location.hash.slice(1))):null}catch{}if(t?.dataset.pfWork)B("work",t.dataset.pfWork)};addEventListener("hashchange",W);d.prerendering?d.addEventListener("prerenderingchange",()=>{B("view");W()}):W();const F=d.querySelector("form[data-pf-contact]"),M=F?.querySelector("textarea"),H=F?.querySelector("[name=serviceId]");d.addEventListener("click",e=>{const t=e.target,a=t.closest?.("[data-pf-event]");if(a)B(a.dataset.pfEvent);const s=t.closest?.("[data-pf-inquiry]");if(s&&M&&H){M.value=s.dataset.pfInquiry;H.value=s.dataset.pfService||""}});if(!F)return;const S=F.querySelector("[data-pf-turnstile]"),N=F.querySelector("[role=status]"),Y=F.querySelector("button"),K=S?.dataset.sitekey,D=F.dataset;let w,O=0;const L=()=>{if(O||!K)return;O=1;const s=d.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.onload=()=>{w=turnstile.render(S,{sitekey:K,size:"flexible",theme:d.documentElement.dataset.pfScheme||"auto"})};d.head.append(s)};"IntersectionObserver"in window?new IntersectionObserver((e,o)=>{if(e.some(x=>x.isIntersecting)){o.disconnect();L()}},{rootMargin:"400px"}).observe(F):L();F.addEventListener("focusin",L);F.addEventListener("submit",async e=>{e.preventDefault();Y.disabled=1;N.textContent=D.sending;let c="failed";try{const j=await(await fetch(F.action,{method:"POST",body:new FormData(F),headers:{accept:"application/json"}})).json();c=j.ok?"sent":j.code||c}catch{}N.textContent=D[c]||D.failed;if(c==="sent")F.reset();else Y.disabled=0;if(w!==undefined)turnstile.reset(w)})})();`;
