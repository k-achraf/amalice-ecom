// Critical CSS, inlined into every page: one document, no stylesheet request, no web fonts (system
// stack incl. Arabic), no layout shift (every image has a reserved aspect-ratio box).
export const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,Arial,sans-serif;color:#0e2928;background:#fff;-webkit-tap-highlight-color:transparent}
img{display:block;max-width:100%}h1,h2,h3,p,ul,ol,dl,dd,blockquote,figure,fieldset{margin:0}ul,ol{padding:0;list-style:none}fieldset{border:0;padding:0;min-width:0}
button,input,select,textarea{font:inherit;color:inherit}[hidden]{display:none!important}svg{width:1em;height:1em;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wrap{max-width:560px;margin:0 auto}
.urg{position:sticky;top:0;z-index:6;background:var(--a);color:#fff;text-align:center;font-weight:600;font-size:13px;padding:9px 14px}
.top{display:grid;gap:14px;padding:12px 14px 20px;background:linear-gradient(180deg,var(--s),#fff 55%)}
.gal{position:relative;min-width:0}
.slides{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:14px;border:1px solid #e4e8e5;background:#fff;scrollbar-width:none;overscroll-behavior-x:contain}
.slides::-webkit-scrollbar{display:none}
.slide{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:1/1;background:#f1f4f2}
.slide img{width:100%;height:100%;object-fit:cover}
.badge{position:absolute;top:10px;inset-inline-start:10px;display:inline-flex;align-items:center;gap:5px;background:var(--a);color:#fff;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px}
.cnt{position:absolute;bottom:10px;inset-inline-end:10px;background:rgba(14,41,40,.65);color:#fff;font-size:11px;padding:2px 9px;border-radius:999px;direction:ltr}
.dots{display:flex;justify-content:center;gap:6px;margin-top:9px}
.dots i{width:7px;height:7px;border-radius:50%;background:#cfd6d2;transition:width .2s,background .2s}
.dots i.on{background:var(--a);width:18px;border-radius:4px}
.buy{display:grid;gap:12px;min-width:0;align-content:start}
h1{font-size:22px;line-height:1.3;letter-spacing:-.01em}
.sub{color:#5b6f6c;font-size:14px;margin-top:6px}
.pr{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin-top:8px}
.price{font-size:27px;font-weight:800;color:var(--a);line-height:1.1}
.from{font-size:12px;color:#5b6f6c}
.rt{display:flex;align-items:center;gap:5px;margin-top:6px;font-size:13px;color:#5b6f6c}.rt .st{color:#b8892b;font-size:16px}.rt b{color:#0e2928}
.stock{display:inline-flex;align-items:center;gap:7px;margin-top:8px;font-size:12.5px;font-weight:600;color:#8a3a26;background:#f5e3dd;padding:5px 11px;border-radius:999px}
.stock i{width:7px;height:7px;border-radius:50%;background:#b4533a}
.quick{display:grid;gap:7px;font-size:14px;font-weight:500}
.quick li,.checks li{display:flex;gap:8px;align-items:flex-start}
.quick svg,.checks svg{color:var(--a);margin-top:3px;font-size:17px}
.order{background:#fff;border:1.5px solid var(--a);border-radius:16px;padding:14px;display:grid;gap:11px;box-shadow:0 6px 18px rgba(14,41,40,.08)}
.fh{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fh b{font-size:17px}.fh span{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--a)}
legend{font-size:12px;color:#5b6f6c;padding:0;margin-bottom:7px}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{position:relative}.pill input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}
.pill span{display:flex;align-items:center;min-height:42px;padding:0 14px;border:1.5px solid #d5dcd8;border-radius:11px;font-weight:600;font-size:13.5px;background:#fff}
.pill input:checked+span{border-color:var(--a);background:var(--s);color:var(--a)}
.pill input:disabled+span{opacity:.4;text-decoration:line-through}
.offers{display:grid;gap:9px}
.offer{position:relative;display:flex;align-items:center;gap:11px;border:1.5px solid #d5dcd8;border-radius:13px;padding:12px;min-height:58px;cursor:pointer;background:#fff}
.offer input{position:absolute;opacity:0;pointer-events:none}
.offer .rd{width:20px;height:20px;border-radius:50%;border:2px solid #c3ccc7;flex:none}
.offer:has(input:checked){border-color:var(--a);background:var(--s)}
.offer:has(input:checked) .rd{border-color:var(--a);background:radial-gradient(circle,var(--a) 0 45%,transparent 50%)}
.offer .g{flex:1;min-width:0;display:grid;line-height:1.3}.offer b{font-size:14.5px}.offer small{font-size:12px;color:#5b6f6c}.offer em{font-style:normal;color:var(--a);font-weight:700}
.offer .am{font-weight:800;font-size:15.5px;white-space:nowrap}
.rb{position:absolute;top:-9px;inset-inline-end:10px;background:#b8892b;color:#fff;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:999px}
.bump{display:flex;align-items:center;gap:11px;border:1.5px dashed var(--a);background:var(--s);border-radius:13px;padding:11px;cursor:pointer}
.bump input{width:22px;height:22px;accent-color:var(--a);flex:none;margin:0}.bump img{width:46px;height:46px;border-radius:9px;object-fit:cover;flex:none}
.bump .g{flex:1;min-width:0;display:grid;line-height:1.3;font-size:13px}.bump b{font-size:14px}.bump .am{font-weight:800;white-space:nowrap}
.fl{display:grid;gap:5px}.fl>span{font-size:12.5px;color:#5b6f6c;font-weight:500}
.in{width:100%;height:50px;border:1.5px solid #d5dcd8;border-radius:12px;padding:0 13px;background:#fff;font-size:16px;appearance:none;-webkit-appearance:none}
textarea.in{height:76px;padding:11px 13px;resize:none}
select.in{background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235b6f6c' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat left 13px center;padding-inline-end:13px;padding-inline-start:34px}
.in:focus{outline:0;border-color:var(--a);box-shadow:0 0 0 3px var(--s)}.in:disabled{background:#f3f5f4;opacity:.7}
.fl.er .in{border-color:#b4533a;background:#fdf3f0}.fl .em{display:none;font-size:12px;color:#8a3a26;font-weight:600}.fl.er .em{display:block}
.two{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f1f4f2;border-radius:13px;padding:4px}
.seg label{position:relative;display:block}.seg input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.seg span{display:grid;place-items:center;text-align:center;min-height:46px;border-radius:10px;font-weight:600;font-size:12.5px;color:#5b6f6c;padding:4px;line-height:1.25}
.seg input:checked+span{background:#fff;color:var(--a);box-shadow:0 1px 3px rgba(14,41,40,.18)}.seg input:disabled+span{opacity:.4}
.sum{display:grid;gap:5px;font-size:13px;color:#5b6f6c;padding-top:9px;border-top:1px dashed #cfd6d2}
.sum div{display:flex;justify-content:space-between}.sum .gr{color:#0e2928;font-size:15.5px;font-weight:600;padding-top:3px}.sum .gr b{color:var(--a);font-size:21px;font-weight:800}
.cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:56px;border:0;border-radius:14px;background:var(--a);color:#fff;font-weight:800;font-size:16.5px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.2);padding:0 18px;text-align:center;transition:transform .08s,box-shadow .08s}
.cta:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}.cta[disabled]{opacity:.6;pointer-events:none}.cta svg{font-size:19px}
.fe{display:none;background:#fdf3f0;color:#8a3a26;font-size:13px;font-weight:600;border-radius:10px;padding:10px 12px}.fe.on{display:block}
.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.trust li{display:grid;justify-items:center;gap:4px;text-align:center;font-size:11.5px;line-height:1.3;color:#5b6f6c;font-weight:500}.trust svg{font-size:19px;color:var(--a)}
.safe{text-align:center;color:#5b6f6c;font-size:11.5px}
.soldout{background:#f5e3dd;color:#8a3a26;font-weight:700;text-align:center;border-radius:12px;padding:14px}
.det>*{border-top:1px solid #edf0ee}
.blk{padding:20px 14px}.blk h2{font-size:17px;margin-bottom:11px;display:flex;align-items:center;gap:8px}
.tag{font-size:10px;font-weight:700;background:#f6eedd;color:#6b5220;border-radius:3px;padding:2px 7px}
.txt{font-size:14.5px}.txt p+p,.txt ul,.txt ol{margin-top:9px}.txt ul,.txt ol{padding-inline-start:20px;list-style:disc}.txt ol{list-style:decimal}.txt h2,.txt h3,.txt h4{font-size:15.5px;margin-top:12px}.txt a{color:var(--a)}
.checks{display:grid;gap:10px;font-size:14.5px}
.specs{display:grid;grid-template-columns:max-content 1fr;gap:7px 18px;font-size:14px}.specs dt{color:#5b6f6c}.specs dd{font-weight:500}
.how{display:grid;gap:9px}.how li{display:flex;align-items:center;gap:11px;background:var(--s);border-radius:12px;padding:12px;font-size:14px}
.how b{width:26px;height:26px;border-radius:7px;background:var(--a);color:#fff;display:grid;place-items:center;font-size:13px;flex:none}
.qs{display:grid;gap:10px}.qs blockquote{background:#f3f5f4;border-radius:12px;padding:12px;display:grid;gap:5px;font-size:14px}.qs .st{color:#b8892b;letter-spacing:2px}.qs cite{font-style:normal;font-size:12px;color:#5b6f6c}
.gt{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;padding:16px 14px;background:var(--s);font-weight:600;font-size:13px}.gt span{display:inline-flex;align-items:center;gap:6px}.gt svg{color:var(--a);font-size:17px}
.faq{display:grid;gap:3px;padding:12px 0;border-top:1px solid #edf0ee;font-size:14.5px}.faq:first-of-type{border:0;padding-top:0}.faq span{color:#5b6f6c}
.long{width:100%;height:auto}
.end{display:grid;gap:13px;padding:22px 14px 28px;text-align:center;background:var(--s);font-size:17px;font-weight:700}
.bar{position:fixed;inset:auto 0 0 0;z-index:7;display:flex;align-items:center;gap:12px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #d5dcd8;box-shadow:0 -6px 16px rgba(14,41,40,.12);transform:translateY(0);transition:transform .2s}
.bar .t{display:grid;line-height:1.1}.bar .t small{font-size:11px;color:#5b6f6c}.bar .t b{color:var(--a);font-size:18px;font-weight:800;white-space:nowrap}
.bar .cta{min-height:50px;font-size:15.5px}
body.hasbar{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
.scr{max-width:480px;margin:0 auto;padding:22px 16px 40px;display:grid;gap:16px;text-align:center}
.scr h1{font-size:24px}.scr .big{width:68px;height:68px;border-radius:50%;background:var(--s);color:var(--a);display:grid;place-items:center;margin:8px auto 0;font-size:34px}
.card{background:#fff;border:1.5px solid #d5dcd8;border-radius:16px;padding:16px;display:grid;gap:12px;text-align:start}
.card .kk{font-size:12px;font-weight:700;color:#b8892b;letter-spacing:.04em}
.card img.op{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px;background:#f1f4f2}
.ops{display:flex;align-items:baseline;gap:10px}.ops s{color:#7c8b88;font-size:14px}.ops b{font-size:26px;color:var(--a)}
.ghost{background:none;border:0;color:#5b6f6c;font-weight:600;padding:12px;cursor:pointer;font-size:14px;text-decoration:underline}
.nx{display:grid;gap:9px;text-align:start}.nx li{display:flex;gap:11px;align-items:center;background:var(--s);border-radius:12px;padding:12px;font-size:14px}.nx b{width:26px;height:26px;border-radius:7px;background:var(--a);color:#fff;display:grid;place-items:center;font-size:13px;flex:none}
.oid{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;display:inline-block;background:#f3f5f4;border-radius:7px;padding:2px 9px;font-size:14px}
@media(min-width:900px){
.wrap{max-width:640px}.split .wrap{max-width:1100px}
.split .top{grid-template-columns:1fr 1fr;gap:36px;padding:28px 28px 32px;align-items:start}.split .buy{position:sticky;top:20px}
.top{padding:24px}h1{font-size:26px}
.bar{justify-content:center;gap:20px}.bar .cta{max-width:440px}
.split .blk,.split .gt,.split .end{padding-inline:28px}
}
`
