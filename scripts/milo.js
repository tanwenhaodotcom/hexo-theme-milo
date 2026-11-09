'use strict';
const {stripHTML}=require('hexo-util');
hexo.extend.helper.register('milo_text',value=>stripHTML(String(value||'')).replace(/\s+/g,' ').trim());
hexo.extend.helper.register('milo_words',value=>(stripHTML(String(value||'')).match(/[\u3400-\u9fff]|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)||[]).length);
hexo.extend.generator.register('milo-search',function(locals){if(hexo.theme.config.search?.enable===false)return [];return {path:'search.json',data:JSON.stringify(locals.posts.sort('date',-1).map(p=>({title:p.title,url:hexo.extend.helper.get('url_for').call(hexo,p.path),content:stripHTML(p.content||''),tags:p.tags.map(t=>t.name)})))};});
