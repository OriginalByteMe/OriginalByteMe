import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
const BASE="https://cdn.jsdelivr.net/gh/OriginalByteMe/OriginalByteMe@main/noah-portfolio/public";
const tmp=mkdtempSync(join(tmpdir(),"du-"));
// Noah Icon FA.svg -> svg data uri
execFileSync("curl",["-sSL","--max-time","30","-o",join(tmp,"icon.svg"),BASE+"/"+encodeURI("Noah Icon FA.svg")]);
const iconB64=readFileSync(join(tmp,"icon.svg")).toString("base64");
const iconUri=`data:image/svg+xml;base64,${iconB64}`;
// hero.png -> downscaled jpeg data uri
execFileSync("curl",["-sSL","--max-time","30","-o",join(tmp,"hero.png"),BASE+"/hero.png"]);
const heroSrc=`data:application/octet-stream;base64,${readFileSync(join(tmp,"hero.png")).toString("base64")}`;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const p=await b.newPage();
const heroUri=await p.evaluate(async(src)=>await new Promise(res=>{const im=new Image();im.onload=()=>{const s=Math.min(1,720/Math.max(im.naturalWidth,im.naturalHeight));const w=Math.round(im.naturalWidth*s),h=Math.round(im.naturalHeight*s);const cv=document.createElement("canvas");cv.width=w;cv.height=h;const cx=cv.getContext("2d");cx.drawImage(im,0,0,w,h);res(cv.toDataURL("image/jpeg",0.82))};im.onerror=()=>res(null);im.src=src;}),heroSrc);
await b.close();
writeFileSync(".design-sync/support/hardcoded-assets.json",JSON.stringify({noahIcon:iconUri,hero:heroUri}));
console.log("icon svg bytes:",iconUri.length,"| hero jpeg bytes:",heroUri.length);
