'use strict';
// Optional real-browser regression suite; use the already-running preview site.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const site=new URL(process.env.MILO_PREVIEW_URL || 'http://localhost:4000/');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let timeoutSnapshot;
async function until(check,label){const started=Date.now();for(let i=0;i<100;i++){try{const value=await check();if(value)return value}catch(e){}await wait(100)}throw Error('Timeout: '+label+'; elapsed='+String(Date.now()-started)+'ms; state='+JSON.stringify(await timeoutSnapshot?.()))}
(async()=>{
  if(typeof WebSocket==='undefined')throw Error('Browser tests require Node.js 22+ (validated on Node.js 26).');
  let executable=process.env.MILO_BROWSER;
  if(!executable)for(const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome']){
    try{await fs.access(candidate);executable=candidate;break}catch(e){}
  }
  if(!executable)throw Error('Set MILO_BROWSER to an installed Chromium browser executable.');
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'milo-round6-'));
  const browser=cp.spawn(executable,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let ws,load,onRequest;const errors=[];
  try{
    const endpoint=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(Error('Browser startup timeout')),15000);browser.stderr.on('data',chunk=>{data+=chunk;const match=data.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});browser.on('error',reject)});
    const origin=new URL(endpoint).origin.replace('ws:','http:');
    const target=await (await fetch(origin+'/json/new?about:blank',{method:'PUT'})).json();
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
    let id=0;const pending=new Map();
    ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Page.loadEventFired')load?.();if(message.method==='Fetch.requestPaused')onRequest?.(message.params);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);if(message.id){const task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(Error(JSON.stringify(message.error))):task.resolve(message.result)}};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('Browser command timeout: '+method))},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}))});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};
    timeoutSnapshot=()=>evaluate(`(()=>({url:location.href,width:innerWidth,y:scrollY,focus:document.activeElement?.id,toc:document.querySelector('.mobile-toc')?.open,loadCount:sessionStorage.getItem('milo-test-loads'),progress:document.querySelector('progress')?.value,links:[...document.querySelectorAll('.mobile-toc a')].slice(0,3).map(a=>({hash:a.hash,current:a.getAttribute('aria-current'),top:document.getElementById(decodeURIComponent(a.hash.slice(1)))?.getBoundingClientRect().top}))}))()`);
    const loaded=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page load timeout')),15000);load=()=>{clearTimeout(timer);resolve()}});
    const navigate=async route=>{await send('Page.bringToFront');const ready=loaded();await send('Page.navigate',{url:new URL(route,site).href});await ready;await wait(100)};
    const screenshot=async name=>{if(!process.env.MILO_SCREENSHOT_DIR)return;await fs.mkdir(process.env.MILO_SCREENSHOT_DIR,{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(process.env.MILO_SCREENSHOT_DIR,name+'.png'),Buffer.from(shot.data,'base64'))};
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__imageBoxes=[];window.__shifts=[];addEventListener('DOMContentLoaded',()=>{window.__imageBoxes=[...document.querySelectorAll('#post-content img')].map(image=>{const r=image.getBoundingClientRect();return {width:r.width,height:r.height,complete:image.complete}})});new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__shifts.push(entry.value)}).observe({type:'layout-shift',buffered:true})`});
    const protocol=await(await fetch(origin+'/json/protocol')).json();
    const safeArea=protocol.domains.find(d=>d.domain==='Emulation').commands.some(c=>c.name==='setSafeAreaInsetsOverride');
    const posts=await (await fetch(new URL('search.json',site))).json();
    await send('Page.addScriptToEvaluateOnNewDocument',{source:'sessionStorage.setItem("milo-test-loads",String(Number(sessionStorage.getItem("milo-test-loads") || 0)+1))'});
    async function checkReading(width,mode){
      const mobile=width<=800;
      await navigate('archives/');
      const archive=await evaluate(`(()=>{const main=document.querySelector('#main');return {urls:[...main.querySelectorAll('.archive-row')].map(a=>a.getAttribute('href')),pager:!!main.querySelector('.pager'),groups:[...main.querySelectorAll('.year')].map(h=>{const dates=[];let next=h.nextElementSibling;while(next?.matches('.archive-row')){dates.push(next.querySelector('time').textContent);next=next.nextElementSibling}return {year:h.textContent,dates}})}})()`);
      assert.deepEqual(archive.urls,posts.map(p=>p.url));assert.equal(archive.pager,false);
      assert.deepEqual(archive.groups.map(g=>g.year),['2026','2025']);
      archive.groups.forEach(group=>assert.deepEqual(group.dates,[...group.dates].sort().reverse()));
      assert.equal((await fetch(new URL('archives/page/2/',site))).status,404);
      await navigate('posts/long-reading/');
      const progress=await evaluate(`(()=>{const p=document.querySelector('.reading-progress'),r=p.getBoundingClientRect();return {width:r.width,viewportWidth:document.documentElement.clientWidth,height:r.height,top:r.top,bottom:r.bottom,nav:document.querySelector('.topbar').getBoundingClientRect().bottom,pointer:getComputedStyle(p).pointerEvents,percent:getComputedStyle(p.querySelector('span')).display,value:p.querySelector('progress').value}})()`);
      assert.equal(progress.pointer,'none');assert.equal(progress.value,0);
      if(mobile){
        assert.equal(progress.width,progress.viewportWidth);assert.equal(progress.height,3);assert.ok(Math.abs(progress.top-progress.nav)<1);assert.equal(progress.percent,'none');
        if(safeArea){
          await send('Emulation.setSafeAreaInsetsOverride',{insets:{top:24,bottom:24}});
          await evaluate("document.querySelector('.topbar').style.paddingTop='env(safe-area-inset-top)'");
          await until(async()=>await evaluate("Math.abs(document.querySelector('.reading-progress').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)<1"),'safe-area navigation alignment');
          await evaluate("document.querySelector('.topbar').style.paddingTop=''");await send('Emulation.setSafeAreaInsetsOverride',{insets:{}});
          await until(async()=>await evaluate("Math.abs(document.querySelector('.reading-progress').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)<1"),'navigation alignment reset');
        }
        await evaluate('document.querySelector(".mobile-toc summary").click()');
        const toc=await evaluate(`(()=>{const toc=document.querySelector('.mobile-toc'),nav=toc.querySelector('nav'),links=[...nav.querySelectorAll('a')];return {open:toc.open,height:nav.clientHeight,scrollHeight:nav.scrollHeight,width:nav.clientWidth,scrollWidth:nav.scrollWidth,levels:links.slice(0,3).map(a=>a.getBoundingClientRect().left)}})()`);
        assert.equal(toc.open,true);assert.ok(toc.height<=422);assert.ok(toc.scrollHeight>toc.height);assert.ok(toc.scrollWidth<=toc.width+1);assert.ok(toc.levels[0]<toc.levels[1] && toc.levels[1]<toc.levels[2]);
        await screenshot('milo-toc-'+width+'-'+mode);
        const longHeading=await evaluate(`(()=>{const nav=document.querySelector('.mobile-toc nav'),a=nav.querySelector('a'),label=a.querySelector('.toc-text')||a,original=label.textContent;label.textContent='VeryLongHeadingWithoutSpaces'.repeat(12);const r={width:nav.clientWidth,scroll:nav.scrollWidth,height:a.getBoundingClientRect().height};label.textContent=original;nav.scrollTop=nav.scrollHeight;r.scrollTop=nav.scrollTop;nav.scrollTop=0;return r})()`);
        assert.ok(longHeading.scroll<=longHeading.width+1);assert.ok(longHeading.height>50);assert.ok(longHeading.scrollTop>0);
        for(const index of [0,1,2]){
          // Return to the visible directory as a reader would, rather than clicking
          // offscreen nodes while the browser is anchoring the previous heading.
          await evaluate('scrollTo({top:0,behavior:"instant"})');
          await until(async()=>await evaluate('scrollY===0'),'return to directory');
          await evaluate(`(()=>{const toc=document.querySelector('.mobile-toc'),summary=toc.querySelector('summary');summary.focus({preventScroll:true});if(!toc.open)summary.click();toc.querySelector('nav').scrollTop=0})()`);
          await evaluate('new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(resolve));setTimeout(resolve,100)})');
          await evaluate(`document.querySelectorAll('.mobile-toc a')[${index}].click()`);
          await until(async()=>await evaluate(`(()=>{const toc=document.querySelector('.mobile-toc'),a=toc.querySelectorAll('a')[${index}],h=document.getElementById(decodeURIComponent(a.hash.slice(1))),top=h.getBoundingClientRect().top,bottom=document.querySelector('.topbar').getBoundingClientRect().bottom;return !toc.open && document.activeElement===h && a.getAttribute('aria-current')==='location' && top>=bottom && Math.abs(top-bottom-16)<2})()`),'nested TOC jump '+index).catch(async error=>{error.message+=' '+width+'px '+mode+' '+JSON.stringify(await evaluate(`(()=>{const a=document.querySelectorAll('.mobile-toc a')[${index}],h=document.getElementById(decodeURIComponent(a.hash.slice(1)));return {top:h.getBoundingClientRect().top,nav:document.querySelector('.topbar').getBoundingClientRect().bottom,current:a.getAttribute('aria-current'),focus:document.activeElement.id}})()`));throw error});
        }
      }else{
        assert.ok(progress.width<200 && progress.height>20);assert.notEqual(progress.percent,'none');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".toc-sidebar")).display'),width<=900?'none':'block');
      }
      await evaluate("(()=>{const r=document.querySelector('#post-content').getBoundingClientRect(),offset=parseFloat(document.documentElement.style.getPropertyValue('--reading-offset')),distance=r.height-Math.max(0,innerHeight-offset);scrollTo({top:scrollY+r.top-offset+distance/2,behavior:'instant'})})()");
      await until(async()=>await evaluate('document.querySelector("progress").value===50'),'reading midpoint');
      if(mobile)assert.ok(await evaluate("Math.abs(document.querySelector('.reading-progress').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)<1"));
      await screenshot('milo-top-progress-'+width+'-'+mode);
      await evaluate('scrollTo({top:document.body.scrollHeight,behavior:"instant"})');
      await until(async()=>await evaluate('document.querySelector("progress").value===100'),'reading progress');
      await navigate('posts/code-lab/');
      const code=await evaluate(`(()=>{const f=document.querySelector('figure.highlight');f.scrollIntoView({block:'center',behavior:'instant'});const result={width:f.clientWidth,scrollWidth:f.scrollWidth,viewport:innerWidth};f.scrollLeft=f.scrollWidth;result.left=f.scrollLeft;const line=[...f.querySelectorAll('.code .line')].sort((a,b)=>b.textContent.length-a.textContent.length)[0],walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);let last,node;while(node=walker.nextNode())if(node.length)last=node;const range=document.createRange();range.setStart(last,last.length-1);range.setEnd(last,last.length);const end=range.getBoundingClientRect(),rect=f.getBoundingClientRect();result.endVisible=end.left>=rect.left && end.right<=rect.right+1;return result})()`);
      assert.equal(code.viewport,width);assert.ok(code.scrollWidth>code.width);assert.ok(code.left>0);assert.equal(code.endVisible,true,'End of long line must remain reachable');
      await screenshot('milo-code-'+width+'-'+mode);
      await send('Page.bringToFront');
      await send('Runtime.evaluate',{expression:'document.querySelector(".copy-code").click()',userGesture:true});
      await until(async()=>await evaluate('document.querySelector(".copy-status").textContent==="已复制"'),'native code copy');
      onRequest=({requestId})=>{setTimeout(()=>send('Fetch.continueRequest',{requestId}).catch(()=>{}),200)};
      await send('Fetch.enable',{patterns:[{urlPattern:'*/images/*',requestStage:'Request'}]});
      await navigate('posts/image-gallery/');
      const before=await evaluate('window.__imageBoxes');assert.ok(before.some(b=>!b.complete),'Images deliberately delayed');
      const lazy=await evaluate('[...document.querySelectorAll("#post-content img")].map(i=>i.getAttribute("loading"))');assert.equal(lazy[0],'eager');assert.ok(lazy.slice(1).includes('lazy'));
      const count=await evaluate('document.querySelectorAll("#post-content img").length');
      for(let index=0;index<count;index++){
        await evaluate(`document.querySelectorAll('#post-content img')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);
        await until(async()=>await evaluate(`(()=>{const i=document.querySelectorAll('#post-content img')[${index}];return i.complete && i.naturalWidth>0})()`),'image loaded');
      }
      const after=await evaluate(`(()=>{const content=document.querySelector('#post-content').getBoundingClientRect();return {viewport:innerWidth,images:[...document.querySelectorAll('#post-content img')].map(i=>{const r=i.getBoundingClientRect();return {width:r.width,height:r.height,ratio:i.naturalWidth/i.naturalHeight,inBounds:r.left>=content.left-1 && r.right<=content.right+1}}),cls:window.__shifts.reduce((sum,v)=>sum+v,0)}})()`);
      assert.equal(after.viewport,width);assert.equal(after.images.length,before.length);
      after.images.forEach((image,index)=>{assert.equal(image.inBounds,true);assert.ok(Math.abs(image.width/image.height-image.ratio)<.01);assert.ok(Math.abs(image.width-before[index].width)<1 && Math.abs(image.height-before[index].height)<1,'Reserved dimensions changed')});
      assert.ok(after.cls<.001,'Image load layout shift: '+after.cls);
      await send('Fetch.disable');onRequest=null;
      await screenshot('milo-images-'+width+'-'+mode);
      await send('Runtime.evaluate',{expression:'document.querySelectorAll("#post-content .lightbox-image")[1].focus();document.querySelectorAll("#post-content .lightbox-image")[1].click()',userGesture:true});
      assert.equal(await evaluate('document.querySelector("dialog").open'),true);
      await until(async()=>await evaluate('document.querySelector("dialog img").naturalWidth>0'),'lightbox image');
      for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until(async()=>await evaluate('!document.querySelector("dialog").open && document.activeElement===document.querySelectorAll("#post-content .lightbox-image")[1]'),'lightbox close/focus');
      assert.equal(await evaluate('document.querySelector("#post-content a img").hasAttribute("role")'),false);
      assert.equal(await evaluate('document.querySelector("#post-content img[data-no-lightbox]").classList.contains("lightbox-image")'),false);
      await navigate('posts/short-note/');
      await until(async()=>await evaluate('document.querySelector("progress").value===100'),'short article fully visible');
      if(mobile)assert.ok(await evaluate("Math.abs(document.querySelector('.reading-progress').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)<1"));
    }
    async function checkSearchWrap(width,mode){
      const post=posts.find(p=>p.url.endsWith('/posts/long-title/'));
      assert.ok(post,'Use the existing long-string preview article');
      async function check(query,kind){
        await navigate('search/?q='+encodeURIComponent(query));
        await until(async()=>await evaluate(`!![...document.querySelectorAll('.search-result')].find(r=>r.querySelector('a').pathname.endsWith('/posts/long-title/'))`),'long-string search');
        const result=await evaluate(`(()=>{const article=[...document.querySelectorAll('.search-result')].find(r=>r.querySelector('a').pathname.endsWith('/posts/long-title/')),p=article.querySelector('p'),main=document.querySelector('#main'),range=document.createRange();range.selectNodeContents(p);const bounds=main.getBoundingClientRect(),rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0),marks=[...p.querySelectorAll('mark')],probe=document.createElement('span');probe.style.cssText='position:absolute;color:var(--accent)';document.body.append(probe);const accent=getComputedStyle(probe).color;probe.remove();return {viewport:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,mainMin:getComputedStyle(main).minWidth,width:p.clientWidth,contentWidth:p.scrollWidth,overflow:getComputedStyle(p).overflowX,wordBreak:getComputedStyle(p).wordBreak,whiteSpace:getComputedStyle(p).whiteSpace,text:p.textContent,inBounds:rects.every(r=>r.left>=bounds.left-1&&r.right<=bounds.right+1),marks:marks.map(m=>({text:m.textContent,color:getComputedStyle(m).color,display:getComputedStyle(m).display,space:getComputedStyle(m).whiteSpace})),accent}})()`);
        assert.equal(result.viewport,width,'Layout viewport expanded');assert.ok(result.scroll<=result.client+1,'Page scrolls horizontally');
        assert.equal(result.mainMin,'0px');assert.ok(result.contentWidth<=result.width+1,'Paragraph overflows');assert.equal(result.inBounds,true,'Text overlaps sidebar/gutter');
        assert.equal(result.overflow,'visible','Do not conceal overflowing text');assert.equal(result.wordBreak,'normal');assert.equal(result.whiteSpace,'normal');
        const start=Math.max(0,post.content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())-40);
        assert.equal(result.text,(start?'…':'')+post.content.slice(start,start+170)+'…','Excerpt text changed');
        if(kind==='plain')assert.equal(result.marks.length,0);
        else assert.ok(result.marks.length>1,'Repeated highlights are missing');
        for(const mark of result.marks){assert.equal(mark.display,'inline');assert.equal(mark.space,'normal');assert.equal(mark.color,result.accent)}
        if(kind==='alternating')assert.deepEqual([...new Set(result.marks.map(m=>m.text.toLowerCase()))].sort(),['exam','ple']);
        await screenshot('milo-search-wrap-'+width+'-'+mode+'-'+kind);
      }
      await check('兼容性','plain');
      await check('example','repeated');
      // The original filter matches the entire query. A browser-only fixture tag
      // lets the same article exercise alternating tokens without changing it.
      const fixture=posts.map(p=>p===post?{...p,tags:[...p.tags,'exam ple']}:p);
      const injection=await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const original=window.fetch;window.fetch=(url,...args)=>String(url).endsWith('/search.json')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(fixture))},{headers:{'Content-Type':'application/json'}})):original.call(window,url,...args)}`});
      try{await check('exam ple','alternating')}
      finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier})}
    }
    async function checkSidebar(width,mode){
      for(const route of ['', 'archives/', 'categories/', 'tags/']){
        await navigate(route);
        const initial=await evaluate(`(()=>{scrollTo({top:0,behavior:'instant'});const aside=document.querySelector('.sidebar'),group=aside.querySelector('.sidebar-sticky'),profile=aside.querySelector('.profile'),sections=[...group.querySelectorAll('.side-section')],r=group.getBoundingClientRect();return {position:getComputedStyle(group).position,asideDisplay:getComputedStyle(aside).display,top:r.top,width:r.width,height:r.height,asideWidth:aside.getBoundingClientRect().width,parentHeight:aside.getBoundingClientRect().height,columnsHeight:document.querySelector('.columns').getBoundingClientRect().height,profileBottom:profile.getBoundingClientRect().bottom,firstTop:sections[0].getBoundingClientRect().top,gap:sections[1].getBoundingClientRect().top-sections[0].getBoundingClientRect().bottom,offset:Number.parseFloat(getComputedStyle(group).top),nav:document.querySelector('.topbar').getBoundingClientRect().bottom}})()`);
        if(width<=800){assert.equal(initial.position,'static');assert.equal(initial.asideDisplay,'none');continue}
        assert.equal(initial.position,'sticky');assert.equal(initial.width,initial.asideWidth);assert.ok(Math.abs(initial.top-initial.profileBottom-30)<1);assert.ok(Math.abs(initial.firstTop-initial.top)<1);assert.ok(Math.abs(initial.gap-30)<1);assert.ok(Math.abs(initial.parentHeight-initial.columnsHeight)<1);assert.ok(initial.offset>=initial.nav+20);
        const off=await evaluate(`(()=>{const group=document.querySelector('.sidebar-sticky');group.classList.remove('is-sticky');const r=group.getBoundingClientRect();return {position:getComputedStyle(group).position,top:r.top,width:r.width,height:r.height}})()`);
        assert.equal(off.position,'static');assert.equal(off.top,initial.top);assert.equal(off.width,initial.width);assert.equal(off.height,initial.height);
        await evaluate('scrollTo({top:100,behavior:"instant"})');
        assert.ok(await evaluate(`Math.abs(document.querySelector('.sidebar-sticky').getBoundingClientRect().top-(${initial.top}-scrollY))<1`));
        await evaluate(`scrollTo({top:0,behavior:'instant'});document.querySelector('.sidebar-sticky').classList.add('is-sticky')`);
        // Short archive/taxonomy pages still obey the same parent constraint;
        // extend only this test DOM to exercise their sticky travel range.
        if(route!=='')await evaluate(`(()=>{const main=document.querySelector('#main'),spacer=document.createElement('div');spacer.className='sidebar-test-main';spacer.style.height='1400px';main.append(spacer)})()`);
        const mainTop=await evaluate('document.querySelector("#main").getBoundingClientRect().top');
        await evaluate(`scrollTo({top:${initial.top-initial.offset+80},behavior:'instant'})`);
        const stuck=await evaluate(`(()=>{const group=document.querySelector('.sidebar-sticky'),r=group.getBoundingClientRect(),link=group.querySelector('.recent'),lr=link.getBoundingClientRect();return {top:r.top,width:r.width,profileBottom:document.querySelector('.profile').getBoundingClientRect().bottom,nav:document.querySelector('.topbar').getBoundingClientRect().bottom,mainTop:document.querySelector('#main').getBoundingClientRect().top,y:scrollY,clickable:link.contains(document.elementFromPoint(lr.left+lr.width/2,lr.top+lr.height/2))}})()`);
        assert.ok(Math.abs(stuck.top-initial.offset)<1,'Group must stick below navigation');assert.ok(stuck.profileBottom<stuck.nav,'Author card should scroll out');assert.equal(stuck.width,initial.width);assert.ok(Math.abs(mainTop-stuck.mainTop-stuck.y)<1,'Main content must keep scrolling');assert.equal(stuck.clickable,true);
        if(route==='')await screenshot('milo-sidebar-stuck-'+width+'-'+mode);
        await evaluate('scrollTo({top:document.body.scrollHeight,behavior:"instant"})');
        assert.equal(await evaluate('document.querySelector(".sidebar-sticky").getBoundingClientRect().bottom<=document.querySelector(".columns").getBoundingClientRect().bottom+1'),true);
        // Make room after the parent to prove the sticky element stops with it.
        await evaluate(`(()=>{const spacer=document.createElement('div');spacer.className='sidebar-test-after';spacer.style.height='1000px';document.querySelector('.columns').after(spacer);const group=document.querySelector('.sidebar-sticky'),aside=document.querySelector('.sidebar'),bottom=aside.getBoundingClientRect().bottom+scrollY;scrollTo({top:bottom-group.getBoundingClientRect().height-${initial.offset}+120,behavior:'instant'})})()`);
        const edge=await evaluate(`({group:document.querySelector('.sidebar-sticky').getBoundingClientRect().bottom,parent:document.querySelector('.sidebar').getBoundingClientRect().bottom,top:document.querySelector('.sidebar-sticky').getBoundingClientRect().top})`);
        assert.ok(Math.abs(edge.group-edge.parent)<1,'Sticky must stop at parent end');assert.ok(edge.top<initial.offset-50);
        await evaluate(`document.querySelectorAll('.sidebar-test-main,.sidebar-test-after').forEach(n=>n.remove());scrollTo({top:0,behavior:'instant'})`);
        assert.ok(await evaluate(`Math.abs(document.querySelector('.sidebar-sticky').getBoundingClientRect().top-${initial.top})<1`),'Natural position should restore');
        if(route===''){
          await send('Emulation.setDeviceMetricsOverride',{width,height:360,deviceScaleFactor:1,mobile:false});
          await evaluate(`scrollTo({top:${initial.top-initial.offset+80},behavior:'instant'})`);
          const tall=await evaluate(`(()=>{const group=document.querySelector('.sidebar-sticky');group.scrollTop=group.scrollHeight;return {height:group.clientHeight,scroll:group.scrollHeight,offset:group.scrollTop,width:group.getBoundingClientRect().width,last:group.querySelector('.category:last-child').getBoundingClientRect().bottom,bottom:group.getBoundingClientRect().bottom}})()`);
          assert.ok(tall.scroll>tall.height);assert.ok(tall.offset>0);assert.equal(tall.width,initial.width);assert.ok(tall.last<=tall.bottom+1);assert.ok(tall.bottom<=360);
          await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
        }
      }
      await navigate('posts/long-reading/');
      assert.equal(await evaluate('!!document.querySelector(".sidebar-sticky")'),false);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('${width>900?'.toc-sidebar':'.mobile-toc'}')).display!=='none'`),true);
    }
    if(process.env.MILO_TEST_SIDEBAR_ONLY==='1'){
      for(const width of [1280,900,801,390,360]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<=800});
        await navigate('');
        for(const mode of ['light','dark']){await evaluate('localStorage.setItem("milo-appearance",'+JSON.stringify(mode)+')');await checkSidebar(width,mode)}
        console.log('Sidebar passed: '+width+'px, light/dark, author flow, sticky range/parent boundary, disabled/mobile behavior and article TOC.');
      }
      assert.deepEqual(errors,[]);return;
    }
    if(process.env.MILO_TEST_SEARCH_ONLY==='1'){
      for(const width of [1280,390,360]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
        await navigate('search/');
        for(const mode of ['light','dark']){
          await evaluate('localStorage.setItem("milo-appearance",'+JSON.stringify(mode)+')');
          await checkSearchWrap(width,mode);
        }
        console.log('Search wrap passed: '+width+'px, light/dark, plain/repeated/alternating text, original excerpt and sidebar bounds.');
      }
      assert.deepEqual(errors,[]);return;
    }
    async function checkCoverSizing(width,mode){
      await navigate('');
      const actual=await evaluate(`(()=>[...document.querySelectorAll('.entry .cover')].map(cover=>{const img=cover.querySelector('img'),r=cover.getBoundingClientRect(),i=img.getBoundingClientRect(),style=getComputedStyle(cover);return {container:r.height,image:i.height,width:r.width,align:style.alignSelf,parentAlign:getComputedStyle(cover.parentElement).alignItems,radius:style.borderRadius,overflow:style.overflow}}))()`);
      for(const item of actual)assert.ok(Math.abs(item.container-item.image)<1,'Actual cover stretched: '+JSON.stringify(item));
      const cases=await evaluate(`(async()=>{
        const main=document.querySelector('#main'),entry=main.querySelector('.entry').cloneNode(true);
        // Keep the original scrollbar while varying only the article copy.
        main.style.minHeight=main.getBoundingClientRect().height+'px';main.replaceChildren(entry);
        const copy=entry.querySelector('.entry-copy'),cover=entry.querySelector('.cover'),img=cover.querySelector('img');
        const measure=()=>{const r=cover.getBoundingClientRect(),i=img.getBoundingClientRect(),c=copy.getBoundingClientRect(),e=entry.getBoundingClientRect(),style=getComputedStyle(cover),row=getComputedStyle(entry);return {width:r.width,height:r.height,imageHeight:i.height,top:r.top,imageTop:i.top,copyTop:c.top,copyHeight:c.height,copyWidth:c.width,titleWidth:copy.querySelector('h2').getBoundingClientRect().width,titleBottom:copy.querySelector('h2').getBoundingClientRect().bottom,summaryTop:copy.querySelector('p').getBoundingClientRect().top,coverBottom:r.bottom,left:r.left,align:style.alignSelf,overflow:style.overflow,radii:[style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomLeftRadius,style.borderBottomRightRadius],fit:getComputedStyle(img).objectFit,rowHeight:e.height,expectedHeight:Math.max(c.height,r.height)+parseFloat(row.paddingBottom)+parseFloat(row.borderBottomWidth),gap:row.gap,padding:row.paddingBottom,margin:row.marginBottom}};
        const results=[];
        for(const fit of ['cover','contain'])for(const [w,h] of [[1200,400],[300,900],[600,600]]){
          cover.classList.toggle('cover-contain',fit==='contain');
          await new Promise(resolve=>{img.onload=resolve;img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="#1764b0"/></svg>')});
          const variants=[];
          for(const [title,text] of [['短文','一则短札。'],['普通标题','这是一段较长的文章摘要，用于确认文字自然换行之后不会拉长封面的裁剪区域。'.repeat(8)],['用于检查窄屏上长标题多行换行的文章标题'.repeat(5),'常规摘要。']]){
            copy.querySelector('h2 a').textContent=title;copy.querySelector('p').textContent=text;variants.push(measure());
          }
          results.push({fit,variants});
        }
        cover.remove();copy.classList.remove('has-cover');const noCover={count:entry.querySelectorAll('.cover').length,overflow:entry.scrollWidth<=entry.clientWidth};
        return {results,noCover,viewport:innerWidth,overflow:document.documentElement.scrollWidth};
      })()`);
      assert.ok(actual.length>0);assert.equal(cases.viewport,width);assert.ok(cases.overflow<=width);assert.equal(cases.noCover.count,0);assert.equal(cases.noCover.overflow,true);
      for(const {fit,variants} of cases.results){const first=variants[0];for(const item of variants){
        assert.equal(item.align,width>800?'center':'flex-start');assert.equal(item.fit,fit);assert.equal(item.overflow,'hidden');assert.ok(item.radii.every(r=>parseFloat(r)>0));
        assert.ok(Math.abs(item.height-item.imageHeight)<1);assert.ok(Math.abs(item.top-item.imageTop)<1);if(width>800)assert.ok(Math.abs(item.width/item.height-5/3)<0.02);
        else{assert.ok(Math.abs(item.height-Math.min(item.width*9/16,240))<1);assert.ok(Math.abs(item.width-item.copyWidth)<1);assert.ok(Math.abs(item.titleWidth-item.copyWidth)<1);assert.ok(item.top>=item.titleBottom+13);assert.ok(item.summaryTop>=item.coverBottom+13)}
        if(width>800)assert.ok(Math.abs(item.top-(item.copyTop+(item.copyHeight-item.height)/2))<1,'Desktop cover vertical alignment');
        for(const key of ['width','height','left','gap','padding','margin'])assert.equal(item[key],first[key],key+' varies with copy length');
        assert.ok(Math.abs(item.rowHeight-item.expectedHeight)<1,'Row should size naturally');
      }}
    }
    async function checkHomeHeading(page){
      const heading=await evaluate(`(()=>{const h=document.querySelector('#main>h1'),style=getComputedStyle(h),entry=document.querySelector('.entry'),before=entry.getBoundingClientRect().top;h.remove();const after=entry.getBoundingClientRect().top;document.querySelector('#main').prepend(h);return {count:document.querySelectorAll('h1').length,text:h.textContent,hidden:h.hidden||h.getAttribute('aria-hidden')==='true',display:style.display,visibility:style.visibility,position:style.position,width:style.width,height:style.height,clip:style.clipPath,shift:after-before,title:document.querySelector('.brand').textContent.trim()}})()`);
      assert.equal(heading.count,1);assert.equal(heading.text,heading.title+' · 文章列表'+(page>1?' · 第 '+page+' 页':''));
      assert.equal(heading.hidden,false);assert.notEqual(heading.display,'none');assert.equal(heading.visibility,'visible');assert.equal(heading.position,'absolute');assert.equal(heading.width,'1px');assert.equal(heading.height,'1px');assert.notEqual(heading.clip,'none');assert.equal(heading.shift,0);
      const tree=await send('Accessibility.getFullAXTree');
      assert.ok(tree.nodes.some(n=>!n.ignored && n.role?.value==='heading' && n.name?.value===heading.text && n.properties?.some(p=>p.name==='level' && p.value.value===1)),'Accessible level-one heading');
    }
    // Set MILO_ENTITY_FIXTURE_DIR for npm test and this command to reuse real Hexo output.
    async function checkSummaryEntities(){
      if(!process.env.MILO_ENTITY_FIXTURE_DIR)return;
      const expected=JSON.parse(await fs.readFile(path.join(process.env.MILO_ENTITY_FIXTURE_DIR,'expected.json'),'utf8'));
      for(const name of ['root.html','demo.html']){
        const html=await fs.readFile(path.join(process.env.MILO_ENTITY_FIXTURE_DIR,name),'utf8');
        const paragraphs=html.match(/<p>github[\s\S]*?<\/p>/g);assert.equal(paragraphs?.length,2);
        await navigate('');
        const result=await evaluate(`(async()=>{const frame=document.createElement('iframe');frame.style.width='100%';document.querySelector('#main').append(frame);await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=${JSON.stringify(paragraphs.join(''))}});const d=frame.contentDocument;return {texts:[...d.querySelectorAll('p')].map(p=>p.textContent),elements:d.querySelectorAll('p>*').length,executed:!!frame.contentWindow.__miloXSS}})()`);
        assert.deepEqual(result.texts,[expected,expected]);assert.equal(result.elements,0);assert.equal(result.executed,false);
      }
    }
    async function checkScreenshotImages(width,mode){
      await navigate('');
      const result=await evaluate(`(async()=>{
        const main=document.querySelector('#main');main.innerHTML='<article class="entry"><div class="entry-copy has-cover"><div class="meta">Metadata</div><h2>Screenshot fixture</h2><a class="cover cover-contain"><img width="300" height="180" alt=""></a><p>Excerpt</p></div></article><div class="prose"><img class="milo-screenshot" width="1200" height="800" alt="Screenshot"></div>';
        const cover=main.querySelector('.cover img'),body=main.querySelector('.prose img');
        const box=img=>{const r=img.getBoundingClientRect();return [r.width,r.height]};
        const before=box(cover),results=[];
        for(const [w,h] of [[1200,400],[300,900],[600,600]]){
          const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="white"/></svg>');
          await new Promise(resolve=>{cover.onload=resolve;cover.src=src});body.src=src;
          results.push({box:box(cover),fit:getComputedStyle(cover).objectFit,natural:[cover.naturalWidth,cover.naturalHeight]});
        }
        await new Promise(resolve=>{cover.onerror=resolve;cover.src='data:image/png;base64,broken'});
        const failed=box(cover),border=getComputedStyle(body).outlineWidth,framed=box(body);
        body.classList.remove('milo-screenshot');const plain=box(body);
        cover.parentElement.classList.remove('cover-contain');
        return {before,results,failed,framed,plain,border,defaultFit:getComputedStyle(cover).objectFit,overflow:document.documentElement.scrollWidth,viewport:innerWidth,bodyWidth:framed[0],mainWidth:main.clientWidth};
      })()`);
      assert.ok(result.before[0]>0);if(width>800)assert.ok(Math.abs(result.before[0]/result.before[1]-5/3)<0.02);else assert.ok(Math.abs(result.before[1]-Math.min(result.before[0]*9/16,240))<1);
      for(const item of result.results){assert.equal(item.fit,'contain');assert.deepEqual(item.box,result.before);assert.ok(item.natural[0]>0)}
      assert.deepEqual(result.failed,result.before);assert.deepEqual(result.framed,result.plain);
      assert.equal(result.defaultFit,'cover');assert.equal(result.border,'1px');assert.equal(result.viewport,width);assert.ok(result.overflow<=width);assert.ok(result.bodyWidth<=result.mainWidth);
      await evaluate(`(async()=>{const image=document.querySelector('.cover img');image.parentElement.classList.add('cover-contain');document.querySelector('.prose img').classList.add('milo-screenshot');image.src=document.querySelector('.prose img').src;await image.decode()})()`);
      await screenshot('milo-screenshot-'+width+'-'+mode);
    }
    if(process.env.MILO_TEST_IMAGES_ONLY==='1'){
      for(const width of [1280,390,360])for(const mode of ['light','dark']){
        await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<801});
        await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});
        await checkScreenshotImages(width,mode);
      }
      assert.deepEqual(errors,[]);console.log('Passed screenshot image viewport/theme matrix.');return;
    }
    if(process.env.MILO_TEST_COVERS_ONLY==='1'){
      for(const width of [1280,801,800,480,390,360,320])for(const mode of ['light','dark']){
        await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<801});
        await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});
        await checkCoverSizing(width,mode);
      }
      assert.deepEqual(errors,[]);console.log('Passed cover sizing matrix.');return;
    }
    let combinations=0;
    for(const width of [1280,801,800,480,390,360,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
      await navigate('');
      const home=await evaluate(`(()=>{const nav=document.querySelector('.topbar').getBoundingClientRect(),heading=document.querySelector('.entry').getBoundingClientRect(),entries=[...document.querySelectorAll('.entry')];return {y:scrollY,width:innerWidth,clientWidth:document.documentElement.clientWidth,headingTop:heading.top,navBottom:nav.bottom,count:entries.length,rows:entries.map(e=>{const r=e.getBoundingClientRect(),copy=e.querySelector('.entry-copy');return {top:r.top,bottom:r.bottom,width:copy.clientWidth,scroll:copy.scrollWidth}})}})()`);
      // innerWidth itself can expand with mobile overflow: compare to device width.
      assert.equal(home.width,width,'Expanded layout viewport');
      assert.ok(home.clientWidth<=width);assert.equal(home.y,0);assert.equal(home.count,6);
      assert.ok(home.headingTop>=home.navBottom);
      home.rows.forEach((row,i)=>{assert.ok(row.scroll<=row.width+1,'Excerpt overflow');if(i)assert.ok(row.top>=home.rows[i-1].bottom,'Overlapping rows')});
      await screenshot('milo-home-after-'+width);
      const topRefresh=loaded();await send('Page.reload',{ignoreCache:true});await topRefresh;await wait(100);
      assert.equal(await evaluate('scrollY'),0,'Reload from the top');
      await evaluate('scrollTo({top:650,behavior:"instant"})');
      const y=await evaluate('scrollY'),refresh=loaded();await send('Page.reload',{ignoreCache:true});await refresh;await wait(150);
      assert.ok(Math.abs(await evaluate('scrollY')-y)<=1,'Native reload scroll restoration');
      if(process.env.MILO_TEST_HMR==='1'){
        await wait(300);const before=await evaluate('Number(sessionStorage.getItem("milo-test-loads"))');
        const file=path.resolve(__dirname,'../source/css/milo.css'),original=await fs.readFile(file),marker='\n/* milo-round6-hmr-'+Date.now()+' */\n';
        try{await fs.appendFile(file,marker);await until(async()=>await evaluate('Number(sessionStorage.getItem("milo-test-loads"))')>before,'live reload');await wait(150);assert.ok(Math.abs(await evaluate('scrollY')-y)<=1,'Hot reload scroll restoration')}
        finally{const current=await fs.readFile(file,'utf8');assert.ok(current.includes(marker));await fs.writeFile(file,current.replace(marker,''));}
        await until(async()=>!(await (await fetch(new URL('css/milo.css',site))).text()).includes(marker),'restore CSS');await wait(600);
        assert.ok((await fs.readFile(file)).equals(original),'CSS source restoration');
      }
      await evaluate('scrollTo({top:document.body.scrollHeight,behavior:"instant"})');await wait(80);
      assert.equal(await evaluate('Math.round(document.querySelector(".footer").getBoundingClientRect().bottom)'),844);
      assert.equal(await evaluate('document.querySelector(".pager").getBoundingClientRect().bottom<=document.querySelector(".footer").getBoundingClientRect().top'),true);
      for(const mode of ['light','dark']){
        await evaluate('localStorage.setItem("milo-appearance",'+JSON.stringify(mode)+')');
        await navigate('');
        const layout=await evaluate(`(()=>{const entry=document.querySelector('.entry'),r=entry.getBoundingClientRect(),profile=document.querySelector('.profile'),nav=document.querySelector('.topbar').getBoundingClientRect();return {heading:!!document.querySelector('#main .page-heading'),first:document.querySelector('#main>h1').nextElementSibling===entry,gap:r.top-nav.bottom,aligned:Math.abs(r.top-profile.getBoundingClientRect().top),width:innerWidth,overflow:document.documentElement.scrollWidth}})()`);
        assert.equal(layout.heading,false);assert.equal(layout.first,true);assert.ok(Math.abs(layout.gap-(width<=800?34:56))<1);
        if(width>800)assert.ok(layout.aligned<1,'First article and author card align');
        assert.equal(layout.width,width);assert.ok(layout.overflow<=width);
        await checkHomeHeading(1);
        await screenshot('milo-home-no-heading-'+width+'-'+mode);
        await navigate('page/2/');assert.equal(await evaluate('document.querySelectorAll(".entry").length'),1);
        assert.equal(await evaluate('!!document.querySelector("#main .page-heading")'),false);
        await checkHomeHeading(2);
        await navigate('missing-round6/');
        const missing=await evaluate(`(()=>{const main=document.querySelector('.not-found'),rect=main.getBoundingClientRect(),buttons=[...main.querySelectorAll('a')].map(a=>a.getBoundingClientRect());return {title:main.querySelector('h1').textContent,align:getComputedStyle(main).textAlign,label:Number.parseFloat(getComputedStyle(main.querySelector('.not-found-code')).fontSize),left:rect.left+Number.parseFloat(getComputedStyle(main).paddingLeft),brand:document.querySelector('.brand').getBoundingClientRect().left,buttons:buttons.length,sameRow:Math.abs(buttons[0].top-buttons[1].top)<1,footer:Math.round(document.querySelector('.footer').getBoundingClientRect().bottom),width:innerWidth}})()`);
        assert.equal(missing.title,'你在寻找什么？');assert.equal(missing.align,'left');assert.ok(missing.label<=14);assert.ok(Math.abs(missing.left-missing.brand)<1);assert.equal(missing.buttons,2);assert.equal(missing.sameRow,true);assert.equal(missing.footer,844);assert.equal(missing.width,width);
        await screenshot('milo-404-after-'+width+'-'+mode);
        const searchReady=loaded();await evaluate('document.querySelector(".not-found-secondary").click()');await searchReady;
        assert.equal(await evaluate('!!document.querySelector(".search-form")'),true);
        // Ordinary-page search still submits natively and carries the keyword.
        await navigate('');if(width<801)await evaluate('document.querySelector(".mobile-search").click()');
        const submitted=loaded();await evaluate('document.querySelector(".nav-search input").value="代码";document.querySelector(".nav-search").requestSubmit()');await submitted;
        await until(async()=>await evaluate('document.querySelector("#search-q")?.value==="代码" && document.querySelectorAll(".search-result").length>0'),'search results');
        assert.equal(await evaluate('document.querySelectorAll("input[type=search]").length'),1);
        assert.equal(await evaluate('!!document.querySelector(".nav-search,.mobile-search")'),false);
        assert.ok(await evaluate('document.querySelectorAll(".search-result mark").length')>0);
        assert.equal(await evaluate('innerWidth'),width);
        await screenshot('milo-search-after-'+width+'-'+mode);
        for(const query of ['function','inline code','console.log','(name)','${name}','<img src=x onerror=alert(1)>']){
          await navigate('search/?q='+encodeURIComponent(query));
          await until(async()=>await evaluate('!document.querySelector(".search-status").textContent.includes("正在搜索")'),'updated search');
          assert.equal(await evaluate('document.querySelector("#search-q").value'),query);
          assert.equal(await evaluate('!!document.querySelector(".search-results img,.search-results script")'),false);
          const matches=posts.filter(p=>[p.title,p.content,...p.tags].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
          assert.deepEqual(await evaluate('[...document.querySelectorAll(".search-result h2")].map(h=>h.textContent)'),matches.map(p=>p.title),'Original filter/order: '+query);
          if(matches.some(p=>(p.title+' '+p.content).toLocaleLowerCase().includes(query.toLocaleLowerCase())))assert.ok(await evaluate('document.querySelectorAll(".search-result mark").length')>0,query+' literal highlight');
        }
        await checkCoverSizing(width,mode);
        await checkSummaryEntities();
        await checkScreenshotImages(width,mode);
        await checkSidebar(width,mode);
        await checkSearchWrap(width,mode);
        await checkReading(width,mode);
        combinations++;
      }
      console.log('Browser checks passed: '+width+'px, archive/all posts, reading progress, nested TOC, code scrolling/copy, delayed images/lightbox, plus prior page regressions.');
    }
    assert.equal((await fetch(new URL('missing-round6/',site))).status,404);
    assert.deepEqual(errors,[]);
    console.log('Passed '+combinations+' viewport/theme combinations.');
  }finally{ws?.close();browser.kill();await wait(300);await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{});}
})().catch(error=>{console.error(error.stack || error);process.exitCode=1});
