/* Local catalog and presentation-only page routing. No game credentials are transmitted here. */
(()=>{
  const nav=document.getElementById('workspaceNav'),show=document.getElementById('workspaceNavShow');
  if(!nav)return;
  const small=matchMedia('(max-width:899px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active='planner',collapsed=false,atlasObserver=null,libraryKind='character',dialogFocus=null,filterValue='',rarityValue='';
  const scrolls={planner:0,library:0,personal:0,boss:0,character:0},routes={planner:'#planner',library:'#library',personal:'#personal',boss:'#boss-info'};
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
    ['bossAtlas','libraryPage','personalPage','characterPage'].forEach((id,i)=>document.getElementById(id).hidden=active!==['boss','library','personal','character'][i]);
    const page=active==='boss'?'planner':active==='character'?'library':active;
    nav.querySelectorAll('[data-workspace]').forEach(b=>{if(b.dataset.workspace===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.querySelectorAll('[data-bookmark]').forEach(b=>{if(b.dataset.bookmark===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    nav.classList.toggle('collapsed',collapsed);nav.inert=collapsed;nav.setAttribute('aria-hidden',String(collapsed));show.hidden=!collapsed;show.setAttribute('aria-expanded',String(!collapsed));

  }
  window.matrixNavigate=(view,options={})=>{
    if(['pool','teams','waves'].includes(view))view='planner';
    if(!routes[view] && view!=='character')return;
    const changed=active!==view;
    if(changed){scrolls[active]=window.scrollY;document.getElementById('libraryDialog').hidden=true;closeTeamPop();if(ROLE_DIALOG)closeRoleDialog();if(BOSS_DIALOG)closeBossDialog();setPoolOpen(false);}
    active=view;sync();
    const route=view==='character'?'#character/'+window.ARCHIVE_CHARACTER_ID:routes[view];
    if(options.history!==false && location.hash!==route)history.pushState(null,'',route);
    if(view==='boss')window.renderBossAtlas();
    if(view==='library')renderLibrary();
    if(view==='character' && window.renderCharacterArchive)window.renderCharacterArchive();
    if(view==='personal'){window.renderPersonalDashboard();renderAccountMatrix();if(typeof window.openPersonalCloud==='function')window.openPersonalCloud();}
    if(changed)window.scrollTo({top:scrolls[view]||0,behavior:'instant'});
    animate(document.getElementById({planner:'colTeams',library:'libraryPage',personal:'personalPage',boss:'bossAtlas',character:'characterPage'}[view]));
    if(options.focusId)document.getElementById('atlasBoss-'+options.focusId)?.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
  };
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-workspace]');if(b)window.matrixNavigate(b.dataset.workspace);});
  document.querySelectorAll('[data-bookmark]').forEach(b=>b.onclick=()=>window.matrixNavigate(b.dataset.bookmark));
  document.getElementById('workspaceNavHide').onclick=()=>{collapsed=true;sync();show.focus({preventScroll:true});};
  show.onclick=()=>{collapsed=false;sync();nav.querySelector('[aria-current]').focus({preventScroll:true});};
  document.getElementById('bossAtlasBack').onclick=()=>window.matrixNavigate('planner');
  document.getElementById('personalKuro').onclick=()=>setKuroOpen(true);
  function fullResults(){window.matrixNavigate('planner');const section=document.getElementById('hpOverviewSection');section.open=true;section.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}
  document.getElementById('bookmarkResults').onclick=fullResults;
  window.addEventListener('resize',sync,{passive:true});
  small.addEventListener('change',()=>{setPoolOpen(false);sync();});
  const categories={character:['冷凝','热熔','导电','气动','衍射','湮灭'],weapon:['长刃','迅刀','佩枪','臂铠','音感仪'],boss:['冷凝','热熔','导电','气动','衍射','湮灭']};
  function renderFilters(){
    const options=['',...categories[libraryKind]];
    document.getElementById('libraryFilter').innerHTML=options.map(value=>`<button type="button" data-archive-filter="${esc(value)}" aria-pressed="${filterValue===value}" style="--filter-color:${EL_COLOR[value]||'#8b729c'}">${value?`<i aria-hidden="true"></i>`:''}${esc(value||'全部')}</button>`).join('');
    document.getElementById('libraryRarity').innerHTML=[['','全部星级'],['5','五星'],['4','四星'],['3','三星']].map(([v,name])=>`<button type="button" data-archive-rarity="${v}" aria-pressed="${rarityValue===v}">${name}</button>`).join('');
    document.getElementById('libraryRarity').hidden=libraryKind==='boss';
  }
  function resetFilters(){filterValue='';rarityValue='';renderFilters();}
  function libraryItems(){
    if(libraryKind==='character')return CHARACTERS;
    if(libraryKind==='weapon')return WEAPONS;
    const seen=new Set();return (MX_STAGES[String(state.stageId)]?.waves||[]).filter(b=>{if(seen.has(b.monsterId))return false;seen.add(b.monsterId);return true;});
  }
  function itemIcon(item){if(libraryKind==='character')return charIcon(item);if(libraryKind==='weapon')return 'assets/weapon/'+item.id+'.webp';const detail=MATRIX_BOSS_DETAILS[String(state.stageId)]?.[String(item.id)];return detail?.art||('assets/matrix/'+item.icon+'.webp');}
  function renderLibrary(){
    const query=document.getElementById('librarySearch').value.trim().toLowerCase(),filter=filterValue,rank=rarityValue;
    const items=libraryItems().filter(item=>!query||String(item.name).toLowerCase().includes(query)||String(item.en||'').toLowerCase().includes(query)).filter(item=>!filter||(libraryKind==='weapon'?item.type===filter:libraryKind==='boss'?(item.res||[]).includes(filter):item.element===filter)).filter(item=>!rank||String(item.rank)===rank);
    document.getElementById('libraryResultsCount').textContent=items.length+' 条档案';
    document.querySelectorAll('[data-library-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryKind===libraryKind)));
    document.getElementById('libraryGrid').innerHTML=items.map(item=>`<button type="button" class="archive-card ${libraryKind}" data-archive-id="${item.id}" style="--archive-color:${EL_COLOR[item.element]||'#baa172'}"><div class="archive-art"><img src="${esc(itemIcon(item))}" alt="${esc(item.name)}" loading="lazy" onerror="if(!resourceImageError(this))this.hidden=true">${item.rank?`<span class="archive-rarity">${'★'.repeat(item.rank)}</span>`:''}</div><div class="archive-caption"><small>${esc(libraryKind==='weapon'?item.type:libraryKind==='boss'?'矩阵 BOSS':item.element)}</small><b>${esc(libraryKind==='character'?characterLabel(item):item.name)}</b><span>${esc(libraryKind==='character'?item.weapon:libraryKind==='weapon'?'武器档案':'查看特性 ↗')}</span></div></button>`).join('')||'<div class="archive-empty">没有匹配的档案，试试其他筛选条件。</div>';
  }
  document.querySelectorAll('[data-library-kind]').forEach(b=>b.onclick=()=>{libraryKind=b.dataset.libraryKind;resetFilters();renderLibrary();animate(document.getElementById('libraryGrid'));});
  document.getElementById('librarySearch').addEventListener('input',renderLibrary);
  document.getElementById('libraryFilter').onclick=e=>{const b=e.target.closest('[data-archive-filter]');if(b){filterValue=b.dataset.archiveFilter;renderFilters();renderLibrary();}};
  document.getElementById('libraryRarity').onclick=e=>{const b=e.target.closest('[data-archive-rarity]');if(b){rarityValue=b.dataset.archiveRarity;renderFilters();renderLibrary();}};
  function closeLibraryDialog(){document.getElementById('libraryDialog').hidden=true;dialogFocus?.focus({preventScroll:true});}
  document.getElementById('libraryGrid').addEventListener('click',e=>{
    const b=e.target.closest('[data-archive-id]');if(!b)return;const item=libraryItems().find(i=>String(i.id)===b.dataset.archiveId);if(!item)return;
    if(libraryKind==='character'){window.ARCHIVE_CHARACTER_ID=String(item.id);window.matrixNavigate('character');return;}
    if(libraryKind==='boss'){window.matrixNavigate('boss',{focusId:item.id});return;}
    dialogFocus=b;const label=libraryKind==='character'?characterLabel(item):item.name;
    window.renderWeaponArchive(item);
    document.getElementById('libraryDialog').hidden=false;document.getElementById('libraryDialogClose').focus({preventScroll:true});
  });
  document.getElementById('libraryDialogClose').onclick=closeLibraryDialog;
  document.getElementById('libraryDialog').onclick=e=>{if(e.target.id==='libraryDialog')closeLibraryDialog();};
  document.getElementById('libraryDialog').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeLibraryDialog();}if(e.key==='Tab'){const focusable=[...document.getElementById('libraryDialog').querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  function openRoute(){if(location.hash.startsWith('#character/')){const id=location.hash.slice(11);if(CH_INDEX[id]){window.ARCHIVE_CHARACTER_ID=id;window.matrixNavigate('character',{history:false});return;}}window.matrixNavigate(Object.keys(routes).find(k=>routes[k]===location.hash)||'planner',{history:false});}
  window.addEventListener('hashchange',openRoute);
  document.querySelectorAll('.library-counts>span')[0].innerHTML=CHARACTERS.length+' <small>共鸣者</small>';document.querySelectorAll('.library-counts>span')[1].innerHTML=WEAPONS.length+' <small>武器</small>';
  resetFilters();window.renderBossAtlas();window.renderPersonalDashboard();sync();
  if(location.hash.startsWith('#character/')){window.ARCHIVE_CHARACTER_ID=location.hash.slice(11);if(CH_INDEX[window.ARCHIVE_CHARACTER_ID])window.matrixNavigate('character',{history:false});}else{const initial=Object.keys(routes).find(k=>routes[k]===location.hash);if(initial&&initial!=='planner')window.matrixNavigate(initial,{history:false});}
})();
