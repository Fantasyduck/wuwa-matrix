/* Display-only navigation. Teams and simulation retain their original state. */
(()=>{
  const nav=document.getElementById('workspaceNav'),show=document.getElementById('workspaceNavShow');
  if(!nav)return;
  const small=matchMedia('(max-width:899px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let atlasObserver=null;
  let active='teams',scrolls={pool:0,teams:0,waves:0,boss:0},collapsed=false;
  const ids={pool:'colPool',teams:'colTeams',waves:'colWaves',boss:'bossAtlas'};
  const animate=element=>{
    if(!reduced.matches && element?.animate)element.animate([{opacity:.35,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
  };
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
  function sync(){
    document.body.dataset.workspace=active==='boss'?'boss':'planner';
    document.body.dataset.mobilePanel=active==='boss'?'teams':active;
    document.getElementById('bossAtlas').hidden=active!=='boss';
    nav.querySelectorAll('[data-workspace]').forEach(button=>{
      const selected=button.dataset.workspace===active;
      if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    if(small.matches){document.getElementById('colPool').classList.remove('open');document.getElementById('poolScrim').hidden=true;}
    nav.classList.toggle('collapsed',collapsed);nav.inert=collapsed;
    nav.setAttribute('aria-hidden',String(collapsed));show.hidden=!collapsed;show.setAttribute('aria-expanded',String(!collapsed));
  }
  window.matrixNavigate=(view,options={})=>{
    if(!ids[view])return;
    if(active!==view)scrolls[active]=window.scrollY;
    if(!options.fromPool){poolOpen=small.matches && view==='pool';if(view!=='pool')pendingCharSlot=null;closeTeamPop();}
    active=view;sync();
    if(view==='boss')window.renderBossAtlas();
    if(small.matches || view==='boss')window.scrollTo({top:scrolls[view]||0,behavior:'instant'});
    if(!small.matches && view!=='boss' && view==='pool' && innerWidth<1360)setPoolOpen(true);
    const target=document.getElementById(ids[view]);animate(target);
    if(options.focusId){
      const row=document.getElementById('atlasBoss-'+options.focusId);
      row?.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
      if(!reduced.matches && row?.animate)row.animate([{boxShadow:'0 0 0 2px #9b80b8'},{boxShadow:'0 16px 45px #30213d18'}],{duration:800});
    }
  };
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-workspace]');if(button)window.matrixNavigate(button.dataset.workspace);
  });
  document.getElementById('workspaceNavHide').onclick=()=>{collapsed=true;sync();show.focus({preventScroll:true});};
  show.onclick=()=>{collapsed=false;sync();nav.querySelector('[aria-current]').focus({preventScroll:true});};
  document.getElementById('bossAtlasBack').onclick=()=>window.matrixNavigate('teams');
  small.addEventListener('change',()=>{const wasBoss=active==='boss';setPoolOpen(false);active=wasBoss?'boss':'teams';sync();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && active==='boss' && !ROLE_DIALOG && !BOSS_DIALOG)window.matrixNavigate('teams');});
  window.renderBossAtlas();sync();
})();
