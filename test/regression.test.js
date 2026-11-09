'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Hexo=require('hexo');
const {JSDOM}=require('jsdom');
const theme=path.resolve(__dirname,'..');

test('Hexo builds: canonical, Disqus, pagination totals and navigation',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'milo-regression-'));
  try{
    await fs.mkdir(path.join(base,'themes'),{recursive:true});
    for(const entry of ['layout','source','_config.yml'])await fs.cp(path.join(theme,entry),path.join(base,'themes/milo',entry),{recursive:true});
    await fs.writeFile(path.join(base,'package.json'),JSON.stringify({hexo:{version:'8.0.0'}}));
    await fs.mkdir(path.join(base,'scripts'),{recursive:true});
    const plugins=Object.keys(require('../package.json').devDependencies).filter(p=>p.startsWith('hexo-')).map(p=>require.resolve(p));
    plugins.push(path.join(theme,'scripts/milo.js'));
    await fs.writeFile(path.join(base,'scripts/plugins.js'),`for(const plugin of ${JSON.stringify(plugins)})await hexo.loadPlugin(plugin);`);
    await fs.mkdir(path.join(base,'source/_posts'),{recursive:true});
    await fs.mkdir(path.join(base,'source/images'),{recursive:true});
    await fs.copyFile(path.join(theme,'source/images/milo-social.png'),path.join(base,'source/images/cover.png'));
    await fs.writeFile(path.join(base,'source/images/portrait.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900" viewBox="0 0 300 900"><rect width="300" height="900" fill="#1764b0"/></svg>');
    const readingContent='\n\n## Reading chapter\n\n'+('A paragraph with **emphasis**, [a link](https://example.com) and `inline code`. 阅读体验测试。\n\n'.repeat(12))+'### Code example\n\n```js\nconst message = "Hello <Milo>";\nconsole.log(message);\n```\n\n#### Image examples\n\n![Preview](/images/milo-social.png)\n\n<img src="/images/milo-social.png" width="1200" height="630" alt="Sized image">\n\n<img src="https://example.com/remote.png" loading="eager" decoding="sync" width="600" height="400" alt="Remote">\n\n## Final chapter\n\n'+('Final paragraph. 最后的段落。\n\n'.repeat(12));
    for(let i=1;i<=5;i++)await fs.writeFile(path.join(base,`source/_posts/post-${i}.md`),`---\ntitle: Post ${i}\ndate: ${i===5?'2025-02-01':'2026-01-0'+i} 12:00:00\ncategories: [Notes]\ntags: [Test]\ntoc: ${i!==5}\nlightbox: ${i!==2}\ncover: ${i===1?'/images/cover.png':i===2?'https://cdn.example.com/cover.jpg':(i===3 || i===4)?'/images/cover.png':''}\n---\n![Hero](/images/portrait.svg)\n\nSummary & **intro**\n<!-- more -->\nPrivate body${readingContent}`);
    for(const layout of ['tags','categories','about','search','plain']){
      await fs.mkdir(path.join(base,'source',layout),{recursive:true});
      await fs.writeFile(path.join(base,'source',layout,'index.md'),`---\ntitle: ${layout}\nlayout: ${layout}\n---\nHello`);
    }
    await fs.writeFile(path.join(base,'_config.milo.yml'),'comment:\n  disqus:\n    shortname: milo-test\nreading:\n  lightbox: true\n');
    for(const root of ['/','/demo/']){
      await fs.writeFile(path.join(base,'_config.yml'),`title: Test\ndescription: Site description\nauthor: Author\nurl: https://example.com${root==='/'?'':root.slice(0,-1)}\nroot: ${root}\ntheme: milo\nper_page: 2\narchive_generator:\n  per_page: 2\n  yearly: true\n  monthly: true\ncategory_generator:\n  per_page: 2\ntag_generator:\n  per_page: 2\n`);
      const hexo=new Hexo(base,{silent:true});
      try{
        await hexo.init();
        await hexo.call('generate');
        const html=route=>fs.readFile(path.join(base,'public',route),'utf8');
        const notFound=new JSDOM(await html('404.html')).window.document;
        assert.equal(notFound.querySelector('.not-found-code').textContent,'404');
        assert.equal(notFound.querySelector('h1').textContent,'你在寻找什么？');
        assert.equal(notFound.querySelector('.not-found .primary').getAttribute('href'),root);
        assert.equal(notFound.querySelector('.not-found-secondary').getAttribute('href'),root+'search/');
        assert.equal(notFound.querySelector('[rel=canonical]').href,'https://example.com'+root+'404.html');
        assert.equal(notFound.querySelector('script[src$="/js/reading.js"]'),null);
        assert.deepEqual(await hexo.extend.generator.get('milo-404')({pages:{toArray:()=>[{path:'404.html'}]}}),[]);
        const keyword='中文 & CSS';
        const searchDOM=new JSDOM(await html('search/index.html'),{url:'https://example.com'+root+'search/?q='+encodeURIComponent(keyword),runScripts:'outside-only'});
        const sw=searchDOM.window;
        assert.equal(sw.document.querySelectorAll('input[type=search]').length,1);
        assert.equal(sw.document.querySelector('.mobile-search'),null);
        assert.equal(sw.document.querySelector('.nav-search'),null);
        sw.matchMedia=()=>({matches:false,addEventListener(){}});
        sw.fetch=async url=>{assert.equal(url,root+'search.json');return {ok:true,json:async()=>[{title:keyword,url:root+'test-post/',content:'Summary',tags:[]}]}};
        sw.eval(await fs.readFile(path.join(theme,'source/js/milo.js'),'utf8'));
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(sw.document.querySelector('#search-q').value,keyword);
        assert.equal(sw.document.querySelectorAll('.search-result').length,1);
        assert.equal(sw.document.querySelector('.search-result a').getAttribute('href'),root+'test-post/');
        searchDOM.window.close();
        for(const [route,count] of [['archives/index.html',5],['archives/page/3/index.html',5],['archives/2026/index.html',4],['archives/2026/01/page/2/index.html',4],['categories/Notes/page/2/index.html',5],['tags/Test/page/3/index.html',5]]){
          const doc=new JSDOM(await html(route)).window.document;
          assert.ok(doc.querySelector('.page-heading'),route+': '+doc.documentElement.outerHTML.slice(0,1000));
          assert.match(doc.querySelector('.page-heading').textContent,new RegExp(`共 ${count} 篇文章`));
          assert.equal(doc.querySelector('[rel=canonical]').href,`https://example.com${root}${route.replace(/index\.html$/,'')}`);
        }
        for(const [route,title] of [['index.html','Test'],['page/2/index.html','第 2 页'],['archives/index.html','归档'],['archives/2026/01/index.html','2026 / 1 归档'],['categories/Notes/index.html','分类：Notes'],['tags/Test/index.html','标签：Test'],['categories/index.html','分类'],['tags/index.html','标签']]){
          const d=new JSDOM(await html(route)).window.document;
          const meta=(key,attr='property')=>d.querySelector('meta['+attr+'="'+key+'"]').content;
          assert.ok(d.title.includes(title),route+': '+d.title);
          assert.ok(d.querySelector('meta[name=description]').content.length);
          assert.equal(meta('og:title'),d.title);
          assert.equal(meta('og:type'),'website');
          assert.equal(meta('og:url'),d.querySelector('[rel=canonical]').href);
          assert.equal(meta('og:description'),d.querySelector('meta[name=description]').content);
          assert.equal(meta('og:image'),'https://example.com'+root+'images/milo-social.png');
          assert.equal(meta('twitter:card','name'),'summary_large_image');
          assert.equal(meta('twitter:title','name'),d.title);
          assert.equal(meta('twitter:description','name'),meta('og:description'));
          assert.equal(meta('twitter:image','name'),meta('og:image'));
          assert.equal(d.querySelector('link[type="application/atom+xml"]').href,'https://example.com'+root+'atom.xml');
        }
        const atom=new JSDOM(await html('atom.xml'),{contentType:'application/xml'}).window.document;
        assert.equal(atom.querySelectorAll('entry').length,5);
        assert.equal(atom.querySelector('link[rel=self]').getAttribute('href'),'https://example.com'+root+'atom.xml');
        assert.equal(atom.querySelector('entry summary').textContent,'Summary & intro');
        for(const entry of atom.querySelectorAll('entry'))assert.ok(entry.querySelector('link').getAttribute('href').startsWith('https://example.com'+root));
        const routes=hexo.route.list();
        const post=routes.find(p=>p.endsWith('/post-1/index.html'));
        const doc=new JSDOM(await html(post)).window.document;
        const expected=`https://example.com${root}${post.replace(/index\.html$/,'')}`;
        assert.equal(doc.querySelector('[rel=canonical]').href,expected);
        assert.equal(doc.querySelector('.load-comments').dataset.url,expected);
        assert.equal(doc.title,'Post 1 | Test');
        assert.equal(doc.querySelector('meta[property="og:type"]').content,'article');
        assert.equal(doc.querySelector('meta[name=description]').content,'Summary & intro');
        assert.equal(doc.querySelector('meta[property="og:image"]').content,'https://example.com'+root+'images/cover.png');
        assert.ok(doc.querySelector('.mobile-toc:not([open]) nav .toc'));
        assert.ok(doc.querySelector('.toc-sidebar nav .toc'));
        assert.ok(doc.querySelector('progress[max="100"]'));
        assert.equal(doc.querySelector('#post-content').dataset.lightbox,'true');
        assert.equal(doc.querySelector('#post-content img').getAttribute('loading'),'eager');
        assert.equal(doc.querySelector('#post-content img').getAttribute('fetchpriority'),'high');
        assert.equal(doc.querySelector('#post-content img').width,300);
        assert.equal(doc.querySelector('#post-content img').height,900);
        assert.equal(doc.querySelector('#post-content img').getAttribute('src'),root+'images/portrait.svg');
        assert.equal(doc.querySelector('#post-content img[src$="milo-social.png"]').getAttribute('loading'),'lazy');
        assert.equal(doc.querySelector('#post-content img[width="1200"]').height,630);
        assert.equal(doc.querySelector('#post-content img[src$="remote.png"]').getAttribute('decoding'),'sync');
        assert.ok(doc.querySelector('script[src="'+root+'js/reading.js"]'));
        assert.ok(doc.querySelector('.post-nav a[rel=prev] time[datetime]'));
        const oldest=new JSDOM(await html(routes.find(p=>p.endsWith('/post-5/index.html')))).window.document;
        assert.equal(oldest.querySelector('.mobile-toc'),null);
        assert.equal(oldest.querySelector('.toc-sidebar'),null);
        assert.equal(oldest.querySelectorAll('.post-nav a').length,1);
        const middle=new JSDOM(await html(routes.find(p=>p.endsWith('/post-3/index.html')))).window.document;
        assert.equal(middle.querySelectorAll('.post-nav a').length,2);
        const external=new JSDOM(await html(routes.find(p=>p.endsWith('/post-2/index.html')))).window.document;
        assert.equal(external.querySelector('meta[property="og:image"]').content,'https://cdn.example.com/cover.jpg');
        assert.equal(external.querySelector('#post-content').dataset.lightbox,'false');
        const readingHTML=hexo.extend.helper.get('milo_reading_content');
        assert.equal(readingHTML('<pre><img src="code"></pre><!-- <img src="comment"> -->'),'<pre><img src="code"></pre><!-- <img src="comment"> -->');
        assert.equal((readingHTML('<img src="x" loading="eager">').match(/loading=/g)||[]).length,1);
        for(const route of ['tags','about'])assert.ok(doc.querySelector(`.navlinks a[href="${root}${route}/"]`));
        const home=new JSDOM(await html('index.html')).window.document;
        const sticky=home.querySelector('.sidebar>.sidebar-sticky.is-sticky');
        assert.ok(sticky);
        assert.equal(sticky.querySelector('.profile'),null);
        assert.deepEqual([...sticky.querySelectorAll(':scope>.side-section>h2')].map(h=>h.textContent),['最近文章','分类']);
        assert.ok(home.querySelector('.sidebar>.profile'));
        assert.ok(home.querySelector('.nav-search input[name=q]'));
        assert.ok(home.querySelector('.mobile-search'));
        assert.equal(home.querySelector('[rel=canonical]').href,`https://example.com${root}`);
        assert.equal(home.querySelector('.cover img').getAttribute('loading'),'eager');
        assert.equal(home.querySelector('.cover img').getAttribute('fetchpriority'),'high');
        for(const route of ['index.html','page/2/index.html','archives/index.html','categories/index.html','tags/index.html','search/index.html','about/index.html','plain/index.html']){
          const d=new JSDOM(await html(route)).window.document;
          assert.equal(d.querySelector('script[src$="/js/reading.js"]'),null,route);
        }
        const secondHome=new JSDOM(await html('page/2/index.html')).window.document;
        assert.equal(secondHome.querySelector('.cover img').getAttribute('loading'),'eager');
        assert.equal(secondHome.querySelectorAll('.cover img')[1].getAttribute('loading'),'lazy');
        const imageContext={config:hexo.config,page:{path:'plain/index.html'},full_url_for:hexo.extend.helper.get('full_url_for').bind(hexo),url_for:hexo.extend.helper.get('url_for').bind(hexo)};
        const imageHTML=content=>new JSDOM(readingHTML.call(imageContext,content)).window.document.querySelector('img');
        assert.equal(imageHTML('<img src="/images/portrait.svg" width="100">').height,300);
        assert.equal(imageHTML('<img src="/images/portrait.svg" height="600">').width,200);
        assert.equal(imageHTML('<img src="/images/milo-social.png">').width,1200);
        assert.equal(imageHTML('<img src="https://cdn.example.com/not-fetched.png">').hasAttribute('width'),false);
        assert.equal(imageHTML('<img src="missing.png" alt="example loading=lazy">').getAttribute('loading'),'eager');
        assert.equal(imageHTML('<p>'+('Long text '.repeat(100))+'</p><img src="/images/portrait.svg">').getAttribute('loading'),'lazy');
        assert.ok((await fs.stat(path.join(base,'public/images/milo-social.png'))).size>0);
        const seo=hexo.extend.helper.get('milo_seo');
        const context={config:hexo.config,theme:hexo.theme.config,page:{path:'sample/index.html',title:'Sample',description:'Explicit description',content:'Body'},is_post:()=>true,url_for:hexo.extend.helper.get('url_for').bind(hexo),full_url_for:hexo.extend.helper.get('full_url_for').bind(hexo)};
        context.theme.seo.image='/images/default.png';
        assert.equal(seo.call(context).image,`https://example.com${root}images/default.png`);
        assert.equal(seo.call(context).description,'Explicit description');
        context.theme.seo.image='';context.theme.img.avatar='/images/avatar.png';
        assert.equal(seo.call(context).image,`https://example.com${root}images/avatar.png`);
        delete context.page.description;
        assert.equal(seo.call(context).description,'Body');
        const feeds=hexo.extend.helper.get('milo_feeds');
        const generateFeed=hexo.extend.generator.get('milo-feed');
        const empty=await generateFeed({posts:hexo.locals.get('posts').limit(0)});
        assert.doesNotThrow(()=>new JSDOM(empty.data,{contentType:'application/xml'}));
        hexo.theme.config.feed.enable=false;
        assert.deepEqual(feeds(),[]);assert.deepEqual(await generateFeed({}),[]);
        hexo.theme.config.feed.enable=true;
        hexo.extend.generator.register('feed',()=>[]);
        hexo.config.feed={path:['atom.xml','rss.xml']};
        assert.deepEqual(feeds().map(f=>f.type),['application/atom+xml','application/rss+xml']);
        assert.deepEqual(await generateFeed({}),[]);
        hexo.config.feed=false;assert.deepEqual(feeds(),[]);
        if(process.env.MILO_PREVIEW_DIR && root==='/demo/')await fs.cp(path.join(base,'public'),process.env.MILO_PREVIEW_DIR,{recursive:true});
      }finally{await hexo.exit();}
    }
    const normalThemeConfig=await fs.readFile(path.join(base,'_config.milo.yml'),'utf8');
    await fs.writeFile(path.join(base,'_config.milo.yml'),normalThemeConfig+'\nsidebar:\n  sticky: false\n');
    const disabled=new Hexo(base,{silent:true});
    try{
      await disabled.init();await disabled.call('generate');
      const doc=new JSDOM(await fs.readFile(path.join(base,'public/index.html'),'utf8')).window.document;
      assert.ok(doc.querySelector('.sidebar>.profile'));
      assert.ok(doc.querySelector('.sidebar-sticky'));
      assert.equal(doc.querySelector('.sidebar-sticky.is-sticky'),null);
      assert.equal(doc.querySelectorAll('.sidebar-sticky>.side-section').length,2);
    }finally{await disabled.exit();await fs.writeFile(path.join(base,'_config.milo.yml'),normalThemeConfig);}
    // Verify native global per_page=6 with enough posts to retain a second page.
    for(const i of [6,7])await fs.writeFile(path.join(base,`source/_posts/post-${i}.md`),`---\ntitle: Post ${i}\ndate: 2026-02-0${i} 12:00:00\n---\nSix-per-page regression.`);
    const originalConfig=await fs.readFile(path.join(base,'_config.yml'),'utf8');
    for(const root of ['/','/demo/']){
      const config=originalConfig.replace(/^url:.*$/m,'url: https://example.com'+(root==='/'?'':root.slice(0,-1))).replace(/^root:.*$/m,'root: '+root).replace(/^per_page: 2$/m,'per_page: 6').replace(/(archive_generator:\r?\n)  per_page: 2/, '$1  per_page: 0');
      await fs.writeFile(path.join(base,'_config.yml'),config);
      const output=path.resolve(base,'public');
      assert.equal(path.dirname(output),path.resolve(base));
      // Start from fresh generated output; old pagination files can otherwise survive.
      await fs.rm(output,{recursive:true,force:true});
      const hexo=new Hexo(base,{silent:true});
      try{
        await hexo.init();await hexo.call('generate');
        const home=new JSDOM(await fs.readFile(path.join(base,'public/index.html'),'utf8')).window.document;
        const second=new JSDOM(await fs.readFile(path.join(base,'public/page/2/index.html'),'utf8')).window.document;
        assert.equal(home.querySelectorAll('.entry').length,6);
        assert.equal(second.querySelectorAll('.entry').length,1);
        assert.ok(home.querySelector('.pager a[href="'+root+'page/2/"]'));
        assert.equal(hexo.route.list().includes('page/3/index.html'),false);
        const archive=new JSDOM(await fs.readFile(path.join(base,'public/archives/index.html'),'utf8')).window.document;
        assert.equal(archive.querySelectorAll('.archive-row').length,7);
        assert.equal(archive.querySelector('.pager'),null);
        assert.deepEqual([...archive.querySelectorAll('.year')].map(n=>n.textContent),['2026','2025']);
        assert.deepEqual([...archive.querySelectorAll('.archive-row')].map(n=>Number(n.getAttribute('href').match(/post-(\d+)\/$/)[1])),[7,6,4,3,2,1,5]);
        assert.equal(hexo.route.list().some(route=>/^archives\/(?:.*\/)?page\/\d+\//.test(route)),false);
        assert.equal((await fs.readdir(path.join(output,'archives'),{recursive:true})).some(name=>/(^|[\\/])page[\\/].*\.html$/.test(name)),false);
        for(const [route,count] of [['archives/2026/index.html',6],['archives/2026/02/index.html',2],['categories/Notes/page/3/index.html',1],['tags/Test/page/3/index.html',1]]){
          const d=new JSDOM(await fs.readFile(path.join(base,'public',route),'utf8')).window.document;
          assert.equal(d.querySelectorAll('.archive-row').length,count,route);
          if(route.startsWith('archives/'))assert.equal(d.querySelector('.pager'),null);
        }
        assert.ok((await fs.readFile(path.join(base,'public/404.html'),'utf8')).includes('not-found-code'));
        if(root==='/demo/'){
          await fs.writeFile(path.join(base,'source/404.html'),'<!doctype html><html><body>custom-404-preserved</body></html>');
          await hexo.call('generate');
          const custom=await fs.readFile(path.join(base,'public/404.html'),'utf8');
          assert.ok(custom.includes('custom-404-preserved'));
          assert.equal(custom.includes('not-found-code'),false);
        }
      }finally{await hexo.exit();}
    }
  }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('appearance keyboard navigation and focus lifecycle',async()=>{
  const header=await fs.readFile(path.join(theme,'layout/_parts/header.ejs'),'utf8');
  const ejs=require('ejs');
  const markup=ejs.render(header,{config:{title:'Test'},theme:{search:{enable:false}},page:{path:''},url_for:p=>p});
  const dom=new JSDOM(markup+'<button id="outside">Outside</button>',{url:'https://example.com',runScripts:'outside-only'});
  const {window:w}=dom;w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.eval(await fs.readFile(path.join(theme,'source/js/milo.js'),'utf8'));
  const d=w.document,toggle=d.querySelector('.appearance-button'),menu=d.querySelector('.appearance-menu'),choices=[...menu.querySelectorAll('button')];
  const key=k=>d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  toggle.focus();key('ArrowUp');assert.equal(d.activeElement,choices[2]);
  key('ArrowDown');assert.equal(d.activeElement,choices[0]);
  key('ArrowUp');assert.equal(d.activeElement,choices[2]);
  key('Escape');assert.equal(menu.hidden,true);assert.equal(d.activeElement,toggle);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  key('ArrowDown');assert.equal(d.activeElement,choices[0]);
  d.querySelector('#outside').focus();assert.equal(menu.hidden,true);
  toggle.click();choices[1].click();assert.equal(d.documentElement.dataset.mode,'dark');assert.equal(d.activeElement,toggle);assert.equal(menu.hidden,true);
  toggle.click();d.querySelector('#outside').click();assert.equal(menu.hidden,true);
  dom.window.close();
});
