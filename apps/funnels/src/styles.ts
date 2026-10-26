// Critical CSS, inlined into every page: one document, no stylesheet request, no web fonts (system
// stack incl. Arabic), no layout shift (every image has a reserved aspect-ratio box).
//
// Design system (kept deliberately small and consistent):
//   spacing  4 / 8 / 12 / 16 / 24 / 32   (4px grid; page gutter --g: 16 on phones, 24-32 on wide screens)
//   radius   8 controls + offers, 12 cards, 4 tags
//   type     12 / 13 / 14 / 15 / 16 / 18 / 22-26 · weights 400 / 500 / 700 · line-height 1.6 body, 1.4 headings
//   colour   neutral greys for everything; the funnel's accent only marks the action: the order button,
//            the selected option, ticks and savings. No gradients, no shadows, no decorative fills.
export const CSS = `
:root{--ink:#1c2022;--ink2:#596164;--ink3:#8a9295;--line:#e4e7e8;--line2:#cbd1d3;--soft:#f6f7f7;--bad:#b42318;--g:16px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:var(--ink);font:400 16px/1.7 system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,Arial,sans-serif;-webkit-tap-highlight-color:transparent;font-variant-numeric:tabular-nums}
b,strong{font-weight:700}img{display:block;max-width:100%}h1,h2,h3,p,ul,ol,dl,dd,figure,fieldset,blockquote{margin:0}ul,ol{padding:0;list-style:none}fieldset{border:0;padding:0;min-width:0}
button,input,select,textarea{font:inherit;color:inherit}[hidden]{display:none!important}
svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.cd{display:flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:6px var(--g);background:var(--s);color:var(--at);font-size:15px;font-weight:600}.cd[hidden]{display:none}.cd b{font-variant-numeric:tabular-nums;direction:ltr;font-size:18px;letter-spacing:.04em}
.urg{display:flex;align-items:center;justify-content:center;min-height:40px;padding:6px var(--g);background:var(--a);color:var(--on);font-size:15px;font-weight:700;text-align:center}
.brandbar{display:flex;justify-content:center;padding:12px var(--g) 0}.brandbar img{height:40px;width:auto;max-width:200px;object-fit:contain}
.wrap{max-width:560px;margin:0 auto;padding-bottom:24px}
.top{display:grid}
.gal{position:relative;min-width:0}
.slides{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;background:#fff}
.slides::-webkit-scrollbar{display:none}
.slide{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:1/1}
.slide img{width:100%;height:100%;object-fit:contain;background:#fff}
.dots{position:absolute;inset-inline:0;bottom:12px;display:flex;justify-content:center}
.dots span{display:flex;gap:6px;padding:6px 8px;border-radius:99px;background:rgba(0,0,0,.34)}
.dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55)}
.dots i.on{background:#fff}
.buy{display:grid;gap:24px;padding:16px var(--g) 24px;align-content:start;min-width:0}
h1{font-size:23px;line-height:1.5;font-weight:800}
.sub{margin-top:6px;font-size:16px;color:var(--ink2)}
.rt{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:15px;color:var(--ink2)}.rt svg{width:14px;height:14px;fill:#e0a30c;stroke:none}.rt b{color:var(--ink);font-weight:500}
.price{margin-top:12px;font-size:30px;line-height:1.2;font-weight:800;color:var(--at)}
.stock{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:15px;font-weight:700;color:var(--bad)}.stock i{width:6px;height:6px;border-radius:50%;background:var(--bad)}
.quick{display:grid;gap:10px;font-size:16px}.quick li,.checks li{display:flex;gap:8px;align-items:flex-start}.quick svg,.checks svg{margin-top:4px;color:var(--at)}
.order{display:grid;gap:16px;padding:16px;border:1px solid var(--line2);border-radius:12px}
.fh h2{font-size:21px;line-height:1.4;font-weight:800}.fh p{margin-top:4px;font-size:15px;font-weight:600;color:var(--ink2)}
fieldset{display:grid;gap:8px}legend{padding:0;margin-bottom:8px;font-size:16px;font-weight:700}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{position:relative}.pill input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.pill span{display:flex;align-items:center;min-height:48px;padding:0 20px;border:1px solid var(--line2);border-radius:8px;font-size:16px}
.pill input:checked+span{border-color:var(--a);box-shadow:0 0 0 1px var(--a);background:var(--s);font-weight:500}.pill input:disabled+span{color:var(--ink3);background:var(--soft);text-decoration:line-through}
.offers{display:grid;gap:8px}
.offer,.opt{position:relative;display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;border:1px solid var(--line2);border-radius:8px;background:#fff;cursor:pointer}
.offer input,.opt input{position:absolute;opacity:0;pointer-events:none}
.rd{width:18px;height:18px;flex:none;border:1.5px solid #9ba3a6;border-radius:50%}
.offer:has(input:checked),.opt:has(input:checked){border-color:var(--a);box-shadow:0 0 0 1px var(--a);background:var(--s)}
.offer:has(input:checked) .rd,.opt:has(input:checked) .rd{border-color:var(--a);background:radial-gradient(circle,var(--a) 0 38%,transparent 42%)}
.opt:has(input:disabled){background:var(--soft);color:var(--ink3);cursor:default}.opt:has(input:disabled) .rd{border-color:var(--line2)}
.offer .g{flex:1;min-width:0;display:grid;line-height:1.45}.offer b{font-size:16px;font-weight:700}.offer small{font-size:14px;color:var(--ink2)}.offer em{font-style:normal;font-weight:500;color:var(--at)}
.tg{display:inline-block;margin-inline-start:8px;padding:2px 8px;border-radius:4px;background:var(--a);color:var(--on);font-size:12px;font-weight:700;line-height:18px;vertical-align:1px}
.am{font-size:17px;font-weight:700;white-space:nowrap}
.opt{min-height:56px;font-size:16px}.opts{display:grid;gap:8px}
.bump{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line2);border-radius:8px;background:var(--soft);cursor:pointer}
.bump input{width:20px;height:20px;margin:0;flex:none;accent-color:var(--a)}.bump img{width:56px;height:56px;flex:none;border-radius:6px;object-fit:contain;background:#fff;border:1px solid var(--line)}
.bump .g{flex:1;min-width:0;display:grid;font-size:14px;line-height:1.5;color:var(--ink2)}.bump b{font-size:16px;font-weight:500;color:var(--ink)}
.fl{display:grid;gap:6px}.fl>span:first-child{font-size:16px;font-weight:700}
.in{width:100%;height:54px;padding:0 12px;border:1px solid var(--line2);border-radius:8px;background:#fff;font-size:16px;appearance:none;-webkit-appearance:none}
textarea.in{height:80px;padding:12px;resize:none}
select.in{padding-inline-end:36px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23596164' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat left 12px center}
html[dir=ltr] select.in{background-position:right 12px center}
.in:focus{outline:0;border-color:var(--a);box-shadow:0 0 0 3px var(--s)}.in:disabled{background:var(--soft);color:var(--ink3)}
.fl .em{display:none;font-size:14px;color:var(--bad)}.fl.er .em{display:block}.fl.er .in{border-color:var(--bad)}.fl.er .opt{border-color:var(--bad)}
.cb{position:relative}.cb .in{background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23596164' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat left 12px center;padding-inline-end:36px;text-overflow:ellipsis}.cb .in:disabled{background-color:var(--soft)}
html[dir=ltr] .cb .in{background-position:right 12px center}
.cl{position:absolute;z-index:20;inset-inline:0;top:calc(100% + 4px);max-height:240px;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:4px;border:1px solid var(--line2);border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.cl li{padding:10px 12px;border-radius:6px;font-size:15px;cursor:pointer}.cl li.hv,.cl li:hover{background:var(--soft)}.cl li.on{background:var(--s);font-weight:500}.cl .ce{color:var(--ink3);cursor:default;text-align:center}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sum{display:grid;gap:8px;padding:14px 16px;border-radius:8px;background:var(--soft);font-size:15px;color:var(--ink2)}
.sum div{display:flex;justify-content:space-between;gap:12px}.sum .gr{margin-top:4px;padding-top:12px;border-top:1px solid var(--line);font-size:19px;font-weight:700;color:var(--ink)}
.cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:58px;padding:0 24px;border:0;border-radius:8px;background:var(--a);color:var(--on);font-size:19px;font-weight:800;line-height:1.3;text-align:center;cursor:pointer}
.cta:active{filter:brightness(.92)}.cta[disabled]{opacity:.6;pointer-events:none}
.fe{display:none;padding:12px;border-radius:8px;background:#fef3f2;color:var(--bad);font-size:15px}.fe.on{display:block}
.trust{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 16px;font-size:14px;font-weight:600;color:var(--ink2)}.trust li{display:flex;align-items:center;gap:6px}
.safe{font-size:14px;color:var(--ink3);text-align:center}
.soldout{padding:16px;border-radius:8px;background:var(--soft);font-weight:500;text-align:center}
.det>*{padding:24px var(--g);border-top:1px solid var(--line)}
.det h2{margin-bottom:12px;font-size:21px;line-height:1.4;font-weight:700}
.txt{font-size:16px;line-height:1.85}.txt p+p,.txt ul,.txt ol,.txt p+h3{margin-top:12px}.txt ul,.txt ol{padding-inline-start:20px;list-style:disc}.txt ol{list-style:decimal}.txt h2,.txt h3,.txt h4{margin:16px 0 4px;font-size:16px}.txt a{color:var(--at)}
.checks{display:grid;gap:12px;font-size:16px}
.specs{display:block;font-size:15px}.specs>div{display:grid;grid-template-columns:2fr 3fr;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}.specs>div:first-child{padding-top:0}.specs>div:last-child{border:0;padding-bottom:0}.specs dt{color:var(--ink2)}.specs dd{font-weight:500}
.how{display:grid;gap:12px;font-size:15px}.how li{display:flex;gap:12px}.how b{flex:none;width:24px;height:24px;border:1px solid var(--at);border-radius:50%;color:var(--at);font-size:13px;line-height:22px;text-align:center}
.rv>div{padding:16px 0;border-bottom:1px solid var(--line)}.rv>div:first-child{padding-top:0}.rv>div:last-child{border:0;padding-bottom:0}.rv .st{color:#e0a30c;font-size:14px;letter-spacing:1px}.rv p{margin-top:4px;font-size:16px}.rv cite{display:block;margin-top:4px;font-size:14px;font-style:normal;color:var(--ink2)}
.gt{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;font-size:13px;color:var(--ink2)}.gt span{display:grid;justify-items:center;gap:8px}.gt svg{width:20px;height:20px;color:var(--ink2)}
details{border-bottom:1px solid var(--line)}details:last-of-type{border:0}
summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;font-size:17px;font-weight:700;cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}
summary::after{content:"";width:16px;height:16px;flex:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23596164' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/contain no-repeat;transition:transform .15s}
details[open] summary::after{transform:rotate(180deg)}details p{padding-bottom:16px;font-size:16px;color:var(--ink2)}
.det>.faqs{padding-bottom:8px}
.long{width:100%;height:auto;padding:0!important;border-top:1px solid var(--line)}
body.hasbar .wrap{padding-bottom:calc(72px + env(safe-area-inset-bottom))}
.bar{position:fixed;inset:auto 0 0 0;z-index:7;background:#fff;border-top:1px solid var(--line2);padding:8px var(--g) calc(8px + env(safe-area-inset-bottom))}
.bar{transition:transform .25s ease}.bar.off{transform:translateY(100%);pointer-events:none}
.bi .cta{position:relative;overflow:hidden;animation:cta-pulse 2s ease-in-out infinite}
.bi .cta::after{content:"";position:absolute;inset-block:0;inset-inline-start:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:cta-shine 3.2s ease-in-out infinite}
@keyframes cta-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 color-mix(in srgb,var(--a) 45%,transparent)}50%{transform:scale(1.02);box-shadow:0 0 0 6px transparent}}
@keyframes cta-shine{0%,55%{inset-inline-start:-60%}100%{inset-inline-start:130%}}
@media(prefers-reduced-motion:reduce){.bi .cta,.bi .cta::after{animation:none}}
.bi{display:flex;align-items:center;gap:12px;max-width:560px;margin:0 auto}
.bi .t{display:grid;line-height:1.25}.bi .t small{font-size:12px;color:var(--ink2)}.bi .t b{font-size:16px;font-weight:700;white-space:nowrap}
.bi .cta{flex:1;min-height:44px;padding:0 16px;font-size:16px}
.scr{max-width:480px;margin:0 auto;padding:32px var(--g) 40px;display:grid;gap:24px}
.scr h1{font-size:25px;line-height:1.4}.scr .lead{margin-top:8px;font-size:17px;color:var(--ink2)}
.ok{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--s);color:var(--at)}.ok svg{width:28px;height:28px;stroke-width:2}
.card{display:grid;gap:12px;padding:16px;border:1px solid var(--line2);border-radius:12px}
.card .kk{font-size:13px;font-weight:700;color:var(--at)}
.card img.op{width:100%;aspect-ratio:1/1;border-radius:8px;object-fit:contain;background:#fff;border:1px solid var(--line)}
.card .nm{font-size:18px;font-weight:700}
.ops{display:flex;align-items:baseline;gap:12px}.ops s{font-size:15px;color:var(--ink3)}.ops b{font-size:22px;font-weight:700}
.note{font-size:15px;color:var(--ink2)}
.ghost{padding:14px;border:0;background:none;color:var(--ink2);font-size:16px;text-decoration:underline;cursor:pointer}
.nx{display:grid;gap:12px;font-size:16px}.nx li{display:flex;gap:12px}.nx b{flex:none;width:24px;height:24px;border:1px solid var(--at);border-radius:50%;color:var(--at);font-size:13px;line-height:22px;text-align:center}
.oid{display:inline-block;padding:0 8px;border-radius:4px;background:var(--soft);font:500 14px/24px ui-monospace,Menlo,Consolas,monospace;direction:ltr}
.t-compact .slide{aspect-ratio:4/3}.t-compact .buy{gap:12px;padding-top:12px}.t-compact h1{font-size:21px}.t-compact .price{margin-top:8px;font-size:26px}.t-compact .order{padding:12px;gap:12px}.t-compact .det>*{padding:16px var(--g)}
.t-bold .slide{aspect-ratio:4/5}.t-bold .buy{text-align:center}.t-bold h1{font-size:24px;line-height:1.35}.t-bold .price{font-size:30px;color:var(--at)}.t-bold .stock{justify-content:center}.t-bold .rt{justify-content:center}.t-bold .quick{text-align:start}.t-bold .order{border:2px solid var(--a);background:var(--s);text-align:start}.t-bold .cta{min-height:58px;font-size:18px}.t-bold .det h2{color:var(--at)}.t-bold .urg{min-height:44px;font-size:14px;font-weight:700}
.t-side-by-side .order{background:var(--soft);border-color:var(--line)}.t-side-by-side .det h2{padding-inline-start:12px;border-inline-start:3px solid var(--a)}
.t-image-page .slide{aspect-ratio:1/1}.t-image-page .det>*:not(.long){padding-block:16px}
@media(min-width:700px){:root{--g:24px}h1{font-size:22px}}
@media(min-width:900px){
.wrap{max-width:560px}.split .wrap{max-width:1080px}
.split{--g:32px}
.top{padding-block:32px}.gal{border-radius:12px;overflow:hidden;border:1px solid var(--line)}.buy{padding:0 var(--g)}
.split .det{max-width:720px;margin-inline:auto}
.split .top{grid-template-columns:1fr 1fr;gap:16px 32px;align-items:start;padding-inline:var(--g)}.split .buy{position:sticky;top:24px;padding:0}
body:not(.split) .top{padding-inline:var(--g)}body:not(.split) .buy{padding:24px 0 0}
h1{font-size:24px}
}
`
