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
    const readingContent='\n\n## Reading chapter\n\n'+('A paragraph with **emphasis**, [a link](https://example.com) and `inline code`. 阅读体验测试。\n\n'.repeat(12))+'### Code example\n\n```js\nconst message = "Hello <Milo>";\nconsole.log(message);\n```\n\n#### Image examples\n\n![Preview](/images/milo-social.png)\n\n<img src="/images/milo-social.png" width="1200" height="630" class="milo-screenshot" alt="Sized image">\n\n<img src="https://example.com/remote.png" loading="eager" decoding="sync" width="600" height="400" alt="Remote">\n\n## Final chapter\n\n'+('Final paragraph. 最后的段落。\n\n'.repeat(12));
    for(let i=1;i<=5;i++)await fs.writeFile(path.join(base,`source/_posts/post-${i}.md`),`---\ntitle: Post ${i}\ndate: ${i===5?'2025-02-01':'2026-01-0'+i} 12:00:00\ncategories: [Notes]\ntags: [Test]\ntoc: ${i!==5}\nlightbox: ${i!==2}\ncover_fit: ${i===3?'contain':i===4?'invalid':i===2?'cover':''}\n${i===3?'thumbnail':'cover'}: ${i===1?'/images/cover.png':i===2?'https://cdn.example.com/cover.jpg':(i===3 || i===4)?'/images/cover.png':''}\n---\n![Hero](/images/portrait.svg)\n\nSummary & **intro**\n<!-- more -->\nPrivate body${readingContent}`);
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
        const renderTitle=hexo.extend.helper.get('milo_title');
        for(const title of ['和伙伴一起阅读，慢慢完善自己的主题','纯英文 English title & <script>alert("x")</script>','超长没有空格的中文标题'.repeat(8),'Emoji 👩‍💻 与中文标题','']){
          const titleDOM=new JSDOM('<h2>'+renderTitle(title)+'</h2>');
          assert.equal(titleDOM.window.document.querySelector('h2').textContent,title,'Title text stays exact');
          assert.equal(titleDOM.window.document.querySelector('script'),null,'Title markup stays escaped');
          for(const word of titleDOM.window.document.querySelectorAll('.title-word'))assert.match(word.textContent,/^\p{Script=Han}{2,6}$/u,'Only short Chinese words are kept together');
          titleDOM.window.close();
        }
        assert.ok(renderTitle('和伙伴一起阅读').includes('class="title-word">一起</span>'));
        assert.equal(renderTitle(null),'');
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
        assert.equal(sw.document.querySelectorAll('input[type=search]').length,2);
        assert.ok(sw.document.querySelector('.search-toggle'));
        assert.ok(sw.document.querySelector('.nav-search input').disabled);
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
        assert.equal(home.querySelector('.page-heading'),null);
        assert.equal(home.querySelectorAll('h1').length,1);
        assert.equal(home.querySelector('#main>h1.sr').textContent,'Test · 文章列表');
        assert.equal(home.querySelector('#main>h1').nextElementSibling.className,'entry');
        for(const route of ['categories/index.html','tags/index.html','search/index.html']){
          const other=new JSDOM(await html(route)).window.document;
          assert.ok(other.querySelector('.page-heading h1'),route+' keeps its heading');
        }
        assert.ok(home.querySelector('.footer').textContent.includes('Hexo '+hexo.version));
        assert.ok(home.querySelector('.footer').textContent.includes('Milo '+require('../package.json').version));
        const sticky=home.querySelector('.sidebar>.sidebar-sticky.is-sticky');
        assert.ok(sticky);
        assert.equal(sticky.querySelector('.profile'),null);
        assert.deepEqual([...sticky.querySelectorAll(':scope>.side-section>h2')].map(h=>h.textContent),['最近文章','分类']);
        assert.ok(home.querySelector('.sidebar>.profile'));
        assert.ok(home.querySelector('.nav-search input[name=q]'));
        assert.ok(home.querySelector('.search-toggle'));
        assert.equal(home.querySelector('[rel=canonical]').href,`https://example.com${root}`);
        assert.equal(home.querySelector('.cover img').getAttribute('loading'),'eager');
        assert.equal(home.querySelector('.cover img').getAttribute('fetchpriority'),'high');
        for(const route of ['index.html','page/2/index.html','archives/index.html','categories/index.html','tags/index.html','search/index.html','about/index.html','plain/index.html']){
          const d=new JSDOM(await html(route)).window.document;
          assert.equal(d.querySelector('script[src$="/js/reading.js"]'),null,route);
        }
        const secondHome=new JSDOM(await html('page/2/index.html')).window.document;
        assert.equal(secondHome.querySelector('.page-heading'),null);
        assert.equal(secondHome.querySelectorAll('h1').length,1);
        assert.equal(secondHome.querySelector('#main>h1.sr').textContent,'Test · 文章列表 · 第 2 页');
        assert.equal(secondHome.querySelector('#main>h1').nextElementSibling.className,'entry');
        assert.equal(secondHome.querySelector('.cover img').getAttribute('loading'),'eager');
        assert.equal(secondHome.querySelectorAll('.cover img')[1].getAttribute('loading'),'lazy');
        const covers=[...home.querySelectorAll('.cover')];
        for(const entry of [...home.querySelectorAll('.entry'),...secondHome.querySelectorAll('.entry')]){
          const copy=entry.querySelector('.entry-copy'),cover=entry.querySelector('.cover');
          assert.equal(copy.classList.contains('has-cover'),!!cover);
          assert.equal(copy.querySelectorAll('img').length,cover?1:0);
          assert.deepEqual([...copy.children].map(el=>el.classList.contains('meta')?'meta':el.classList.contains('cover')?'cover':el.tagName.toLowerCase()),cover?['meta','h2','cover','p']:['meta','h2','p']);
          assert.equal(copy.querySelector('h2 a').tabIndex,0);
          if(cover){assert.equal(cover.tabIndex,-1);assert.equal(cover.getAttribute('aria-hidden'),'true');assert.equal(cover.querySelector('img').alt,'')}
        }
        assert.equal(covers[0].classList.contains('cover-contain'),false);
        assert.equal(covers[1].classList.contains('cover-contain'),true);
        assert.equal(covers[0].querySelector('img').getAttribute('src'),root+'images/cover.png');
        assert.equal(new JSDOM(await html('page/3/index.html')).window.document.querySelectorAll('.cover').length,0); // Body-only image is not a cover.
        assert.equal(doc.querySelectorAll('#post-content img.milo-screenshot').length,1);
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
    // 使用足够文章验证原生 per_page=6 及第二页。
    for(const i of [6,7])await fs.writeFile(path.join(base,`source/_posts/post-${i}.md`),`---\ntitle: Post ${i}\ndate: 2026-02-0${i} 12:00:00\n---\nSix-per-page regression.`);
    const originalConfig=await fs.readFile(path.join(base,'_config.yml'),'utf8');
    for(const root of ['/','/demo/']){
      const config=originalConfig.replace(/^url:.*$/m,'url: https://example.com'+(root==='/'?'':root.slice(0,-1))).replace(/^root:.*$/m,'root: '+root).replace(/^per_page: 2$/m,'per_page: 6').replace(/(archive_generator:\r?\n)  per_page: 2/, '$1  per_page: 0');
      await fs.writeFile(path.join(base,'_config.yml'),config);
      const output=path.resolve(base,'public');
      assert.equal(path.dirname(output),path.resolve(base));
      // 从空输出目录构建，避免残留旧分页文件。
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

test('compact author identity uses existing configuration and escapes text',async()=>{
  const template=await fs.readFile(path.join(theme,'layout/_parts/identity.ejs'),'utf8'),ejs=require('ejs');
  for(const [author,avatar,slogan] of [['示例作者','/avatar.svg','记录阅读与技术。'],['较长的示例作者名称','',[]],['','',['阅读','<b>日常</b>']],['<script>alert(1)</script>','',null]]){
    const markup=ejs.render(template,{config:{author,title:'示例站点'},theme:{img:{avatar},uiux:{slogan}},url_for:p=>p});
    const dom=new JSDOM(markup),d=dom.window.document;
    assert.equal(d.querySelector('.identity-name').textContent,author || '示例站点');
    assert.equal(d.querySelectorAll('img').length,avatar?1:0);
    assert.equal(d.querySelectorAll('script,b').length,0);
    assert.equal(d.querySelector('a').getAttribute('href'),'/about/');
    if(avatar)assert.equal(d.querySelector('img').alt,'');
    if(Array.isArray(slogan) && slogan.length)assert.equal(d.querySelector('.identity-intro').textContent,slogan.join(' '));
    dom.window.close();
  }
  const index=await fs.readFile(path.join(theme,'layout/index.ejs'),'utf8');
  for(const [current,author,avatar,slogan,visible] of [[1,'作者','','',true],[2,'作者','','',false],[1,'','','',false],[1,'','/avatar.svg','',true],[1,'','',[],false]]){
    const data={config:{author,title:'示例站点'},theme:{img:{avatar},uiux:{slogan}},page:{current,posts:{each(){}}}};
    const markup=ejs.render(index,{...data,partial:name=>name==='_parts/identity'?ejs.render(template,{...data,url_for:p=>p}):''});
    const dom=new JSDOM(markup);assert.equal(!!dom.window.document.querySelector('.mobile-identity'),visible);dom.window.close();
  }
});

test('search disclosure preserves drafts, focus and existing GET search',async()=>{
  const header=await fs.readFile(path.join(theme,'layout/_parts/header.ejs'),'utf8'),ejs=require('ejs');
  const markup=ejs.render(header,{config:{title:'Test'},theme:{search:{enable:true}},page:{path:''},url_for:p=>p,partial:()=>'<svg aria-hidden="true"></svg>'});
  const dom=new JSDOM(markup+'<button id="outside">Outside</button>',{url:'https://example.com',runScripts:'outside-only'});
  const {window:w}=dom;w.matchMedia=()=>({matches:false,addEventListener(){}});w.eval(await fs.readFile(path.join(theme,'source/js/milo.js'),'utf8'));
  const d=w.document,button=d.querySelector('.search-toggle'),form=d.querySelector('.nav-search'),input=form.querySelector('input'),outside=d.querySelector('#outside');
  assert.equal(input.disabled,true);assert.equal(form.getAttribute('aria-hidden'),'true');assert.ok(form.hasAttribute('inert'));
  button.click();assert.equal(d.activeElement,input);assert.equal(input.disabled,false);assert.equal(button.getAttribute('aria-expanded'),'true');
  input.value='中文草稿 & UI';
  input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));assert.ok(form.classList.contains('open'));
  const escape=new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});input.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented,true);assert.equal(d.activeElement,button);assert.equal(input.value,'中文草稿 & UI');assert.equal(input.disabled,true);
  button.click();button.click();assert.equal(input.value,'中文草稿 & UI');assert.equal(button.getAttribute('aria-expanded'),'false');
  button.click();outside.focus();outside.click();assert.equal(d.activeElement,outside);assert.equal(button.getAttribute('aria-expanded'),'false');
  button.click();d.querySelector('.appearance-button').click();assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(d.querySelector('.appearance-menu').hidden,false);
  button.click();assert.equal(d.querySelector('.appearance-menu').hidden,true);assert.equal(form.method,'get');assert.equal(new URL(form.action).pathname,'/search/');assert.equal(input.name,'q');assert.equal(input.value,'中文草稿 & UI');
  dom.window.close();
});

test('appearance keyboard navigation and focus lifecycle',async()=>{
  const header=await fs.readFile(path.join(theme,'layout/_parts/header.ejs'),'utf8');
  const ejs=require('ejs');
  const markup=ejs.render(header,{config:{title:'Test'},theme:{search:{enable:false}},page:{path:''},url_for:p=>p});
  const dom=new JSDOM(markup+'<button id="outside">Outside</button>',{url:'https://example.com',runScripts:'outside-only'});
  const {window:w}=dom;let systemChange;const system={matches:false,addEventListener(type,listener){systemChange=listener}};w.matchMedia=()=>system;
  w.eval(await fs.readFile(path.join(theme,'source/js/milo.js'),'utf8'));
  const d=w.document,toggle=d.querySelector('.appearance-button'),menu=d.querySelector('.appearance-menu'),choices=[...menu.querySelectorAll('button')];
  assert.match(toggle.getAttribute('aria-label'),/当前浅色（跟随系统）/);
  assert.equal(d.querySelector('.tools').classList.contains('tools--compact'),true,'Search-disabled tools remain compact');
  const key=k=>d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  toggle.focus();key('ArrowUp');assert.equal(d.activeElement,choices[2]);
  key('ArrowDown');assert.equal(d.activeElement,choices[0]);
  key('ArrowUp');assert.equal(d.activeElement,choices[2]);
  key('Escape');assert.equal(menu.hidden,true);assert.equal(d.activeElement,toggle);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  key('ArrowDown');assert.equal(d.activeElement,choices[0]);
  d.querySelector('#outside').focus();assert.equal(menu.hidden,true);
  toggle.click();choices[1].click();assert.equal(d.documentElement.dataset.mode,'dark');assert.equal(d.activeElement,toggle);assert.equal(menu.hidden,true);
  assert.equal(w.localStorage.getItem('milo-appearance'),'dark');assert.match(toggle.getAttribute('aria-label'),/当前深色，/);
  systemChange();assert.equal(d.documentElement.dataset.mode,'dark','Explicit preference ignores system');
  toggle.click();choices[0].click();system.matches=true;systemChange();assert.equal(d.documentElement.dataset.mode,'dark');assert.match(toggle.getAttribute('aria-label'),/当前深色（跟随系统）/);
  system.matches=false;systemChange();assert.equal(d.documentElement.dataset.mode,'light');assert.match(toggle.getAttribute('aria-label'),/当前浅色（跟随系统）/);
  toggle.click();d.querySelector('#outside').click();assert.equal(menu.hidden,true);
  dom.window.close();
});


test('Homepage summaries decode entities once and keep EJS HTML escaping',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'milo-entities-'));
  const encoded='example.com&#x2F;project&#x2F;milo &amp; &quot;quoted&quot; &#39;single&#39; &lt;img src=x onerror=window.__miloXSS=1&gt; &lt;script&gt;window.__miloXSS=1&lt;/script&gt; &amp;lt;b&amp;gt;';
  const expected='example.com/project/milo & "quoted" \'single\' <img src=x onerror=window.__miloXSS=1> <script>window.__miloXSS=1</script> &lt;b&gt;';
  try{
    await fs.mkdir(path.join(base,'themes'),{recursive:true});
    for(const entry of ['layout','source','_config.yml'])await fs.cp(path.join(theme,entry),path.join(base,'themes/milo',entry),{recursive:true});
    await fs.mkdir(path.join(base,'scripts'),{recursive:true});
    await fs.writeFile(path.join(base,'package.json'),JSON.stringify({hexo:{version:'8.0.0'}}));
    const plugins=Object.keys(require('../package.json').devDependencies).filter(p=>p.startsWith('hexo-')).map(p=>require.resolve(p));
    plugins.push(path.join(theme,'scripts/milo.js'));
    await fs.writeFile(path.join(base,'scripts/plugins.js'),`for(const plugin of ${JSON.stringify(plugins)})await hexo.loadPlugin(plugin);`);
    await fs.mkdir(path.join(base,'source/_posts'),{recursive:true});
    for(const kind of ['excerpt','content'])await fs.writeFile(path.join(base,'source/_posts',kind+'.md'),'---\ntitle: '+kind+'\ndate: 2026-01-01\n---\n<p>'+encoded+'</p>'+(kind==='excerpt'?'\n<!-- more -->\nPrivate body':''));
    for(const root of ['/','/demo/']){
      await fs.writeFile(path.join(base,'_config.yml'),'title: Entities\nauthor: Author\nurl: https://example.com'+root+'\nroot: '+root+'\ntheme: milo\n');
      const hexo=new Hexo(base,{silent:true});
      try{
        await hexo.init();await hexo.call('generate');
        const text=hexo.extend.helper.get('milo_text');
        assert.equal(text('<p>'+encoded+'</p>'),expected);
        assert.equal(text('<b>Real markup</b>  &amp;  text'),'Real markup & text');
        assert.equal(text(null),'');
        const html=await fs.readFile(path.join(base,'public/index.html'),'utf8'),doc=new JSDOM(html).window.document;
        const summaries=[...doc.querySelectorAll('.entry-copy>p')];assert.equal(summaries.length,2);
        for(const summary of summaries){assert.equal(summary.textContent,expected);assert.equal(summary.children.length,0)}
        assert.ok(html.includes('&lt;img src=x onerror=window.__miloXSS=1&gt;'));
        if(process.env.MILO_ENTITY_FIXTURE_DIR){
          await fs.mkdir(process.env.MILO_ENTITY_FIXTURE_DIR,{recursive:true});
          await fs.writeFile(path.join(process.env.MILO_ENTITY_FIXTURE_DIR,root==='/'?'root.html':'demo.html'),html);
          await fs.writeFile(path.join(process.env.MILO_ENTITY_FIXTURE_DIR,'expected.json'),JSON.stringify(expected));
        }
      }finally{await hexo.exit()}
    }
  }finally{await fs.rm(base,{recursive:true,force:true})}
});
