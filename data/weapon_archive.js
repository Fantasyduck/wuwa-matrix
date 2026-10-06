/* Fixed public weapon descriptions, base stats and refinements. Read-only. */
(()=>{
 let current=null,rank=1,level='90';
 const body=document.getElementById('libraryDialogBody');
 const value=row=>row.IsRatio||row.IsPercent?(Number(row.Value)*100).toFixed(1).replace(/\.0$/,'')+'%':fmt(Math.round(Number(row.Value)));
 window.renderWeaponArchive=(item,reset=true)=>{
  if(reset){current=item;rank=1;level=String(WEAPON_DETAILS[item.id]?.maxLevel||90);}
  const d=WEAPON_DETAILS[item.id],effect=d?.refinements?.find(r=>r.rank===rank),stats=d?.stats?.[level]||[];
  body.innerHTML=`<div class="archive-detail-art"><img src="assets/weapon/${esc(item.id)}.webp" alt="${esc(item.name)}"><span>${esc(item.type)} · ${d?.skin?'投影外观':item.rank+' 星'}</span></div><div class="archive-detail-copy"><span class="page-eyebrow">WEAPON / 武器档案</span><h2 id="libraryDialogTitle">${esc(item.name)}</h2><p class="archive-detail-stars">${'★'.repeat(item.rank||0)}</p><p class="weapon-lore">${esc(d?.desc||'暂无简介').replace(/\n/g,'<br>')}</p>${d?.maxLevel?`<div class="weapon-stat-heading"><h3>基础属性</h3><div>${['1',String(d.maxLevel)].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<button type="button" data-weapon-level="${v}" aria-pressed="${level===v}">Lv.${v}</button>`).join('')}</div></div><dl class="weapon-stat-list">${stats.map(row=>`<div><dt>${esc(row.Name)}${row.IsRatio?'加成':''}</dt><dd>${value(row)}</dd></div>`).join('')}</dl>`:''}${d?.refinements?.length?`<section class="weapon-refinement"><div class="weapon-stat-heading"><h3>精炼效果</h3><span>${rank} 阶</span></div><div class="refinement-steps" role="group" aria-label="查看武器精炼等级">${[1,2,3,4,5].map(n=>`<button type="button" data-weapon-refinement="${n}" aria-pressed="${rank===n}">${n}</button>`).join('')}</div><h4>${esc(d.effectName)}</h4><p>${esc(effect?.effect||'').replace(/\n/g,'<br>')}</p></section>`:`<p class="resonator-source-note">${d?.skin?'投影外观，不提供武器属性或精炼效果。':'该武器暂无精炼效果。'}</p>`}<small class="resonator-source-note">固定中文资料 · 3.7.8 · 仅图鉴预览</small></div>`;
 };
 body.addEventListener('click',e=>{
  const refinement=e.target.closest('[data-weapon-refinement]'),stats=e.target.closest('[data-weapon-level]');
  if(!current||(!refinement&&!stats))return;
  if(refinement)rank=Number(refinement.dataset.weaponRefinement);if(stats)level=stats.dataset.weaponLevel;
  const selector=refinement?'[data-weapon-refinement="'+rank+'"]':'[data-weapon-level="'+level+'"]';
  window.renderWeaponArchive(current,false);body.querySelector(selector)?.focus({preventScroll:true});
 });
})();
