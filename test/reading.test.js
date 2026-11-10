'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {JSDOM}=require('jsdom');

async function setup(lightbox=true,beforeScripts=()=>{}){
  const dom=new JSDOM(`<header class="topbar"></header><details class="mobile-toc" open><summary>本文目录</summary><a class="toc-link" href="#chapter">Chapter</a></details><aside class="toc"><a href="#chapter">Chapter</a><a href="#end">End</a></aside><div class="reading-progress" hidden><progress max="100"></progress><span></span></div><article id="post-content" data-lightbox="${lightbox}"><h2 id="chapter">Chapter</h2><figure class="highlight js"><table><tr><td class="gutter"><pre><span class="line">1</span>\n<span class="line">2</span></pre></td><td class="code"><pre><span class="line">const x = &lt;value&gt;;</span>\n<span class="line">  x++;</span></pre></td></tr></table></figure><pre><code>plain\n  code</code></pre><img src="image.png" alt="Preview"><a href="original.html"><img src="linked.png" alt="Linked"></a><h2 id="end">End</h2></article>`,{url:'https://example.com/demo/post/',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  const frames=[];w.requestAnimationFrame=cb=>{frames.push(cb);return frames.length};
  w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true'};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button').focus()};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
  let top=100;
  Object.defineProperty(w,'innerHeight',{value:800,writable:true});
  d.querySelector('.topbar').getBoundingClientRect=()=>({bottom:80});
  d.querySelector('article').getBoundingClientRect=()=>({top,bottom:top+2000,height:2000});
  d.querySelector('#chapter').getBoundingClientRect=()=>({top});
  d.querySelector('#end').getBoundingClientRect=()=>({top:top+1800});
  beforeScripts(w,d);
  for(const script of ['milo.js','reading.js'])w.eval(await fs.readFile(path.join(__dirname,'../source/js',script),'utf8'));
  return {dom,w,d,scroll(value){top=value;w.dispatchEvent(new w.Event('scroll'));while(frames.length)frames.shift()();}};
}

test('reading progress, chapter highlight, mobile anchor focus and no-TOC fallback',async()=>{
  const {dom,w,d,scroll}=await setup();
  assert.equal(d.querySelector('progress').value,0);
  assert.equal(d.querySelector('.reading-progress').hidden,false);
  scroll(-552);assert.equal(d.querySelector('progress').value,50);
  // Native anchor scrolling can stop at a fractional pixel past scroll-margin.
  scroll(-1703.5);assert.equal(d.querySelector('a[href="#end"]').getAttribute('aria-current'),'location');
  scroll(-2100);assert.equal(d.querySelector('progress').value,100);
  assert.equal(d.querySelector('a[href="#end"]').getAttribute('aria-current'),'location');
  d.querySelector('.toc-link').click();
  assert.equal(d.querySelector('details').open,false);
  assert.equal(d.activeElement.id,'chapter');
  assert.equal(d.activeElement.dataset.scrolled,'true');
  assert.equal(w.location.hash,'#chapter');
  dom.window.close();
});

test('copy excludes gutter, preserves newlines; failure and fallback are handled',async()=>{
  const {dom,w,d}=await setup();
  const buttons=d.querySelectorAll('.copy-code');
  assert.equal(buttons.length,2);
  let copied;
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text}}});
  buttons[0].click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(copied,'const x = <value>;\n  x++;');
  assert.equal(d.querySelector('.copy-status').textContent,'已复制');
  w.navigator.clipboard.writeText=async()=>{throw Error('Denied')};
  buttons[1].click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(d.querySelectorAll('.copy-status')[1].textContent,'复制失败，请手动选择代码');
  assert.equal(buttons[1].disabled,false);
  delete w.navigator.clipboard;
  d.execCommand=command=>{assert.equal(command,'copy');copied=d.querySelector('textarea').value;return true};
  buttons[1].focus();buttons[1].click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(copied,'plain\n  code');assert.equal(d.querySelector('textarea'),null);
  assert.equal(d.activeElement,buttons[1]);
  dom.window.close();
});

test('rejected Clipboard API falls back and preserves keyboard focus and text selection',async()=>{
  const {dom,w,d}=await setup();
  let copied;
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('NotAllowedError')}}});
  d.execCommand=()=>{copied=d.querySelector('textarea').value;return true};
  const button=d.querySelector('.copy-code');button.focus();
  const range=d.createRange();range.selectNodeContents(d.querySelector('#chapter'));
  w.getSelection().removeAllRanges();w.getSelection().addRange(range);
  assert.equal(w.getSelection().toString(),'Chapter');
  button.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(copied,'const x = <value>;\n  x++;');
  assert.equal(d.activeElement,button);
  assert.equal(w.getSelection().toString(),'Chapter');
  assert.equal(button.hasAttribute('aria-busy'),false);
  assert.equal(d.querySelector('textarea'),null);
  dom.window.close();
});

test('unsupported dialog and legacy media-query listener degrade without runtime errors',async()=>{
  let listener;
  const {dom,d}=await setup(true,w=>{
    delete w.HTMLDialogElement.prototype.showModal;
    w.matchMedia=()=>({matches:false,addListener:fn=>{listener=fn}});
  });
  assert.equal(typeof listener,'function');
  assert.equal(d.querySelector('.lightbox-image'),null);
  assert.equal(d.querySelectorAll('.copy-code').length,2);
  dom.window.close();
});

test('optional lightbox supports keyboard, close and focus return, preserving linked images',async()=>{
  const {dom,w,d}=await setup();
  const image=d.querySelector('article>img');
  assert.equal(image.getAttribute('role'),'button');
  assert.equal(d.querySelector('a img').hasAttribute('role'),false);
  image.focus();image.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  const dialog=d.querySelector('dialog');assert.equal(dialog.open,true);
  assert.equal(dialog.querySelector('img').alt,'Preview');
  for(const shiftKey of [false,true]){
    const event=new w.KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true});
    dialog.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
    assert.equal(d.activeElement,dialog.querySelector('button'));
  }
  dialog.querySelector('button').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,image);
  image.click();dialog.close();assert.equal(d.documentElement.classList.contains('lightbox-open'),false);
  image.click();dialog.click();assert.equal(dialog.open,false);
  dom.window.close();
  const disabled=await setup(false);
  assert.equal(disabled.d.querySelector('.lightbox-image'),null);
  disabled.dom.window.close();
});


test('navigation observer tracks border-box changes without extra scroll listeners',async()=>{
  const observed=[];let scrollListeners=0;
  const {dom,d}=await setup(true,w=>{
    w.ResizeObserver=class{observe(element,options){observed.push({element,options})}};
    const add=w.addEventListener.bind(w);w.addEventListener=(type,...args)=>{if(type==='scroll')scrollListeners++;return add(type,...args)};
  });
  const nav=observed.find(item=>item.element===d.querySelector('.topbar'));
  assert.equal(nav.options.box,'border-box');assert.equal(scrollListeners,1);
  assert.equal(d.documentElement.style.getPropertyValue('--reading-offset'),'96px');
  dom.window.close();
});
