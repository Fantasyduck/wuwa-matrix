/* 只观察显示层：新增与重排卡片的过渡，不修改队伍、分数或账号数据。 */
(()=>{
  if(typeof MutationObserver==='undefined'||typeof matchMedia!=='function')return;
  const box=document.getElementById('teams');
  if(!box)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let positions=new Map(),frame=0;
  const snapshot=()=>new Map([...box.querySelectorAll('.team[data-tid]')].map(card=>[card.dataset.tid,card.offsetTop]));
  positions=snapshot();
  const observer=new MutationObserver(()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const next=snapshot();
      if(!reduced.matches&&!document.body.classList.contains('reveal')){
        box.querySelectorAll('.team[data-tid]').forEach(card=>{
          if(typeof card.animate!=='function')return;
          const before=positions.get(card.dataset.tid),after=next.get(card.dataset.tid);
          if(before===undefined){
            card.animate([{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
          }else if(before!==after&&Math.abs(before-after)<800){
            card.animate([{transform:`translateY(${before-after}px)`},{transform:'none'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
          }
        });
      }
      positions=next;
    });
  });
  observer.observe(box,{childList:true});
  // 响应式布局变化后重新记录位置，避免下次编队误用旧的纵向坐标。
  window.addEventListener('resize',()=>{positions=snapshot();},{passive:true});
  reduced.addEventListener?.('change',()=>{
    if(reduced.matches)box.querySelectorAll('.team').forEach(card=>card.getAnimations?.().forEach(a=>a.cancel()));
    positions=snapshot();
  });
})();
