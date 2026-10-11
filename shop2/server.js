// متجر بدون أي مكتبات خارجية — Node 18+ فقط
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,"data"),FILE=path.join(DIR,"db.json");
const PUBLIC=path.join(__dirname,"public");
const PASS=process.env.ADMIN_PASSWORD;
if(!PASS||PASS.length<8){console.error("ضروري تعيّن ADMIN_PASSWORD (8 خانات على الأقل)");process.exit(1)}
const SECRET=process.env.SESSION_SECRET||crypto.createHash("sha256").update("s:"+PASS).digest("hex");
const GOV={"عمّان":2,"الزرقاء":3,"إربد":3,"البلقاء":3,"مادبا":3,"جرش":3.5,"عجلون":3.5,"المفرق":4,"الكرك":4,"الطفيلة":5,"معان":5,"العقبة":5};
const ST=["new","processing","shipped","delivered","cancelled"];
fs.mkdirSync(DIR,{recursive:true});
let D={products:[],orders:[],delivery:{...GOV},settings:{}};
try{D={...D,...JSON.parse(fs.readFileSync(FILE,"utf8"))}}catch(e){}
const persist=()=>{const t=FILE+".tmp";fs.writeFileSync(t,JSON.stringify(D));fs.renameSync(t,FILE)};
const uid=()=>crypto.randomBytes(8).toString("hex");
const sign=v=>crypto.createHmac("sha256",SECRET).update(v).digest("hex");
const mkTok=()=>{const e=Date.now()+7*864e5;return e+"."+sign(""+e)};
const okTok=t=>{if(!t)return false;const[e,s]=t.split(".");return s&&+e>Date.now()&&s.length===64&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sign(e)))};
const cookie=r=>Object.fromEntries((r.headers.cookie||"").split(";").map(x=>x.trim().split("=")).filter(x=>x[0]));
const isAdmin=r=>okTok(cookie(r).adm);
const hits={};const limit=(k,max,ms)=>{const n=Date.now();hits[k]=(hits[k]||[]).filter(t=>n-t<ms);if(hits[k].length>=max)return false;hits[k].push(n);return true};
const send=(res,c,o,h={})=>{res.writeHead(c,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...h});res.end(JSON.stringify(o))};
const body=r=>new Promise((ok,no)=>{let b="",n=0;r.on("data",c=>{n+=c.length;if(n>3e6){no(new Error("big"));r.destroy()}else b+=c});r.on("end",()=>{try{ok(JSON.parse(b||"{}"))}catch(e){no(e)}})});
const str=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const num=v=>Number.isFinite(+v)&&+v>=0&&+v<100000?+(+v).toFixed(2):null;
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");

function cleanStock(v){
  if(v===null||v===undefined||v==="")return null; // null = unlimited / not tracked
  const n=+v;
  return Number.isFinite(n)&&n>=0&&n<1000000?Math.floor(n):null;
}
function cleanProduct(b,old){
  const name=str(b.name,120),price=num(b.price);if(!name||price===null)return null;
  return{name,price,stock:cleanStock(b.stock),cat:str(b.cat,60),ts:old?.ts||Date.now(),
    imgs:(Array.isArray(b.imgs)?b.imgs:[]).filter(s=>typeof s==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(s)&&s.length<400000).slice(0,3),
    addons:(Array.isArray(b.addons)?b.addons:[]).slice(0,20).map(a=>({name:str(a.name,80),price:num(a.price)||0})).filter(a=>a.name)};
}
async function api(req,res,url){
  const m=req.method,p=url.pathname,ip=req.socket.remoteAddress+(req.headers["x-forwarded-for"]||"");
  if(m==="GET"&&p==="/api/store")return send(res,200,{products:D.products,delivery:{...GOV,...D.delivery},settings:D.settings});
  if(m==="GET"&&p==="/api/me")return send(res,200,{admin:isAdmin(req)});
  if(m==="POST"&&p==="/api/login"){
    if(!limit("l"+ip,8,9e5))return send(res,429,{error:"محاولات كثيرة، جرّب بعد شوي"});
    const b=await body(req),a=Buffer.from(sha(str(b.password,200))),z=Buffer.from(sha(PASS));
    if(!crypto.timingSafeEqual(a,z))return send(res,401,{error:"كلمة السر غلط"});
    const sec=req.headers["x-forwarded-proto"]==="https"?"; Secure":"";
    return send(res,200,{ok:true},{"Set-Cookie":`adm=${mkTok()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${sec}`});
  }
  if(m==="POST"&&p==="/api/logout")return send(res,200,{ok:true},{"Set-Cookie":"adm=; HttpOnly; Path=/; Max-Age=0"});
  if(m==="POST"&&p==="/api/orders"){ // طلب من العميل: الأسعار بتنحسب هون وما بنثق بالمتصفح
    if(!limit("o"+ip,15,36e5))return send(res,429,{error:"طلبات كثيرة"});
    const b=await body(req),name=str(b.name,80),phone=str(b.phone,20).replace(/\s/g,""),addr=str(b.addr,300),gov=str(b.gov,30);
    if(name.length<2||!/^(\+?962|0)?7\d{8}$/.test(phone)||!addr||!(gov in GOV))return send(res,400,{error:"بيانات ناقصة أو غير صحيحة"});
    if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)return send(res,400,{error:"السلة فارغة"});
    const items=[];let sub=0;const needed={};
    for(const it of b.items){
      const pr=D.products.find(x=>x.id===it.pid),qty=Math.floor(+it.qty);if(!pr||!(qty>=1&&qty<=99))return send(res,400,{error:"منتج غير متوفر"});
      const ads=(Array.isArray(it.addons)?it.addons:[]).map(n=>pr.addons.find(a=>a.name===n)).filter(Boolean);
      const unit=pr.price+ads.reduce((s,a)=>s+a.price,0);sub+=unit*qty;items.push({pid:pr.id,name:pr.name,addons:ads.map(a=>a.name),unit:+unit.toFixed(2),qty});
      needed[pr.id]=(needed[pr.id]||0)+qty;
    }
    for(const pid in needed){
      const pr=D.products.find(x=>x.id===pid);
      if(pr&&pr.stock!==null&&pr.stock!==undefined&&needed[pid]>pr.stock)
        return send(res,400,{error:`الكمية المتوفرة من "${pr.name}" ما بتكفي (متبقي ${pr.stock})`});
    }
    const S=D.settings,disc=S.code&&str(b.code,40).toLowerCase()===S.code.toLowerCase()?+(sub*Math.min(100,+S.pct||0)/100).toFixed(2):0;
    const d=+({...GOV,...D.delivery}[gov])||0,o={id:uid(),ts:Date.now(),name,phone,gov,addr,items,sub:+sub.toFixed(2),discount:disc,delivery:d,total:+(sub-disc+d).toFixed(2),status:"new"};
    for(const pid in needed){
      const pr=D.products.find(x=>x.id===pid);
      if(pr&&pr.stock!==null&&pr.stock!==undefined)pr.stock=Math.max(0,pr.stock-needed[pid]);
    }
    D.orders.push(o);persist();return send(res,200,{ok:true,total:o.total});
  }
  if(!isAdmin(req))return send(res,401,{error:"غير مصرّح"});
  if(m==="GET"&&p==="/api/orders")return send(res,200,[...D.orders].sort((a,b)=>b.ts-a.ts));
  if(m==="PUT"&&p==="/api/delivery"){const b=await body(req),o={};for(const g in GOV)o[g]=num(b[g])??GOV[g];D.delivery=o;persist();return send(res,200,{ok:true})}
  if(m==="PUT"&&p==="/api/settings"){
    const b=await body(req);
    const cats=(Array.isArray(b.cats)?b.cats:[]).map(c=>str(c,60)).filter(Boolean).slice(0,40);
    const catImages={};
    if(b.catImages&&typeof b.catImages==="object"){
      for(const c of cats){
        const v=b.catImages[c];
        if(typeof v!=="string")continue;
        if(/^data:image\/(jpeg|png|webp);base64,/.test(v)&&v.length<400000)catImages[c]=v;
        else if(/^\/categories\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(v))catImages[c]=v;
      }
    }
    D.settings={name:str(b.name,60)||"متجري",tag:str(b.tag,120),promo:str(b.promo,120),code:str(b.code,40),pct:Math.min(100,+b.pct||0),phone:str(b.phone,20),fb:str(b.fb,300),ig:str(b.ig,300),tiktok:str(b.tiktok,300),catImages,cats};
    persist();return send(res,200,{ok:true});
  }
  let r=p.match(/^\/api\/(products|orders)\/([a-z0-9]+)$/);
  if(r){const[,k,id]=r,i=D[k].findIndex(x=>x.id===id);
    if(m==="DELETE"){if(i>=0){D[k].splice(i,1);persist()}return send(res,200,{ok:true})}
    if(m==="PUT"&&k==="products"){const b=await body(req),n=cleanProduct(b,D.products[i]);if(!n)return send(res,400,{error:"الاسم والسعر مطلوبين"});i>=0?D.products[i]={id,...n}:D.products.push({id,...n});persist();return send(res,200,{ok:true})}
    if(m==="PATCH"&&k==="orders"&&i>=0){
      const b=await body(req);if(!ST.includes(b.status))return send(res,400,{error:"حالة غير صحيحة"});
      const o=D.orders[i],wasCancelled=o.status==="cancelled",nowCancelled=b.status==="cancelled";
      if(nowCancelled&&!wasCancelled){ // إرجاع الكمية للمخزون عند الإلغاء
        for(const it of o.items){const pr=D.products.find(x=>x.id===it.pid);if(pr&&pr.stock!==null&&pr.stock!==undefined)pr.stock+=it.qty}
      }else if(!nowCancelled&&wasCancelled){ // لو رجّع الطلب من إلغاء لحالة تانية، نخصم الكمية من جديد
        for(const it of o.items){const pr=D.products.find(x=>x.id===it.pid);if(pr&&pr.stock!==null&&pr.stock!==undefined)pr.stock=Math.max(0,pr.stock-it.qty)}
      }
      o.status=b.status;persist();return send(res,200,{ok:true});
    }
  }
  send(res,404,{error:"غير موجود"});
}

const MIME={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon",".json":"application/json"};
function serveStatic(req,res,pathname){
  let rel=decodeURIComponent(pathname);
  if(rel==="/")rel="/index.html";
  if(rel.endsWith("/"))rel+="index.html";
  const fp=path.normalize(path.join(PUBLIC,rel));
  if(!fp.startsWith(PUBLIC))return send(res,400,{error:"مسار غير صالح"});
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});return res.end("<h1>404</h1><p>الصفحة غير موجودة. <a href=\"/\">الرئيسية</a></p>")}
    const ext=path.extname(fp).toLowerCase();
    res.writeHead(200,{"Content-Type":MIME[ext]||"application/octet-stream","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY",...(ext===".html"?{"Cache-Control":"no-store"}:{"Cache-Control":"public, max-age=3600"})});
    res.end(data);
  });
}
http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://x");
  try{
    if(url.pathname.startsWith("/api/"))return await api(req,res,url);
    serveStatic(req,res,url.pathname);
  }catch(e){send(res,400,{error:"طلب غير صالح"})}
}).listen(PORT,()=>console.log("المتجر شغّال على المنفذ "+PORT));
