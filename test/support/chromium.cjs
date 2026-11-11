'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const http=require('node:http'),cp=require('node:child_process');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const types={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};

// 用独立回环端口读取已生成的页面，避免运行中的预览或实时刷新影响截图。
async function withChromium(root,run){
  root=path.resolve(root);
  let executable=process.env.MILO_BROWSER;
  if(!executable)for(const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome']){
    try{await fs.access(candidate);executable=candidate;break}catch{}
  }
  if(!executable || typeof WebSocket==='undefined')throw Error('需要 Node.js 22+ 及 Chromium（可用 MILO_BROWSER 指定路径）。');
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'milo-visual-'));
  const server=http.createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
      if(!file.startsWith(root+path.sep))throw Error('Invalid path');
      const body=await fs.readFile(file);
      res.setHeader('Content-Type',types[path.extname(file)]||'text/html; charset=utf-8');res.end(body);
    }catch{res.writeHead(404);res.end('404')}
  });
  let browser,ws,loaded;
  const errors=[],pending=new Map();let id=0;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const site=`http://127.0.0.1:${server.address().port}/`;
    browser=cp.spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    const endpoint=await new Promise((resolve,reject)=>{
      let stderr='';const timer=setTimeout(()=>reject(Error('Chromium startup timeout')),15000);
      browser.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1])}});
      browser.on('error',e=>{clearTimeout(timer);reject(e)});
    });
    const target=await (await fetch(new URL(endpoint).origin.replace('ws:','http:')+'/json/new?about:blank',{method:'PUT'})).json();
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
    ws.onmessage=event=>{
      const m=JSON.parse(event.data);
      if(m.method==='Page.loadEventFired')loaded?.();
      if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
      const task=pending.get(m.id);if(task){pending.delete(m.id);clearTimeout(task.timer);m.error?task.reject(Error(JSON.stringify(m.error))):task.resolve(m.result)}
    };
    const send=(method,params={})=>new Promise((resolve,reject)=>{
      const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('Browser command timeout: '+method))},15000);
      pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));
    });
    const evaluate=async expression=>{
      const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;
    };
    const navigate=async route=>{
      const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page load timeout: '+route)),15000);loaded=()=>{clearTimeout(timer);resolve()}});
      await send('Page.navigate',{url:new URL(route,site).href});await ready;await wait(100);
    };
    const until=async(check,label)=>{for(let i=0;i<100;i++){if(await check())return;await wait(100)}throw Error('Timeout: '+label)};
    const output=path.resolve(process.env.MILO_SCREENSHOT_DIR||'screenshots');
    await fs.mkdir(output,{recursive:true});
    const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'))};
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Network.setCacheDisabled',{cacheDisabled:true});
    await run({send,evaluate,navigate,until,screenshot,errors,output,wait});
  }finally{ws?.close();browser?.kill();server.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{});}
}
module.exports={withChromium};
