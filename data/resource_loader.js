/* 图片加载顺序：本地文件 → 离线内嵌图 → 已核对的公开备用地址。 */
const RESOURCE_IMAGE_ATTEMPTS = new WeakMap();
function localEchoIcon(id, fallback=""){
  return typeof ECHO_PORTRAITS!=="undefined" && ECHO_PORTRAITS[String(id)] || fallback;
}
function resourceImageError(img){
  const src=img.getAttribute("src")||"",key=img.dataset.resourceKey||src;
  img.dataset.resourceKey=key;
  let attempts=RESOURCE_IMAGE_ATTEMPTS.get(img);
  if(!attempts){attempts=new Set();RESOURCE_IMAGE_ATTEMPTS.set(img,attempts);}
  attempts.add(src);
  const local=key.replace(/^.*?(?=assets\/)/,"").split("?",1)[0];
  const candidates=[];
  const char=local.match(/^assets\/char\/(\d+)\.webp$/),weapon=local.match(/^assets\/weapon\/(\d+)\.webp$/);
  if(char && typeof CHARACTER_PORTRAITS!=="undefined") candidates.push(CHARACTER_PORTRAITS[char[1]]);
  if(weapon && typeof WEAPON_PORTRAITS!=="undefined") candidates.push(WEAPON_PORTRAITS[weapon[1]]);
  if(typeof RESOURCE_ASSETS!=="undefined") candidates.push(...(RESOURCE_ASSETS[local]?.sources||[]));
  // 在线更新产生的新图片尚未进入本地索引时，按相同游戏路径寻找备用。
  if(key.startsWith("https://static.nanoka.cc/assets/ww/")){
    const path=key.slice("https://static.nanoka.cc/assets/ww/".length).replace(/\.webp(?:\?.*)?$/,""),stem=path.split("/").pop();
    const kind=path.includes("IconRole")?"avatar":path.includes("IconWeapon")?"weapon":path.includes("Monster")||path.includes("Boss")?"monster":"icon";
    candidates.push("https://wutherin.cn-nb1.rains3.com/UI/"+path+".webp","https://mc.appfeng.com/ui/"+kind+"/"+stem+".png","https://api-v2.encore.moe/resource/Data/Game/Aki/UI/"+path+".webp");
  }
  const next=candidates.find(url=>url && !attempts.has(url));
  if(!next)return false;
  attempts.add(next);img.src=next;return true;
}
