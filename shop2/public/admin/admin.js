async function requireAdmin(){
  let me;try{me=await api("GET","/api/me")}catch(e){me={admin:false}}
  if(!me.admin){location.href="login.html";return false}
  return true;
}
function adminChrome(active){
  const tabs=[["products.html","📦 المنتجات"],["orders.html","🧾 الطلبات"],["delivery.html","🚚 أسعار التوصيل"],["settings.html","⚙ إعدادات المتجر"]];
  $("#hdr").classList.add("admin-hdr");
  $("#hdr").innerHTML=`<a href="../index.html" class="admin-hdr-logo"><img class="logo" src="../logo.png" alt="" style="margin:0"></a>`;
  const side=document.getElementById("adminSide");
  if(side)side.innerHTML=tabs.map(([href,label])=>`<a href="${href}" class="${active===href?"on":""}">${label}</a>`).join("")
    +`<hr class="admin-side-sep">`
    +`<a href="../index.html">🔗 الموقع</a>`
    +`<a id="lo">🚪 خروج</a>`;
  $("#ftr").innerHTML="";
  $("#lo").onclick=async()=>{try{await api("POST","/api/logout")}catch(e){}location.href="login.html"};
}
