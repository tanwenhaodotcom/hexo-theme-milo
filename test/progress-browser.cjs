'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {withChromium}=require('./support/chromium.cjs');
withChromium(process.env.MILO_SITE_DIR||'../milo-preview/.local-tests/reading/public',async({send,evaluate,navigate,until,screenshot,errors,output,wait})=>{
    const results=[];
    for(const width of [320,375,480,768,800,801,900,1024,1280,1440])for(const mode of ['light','dark']){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});
      await navigate('posts/long-reading/');await evaluate(`document.documentElement.dataset.mode='${mode}';document.documentElement.style.scrollBehavior='auto'`);
      for(const value of [0,50,100]){
        await evaluate(`(()=>{const a=document.querySelector('#post-content').getBoundingClientRect(),offset=parseFloat(document.documentElement.style.getPropertyValue('--reading-offset')),distance=a.height-Math.max(0,innerHeight-offset);scrollTo({top:${value}===0?0:scrollY+a.top-offset+distance*${value}/100,behavior:'instant'})})()`);
        await until(()=>evaluate(`document.querySelector('progress').value===${value}`),'progress '+value);await wait(150);
        const state=await evaluate(`(()=>{const p=document.querySelector('.reading-progress'),r=p.getBoundingClientRect(),nav=document.querySelector('.topbar').getBoundingClientRect(),bar=p.querySelector('progress');return {width:innerWidth,viewport:document.documentElement.clientWidth,barWidth:r.width,height:r.height,navBottom:nav.bottom,top:r.top,value:bar.value,max:bar.max,label:document.querySelector('label[for="reading-progress"]').textContent,pointer:getComputedStyle(p).pointerEvents,z:Number(getComputedStyle(p).zIndex),navZ:Number(getComputedStyle(document.querySelector('.topbar')).zIndex),percent:getComputedStyle(p.querySelector('span')).display}})()`);
        assert.equal(state.width,width);assert.equal(state.barWidth,state.viewport);assert.equal(state.height,3);assert.ok(Math.abs(state.top-state.navBottom)<1);assert.equal(state.pointer,'none');assert.ok(state.z<state.navZ,'Navigation controls stay above the progress bar');assert.equal(state.percent,'none');assert.equal(state.max,100);assert.equal(state.label,'正文阅读进度');results.push({mode,...state});
        if([375,1280].includes(width)){
          await evaluate(`(()=>{const label=document.createElement('div');label.id='qa-label';label.textContent='${width} × 900 | ${mode} | reading ${value}%';label.style.cssText='position:fixed;bottom:8px;left:8px;z-index:9999;background:#111;color:#fff;padding:6px 10px;font:12px sans-serif';document.body.append(label)})()`);
          await screenshot(`progress-${width}-${mode}-${value}`);await evaluate(`document.querySelector('#qa-label').remove()`);
        }
      }
      await evaluate(`document.querySelector('.topbar').style.paddingTop='24px'`);
      await until(()=>evaluate(`Math.abs(document.querySelector('.reading-progress').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)<1`),'navigation resize observer');
      await navigate('posts/short-note/');await evaluate(`document.querySelector('#post-content').scrollIntoView({block:'center',behavior:'instant'})`);await until(()=>evaluate(`document.querySelector('progress').value===100`),'short article');
      const ax=await send('Accessibility.getFullAXTree');assert.ok(ax.nodes.some(n=>n.role?.value==='progressbar' && n.name?.value==='正文阅读进度'));
    }
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'progress-results.json'),JSON.stringify({states:results.length,results,shortArticleCases:20,navigationResizeCases:20,errors},null,2));console.log('Passed 60 progress states, 20 short-article and 20 navigation-resize cases, accessible progressbar.');
}).catch(error=>{console.error(error.stack||error);process.exitCode=1});
