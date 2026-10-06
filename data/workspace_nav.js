/* Local catalog and presentation-only page routing. No game credentials are transmitted here. */
(()=>{
  const nav=document.getElementById('workspaceNav'),show=document.getElementById('workspaceNavShow');
  if(!nav)return;
  const small=matchMedia('(max-width:899px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active='planner',collapsed=false,atlasObserver=null,previewOpen=false,libraryKind='character',dialogFocus=null;
  const scrolls={planner:0,library:0,personal:0,boss:0},routes={planner:'#planner',library:'#library',personal:'#personal',boss:'#boss-info'};
  const animate=el=>{if(!reduced.matches&&el?.animate)el.animate([{opacity:.35,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});};
  window.renderBossAtlas=()=>{
    const stage=MX_STAGES[String(state.stageId)],seen=new Set();
    const bosses=(stage?.waves||[]).filter(b=>{const key=String(b.monsterId);if(seen.has(key))return false;seen.add(key);return true;});
    document.getElementById('bossAtlasPeriod').textContent=state.period.label||stage?.name||'';
    document.getElementById('bossAtlasRows').innerHTML=bosses.map((b,index)=>{
      const entry=typeof MATRIX_BOSS_DETAILS!=='undefined'?MATRIX_BOSS_DETAILS[String(state.stageId)]?.[String(b.id)]:null;
      const valid=entry && String(entry.monsterId)===String(b.monsterId);
      const icon=b.iconUrl || (b.icon?'assets/matrix/'+b.icon+'.webp':'');
      const art=valid && entry.art || icon,background=valid && entry.background || art;
      return `<article class="atlas-boss" id="atlasBoss-${b.id}" style="--row:${index}">
        <div class="atlas-backdrop" aria-hidden="true">${background?`<img src="${esc(background)}" alt="" loading="lazy" onerror="this.hidden=true">`:''}</div>
        <div class="atlas-art">${art?`<img src="${esc(art)}" alt="${esc(b.name)}" loading="lazy" onerror="if(!resourceImageError(this))this.hidden=true">`:''}<span class="atlas-index">${String(index+1).padStart(2,'0')}</span></div>
        <div class="atlas-copy"><div class="atlas-boss-heading"><h2>${esc(b.name)}</h2><div class="atlas-res"><span>属性抗性</span>${(b.res||[]).length?b.res.map(e=>`<b>${esc(e)}</b>`).join(''):'<b>均衡</b>'}</div></div>${bossHandbookHTML(mkBossFromStage(b))}</div>
      </article>`;
    }).join('');
    atlasObserver?.disconnect();
    if(!reduced.matches && typeof IntersectionObserver==='function'){
      atlasObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(entry.isIntersecting){animate(entry.target);atlasObserver.unobserve(entry.target);}
      }),{threshold:.12});
      document.querySelectorAll('.atlas-boss').forEach(row=>atlasObserver.observe(row));
    }
  };
  window.renderPersonalDashboard=()=>{
    const box=document.getElementById('personalAccountSummary');
    const count=(KURO.ownedIds||[]).length||(KURO.ownedNames||[]).length;
    const cached=ROLE_CACHE.account===roleAccountKey()?Object.keys(ROLE_CACHE.roles||{}).length:0;
    box.innerHTML=`<span class="page-eyebrow">库街区 · 游戏账号</span><h2>${esc(KURO.user?.roleName||KURO.user?.name||(KURO.user?'已连接游戏账号':'连接你的鸣潮账号'))}</h2><div class="personal-game-stats"><span><b>${count}</b> 已拥有角色</span><span><b>${cached}</b> 已读取配置</span><span>${KURO.user?'资料保存在本机':'登录后读取角色配置与战绩'}</span></div>`;
  };
  function sync(){
    document.body.dataset.workspace=active;delete document.body.dataset.mobilePanel;
    ['bossAtlas','libraryPage','personalPage'].forEach((id,i)=>document.getElementById(id).hidden=active!==['boss','library','personal'][i]);
    const page=active==='boss'?'planner':active;
    nav.querySelectorAll('[data-workspace]').forEach(b=>{if(b.dataset.workspace===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.querySelectorAll('[data-bookmark]').forEach(b=>{if(b.dataset.bookmark===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    nav.classList.toggle('collapsed',collapsed);nav.inert=collapsed;nav.setAttribute('aria-hidden',String(collapsed));show.hidden=!collapsed;show.setAttribute('aria-expanded',String(!collapsed));
    document.getElementById('hpPreviewShow').setAttribute('aria-expanded',String(previewOpen));
    document.getElementById('hpPreviewShow').hidden=active!=='planner'||!small.matches||previewOpen;
    document.getElementById('hpPreview').hidden=active!=='planner'||!small.matches||!previewOpen;
  }
  window.matrixNavigate=(view,options={})=>{
    if(['pool','teams','waves'].includes(view))view='planner';
    if(!routes[view])return;
    const changed=active!==view;
    if(changed){scrolls[active]=window.scrollY;document.getElementById('libraryDialog').hidden=true;closeTeamPop();if(ROLE_DIALOG)closeRoleDialog();if(BOSS_DIALOG)closeBossDialog();setPoolOpen(false);}
    active=view;sync();
    if(options.history!==false && location.hash!==routes[view])history.pushState(null,'',routes[view]);
    if(view==='boss')window.renderBossAtlas();
    if(view==='library')renderLibrary();
    if(view==='personal'){window.renderPersonalDashboard();renderAccountMatrix();if(typeof window.openPersonalCloud==='function')window.openPersonalCloud();}
    if(changed)window.scrollTo({top:scrolls[view]||0,behavior:'instant'});
    animate(document.getElementById({planner:'colTeams',library:'libraryPage',personal:'personalPage',boss:'bossAtlas'}[view]));
    if(options.focusId)document.getElementById('atlasBoss-'+options.focusId)?.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
  };
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-workspace]');if(b)window.matrixNavigate(b.dataset.workspace);});
  document.querySelectorAll('[data-bookmark]').forEach(b=>b.onclick=()=>window.matrixNavigate(b.dataset.bookmark));
  document.getElementById('workspaceNavHide').onclick=()=>{collapsed=true;sync();show.focus({preventScroll:true});};
  show.onclick=()=>{collapsed=false;sync();nav.querySelector('[aria-current]').focus({preventScroll:true});};
  document.getElementById('bossAtlasBack').onclick=()=>window.matrixNavigate('planner');
  document.getElementById('personalKuro').onclick=()=>setKuroOpen(true);
  function fullResults(){window.matrixNavigate('planner');const section=document.getElementById('hpOverviewSection');section.open=true;section.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}
  document.getElementById('bookmarkResults').onclick=()=>{if(small.matches){previewOpen=true;sync();animate(document.getElementById('hpPreview'));}else fullResults();};
  document.getElementById('hpPreviewShow').onclick=()=>{previewOpen=true;sync();animate(document.getElementById('hpPreview'));document.getElementById('hpPreviewShow').setAttribute('aria-expanded','true');};
  document.getElementById('hpPreviewClose').onclick=()=>{previewOpen=false;sync();document.getElementById('hpPreviewShow').setAttribute('aria-expanded','false');};
  document.getElementById('hpPreviewDetails').onclick=()=>{previewOpen=false;sync();fullResults();};
  const overview=document.getElementById('hpOverview'),mini=document.getElementById('hpPreviewBody');
  const syncPreview=()=>{mini.innerHTML=overview.innerHTML;mini.querySelectorAll('.note').forEach(el=>el.remove());mini.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));};
  new MutationObserver(syncPreview).observe(overview,{childList:true,subtree:true});syncPreview();
  mini.addEventListener('click',e=>{const row=e.target.closest('[data-rjump]');if(row){state.openRound[Number(row.dataset.rjump)]=true;renderAll();}});
  let drag=null;
  const handle=document.getElementById('hpPreviewHandle'),preview=document.getElementById('hpPreview');
  handle.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=preview.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=preview.getBoundingClientRect();preview.style.left=Math.max(8,Math.min(innerWidth-r.width-8,drag.left+e.clientX-drag.x))+'px';preview.style.top=Math.max(8,Math.min(innerHeight-r.height-8,drag.top+e.clientY-drag.y))+'px';preview.style.right='auto';preview.style.bottom='auto';});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>handle.addEventListener(name,()=>drag=null));
  window.addEventListener('resize',()=>{preview.style.left='';preview.style.top='';preview.style.right='';preview.style.bottom='';sync();},{passive:true});
  small.addEventListener('change',()=>{setPoolOpen(false);sync();});
  const categories={character:['冷凝','热熔','导电','气动','衍射','湮灭'],weapon:['长刃','迅刀','佩枪','臂铠','音感仪'],boss:['冷凝','热熔','导电','气动','衍射','湮灭']};
  function resetFilters(){document.getElementById('libraryFilter').innerHTML='<option value="">全部'+(libraryKind==='weapon'?'武器类型':'属性')+'</option>'+categories[libraryKind].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');document.getElementById('libraryRarity').value='';document.getElementById('libraryRarity').hidden=libraryKind==='boss';}
  function libraryItems(){
    if(libraryKind==='character')return CHARACTERS;
    if(libraryKind==='weapon')return WEAPONS;
    const seen=new Set();return (MX_STAGES[String(state.stageId)]?.waves||[]).filter(b=>{if(seen.has(b.monsterId))return false;seen.add(b.monsterId);return true;});
  }
  function itemIcon(item){if(libraryKind==='character')return charIcon(item);if(libraryKind==='weapon')return 'assets/weapon/'+item.id+'.webp';const detail=MATRIX_BOSS_DETAILS[String(state.stageId)]?.[String(item.id)];return detail?.art||('assets/matrix/'+item.icon+'.webp');}
  function renderLibrary(){
    const query=document.getElementById('librarySearch').value.trim().toLowerCase(),filter=document.getElementById('libraryFilter').value,rank=document.getElementById('libraryRarity').value;
    const items=libraryItems().filter(item=>!query||String(item.name).toLowerCase().includes(query)||String(item.en||'').toLowerCase().includes(query)).filter(item=>!filter||(libraryKind==='weapon'?item.type===filter:libraryKind==='boss'?(item.res||[]).includes(filter):item.element===filter)).filter(item=>!rank||String(item.rank)===rank);
    document.getElementById('libraryResultsCount').textContent=items.length+' 条档案';
    document.querySelectorAll('[data-library-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryKind===libraryKind)));
    document.getElementById('libraryGrid').innerHTML=items.map(item=>`<button type="button" class="archive-card ${libraryKind}" data-archive-id="${item.id}" style="--archive-color:${EL_COLOR[item.element]||'#baa172'}"><div class="archive-art"><img src="${esc(itemIcon(item))}" alt="${esc(item.name)}" loading="lazy" onerror="if(!resourceImageError(this))this.hidden=true">${item.rank?`<span class="archive-rarity">${'★'.repeat(item.rank)}</span>`:''}</div><div class="archive-caption"><small>${esc(libraryKind==='weapon'?item.type:libraryKind==='boss'?'矩阵 BOSS':item.element)}</small><b>${esc(libraryKind==='character'?characterLabel(item):item.name)}</b><span>${esc(libraryKind==='character'?item.weapon:libraryKind==='weapon'?'武器档案':'查看特性 ↗')}</span></div></button>`).join('')||'<div class="archive-empty">没有匹配的档案，试试其他筛选条件。</div>';
  }
  document.querySelectorAll('[data-library-kind]').forEach(b=>b.onclick=()=>{libraryKind=b.dataset.libraryKind;resetFilters();renderLibrary();animate(document.getElementById('libraryGrid'));});
  ['librarySearch','libraryFilter','libraryRarity'].forEach(id=>document.getElementById(id).addEventListener(id==='librarySearch'?'input':'change',renderLibrary));
  function closeLibraryDialog(){document.getElementById('libraryDialog').hidden=true;dialogFocus?.focus({preventScroll:true});}
  document.getElementById('libraryGrid').addEventListener('click',e=>{
    const b=e.target.closest('[data-archive-id]');if(!b)return;const item=libraryItems().find(i=>String(i.id)===b.dataset.archiveId);if(!item)return;
    if(libraryKind==='boss'){window.matrixNavigate('boss',{focusId:item.id});return;}
    dialogFocus=b;const label=libraryKind==='character'?characterLabel(item):item.name;
    document.getElementById('libraryDialogBody').innerHTML=`<div class="archive-detail-art"><img src="${esc(itemIcon(item))}" alt="${esc(label)}"></div><div class="archive-detail-copy"><span class="page-eyebrow">${libraryKind==='character'?'RESONATOR':'WEAPON'} / 档案</span><h2 id="libraryDialogTitle">${esc(label)}</h2><p class="archive-detail-stars">${'★'.repeat(item.rank||0)}</p><dl>${(libraryKind==='character'?[['属性',item.element],['武器类型',item.weapon]]:[['武器类型',item.type],['稀有度',(item.rank||'—')+' 星']]).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v||'—')}</dd></div>`).join('')}</dl><small>固定版本 3.7 · 基础档案</small></div>`;
    document.getElementById('libraryDialog').hidden=false;document.getElementById('libraryDialogClose').focus({preventScroll:true});
  });
  document.getElementById('libraryDialogClose').onclick=closeLibraryDialog;
  document.getElementById('libraryDialog').onclick=e=>{if(e.target.id==='libraryDialog')closeLibraryDialog();};
  document.getElementById('libraryDialog').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeLibraryDialog();}if(e.key==='Tab'){e.preventDefault();document.getElementById('libraryDialogClose').focus();}});
  window.addEventListener('hashchange',()=>window.matrixNavigate(Object.keys(routes).find(k=>routes[k]===location.hash)||'planner',{history:false}));
  document.querySelectorAll('.library-counts>span')[0].innerHTML=CHARACTERS.length+' <small>共鸣者</small>';document.querySelectorAll('.library-counts>span')[1].innerHTML=WEAPONS.length+' <small>武器</small>';
  resetFilters();window.renderBossAtlas();window.renderPersonalDashboard();sync();
  const initial=Object.keys(routes).find(k=>routes[k]===location.hash);if(initial&&initial!=='planner')window.matrixNavigate(initial,{history:false});
})();
