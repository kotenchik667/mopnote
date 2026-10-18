const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('glitch.css','utf8');
const extraCss = fs.readFileSync('operations.css','utf8');
const src = fs.readFileSync('glitch.js','utf8');

function simulate(){
  const events={}, callbacks={raf:[],timers:[],cancelled:[]};
  const no = ()=>{};
  const ctx = {clearRect:no,lineTo:no,moveTo:no,beginPath:no,stroke:no,fillRect:no,fillText:no,setTransform:no};
  const canvas={hidden:false,width:0,height:0,getContext:()=>ctx};
  const media={matches:false,addEventListener:(type,fn)=>events.motion=fn};
  const document={hidden:false,documentElement:{dataset:{theme:'light'}},getElementById:()=>canvas,addEventListener:(name,fn)=>events[name]=fn};
  const window={innerWidth:1000,innerHeight:700,devicePixelRatio:1,matchMedia:()=>media,addEventListener:(name,fn)=>events[name]=fn,setTimeout:(fn)=>{callbacks.timers.push(fn);return callbacks.timers.length}};
  const env={window,document,Math,requestAnimationFrame:fn=>{callbacks.raf.push(fn);return callbacks.raf.length},cancelAnimationFrame:id=>callbacks.cancelled.push(id),clearTimeout:no};
  vm.runInNewContext(src,env);
  return {events,callbacks,canvas,document,media};
}

test('switch is removed, animation stays visual and clicks pass through',()=>{
  assert.match(html,/id="glitchCanvas"/);
  assert.doesNotMatch(html,/id="glitchToggle"|id="glitchLabel"|GLITCH ON|GLITCH OFF/);
  assert.doesNotMatch(src,/glitchToggle|glitchLabel|localStorage/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(extraCss,/prefers-reduced-motion:reduce/);
});

test('ambient animation draws continuously with no UI switch',()=>{
  const x=simulate();
  assert.equal(x.callbacks.raf.length,1);
  assert.doesNotThrow(()=>x.callbacks.raf[0](1000));
  assert.equal(x.callbacks.timers.length,1);
  x.callbacks.timers[0]();
  assert.equal(x.callbacks.raf.length,2);
  assert.doesNotThrow(()=>x.callbacks.raf[1](1100));
  assert.doesNotThrow(()=>x.events['mopnote:quote-updated']());
});

test('hidden tab and reduced-motion preference halt animation',()=>{
  const x=simulate();
  x.document.hidden=true;
  x.events.visibilitychange();
  assert.equal(x.callbacks.cancelled.length,1);
  x.document.hidden=false;
  x.events.visibilitychange();
  assert.ok(x.callbacks.raf.length>=2);
  x.media.matches=true;
  x.events.motion();
  assert.equal(x.canvas.hidden,true);
  x.media.matches=false;
  x.events.motion();
  assert.equal(x.canvas.hidden,false);
});
