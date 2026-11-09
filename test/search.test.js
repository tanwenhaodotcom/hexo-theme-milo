'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(query,posts){
  const dom=new JSDOM('<form class="search-form" data-index="/demo/search.json"><input type="search"></form><p class="search-status"></p><div class="search-results"></div>',{url:'https://example.com/demo/search/?q='+encodeURIComponent(query),runScripts:'outside-only'});
  const {window:w}=dom,d=w.document;let requests=0;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.fetch=async()=>{requests++;return {ok:true,json:async()=>posts}};
  w.eval(await fs.readFile(path.join(__dirname,'../source/js/milo.js'),'utf8'));
  await tick();
  return {dom,w,d,requests:()=>requests,async submit(value){d.querySelector('input').value=value;d.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick()}};
}
const post=(title,content,tags=[])=>({title,content,tags,url:'/demo/post/'});

test('Chinese and English matches highlight every visible occurrence and update on input',async()=>{
  const title='中文 Milo 中文 MILO',content='中文与中文，Milo and MILO.';
  const app=await setup('中文',[post(title,content)]);
  try{
    const {d,w}=app;
    assert.equal(d.querySelector('input').value,'中文');
    assert.deepEqual([...d.querySelectorAll('h2 mark')].map(n=>n.textContent),['中文','中文']);
    assert.equal(d.querySelectorAll('.search-result p mark').length,2);
    assert.equal(d.querySelector('h2').textContent,title);
    assert.equal(d.querySelector('.search-result p').textContent,content+'…');
    d.querySelector('input').value='milo';d.querySelector('input').dispatchEvent(new w.Event('input',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,230));
    assert.deepEqual([...d.querySelectorAll('h2 mark')].map(n=>n.textContent),['Milo','MILO']);
    assert.equal(d.querySelectorAll('.search-result p mark').length,2);
    assert.equal(d.querySelector('.search-result p').textContent,content+'…');
    assert.equal(app.requests(),1);
    await app.submit('');assert.equal(d.querySelectorAll('.search-result,mark').length,0);
  }finally{app.dom.window.close()}
});

test('multiple highlight terms leave the existing full-query filter and result order unchanged',async()=>{
  const posts=[post('Tag-only match','Unchanged text',['中文 Milo']),post('中文 Milo，中文与 MILO','中文 Milo；中文；milo。'),post('中文与Milo','Words separated; existing filter excludes this')];
  posts.forEach((p,i)=>p.url='/demo/post-'+i+'/');
  const app=await setup('中文 Milo',posts);
  try{
    const results=[...app.d.querySelectorAll('.search-result')];
    assert.deepEqual(results.map(n=>n.querySelector('a').getAttribute('href')),['/demo/post-0/','/demo/post-1/']);
    assert.equal(results[0].querySelectorAll('mark').length,0);
    assert.equal(results[0].querySelector('p').textContent,'Unchanged text…');
    assert.equal(results[1].querySelectorAll('h2 mark').length,4);
    assert.equal(results[1].querySelectorAll('p mark').length,4);
    assert.equal(results[1].querySelector('h2').textContent,posts[1].title);
    await app.submit('absent');assert.equal(app.d.querySelectorAll('mark,.search-result').length,0);
  }finally{app.dom.window.close()}
});

test('special characters and HTML-like input stay literal, safe and text-preserving',async()=>{
  for(const query of ['.*+?^${}()|[]\\','C++','[a-z]','a.b','$&','x?y','(test)','<img src=x onerror=alert(1)>']){
    const title=query+' then '+query,content=query+' and '+query;
    const app=await setup(query,[post(title,content)]);
    try{
      assert.equal(app.d.querySelector('h2').textContent,title,query);
      assert.equal(app.d.querySelector('.search-result p').textContent,content+'…',query);
      assert.ok(app.d.querySelectorAll('h2 mark').length>=2,query);
      assert.ok(app.d.querySelectorAll('.search-result p mark').length>=2,query);
      assert.equal(app.d.querySelectorAll('.search-results img,.search-results script,.search-results svg,.search-results iframe').length,0);
    }finally{app.dom.window.close()}
  }
});
