'use strict';
const {stripHTML,unescapeHTML,escapeHTML}=require('hexo-util');
hexo.extend.helper.register('milo_text',value=>unescapeHTML(stripHTML(String(value||''))).replace(/\s+/g,' ').trim());
hexo.extend.helper.register('milo_words',value=>(stripHTML(String(value||'')).match(/[\u3400-\u9fff]|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)||[]).length);
hexo.extend.generator.register('milo-search',function(locals){if(hexo.theme.config.search?.enable===false)return [];return {path:'search.json',data:JSON.stringify(locals.posts.sort('date',-1).map(p=>({title:p.title,url:hexo.extend.helper.get('url_for').call(hexo,p.path),content:stripHTML(p.content||''),tags:p.tags.map(t=>t.name)})))};});

hexo.extend.helper.register('milo_post_count',function(page,site){
  if(page.category || page.tag){
    const items=page.category?site.categories:site.tags;
    const item=items.findOne({name:page.category || page.tag});
    return item?item.length:0;
  }
  if(!page.year)return site.posts.length;
  return site.posts.filter(post=>post.date.year()===Number(page.year) && (!page.month || post.date.month()+1===Number(page.month)) && (!page.day || post.date.date()===Number(page.day))).length;
});

const seoText=value=>unescapeHTML(stripHTML(Array.isArray(value)?value.join(' '):String(value || ''))).replace(/\s+/g,' ').trim();
hexo.extend.helper.register('milo_seo',function(){
  const {page,config,theme}=this,article=this.is_post();
  const base=seoText(config.description || theme.uiux.slogan || config.title);
  let label=page.title || '',description=base;
  if(page.category){label='分类：'+page.category;description='浏览分类「'+page.category+'」下的文章。'+base;}
  else if(page.tag){label='标签：'+page.tag;description='浏览标签「'+page.tag+'」下的文章。'+base;}
  else if(page.archive){label=[page.year,page.month,page.day].filter(Boolean).join(' / ');label=(label?label+' ':'')+'归档';description='浏览'+label+'中的文章。'+base;}
  else if(page.layout==='categories'){label='分类';description='按分类浏览文章。'+base;}
  else if(page.layout==='tags'){label='标签';description='按标签浏览文章。'+base;}
  if(article)description=seoText(page.excerpt) || seoText(page.description) || seoText(page.content) || base;
  else if(page.description)description=seoText(page.description);
  const suffix=page.current>1?'第 '+page.current+' 页':'';
  const title=[seoText(label),suffix,seoText(config.title)].filter(Boolean).join(' | ');
  const image=page.cover || page.thumbnail || theme.seo?.image || theme.img.avatar || 'images/milo-social.png';
  // 本地图片先经过 url_for，适配 root 并避免重复子路径。
  const imageURL=new URL(this.url_for(image,{relative:false}),config.url.replace(/\/?$/,'/')).href;
  return {title,description:seoText(description).slice(0,160),url:this.full_url_for(page.path.replace(/index\.html$/,'')),image:imageURL,type:article?'article':'website'};
});
function feedPaths(){
  if(hexo.config.feed===false || hexo.config.feed?.enable===false || hexo.theme.config.feed?.enable===false)return [];
  if(hexo.extend.generator.get('feed'))return [].concat(hexo.config.feed?.path || 'atom.xml');
  return ['atom.xml'];
}
hexo.extend.helper.register('milo_feeds',()=>feedPaths().map(path=>({path,type:/rss/i.test(path)?'application/rss+xml':'application/atom+xml'})));
hexo.extend.generator.register('milo-feed',function(locals){
  if(!feedPaths().length || hexo.extend.generator.get('feed'))return [];
  const xml=value=>String(value || '').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
  const full=path=>hexo.extend.helper.get('full_url_for').call(hexo,path);
  const limit=Number(hexo.theme.config.feed?.limit) || 20;
  const posts=locals.posts.sort('date',-1).limit(Math.max(1,limit)).toArray();
  const updated=posts.reduce((latest,p)=>Math.max(latest,+p.updated || +p.date),0);
  return {path:'atom.xml',data:'<?xml version="1.0" encoding="utf-8"?>'+
    '<feed xmlns="http://www.w3.org/2005/Atom"><title>'+xml(hexo.config.title)+'</title><id>'+xml(full(''))+'</id><link href="'+xml(full(''))+'"/><link rel="self" href="'+xml(full('atom.xml'))+'"/><updated>'+new Date(updated).toISOString()+'</updated><author><name>'+xml(hexo.config.author || hexo.config.title)+'</name></author>'+posts.map(p=>{
      const url=full(p.path.replace(/index\.html$/,''));
      return '<entry><title>'+xml(p.title)+'</title><id>'+xml(url)+'</id><link href="'+xml(url)+'"/><published>'+p.date.toISOString()+'</published><updated>'+(p.updated || p.date).toISOString()+'</updated><summary>'+xml(seoText(p.excerpt || p.description || p.content).slice(0,300))+'</summary></entry>';
    }).join('')+'</feed>'};
});

// 图片元数据只读取本地资源，不访问网络。
const fs=require('node:fs'),path=require('node:path'),{imageSize}=require('image-size');
const imageCache=new Map();
function localImageSize(src,context){
  try{
    const site=new URL(context.config.url),url=new URL(src,context.full_url_for(context.page?.path || ''));
    if(!['http:','https:'].includes(url.protocol) || url.origin!==site.origin)return;
    let name=decodeURIComponent(url.pathname),root=context.config.root || '/';
    if(root!=='/' && name.startsWith(root))name=name.slice(root.length);
    name=name.replace(/^\/+/, '');
    const candidates=[...new Set([hexo.source_dir,path.join(hexo.theme_dir,'source')].filter(Boolean))].map(base=>({base,name}));
    if(context.page?.asset_dir && !/^(?:[a-z]+:|\/)/i.test(src))candidates.unshift({base:context.page.asset_dir,name:decodeURIComponent(src.split(/[?#]/)[0])});
    for(const candidate of candidates){
      const base=path.resolve(candidate.base),file=path.resolve(base,candidate.name);
      if(!file.startsWith(base+path.sep))continue;
      try{
        const stat=fs.statSync(file);if(!stat.isFile())continue;
        const cached=imageCache.get(file);if(cached?.stamp===stat.mtimeMs && cached.size===stat.size)return cached.dimensions;
        const descriptor=fs.openSync(file,'r');let dimensions;
        try{const buffer=Buffer.alloc(Math.min(stat.size,256*1024));const bytes=fs.readSync(descriptor,buffer,0,buffer.length,0);dimensions=imageSize(buffer.subarray(0,bytes))}finally{fs.closeSync(descriptor)}
        if(!(dimensions.width>0 && dimensions.height>0))continue;
        if([5,6,7,8].includes(dimensions.orientation))[dimensions.width,dimensions.height]=[dimensions.height,dimensions.width];
        imageCache.set(file,{stamp:stat.mtimeMs,size:stat.size,dimensions});return dimensions;
      }catch(e){}
    }
  }catch(e){}
}
// 只增强文章输出，SEO、摘要和订阅保留原始内容。
hexo.extend.helper.register('milo_reading_content',function(content){
  let firstImage=true;
  return String(content || '').replace(/<!--[\s\S]*?-->|<(pre|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,(tag,block,offset)=>{
    if(!/^<img\b/i.test(tag))return tag;
    const attributes=new Map([...tag.matchAll(/\s([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1].toLowerCase(),m[2] ?? m[3] ?? m[4] ?? '']));
    const add=[],first=firstImage && stripHTML(String(content || '').slice(0,offset)).length<600;firstImage=false;
    if(!attributes.has('loading'))add.push('loading="'+(first?'eager':'lazy')+'"');
    if(first && !attributes.has('fetchpriority') && attributes.get('loading')!=='lazy')add.push('fetchpriority="high"');
    if(!attributes.has('decoding'))add.push('decoding="async"');
    const src=attributes.get('src') || '',root=this?.config?.root || '/';
    if(!attributes.has('width') || !attributes.has('height') || (root!=='/' && src.startsWith('/') && !src.startsWith('//') && !src.startsWith(root))){
      const dimensions=localImageSize(unescapeHTML(src),this);
      if(dimensions){
        if(root!=='/' && src.startsWith('/') && !src.startsWith('//') && !src.startsWith(root))tag=tag.replace(/(\ssrc\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/i,(_,prefix)=>prefix+'"'+escapeHTML(this.url_for(unescapeHTML(src),{relative:false}))+'"');
        const width=Number(attributes.get('width')),height=Number(attributes.get('height'));
        if(!attributes.has('width'))add.push('width="'+(height>0?Math.round(height*dimensions.width/dimensions.height):dimensions.width)+'"');
        if(!attributes.has('height'))add.push('height="'+(width>0?Math.round(width*dimensions.height/dimensions.width):dimensions.height)+'"');
      }
    }
    return add.length?tag.replace(/\s*\/?>(?=\s*$)/,' '+add.join(' ')+'$&'):tag;
  });
});

hexo.extend.generator.register('milo-404',function(locals){
  // 站点自备的 404 页面优先于主题默认页面。
  if(fs.existsSync(path.join(hexo.source_dir,'404.html')) || locals.pages.toArray().some(page=>page.path==='404.html'))return [];
  return {path:'404.html',layout:['404'],data:{layout:'404',title:'页面未找到',description:'这个页面可能已被移走，或地址有一点小偏差。'}};
});

hexo.extend.helper.register('milo_versions', () => ({hexo: hexo.version, milo: require('../package.json').version}));
