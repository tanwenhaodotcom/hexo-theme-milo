'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {withChromium}=require('./support/chromium.cjs');
withChromium(process.env.MILO_SITE_DIR||'../milo-preview/public',async({send,evaluate:inspect,navigate,screenshot,errors,output})=>{
    const phase=process.env.MILO_PHASE||'after',fixture=process.env.MILO_FIXTURE==='1',results=[],shots=[];
    const widths=process.env.MILO_RELEASE_MATRIX==='1'
      ? [320,390,800,801,900,1023,1024,1280,1440]
      : process.env.MILO_TABLET_ONLY==='1'
      ? [800,800.5,801,900,1023,1023.5,1024]
      : [320,375,480,768,800,801,900,1024,1280,1440];
    for(const width of widths)for(const mode of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width:Math.ceil(width),height:900,deviceScaleFactor:1,mobile:false});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});
      for(let page=1;page<=(fixture?8:2);page++){
        await navigate(page===1?'':`page/${page}/`);
        const fractional=!Number.isInteger(width);
        // CDP accepts only integer widths. A same-origin frame supplies the fractional CSS viewport.
        if(fractional)await inspect(`new Promise(resolve=>{
          const frame=document.createElement('iframe');
          frame.style.cssText='display:block;border:0;zoom:2;width:${width}px;height:900px';
          frame.onload=resolve;
          frame.src=location.href;
          document.body.replaceChildren(frame);
        })`);
        const evaluate=expression=>fractional
          ? inspect('document.querySelector("iframe").contentWindow.eval('+JSON.stringify(expression)+')')
          : inspect(expression);
        await evaluate(`document.documentElement.dataset.mode='${mode}';document.querySelectorAll('img').forEach(i=>i.loading='eager');document.documentElement.style.scrollBehavior='auto'`);
        await evaluate(`Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))`);
        const metrics=await evaluate(`(()=>{const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {overflow:document.documentElement.scrollWidth,viewport:innerWidth,nearby:[800,800.5,801,1023,1023.5,1024].filter(w=>matchMedia('(width: '+w+'px)').matches),exact:matchMedia('(width: '+${width}+'px)').matches,identity:!!document.querySelector('.mobile-identity')?.getClientRects().length,sidebar:getComputedStyle(document.querySelector('.sidebar')).display,controls:[...document.querySelectorAll('.topbar button')].filter(e=>e.getClientRects().length).map(e=>({width:box(e).width,height:box(e).height})),entries:[...document.querySelectorAll('.entry')].map(e=>{const title=e.querySelector('h2'),summary=e.querySelector('p'),range=document.createRange();range.selectNodeContents(summary);const visibleLines=new Set([...range.getClientRects()].filter(r=>r.top<summary.getBoundingClientRect().bottom).map(r=>r.top)).size;const cover=e.querySelector('.cover'),image=cover?.querySelector('img'),copy=e.querySelector('.entry-copy');return {title:title.textContent,titleBox:box(title),summary:box(summary),summaryLines:visibleLines,copy:box(copy),cover:cover?box(cover):null,fit:image?getComputedStyle(image).objectFit:null,natural:image?.naturalWidth,titleOverflow:title.scrollWidth>title.clientWidth+1}})}})()`);
        assert.equal(metrics.exact,true,'Requested CSS viewport '+width+' actual '+metrics.nearby+' innerWidth '+metrics.viewport);
        assert.equal(metrics.sidebar==='none',phase==='after'?width<1024:width<=800);
        if(phase==='after')assert.equal(metrics.identity,page===1&&width<1024);
        assert.ok(metrics.controls.length>=2 && metrics.controls.every(b=>b.width>=(width<=800?44:36) && b.height>=(width<=800?44:36)),'Navigation hit areas');
        assert.ok(metrics.overflow<=width,'Page overflow '+JSON.stringify({width,mode,page}));assert.equal(metrics.entries.length,6);
        for(const [index,e] of metrics.entries.entries()){
          if(fixture){
            const item=(page-1)*6+index,summary=item%4,title=Math.floor(item%16/4);
            assert.equal(e.fit,[null,'cover','contain'][Math.floor(item/16)],'Expected cover mode');
            if(phase==='after' && summary===0)assert.equal(e.summary.height,0,'Empty summary reserves no space');
            if(summary===1)assert.ok(e.summaryLines>0 && e.summaryLines<=1.05,'Short summary stays one line');
            if(title===3)assert.ok(e.title.length>100,'Continuous English title remains intact');
          }
          if(index)assert.ok(e.copy.top>=metrics.entries[index-1].copy.bottom,'Rows must not overlap');
          assert.equal(e.titleOverflow,false,'Title overflow '+JSON.stringify({width,page,index}));
          assert.ok(e.titleBox.left>=-1 && e.titleBox.right<=width+1);
          if(e.cover){assert.ok(e.natural>0);assert.ok(Math.abs(e.cover.width/e.cover.height-1.6)<.02,'16:10');assert.ok(e.cover.right<=width+1);if(phase==='after' && width>800){assert.ok(Math.abs(e.titleBox.width-e.copy.width)<1,'Full-width title');assert.ok(e.cover.top>=e.titleBox.bottom-1,'Cover below title');if(e.summary.height){assert.ok(e.cover.left>=e.summary.right-1);assert.ok(Math.abs((e.cover.top+e.cover.bottom)-(e.summary.top+e.summary.bottom))<2,'Cover centered on excerpt');}}if(width<=800 && phase==='after'){assert.ok(e.cover.top>=e.titleBox.bottom-1);if(e.summary.height)assert.ok(e.summary.top>=e.cover.bottom-1);}}
          if(phase==='after'){assert.ok(e.summaryLines<=(e.cover&&width>800?5:4),'Excerpt bounded');if(!e.cover&&e.summary.height)assert.ok(Math.abs(e.summary.width-e.copy.width)<1,'Uncovered excerpt uses full width');}
        }
        results.push({width,mode,page,...metrics});
        if([320,375,390,800,801,900,1023,1024,1280,1440].includes(width) && (!fixture || [1,6,8].includes(page))){
          const scenario=fixture?`fixture-page-${page}`:`demo-page-${page}`;
          // 截图标签仅用于验收，不改变正文的布局。
          await evaluate(`(()=>{const label=document.createElement('div');label.id='qa-label';label.textContent='${phase} | ${width} × 900 | ${mode} | ${scenario}';label.style.cssText='position:fixed;bottom:8px;left:8px;z-index:9999;padding:6px 10px;background:#111;color:#fff;font:12px sans-serif;pointer-events:none;border-radius:4px';document.body.append(label)})()`);
          await screenshot(`${phase}-${width}-${mode}-${scenario}`);shots.push(`${phase}-${width}-${mode}-${scenario}.png`);await evaluate(`document.querySelector('#qa-label').remove()`);
        }
      }
    }
    await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,phase+(fixture?'-fixtures':'-demo')+'-results.json'),JSON.stringify({phase,fixture,combinations:results.length,articles:results.reduce((a,r)=>a+r.entries.length,0),results,shots,errors},null,2));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({phase,fixture,pages:results.length,articles:results.reduce((a,r)=>a+r.entries.length,0),shots:shots.length}));
}).catch(error=>{console.error(error.stack||error);process.exitCode=1});
