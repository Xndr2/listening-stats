"use strict";(()=>{var Ys=Object.defineProperty;var le=(t,e,r)=>()=>{if(r)throw r[0];try{return t&&(e=t(t=0)),e}catch(n){throw r=[n],n}};var Ws=(t,e)=>{for(var r in e)Ys(t,r,{get:e[r],enumerable:!0})};function ye(t,e){return typeof e!="object"||ie(e).forEach(function(r){t[r]=e[r]}),t}function be(t,e){return qs.call(t,e)}function ut(t,e){typeof e=="function"&&(e=e(ct(t))),(typeof Reflect>"u"?ie:Reflect.ownKeys)(e).forEach(r=>{Be(t,r,e[r])})}function Be(t,e,r,n){di(t,e,ye(r&&be(r,"get")&&typeof r.get=="function"?{get:r.get,set:r.set,configurable:!0}:{value:r,configurable:!0,writable:!0},n))}function dt(t){return{from:function(e){return t.prototype=Object.create(e.prototype),Be(t.prototype,"constructor",t),{extend:ut.bind(null,t.prototype)}}}}function pi(t,e){let r=Zs(t,e),n;return r||(n=ct(t))&&pi(n,e)}function fr(t,e,r){return Xs.call(t,e,r)}function fi(t,e){return e(t)}function kt(t){if(!t)throw new Error("Assertion Failed")}function mi(t){se.setImmediate?setImmediate(t):setTimeout(t,0)}function Qs(t,e){return t.reduce((r,n,i)=>{var s=e(n,i);return s&&(r[s[0]]=s[1]),r},{})}function Oe(t,e){if(typeof e=="string"&&be(t,e))return t[e];if(!e)return t;if(typeof e!="string"){for(var r=[],n=0,i=e.length;n<i;++n){var s=Oe(t,e[n]);r.push(s)}return r}var a=e.indexOf(".");if(a!==-1){var o=t[e.substr(0,a)];return o==null?void 0:Oe(o,e.substr(a+1))}}function he(t,e,r){if(!(!t||e===void 0)&&!("isFrozen"in Object&&Object.isFrozen(t)))if(typeof e!="string"&&"length"in e){kt(typeof r!="string"&&"length"in r);for(var n=0,i=e.length;n<i;++n)he(t,e[n],r[n])}else{var s=e.indexOf(".");if(s!==-1){var a=e.substr(0,s),o=e.substr(s+1);if(o==="")r===void 0?q(t)&&!isNaN(parseInt(a))?t.splice(a,1):delete t[a]:t[a]=r;else{var l=t[a];if(!l||!be(t,a)){if(r===void 0)return;l=t[a]={}}he(l,o,r)}}else r===void 0?q(t)&&!isNaN(parseInt(e))?t.splice(e,1):delete t[e]:t[e]=r}}function Js(t,e){typeof e=="string"?he(t,e,void 0):"length"in e&&[].map.call(e,function(r){he(t,r,void 0)})}function hi(t){var e={};for(var r in t)be(t,r)&&(e[r]=t[r]);return e}function gi(t){return ea.apply([],t)}function bi(t){let e={};for(let r in t)if(be(t,r)){let n=t[r];e[r]=!n||typeof n!="object"||yi.has(n.constructor)?n:bi(n)}return e}function Qe(t){Pt=new WeakMap;let e=$r(t);return Pt=null,e}function $r(t){if(!t||typeof t!="object")return t;let e=Pt.get(t);if(e)return e;if(q(t)){e=[],Pt.set(t,e);for(var r=0,n=t.length;r<n;++r)e.push($r(t[r]))}else if(yi.has(t.constructor))e=t;else{let s=ct(t);e=s===Object.prototype?{}:Object.create(s),Pt.set(t,e);for(var i in t)be(t,i)&&(e[i]=$r(t[i]))}return e}function jr(t){return ra.call(t).slice(8,-1)}function Ve(t,e){let r=t.indexOf(e);return r>=0&&t.splice(r,1),r>=0}function Ce(t){var e,r,n,i;if(arguments.length===1){if(q(t))return t.slice();if(this===at&&typeof t=="string")return[t];if(i=na(t)){for(r=[];n=i.next(),!n.done;)r.push(n.value);return r}if(t==null)return[t];if(e=t.length,typeof e=="number"){for(r=new Array(e);e--;)r[e]=t[e];return r}return[t]}for(e=arguments.length,r=new Array(e);e--;)r[e]=arguments[e];return r}function pt(t,e){this.name=t,this.message=e}function xi(t,e){return t+". Errors: "+Object.keys(e).map(r=>e[r].toString()).filter((r,n,i)=>i.indexOf(r)===n).join(`
`)}function er(t,e,r,n){this.failures=e,this.failedKeys=n,this.successCount=r,this.message=xi(t,e)}function lt(t,e){this.name="BulkError",this.failures=Object.keys(e).map(r=>e[r]),this.failuresByPos=e,this.message=xi(t,this.failures)}function oa(t,e){if(!t||t instanceof pt||t instanceof TypeError||t instanceof SyntaxError||!t.name||!Wn[t.name])return t;var r=new Wn[t.name](e||t.message,t);return"stack"in t&&Be(r,"stack",{get:function(){return this.inner.stack}}),r}function V(){}function Ot(t){return t}function la(t,e){return t==null||t===Ot?e:function(r){return e(t(r))}}function Je(t,e){return function(){t.apply(this,arguments),e.apply(this,arguments)}}function ca(t,e){return t===V?e:function(){var r=t.apply(this,arguments);r!==void 0&&(arguments[0]=r);var n=this.onsuccess,i=this.onerror;this.onsuccess=null,this.onerror=null;var s=e.apply(this,arguments);return n&&(this.onsuccess=this.onsuccess?Je(n,this.onsuccess):n),i&&(this.onerror=this.onerror?Je(i,this.onerror):i),s!==void 0?s:r}}function ua(t,e){return t===V?e:function(){t.apply(this,arguments);var r=this.onsuccess,n=this.onerror;this.onsuccess=this.onerror=null,e.apply(this,arguments),r&&(this.onsuccess=this.onsuccess?Je(r,this.onsuccess):r),n&&(this.onerror=this.onerror?Je(n,this.onerror):n)}}function da(t,e){return t===V?e:function(r){var n=t.apply(this,arguments);ye(r,n);var i=this.onsuccess,s=this.onerror;this.onsuccess=null,this.onerror=null;var a=e.apply(this,arguments);return i&&(this.onsuccess=this.onsuccess?Je(i,this.onsuccess):i),s&&(this.onerror=this.onerror?Je(s,this.onerror):s),n===void 0?a===void 0?void 0:a:ye(n,a)}}function pa(t,e){return t===V?e:function(){return e.apply(this,arguments)===!1?!1:t.apply(this,arguments)}}function fn(t,e){return t===V?e:function(){var r=t.apply(this,arguments);if(r&&typeof r.then=="function"){for(var n=this,i=arguments.length,s=new Array(i);i--;)s[i]=arguments[i];return r.then(function(){return e.apply(n,s)})}return e.apply(this,arguments)}}function wi(t,e){Ae=t}function ha(){queueMicrotask(ya)}function P(t){if(typeof this!="object")throw new TypeError("Promises must be constructed via new");this._listeners=[],this._lib=!1;var e=this._PSD=I;if(typeof t!="function"){if(t!==At)throw new TypeError("Not a function");this._state=arguments[1],this._value=arguments[2],this._state===!1&&Wr(this,this._value);return}this._state=null,this._value=null,++e.ref,_i(this,t)}function ki(t,e,r,n,i){this.onFulfilled=typeof t=="function"?t:null,this.onRejected=typeof e=="function"?e:null,this.resolve=r,this.reject=n,this.psd=i}function _i(t,e){try{e(r=>{if(t._state===null){if(r===t)throw new TypeError("A promise cannot be resolved with itself.");var n=t._lib&&ft();r&&typeof r.then=="function"?_i(t,(i,s)=>{r instanceof P?r._then(i,s):r.then(i,s)}):(t._state=!0,t._value=r,Pi(t)),n&&mt()}},Wr.bind(null,t))}catch(r){Wr(t,r)}}function Wr(t,e){if(Gt.push(e),t._state===null){var r=t._lib&&ft();e=Gr(e),t._state=!1,t._value=e,va(t),Pi(t),r&&mt()}}function Pi(t){var e=t._listeners;t._listeners=[];for(var r=0,n=e.length;r<n;++r)hn(t,e[r]);var i=t._PSD;--i.ref||i.finalize(),Ze===0&&(++Ze,Tt(()=>{--Ze===0&&gn()},[]))}function hn(t,e){if(t._state===null){t._listeners.push(e);return}var r=t._state?e.onFulfilled:e.onRejected;if(r===null)return(t._state?e.resolve:e.reject)(t._value);++e.psd.ref,++Ze,Tt(ga,[r,t,e])}function ga(t,e,r){try{var n,i=e._value;!e._state&&Gt.length&&(Gt=[]),n=Ae&&e._consoleTask?e._consoleTask.run(()=>t(i)):t(i),!e._state&&Gt.indexOf(i)===-1&&xa(e),r.resolve(n)}catch(s){r.reject(s)}finally{--Ze===0&&gn(),--r.psd.ref||r.psd.finalize()}}function ya(){et(Me,()=>{ft()&&mt()})}function ft(){var t=Vr;return Vr=!1,tr=!1,t}function mt(){var t,e,r;do for(;_t.length>0;)for(t=_t,_t=[],r=t.length,e=0;e<r;++e){var n=t[e];n[0].apply(null,n[1])}while(_t.length>0);Vr=!0,tr=!0}function gn(){var t=qe;qe=[],t.forEach(n=>{n._PSD.onunhandled.call(null,n._value,n)});for(var e=Yt.slice(0),r=e.length;r;)e[--r]()}function ba(t){function e(){t(),Yt.splice(Yt.indexOf(e),1)}Yt.push(e),++Ze,Tt(()=>{--Ze===0&&gn()},[])}function va(t){qe.some(e=>e._value===t._value)||qe.push(t)}function xa(t){for(var e=qe.length;e;)if(qe[--e]._value===t._value){qe.splice(e,1);return}}function Wt(t){return new P(At,!1,t)}function W(t,e){var r=I;return function(){var n=ft(),i=I;try{return $e(r,!0),t.apply(this,arguments)}catch(s){e&&e(s)}finally{$e(i,!1),n&&mt()}}}function Fe(t,e,r,n){var i=I,s=Object.create(i);s.parent=i,s.ref=0,s.global=!1,s.id=++Sa,Me.env,s.env=mn?{Promise:P,PromiseProp:{value:P,configurable:!0,writable:!0},all:P.all,race:P.race,allSettled:P.allSettled,any:P.any,resolve:P.resolve,reject:P.reject}:{},e&&ye(s,e),++i.ref,s.finalize=function(){--this.parent.ref||this.parent.finalize()};var a=et(s,t,r,n);return s.ref===0&&s.finalize(),a}function ht(){return ne.id||(ne.id=++wa),++ne.awaits,ne.echoes+=Si,ne.id}function Ue(){return ne.awaits?(--ne.awaits===0&&(ne.id=0),ne.echoes=ne.awaits*Si,!0):!1}function nr(t){return ne.echoes&&t&&t.constructor===Ge?(ht(),t.then(e=>(Ue(),e),e=>(Ue(),X(e)))):t}function ka(t){++rr,(!ne.echoes||--ne.echoes===0)&&(ne.echoes=ne.awaits=ne.id=0),qt.push(I),$e(t,!0)}function _a(){var t=qt[qt.length-1];qt.pop(),$e(t,!1)}function $e(t,e){var r=I;if((e?ne.echoes&&(!Zt++||t!==I):Zt&&(!--Zt||t!==I))&&queueMicrotask(e?ka.bind(null,t):_a),t!==I&&(I=t,r===Me&&(Me.env=Ei()),mn)){var n=Me.env.Promise,i=t.env;(r.global||t.global)&&(Object.defineProperty(se,"Promise",i.PromiseProp),n.all=i.all,n.race=i.race,n.resolve=i.resolve,n.reject=i.reject,i.allSettled&&(n.allSettled=i.allSettled),i.any&&(n.any=i.any))}}function Ei(){var t=se.Promise;return mn?{Promise:t,PromiseProp:Object.getOwnPropertyDescriptor(se,"Promise"),all:t.all,race:t.race,allSettled:t.allSettled,any:t.any,resolve:t.resolve,reject:t.reject}:{}}function et(t,e,r,n,i){var s=I;try{return $e(t,!0),e(r,n,i)}finally{$e(s,!1)}}function Xn(t,e,r,n){return typeof t!="function"?t:function(){var i=I;r&&ht(),$e(e,!0);try{return t.apply(this,arguments)}finally{$e(i,!1),n&&queueMicrotask(Ue)}}}function Mr(t){Promise===Ge&&ne.echoes===0?Zt===0?t():enqueueNativeMicroTask(t):setTimeout(t,0)}function qr(t,e,r,n){if(!t.idbdb||!t._state.openComplete&&!I.letThrough&&!t._vip){if(t._state.openComplete)return X(new M.DatabaseClosed(t._state.dbOpenError));if(!t._state.isBeingOpened){if(!t._state.autoOpen)return X(new M.DatabaseClosed);t.open().catch(V)}return t._state.dbReadyPromise.then(()=>qr(t,e,r,n))}else{var i=t._createTransaction(e,r,t._dbSchema);try{i.create(),t._state.PR1398_maxLoop=3}catch(s){return s.name===pn.InvalidState&&t.isOpen()&&--t._state.PR1398_maxLoop>0?(console.warn("Dexie: Need to reopen db"),t.close({disableAutoOpen:!1}),t.open().then(()=>qr(t,e,r,n))):X(s)}return i._promise(e,(s,a)=>Fe(()=>(I.trans=i,n(s,a,i)))).then(s=>{if(e==="readwrite")try{i.idbtrans.commit()}catch{}return e==="readonly"?s:i._completion.then(()=>s)})}}function tt(t,e){return t?e?function(){return t.apply(this,arguments)&&e.apply(this,arguments)}:t:e}function Ft(t){return typeof t=="string"&&!/\./.test(t)?e=>(e[t]===void 0&&t in e&&(e=Qe(e),delete e[t]),e):e=>e}function Ea(){throw M.Type("Entity instances must never be new:ed. Instances are generated by the framework bypassing the constructor.")}function F(t,e){try{let r=Jn(t),n=Jn(e);if(r!==n)return r==="Array"?1:n==="Array"?-1:r==="binary"?1:n==="binary"?-1:r==="string"?1:n==="string"?-1:r==="Date"?1:n!=="Date"?NaN:-1;switch(r){case"number":case"Date":case"string":return t>e?1:t<e?-1:0;case"binary":return Ta(ei(t),ei(e));case"Array":return Aa(t,e)}}catch{}return NaN}function Aa(t,e){let r=t.length,n=e.length,i=r<n?r:n;for(let s=0;s<i;++s){let a=F(t[s],e[s]);if(a!==0)return a}return r===n?0:r<n?-1:1}function Ta(t,e){let r=t.length,n=e.length,i=r<n?r:n;for(let s=0;s<i;++s)if(t[s]!==e[s])return t[s]<e[s]?-1:1;return r===n?0:r<n?-1:1}function Jn(t){let e=typeof t;if(e!=="object")return e;if(ArrayBuffer.isView(t))return"binary";let r=jr(t);return r==="ArrayBuffer"?"binary":r}function ei(t){return t instanceof Uint8Array?t:ArrayBuffer.isView(t)?new Uint8Array(t.buffer,t.byteOffset,t.byteLength):new Uint8Array(t)}function Xt(t,e,r){let{yProps:n}=t.schema;return n?(e&&r.numFailures>0&&(e=e.filter((i,s)=>!r.failures[s])),Promise.all(n.map(({updatesTable:i})=>e?t.db.table(i).where("k").anyOf(e).delete():t.db.table(i).clear())).then(()=>r)):r}function Di(t,e){let r=ie(e),n=r.length,i=!1;for(let s=0;s<n;++s){let a=r[s],o=e[a],l=Oe(t,a);o instanceof Xr?(he(t,a,o.execute(l)),i=!0):l!==o&&(he(t,a,o),i=!0)}return i}function Mt(t){var e={},r=function(o,l){if(l){for(var c=arguments.length,p=new Array(c-1);--c;)p[c-1]=arguments[c];return e[o].subscribe.apply(null,p),t}else if(typeof o=="string")return e[o]};r.addEventType=s;for(var n=1,i=arguments.length;n<i;++n)s(arguments[n]);return r;function s(o,l,c){if(typeof o=="object")return a(o);l||(l=pa),c||(c=V);var p={subscribers:[],fire:c,subscribe:function(u){p.subscribers.indexOf(u)===-1&&(p.subscribers.push(u),p.fire=l(p.fire,u))},unsubscribe:function(u){p.subscribers=p.subscribers.filter(function(d){return d!==u}),p.fire=p.subscribers.reduce(l,c)}};return e[o]=r[o]=p,p}function a(o){ie(o).forEach(function(l){var c=o[l];if(q(c))s(l,o[l][0],o[l][1]);else if(c==="asap")var p=s(l,Ot,function(){for(var d=arguments.length,m=new Array(d);d--;)m[d]=arguments[d];p.subscribers.forEach(function(f){mi(function(){f.apply(null,m)})})});else throw new M.InvalidArgument("Invalid event config")})}}function Nt(t,e){return dt(e).from({prototype:t}),e}function Da(t){return Nt(ir.prototype,function(r,n,i){this.db=t,this._tx=i,this.name=r,this.schema=n,this.hook=t._allTables[r]?t._allTables[r].hook:Mt(null,{creating:[ca,V],reading:[la,Ot],updating:[da,V],deleting:[ua,V]})})}function it(t,e){return!(t.filter||t.algorithm||t.or)&&(e?t.justLimit:!t.replayFilter)}function Kr(t,e){t.filter=tt(t.filter,e)}function Lr(t,e,r){var n=t.replayFilter;t.replayFilter=n?()=>tt(n(),e()):e,t.justLimit=r&&!n}function Ra(t,e){t.isMatch=tt(t.isMatch,e)}function Qt(t,e){if(t.isPrimKey)return e.primaryKey;let r=e.getIndexByKeyPath(t.index);if(!r)throw new M.Schema("KeyPath "+t.index+" on object store "+e.name+" is not indexed");return r}function ti(t,e,r){let n=Qt(t,e.schema);return e.openCursor({trans:r,values:!t.keysOnly,reverse:t.dir==="prev",unique:!!t.unique,query:{index:n,range:t.range}})}function Ut(t,e,r,n){let i=t.replayFilter?tt(t.filter,t.replayFilter()):t.filter;if(t.or){let s={},a=(o,l,c)=>{if(!i||i(l,c,d=>l.stop(d),d=>l.fail(d))){var p=l.primaryKey,u=""+p;u==="[object ArrayBuffer]"&&(u=""+new Uint8Array(p)),be(s,u)||(s[u]=!0,e(o,l,c))}};return Promise.all([t.or._iterate(a,r),ri(ti(t,n,r),t.algorithm,a,!t.keysOnly&&t.valueMapper)])}else return ri(ti(t,n,r),tt(t.algorithm,i),e,!t.keysOnly&&t.valueMapper)}function ri(t,e,r,n){var i=n?(a,o,l)=>r(n(a),o,l):r,s=W(i);return t.then(a=>{if(a)return a.start(()=>{var o=()=>a.continue();(!e||e(a,l=>o=l,l=>{a.stop(l),o=V},l=>{a.fail(l),o=V}))&&s(a.value,a,l=>o=l),o()})})}function Ia(t){return Nt(Qr.prototype,function(r,n){this.db=t;let i=Ti,s=null;if(n)try{i=n()}catch(c){s=c}let a=r._ctx,o=a.table,l=o.hook.reading.fire;this._ctx={table:o,index:a.index,isPrimKey:!a.index||o.schema.primKey.keyPath&&a.index===o.schema.primKey.name,range:i,keysOnly:!1,dir:"next",unique:"",algorithm:null,filter:null,replayFilter:null,justLimit:!0,isMatch:null,offset:0,limit:1/0,error:s,or:a.or,valueMapper:l!==Ot?l:null}})}function Ca(t,e){return t<e?-1:t===e?0:1}function Oa(t,e){return t>e?-1:t===e?0:1}function ge(t,e,r){var n=t instanceof sr?new t.Collection(t):t;return n._ctx.error=r?new r(e):new TypeError(e),n}function st(t){return new t.Collection(t,()=>Ri("")).limit(0)}function Ma(t){return t==="next"?e=>e.toUpperCase():e=>e.toLowerCase()}function Na(t){return t==="next"?e=>e.toLowerCase():e=>e.toUpperCase()}function za(t,e,r,n,i,s){for(var a=Math.min(t.length,n.length),o=-1,l=0;l<a;++l){var c=e[l];if(c!==n[l])return i(t[l],r[l])<0?t.substr(0,l)+r[l]+r.substr(l+1):i(t[l],n[l])<0?t.substr(0,l)+n[l]+r.substr(l+1):o>=0?t.substr(0,o)+e[o]+r.substr(o+1):null;i(t[l],c)<0&&(o=l)}return a<n.length&&s==="next"?t+r.substr(t.length):a<t.length&&s==="prev"?t.substr(0,r.length):o<0?null:t.substr(0,o)+n[o]+r.substr(o+1)}function $t(t,e,r,n){var i,s,a,o,l,c,p,u=r.length;if(!r.every(h=>typeof h=="string"))return ge(t,Ai);function d(h){i=Ma(h),s=Na(h),a=h==="next"?Ca:Oa;var y=r.map(function(g){return{lower:s(g),upper:i(g)}}).sort(function(g,b){return a(g.lower,b.lower)});o=y.map(function(g){return g.upper}),l=y.map(function(g){return g.lower}),c=h,p=h==="next"?"":n}d("next");var m=new t.Collection(t,()=>Ke(o[0],l[u-1]+n));m._ondirectionchange=function(h){d(h)};var f=0;return m._addAlgorithm(function(h,y,g){var b=h.key;if(typeof b!="string")return!1;var S=s(b);if(e(S,l,f))return!0;for(var v=null,x=f;x<u;++x){var w=za(b,S,o[x],l[x],a,c);w===null&&v===null?f=x+1:(v===null||a(v,w)>0)&&(v=w)}return y(v!==null?function(){h.continue(v+p)}:g),!1}),m}function Ke(t,e,r,n){return{type:2,lower:t,upper:e,lowerOpen:r,upperOpen:n}}function Ri(t){return{type:1,lower:t,upper:t}}function Ka(t){return Nt(sr.prototype,function(r,n,i){if(this.db=t,this._ctx={table:r,index:n===":id"?null:n,or:i},this._cmp=this._ascending=F,this._descending=(s,a)=>F(a,s),this._max=(s,a)=>F(s,a)>0?s:a,this._min=(s,a)=>F(s,a)<0?s:a,this._IDBKeyRange=t._deps.IDBKeyRange,!this._IDBKeyRange)throw new M.MissingAPI})}function _e(t){return W(function(e){return Dt(e),t(e.target.error),!1})}function Dt(t){t.stopPropagation&&t.stopPropagation(),t.preventDefault&&t.preventDefault()}function La(t){return Nt(en.prototype,function(r,n,i,s,a){r!=="readonly"&&n.forEach(o=>{let l=i[o]?.yProps;l&&(n=n.concat(l.map(c=>c.updatesTable)))}),this.db=t,this.mode=r,this.storeNames=n,this.schema=i,this.chromeTransactionDurability=s,this.idbtrans=null,this.on=Mt(this,"complete","error","abort"),this.parent=a||null,this.active=!0,this._reculock=0,this._blockedFuncs=[],this._resolve=null,this._reject=null,this._waitingFor=null,this._waitingQueue=null,this._spinCount=0,this._completion=new P((o,l)=>{this._resolve=o,this._reject=l}),this._completion.then(()=>{this.active=!1,this.on.complete.fire()},o=>{var l=this.active;return this.active=!1,this.on.error.fire(o),this.parent?this.parent._reject(o):l&&this.idbtrans&&this.idbtrans.abort(),X(o)})})}function tn(t,e,r,n,i,s,a,o){return{name:t,keyPath:e,unique:r,multi:n,auto:i,compound:s,src:(r&&!a?"&":"")+(n?"*":"")+(i?"++":"")+Ii(e),type:o}}function Ii(t){return typeof t=="string"?t:t?"["+[].join.call(t,"+")+"]":""}function yn(t,e,r){return{name:t,primKey:e,indexes:r,mappedClass:null,idxByName:Qs(r,n=>[n.name,n])}}function Ba(t){return t.length===1?t[0]:t}function rn(t){return t==null?()=>{}:typeof t=="string"?Fa(t):e=>Oe(e,t)}function Fa(t){return t.split(".").length===1?r=>r[t]:r=>Oe(r,t)}function ii(t){return[].slice.call(t)}function Et(t){return t==null?":id":typeof t=="string"?t:`[${t.join("+")}]`}function $a(t,e,r){function n(u,d){let m=ii(u.objectStoreNames),f=m.length>0?d.objectStore(m[0]):{};return{schema:{name:u.name,tables:m.map(h=>d.objectStore(h)).map(h=>{let{keyPath:y,autoIncrement:g}=h,b=q(y),S=y==null,v={},x={name:h.name,primaryKey:{name:null,isPrimaryKey:!0,outbound:S,compound:b,keyPath:y,autoIncrement:g,unique:!0,extractKey:rn(y)},indexes:ii(h.indexNames).map(w=>h.index(w)).map(w=>{let{name:E,unique:T,multiEntry:C,keyPath:D}=w,K=q(D),R={name:E,compound:K,keyPath:D,unique:T,multiEntry:C,extractKey:rn(D)};return v[Et(D)]=R,R}),getIndexByKeyPath:w=>v[Et(w)]};return v[":id"]=x.primaryKey,y!=null&&(v[Et(y)]=x.primaryKey),x})},hasGetAll:m.length>0&&"getAll"in f&&!(typeof navigator<"u"&&/Safari/.test(navigator.userAgent)&&!/(Chrome\/|Edge\/)/.test(navigator.userAgent)&&[].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1]<604),hasIdb3Features:"getAllRecords"in f}}function i(u){if(u.type===3)return null;if(u.type===4)throw new Error("Cannot convert never type to IDBKeyRange");let{lower:d,upper:m,lowerOpen:f,upperOpen:h}=u;return d===void 0?m===void 0?null:e.upperBound(m,!!h):m===void 0?e.lowerBound(d,!!f):e.bound(d,m,!!f,!!h)}function s(u){let d=u.name;function m({trans:y,type:g,keys:b,values:S,range:v}){return new Promise((x,w)=>{x=W(x);let E=y.objectStore(d),T=E.keyPath==null,C=g==="put"||g==="add";if(!C&&g!=="delete"&&g!=="deleteRange")throw new Error("Invalid operation type: "+g);let{length:D}=b||S||{length:1};if(b&&S&&b.length!==S.length)throw new Error("Given keys array must have same length as given values array.");if(D===0)return x({numFailures:0,failures:{},results:[],lastResult:void 0});let K,R=[],U=[],N=0,Q=$=>{++N,Dt($)};if(g==="deleteRange"){if(v.type===4)return x({numFailures:N,failures:U,results:[],lastResult:void 0});v.type===3?R.push(K=E.clear()):R.push(K=E.delete(i(v)))}else{let[$,Z]=C?T?[S,b]:[S,null]:[b,null];if(C)for(let H=0;H<D;++H)R.push(K=Z&&Z[H]!==void 0?E[g]($[H],Z[H]):E[g]($[H])),K.onerror=Q;else for(let H=0;H<D;++H)R.push(K=E[g]($[H])),K.onerror=Q}let j=$=>{let Z=$.target.result;R.forEach((H,de)=>H.error!=null&&(U[de]=H.error)),x({numFailures:N,failures:U,results:g==="delete"?b:R.map(H=>H.result),lastResult:Z})};K.onerror=$=>{Q($),j($)},K.onsuccess=j})}function f({trans:y,values:g,query:b,reverse:S,unique:v}){return new Promise((x,w)=>{x=W(x);let{index:E,range:T}=b,C=y.objectStore(d),D=E.isPrimaryKey?C:C.index(E.name),K=S?v?"prevunique":"prev":v?"nextunique":"next",R=g||!("openKeyCursor"in D)?D.openCursor(i(T),K):D.openKeyCursor(i(T),K);R.onerror=_e(w),R.onsuccess=W(U=>{let N=R.result;if(!N){x(null);return}N.___id=++Ua,N.done=!1;let Q=N.continue.bind(N),j=N.continuePrimaryKey;j&&(j=j.bind(N));let $=N.advance.bind(N),Z=()=>{throw new Error("Cursor not started")},H=()=>{throw new Error("Cursor not stopped")};N.trans=y,N.stop=N.continue=N.continuePrimaryKey=N.advance=Z,N.fail=W(w),N.next=function(){let de=1;return this.start(()=>de--?this.continue():this.stop()).then(()=>this)},N.start=de=>{let ae=new Promise((pe,fe)=>{pe=W(pe),R.onerror=_e(fe),N.fail=fe,N.stop=Re=>{N.stop=N.continue=N.continuePrimaryKey=N.advance=H,pe(Re)}}),te=()=>{if(R.result)try{de()}catch(pe){N.fail(pe)}else N.done=!0,N.start=()=>{throw new Error("Cursor behind last entry")},N.stop()};return R.onsuccess=W(pe=>{R.onsuccess=te,te()}),N.continue=Q,N.continuePrimaryKey=j,N.advance=$,te(),ae},x(N)},w)})}function h(y,g){return b=>new Promise((S,v)=>{S=W(S);let{trans:x,values:w,limit:E,query:T}=b,C=b.direction??"next",D=E===1/0?void 0:E,{index:K,range:R}=T,U=x.objectStore(d),N=K.isPrimaryKey?U:U.index(K.name),Q=i(R);if(E===0)return S({result:[]});if(g){let j={query:Q,count:D,direction:C},$=w?N.getAll(j):N.getAllKeys(j);$.onsuccess=Z=>S({result:Z.target.result}),$.onerror=_e(v)}else if(y&&C==="next"){let j=w?N.getAll(Q,D):N.getAllKeys(Q,D);j.onsuccess=$=>S({result:$.target.result}),j.onerror=_e(v)}else{let j=0,$=w||!("openKeyCursor"in N)?N.openCursor(Q,C):N.openKeyCursor(Q,C),Z=[];$.onsuccess=()=>{let H=$.result;if(!H)return S({result:Z});if(Z.push(w?H.value:H.primaryKey),++j===E)return S({result:Z});H.continue()},$.onerror=_e(v)}})}return{name:d,schema:u,mutate:m,getMany({trans:y,keys:g}){return new Promise((b,S)=>{b=W(b);let v=y.objectStore(d),x=g.length,w=new Array(x),E=0,T=0,C,D=R=>{let U=R.target;(w[U._pos]=U.result)!=null,++T===E&&b(w)},K=_e(S);for(let R=0;R<x;++R)g[R]!=null&&(C=v.get(g[R]),C._pos=R,C.onsuccess=D,C.onerror=K,++E);E===0&&b(w)})},get({trans:y,key:g}){return new Promise((b,S)=>{b=W(b);let x=y.objectStore(d).get(g);x.onsuccess=w=>b(w.target.result),x.onerror=_e(S)})},query:h(o,l),openCursor:f,count({query:y,trans:g}){let{index:b,range:S}=y;return new Promise((v,x)=>{let w=g.objectStore(d),E=b.isPrimaryKey?w:w.index(b.name),T=i(S),C=T?E.count(T):E.count();C.onsuccess=W(D=>v(D.target.result)),C.onerror=_e(x)})}}}let{schema:a,hasGetAll:o,hasIdb3Features:l}=n(t,r),c=a.tables.map(u=>s(u)),p={};return c.forEach(u=>p[u.name]=u),{stack:"dbcore",transaction:t.transaction.bind(t),table(u){if(!p[u])throw new Error(`Table '${u}' not found`);return p[u]},MIN_KEY:-1/0,MAX_KEY:Rt(e),schema:a}}function ja(t,e){return e.reduce((r,{create:n})=>({...r,...n(r)}),t)}function Ha(t,e,{IDBKeyRange:r,indexedDB:n},i){return{dbcore:ja($a(e,r,i),t.dbcore)}}function ar(t,e){let r=e.db,n=Ha(t._middlewares,r,t._deps,e);t.core=n.dbcore,t.tables.forEach(i=>{let s=i.name;t.core.schema.tables.some(a=>a.name===s)&&(i.core=t.core.table(s),t[s]instanceof t.Table&&(t[s].core=i.core))})}function or(t,e,r,n){r.forEach(i=>{let s=n[i];e.forEach(a=>{let o=pi(a,i);(!o||"value"in o&&o.value===void 0)&&(a===t.Transaction.prototype||a instanceof t.Transaction?Be(a,i,{get(){return this.table(i)},set(l){di(this,i,{value:l,writable:!0,configurable:!0,enumerable:!0})}}):a[i]=new t.Table(i,s))})})}function nn(t,e){e.forEach(r=>{for(let n in r)r[n]instanceof t.Table&&delete r[n]})}function Va(t,e){return t._cfg.version-e._cfg.version}function Ga(t,e,r,n){let i=t._dbSchema;r.objectStoreNames.contains("$meta")&&!i.$meta&&(i.$meta=yn("$meta",Oi("")[0],[]),t._storeNames.push("$meta"));let s=t._createTransaction("readwrite",t._storeNames,i);s.create(r),s._completion.catch(n);let a=s._reject.bind(s),o=I.transless||I;Fe(()=>{if(I.trans=s,I.transless=o,e===0)ie(i).forEach(l=>{vn(r,l,i[l].primKey,i[l].indexes)}),ar(t,r),P.follow(()=>t.on.populate.fire(s)).catch(a);else return ar(t,r),Wa(t,s,e).then(l=>qa(t,l,s,r)).catch(a)})}function Ya(t,e){Ci(t._dbSchema,e),e.db.version%10===0&&!e.objectStoreNames.contains("$meta")&&e.db.createObjectStore("$meta").add(Math.ceil(e.db.version/10-1),"version");let r=yr(t,t.idbdb,e);cr(t,t._dbSchema,e);let n=bn(r,t._dbSchema);for(let i of n.change){if(i.change.length||i.recreate){console.warn(`Unable to patch indexes of table ${i.name} because it has changes on the type of index or primary key.`);return}let s=e.objectStore(i.name);i.add.forEach(a=>{Ae&&console.debug(`Dexie upgrade patch: Creating missing index ${i.name}.${a.src}`),lr(s,a)})}}function Wa(t,e,r){return e.storeNames.includes("$meta")?e.table("$meta").get("version").then(n=>n??r):P.resolve(r)}function qa(t,e,r,n){let i=[],s=t._versions,a=t._dbSchema=yr(t,t.idbdb,n),o=s.filter(c=>c._cfg.version>=e);if(o.length===0)return P.resolve();o.forEach(c=>{i.push(()=>{let p=a,u=c._cfg.dbschema;cr(t,p,n),cr(t,u,n),a=t._dbSchema=u;let d=bn(p,u);d.add.forEach(f=>{vn(n,f[0],f[1].primKey,f[1].indexes)}),d.change.forEach(f=>{if(f.recreate)throw new M.Upgrade("Not yet support for changing primary key");{let h=n.objectStore(f.name);f.add.forEach(y=>lr(h,y)),f.change.forEach(y=>{h.deleteIndex(y.name),lr(h,y)}),f.del.forEach(y=>h.deleteIndex(y))}});let m=c._cfg.contentUpgrade;if(m&&c._cfg.version>e){ar(t,n),r._memoizedTables={};let f=hi(u);d.del.forEach(b=>{f[b]=p[b]}),nn(t,[t.Transaction.prototype]),or(t,[t.Transaction.prototype],ie(f),f),r.schema=f;let h=un(m);h&&ht();let y,g=P.follow(()=>{if(y=m(r),y&&h){var b=Ue.bind(null,null);y.then(b,b)}});return y&&typeof y.then=="function"?P.resolve(y):g.then(()=>y)}}),i.push(p=>{let u=c._cfg.dbschema;Za(u,p),nn(t,[t.Transaction.prototype]),or(t,[t.Transaction.prototype],t._storeNames,t._dbSchema),r.schema=t._dbSchema}),i.push(p=>{t.idbdb.objectStoreNames.contains("$meta")&&(Math.ceil(t.idbdb.version/10)===c._cfg.version?(t.idbdb.deleteObjectStore("$meta"),delete t._dbSchema.$meta,t._storeNames=t._storeNames.filter(u=>u!=="$meta")):p.objectStore("$meta").put(c._cfg.version,"version"))})});function l(){return i.length?P.resolve(i.shift()(r.idbtrans)).then(l):P.resolve()}return l().then(()=>{Ci(a,n)})}function bn(t,e){let r={del:[],add:[],change:[]},n;for(n in t)e[n]||r.del.push(n);for(n in e){let i=t[n],s=e[n];if(!i)r.add.push([n,s]);else{let a={name:n,def:s,recreate:!1,del:[],add:[],change:[]};if(""+(i.primKey.keyPath||"")!=""+(s.primKey.keyPath||"")||i.primKey.auto!==s.primKey.auto)a.recreate=!0,r.change.push(a);else{let o=i.idxByName,l=s.idxByName,c;for(c in o)l[c]||a.del.push(c);for(c in l){let p=o[c],u=l[c];p?p.src!==u.src&&a.change.push(u):a.add.push(u)}(a.del.length>0||a.add.length>0||a.change.length>0)&&r.change.push(a)}}}return r}function vn(t,e,r,n){let i=t.db.createObjectStore(e,r.keyPath?{keyPath:r.keyPath,autoIncrement:r.auto}:{autoIncrement:r.auto});return n.forEach(s=>lr(i,s)),i}function Ci(t,e){ie(t).forEach(r=>{e.db.objectStoreNames.contains(r)||(Ae&&console.debug("Dexie: Creating missing table",r),vn(e,r,t[r].primKey,t[r].indexes))})}function Za(t,e){[].slice.call(e.db.objectStoreNames).forEach(r=>t[r]==null&&e.db.deleteObjectStore(r))}function lr(t,e){t.createIndex(e.name,e.keyPath,{unique:e.unique,multiEntry:e.multi})}function yr(t,e,r){let n={};return fr(e.objectStoreNames,0).forEach(s=>{let a=r.objectStore(s),o=a.keyPath,l=tn(Ii(o),o||"",!0,!1,!!a.autoIncrement,o&&typeof o!="string",!0),c=[];for(let u=0;u<a.indexNames.length;++u){let d=a.index(a.indexNames[u]);o=d.keyPath;var p=tn(d.name,o,!!d.unique,!!d.multiEntry,!1,o&&typeof o!="string",!1);c.push(p)}n[s]=yn(s,l,c)}),n}function Xa(t,e,r){t.verno=e.version/10;let n=t._dbSchema=yr(t,e,r);t._storeNames=fr(e.objectStoreNames,0),or(t,[t._allTables],ie(n),n)}function Qa(t,e){let r=yr(t,t.idbdb,e),n=bn(r,t._dbSchema);return!(n.add.length||n.change.some(i=>i.add.length||i.change.length))}function cr(t,e,r){let n=r.db.objectStoreNames;for(let i=0;i<n.length;++i){let s=n[i],a=r.objectStore(s);t._hasGetAll="getAll"in a;for(let o=0;o<a.indexNames.length;++o){let l=a.indexNames[o],c=a.index(l).keyPath,p=typeof c=="string"?c:"["+fr(c).join("+")+"]";if(e[s]){let u=e[s].idxByName[p];u&&(u.name=l,delete e[s].idxByName[p],e[s].idxByName[l]=u)}}}typeof navigator<"u"&&/Safari/.test(navigator.userAgent)&&!/(Chrome\/|Edge\/)/.test(navigator.userAgent)&&se.WorkerGlobalScope&&se instanceof se.WorkerGlobalScope&&[].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1]<604&&(t._hasGetAll=!1)}function Oi(t){return t.split(",").map((e,r)=>{let n=e.split(":"),i=n[1]?.trim();e=n[0].trim();let s=e.replace(/([&*]|\+\+)/g,""),a=/^\[/.test(s)?s.match(/^\[(.*)\]$/)[1].split("+"):s;return tn(s,a||null,/\&/.test(e),/\*/.test(e),/\+\+/.test(e),q(a),r===0,i)})}function Ja(t){return Nt(sn.prototype,function(r){this.db=t,this._cfg={version:r,storesSource:null,dbschema:{},tables:{},contentUpgrade:null}})}function eo(){if(typeof FinalizationRegistry<"u"&&typeof WeakRef<"u"){let t=new Set,e=new FinalizationRegistry(s=>{t.delete(s)});return{toArray:()=>Array.from(t).map(s=>s.deref()).filter(s=>s!==void 0),add:s=>{let a=new WeakRef(s._novip);if(t.add(a),e.register(s._novip,a,a),t.size>s._options.maxConnections){let o=t.values().next().value;t.delete(o),e.unregister(o)}},remove:s=>{if(!s)return;let a=t.values(),o=a.next();for(;!o.done;){let l=o.value;if(l.deref()===s._novip){t.delete(l),e.unregister(l);return}o=a.next()}}}}else{let t=[];return{toArray:()=>t,add:i=>{t.push(i._novip)},remove:i=>{if(!i)return;let s=t.indexOf(i._novip);s!==-1&&t.splice(s,1)}}}}function xn(t,e){let r=t._dbNamesDB;return r||(r=t._dbNamesDB=new Pe(hr,{addons:[],indexedDB:t,IDBKeyRange:e}),r.version(1).stores({dbnames:"name"})),r.table("dbnames")}function wn(t){return t&&typeof t.databases=="function"}function to({indexedDB:t,IDBKeyRange:e}){return wn(t)?Promise.resolve(t.databases()).then(r=>r.map(n=>n.name).filter(n=>n!==hr)):xn(t,e).toCollection().primaryKeys()}function ro({indexedDB:t,IDBKeyRange:e},r){!wn(t)&&r!==hr&&xn(t,e).put({name:r}).catch(V)}function no({indexedDB:t,IDBKeyRange:e},r){!wn(t)&&r!==hr&&xn(t,e).delete(r).catch(V)}function an(t){return Fe(function(){return I.letThrough=!0,t()})}function io(){var t=!navigator.userAgentData&&/Safari\//.test(navigator.userAgent)&&!/Chrom(e|ium)\//.test(navigator.userAgent);if(!t||!indexedDB.databases)return Promise.resolve();var e;return new Promise(function(r){var n=function(){return indexedDB.databases().finally(r)};e=setInterval(n,100),n()}).finally(function(){return clearInterval(e)})}function Sn(t){return!("from"in t)}function Ct(t,e,r){let n=F(e,r);if(isNaN(n))return;if(n>0)throw RangeError();if(Sn(t))return ye(t,{from:e,to:r,d:1});let i=t.l,s=t.r;if(F(r,t.from)<0)return i?Ct(i,e,r):t.l={from:e,to:r,d:1,l:null,r:null},si(t);if(F(e,t.to)>0)return s?Ct(s,e,r):t.r={from:e,to:r,d:1,l:null,r:null},si(t);F(e,t.from)<0&&(t.from=e,t.l=null,t.d=s?s.d+1:1),F(r,t.to)>0&&(t.to=r,t.r=null,t.d=t.l?t.l.d+1:1);let a=!t.r;i&&!t.l&&ur(t,i),s&&a&&ur(t,s)}function ur(t,e){function r(n,{from:i,to:s,l:a,r:o}){Ct(n,i,s),a&&r(n,a),o&&r(n,o)}Sn(e)||r(t,e)}function so(t,e){let r=dr(e),n=r.next();if(n.done)return!1;let i=n.value,s=dr(t),a=s.next(i.from),o=a.value;for(;!n.done&&!a.done;){if(F(o.from,i.to)<=0&&F(o.to,i.from)>=0)return!0;F(i.from,o.from)<0?i=(n=r.next(o.from)).value:o=(a=s.next(i.from)).value}return!1}function dr(t){let e=Sn(t)?null:{s:0,n:t};return{next(r){let n=arguments.length>0;for(;e;)switch(e.s){case 0:if(e.s=1,n)for(;e.n.l&&F(r,e.n.from)<0;)e={up:e,n:e.n.l,s:1};else for(;e.n.l;)e={up:e,n:e.n.l,s:1};case 1:if(e.s=2,!n||F(r,e.n.to)<=0)return{value:e.n,done:!1};case 2:if(e.n.r){e.s=3,e={up:e,n:e.n.r,s:0};continue}case 3:e=e.up}return{done:!0}}}}function si(t){let e=(t.r?.d||0)-(t.l?.d||0),r=e>1?"r":e<-1?"l":"";if(r){let n=r==="r"?"l":"r",i={...t},s=t[r];t.from=s.from,t.to=s.to,t[r]=s[r],i[r]=s[n],t[n]=i,i.d=ai(i)}t.d=ai(t)}function ai({r:t,l:e}){return(t?e?Math.max(t.d,e.d):t.d:e?e.d:0)+1}function br(t,e){return ie(e).forEach(r=>{t[r]?ur(t[r],e[r]):t[r]=bi(e[r])}),t}function kn(t,e){return t.all||e.all||Object.keys(t).some(r=>e[r]&&so(e[r],t[r]))}function jt(t,e=!1){br(Br,t),Fr||(Fr=!0,setTimeout(()=>{Fr=!1;let r=Br;Br={},_n(r,!1)},0))}function _n(t,e=!1){let r=new Set;if(t.all)for(let n of Object.values(Xe))oi(n,t,r,e);else for(let n in t){let i=/^idb\:\/\/(.*)\/(.*)\//.exec(n);if(i){let[,s,a]=i,o=Xe[`idb://${s}/${a}`];o&&oi(o,t,r,e)}}r.forEach(n=>n())}function oi(t,e,r,n){let i=[];for(let[s,a]of Object.entries(t.queries.query)){let o=[];for(let l of a)kn(e,l.obsSet)?l.subscribers.forEach(c=>r.add(c)):n&&o.push(l);n&&i.push([s,o])}if(n)for(let[s,a]of i)t.queries.query[s]=a}function ao(t){let e=t._state,{indexedDB:r}=t._deps;if(e.isBeingOpened||t.idbdb)return e.dbReadyPromise.then(()=>e.dbOpenError?X(e.dbOpenError):t);e.isBeingOpened=!0,e.dbOpenError=null,e.openComplete=!1;let n=e.openCanceller,i=Math.round(t.verno*10),s=!1;function a(){if(e.openCanceller!==n)throw new M.DatabaseClosed("db.open() was cancelled")}let o=e.dbReadyResolve,l=null,c=!1,p=()=>new P((u,d)=>{if(a(),!r)throw new M.MissingAPI;let m=t.name,f=e.autoSchema||!i?r.open(m):r.open(m,i);if(!f)throw new M.MissingAPI;f.onerror=_e(d),f.onblocked=W(t._fireOnBlocked),f.onupgradeneeded=W(h=>{if(l=f.transaction,e.autoSchema&&!t._options.allowEmptyDB){f.onerror=Dt,l.abort(),f.result.close();let y=r.deleteDatabase(m);y.onsuccess=y.onerror=W(()=>{d(new M.NoSuchDatabase(`Database ${m} doesnt exist`))})}else{l.onerror=_e(d);let y=h.oldVersion>Math.pow(2,62)?0:h.oldVersion;c=y<1,t.idbdb=f.result,s&&Ya(t,l),Ga(t,y/10,l,d)}},d),f.onsuccess=W(()=>{l=null;let h=t.idbdb=f.result,y=fr(h.objectStoreNames);if(y.length>0)try{let g=h.transaction(Ba(y),"readonly");if(e.autoSchema)Xa(t,h,g);else if(cr(t,t._dbSchema,g),!Qa(t,g)&&!s)return console.warn("Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Dexie will add missing parts and increment native version number to workaround this."),h.close(),i=h.version+1,s=!0,u(p());ar(t,g)}catch{}It.add(t),h.onversionchange=W(g=>{e.vcFired=!0,t.on("versionchange").fire(g)}),h.onclose=W(()=>{t.close({disableAutoOpen:!1})}),c&&ro(t._deps,m),u()},d)}).catch(u=>{switch(u?.name){case"UnknownError":if(e.PR1398_maxLoop>0)return e.PR1398_maxLoop--,console.warn("Dexie: Workaround for Chrome UnknownError on open()"),p();break;case"VersionError":if(i>0)return i=0,p();break}return P.reject(u)});return P.race([n,(typeof navigator>"u"?P.resolve():io()).then(p)]).then(()=>(a(),e.onReadyBeingFired=[],P.resolve(an(()=>t.on.ready.fire(t.vip))).then(function u(){if(e.onReadyBeingFired.length>0){let d=e.onReadyBeingFired.reduce(fn,V);return e.onReadyBeingFired=[],P.resolve(an(()=>d(t.vip))).then(u)}}))).finally(()=>{e.openCanceller===n&&(e.onReadyBeingFired=null,e.isBeingOpened=!1)}).catch(u=>{e.dbOpenError=u;try{l&&l.abort()}catch{}return n===e.openCanceller&&t._close(),X(u)}).finally(()=>{e.openComplete=!0,o()}).then(()=>{if(c){let u={};t.tables.forEach(d=>{d.schema.indexes.forEach(m=>{m.name&&(u[`idb://${t.name}/${d.name}/${m.name}`]=new ce(-1/0,[[[]]]))}),u[`idb://${t.name}/${d.name}/`]=u[`idb://${t.name}/${d.name}/:dels`]=new ce(-1/0,[[[]]])}),je(gr).fire(u),_n(u,!0)}return t})}function on(t){var e=a=>t.next(a),r=a=>t.throw(a),n=s(e),i=s(r);function s(a){return o=>{var l=a(o),c=l.value;return l.done?c:!c||typeof c.then!="function"?q(c)?Promise.all(c).then(n,i):n(c):c.then(n,i)}}return s(e)()}function oo(t,e,r){var n=arguments.length;if(n<2)throw new M.InvalidArgument("Too few arguments");for(var i=new Array(n-1);--n;)i[n-1]=arguments[n];r=i.pop();var s=gi(i);return[t,s,r]}function Mi(t,e,r,n,i){return P.resolve().then(()=>{let s=I.transless||I,a=t._createTransaction(e,r,t._dbSchema,n);a.explicit=!0;let o={trans:a,transless:s};if(n)a.idbtrans=n.idbtrans;else try{a.create(),a.idbtrans._explicit=!0,t._state.PR1398_maxLoop=3}catch(u){return u.name===pn.InvalidState&&t.isOpen()&&--t._state.PR1398_maxLoop>0?(console.warn("Dexie: Need to reopen db"),t.close({disableAutoOpen:!1}),t.open().then(()=>Mi(t,e,r,null,i))):X(u)}let l=un(i);l&&ht();let c,p=P.follow(()=>{if(c=i.call(a,a),c)if(l){var u=Ue.bind(null,null);c.then(u,u)}else typeof c.next=="function"&&typeof c.throw=="function"&&(c=on(c))},o);return(c&&typeof c.then=="function"?P.resolve(c).then(u=>a.active?u:X(new M.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"))):p.then(()=>c)).then(u=>(n&&a._resolve(),a._completion.then(()=>u))).catch(u=>(a._reject(u),X(u)))})}function Ht(t,e,r){let n=q(t)?t.slice():[t];for(let i=0;i<r;++i)n.push(e);return n}function lo(t){return{...t,table(e){let r=t.table(e),{schema:n}=r,i={},s=[];function a(d,m,f){let h=Et(d),y=i[h]=i[h]||[],g=d==null?0:typeof d=="string"?1:d.length,b=m>0,S={...f,name:b?`${h}(virtual-from:${f.name})`:f.name,lowLevelIndex:f,isVirtual:b,keyTail:m,keyLength:g,extractKey:rn(d),unique:!b&&f.unique};if(y.push(S),S.isPrimaryKey||s.push(S),g>1){let v=g===2?d[0]:d.slice(0,g-1);a(v,m+1,f)}return y.sort((v,x)=>v.keyTail-x.keyTail),S}let o=a(n.primaryKey.keyPath,0,n.primaryKey);i[":id"]=[o];for(let d of n.indexes)a(d.keyPath,0,d);function l(d){let m=i[Et(d)];return m&&m[0]}function c(d,m){return{type:d.type===1?2:d.type,lower:Ht(d.lower,d.lowerOpen?t.MAX_KEY:t.MIN_KEY,m),lowerOpen:!0,upper:Ht(d.upper,d.upperOpen?t.MIN_KEY:t.MAX_KEY,m),upperOpen:!0}}function p(d){let m=d.query.index;return m.isVirtual?{...d,query:{index:m.lowLevelIndex,range:c(d.query.range,m.keyTail)}}:d}return{...r,schema:{...n,primaryKey:o,indexes:s,getIndexByKeyPath:l},count(d){return r.count(p(d))},query(d){return r.query(p(d))},openCursor(d){let{keyTail:m,isVirtual:f,keyLength:h}=d.query.index;if(!f)return r.openCursor(d);function y(g){function b(v){v!=null?g.continue(Ht(v,d.reverse?t.MAX_KEY:t.MIN_KEY,m)):d.unique?g.continue(g.key.slice(0,h).concat(d.reverse?t.MIN_KEY:t.MAX_KEY,m)):g.continue()}return Object.create(g,{continue:{value:b},continuePrimaryKey:{value(v,x){g.continuePrimaryKey(Ht(v,t.MAX_KEY,m),x)}},primaryKey:{get(){return g.primaryKey}},key:{get(){let v=g.key;return h===1?v[0]:v.slice(0,h)}},value:{get(){return g.value}}})}return r.openCursor(p(d)).then(g=>g&&y(g))}}}}}function Pn(t,e,r,n){return r=r||{},n=n||"",ie(t).forEach(i=>{if(!be(e,i))r[n+i]=void 0;else{var s=t[i],a=e[i];if(typeof s=="object"&&typeof a=="object"&&s&&a){let o=jr(s),l=jr(a);o!==l?r[n+i]=e[i]:o==="Object"?Pn(s,a,r,n+i+"."):s!==a&&(r[n+i]=e[i])}else s!==a&&(r[n+i]=e[i])}}),ie(e).forEach(i=>{be(t,i)||(r[n+i]=e[i])}),r}function En(t,e){return e.type==="delete"?e.keys:e.keys||e.values.map(t.extractKey)}function po(t,e,r){return e.type==="add"?Promise.resolve([]):t.getMany({trans:e.trans,keys:r,cache:"immutable"})}function Ni(t,e,r){try{if(!e||e.keys.length<t.length)return null;let n=[];for(let i=0,s=0;i<e.keys.length&&s<t.length;++i)F(e.keys[i],t[s])===0&&(n.push(r?Qe(e.values[i]):e.values[i]),++s);return n.length===t.length?n:null}catch{return null}}function zi(t,e){return t.trans.mode==="readonly"&&!!t.subscr&&!t.trans.explicit&&t.trans.db._options.cache!=="disabled"&&!e.schema.primaryKey.outbound}function Ki(t,e){switch(t){case"query":return e.values&&!e.unique;case"get":return!1;case"getMany":return!1;case"count":return!1;case"openCursor":return!1}}function ho(t,e,r,n){function i(s){let a=t(s.name||"");function o(c){return c!=null?s.extractKey(c):null}let l=c=>s.multiEntry&&q(c)?c.forEach(p=>a.addKey(p)):a.addKey(c);(r||n).forEach((c,p)=>{let u=r&&o(r[p]),d=n&&o(n[p]);F(u,d)!==0&&(u!=null&&l(u),d!=null&&l(d))})}e.indexes.forEach(i)}function li(t,e,r){if(r.numFailures===0)return e;if(e.type==="deleteRange")return null;let n=e.keys?e.keys.length:"values"in e&&e.values?e.values.length:1;if(r.numFailures===n)return null;let i={...e};return q(i.keys)&&(i.keys=i.keys.filter((s,a)=>!(a in r.failures))),"values"in i&&q(i.values)&&(i.values=i.values.filter((s,a)=>!(a in r.failures))),i}function go(t,e){return e.lower===void 0?!0:e.lowerOpen?F(t,e.lower)>0:F(t,e.lower)>=0}function yo(t,e){return e.upper===void 0?!0:e.upperOpen?F(t,e.upper)<0:F(t,e.upper)<=0}function Ur(t,e){return go(t,e)&&yo(t,e)}function ci(t,e,r,n,i,s){if(!r||r.length===0)return t;let a=e.query.index,{multiEntry:o}=a,l=e.query.range,p=n.schema.primaryKey.extractKey,u=a.extractKey,d=(a.lowLevelIndex||a).extractKey,m=r.reduce((h,y)=>{let g=h,b=[];if(y.type==="add"||y.type==="put"){let S=new ce;for(let v=y.values.length-1;v>=0;--v){let x=y.values[v],w=p(x);if(S.hasKey(w))continue;let E=u(x);(o&&q(E)?E.some(T=>Ur(T,l)):Ur(E,l))&&(S.addKey(w),b.push(x))}}switch(y.type){case"add":{let x=new ce().addKeys(e.values?h.map(w=>p(w)):h);g=h.concat(e.values?b.filter(w=>{let E=p(w);return x.hasKey(E)?!1:(x.addKey(E),!0)}):b.map(w=>p(w)).filter(w=>x.hasKey(w)?!1:(x.addKey(w),!0)));break}case"put":{let x=new ce().addKeys(y.values.map(w=>p(w)));g=h.filter(w=>!x.hasKey(e.values?p(w):w)).concat(e.values?b:b.map(w=>p(w)));break}case"delete":let S=new ce().addKeys(y.keys);g=h.filter(x=>!S.hasKey(e.values?p(x):x));break;case"deleteRange":let v=y.range;g=h.filter(x=>!Ur(p(x),v));break}return g},t);if(m===t)return t;let f=(h,y)=>F(d(h),d(y))||F(p(h),p(y));return m.sort(e.direction==="prev"||e.direction==="prevunique"?(h,y)=>f(y,h):f),e.limit&&e.limit<1/0&&(m.length>e.limit?m.length=e.limit:t.length===e.limit&&m.length<e.limit&&(i.dirty=!0)),s?Object.freeze(m):m}function ui(t,e){return F(t.lower,e.lower)===0&&F(t.upper,e.upper)===0&&!!t.lowerOpen==!!e.lowerOpen&&!!t.upperOpen==!!e.upperOpen}function bo(t,e,r,n){if(t===void 0)return e!==void 0?-1:0;if(e===void 0)return 1;let i=F(t,e);if(i===0){if(r&&n)return 0;if(r)return 1;if(n)return-1}return i}function vo(t,e,r,n){if(t===void 0)return e!==void 0?1:0;if(e===void 0)return-1;let i=F(t,e);if(i===0){if(r&&n)return 0;if(r)return-1;if(n)return 1}return i}function xo(t,e){return bo(t.lower,e.lower,t.lowerOpen,e.lowerOpen)<=0&&vo(t.upper,e.upper,t.upperOpen,e.upperOpen)>=0}function wo(t,e,r,n){let i=Xe[`idb://${t}/${e}`];if(!i)return[];let s=i.queries[r];if(!s)return[null,!1,i,null];let a=n.query?n.query.index.name:null,o=s[a||""];if(!o)return[null,!1,i,null];switch(r){case"query":let l=n.direction??"next",c=o.find(d=>d.req.limit===n.limit&&d.req.values===n.values&&(d.req.direction??"next")===l&&ui(d.req.query.range,n.query.range));return c?[c,!0,i,o]:[o.find(d=>("limit"in d.req?d.req.limit:1/0)>=n.limit&&(d.req.direction??"next")===l&&(n.values?d.req.values:!0)&&xo(d.req.query.range,n.query.range)),!1,i,o];case"count":let u=o.find(d=>ui(d.req.query.range,n.query.range));return[u,!!u,i,o]}}function So(t,e,r,n){t.subscribers.add(r),n.addEventListener("abort",()=>{t.subscribers.delete(r),t.subscribers.size===0&&ko(t,e)})}function ko(t,e){setTimeout(()=>{t.subscribers.size===0&&Ve(e,t)},3e3)}function Vt(t,e){return new Proxy(t,{get(r,n,i){return n==="db"?e:Reflect.get(r,n,i)}})}function Eo(t){let e=!1,r,n=new ln(i=>{let s=un(t);function a(g){let b=ft();try{s&&ht();let S=Fe(t,g);return s&&(S=S.finally(Ue)),S}finally{b&&mt()}}let o=!1,l,c={},p={},u={get closed(){return o},unsubscribe:()=>{o||(o=!0,l&&l.abort(),d&&je.storagemutated.unsubscribe(h))}};i.start&&i.start(u);let d=!1,m=()=>Mr(y);function f(){return kn(p,c)}let h=g=>{br(c,g),f()&&m()},y=()=>{if(o||!pr.indexedDB)return;c={};let g={};l&&l.abort(),l=new AbortController;let b={subscr:g,signal:l.signal,requery:m,querier:t,trans:null},S=a(b);d||(je.storagemutated.subscribe(h),d=!0),Promise.resolve(S).then(v=>{e=!0,r=v,!(o||b.signal.aborted)&&(f()?m():(p=g,f()?m():(c={},Mr(()=>!o&&i.next&&i.next(v)))))},v=>{e=!1,["DatabaseClosedError","AbortError"].includes(v?.name)||o||Mr(()=>{o||i.error&&i.error(v)})})};return setTimeout(m,0),u});return n.hasValue=()=>e,n.getValue=()=>r,n}function An(t){let e=Le;try{Le=!0,je.storagemutated.fire(t),_n(t,!0)}finally{Le=e}}var se,ie,q,ct,qs,di,Zs,Xs,ea,ta,yi,Pt,ra,Hr,na,at,un,ia,vi,dn,sa,pn,aa,M,Wn,mr,Ae,At,Si,qn,Zn,fa,ma,Ge,mn,Tt,Vr,tr,qe,Gt,Gr,Me,I,_t,Ze,Yt,Yr,ne,wa,qt,Zt,rr,Sa,X,Qn,We,Zr,Ie,Ai,Pa,hr,Nr,zr,Ti,Xr,ir,Qr,ni,sr,gr,Jr,je,en,Rt,Ua,sn,It,ce,Xe,Br,Fr,co,uo,fo,mo,_o,Pe,Po,ln,pr,Ye,Le,ot,cn,Tn=le(()=>{se=typeof globalThis<"u"?globalThis:typeof self<"u"?self:typeof window<"u"?window:global,ie=Object.keys,q=Array.isArray;typeof Promise<"u"&&!se.Promise&&(se.Promise=Promise);ct=Object.getPrototypeOf,qs={}.hasOwnProperty;di=Object.defineProperty;Zs=Object.getOwnPropertyDescriptor;Xs=[].slice;ea=[].concat;ta="BigUint64Array,BigInt64Array,Array,Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,FileSystemDirectoryHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey".split(",").concat(gi([8,16,32,64].map(t=>["Int","Uint","Float"].map(e=>e+t+"Array")))).filter(t=>se[t]),yi=new Set(ta.map(t=>se[t]));Pt=null;({toString:ra}={});Hr=typeof Symbol<"u"?Symbol.iterator:"@@iterator",na=typeof Hr=="symbol"?function(t){var e;return t!=null&&(e=t[Hr])&&e.apply(t)}:function(){return null};at={};un=typeof Symbol<"u"?t=>t[Symbol.toStringTag]==="AsyncFunction":()=>!1,ia=["Modify","Bulk","OpenFailed","VersionChange","Schema","Upgrade","InvalidTable","MissingAPI","NoSuchDatabase","InvalidArgument","SubTransaction","Unsupported","Internal","DatabaseClosed","PrematureCommit","ForeignAwait"],vi=["Unknown","Constraint","Data","TransactionInactive","ReadOnly","Version","NotFound","InvalidState","InvalidAccess","Abort","Timeout","QuotaExceeded","Syntax","DataClone"],dn=ia.concat(vi),sa={VersionChanged:"Database version changed by other database connection",DatabaseClosed:"Database has been closed",Abort:"Transaction aborted",TransactionInactive:"Transaction has already completed or failed",MissingAPI:"IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb"};dt(pt).from(Error).extend({toString:function(){return this.name+": "+this.message}});dt(er).from(pt);dt(lt).from(pt);pn=dn.reduce((t,e)=>(t[e]=e+"Error",t),{}),aa=pt,M=dn.reduce((t,e)=>{var r=e+"Error";function n(i,s){this.name=r,i?typeof i=="string"?(this.message=`${i}${s?`
 `+s:""}`,this.inner=s||null):typeof i=="object"&&(this.message=`${i.name} ${i.message}`,this.inner=i):(this.message=sa[e]||r,this.inner=null)}return dt(n).from(aa),t[e]=n,t},{});M.Syntax=SyntaxError;M.Type=TypeError;M.Range=RangeError;Wn=vi.reduce((t,e)=>(t[e+"Error"]=M[e],t),{});mr=dn.reduce((t,e)=>(["Syntax","Type","Range"].indexOf(e)===-1&&(t[e+"Error"]=M[e]),t),{});mr.ModifyError=er;mr.DexieError=pt;mr.BulkError=lt;Ae=typeof location<"u"&&/^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);At={},Si=100,[qn,Zn,fa]=typeof Promise>"u"?[]:(()=>{let t=Promise.resolve();if(typeof crypto>"u"||!crypto.subtle)return[t,ct(t),t];let e=crypto.subtle.digest("SHA-512",new Uint8Array([0]));return[e,ct(e),t]})(),ma=Zn&&Zn.then,Ge=qn&&qn.constructor,mn=!!fa;Tt=function(t,e){_t.push([t,e]),tr&&(ha(),tr=!1)},Vr=!0,tr=!0,qe=[],Gt=[],Gr=Ot,Me={id:"global",global:!0,ref:0,unhandleds:[],onunhandled:V,pgp:!1,env:{},finalize:V},I=Me,_t=[],Ze=0,Yt=[];Yr={get:function(){var t=I,e=rr;function r(n,i){var s=!t.global&&(t!==I||e!==rr);let a=s&&!Ue();var o=new P((l,c)=>{hn(this,new ki(Xn(n,t,s,a),Xn(i,t,s,a),l,c,t))});return this._consoleTask&&(o._consoleTask=this._consoleTask),o}return r.prototype=At,r},set:function(t){Be(this,"then",t&&t.prototype===At?Yr:{get:function(){return t},set:Yr.set})}};ut(P.prototype,{then:Yr,_then:function(t,e){hn(this,new ki(null,null,t,e,I))},catch:function(t){if(arguments.length===1)return this.then(null,t);var e=arguments[0],r=arguments[1];return typeof e=="function"?this.then(null,n=>n instanceof e?r(n):Wt(n)):this.then(null,n=>n&&n.name===e?r(n):Wt(n))},finally:function(t){return this.then(e=>P.resolve(t()).then(()=>e),e=>P.resolve(t()).then(()=>Wt(e)))},timeout:function(t,e){return t<1/0?new P((r,n)=>{var i=setTimeout(()=>n(new M.Timeout(e)),t);this.then(r,n).finally(clearTimeout.bind(null,i))}):this}});typeof Symbol<"u"&&Symbol.toStringTag&&Be(P.prototype,Symbol.toStringTag,"Dexie.Promise");Me.env=Ei();ut(P,{all:function(){var t=Ce.apply(null,arguments).map(nr);return new P(function(e,r){t.length===0&&e([]);var n=t.length;t.forEach((i,s)=>P.resolve(i).then(a=>{t[s]=a,--n||e(t)},r))})},resolve:t=>{if(t instanceof P)return t;if(t&&typeof t.then=="function")return new P((r,n)=>{t.then(r,n)});var e=new P(At,!0,t);return e},reject:Wt,race:function(){var t=Ce.apply(null,arguments).map(nr);return new P((e,r)=>{t.map(n=>P.resolve(n).then(e,r))})},PSD:{get:()=>I,set:t=>I=t},totalEchoes:{get:()=>rr},newPSD:Fe,usePSD:et,scheduler:{get:()=>Tt,set:t=>{Tt=t}},rejectionMapper:{get:()=>Gr,set:t=>{Gr=t}},follow:(t,e)=>new P((r,n)=>Fe((i,s)=>{var a=I;a.unhandleds=[],a.onunhandled=s,a.finalize=Je(function(){ba(()=>{this.unhandleds.length===0?i():s(this.unhandleds[0])})},a.finalize),t()},e,r,n))});Ge&&(Ge.allSettled&&Be(P,"allSettled",function(){let t=Ce.apply(null,arguments).map(nr);return new P(e=>{t.length===0&&e([]);let r=t.length,n=new Array(r);t.forEach((i,s)=>P.resolve(i).then(a=>n[s]={status:"fulfilled",value:a},a=>n[s]={status:"rejected",reason:a}).then(()=>--r||e(n)))})}),Ge.any&&typeof AggregateError<"u"&&Be(P,"any",function(){let t=Ce.apply(null,arguments).map(nr);return new P((e,r)=>{t.length===0&&r(new AggregateError([]));let n=t.length,i=new Array(n);t.forEach((s,a)=>P.resolve(s).then(o=>e(o),o=>{i[a]=o,--n||r(new AggregateError(i))}))})}),Ge.withResolvers&&(P.withResolvers=Ge.withResolvers));ne={awaits:0,echoes:0,id:0},wa=0,qt=[],Zt=0,rr=0,Sa=0;(""+ma).indexOf("[native code]")===-1&&(ht=Ue=V);X=P.reject;Qn="4.4.4",We="\uFFFF",Zr=-1/0,Ie="Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.",Ai="String expected.",Pa=1e3,hr="__dbnames",Nr="readonly",zr="readwrite";Ti={type:3,lower:-1/0,lowerOpen:!1,upper:[[]],upperOpen:!1};Xr=class{execute(e){let r=this["@@propmod"];if(r.add!==void 0){let i=r.add;if(q(i))return[...q(e)?e:[],...i].sort();if(typeof i=="number")return(Number(e)||0)+i;if(typeof i=="bigint")try{return BigInt(e)+i}catch{return BigInt(0)+i}throw new TypeError(`Invalid term ${i}`)}if(r.remove!==void 0){let i=r.remove;if(q(i))return q(e)?e.filter(s=>!i.includes(s)).sort():[];if(typeof i=="number")return Number(e)-i;if(typeof i=="bigint")try{return BigInt(e)-i}catch{return BigInt(0)-i}throw new TypeError(`Invalid subtrahend ${i}`)}let n=r.replacePrefix?.[0];return n&&typeof e=="string"&&e.startsWith(n)?r.replacePrefix[1]+e.substring(n.length):e}constructor(e){this["@@propmod"]=e}};ir=class{_trans(e,r,n){let i=this._tx||I.trans,s=this.name,a=Ae&&typeof console<"u"&&console.createTask&&console.createTask(`Dexie: ${e==="readonly"?"read":"write"} ${this.name}`);function o(c,p,u){if(!u.schema[s])throw new M.NotFound("Table "+s+" not part of transaction");return r(u.idbtrans,u)}let l=ft();try{let c=i&&i.db._novip===this.db._novip?i===I.trans?i._promise(e,o,n):Fe(()=>i._promise(e,o,n),{trans:i,transless:I.transless||I}):qr(this.db,e,[this.name],o);return a&&(c._consoleTask=a,c=c.catch(p=>(console.trace(p),X(p)))),c}finally{l&&mt()}}get(e,r){return e&&e.constructor===Object?this.where(e).first(r):e==null?X(new M.Type("Invalid argument to Table.get()")):this._trans("readonly",n=>this.core.get({trans:n,key:e}).then(i=>this.hook.reading.fire(i))).then(r)}where(e){if(typeof e=="string")return new this.db.WhereClause(this,e);if(q(e))return new this.db.WhereClause(this,`[${e.join("+")}]`);let r=ie(e);if(r.length===1)return this.where(r[0]).equals(e[r[0]]);let n=this.schema.indexes.concat(this.schema.primKey).filter(l=>{if(l.compound&&r.every(c=>l.keyPath.indexOf(c)>=0)){for(let c=0;c<r.length;++c)if(r.indexOf(l.keyPath[c])===-1)return!1;return!0}return!1}).sort((l,c)=>l.keyPath.length-c.keyPath.length)[0];if(n&&this.db._maxKey!==We){let l=n.keyPath.slice(0,r.length);return this.where(l).equals(l.map(c=>e[c]))}!n&&Ae&&console.warn(`The query ${JSON.stringify(e)} on ${this.name} would benefit from a compound index [${r.join("+")}]`);let{idxByName:i}=this.schema;function s(l,c){return F(l,c)===0}let[a,o]=r.reduce(([l,c],p)=>{let u=i[p],d=e[p];return[l||u,l||!u?tt(c,u&&u.multi?m=>{let f=Oe(m,p);return q(f)&&f.some(h=>s(d,h))}:m=>s(d,Oe(m,p))):c]},[null,null]);return a?this.where(a.name).equals(e[a.keyPath]).filter(o):n?this.filter(o):this.where(r).equals("")}filter(e){return this.toCollection().and(e)}count(e){return this.toCollection().count(e)}offset(e){return this.toCollection().offset(e)}limit(e){return this.toCollection().limit(e)}each(e){return this.toCollection().each(e)}toArray(e){return this.toCollection().toArray(e)}toCollection(){return new this.db.Collection(new this.db.WhereClause(this))}orderBy(e){return new this.db.Collection(new this.db.WhereClause(this,q(e)?`[${e.join("+")}]`:e))}reverse(){return this.toCollection().reverse()}mapToClass(e){let{db:r,name:n}=this;this.schema.mappedClass=e,e.prototype instanceof Ea&&(e=class extends e{get db(){return r}table(){return n}});let i=new Set;for(let a=e.prototype;a;a=ct(a))Object.getOwnPropertyNames(a).forEach(o=>i.add(o));let s=a=>{if(!a)return a;let o=Object.create(e.prototype);for(let l in a)if(!i.has(l))try{o[l]=a[l]}catch{}return o};return this.schema.readHook&&this.hook.reading.unsubscribe(this.schema.readHook),this.schema.readHook=s,this.hook("reading",s),e}defineClass(){function e(r){ye(this,r)}return this.mapToClass(e)}add(e,r){let{auto:n,keyPath:i}=this.schema.primKey,s=e;return i&&n&&(s=Ft(i)(e)),this._trans("readwrite",a=>this.core.mutate({trans:a,type:"add",keys:r!=null?[r]:null,values:[s]})).then(a=>a.numFailures?P.reject(a.failures[0]):a.lastResult).then(a=>{if(i)try{he(e,i,a)}catch{}return a})}upsert(e,r){let{keyPath:n}=this.schema.primKey;return this._trans("readwrite",i=>this.core.get({trans:i,key:e}).then(s=>{let a=s??{};return Di(a,r),n&&he(a,n,e),this.core.mutate({trans:i,type:"put",values:[a],keys:[e],upsert:!0,updates:{keys:[e],changeSpecs:[r]}}).then(o=>o.numFailures?P.reject(o.failures[0]):!!s)}))}update(e,r){if(typeof e=="object"&&!q(e)){let n=Oe(e,this.schema.primKey.keyPath);return n===void 0?X(new M.InvalidArgument("Given object does not contain its primary key")):this.where(":id").equals(n).modify(r)}else return this.where(":id").equals(e).modify(r)}put(e,r){let{auto:n,keyPath:i}=this.schema.primKey,s=e;return i&&n&&(s=Ft(i)(e)),this._trans("readwrite",a=>this.core.mutate({trans:a,type:"put",values:[s],keys:r!=null?[r]:null})).then(a=>a.numFailures?P.reject(a.failures[0]):a.lastResult).then(a=>{if(i)try{he(e,i,a)}catch{}return a})}delete(e){return this._trans("readwrite",r=>this.core.mutate({trans:r,type:"delete",keys:[e]}).then(n=>Xt(this,[e],n)).then(n=>n.numFailures?P.reject(n.failures[0]):void 0))}clear(){return this._trans("readwrite",e=>this.core.mutate({trans:e,type:"deleteRange",range:Ti}).then(r=>Xt(this,null,r))).then(e=>e.numFailures?P.reject(e.failures[0]):void 0)}bulkGet(e){return this._trans("readonly",r=>this.core.getMany({keys:e,trans:r}).then(n=>n.map(i=>this.hook.reading.fire(i))))}bulkAdd(e,r,n){let i=Array.isArray(r)?r:void 0;n=n||(i?void 0:r);let s=n?n.allKeys:void 0;return this._trans("readwrite",a=>{let{auto:o,keyPath:l}=this.schema.primKey;if(l&&i)throw new M.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");if(i&&i.length!==e.length)throw new M.InvalidArgument("Arguments objects and keys must have the same length");let c=e.length,p=l&&o?e.map(Ft(l)):e;return this.core.mutate({trans:a,type:"add",keys:i,values:p,wantResults:s}).then(({numFailures:u,results:d,lastResult:m,failures:f})=>{let h=s?d:m;if(u===0)return h;throw new lt(`${this.name}.bulkAdd(): ${u} of ${c} operations failed`,f)})})}bulkPut(e,r,n){let i=Array.isArray(r)?r:void 0;n=n||(i?void 0:r);let s=n?n.allKeys:void 0;return this._trans("readwrite",a=>{let{auto:o,keyPath:l}=this.schema.primKey;if(l&&i)throw new M.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");if(i&&i.length!==e.length)throw new M.InvalidArgument("Arguments objects and keys must have the same length");let c=e.length,p=l&&o?e.map(Ft(l)):e;return this.core.mutate({trans:a,type:"put",keys:i,values:p,wantResults:s}).then(({numFailures:u,results:d,lastResult:m,failures:f})=>{let h=s?d:m;if(u===0)return h;throw new lt(`${this.name}.bulkPut(): ${u} of ${c} operations failed`,f)})})}bulkUpdate(e){let r=this.core,n=e.map(a=>a.key),i=e.map(a=>a.changes),s=[];return this._trans("readwrite",a=>r.getMany({trans:a,keys:n,cache:"clone"}).then(o=>{let l=[],c=[];e.forEach(({key:u,changes:d},m)=>{let f=o[m];if(f){for(let h of Object.keys(d)){let y=d[h];if(h===this.schema.primKey.keyPath){if(F(y,u)!==0)throw new M.Constraint("Cannot update primary key in bulkUpdate()")}else he(f,h,y)}s.push(m),l.push(u),c.push(f)}});let p=l.length;return r.mutate({trans:a,type:"put",keys:l,values:c,updates:{keys:n,changeSpecs:i}}).then(({numFailures:u,failures:d})=>{if(u===0)return p;for(let m of Object.keys(d)){let f=s[Number(m)];if(f!=null){let h=d[m];delete d[m],d[f]=h}}throw new lt(`${this.name}.bulkUpdate(): ${u} of ${p} operations failed`,d)})}))}bulkDelete(e){let r=e.length;return this._trans("readwrite",n=>this.core.mutate({trans:n,type:"delete",keys:e}).then(i=>Xt(this,e,i))).then(({numFailures:n,lastResult:i,failures:s})=>{if(n===0)return i;throw new lt(`${this.name}.bulkDelete(): ${n} of ${r} operations failed`,s)})}};Qr=class{_read(e,r){var n=this._ctx;return n.error?n.table._trans(null,X.bind(null,n.error)):n.table._trans("readonly",e).then(r)}_write(e){var r=this._ctx;return r.error?r.table._trans(null,X.bind(null,r.error)):r.table._trans("readwrite",e,"locked")}_addAlgorithm(e){var r=this._ctx;r.algorithm=tt(r.algorithm,e)}_iterate(e,r){return Ut(this._ctx,e,r,this._ctx.table.core)}clone(e){var r=Object.create(this.constructor.prototype),n=Object.create(this._ctx);return e&&ye(n,e),r._ctx=n,r}raw(){return this._ctx.valueMapper=null,this}each(e){var r=this._ctx;return this._read(n=>Ut(r,e,n,r.table.core))}count(e){return this._read(r=>{let n=this._ctx,i=n.table.core;if(it(n,!0))return i.count({trans:r,query:{index:Qt(n,i.schema),range:n.range}}).then(a=>Math.min(a,n.limit));var s=0;return Ut(n,()=>(++s,!1),r,i).then(()=>s)}).then(e)}sortBy(e,r){let n=e.split(".").reverse(),i=n[0],s=n.length-1;function a(c,p){return p?a(c[n[p]],p-1):c[i]}var o=this._ctx.dir==="next"?1:-1;function l(c,p){var u=a(c,s),d=a(p,s);return F(u,d)*o}return this.toArray(function(c){return c.slice().sort(l)}).then(r)}toArray(e){return this._read(r=>{var n=this._ctx;if(it(n,!0)&&n.limit>0){let{valueMapper:i}=n,s=Qt(n,n.table.core.schema);return n.table.core.query({trans:r,limit:n.limit,values:!0,direction:n.dir==="prev"?"prev":void 0,query:{index:s,range:n.range}}).then(({result:a})=>i?a.map(i):a)}else{let i=[];return Ut(n,s=>i.push(s),r,n.table.core).then(()=>i)}},e)}offset(e){var r=this._ctx;return e<=0?this:(r.offset+=e,it(r)?Lr(r,()=>{var n=e;return(i,s)=>n===0?!0:n===1?(--n,!1):(s(()=>{i.advance(n),n=0}),!1)}):Lr(r,()=>{var n=e;return()=>--n<0}),this)}limit(e){return this._ctx.limit=Math.min(this._ctx.limit,e),Lr(this._ctx,()=>{var r=e;return function(n,i,s){return--r<=0&&i(s),r>=0}},!0),this}until(e,r){return Kr(this._ctx,function(n,i,s){return e(n.value)?(i(s),r):!0}),this}first(e){return this.limit(1).toArray(function(r){return r[0]}).then(e)}last(e){return this.reverse().first(e)}filter(e){return Kr(this._ctx,function(r){return e(r.value)}),Ra(this._ctx,e),this}and(e){return this.filter(e)}or(e){return new this.db.WhereClause(this._ctx.table,e,this)}reverse(){return this._ctx.dir=this._ctx.dir==="prev"?"next":"prev",this._ondirectionchange&&this._ondirectionchange(this._ctx.dir),this}desc(){return this.reverse()}eachKey(e){var r=this._ctx;return r.keysOnly=!r.isMatch,this.each(function(n,i){e(i.key,i)})}eachUniqueKey(e){return this._ctx.unique="unique",this.eachKey(e)}eachPrimaryKey(e){var r=this._ctx;return r.keysOnly=!r.isMatch,this.each(function(n,i){e(i.primaryKey,i)})}keys(e){var r=this._ctx;r.keysOnly=!r.isMatch;var n=[];return this.each(function(i,s){n.push(s.key)}).then(function(){return n}).then(e)}primaryKeys(e){var r=this._ctx;if(it(r,!0)&&r.limit>0)return this._read(i=>{var s=Qt(r,r.table.core.schema);return r.table.core.query({trans:i,values:!1,limit:r.limit,direction:r.dir==="prev"?"prev":void 0,query:{index:s,range:r.range}})}).then(({result:i})=>i).then(e);r.keysOnly=!r.isMatch;var n=[];return this.each(function(i,s){n.push(s.primaryKey)}).then(function(){return n}).then(e)}uniqueKeys(e){return this._ctx.unique="unique",this.keys(e)}firstKey(e){return this.limit(1).keys(function(r){return r[0]}).then(e)}lastKey(e){return this.reverse().firstKey(e)}distinct(){var e=this._ctx,r=e.index&&e.table.schema.idxByName[e.index];if(!r||!r.multi)return this;var n={};return Kr(this._ctx,function(i){var s=i.primaryKey.toString(),a=be(n,s);return n[s]=!0,!a}),this}modify(e){var r=this._ctx;return this._write(n=>{var i;typeof e=="function"?i=e:i=h=>Di(h,e);let s=r.table.core,{outbound:a,extractKey:o}=s.schema.primaryKey,l=200,c=this.db._options.modifyChunkSize;c&&(typeof c=="object"?l=c[s.name]||c["*"]||200:l=c);let p=[],u=0,d=[],m=(h,y)=>{let{failures:g,numFailures:b}=y;u+=h-b;for(let S of ie(g))p.push(g[S])},f=e===ni;return this.clone().primaryKeys().then(h=>{let y=it(r)&&r.limit===1/0&&(typeof e!="function"||f)&&{index:r.index,range:r.range},g=b=>{let S=Math.min(l,h.length-b),v=h.slice(b,b+S);return(f?Promise.resolve([]):s.getMany({trans:n,keys:v,cache:"immutable"})).then(x=>{let w=[],E=[],T=a?[]:null,C=f?v:[];if(!f)for(let D=0;D<S;++D){let K=x[D],R={value:Qe(K),primKey:h[b+D]};i.call(R,R.value,R)!==!1&&(R.value==null?C.push(h[b+D]):!a&&F(o(K),o(R.value))!==0?(C.push(h[b+D]),w.push(R.value)):(E.push(R.value),a&&T.push(h[b+D])))}return Promise.resolve(w.length>0&&s.mutate({trans:n,type:"add",values:w}).then(D=>{for(let K in D.failures)C.splice(parseInt(K),1);m(w.length,D)})).then(()=>(E.length>0||y&&typeof e=="object")&&s.mutate({trans:n,type:"put",keys:T,values:E,criteria:y,changeSpec:typeof e!="function"&&e,isAdditionalChunk:b>0}).then(D=>m(E.length,D))).then(()=>(C.length>0||y&&f)&&s.mutate({trans:n,type:"delete",keys:C,criteria:y,isAdditionalChunk:b>0}).then(D=>Xt(r.table,C,D)).then(D=>m(C.length,D))).then(()=>h.length>b+S&&g(b+l))})};return g(0).then(()=>{if(p.length>0)throw new er("Error modifying one or more objects",p,u,d);return h.length})})})}delete(){var e=this._ctx,r=e.range;return it(e)&&!e.table.schema.yProps&&(e.isPrimKey||r.type===3)?this._write(n=>{let{primaryKey:i}=e.table.core.schema,s=r;return e.table.core.count({trans:n,query:{index:i,range:s}}).then(a=>e.table.core.mutate({trans:n,type:"deleteRange",range:s}).then(({failures:o,numFailures:l})=>{if(l)throw new er("Could not delete some values",Object.keys(o).map(c=>o[c]),a-l);return a-l}))}):this.modify(ni)}},ni=(t,e)=>e.value=null;sr=class{get Collection(){return this._ctx.table.db.Collection}between(e,r,n,i){n=n!==!1,i=i===!0;try{return this._cmp(e,r)>0||this._cmp(e,r)===0&&(n||i)&&!(n&&i)?st(this):new this.Collection(this,()=>Ke(e,r,!n,!i))}catch{return ge(this,Ie)}}equals(e){return e==null?ge(this,Ie):new this.Collection(this,()=>Ri(e))}above(e){return e==null?ge(this,Ie):new this.Collection(this,()=>Ke(e,void 0,!0))}aboveOrEqual(e){return e==null?ge(this,Ie):new this.Collection(this,()=>Ke(e,void 0,!1))}below(e){return e==null?ge(this,Ie):new this.Collection(this,()=>Ke(void 0,e,!1,!0))}belowOrEqual(e){return e==null?ge(this,Ie):new this.Collection(this,()=>Ke(void 0,e))}startsWith(e){return typeof e!="string"?ge(this,Ai):this.between(e,e+We,!0,!0)}startsWithIgnoreCase(e){return e===""?this.startsWith(e):$t(this,(r,n)=>r.indexOf(n[0])===0,[e],We)}equalsIgnoreCase(e){return $t(this,(r,n)=>r===n[0],[e],"")}anyOfIgnoreCase(){var e=Ce.apply(at,arguments);return e.length===0?st(this):$t(this,(r,n)=>n.indexOf(r)!==-1,e,"")}startsWithAnyOfIgnoreCase(){var e=Ce.apply(at,arguments);return e.length===0?st(this):$t(this,(r,n)=>n.some(i=>r.indexOf(i)===0),e,We)}anyOf(){let e=Ce.apply(at,arguments),r=this._cmp;try{e.sort(r)}catch{return ge(this,Ie)}if(e.length===0)return st(this);let n=new this.Collection(this,()=>Ke(e[0],e[e.length-1]));n._ondirectionchange=s=>{r=s==="next"?this._ascending:this._descending,e.sort(r)};let i=0;return n._addAlgorithm((s,a,o)=>{let l=s.key;for(;r(l,e[i])>0;)if(++i,i===e.length)return a(o),!1;return r(l,e[i])===0?!0:(a(()=>{s.continue(e[i])}),!1)}),n}notEqual(e){return this.inAnyRange([[Zr,e],[e,this.db._maxKey]],{includeLowers:!1,includeUppers:!1})}noneOf(){let e=Ce.apply(at,arguments);if(e.length===0)return new this.Collection(this);try{e.sort(this._ascending)}catch{return ge(this,Ie)}let r=e.reduce((n,i)=>n?n.concat([[n[n.length-1][1],i]]):[[Zr,i]],null);return r.push([e[e.length-1],this.db._maxKey]),this.inAnyRange(r,{includeLowers:!1,includeUppers:!1})}inAnyRange(e,r){let n=this._cmp,i=this._ascending,s=this._descending,a=this._min,o=this._max;if(e.length===0)return st(this);if(!e.every(v=>v[0]!==void 0&&v[1]!==void 0&&i(v[0],v[1])<=0))return ge(this,"First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower",M.InvalidArgument);let l=!r||r.includeLowers!==!1,c=r&&r.includeUppers===!0;function p(v,x){let w=0,E=v.length;for(;w<E;++w){let T=v[w];if(n(x[0],T[1])<0&&n(x[1],T[0])>0){T[0]=a(T[0],x[0]),T[1]=o(T[1],x[1]);break}}return w===E&&v.push(x),v}let u=i;function d(v,x){return u(v[0],x[0])}let m;try{m=e.reduce(p,[]),m.sort(d)}catch{return ge(this,Ie)}let f=0,h=c?v=>i(v,m[f][1])>0:v=>i(v,m[f][1])>=0,y=l?v=>s(v,m[f][0])>0:v=>s(v,m[f][0])>=0;function g(v){return!h(v)&&!y(v)}let b=h,S=new this.Collection(this,()=>Ke(m[0][0],m[m.length-1][1],!l,!c));return S._ondirectionchange=v=>{v==="next"?(b=h,u=i):(b=y,u=s),m.sort(d)},S._addAlgorithm((v,x,w)=>{for(var E=v.key;b(E);)if(++f,f===m.length)return x(w),!1;return g(E)?!0:(this._cmp(E,m[f][1])===0||this._cmp(E,m[f][0])===0||x(()=>{u===i?v.continue(m[f][0]):v.continue(m[f][1])}),!1)}),S}startsWithAnyOf(){let e=Ce.apply(at,arguments);return e.every(r=>typeof r=="string")?e.length===0?st(this):this.inAnyRange(e.map(r=>[r,r+We])):ge(this,"startsWithAnyOf() only works with strings")}};gr="storagemutated",Jr="x-storagemutated-1",je=Mt(null,gr),en=class{_lock(){return kt(!I.global),++this._reculock,this._reculock===1&&!I.global&&(I.lockOwnerFor=this),this}_unlock(){if(kt(!I.global),--this._reculock===0)for(I.global||(I.lockOwnerFor=null);this._blockedFuncs.length>0&&!this._locked();){var e=this._blockedFuncs.shift();try{et(e[1],e[0])}catch{}}return this}_locked(){return this._reculock&&I.lockOwnerFor!==this}create(e){if(!this.mode)return this;let r=this.db.idbdb,n=this.db._state.dbOpenError;if(kt(!this.idbtrans),!e&&!r)switch(n&&n.name){case"DatabaseClosedError":throw new M.DatabaseClosed(n);case"MissingAPIError":throw new M.MissingAPI(n.message,n);default:throw new M.OpenFailed(n)}if(!this.active)throw new M.TransactionInactive;return kt(this._completion._state===null),e=this.idbtrans=e||(this.db.core?this.db.core.transaction(this.storeNames,this.mode,{durability:this.chromeTransactionDurability}):r.transaction(this.storeNames,this.mode,{durability:this.chromeTransactionDurability})),e.onerror=W(i=>{Dt(i),this._reject(e.error)}),e.onabort=W(i=>{Dt(i),this.active&&this._reject(new M.Abort(e.error)),this.active=!1,this.on("abort").fire(i)}),e.oncomplete=W(()=>{this.active=!1,this._resolve(),"mutatedParts"in e&&je.storagemutated.fire(e.mutatedParts)}),this}_promise(e,r,n){if(e==="readwrite"&&this.mode!=="readwrite")return X(new M.ReadOnly("Transaction is readonly"));if(!this.active)return X(new M.TransactionInactive);if(this._locked())return new P((s,a)=>{this._blockedFuncs.push([()=>{this._promise(e,r,n).then(s,a)},I])});if(n)return Fe(()=>{var s=new P((a,o)=>{this._lock();let l=r(a,o,this);l&&l.then&&l.then(a,o)});return s.finally(()=>this._unlock()),s._lib=!0,s});var i=new P((s,a)=>{var o=r(s,a,this);o&&o.then&&o.then(s,a)});return i._lib=!0,i}_root(){return this.parent?this.parent._root():this}waitFor(e){var r=this._root();let n=P.resolve(e);if(r._waitingFor)r._waitingFor=r._waitingFor.then(()=>n);else{r._waitingFor=n,r._waitingQueue=[];var i=r.idbtrans.objectStore(r.storeNames[0]);(function a(){for(++r._spinCount;r._waitingQueue.length;)r._waitingQueue.shift()();r._waitingFor&&(i.get(-1/0).onsuccess=a)})()}var s=r._waitingFor;return new P((a,o)=>{n.then(l=>r._waitingQueue.push(W(a.bind(null,l))),l=>r._waitingQueue.push(W(o.bind(null,l)))).finally(()=>{r._waitingFor===s&&(r._waitingFor=null)})})}abort(){this.active&&(this.active=!1,this.idbtrans&&this.idbtrans.abort(),this._reject(new M.Abort))}table(e){let r=this._memoizedTables||(this._memoizedTables={});if(be(r,e))return r[e];let n=this.schema[e];if(!n)throw new M.NotFound("Table "+e+" not part of transaction");let i=new this.db.Table(e,n,this);return i.core=this.db.core.table(e),r[e]=i,i}};Rt=t=>{try{return t.only([[]]),Rt=()=>[[]],[[]]}catch{return Rt=()=>We,We}};Ua=0;sn=class{_createTableSchema(e,r,n){return yn(e,r,n)}_parseIndexSyntax(e){return Oi(e)}_parseStoresSpec(e,r){ie(e).forEach(n=>{if(e[n]!==null){let i=this._parseIndexSyntax(e[n]),s=i.shift();if(!s)throw new M.Schema("Invalid schema for table "+n+": "+e[n]);if(s.unique=!0,s.multi)throw new M.Schema("Primary key cannot be multiEntry*");i.forEach(o=>{if(o.auto)throw new M.Schema("Only primary key can be marked as autoIncrement (++)");if(!o.keyPath)throw new M.Schema("Index must have a name and cannot be an empty string")});let a=this._createTableSchema(n,s,i);r[n]=a}})}stores(e){let r=this.db;this._cfg.storesSource=this._cfg.storesSource?ye(this._cfg.storesSource,e):e;let n=r._versions,i={},s={};return n.forEach(a=>{ye(i,a._cfg.storesSource),s=a._cfg.dbschema={},a._parseStoresSpec(i,s)}),r._dbSchema=s,nn(r,[r._allTables,r,r.Transaction.prototype]),or(r,[r._allTables,r,r.Transaction.prototype,this._cfg.tables],ie(s),s),r._storeNames=ie(s),this}upgrade(e){return this._cfg.contentUpgrade=fn(this._cfg.contentUpgrade||V,e),this}};It=eo();ce=function(t,e){if(this)ye(this,arguments.length?{d:1,from:t,to:arguments.length>1?e:t}:{d:0});else{let r=new ce;return t&&"d"in t&&ye(r,t),r}};ut(ce.prototype,{add(t){return ur(this,t),this},addKey(t){return Ct(this,t,t),this},addKeys(t){return t.forEach(e=>Ct(this,e,e)),this},hasKey(t){let e=dr(this).next(t).value;return e&&F(e.from,t)<=0&&F(e.to,t)>=0},[Hr](){return dr(this)}});Xe={},Br={},Fr=!1;co={stack:"dbcore",name:"VirtualIndexMiddleware",level:1,create:lo};uo={stack:"dbcore",name:"HooksMiddleware",level:2,create:t=>({...t,table(e){let r=t.table(e),{primaryKey:n}=r.schema;return{...r,mutate(s){let a=I.trans,{deleting:o,creating:l,updating:c}=a.table(e).hook;switch(s.type){case"add":if(l.fire===V)break;return a._promise("readwrite",()=>p(s),!0);case"put":if(l.fire===V&&c.fire===V)break;return a._promise("readwrite",()=>p(s),!0);case"delete":if(o.fire===V)break;return a._promise("readwrite",()=>p(s),!0);case"deleteRange":if(o.fire===V)break;return a._promise("readwrite",()=>u(s),!0)}return r.mutate(s);function p(m){let f=I.trans,h=m.keys||En(n,m);if(!h)throw new Error("Keys missing");return m=m.type==="add"||m.type==="put"?{...m,keys:h}:{...m},m.type!=="delete"&&(m.values=[...m.values]),m.keys&&(m.keys=[...m.keys]),po(r,m,h).then(y=>{let g=h.map((b,S)=>{let v=y[S],x={onerror:null,onsuccess:null};if(m.type==="delete")o.fire.call(x,b,v,f);else if(m.type==="add"||v===void 0){let w=l.fire.call(x,b,m.values[S],f);b==null&&w!=null&&(b=w,m.keys[S]=b,n.outbound||he(m.values[S],n.keyPath,b))}else{let w=Pn(v,m.values[S]),E=c.fire.call(x,w,b,v,f);if(E){let T=m.values[S];Object.keys(E).forEach(C=>{be(T,C)?T[C]=E[C]:he(T,C,E[C])})}}return x});return r.mutate(m).then(({failures:b,results:S,numFailures:v,lastResult:x})=>{for(let w=0;w<h.length;++w){let E=S?S[w]:h[w],T=g[w];E==null?T.onerror&&T.onerror(b[w]):T.onsuccess&&T.onsuccess(m.type==="put"&&y[w]?m.values[w]:E)}return{failures:b,results:S,numFailures:v,lastResult:x}}).catch(b=>(g.forEach(S=>S.onerror&&S.onerror(b)),Promise.reject(b)))})}function u(m){return d(m.trans,m.range,1e4)}function d(m,f,h){return r.query({trans:m,values:!1,query:{index:n,range:f},limit:h}).then(({result:y})=>p({type:"delete",keys:y,trans:m}).then(g=>g.numFailures>0?Promise.reject(g.failures[0]):y.length<h?{failures:[],numFailures:0,lastResult:void 0}:d(m,{...f,lower:y[y.length-1],lowerOpen:!0},h)))}}}}})};fo={stack:"dbcore",level:-1,create:t=>({table:e=>{let r=t.table(e);return{...r,getMany:n=>{if(!n.cache)return r.getMany(n);let i=Ni(n.keys,n.trans._cache,n.cache==="clone");return i?P.resolve(i):r.getMany(n).then(s=>(n.trans._cache={keys:n.keys,values:n.cache==="clone"?Qe(s):s},s))},mutate:n=>(n.type!=="add"&&(n.trans._cache=null),r.mutate(n))}}})};mo={stack:"dbcore",level:0,name:"Observability",create:t=>{let e=t.schema.name,r=new ce(t.MIN_KEY,t.MAX_KEY);return{...t,transaction:(n,i,s)=>{if(I.subscr&&i!=="readonly")throw new M.ReadOnly(`Readwrite transaction in liveQuery context. Querier source: ${I.querier}`);return t.transaction(n,i,s)},table:n=>{let i=t.table(n),{schema:s}=i,{primaryKey:a,indexes:o}=s,{extractKey:l,outbound:c}=a,p=a.autoIncrement&&o.filter(f=>f.compound&&f.keyPath.includes(a.keyPath)),u={...i,mutate:f=>{let h=f.trans,y=f.mutatedParts||(f.mutatedParts={}),g=T=>{let C=`idb://${e}/${n}/${T}`;return y[C]||(y[C]=new ce)},b=g(""),S=g(":dels"),{type:v}=f,[x,w]=f.type==="deleteRange"?[f.range]:f.type==="delete"?[f.keys]:f.values.length<50?[En(a,f).filter(T=>T),f.values]:[],E=f.trans._cache;if(q(x)){b.addKeys(x);let T=v==="delete"||x.length===w.length?Ni(x,E):null;T||S.addKeys(x),(T||w)&&ho(g,s,T,w)}else if(x){let T={from:x.lower??t.MIN_KEY,to:x.upper??t.MAX_KEY};S.add(T),b.add(T)}else b.add(r),S.add(r),s.indexes.forEach(T=>g(T.name).add(r));return i.mutate(f).then(T=>(x&&(f.type==="add"||f.type==="put")&&(b.addKeys(T.results),p&&p.forEach(C=>{let D=f.values.map(R=>C.extractKey(R)),K=C.keyPath.findIndex(R=>R===a.keyPath);for(let R=0,U=T.results.length;R<U;++R)D[R][K]=T.results[R];g(C.name).addKeys(D)})),h.mutatedParts=br(h.mutatedParts||{},y),T))}},d=({query:{index:f,range:h}})=>[f,new ce(h.lower??t.MIN_KEY,h.upper??t.MAX_KEY)],m={get:f=>[a,new ce(f.key)],getMany:f=>[a,new ce().addKeys(f.keys)],count:d,query:d,openCursor:d};return ie(m).forEach(f=>{u[f]=function(h){let{subscr:y}=I,g=!!y,S=zi(I,i)&&Ki(f,h)?h.obsSet={}:y;if(g){let v=C=>{let D=`idb://${e}/${n}/${C}`;return S[D]||(S[D]=new ce)},x=v(""),w=v(":dels"),[E,T]=m[f](h);if(f==="query"&&E.isPrimaryKey&&!h.values?w.add(T):v(E.name||"").add(T),!E.isPrimaryKey)if(f==="count")w.add(r);else{let C=f==="query"&&c&&h.values&&i.query({...h,values:!1});return i[f].apply(this,arguments).then(D=>{if(f==="query"){if(c&&h.values)return C.then(({result:R})=>(x.addKeys(R),D));let K=h.values?D.result.map(l):D.result;h.values?x.addKeys(K):w.addKeys(K)}else if(f==="openCursor"){let K=D,R=h.values;return K&&Object.create(K,{key:{get(){return w.addKey(K.primaryKey),K.key}},primaryKey:{get(){let U=K.primaryKey;return w.addKey(U),U}},value:{get(){return R&&x.addKey(K.primaryKey),K.value}}})}return D})}}return i[f].apply(this,arguments)}}),u}}}};_o={stack:"dbcore",level:0,name:"Cache",create:t=>{let e=t.schema.name;return{...t,transaction:(n,i,s)=>{let a=t.transaction(n,i,s);if(i==="readwrite"){let o=new AbortController,{signal:l}=o,c=p=>()=>{if(o.abort(),i==="readwrite"){let u=new Set;for(let d of n){let m=Xe[`idb://${e}/${d}`];if(m){let f=t.table(d),h=m.optimisticOps.filter(y=>y.trans===a);if(a._explicit&&p&&a.mutatedParts)for(let y of Object.values(m.queries.query))for(let g of y.slice())kn(g.obsSet,a.mutatedParts)&&(Ve(y,g),g.subscribers.forEach(b=>u.add(b)));else if(h.length>0){m.optimisticOps=m.optimisticOps.filter(y=>y.trans!==a);for(let y of Object.values(m.queries.query))for(let g of y.slice())if(g.res!=null&&a.mutatedParts)if(p&&!g.dirty){let b=Object.isFrozen(g.res),S=ci(g.res,g.req,h,f,g,b);g.dirty?(Ve(y,g),g.subscribers.forEach(v=>u.add(v))):S!==g.res&&(g.res=S,g.promise=P.resolve({result:S}))}else g.dirty&&Ve(y,g),g.subscribers.forEach(b=>u.add(b))}}}u.forEach(d=>d())}};a.addEventListener("abort",c(!1),{signal:l}),a.addEventListener("error",c(!1),{signal:l}),a.addEventListener("complete",c(!0),{signal:l})}return a},table(n){let i=t.table(n),s=i.schema.primaryKey;return{...i,mutate(o){let l=I.trans;if(s.outbound||l.db._options.cache==="disabled"||l.explicit||l.idbtrans.mode!=="readwrite")return i.mutate(o);let c=Xe[`idb://${e}/${n}`];if(!c)return i.mutate(o);let p=i.mutate(o);return(o.type==="add"||o.type==="put")&&(o.values.length>=50||En(s,o).some(u=>u==null))?p.then(u=>{let d={...o,values:o.values.map((f,h)=>{if(u.failures[h])return f;let y=s.keyPath?.includes(".")?Qe(f):{...f};return he(y,s.keyPath,u.results[h]),y})},m=li(c,d,u);c.optimisticOps.push(m),queueMicrotask(()=>o.mutatedParts&&jt(o.mutatedParts))}):(c.optimisticOps.push(o),o.mutatedParts&&jt(o.mutatedParts),p.then(u=>{if(u.numFailures>0){Ve(c.optimisticOps,o);let d=li(c,o,u);d&&c.optimisticOps.push(d),o.mutatedParts&&jt(o.mutatedParts)}}),p.catch(()=>{Ve(c.optimisticOps,o),o.mutatedParts&&jt(o.mutatedParts)})),p},query(o){if(!zi(I,i)||!Ki("query",o))return i.query(o);let l=I.trans?.db._options.cache==="immutable",{requery:c,signal:p}=I,[u,d,m,f]=wo(e,n,"query",o);if(u&&d)u.obsSet=o.obsSet;else{let h=i.query(o).then(y=>{let g=y.result;if(u&&(u.res=g),l){for(let b=0,S=g.length;b<S;++b)Object.freeze(g[b]);Object.freeze(g)}return y}).catch(y=>(f&&u&&Ve(f,u),Promise.reject(y)));u={obsSet:o.obsSet,promise:h,subscribers:new Set,type:"query",req:o,dirty:!1},f?f.push(u):(f=[u],m||(m=Xe[`idb://${e}/${n}`]={queries:{query:{},count:{}},objs:new Map,optimisticOps:[],unsignaledParts:{}}),m.queries.query[o.query.index.name||""]=f)}return So(u,f,c,p),u.promise.then(h=>{let y=ci(h.result,o,m?.optimisticOps,i,u,l);return{result:l?y:Qe(y)}})}}}}}};Pe=class Jt{constructor(e,r){this._middlewares={},this.verno=0;let n=Jt.dependencies;this._options=r={addons:Jt.addons,autoOpen:!0,indexedDB:n.indexedDB,IDBKeyRange:n.IDBKeyRange,cache:"cloned",maxConnections:Pa,...r},this._deps={indexedDB:r.indexedDB,IDBKeyRange:r.IDBKeyRange};let{addons:i}=r;this._dbSchema={},this._versions=[],this._storeNames=[],this._allTables={},this.idbdb=null,this._novip=this;let s={dbOpenError:null,isBeingOpened:!1,onReadyBeingFired:null,openComplete:!1,dbReadyResolve:V,dbReadyPromise:null,cancelOpen:V,openCanceller:null,autoSchema:!0,PR1398_maxLoop:3,autoOpen:r.autoOpen};s.dbReadyPromise=new P(o=>{s.dbReadyResolve=o}),s.openCanceller=new P((o,l)=>{s.cancelOpen=l}),this._state=s,this.name=e,this.on=Mt(this,"populate","blocked","versionchange","close",{ready:[fn,V]}),this.once=(o,l)=>{let c=(...p)=>{this.on(o).unsubscribe(c),l.apply(this,p)};return this.on(o,c)},this.on.ready.subscribe=fi(this.on.ready.subscribe,o=>(l,c)=>{Jt.vip(()=>{let p=this._state;if(p.openComplete)p.dbOpenError||P.resolve().then(l),c&&o(l);else if(p.onReadyBeingFired)p.onReadyBeingFired.push(l),c&&o(l);else{o(l);let u=this;c||o(function d(){u.on.ready.unsubscribe(l),u.on.ready.unsubscribe(d)})}})}),this.Collection=Ia(this),this.Table=Da(this),this.Transaction=La(this),this.Version=Ja(this),this.WhereClause=Ka(this),this.on("versionchange",o=>{o.newVersion>0?console.warn(`Another connection wants to upgrade database '${this.name}'. Closing db now to resume the upgrade.`):console.warn(`Another connection wants to delete database '${this.name}'. Closing db now to resume the delete request.`),this.close({disableAutoOpen:!1})}),this.on("blocked",o=>{!o.newVersion||o.newVersion<o.oldVersion?console.warn(`Dexie.delete('${this.name}') was blocked`):console.warn(`Upgrade '${this.name}' blocked by other connection holding version ${o.oldVersion/10}`)}),this._maxKey=Rt(r.IDBKeyRange),this._createTransaction=(o,l,c,p)=>new this.Transaction(o,l,c,this._options.chromeTransactionDurability,p),this._fireOnBlocked=o=>{this.on("blocked").fire(o),It.toArray().filter(l=>l.name===this.name&&l!==this&&!l._state.vcFired).map(l=>l.on("versionchange").fire(o))},this.use(fo),this.use(_o),this.use(mo),this.use(co),this.use(uo);let a=new Proxy(this,{get:(o,l,c)=>{if(l==="_vip")return!0;if(l==="table")return u=>Vt(this.table(u),a);let p=Reflect.get(o,l,c);return p instanceof ir?Vt(p,a):l==="tables"?p.map(u=>Vt(u,a)):l==="_createTransaction"?function(){let u=p.apply(this,arguments);return Vt(u,a)}:p}});this.vip=a,i.forEach(o=>o(this))}version(e){if(isNaN(e)||e<.1)throw new M.Type("Given version is not a positive number");if(e=Math.round(e*10)/10,this.idbdb||this._state.isBeingOpened)throw new M.Schema("Cannot add version when database is open");this.verno=Math.max(this.verno,e);let r=this._versions;var n=r.filter(i=>i._cfg.version===e)[0];return n||(n=new this.Version(e),r.push(n),r.sort(Va),n.stores({}),this._state.autoSchema=!1,n)}_whenReady(e){return this.idbdb&&(this._state.openComplete||I.letThrough||this._vip)?e():new P((r,n)=>{if(this._state.openComplete)return n(new M.DatabaseClosed(this._state.dbOpenError));if(!this._state.isBeingOpened){if(!this._state.autoOpen){n(new M.DatabaseClosed);return}this.open().catch(V)}this._state.dbReadyPromise.then(r,n)}).then(e)}use({stack:e,create:r,level:n,name:i}){i&&this.unuse({stack:e,name:i});let s=this._middlewares[e]||(this._middlewares[e]=[]);return s.push({stack:e,create:r,level:n??10,name:i}),s.sort((a,o)=>a.level-o.level),this}unuse({stack:e,name:r,create:n}){return e&&this._middlewares[e]&&(this._middlewares[e]=this._middlewares[e].filter(i=>n?i.create!==n:r?i.name!==r:!1)),this}open(){return et(Me,()=>ao(this))}_close(){this.on.close.fire(new CustomEvent("close"));let e=this._state;if(It.remove(this),this.idbdb){try{this.idbdb.close()}catch{}this.idbdb=null}e.isBeingOpened||(e.dbReadyPromise=new P(r=>{e.dbReadyResolve=r}),e.openCanceller=new P((r,n)=>{e.cancelOpen=n}))}close({disableAutoOpen:e}={disableAutoOpen:!0}){let r=this._state;e?(r.isBeingOpened&&r.cancelOpen(new M.DatabaseClosed),this._close(),r.autoOpen=!1,r.dbOpenError=new M.DatabaseClosed):(this._close(),r.autoOpen=this._options.autoOpen||r.isBeingOpened,r.openComplete=!1,r.dbOpenError=null)}delete(e={disableAutoOpen:!0}){let r=arguments.length>0&&typeof arguments[0]!="object",n=this._state;return new P((i,s)=>{let a=()=>{this.close(e);var o=this._deps.indexedDB.deleteDatabase(this.name);o.onsuccess=W(()=>{no(this._deps,this.name),i()}),o.onerror=_e(s),o.onblocked=this._fireOnBlocked};if(r)throw new M.InvalidArgument("Invalid closeOptions argument to db.delete()");n.isBeingOpened?n.dbReadyPromise.then(a):a()})}backendDB(){return this.idbdb}isOpen(){return this.idbdb!==null}hasBeenClosed(){let e=this._state.dbOpenError;return e&&e.name==="DatabaseClosed"}hasFailed(){return this._state.dbOpenError!==null}dynamicallyOpened(){return this._state.autoSchema}get tables(){return ie(this._allTables).map(e=>this._allTables[e])}transaction(){let e=oo.apply(this,arguments);return this._transaction.apply(this,e)}_transaction(e,r,n){let i=I.trans;(!i||i.db!==this||e.indexOf("!")!==-1)&&(i=null);let s=e.indexOf("?")!==-1;e=e.replace("!","").replace("?","");let a,o;try{if(o=r.map(c=>{var p=c instanceof this.Table?c.name:c;if(typeof p!="string")throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");return p}),e=="r"||e===Nr)a=Nr;else if(e=="rw"||e==zr)a=zr;else throw new M.InvalidArgument("Invalid transaction mode: "+e);if(i){if(i.mode===Nr&&a===zr)if(s)i=null;else throw new M.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");i&&o.forEach(c=>{if(i&&i.storeNames.indexOf(c)===-1)if(s)i=null;else throw new M.SubTransaction("Table "+c+" not included in parent transaction.")}),s&&i&&!i.active&&(i=null)}}catch(c){return i?i._promise(null,(p,u)=>{u(c)}):X(c)}let l=Mi.bind(null,this,a,o,i,n);return i?i._promise(a,l,"lock"):I.trans?et(I.transless,()=>this._whenReady(l)):this._whenReady(l)}table(e){if(!be(this._allTables,e))throw new M.InvalidTable(`Table ${e} does not exist`);return this._allTables[e]}},Po=typeof Symbol<"u"&&"observable"in Symbol?Symbol.observable:"@@observable",ln=class{constructor(e){this._subscribe=e}subscribe(e,r,n){return this._subscribe(!e||typeof e=="function"?{next:e,error:r,complete:n}:e)}[Po](){return this}};try{pr={indexedDB:se.indexedDB||se.mozIndexedDB||se.webkitIndexedDB||se.msIndexedDB,IDBKeyRange:se.IDBKeyRange||se.webkitIDBKeyRange}}catch{pr={indexedDB:null,IDBKeyRange:null}}Ye=Pe;ut(Ye,{...mr,delete(t){return new Ye(t,{addons:[]}).delete()},exists(t){return new Ye(t,{addons:[]}).open().then(e=>(e.close(),!0)).catch("NoSuchDatabaseError",()=>!1)},getDatabaseNames(t){try{return to(Ye.dependencies).then(t)}catch{return X(new M.MissingAPI)}},defineClass(){function t(e){ye(this,e)}return t},ignoreTransaction(t){return I.trans?et(I.transless||Me,t):t()},vip:an,async:function(t){return function(){try{var e=on(t.apply(this,arguments));return!e||typeof e.then!="function"?P.resolve(e):e}catch(r){return X(r)}}},spawn:function(t,e,r){try{var n=on(t.apply(r,e||[]));return!n||typeof n.then!="function"?P.resolve(n):n}catch(i){return X(i)}},currentTransaction:{get:()=>I.trans||null},waitFor:function(t,e){let r=P.resolve(typeof t=="function"?Ye.ignoreTransaction(t):t).timeout(e||6e4);return I.trans?I.trans.waitFor(r):r},Promise:P,debug:{get:()=>Ae,set:t=>{wi(t)}},derive:dt,extend:ye,props:ut,override:fi,Events:Mt,on:je,liveQuery:Eo,extendObservabilitySet:br,getByKeyPath:Oe,setByKeyPath:he,delByKeyPath:Js,shallowClone:hi,deepClone:Qe,getObjectDiff:Pn,cmp:F,asap:mi,minKey:Zr,addons:[],connections:{get:It.toArray},errnames:pn,dependencies:pr,cache:Xe,semVer:Qn,version:Qn.split(".").map(t=>parseInt(t)).reduce((t,e,r)=>t+e/Math.pow(10,r*2))});Ye.maxKey=Rt(Ye.dependencies.IDBKeyRange);typeof dispatchEvent<"u"&&typeof addEventListener<"u"&&(je(gr,t=>{if(!Le){let e;e=new CustomEvent(Jr,{detail:t}),Le=!0,dispatchEvent(e),Le=!1}}),addEventListener(Jr,({detail:t})=>{Le||An(t)}));Le=!1,cn=()=>{};typeof BroadcastChannel<"u"&&(cn=()=>{ot=new BroadcastChannel(Jr),ot.onmessage=t=>t.data&&An(t.data)},cn(),typeof ot.unref=="function"&&ot.unref(),je(gr,t=>{Le||ot.postMessage(t)}));typeof addEventListener<"u"&&(addEventListener("pagehide",t=>{if(!Pe.disableBfCache&&t.persisted){Ae&&console.debug("Dexie: handling persisted pagehide"),ot?.close();for(let e of It.toArray())e.close({disableAutoOpen:!1})}}),addEventListener("pageshow",t=>{!Pe.disableBfCache&&t.persisted&&(Ae&&console.debug("Dexie: handling persisted pageshow"),cn(),An({all:new ce(-1/0,[[]])}))}));P.rejectionMapper=oa;wi(Ae)});function Bi(t){Li=t}var Li,Dn,B,Ne=le(()=>{"use strict";Tn();Dn=class extends Pe{constructor(e){super("listening-stats"),this.version(4).stores({playEvents:"++id, startedAt, trackUri, artistUri, type"}),this.version(5).stores({playEvents:"++id, startedAt, trackUri, artistUri, type",artists:"uri, updatedAt"}),this.on("versionchange",r=>{if(r.newVersion!==null)return this.close({disableAutoOpen:!0}),e?.(),Li?.(),!1})}},B=new Dn});function ji(){let t=new Date,e=new Date(t.getFullYear(),t.getMonth(),t.getDate(),0,0,0,0),r=new Date(t.getFullYear(),t.getMonth(),t.getDate()+1,0,0,0,0);return{start:e.getTime(),end:r.getTime()}}function Ro(){let t=new Date,r=(t.getDay()+6)%7,n=new Date(t.getFullYear(),t.getMonth(),t.getDate()-r,0,0,0,0),i=new Date(n.getFullYear(),n.getMonth(),n.getDate()+7,0,0,0,0);return{start:n.getTime(),end:i.getTime()}}function Io(){let t=new Date,e=new Date(t.getFullYear(),t.getMonth(),1,0,0,0,0),r=new Date(t.getFullYear(),t.getMonth()+1,1,0,0,0,0);return{start:e.getTime(),end:r.getTime()}}function Co(){let t=new Date,e=new Date(t.getFullYear(),t.getMonth()-6,1,0,0,0,0),r=new Date(t.getFullYear(),t.getMonth()+1,1,0,0,0,0);return{start:e.getTime(),end:r.getTime()}}function Oo(){let t=Date.now();return{start:t-28*864e5,end:t}}function Mo(){let t=Date.now();return{start:t-180*864e5,end:t}}function Hi(){return{start:0,end:Number.MAX_SAFE_INTEGER}}function Gi(t){let e=rt.findIndex(r=>r.id===t);return e===-1||e===rt.length-1?null:rt[e+1]}function Kt(t){if(t.id==="all-time"||t.id==="sfm-all-time"||t.id==="overall")return null;let{start:e,end:r}=t.getBoundaries(),n=r-e,i=e-n;return i<0?null:{start:i,end:e}}var rt,nt,Vi,Lt=le(()=>{"use strict";rt=[{id:"today",label:"Today",getBoundaries:ji},{id:"this-week",label:"This Week",getBoundaries:Ro},{id:"this-month",label:"This Month",getBoundaries:Io},{id:"last-6-months",label:"Last 6 Months",getBoundaries:Co},{id:"all-time",label:"All Time",getBoundaries:Hi}],nt=[{id:"sfm-weeks",label:"Last 4 Weeks",getBoundaries:Oo},{id:"sfm-months",label:"Last 6 Months",getBoundaries:Mo},{id:"sfm-all-time",label:"All Time",getBoundaries:Hi}],Vi=[{id:"sfm-today",label:"Today",getBoundaries:ji},...nt]});var L,ue=le(()=>{"use strict";L={PLAY_THRESHOLD:"listening-stats:playThreshold",PLAY_THRESHOLD_MODE:"listening-stats:playThresholdMode",PLAY_THRESHOLD_PERCENT:"listening-stats:playThresholdPercent",TRACKING_PAUSED:"listening-stats:tracking-paused",SKIP_REPEATS:"listening-stats:skip-repeats",LAST_UPDATE:"listening-stats:lastUpdate",LOGGING:"listening-stats:logging",TRACKING_HEALTH:"listening-stats:tracking-health",LAST_WRITE:"listening-stats:lastWrite",ACTIVE_PROVIDER:"listening-stats:active-provider",PREFERENCES:"listening-stats:preferences",MIGRATION_PENDING:"listening-stats:migration-pending",STATSFM_CONFIG:"listening-stats:statsfm",PROVIDER_WIZARD_SEEN:"listening-stats:provider-wizard-seen",PROVIDER_PERIODS:"listening-stats:provider-periods",STATSFM_HEALTH:"listening-stats:statsfm-health",DISMISSED_BANNER_VERSION:"listening-stats:dismissed-banner-version",LASTFM_API_KEY:"listening-stats:lastfm-api-key",LASTFM_CONFIG:"listening-stats:lastfm-provider",WORLD_CHARTS_SCOPE:"listening-stats:world-charts-scope",WORLD_CHARTS_WINDOW:"listening-stats:world-charts-window",TOUR_SEEN_VERSION:"listening-stats:tour-seen-version",DISMISSED_REMOTE_ANNOUNCEMENT_ID:"listening-stats:dismissed-remote-announcement-id",UPDATE_PROMPT_SNOOZE_UNTIL:"listening-stats:update-prompt-snooze-until",RECAP_DISMISSED_MONTH:"listening-stats:recap-dismissed-month",RANK_MODE:"listening-stats:rank-mode",PLAYLIST_CONFIG:"listening-stats:playlist-config",PLAYLIST_STATE:"listening-stats:playlist-state"}});var re,yt=le(()=>{"use strict";re={PLAY_RECORDED:"listening-stats:play-recorded",SKIP_RECORDED:"listening-stats:skip-recorded",HEALTH_CHANGED:"listening-stats:health-changed",TRACKING_PAUSED:"listening-stats:tracking-paused",TRACKING_RESUMED:"listening-stats:tracking-resumed",PROVIDER_CHANGED:"listening-stats:provider-changed",STATSFM_CONNECTED:"listening-stats:statsfm-connected",STATSFM_DISCONNECTED:"listening-stats:statsfm-disconnected",STATSFM_HEALTH_CHANGED:"listening-stats:statsfm-health-changed",STATSFM_PROFILE_REFRESHED:"listening-stats:statsfm-profile-refreshed",PREFS_CHANGED:"listening-stats:prefs-changed",RANK_MODE_CHANGED:"listening-stats:rank-mode-changed",DASHBOARD_PERIOD_CHANGED:"listening-stats:dashboard-period-changed",OPEN_RECAP:"listening-stats:open-recap"}});var gl,Rr,xs=le(()=>{"use strict";({Component:gl}=Spicetify.React),Rr=class extends gl{constructor(){super(...arguments);this.state={error:null,componentStack:"",copied:!1};this.handleCopy=async()=>{let r=this.buildReport();try{await navigator.clipboard.writeText(r),this.setState({copied:!0})}catch{try{let n=document.createElement("textarea");n.value=r,n.style.position="fixed",n.style.left="-9999px",document.body.appendChild(n),n.select(),document.execCommand("copy"),document.body.removeChild(n),this.setState({copied:!0})}catch{}}};this.handleRetry=()=>{this.setState({error:null,componentStack:"",copied:!1})}}static getDerivedStateFromError(r){return{error:r,copied:!1}}componentDidCatch(r,n){this.setState({componentStack:n?.componentStack??""}),console.error("[listening-stats] Render error:",r,n?.componentStack??"")}buildReport(){let{error:r,componentStack:n}=this.state;return["Listening Stats error report",`Version: ${this.props.appVersion??"unknown"}`,`Spotify UA: ${typeof navigator<"u"?navigator.userAgent:"unknown"}`,`Error: ${r?.message??"unknown"}`,r?.stack?`Stack:
${r.stack}`:"",n?`Component stack:
${n}`:""].filter(Boolean).join(`
`)}render(){let{error:r,copied:n}=this.state;return r?this.props.silent?null:Spicetify.React.createElement("div",{role:"alert",style:{margin:24,padding:20,borderRadius:8,background:"var(--spice-card, rgba(255,255,255,0.06))",color:"var(--spice-text, #fff)",maxWidth:640}},Spicetify.React.createElement("h2",{style:{marginTop:0,fontSize:18}},"Listening Stats hit an error"),Spicetify.React.createElement("p",{style:{fontSize:14,opacity:.85}},"The rest of Spotify is unaffected. Copy the details below and attach them to a GitHub issue so this can be fixed."),Spicetify.React.createElement("pre",{style:{fontSize:12,whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:180,overflow:"auto",padding:10,borderRadius:6,background:"rgba(0,0,0,0.35)"}},r.message),Spicetify.React.createElement("div",{style:{display:"flex",gap:8}},Spicetify.React.createElement("button",{type:"button",className:"btn-primary",onClick:this.handleCopy},n?"Copied":"Copy error details"),Spicetify.React.createElement("button",{type:"button",className:"btn-secondary",onClick:this.handleRetry},"Try again"))):this.props.children??null}}});function vl(t){let e=t.match(/^spotify:track:(.+)$/i);return e?e[1]:null}function xl(t){return{"sfm-today":"today","sfm-weeks":"weeks","sfm-months":"months","sfm-all-time":"lifetime"}[t]??null}async function ws(t,e,r){let n=vl(e);if(!n||!t.trim())return null;for(let i=0;i<bl;i+=$n){let s=new URL(`${yl}/users/${encodeURIComponent(t.trim())}/top/tracks`);s.searchParams.set("range",r),s.searchParams.set("limit",String($n)),s.searchParams.set("offset",String(i));let a;try{a=await fetch(s.toString(),{headers:{Accept:"application/json"}})}catch{return null}if(!a.ok)return null;let o=await a.json(),l=o.items??o.item??[];if(!Array.isArray(l)||l.length===0)return null;for(let c of l)if(c.track?.externalIds?.spotify?.[0]===n)return c.streams;if(l.length<$n)return null}return null}async function Ss(t,e){return ws(t,e,"lifetime")}async function ks(t,e,r){let n=xl(r);return n?ws(t,e,n):null}function _s(){try{let t=localStorage.getItem(L.STATSFM_CONFIG);if(!t)return null;let e=JSON.parse(t);return typeof e.username=="string"?e.username:null}catch{return null}}var yl,$n,bl,Ps=le(()=>{"use strict";ue();yl="https://api.stats.fm/api/v1",$n=100,bl=4e3});var jn,Hn,Es=le(()=>{"use strict";ue();jn=class{constructor(){this.providers=new Map;this.activeId=null}register(e){let r=e.getProviderInfo();this.providers.set(r.id,e)}getActive(){return this.activeId?this.providers.get(this.activeId)??null:null}getActiveId(){return this.activeId}setActive(e){if(!this.providers.has(e))throw new Error(`Provider "${e}" not registered`);this.activeId=e,localStorage.setItem(L.ACTIVE_PROVIDER,e)}restoreActive(){let e=localStorage.getItem(L.ACTIVE_PROVIDER);e&&this.providers.has(e)&&(this.activeId=e)}_resetForTesting(){this.providers.clear(),this.activeId=null}getAll(){return Array.from(this.providers.values()).map(e=>e.getProviderInfo())}},Hn=new jn});function wl(){try{let t=localStorage.getItem(L.PROVIDER_PERIODS);if(!t)return{};let e=JSON.parse(t);return typeof e=="object"&&e!==null&&!Array.isArray(e)?e:{}}catch{return{}}}function As(t,e){let r=wl()[t];if(r){let n=e.find(i=>i.id===r);if(n)return n}return e[0]}var Ts=le(()=>{"use strict";ue()});function Ds(){return{...we,hiddenSections:[...we.hiddenSections],sectionOrder:[...we.sectionOrder],columnOrder:[...we.columnOrder],overviewOrder:{local:[...we.overviewOrder.local],statsfm:[...we.overviewOrder.statsfm]}}}function Ir(t,e){let r=new Set(e),n=[],i=new Set;if(Array.isArray(t))for(let s of t)typeof s=="string"&&r.has(s)&&!i.has(s)&&(i.add(s),n.push(s));for(let s of e)i.has(s)||n.push(s);return n}function _l(t){let e=[],r=new Set;if(!Array.isArray(t))return e;for(let n of t)typeof n=="string"&&(r.has(n)||(r.add(n),e.push(n)));return e}function Vn(){try{let t=localStorage.getItem(L.PREFERENCES);if(t){let e=JSON.parse(t),r=Ds();return{...r,...e,hiddenSections:_l(e.hiddenSections??r.hiddenSections),sectionOrder:Ir(e.sectionOrder,Rs),columnOrder:Ir(e.columnOrder,Is),overviewOrder:{local:Ir(e.overviewOrder?.local,Cr.local),statsfm:Ir(e.overviewOrder?.statsfm,Cr.statsfm)},activityTab:Sl.has(e.activityTab)?e.activityTab:we.activityTab,playCountVariant:kl.has(e.playCountVariant)?e.playCountVariant:we.playCountVariant,playCountShowPeriodStreams:typeof e.playCountShowPeriodStreams=="boolean"?e.playCountShowPeriodStreams:we.playCountShowPeriodStreams,receiveBetaUpdates:typeof e.receiveBetaUpdates=="boolean"?e.receiveBetaUpdates:we.receiveBetaUpdates,showAnnouncementBanner:typeof e.showAnnouncementBanner=="boolean"?e.showAnnouncementBanner:we.showAnnouncementBanner,announcementBannerHiddenForDismissKey:typeof e.announcementBannerHiddenForDismissKey=="string"?e.announcementBannerHiddenForDismissKey:we.announcementBannerHiddenForDismissKey,heatmapShrink:typeof e.heatmapShrink=="boolean"?e.heatmapShrink:we.heatmapShrink}}}catch{}return Ds()}var Rs,Is,Cr,Sl,kl,we,Cs=le(()=>{"use strict";ue();Rs=["overview","top-genres","top-lists","activity","consistency","recently-played"],Is=["top-tracks","top-artists","top-albums"],Cr={local:["tracks","unique-artists","streak","new-artists","peak-hour","skip-rate","est-payout"],statsfm:["unique-artists","new-artists","top-genre","est-payout"]},Sl=new Set(["hour","weekday","day"]),kl=new Set(["pill","bubble","minimal","off"]),we={use24HourTime:!1,itemsPerSection:5,hiddenSections:[],sectionOrder:[...Rs],columnOrder:[...Is],overviewOrder:{local:[...Cr.local],statsfm:[...Cr.statsfm]},activityTab:"hour",activeGenre:null,playCountVariant:"pill",playCountShowPeriodStreams:!0,activePage:"dashboard",receiveBetaUpdates:!1,showAnnouncementBanner:!0,announcementBannerHiddenForDismissKey:"",showShareCaption:!0,heatmapShrink:!0}});function Pl(t){return new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"})}function Os({count:t,variant:e,firstPlayedAt:r,periodStreams:n,periodLabel:i,showFirstListen:s=!1}){if(e==="off"||t<1&&!s)return null;let a="No plays in your tracked history for this track yet (skips excluded). Count updates after a qualifying listen.";if(s&&t<1){let u=(d,m,f)=>Se.createElement("div",{className:d,title:f},m);return e==="bubble"?u("play-count-bubble",[Se.createElement("div",{key:"i",className:"play-count-bubble-icon"},"\u25B6"),Se.createElement("span",{key:"b",className:"play-count-badge play-count-badge--new"},"NEW")],a):e==="minimal"?u("play-count-minimal","New",a):u("play-count-pill play-count-pill--first",[Se.createElement("span",{key:"d",className:"play-count-dot"}),Se.createElement("span",{key:"t"},"New play")],a)}let l=`Played ${t} ${t===1?"time":"times"}`;r!=null&&(l+=` \xB7 first on ${Pl(r)}`),n!=null&&i&&(l+=` \xB7 ${n} in ${i} (stats.fm top tracks)`);let c=t===1?"1 play":`${t} plays`,p=n!=null&&i?Se.createElement("span",{style:{marginLeft:6,fontSize:"0.85em",fontWeight:500,color:"rgba(var(--spice-rgb-text), 0.55)"}},`\xB7 ${n} ${i}`):null;if(e==="bubble")return Se.createElement("div",{className:"play-count-bubble",title:l},Se.createElement("div",{className:"play-count-bubble-icon"},"\u25B6"),Se.createElement("span",{className:"play-count-badge"},t),n!=null&&i?Se.createElement("span",{style:{marginLeft:4,fontSize:10,color:"rgba(var(--spice-rgb-text), 0.55)"}},`${n}`):null);if(e==="minimal"){let u=n!=null&&i?` (${n} ${i})`:"";return Se.createElement("div",{className:"play-count-minimal",title:l},`\xD7${t}${u}`)}return Se.createElement("div",{className:"play-count-pill",title:l},Se.createElement("span",{className:"play-count-dot"}),c,p)}var Se,Ms=le(()=>{"use strict";({React:Se}=Spicetify)});function Tl(){let[t,e]=Gn(null),[r,n]=Gn(()=>Spicetify.Player.data?.item?.uri??null),[i,s]=Gn(0),a=Al(0),o=El(async l=>{let c=++a.current,p=u=>{a.current===c&&e(u)};try{let u=Vn(),d=await B.playEvents.where("trackUri").equals(l).filter(h=>h.type!=="skip").sortBy("startedAt"),m=d.length,f=d[0]?.startedAt??null;if(Hn.getActiveId()==="statsfm"){let h=_s();if(h){let y=await Ss(h,l),g=null,b=null;if(u.playCountShowPeriodStreams){let x=Hn.getActive()?.getSupportedPeriods()??nt;if(x.length>0){let w=As("statsfm",x);b=w.label,g=await ks(h,l,w.id)}}let S=y??m,v=y!=null?null:f;p({count:S,firstPlayedAt:v,periodStreams:g,periodLabel:b});return}}p({count:m,firstPlayedAt:f,periodStreams:void 0,periodLabel:void 0})}catch{p(null)}},[]);return wt(()=>{r?o(r):(a.current++,e(null))},[r,o,i]),wt(()=>{let l=()=>{let c=Spicetify.Player.data?.item?.uri??null;n(c)};return Spicetify.Player.addEventListener("songchange",l),()=>Spicetify.Player.removeEventListener("songchange",l)},[]),wt(()=>{let l=()=>{r&&o(r)};return window.addEventListener(re.PLAY_RECORDED,l),()=>window.removeEventListener(re.PLAY_RECORDED,l)},[r,o]),wt(()=>{let l=()=>s(c=>c+1);return window.addEventListener(re.PROVIDER_CHANGED,l),()=>window.removeEventListener(re.PROVIDER_CHANGED,l)},[]),wt(()=>{let l=()=>s(c=>c+1);return window.addEventListener(re.DASHBOARD_PERIOD_CHANGED,l),()=>window.removeEventListener(re.DASHBOARD_PERIOD_CHANGED,l)},[]),wt(()=>{let l=()=>s(c=>c+1);return window.addEventListener(re.PREFS_CHANGED,l),()=>window.removeEventListener(re.PREFS_CHANGED,l)},[]),t}function Ns(){let t=Tl(),e=Vn();if(e.playCountVariant==="off"||!t)return null;let r=e.playCountShowPeriodStreams&&t.count<1;return t.count<1&&!r?null:Yn.createElement("div",{className:"play-count-widget-anchor"},Yn.createElement(Os,{count:t.count,variant:e.playCountVariant,firstPlayedAt:t.firstPlayedAt,periodStreams:t.periodStreams??void 0,periodLabel:t.periodLabel??void 0,showFirstListen:r}))}var Yn,Gn,wt,El,Al,zs=le(()=>{"use strict";Ps();yt();Lt();Es();Ts();Ne();Cs();Ms();({React:Yn}=Spicetify),{useState:Gn,useEffect:wt,useCallback:El,useRef:Al}=Yn});var Ls,Ks=le(()=>{Ls=`:root {
	--font-size-sm: 12px;
	--font-size-md: 14px;
	--font-size-lg: 20px;
	--font-size-2xl: 28px;

	--line-height-display: 1.2;
	--line-height-heading: 1.2;
	--line-height-label: 1.4;
	--line-height-body: 1.5;

	--space-xs: 4px;
	--space-sm: 8px;
	--space-md: 16px;
	--space-lg: 24px;
	--space-xl: 32px;
	--space-2xl: 48px;

	--rank-gold: #ffd700;
	--rank-silver: #c0c0c0;
	--rank-bronze: #cd7f32;
}

/* Hide Spicetify topbar only when our page is active */
body:has(.stats-page) .main-topBar-container {
	display: none;
}

/* Page shell: flex column fills custom-app height; scroll is on inner so sticky works. */
.stats-page {
	box-sizing: border-box;
	width: 100%;
	max-width: 100%;
	height: 100%;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.stats-page-scroll {
	flex: 1 1 auto;
	min-height: 0;
	overflow-x: clip;
	overflow-y: auto;
	/* No top padding: sticky header must sit flush with scrollport top */
	padding: 0 var(--space-xl, 32px) var(--space-lg, 24px);
	box-sizing: border-box;
}

.stats-page-sticky {
	position: sticky;
	top: 0;
	z-index: 100;
	margin: 0 calc(-1 * var(--space-xl, 32px)) var(--space-md, 16px);
	padding: var(--space-lg, 24px) var(--space-xl, 32px) var(--space-md, 16px);
	/* Frosted glass: translucent theme color + blur keeps scrolled content
	   readable underneath while transparency themes keep their background
	   visible instead of getting an opaque slab. */
	background: rgba(var(--spice-rgb-main, 18, 18, 18), 0.72);
	-webkit-backdrop-filter: blur(16px) saturate(1.4);
	backdrop-filter: blur(16px) saturate(1.4);
	border-bottom: 1px solid rgba(var(--spice-rgb-text, 255 255 255), 0.06);
	box-sizing: border-box;
}

/* Without backdrop-filter a translucent bar would let text scroll straight
   through the header - fall back to the old solid bar. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	.stats-page-sticky {
		background: var(--spice-main);
		background-color: rgb(var(--spice-rgb-main));
	}
}

/* Filter Pill */
.filter-pill {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	background: rgba(var(--spice-rgb-button), 0.08);
	border: 1px solid rgba(var(--spice-rgb-button), 0.3);
	border-radius: 999px;
	font-size: 13px;
	margin-bottom: var(--space-sm, 8px);
}

.filter-pill-icon {
	display: inline-flex;
	width: 13px;
	height: 13px;
	color: var(--spice-button);
}

.filter-pill-genre {
	color: var(--spice-button);
}

.filter-pill-close {
	appearance: none;
	border: 0;
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	color: rgba(var(--spice-rgb-text), 0.7);
	width: 18px;
	height: 18px;
	border-radius: 50%;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	line-height: 1;
	padding: 0;
}

.filter-pill-close:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.18);
	color: var(--spice-text);
}

/* Announcement Banner */
.announcement-banner {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 16px;
	margin-bottom: var(--space-md, 16px);
	background: rgba(var(--spice-rgb-button), 0.08);
	border: 1px solid rgba(var(--spice-rgb-button), 0.25);
	border-radius: 8px;
}

.announcement-banner-icon {
	color: var(--spice-button);
	width: 20px;
	height: 20px;
	flex-shrink: 0;
}

.announcement-banner-text {
	font-size: 13px;
	color: var(--spice-text);
	flex: 1;
}

.announcement-banner-link {
	color: var(--spice-button);
	font-size: 12px;
	font-weight: 600;
	text-decoration: none;
	white-space: nowrap;
}

button.announcement-banner-link-btn {
	appearance: none;
	margin: 0;
	padding: 0;
	border: none;
	background: transparent;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	color: var(--spice-button);
	cursor: pointer;
	text-decoration: underline;
	text-underline-offset: 2px;
	white-space: nowrap;
}

button.announcement-banner-link-btn:hover {
	color: var(--spice-button-active, var(--spice-button));
}

.announcement-banner-dismiss {
	appearance: none;
	border: 0;
	background: transparent;
	color: rgba(var(--spice-rgb-text), 0.5);
	cursor: pointer;
	padding: 4px;
	font-size: 16px;
	line-height: 1;
}

/* Header */
.stats-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-lg, 24px);
	padding: 8px 0 12px;
	flex-wrap: wrap;
}

.stats-header-title {
	margin: 0;
	font-size: 32px;
	font-weight: 800;
	letter-spacing: -0.02em;
	line-height: 1;
	display: flex;
	align-items: center;
	color: var(--spice-text);
}

.stats-header-left {
	display: flex;
	align-items: center;
	gap: 14px;
	min-width: 0;
	flex-wrap: wrap;
	flex: 1 1 420px;
	row-gap: 6px;
}

.header-provider-pill {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
	border-radius: 999px;
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.7);
}

.header-provider-name {
	font-size: 12px;
	font-weight: 400;
	color: rgba(var(--spice-rgb-text), 0.7);
	line-height: 1.2;
}

.stats-header-right {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	flex: 1 1 340px;
	justify-content: flex-end;
	flex-wrap: wrap;
	row-gap: 8px;
}

.stats-header-icon-btn {
	appearance: none;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	background: transparent;
	color: var(--spice-text);
	width: 36px;
	height: 36px;
	border-radius: 999px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	transition:
		background 0.15s,
		border-color 0.15s;
	padding: 0;
}

.stats-header-icon-btn:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.stats-header-icon-btn svg {
	width: 20px;
	height: 20px;
}

.loading-status-banner {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin: 0 0 12px;
	padding: 8px 12px;
	border-radius: 10px;
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.78);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.loading-status-dot {
	width: 8px;
	height: 8px;
	border-radius: 999px;
	background: var(--spice-button);
	box-shadow: 0 0 0 0 rgba(var(--spice-rgb-button), 0.8);
	animation: loading-status-pulse 1.4s ease-out infinite;
}

@keyframes loading-status-pulse {
	0% {
		box-shadow: 0 0 0 0 rgba(var(--spice-rgb-button), 0.6);
	}
	100% {
		box-shadow: 0 0 0 8px rgba(var(--spice-rgb-button), 0);
	}
}

/* Period tabs */
.period-tabs {
	display: flex;
	flex-direction: row;
	gap: var(--space-xs, 4px);
	min-height: 36px;
	align-items: center;
	flex-wrap: wrap;
}

.period-tab {
	cursor: pointer;
	padding: 5px 12px;
	color: rgba(var(--spice-rgb-text), 0.6);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
	border-radius: 999px;
	font-size: var(--font-size-sm, 12px);
	font-weight: 500;
	transition:
		background 0.15s,
		color 0.15s;
}

.period-tab:hover {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.period-tab.active {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	font-weight: 600;
}

.overview-card {
	background: var(--spice-card);
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12);
	border-radius: 8px;
	padding: 12px 14px;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 6px;
	transition:
		background 0.15s,
		border-color 0.15s;
	cursor: default;
}

.overview-card:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
}

.overview-card-row {
	display: flex;
	align-items: baseline;
	gap: 5px;
}

.overview-card-sub {
	font-size: 11px;
	color: rgba(var(--spice-rgb-text), 0.5);
}

.overview-section {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	grid-template-rows: auto auto;
	gap: var(--space-md, 16px);
	align-items: stretch;
}

.overview-section--compact {
	grid-template-rows: auto;
}
.overview-hero-cell {
	grid-column: 1 / span 3;
	grid-row: 1;
}
.overview-right-block {
	grid-column: 4 / span 2;
	grid-row: 1;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-md, 16px);
}
.overview-bottom-row {
	grid-column: 1 / span 5;
	grid-row: 2;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--space-md, 16px);
}

/* Top Genres */
.top-genres-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.top-genres-row {
	display: grid;
	grid-template-columns: 140px 1fr 44px;
	gap: 12px;
	align-items: center;
}

.top-genres-name {
	appearance: none;
	border: 0;
	background: transparent;
	color: rgba(var(--spice-rgb-text), 0.85);
	text-align: left;
	cursor: pointer;
	font-size: 13px;
	padding: 0;
	font-weight: 500;
	font-family: inherit;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.top-genres-name:hover {
	color: var(--spice-text);
}

.top-genres-name--active {
	color: var(--spice-button);
}

.top-genres-bar-track {
	height: 8px;
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
	border-radius: 4px;
	overflow: hidden;
}

.top-genres-bar {
	height: 8px;
	border-radius: 4px;
	background: rgba(var(--spice-rgb-button), 0.4);
	transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.top-genres-bar.peak {
	background: var(--spice-button);
}

.top-genres-pct {
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.55);
	font-variant-numeric: tabular-nums;
	text-align: right;
}

.overview-card-label {
	font-size: 10.5px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: rgba(var(--spice-rgb-text), 0.5);
	font-weight: 600;
}

.overview-card-value {
	font-size: 22px;
	font-weight: 700;
	letter-spacing: -0.02em;
	line-height: 1;
	color: var(--spice-text);
	font-variant-numeric: tabular-nums;
}

/* Section card wrapper */
.section-card {
	background: var(--spice-card);
	border-radius: 8px;
	padding: 20px;
	overflow: hidden;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.08);
	box-sizing: border-box;
}

.stats-page-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-md, 16px);
}

/* Top lists grid - 3 columns side by side, responsive */
.top-lists-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--space-md, 16px);
}

@media (max-width: 1200px) {
	.top-lists-grid {
		grid-template-columns: 1fr;
	}

	.overview-card {
		min-width: 80px;
	}
}

@media (max-width: 780px) {
	.overview-section {
		grid-template-columns: 1fr;
		grid-template-rows: auto auto auto;
	}
	.overview-hero-cell {
		grid-column: 1;
		grid-row: 1;
	}
	.overview-right-block {
		grid-column: 1;
		grid-row: 2;
		grid-template-columns: 1fr 1fr;
	}
	.overview-bottom-row {
		grid-column: 1;
		grid-row: 3;
		grid-template-columns: 1fr 1fr 1fr;
	}
}

@media (max-width: 600px) {
	.stats-page-scroll {
		padding: 0 var(--space-md, 16px) var(--space-lg, 24px);
	}

	.stats-page-sticky {
		margin: 0 calc(-1 * var(--space-md, 16px)) var(--space-md, 16px);
		padding: var(--space-lg, 24px) var(--space-md, 16px) var(--space-md, 16px);
	}

	.stats-header-title {
		font-size: 22px;
	}

	.stats-header {
		flex-wrap: wrap;
	}

	.overview-card {
		min-width: 70px;
		padding: 12px;
	}

	.period-tabs {
		flex-wrap: wrap;
		height: auto;
		gap: var(--space-xs, 4px);
	}

	.settings-modal {
		width: calc(100vw - 32px);
		max-width: 620px;
	}

	.recently-played-item {
		flex: 0 0 100px;
	}

	.recently-played-art {
		width: 100px;
		height: 100px;
	}

	.overview-right-block,
	.overview-bottom-row {
		grid-template-columns: 1fr 1fr;
	}

	.top-genres-row {
		grid-template-columns: 100px 1fr 36px;
		gap: 8px;
	}
}

/* Section headings */
.section-heading {
	display: flex;
	align-items: baseline;
	gap: 10px;
	margin-bottom: var(--space-md, 16px);
}

.section-kicker {
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: rgba(var(--spice-rgb-text), 0.5);
	font-weight: 600;
}

.section-title {
	margin: 0;
	font-size: var(--font-size-lg, 20px);
	line-height: var(--line-height-heading, 1.2);
	font-weight: 700;
	letter-spacing: -0.01em;
}

.section-header {
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
	line-height: var(--line-height-heading, 1.2);
	margin: 0 0 var(--space-sm, 8px);
	color: var(--spice-subtext);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

/* Top list rows */
.top-list-row {
	display: flex;
	align-items: center;
	height: 64px;
	box-sizing: border-box;
	padding: 8px 6px;
	cursor: pointer;
	gap: 12px;
	border-radius: 6px;
	transition: background 0.15s;
	overflow: hidden;
}

.top-list-row:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
}

/* Rank badges */
.rank-number {
	width: 28px;
	text-align: center;
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
	color: var(--spice-subtext);
	flex-shrink: 0;
}

.rank-gold,
.rank-silver,
.rank-bronze {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	font-size: var(--font-size-sm, 12px);
	font-weight: 700;
	color: #1a1a1a;
	flex-shrink: 0;
}

.rank-gold {
	background: var(--rank-gold, #ffd700);
}
.rank-silver {
	background: var(--rank-silver, #c0c0c0);
}
.rank-bronze {
	background: var(--rank-bronze, #cd7f32);
}

.activity-chart-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.activity-chart-peak {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
}

.activity-chart-peak span {
	color: var(--spice-button);
	font-weight: 700;
}

.activity-chart {
	display: flex;
	align-items: flex-end;
	gap: 2px;
	height: 160px;
	padding: 8px 0;
}

.activity-bar {
	flex: 1;
	background: rgba(var(--spice-rgb-button), 0.4);
	border-radius: 6px 6px 0 0;
	min-width: 4px;
	transition: height 0.2s ease;
	cursor: pointer;
}

.activity-bar:hover {
	background: rgba(var(--spice-rgb-button), 0.7);
}

.activity-bar.peak {
	background: var(--spice-button);
}

.activity-chart-labels {
	display: flex;
	justify-content: space-between;
	margin-top: 4px;
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
}

.consistency-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
}

.consistency-metric {
	padding: 12px;
	border-radius: 8px;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.08);
	background: rgba(var(--spice-rgb-main), 0.25);
}

.consistency-metric-label {
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: rgba(var(--spice-rgb-text), 0.56);
}

.consistency-metric-value {
	margin-top: 6px;
	font-size: 24px;
	font-weight: 700;
	line-height: 1;
}

.consistency-metric-sub {
	margin-top: 6px;
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.62);
}

.consistency-metric--accent {
	border-color: rgba(var(--spice-rgb-button), 0.3);
	background: rgba(var(--spice-rgb-button), 0.06);
}

.consistency-metric--accent .consistency-metric-value {
	color: #1ed760;
}

.consistency-footer {
	margin-top: 12px;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.consistency-coverage-label {
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: rgba(var(--spice-rgb-text), 0.56);
	margin-bottom: 6px;
}

.consistency-coverage-row {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
}

.consistency-coverage-track {
	flex: 1;
	height: 8px;
	border-radius: 999px;
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.15);
	overflow: hidden;
}

.consistency-coverage-fill {
	height: 100%;
	background: var(--spice-button);
}

.consistency-sparkline-bars {
	height: 44px;
	display: flex;
	align-items: flex-end;
	gap: 3px;
}

.consistency-sparkline-bar-wrap {
	flex: 1;
	display: flex;
	align-items: flex-end;
	height: 100%;
	min-height: 44px;
}

.consistency-sparkline-bar {
	width: 100%;
	border-radius: 3px 3px 0 0;
	background: rgba(var(--spice-rgb-button), 0.65);
	transition: background 0.15s ease;
}

.consistency-sparkline-bar:hover {
	background: rgba(var(--spice-rgb-button), 0.85);
}

.consistency-sparkline-bar.peak {
	background: var(--spice-button);
}

.consistency-week-split-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}

.consistency-week-chip {
	padding: 10px 12px;
	border-radius: 8px;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.08);
	background: rgba(var(--spice-rgb-main), 0.25);
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.7);
}

.consistency-week-chip strong {
	font-size: 15px;
	color: var(--spice-text);
}

/* Recently played */
.recently-played {
	display: flex;
	gap: 14px;
	overflow-x: auto;
	padding-bottom: 4px;
	margin-right: -24px;
	padding-right: 24px;
}

.recently-played::-webkit-scrollbar {
	display: none;
}

.recently-played-item {
	flex: 0 0 132px;
	width: 132px;
	min-width: 132px;
	max-width: 132px;
	cursor: pointer;
}

.recently-played-art {
	width: 132px;
	height: 132px;
	border-radius: 6px;
	object-fit: cover;
	background: var(--spice-main);
}

.recently-played-name {
	margin-top: 8px;
	display: block;
	width: 100%;
	font-size: 13px;
	font-weight: 600;
	color: var(--spice-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.recently-played-artist {
	display: block;
	width: 100%;
	font-size: 11px;
	color: rgba(var(--spice-rgb-text), 0.55);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.recently-played-time {
	display: block;
	width: 100%;
	font-size: 11px;
	color: rgba(var(--spice-rgb-text), 0.4);
	margin-top: 2px;
}

/* Loading skeletons */
.skeleton-shimmer {
	background: var(--spice-card);
	animation: shimmer 1.5s infinite;
	border-radius: 4px;
}

@keyframes shimmer {
	0% {
		opacity: 0.5;
	}
	50% {
		opacity: 1;
	}
	100% {
		opacity: 0.5;
	}
}

.skeleton-text {
	height: 14px;
	margin: 4px 0;
}

/* Recently played skeleton */
.recently-played-skeleton-art {
	width: 132px;
	height: 132px;
	border-radius: 6px;
}

.recently-played-skeleton-text {
	width: 100px;
	height: 10px;
	border-radius: 2px;
	margin-top: 8px;
}

.recently-played-skeleton-subtext {
	width: 70px;
	height: 8px;
	border-radius: 2px;
	margin-top: 4px;
}

/* Empty state */
.empty-state {
	text-align: center;
	padding: 48px 16px;
	color: var(--spice-subtext);
}

/* Inline error card */
.inline-error-card {
	display: flex;
	align-items: flex-start;
	gap: 14px;
	padding: 18px 20px;
	border: 1px dashed rgba(var(--spice-rgb-misc), 0.18);
	border-radius: 8px;
	background: rgba(var(--spice-rgb-misc), 0.02);
}

.inline-error-content {
	flex: 1;
	min-width: 0;
}

.inline-error-title {
	font-size: 13px;
	font-weight: 600;
}

.inline-error-body {
	font-size: var(--font-size-sm);
	color: rgba(var(--spice-rgb-text), 0.6);
	margin-top: 2px;
}

.inline-error-countdown {
	margin-top: 8px;
	font-size: var(--font-size-sm);
	color: var(--spice-button);
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}

.inline-error-cta {
	appearance: none;
	border: 1px solid rgba(var(--spice-rgb-misc), 0.16);
	background: transparent;
	color: var(--spice-text);
	padding: 7px 14px;
	font-size: var(--font-size-sm);
	font-weight: 600;
	border-radius: 999px;
	cursor: pointer;
	flex-shrink: 0;
	align-self: center;
}

/* Settings overlay/modal */
.settings-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.settings-modal {
	background: var(--spice-card);
	border-radius: 8px;
	width: 620px;
	max-width: calc(100vw - 32px);
	max-height: 80vh;
	overflow-y: auto;
	padding: 24px;
}

.settings-modal.update-modal {
	width: 560px;
	max-height: 85vh;
}

.update-modal-status {
	font-size: var(--font-size-md, 14px);
	color: var(--spice-text);
	margin: 0 0 12px;
	line-height: 1.45;
}

.update-modal-note {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	margin: 0 0 8px;
	line-height: 1.45;
}

.update-modal-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.update-modal-actions-top {
	margin-bottom: 16px;
}

.update-modal-pref-row {
	margin-bottom: 4px;
}

.update-modal-install-short {
	margin: 8px 0 12px;
}

.update-modal-changelog-title {
	font-size: var(--font-size-md, 14px);
	font-weight: 600;
	color: var(--spice-text);
	margin: 0 0 8px;
	padding-top: 8px;
	border-top: 1px solid var(--spice-misc);
}

.update-modal-changelog-error {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-notification-error, #e83b3b);
	margin: 0 0 8px;
}

.update-modal-changelog {
	max-height: min(40vh, 320px);
	overflow: auto;
	padding: 12px;
	border-radius: 8px;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12);
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	line-height: 1.5;
}

.markdown-lite h3 {
	font-size: var(--font-size-md, 14px);
	font-weight: 600;
	color: var(--spice-text);
	margin: 16px 0 8px;
}

.markdown-lite h3:first-child {
	margin-top: 0;
}

.markdown-lite p {
	margin: 0 0 8px;
}

.markdown-lite code {
	font-family: ui-monospace, monospace;
	font-size: 11px;
	padding: 1px 4px;
	border-radius: 4px;
	background: rgba(var(--spice-rgb-text), 0.08);
}

.markdown-lite a {
	color: var(--spice-button);
}

.settings-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
}

.settings-modal-title {
	font-size: var(--font-size-lg, 20px);
	font-weight: 700;
	color: var(--spice-text);
}

/* Settings tabs */
.settings-tabs {
	display: flex;
	gap: 8px;
	border-bottom: 1px solid var(--spice-misc);
	margin-bottom: 16px;
}

.settings-tab {
	cursor: pointer;
	padding: 8px 12px;
	color: var(--spice-subtext);
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	font-size: var(--font-size-md, 14px);
	white-space: nowrap;
}

.settings-tab:hover {
	color: var(--spice-text);
}

.settings-tab.active {
	color: var(--spice-text);
	border-bottom: 2px solid var(--spice-button);
}

/* Settings rows */
.settings-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 0;
	border-bottom: 1px solid var(--spice-misc);
}

.settings-row:last-child {
	border-bottom: none;
}

.settings-label {
	font-size: var(--font-size-md, 14px);
	color: var(--spice-text);
}

.settings-sublabel {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	margin-top: 2px;
}

/* Settings groups: kicker header + rows, mirrors the dashboard section anatomy */
.settings-group {
	margin-top: 20px;
}

.settings-group:first-child {
	margin-top: 0;
}

.settings-group > .section-header {
	margin-bottom: 0;
	padding-bottom: 6px;
	border-bottom: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.15);
}

.settings-group .settings-row:last-child {
	border-bottom: none;
}

/* Option group: joined segmented pills for small option sets */
.option-group {
	display: inline-flex;
	flex-wrap: wrap;
	/* Hug the buttons even inside stacked rows (align-items: stretch) */
	width: fit-content;
	border: 1px solid var(--spice-misc);
	border-radius: 4px;
	overflow: hidden;
}

.option-group-btn {
	flex: 0 0 auto;
	background: none;
	border: none;
	border-left: 1px solid var(--spice-misc);
	padding: 4px 12px;
	min-width: 36px;
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	cursor: pointer;
	transition:
		color 0.15s,
		background 0.15s;
}

.option-group-btn:first-child {
	border-left: none;
}

.option-group-btn:hover {
	color: var(--spice-text);
}

.option-group-btn.active {
	background: rgba(var(--spice-rgb-button, 30, 215, 96), 0.2);
	color: var(--spice-text);
	font-weight: 700;
}

/* Text inputs in settings */
.settings-input {
	flex: 1;
	min-width: 0;
	padding: 8px 12px;
	border-radius: 4px;
	border: 1px solid var(--spice-misc);
	background: var(--spice-main);
	color: var(--spice-text);
	font-size: var(--font-size-sm, 14px);
}

.health-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	display: inline-block;
	flex-shrink: 0;
	cursor: default;
}

.health-green {
	background: #1ed760;
}

.health-yellow {
	background: #f59b23;
}

.health-red {
	background: #e83b3b;
}

/* Legacy settings-btn kept for backwards compatibility */
.settings-btn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
	color: var(--spice-subtext);
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	transition:
		color 0.15s,
		background 0.15s;
	width: 32px;
	height: 32px;
}

.settings-btn:hover {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.settings-btn svg {
	width: 20px;
	height: 20px;
}

/* Primary/destructive buttons */
.btn-primary {
	background: var(--spice-button);
	color: var(--spice-text);
	border: none;
	border-radius: 4px;
	padding: 8px 16px;
	cursor: pointer;
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
}

.btn-primary:hover {
	opacity: 0.85;
}

.btn-destructive {
	background: var(--spice-notification-error);
	color: var(--spice-text);
	border: none;
	border-radius: 4px;
	padding: 8px 16px;
	cursor: pointer;
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
}

.btn-destructive:hover {
	opacity: 0.85;
}

.btn-secondary {
	background: none;
	color: var(--spice-subtext);
	border: 1px solid var(--spice-misc);
	border-radius: 4px;
	padding: 8px 16px;
	cursor: pointer;
	font-size: var(--font-size-md, 14px);
}

.btn-secondary:hover {
	color: var(--spice-text);
	border-color: var(--spice-text);
}

/* Compact action buttons inside settings rows */
.settings-row .btn-primary,
.settings-row .btn-secondary,
.settings-row .btn-destructive {
	padding: 4px 12px;
	font-size: var(--font-size-sm, 12px);
	white-space: nowrap;
}

/* Album art thumbnail */
.track-art {
	width: 44px;
	height: 44px;
	border-radius: 4px;
	object-fit: cover;
	background: var(--spice-card);
	flex-shrink: 0;
}

.track-art--round {
	border-radius: 50%;
}

/* Import progress */
.import-progress {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.import-progress-label {
	font-size: var(--font-size-md, 14px);
	color: var(--spice-subtext);
}

.import-progress-bar {
	width: 100%;
	height: 4px;
	-webkit-appearance: none;
	appearance: none;
	border-radius: 2px;
	background: var(--spice-misc);
}

.import-progress-bar::-webkit-progress-bar {
	background: var(--spice-misc);
	border-radius: 2px;
}

.import-progress-bar::-webkit-progress-value {
	background: var(--spice-button);
	border-radius: 2px;
}

/* Import result card */
.import-result-card {
	width: 100%;
	background: var(--spice-card);
	border-radius: 4px;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.import-result-row {
	display: flex;
	align-items: baseline;
	gap: 4px;
	font-size: var(--font-size-md, 14px);
}

.import-result-count {
	font-weight: 700;
}

.import-result-count--success {
	color: var(--spice-button);
}

.import-result-count--neutral {
	color: var(--spice-subtext);
}

.import-result-count--error {
	color: var(--spice-notification-error);
}

.import-result-label {
	color: var(--spice-subtext);
}

.import-result-errors {
	margin-top: 4px;
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
}

.import-result-actions {
	margin-top: 8px;
	display: flex;
	justify-content: flex-end;
}

/* Provider tab */

.provider-status-card {
	width: 100%;
	background: var(--spice-card);
	border-radius: 4px;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.tier-badge {
	display: inline-block;
	border-radius: 4px;
	padding: 2px 8px;
	font-size: var(--font-size-sm, 12px);
	font-weight: 700;
	line-height: 1.4;
}

.tier-badge--free {
	color: var(--spice-subtext);
	border: 1px solid var(--spice-misc);
}

.tier-badge--plus {
	color: var(--spice-button);
	background: rgba(var(--spice-rgb-button), 0.15);
}

.provider-radio-row {
	display: flex;
	align-items: center;
	min-height: 44px;
	padding: 8px 12px;
	cursor: pointer;
	gap: 12px;
	border-radius: 4px;
	border-left: 2px solid transparent;
	transition: background 0.1s;
}

.provider-radio-row:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.provider-radio-row.active {
	border-left: 2px solid var(--spice-button);
}

.provider-radio-row.active .settings-label {
	color: var(--spice-text);
}

.provider-connect-error {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-notification-error);
	margin-top: 4px;
}

/* Activity tabs */
.activity-tabs {
	display: flex;
	gap: 0;
	margin-bottom: 12px;
}

.activity-tab {
	cursor: pointer;
	padding: 4px 8px;
	color: var(--spice-subtext);
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	font-size: var(--font-size-md, 14px);
	transition: color 0.15s;
}

.activity-tab:hover {
	color: var(--spice-text);
}

.activity-tab.active {
	color: var(--spice-text);
	border-bottom: 2px solid var(--spice-button);
}

/* Weekday chart */
.weekday-chart {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 8px;
	height: 160px;
	padding: 8px 0;
}

.weekday-column {
	display: flex;
	flex-direction: column;
	align-items: center;
	height: 100%;
}

.weekday-bar-area {
	flex: 1;
	display: flex;
	align-items: flex-end;
	width: 100%;
	min-height: 0;
}

.weekday-bar-area .activity-bar {
	width: 100%;
}

.weekday-label {
	margin-top: 6px;
	font-size: 11px;
	color: var(--spice-subtext);
	text-align: center;
}

/* Calendar heatmap */
.heatmap-container {
	padding-top: 18px;
}

.heatmap-scroll-wrap {
	overflow-x: auto;
}

.heatmap-scroll-inner {
	min-width: min-content;
	width: fit-content;
	margin: 0 auto;
}

.heatmap-shrink .heatmap-scroll-wrap {
	overflow: hidden;
}

.heatmap-shrink .heatmap-scroll-inner {
	min-width: 0;
	width: fit-content;
	margin: 0 auto;
}

.heatmap-month-labels {
	display: grid;
	gap: 3px;
	font-size: 10px;
	color: rgba(var(--spice-rgb-text), 0.5);
	height: 16px;
	margin-bottom: 4px;
}

.heatmap-grid {
	display: grid;
	gap: 3px;
}

.heatmap-week {
	display: grid;
	grid-template-rows: repeat(7, 16px);
	gap: 3px;
}

.heatmap-cell {
	width: 16px;
	height: 16px;
	border-radius: 3px;
}

.heatmap-legend {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	margin-top: 10px;
	font-size: 11px;
	color: rgba(var(--spice-rgb-text), 0.5);
}

.heatmap-legend-swatch {
	display: inline-block;
	width: 16px;
	height: 16px;
	border-radius: 3px;
}

/* Streak callout */
.streak-callout {
	margin-top: 14px;
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.65);
}

/* Setup wizard */
.wizard-modal {
	background: var(--spice-card);
	border-radius: 8px;
	width: 520px;
	max-width: calc(100vw - 48px);
	padding: 24px;
	text-align: center;
}

.wizard-page {
	width: 100%;
	display: flex;
	justify-content: center;
	padding: var(--space-md, 16px) 0 var(--space-xl, 32px);
}

.wizard-modal--page {
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.08);
}

.wizard-title {
	font-size: var(--font-size-lg, 20px);
	font-weight: 700;
	color: var(--spice-text);
	margin: 0 0 8px 0;
	line-height: 1.2;
}

.wizard-subtitle {
	font-size: var(--font-size-md, 14px);
	font-weight: 400;
	color: var(--spice-subtext);
	margin: 0 0 24px 0;
	line-height: 1.5;
}

.wizard-provider-cards {
	display: flex;
	flex-direction: row;
	gap: 16px;
}

.wizard-provider-card {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 24px;
	background: transparent;
	border: 1px solid var(--spice-misc);
	border-radius: 8px;
	cursor: pointer;
	min-height: 44px;
	transition: background 0.1s;
	text-align: center;
	color: inherit;
	font-family: inherit;
}

.wizard-provider-card:hover {
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
}

.wizard-provider-name {
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
	color: var(--spice-text);
	line-height: 1.2;
}

.wizard-provider-desc {
	font-size: var(--font-size-sm, 12px);
	font-weight: 400;
	color: var(--spice-subtext);
	line-height: 1.4;
}

.wizard-provider-cta {
	font-size: var(--font-size-sm, 12px);
	font-weight: 700;
	color: var(--spice-button);
	margin-top: auto;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.wizard-statsfm-help {
	text-align: left;
	gap: 6px;
	margin-bottom: 14px;
}

.wizard-statsfm-form {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.wizard-statsfm-input {
	width: 100%;
	padding: 10px 12px;
	border-radius: 4px;
	border: 1px solid var(--spice-misc);
	background: var(--spice-main);
	color: var(--spice-text);
	font-size: var(--font-size-md, 14px);
}

.wizard-statsfm-actions {
	display: flex;
	justify-content: space-between;
	gap: 8px;
}

/* Threshold slider */
.threshold-slider {
	padding: 10px 24px 26px;
}

.threshold-slider-rail {
	position: relative;
	height: 28px;
	cursor: pointer;
	touch-action: none;
}

.threshold-slider-track {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	height: 4px;
	transform: translateY(-50%);
	border-radius: 2px;
	background: var(--spice-card);
	border: 1px solid var(--spice-misc);
}

.threshold-slider-fill {
	position: absolute;
	left: 0;
	top: 50%;
	height: 4px;
	transform: translateY(-50%);
	border-radius: 2px;
	background: var(--spice-button);
	opacity: 0.5;
	pointer-events: none;
}

.threshold-slider-handle {
	position: absolute;
	top: 50%;
	transform: translate(-50%, -50%);
	min-width: 40px;
	padding: 3px 6px;
	border-radius: 4px;
	background: var(--spice-button);
	color: var(--spice-main);
	font-size: var(--font-size-sm, 12px);
	font-weight: 700;
	text-align: center;
	user-select: none;
	cursor: grab;
	z-index: 1;
}

.threshold-slider-handle:active {
	cursor: grabbing;
}

.threshold-slider-presets {
	position: relative;
	height: 16px;
	margin-top: 6px;
}

.threshold-slider-preset {
	position: absolute;
	transform: translateX(-50%);
	background: none;
	border: none;
	padding: 0;
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	cursor: pointer;
	user-select: none;
}

.threshold-slider-preset:hover {
	color: var(--spice-text);
}

.threshold-slider-preset.active {
	color: var(--spice-text);
	font-weight: 700;
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Settings sortable rows + tiles
   Scoped under .display-tab (DisplayTab root). NEW system does NOT
   restore any torn-down dashboard drag CSS. No portal, no ancestor
   transforms, no edge-scroll. Drop line for rows, outline for tiles.
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.display-tab .sortable-row {
	display: flex;
	align-items: center;
	min-height: 40px;
	padding: 0;
	gap: 8px;
	position: relative;
	user-select: none;
	touch-action: none;
}

.display-tab .sortable-row-label {
	flex: 1 1 auto;
	font-size: var(--font-size-md, 14px);
	color: var(--spice-text);
}

.display-tab .sortable-row-toggle {
	flex: 0 0 auto;
}

.display-tab .settings-drag-handle {
	flex: 0 0 auto;
	width: 24px;
	height: 24px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	background: transparent;
	border: none;
	cursor: grab;
	color: var(--spice-subtext);
	border-radius: 4px;
}
.display-tab .settings-drag-handle:hover {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 128, 128, 128), 0.12);
}
.display-tab .settings-drag-handle:active {
	cursor: grabbing;
}

/* Drop-slot indicator line between rows (Decision 5).
   At rest (no active drag in this list): invisible.
   During an active drag in the list (parent has data-drag-active="true"):
   ALL drop-lines show subtle (opacity 0.25) so user can see every drop slot.
   The targeted slot's line glows full opacity + box-shadow. */
.display-tab .settings-drop-line {
	height: 2px;
	margin: 0;
	background: var(--spice-button-active);
	opacity: 0;
	transition:
		opacity 100ms ease,
		box-shadow 100ms ease;
	pointer-events: none;
}
.display-tab [data-drag-active="true"] .settings-drop-line {
	opacity: 0.25;
}
.display-tab [data-drag-active="true"] .settings-drop-line[data-active="true"] {
	opacity: 1;
	box-shadow: 0 0 6px var(--spice-button-active);
}

/* Mini-grid tiles (Overview 2x2, Top Lists 1x3).
   overflow: hidden clips the dragged tile's translate3d so it can't escape
   the modal; drop logic uses live pointer position so reorder still works
   when the visible tile is clipped at the container edge. */
.display-tab .sortable-grid {
	display: grid;
	gap: 8px;
	margin-top: 8px;
	overflow: hidden;
}
.display-tab .sortable-grid--2x2 {
	grid-template-columns: 1fr 1fr;
}
.display-tab .sortable-grid--1x3 {
	grid-template-columns: 1fr 1fr 1fr;
}

/* Overview settings: mirrors actual overview layout (hero + 2x2 right block + 1x3 bottom row) */
.display-tab .overview-settings-top {
	display: grid;
	grid-template-columns: 1fr 2fr;
	gap: 8px;
	margin-top: 8px;
}
.display-tab .overview-settings-top .sortable-grid {
	margin-top: 0;
}
.display-tab .overview-settings-hero {
	border: 1px dashed var(--spice-misc);
	border-radius: 6px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	opacity: 0.6;
}
.display-tab .overview-settings-hero-sub {
	font-size: 10px;
	opacity: 0.5;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.display-tab .sortable-tile {
	min-height: 80px;
	padding: 12px;
	border: 1px solid var(--spice-misc);
	border-radius: 6px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	cursor: grab;
	user-select: none;
	touch-action: none;
	position: relative;
}
.display-tab .sortable-tile:active {
	cursor: grabbing;
}

.display-tab .sortable-tile-label {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-text);
	text-align: center;
}

.display-tab .sortable-tile-toggle {
	/* Stops drag activation; cursor reverts to default for this hit zone. */
	cursor: default;
}

/* Tile drop target outline (Decision 5, inset so grid does not shift) */
.display-tab .sortable-tile[data-drop-target="true"] {
	outline: 2px solid var(--spice-button-active);
	outline-offset: -2px;
}

.play-count-widget-anchor {
	display: flex;
	align-items: center;
	pointer-events: auto;
	margin-left: 8px;
	flex-shrink: 0;
}

.play-count-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	border-radius: 999px;
	background: rgba(var(--spice-rgb-button), 0.14);
	color: var(--spice-button);
	border: 1px solid rgba(var(--spice-rgb-button), 0.3);
	font-size: 11px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	cursor: pointer;
	transition: background 0.15s ease;
}
.play-count-pill:hover {
	background: rgba(var(--spice-rgb-button), 0.22);
}

.play-count-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--spice-button);
}

.play-count-bubble {
	position: relative;
	cursor: pointer;
}
.play-count-bubble-icon {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: rgba(var(--spice-rgb-button), 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--spice-button);
	font-size: 12px;
	box-shadow:
		0 0 0 1px rgba(var(--spice-rgb-button), 0.45),
		inset 0 1px 0 rgba(255, 255, 255, 0.12);
	text-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
}
.play-count-badge {
	position: absolute;
	top: -3px;
	right: -4px;
	min-width: 18px;
	height: 18px;
	padding: 0 4px;
	background: var(--spice-button);
	color: #000;
	border-radius: 999px;
	font-size: 10px;
	font-weight: 800;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 2px solid #000;
	font-variant-numeric: tabular-nums;
}

.play-count-minimal {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: rgba(255, 255, 255, 0.7);
	font-size: 11px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	padding: 3px 7px;
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.06);
	cursor: pointer;
	transition: background 0.15s ease;
}
.play-count-minimal:hover {
	background: rgba(255, 255, 255, 0.1);
}

.play-count-badge--new {
	font-size: 8px;
	letter-spacing: 0.04em;
	padding: 0 3px;
	min-width: 22px;
}

.play-count-pill--first {
	color: rgba(var(--spice-rgb-text), 0.92);
	border-color: rgba(var(--spice-rgb-button), 0.35);
}

.world-chart-text {
	flex: 1;
	min-width: 0;
}

.world-chart-title {
	font-size: var(--font-size-md, 14px);
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.world-chart-sub {
	font-size: var(--font-size-sm, 12px);
	color: rgba(var(--spice-rgb-text), 0.55);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.world-chart-stats {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 2px;
	font-size: var(--font-size-sm, 12px);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	flex-shrink: 0;
	min-width: 52px;
}

.world-stage-skeleton {
	display: flex;
	flex-direction: column;
	gap: var(--space-md, 16px);
}

/* World: podium card (hero-accented) + Top-15 ladder card */
.world-podium-card {
	background:
		radial-gradient(120% 140% at 0% 0%, rgba(var(--spice-rgb-button), 0.14), transparent 52%), var(--spice-card);
	border-color: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12);
}

.world-stage-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-md, 16px);
	flex-wrap: wrap;
}

.world-stage-skeleton {
	display: flex;
	flex-direction: column;
	gap: var(--space-md, 16px);
}

.world-podium {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	align-items: end;
	justify-items: center;
	gap: var(--space-md, 16px);
	padding: var(--space-md, 16px) 0 var(--space-sm, 8px);
}

.world-podium-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	min-width: 0;
	max-width: 220px;
	gap: 4px;
}

.world-podium-artwrap {
	position: relative;
	transition: transform 0.15s ease-out;
}

.world-podium-artwrap:hover {
	transform: translateY(-2px);
}

.world-podium-art-btn {
	appearance: none;
	border: 0;
	padding: 0;
	background: transparent;
	cursor: pointer;
	border-radius: 10px;
	display: block;
}

.world-podium-art-btn:focus-visible {
	outline: 2px solid rgba(var(--spice-rgb-button), 0.7);
	outline-offset: 2px;
}

.world-podium-play {
	position: absolute;
	right: 6px;
	bottom: 6px;
	opacity: 0;
	transition: opacity 0.15s;
}

.world-podium-artwrap:hover .world-podium-play,
.world-podium-artwrap:focus-within .world-podium-play {
	opacity: 1;
}

.world-podium-rank {
	font-size: 18px;
	font-weight: 800;
	line-height: 1;
	margin-top: 6px;
	font-variant-numeric: tabular-nums;
}

.world-podium-title {
	font-size: var(--font-size-md, 14px);
	font-weight: 700;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.world-podium-cell[data-rank="1"] .world-podium-title {
	font-size: 16px;
}

.world-podium-sub {
	font-size: var(--font-size-sm, 12px);
	color: rgba(var(--spice-rgb-text), 0.55);
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.world-podium-stat {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: var(--font-size-sm, 12px);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	color: rgba(var(--spice-rgb-text), 0.72);
}

.world-ladder {
	display: grid;
	grid-template-columns: 1fr 1fr;
	grid-template-rows: repeat(6, auto);
	grid-auto-flow: column;
	column-gap: var(--space-xl, 32px);
	row-gap: 0;
}

@media (max-width: 1100px) {
	.world-ladder {
		grid-template-columns: 1fr;
		grid-template-rows: none;
		grid-auto-flow: row;
	}
}

@media (max-width: 780px) {
	.world-podium {
		gap: var(--space-sm, 8px);
	}

	.world-podium-cell {
		max-width: 160px;
	}
}

.world-page-header {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: var(--space-md, 16px);
	flex-wrap: wrap;
	margin-bottom: 0;
}

.world-page-header .section-title {
	font-size: var(--font-size-2xl, 28px);
}

.world-chart-indicator {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
	font-weight: 600;
}

.world-chart-indicator-glyph {
	font-size: 9px;
}

.world-chart-indicator[data-dir="up"] {
	color: #1ed760;
}

.world-chart-indicator[data-dir="down"] {
	color: #e83b3b;
}

.world-chart-indicator[data-dir="new"] {
	color: #f59b23;
}

.world-chart-playbtn {
	appearance: none;
	border: 0;
	cursor: pointer;
	font: inherit;
	background: var(--spice-button);
	color: var(--spice-button-text, #000);
	border-radius: 999px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	transition:
		transform 0.1s,
		background 0.15s;
}

.world-chart-playbtn:hover {
	background: var(--spice-button-active, var(--spice-button));
	transform: scale(1.06);
}

@media (max-width: 780px) {
	.world-page-header {
		flex-direction: column;
		align-items: flex-start;
	}
}

.world-charts-source {
	margin-top: var(--space-md, 16px);
	font-size: var(--font-size-sm, 12px);
	color: rgba(var(--spice-rgb-text), 0.45);
}

.world-charts-empty {
	text-align: center;
	padding: var(--space-2xl, 48px) var(--space-lg, 24px);
	border-radius: 8px;
	background: rgba(var(--spice-rgb-misc), 0.03);
	border: 1px dashed rgba(var(--spice-rgb-misc), 0.12);
}

.world-charts-empty-title {
	font-size: var(--font-size-lg, 20px);
	font-weight: 700;
	color: var(--spice-text);
	margin-bottom: var(--space-sm, 8px);
}

.world-charts-empty-body {
	font-size: var(--font-size-md, 14px);
	color: rgba(var(--spice-rgb-text), 0.6);
	margin-bottom: var(--space-md, 16px);
	max-width: 320px;
	margin-inline: auto;
}

.tour-overlay {
	position: fixed;
	inset: 0;
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.55);
}

.tour-overlay--targeted {
	background: transparent;
	pointer-events: none;
}

.tour-spotlight {
	pointer-events: none;
	border: 2px solid var(--spice-button);
	animation: tour-pulse 1.8s ease-in-out infinite;
}

@keyframes tour-pulse {
	0%,
	100% {
		border-color: var(--spice-button);
	}
	50% {
		border-color: rgba(255, 255, 255, 0.4);
	}
}

.tour-popover {
	width: 280px;
	max-width: calc(100vw - 16px);
	padding: 14px;
	background: #1f1f1f;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	text-align: left;
	pointer-events: auto;
}

.tour-popover--positioned {
	position: fixed;
}

.tour-step-counter {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--spice-button);
	margin-bottom: 4px;
}

.tour-label {
	font-size: 13px;
	font-weight: 600;
	color: var(--spice-text);
	margin-bottom: 4px;
}

.tour-text {
	font-size: 12px;
	color: rgba(255, 255, 255, 0.65);
	line-height: 1.5;
}

.tour-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 14px;
}

.tour-btn-skip,
.tour-btn-back {
	appearance: none;
	border: 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.5);
	font-size: 12px;
	cursor: pointer;
	padding: 0;
}

.tour-btn-next {
	appearance: none;
	border: 0;
	background: var(--spice-button);
	color: #000;
	font-size: 12px;
	font-weight: 700;
	padding: 5px 12px;
	border-radius: 999px;
	cursor: pointer;
}

.tour-dots {
	display: flex;
	gap: 4px;
}

.tour-dot {
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
}

.tour-dot.active {
	background: var(--spice-button);
}

.share-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.share-modal {
	background: var(--spice-card);
	border-radius: 8px;
	width: min(720px, calc(100vw - 48px));
	max-width: calc(100vw - 48px);
	max-height: 90vh;
	overflow-y: auto;
	padding: 24px;
}

.share-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
}

.share-modal-title {
	font-size: var(--font-size-lg, 20px);
	font-weight: 700;
	color: var(--spice-text);
	margin: 0;
}

.share-tabs-row {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
}

.share-control-group {
	margin-bottom: 12px;
}

.share-control-label {
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: rgba(var(--spice-rgb-text), 0.55);
	margin-bottom: 6px;
}

.share-control-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 6px 0 12px;
}

.share-variant-tab,
.share-size-tab {
	appearance: none;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	background: transparent;
	color: rgba(var(--spice-rgb-text), 0.55);
	font-size: var(--font-size-sm, 12px);
	font-weight: 600;
	padding: 5px 12px;
	border-radius: 4px;
	cursor: pointer;
	transition:
		color 0.15s,
		background 0.15s,
		border-color 0.15s;
}

.share-variant-tab:hover,
.share-size-tab:hover {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.06);
}

.share-variant-tab.active,
.share-size-tab.active {
	color: var(--spice-text);
	background: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	border-color: rgba(var(--spice-rgb-misc, 255, 255, 255), 0.2);
}

.share-size-tab:disabled {
	opacity: 0.35;
	cursor: not-allowed;
	pointer-events: none;
}

.share-preview-container {
	display: flex;
	justify-content: center;
	align-items: center;
	height: min(58vh, 640px);
	min-height: 320px;
	overflow: auto;
	padding: 16px;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	border-radius: 8px;
	background: rgba(var(--spice-rgb-main), 0.3);
}

.share-preview-image {
	max-width: 100%;
	max-height: min(54vh, 600px);
	width: auto;
	height: auto;
	object-fit: contain;
	border-radius: 10px;
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.share-preview-status {
	font-size: 12px;
	color: rgba(var(--spice-rgb-text), 0.65);
}

.share-actions {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
	margin-top: 12px;
}

.share-action-btn {
	min-width: 140px;
}

/* App footer */
.stats-app-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: var(--space-sm, 8px);
	margin-top: var(--space-xl, 32px);
	padding-top: var(--space-md, 16px);
	border-top: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12);
	font-size: var(--font-size-sm, 12px);
	color: rgba(var(--spice-rgb-text), 0.55);
}

.stats-app-footer-links {
	display: inline-flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-sm, 8px);
}

.stats-app-footer-link {
	color: var(--spice-button);
	font-weight: 600;
	text-decoration: none;
}

.stats-app-footer-link:hover {
	color: var(--spice-button-active, var(--spice-button));
	text-decoration: underline;
	text-underline-offset: 2px;
}

.stats-app-footer-credit {
	font-style: italic;
}

.stats-app-footer-meta {
	display: inline-flex;
	align-items: center;
	gap: 12px;
}

.stats-app-footer-version {
	font-variant-numeric: tabular-nums;
	color: rgba(var(--spice-rgb-text), 0.45);
}

.stats-app-footer-install-link {
	appearance: none;
	border: none;
	background: none;
	cursor: pointer;
	padding: 0;
	font: inherit;
	color: var(--spice-button);
	font-weight: 600;
	text-decoration: underline;
	text-underline-offset: 2px;
}

.stats-app-footer-install-link:hover {
	color: var(--spice-button-active, var(--spice-button));
}

.update-modal-repo-hint {
	margin-bottom: 0;
}

.settings-about-command-block {
	margin-bottom: 14px;
	border-radius: 8px;
	border: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.1);
	background: rgba(var(--spice-rgb-main), 0.35);
	overflow: hidden;
}

.settings-about-command-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 10px;
	border-bottom: 1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.08);
}

.settings-about-command-label {
	font-size: var(--font-size-sm, 12px);
	font-weight: 600;
	color: var(--spice-subtext);
}

.settings-about-copy-btn {
	flex-shrink: 0;
	padding: 4px 12px;
	font-size: 12px;
}

.settings-about-command-pre {
	margin: 0;
	padding: 12px;
	font-family: ui-monospace, monospace;
	font-size: 11px;
	line-height: 1.45;
	color: rgba(var(--spice-rgb-text), 0.92);
	white-space: pre-wrap;
	word-break: break-all;
	max-height: 120px;
	overflow: auto;
}

.settings-about-hint {
	font-size: var(--font-size-sm, 12px);
	color: var(--spice-subtext);
	margin-top: 16px;
	line-height: 1.5;
}

.settings-inline-link {
	color: var(--spice-button);
}
`});function Bs(){let t=document.getElementById("listening-stats-styles");t&&t.remove();let e=document.createElement("style");e.id="listening-stats-styles",e.textContent=Ls,document.head.appendChild(e)}var Fs=le(()=>{"use strict";Ks()});var js={};Ws(js,{findPlaybarMount:()=>$s,mountPlaybarWidget:()=>Cl});function $s(){for(let t of Rl){let e=document.querySelector(t);if(e)return e}return null}function Il(t){let e=()=>{if(t.isConnected&&t.parentElement!==document.body)return;let n=$s();n&&t.parentElement!==n&&n.appendChild(t)};e(),new MutationObserver(e).observe(document.body,{childList:!0,subtree:!0}),setInterval(e,2e3)}function Cl(){if(document.getElementById(Us))return;Bs();let t=document.createElement("div");t.id=Us,t.style.display="contents",document.body.appendChild(t),Il(t);let e=Spicetify.React.createElement(Rr,{silent:!0},Spicetify.React.createElement(Ns)),r=Spicetify.ReactDOM;typeof r.createRoot=="function"?r.createRoot(t).render(e):r.render?.(e,t)}var Us,Rl,Hs=le(()=>{"use strict";xs();zs();Fs();Us="listening-stats-widget-root",Rl=[".main-nowPlayingWidget-nowPlaying",".main-nowPlayingBar-left",'[data-testid="now-playing-widget"]']});Ne();function ve(t){let e=new Date(t);return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function Te(t){if(t==null)return;let e=String(t).trim();if(e){if(/^spotify:image:/i.test(e)){let r=e.replace(/^spotify:image:/i,"").trim();return r?`https://i.scdn.co/image/${r}`:void 0}return e}}var Rn=class{constructor(e=300*1e3){this.store=new Map;this.ttlMs=e}get(e){let r=this.store.get(e);return!r||Date.now()>r.expiry?null:r.data}getStale(e){let r=this.store.get(e);return r?r.data:null}set(e,r){this.store.set(e,{data:r,expiry:Date.now()+this.ttlMs})}invalidate(e){e!==void 0?this.store.delete(e):this.store.clear()}},vr=new Rn;var zt=class{constructor(){this.state="closed";this.failureCount=0;this.openedAt=null;this.extraCooldownMs=0}isOpen(){if(this.state==="open"){let e=Date.now()-(this.openedAt??0),r=3e4+this.extraCooldownMs;return e>=r?(this.state="half-open",!1):!0}return!1}recordSuccess(){this.failureCount=0,this.state="closed",this.openedAt=null,this.extraCooldownMs=0}recordFailure(e){if(this.state==="half-open"){this.state="open",this.openedAt=Date.now(),this.extraCooldownMs=e?e*1e3:0;return}this.failureCount+=1,this.failureCount>=3&&(this.state="open",this.openedAt=Date.now(),this.extraCooldownMs=e?e*1e3:0)}reset(){this.recordSuccess()}getResetAt(){return this.state!=="open"||this.openedAt===null?null:this.openedAt+3e4+this.extraCooldownMs}getState(){return this.state}},gt=new zt;async function Fi(t){let e=vr.get(t);if(e!==null)return{ok:!0,data:e};if(gt.isOpen()){let r=vr.getStale(t);return r!==null?{ok:!0,data:r,stale:!0}:{ok:!1,error:{type:"circuit_open"}}}try{let r=await Spicetify.CosmosAsync.request("GET",t);if(r.status===429){let i=r.headers?.["retry-after"]??r.headers?.["Retry-After"]??"5",s=Number(i)||5;return gt.recordFailure(s),{ok:!1,error:{type:"rate_limited",retryAfter:s}}}if(r.status<200||r.status>=300)return gt.recordFailure(),{ok:!1,error:{type:"http_error",status:r.status}};gt.recordSuccess();let n=r.body;return vr.set(t,n),{ok:!0,data:n}}catch(r){return gt.recordFailure(),{ok:!1,error:{type:"network_error",message:String(r)}}}}Ne();var Ui=50,Ao=1440*60*1e3,To=360*60*1e3;function In(t){return/^spotify:artist:[a-zA-Z0-9]+$/i.test(t.trim())}function Do(t,e){let r=e-t.updatedAt;return t.imageUrl?.trim()?r<Ao:r<To}async function $i(t){if(t.length===0)return;let e=[...new Set(t.filter(In))];if(e.length===0)return;let r=Date.now(),n=await B.artists.where("uri").anyOf(e).toArray(),i=new Set(n.filter(a=>Do(a,r)).map(a=>a.uri)),s=e.filter(a=>!i.has(a));if(s.length!==0)for(let a=0;a<s.length;a+=Ui){let o=s.slice(a,a+Ui),l=o.map(d=>d.replace(/^spotify:artist:/i,"")).join(","),c=await Fi(`https://api.spotify.com/v1/artists?ids=${l}`);if(!c.ok)continue;let p=[],u=c.data.artists??[];for(let d=0;d<o.length;d++){let m=o[d],f=u[d];if(f){let h=f.images[0]?.url??null;p.push({uri:`spotify:artist:${f.id}`,name:f.name,genres:f.genres??[],imageUrl:Te(h)??h,updatedAt:Date.now()})}else p.push({uri:m,name:"Unknown",genres:[],imageUrl:null,updatedAt:Date.now()})}p.length>0&&await B.artists.bulkPut(p)}}Lt();ue();function Yi(){return localStorage.getItem(L.RANK_MODE)==="minutes"?"minutes":"streams"}yt();var No=120*1e3,Cn=class{constructor(){this.store=new Map;this.invalidationListenerAttached=!1}get(e){let r=this.store.get(e);return r?Date.now()>=r.expiry?(this.store.delete(e),null):r.data:null}set(e,r){this.store.set(e,{data:r,expiry:Date.now()+No})}invalidate(e){e!==void 0?this.store.delete(e):this.store.clear()}setupInvalidationListeners(){this.invalidationListenerAttached||(this.invalidationListenerAttached=!0,window.addEventListener(re.PLAY_RECORDED,()=>{this.invalidate()}))}},De=new Cn;var zo="local",Ko=12,Lo=400;async function Bo(t){let e=[...new Set(t.topArtists.map(i=>i.artistUri).filter(In))];if(e.length===0)return;let r=await B.artists.where("uri").anyOf(e).toArray(),n=new Map(r.map(i=>[i.uri,i]));for(let i of t.topArtists){let s=n.get(i.artistUri),a=Te(s?.imageUrl??void 0)??s?.imageUrl;a?.trim()&&!i.imageUrl?.trim()&&(i.imageUrl=a)}}function On(t){if(t.type==="skip")return!1;let e=t.trackUri??"";return!(e.startsWith("spotify:narration:")||e.startsWith("spotify:ad:")||e.startsWith("spotify:interruption:"))}function Mn(t){return t.artistUri||`local:artist:${t.artistName.toLowerCase()}`}function Fo(t){return t.albumUri||`local:album:${t.artistName.toLowerCase()}:${t.albumName.toLowerCase()}`}function Uo(t,e){return`${zo}:${t}:${e}`}function Nn(t){return(e,r)=>t==="minutes"?r.durationMs-e.durationMs||r.count-e.count:r.count-e.count||r.durationMs-e.durationMs}function Wi(t){return new Date(t.getFullYear(),t.getMonth(),t.getDate()-1)}function $o(t){if(t.length===0)return 0;let e=new Set(t.map(a=>ve(a.startedAt))),r=new Date,n=new Date(r.getFullYear(),r.getMonth(),r.getDate()),i=ve(n.getTime());if(!e.has(i)){n=Wi(n);let a=ve(n.getTime());if(!e.has(a))return 0}let s=0;for(;e.has(ve(n.getTime()));)s++,n=Wi(n);return s}var zn=class{getProviderInfo(){return{id:"local",name:"Local",description:"Stats from locally tracked plays",capabilities:{hasActivityData:!0,hasConsistencyData:!0,hasGenreData:!0,hasStreakData:!0,hasSkipRate:!1,tier:"n/a"}}}getSupportedPeriods(){return rt}async calculateStats(e){let r=Yi(),n=Uo(e.id,r),i=De.get(n);if(i)return await Bo(i),i;let{start:s,end:a}=e.getBoundaries(),o=a===Number.MAX_SAFE_INTEGER?await B.playEvents.toArray():await B.playEvents.where("startedAt").between(s,a).toArray(),l=o.filter(On),c=Kt(e),p,u;if(c){let z=(await B.playEvents.where("startedAt").between(c.start,c.end).toArray()).filter(On),oe=new Set(l.map(Mn));if(z.length>0){let Ee=new Set(z.map(Mn)),me=0;for(let _ of oe)Ee.has(_)||me++;p=me,u=z.reduce((_,G)=>_+G.playedMs,0)}else p=oe.size}else p=0;let d=Date.now()-Lo*24*60*60*1e3,f=(await B.playEvents.where("startedAt").above(d).toArray()).filter(On),h=$o(f),y=new Map,g=new Map,b=new Map;for(let k of l){let z=y.get(k.trackUri);z?(z.count++,z.durationMs+=k.playedMs):y.set(k.trackUri,{trackUri:k.trackUri,trackName:k.trackName,artistName:k.artistName,artistUri:k.artistUri,albumName:k.albumName,albumUri:k.albumUri,albumArt:Te(k.albumArt),count:1,durationMs:k.playedMs});let oe=Mn(k),Ee=g.get(oe);Ee?(Ee.count++,Ee.durationMs+=k.playedMs):g.set(oe,{name:k.artistName,uri:k.artistUri,count:1,durationMs:k.playedMs});let me=Fo(k),_=b.get(me);_?(_.count++,_.durationMs+=k.playedMs):b.set(me,{name:k.albumName,uri:k.albumUri,artistName:k.artistName,albumArt:Te(k.albumArt),count:1,durationMs:k.playedMs})}let S=Array.from(y.values()).sort(Nn(r)).map((k,z)=>({rank:z+1,...k})),v=Array.from(g.values()).sort(Nn(r)).map((k,z)=>({rank:z+1,artistUri:k.uri,artistName:k.name,count:k.count,durationMs:k.durationMs})),x=Array.from(b.values()).sort(Nn(r)).map((k,z)=>({rank:z+1,albumUri:k.uri,albumName:k.name,artistName:k.artistName,albumArt:k.albumArt,count:k.count,durationMs:k.durationMs})),E=[...l].sort((k,z)=>z.startedAt-k.startedAt).slice(0,Ko).map(k=>({trackUri:k.trackUri,trackName:k.trackName,artistName:k.artistName,albumArt:Te(k.albumArt),playedAt:k.startedAt})),T=l.reduce((k,z)=>k+z.playedMs,0),C=l.length>0?new Set(l.map(k=>ve(k.startedAt))).size:0,D=new Array(24).fill(0);for(let k of l){let z=new Date(k.startedAt).getHours();D[z]++}let K=l.length>0?D.indexOf(Math.max(...D)):0,R=new Array(7).fill(0);for(let k of l){let z=new Date(k.startedAt).getDay(),oe=z===0?6:z-1;R[oe]++}let U=l.length>0?R.indexOf(Math.max(...R)):0,N=new Map;for(let k of f){let z=ve(k.startedAt);N.set(z,(N.get(z)??0)+1)}let Q=Array.from(N.entries()).map(([k,z])=>({date:k,count:z})).sort((k,z)=>k.date.localeCompare(z.date)),j=o.filter(k=>k.type==="skip").length,$=o.length,Z=$>0?j/$:0,H=y.size,de=g.size,ae=v.map(k=>k.artistUri);await $i(ae);let te=await B.artists.where("uri").anyOf(ae).toArray(),pe=new Map(te.map(k=>[k.uri,k]));for(let k of v){let z=pe.get(k.artistUri);z&&(k.genres=z.genres,k.imageUrl=Te(z.imageUrl??void 0)??z.imageUrl??void 0)}let fe=new Map;for(let k of te)for(let z of k.genres)fe.set(z,(fe.get(z)??0)+1);let Re=Array.from(fe.entries()).sort((k,z)=>z[1]-k[1]).map(([k,z],oe)=>({rank:oe+1,genre:k,count:z})),St={topTracks:S,topArtists:v,topAlbums:x,topGenres:Re,totalPlays:l.length,totalDuration:T,listeningDays:C,recentPlays:E,hourlyDistribution:D,peakHour:K,skipRate:Z,uniqueTrackCount:H,uniqueArtistCount:de,streak:h,weekdayDistribution:R,peakWeekday:U,dailyPlayCounts:Q,newArtistCount:p,priorPeriodTotalDuration:u};De.set(n,St);let ze=Gi(e.id);return ze&&this.calculateStats(ze).catch(()=>{}),St}async calculateStatsProgressive(e,r){let n=await this.calculateStats(e);return r(n,1),r(n,2),r(n,3),n}async init(){De.setupInvalidationListeners()}destroy(){De.invalidate()}},qi=new zn;yt();ue();var jo="https://api.stats.fm/api/v1",He=new zt;function Kn(){try{let t=localStorage.getItem(L.STATSFM_HEALTH);if(t)return JSON.parse(t).lastSuccessAt}catch{}return null}function xr(t){try{localStorage.setItem(L.STATSFM_HEALTH,JSON.stringify(t))}catch{}window.dispatchEvent(new CustomEvent(re.STATSFM_HEALTH_CHANGED,{detail:t}))}async function ee(t,e){if(He.isOpen())return xr({lastFetchAt:Date.now(),lastSuccessAt:Kn(),lastError:"Circuit open  -  stats.fm temporarily unavailable",circuitOpen:!0}),{ok:!1,status:0,message:"Circuit open  -  stats.fm temporarily unavailable"};let r=new URL(`${jo}${t}`);if(e)for(let[s,a]of Object.entries(e))r.searchParams.set(s,a);localStorage.getItem(L.LOGGING)==="true"&&console.debug("[statsfm]",r.toString());let n=new AbortController,i=setTimeout(()=>n.abort(),1e4);try{let s=await fetch(r.toString(),{headers:{Accept:"application/json"},signal:n.signal});if(clearTimeout(i),!s.ok)return He.recordFailure(),xr({lastFetchAt:Date.now(),lastSuccessAt:Kn(),lastError:`HTTP ${s.status}`,circuitOpen:He.isOpen()}),{ok:!1,status:s.status,message:`HTTP ${s.status}`};let a=await s.json();return He.recordSuccess(),xr({lastFetchAt:Date.now(),lastSuccessAt:Date.now(),lastError:null,circuitOpen:!1}),{ok:!0,data:a.item??a.items}}catch(s){clearTimeout(i),He.recordFailure();let a=(s instanceof Error||s instanceof DOMException)&&s.name==="AbortError"?"Request timed out after 10s":String(s);return xr({lastFetchAt:Date.now(),lastSuccessAt:Kn(),lastError:a,circuitOpen:He.isOpen()}),(s instanceof Error||s instanceof DOMException)&&s.name==="AbortError"?{ok:!1,status:0,message:"Request timed out after 10s"}:{ok:!1,status:0,message:String(s)}}}async function Zi(t){let e=await ee(`/users/${encodeURIComponent(t)}`);return e.ok?{valid:!0,isPlus:e.data.isPlus,displayName:e.data.displayName}:e.status===404?{valid:!1,reason:"not_found"}:e.status===403?{valid:!1,reason:"private"}:e.status===0&&e.message.includes("Circuit open")?{valid:!1,reason:"circuit_open"}:{valid:!1,reason:"network"}}ue();var wr=class extends Error{constructor(e){super(e.message),this.name="ClassifiedError",this.appError=e}};function Ln(t,e,r){return t===404?{variant:"UserNotFound",message:e,retryable:!1}:t===429||t===0&&e.includes("Circuit open")?{variant:"RateLimited",message:e,retryable:!1,resetAt:r}:t>=500&&t<=599?{variant:"ServiceDown",message:e,retryable:!0}:t===0?{variant:"NetworkError",message:e,retryable:!0}:{variant:"Unknown",message:e,retryable:!0}}Lt();var Ho="statsfm",Vo=1440*60*1e3;function bt(t){let e=new Date(t);return Number.isFinite(e.getTime())?`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`:t.slice(0,10)}function Xi(t){let e=new Set(Object.entries(t).filter(([,a])=>a.count>0).map(([a])=>bt(a)).filter(a=>a.length===10));if(e.size===0)return 0;let r=new Date,n=new Date(r.getFullYear(),r.getMonth(),r.getDate()),i=bt(n.toISOString());if(!e.has(i)&&(n.setDate(n.getDate()-1),!e.has(bt(n.toISOString()))))return 0;let s=0;for(;e.has(bt(n.toISOString()));)s++,n.setDate(n.getDate()-1);return s}function xe(t,e){if(t)return t.startsWith("spotify:")?t:`spotify:${e}:${t}`}function Qi(t){return`${Ho}:${t}`}function ke(t){return t.status==="fulfilled"&&t.value.ok?t.value.data:null}function Sr(t){return t.status==="fulfilled"&&!t.value.ok?{status:t.value.status,message:t.value.message}:t.status==="rejected"?{status:0,message:String(t.reason)}:null}function Go(t){let e=new Map;for(let i of t)for(let s of i.artist.genres)e.set(s,(e.get(s)??0)+ +(i.streams??0));if([...e.values()].some(i=>i>0))return Array.from(e.entries()).sort((i,s)=>s[1]-i[1]).map(([i,s],a)=>({rank:a+1,genre:i,count:s}));let n=new Map;for(let i of t)for(let s of i.artist.genres)n.set(s,(n.get(s)??0)+1);return Array.from(n.entries()).sort((i,s)=>s[1]-i[1]).map(([i,s],a)=>({rank:a+1,genre:i,count:s}))}function Ji(t,e){let r=t??[];if(r.length>0){let n=[...r].sort((s,a)=>a.streams-s.streams).map((s,a)=>({rank:a+1,genre:s.genre.tag,count:+(s.streams??0)}));if(n.reduce((s,a)=>s+a.count,0)>0)return n}return Go(e)}function es(t){let e=new Map;for(let r of t){let n=r.track.albums[0];if(!n)continue;let i=n.name,s=e.get(i),a=r.track.artists[0]?.name??"",o=xe(n.externalIds?.spotify?.[0],"album")??"",l=r.streams??0;s?s.streams+=l:e.set(i,{albumName:n.name,artistName:a,albumArt:n.image,albumUri:o,streams:l})}return Array.from(e.values()).sort((r,n)=>n.streams-r.streams).map((r,n)=>({rank:n+1,albumUri:r.albumUri||`listening-stats:album:${r.albumName}${r.artistName}`,albumName:r.albumName,artistName:r.artistName,albumArt:r.albumArt,count:r.streams,durationMs:0}))}var Bn=class{constructor(){this.config=null}getProviderInfo(){return{id:"statsfm",name:"stats.fm",description:"Stats from stats.fm",capabilities:{hasActivityData:!0,hasConsistencyData:!0,hasGenreData:!0,hasStreakData:!1,hasSkipRate:!1,tier:this.config?.isPlus??!1?"plus":"free"}}}getSupportedPeriods(){return this.config?.isPlus?Vi:nt}async calculateStats(e){if(!this.config&&(await this.init(),!this.config))throw new Error("StatsFmProvider not configured  -  call init() first");let r=Qi(e.id),n=De.get(r);if(n)return n;let s={"sfm-today":"today","sfm-weeks":"weeks","sfm-months":"months","sfm-all-time":"lifetime"}[e.id];if(!s)throw new Error(`Unknown stats.fm period: ${e.id}`);let a={range:s},o=encodeURIComponent(this.config.username),l=this.config.isPlus,c=Intl.DateTimeFormat().resolvedOptions().timeZone,p=Kt(e),u=p?ee(`/users/${o}/top/artists`,{after:String(p.start),before:String(p.end),limit:"200"}):Promise.resolve({ok:!1,status:0,message:"skipped"}),[d,m,f,h,y,g,b,S,v]=await Promise.allSettled([ee(`/users/${o}/top/tracks`,a),ee(`/users/${o}/top/artists`,a),ee(`/users/${o}/top/genres`,a),ee(`/users/${o}/streams/stats`,a),ee(`/users/${o}/streams/recent`,{limit:"12"}),l?ee(`/users/${o}/top/albums`,a):Promise.resolve({ok:!1,status:0,message:"skipped"}),ee(`/users/${o}/streams/stats/per-day`,{range:"lifetime",timeZone:c}),ee(`/users/${o}/streams/stats/dates`,{range:s,timeZone:c}),u]),x=Sr(d),w=Sr(m),E=Sr(h);if(x&&w&&E){let _=He.getResetAt()??void 0;throw new wr(Ln(x.status,x.message,_))}let T=ke(d)??[],C=ke(m)??[],D=ke(f)??[],K=ke(v)??[],R=0;if(p){let _=new Set(C.map(G=>G.artist.externalIds?.spotify?.[0]).filter(G=>!!G));if(K.length>0){let G=new Set(K.map(A=>A.artist.externalIds?.spotify?.[0]).filter(A=>!!A)),O=0;for(let A of _)G.has(A)||O++;R=O}else R=_.size}let U=ke(h),N=ke(y)??[],Q=ke(g)??[],j=ke(b),$=j?.days?Object.values(j.days).filter(_=>_.count>0).length:void 0,Z=j?.days?Xi(j.days):0,H=j?.days?Object.entries(j.days).map(([_,G])=>({date:bt(_),count:G.count})).sort((_,G)=>_.date.localeCompare(G.date)):void 0,de;if(p&&j?.days){let _=0;for(let[G,O]of Object.entries(j.days)){let A=new Date(G).getTime();Number.isFinite(A)&&A>=p.start&&A<p.end&&(_+=O.durationMs)}_>0&&(de=_)}let ae=ke(S),te=new Array(24).fill(0);if(ae?.hours)for(let[_,G]of Object.entries(ae.hours)){let O=Number(_);O>=0&&O<24&&(te[O]=G.count)}let pe=te.reduce((_,G,O,A)=>G>A[_]?O:_,0),fe,Re;if(ae!=null&&(Object.keys(ae.hours??{}).length>0||Object.keys(ae.weekDays??{}).length>0)&&ae?.weekDays){fe=new Array(7).fill(0);for(let[_,G]of Object.entries(ae.weekDays)){let O=Number(_)-1;O>=0&&O<7&&(fe[O]=G.count)}Re=fe.reduce((_,G,O,A)=>G>A[_]?O:_,0)}let ze=T.map(_=>{let G=_.streams??0;return{rank:_.position,trackUri:xe(_.track.externalIds?.spotify?.[0],"track")??`listening-stats:track:${_.track.name}${_.track.artists[0]?.name??""}`,trackName:_.track.name,artistName:_.track.artists[0]?.name??"",artistUri:xe(_.track.artists[0]?.externalIds?.spotify?.[0],"artist")??`listening-stats:artist:${_.track.artists[0]?.name??""}`,albumName:_.track.albums[0]?.name??"",albumUri:xe(_.track.albums[0]?.externalIds?.spotify?.[0],"album")??"",albumArt:_.track.albums[0]?.image,count:G,durationMs:_.playedMs??(_.track.durationMs??0)*G}}),k=C.map(_=>({rank:_.position,artistUri:xe(_.artist.externalIds?.spotify?.[0],"artist")??`listening-stats:artist:${_.artist.name}`,artistName:_.artist.name,count:_.streams??0,durationMs:_.playedMs??0,genres:_.artist.genres,imageUrl:_.artist.image??null})),z=l?Q.map(_=>({rank:_.position,albumUri:xe(_.album.externalIds?.spotify?.[0],"album")??`listening-stats:album:${_.album.name}${_.album.artists[0]?.name??""}`,albumName:_.album.name,artistName:_.album.artists[0]?.name??"",albumArt:_.album.image,count:_.streams??0,durationMs:0})):es(T),oe=Ji(D,C),Ee=N.map(_=>({trackUri:xe(_.track.externalIds?.spotify?.[0],"track")??`listening-stats:track:${_.track.name}${_.track.artists[0]?.name??""}`,trackName:_.track.name,artistName:_.track.artists[0]?.name??"",albumArt:_.track.albums[0]?.image,playedAt:new Date(_.endTime).getTime()||Date.now()})),me={topTracks:ze,topArtists:k,topAlbums:z,topGenres:oe,totalPlays:U?.count??0,totalDuration:U?.durationMs??0,recentPlays:Ee,hourlyDistribution:te,peakHour:pe,skipRate:0,uniqueTrackCount:U?.cardinality.tracks??0,uniqueArtistCount:U?.cardinality.artists??0,streak:Z,listeningDays:$,weekdayDistribution:fe,peakWeekday:Re,dailyPlayCounts:H,newArtistCount:R,priorPeriodTotalDuration:de,isFreeTier:!l&&ze.every(_=>_.count===0)};return De.set(r,me),me}async calculateStatsProgressive(e,r){if(!this.config&&(await this.init(),!this.config))throw new Error("StatsFmProvider not configured  -  call init() first");let n=Qi(e.id),i=De.get(n);if(i)return r(i,1),r(i,2),r(i,3),i;let a={"sfm-today":"today","sfm-weeks":"weeks","sfm-months":"months","sfm-all-time":"lifetime"}[e.id];if(!a)throw new Error(`Unknown stats.fm period: ${e.id}`);let o={range:a},l=encodeURIComponent(this.config.username),c=this.config.isPlus,p=Intl.DateTimeFormat().resolvedOptions().timeZone,u=Kt(e),d=u?ee(`/users/${l}/top/artists`,{after:String(u.start),before:String(u.end),limit:"200"}):Promise.resolve({ok:!1,status:0,message:"skipped"}),m=ee(`/users/${l}/streams/stats`,o),f=ee(`/users/${l}/streams/recent`,{limit:"12"}),h=ee(`/users/${l}/top/tracks`,o),y=ee(`/users/${l}/top/artists`,o),g=ee(`/users/${l}/top/genres`,o),b=c?ee(`/users/${l}/top/albums`,o):Promise.resolve({ok:!1,status:0,message:"skipped"}),S=ee(`/users/${l}/streams/stats/per-day`,{range:"lifetime",timeZone:p}),v=ee(`/users/${l}/streams/stats/dates`,{range:a,timeZone:p}),[x,w]=await Promise.allSettled([m,f]),E=ke(x),C=(ke(w)??[]).map(O=>({trackUri:xe(O.track.externalIds?.spotify?.[0],"track")??`listening-stats:track:${O.track.name}${O.track.artists[0]?.name??""}`,trackName:O.track.name,artistName:O.track.artists[0]?.name??"",albumArt:O.track.albums[0]?.image,playedAt:new Date(O.endTime).getTime()||Date.now()}));r({totalPlays:E?.count??0,totalDuration:E?.durationMs??0,uniqueTrackCount:E?.cardinality.tracks??0,uniqueArtistCount:E?.cardinality.artists??0,skipRate:0,recentPlays:C},1);let D=[],K=[],R=[],U=null,N=[],Q=[],j=[],$=[],Z=[],H,de,ae,te,pe,fe=!u,Re=()=>{if(!u){te=0,r({newArtistCount:te},2);return}if(!fe)return;if(K.length===0){te=0,r({newArtistCount:te},2);return}let O=new Set(K.map(A=>A.artist.externalIds?.spotify?.[0]).filter(A=>!!A));if(N.length>0){let A=new Set(N.map(J=>J.artist.externalIds?.spotify?.[0]).filter(J=>!!J)),Y=0;for(let J of O)A.has(J)||Y++;te=Y}else te=O.size;r({newArtistCount:te},2)},St=[h.then(O=>{D=O.ok?O.data:[],Q=D.map(A=>{let Y=A.streams??0;return{rank:A.position,trackUri:xe(A.track.externalIds?.spotify?.[0],"track")??`listening-stats:track:${A.track.name}${A.track.artists[0]?.name??""}`,trackName:A.track.name,artistName:A.track.artists[0]?.name??"",artistUri:xe(A.track.artists[0]?.externalIds?.spotify?.[0],"artist")??`listening-stats:artist:${A.track.artists[0]?.name??""}`,albumName:A.track.albums[0]?.name??"",albumUri:xe(A.track.albums[0]?.externalIds?.spotify?.[0],"album")??"",albumArt:A.track.albums[0]?.image,count:Y,durationMs:A.playedMs??(A.track.durationMs??0)*Y}}),r({topTracks:Q},2),c||($=es(D),r({topAlbums:$},2))}),Promise.all([y,g]).then(([O,A])=>{K=O.ok?O.data:[],j=K.map(J=>({rank:J.position,artistUri:xe(J.artist.externalIds?.spotify?.[0],"artist")??`listening-stats:artist:${J.artist.name}`,artistName:J.artist.name,count:J.streams??0,durationMs:J.playedMs??0,genres:J.artist.genres,imageUrl:J.artist.image??null})),r({topArtists:j},2);let Y=A.ok?A.data:null;Z=Ji(Y,K),r({topGenres:Z},2),Re()}),b.then(O=>{c&&(R=O.ok?O.data:[],$=R.map(A=>({rank:A.position,albumUri:xe(A.album.externalIds?.spotify?.[0],"album")??`listening-stats:album:${A.album.name}${A.album.artists[0]?.name??""}`,albumName:A.album.name,artistName:A.album.artists[0]?.name??"",albumArt:A.album.image,count:A.streams??0,durationMs:0})),r({topAlbums:$},2))}),S.then(O=>{if(U=O.ok?O.data:null,de=U?.days?Object.values(U.days).filter(A=>A.count>0).length:void 0,H=U?.days?Xi(U.days):0,ae=U?.days?Object.entries(U.days).map(([A,Y])=>({date:bt(A),count:Y.count})).sort((A,Y)=>A.date.localeCompare(Y.date)):void 0,u&&U?.days){let A=0;for(let[Y,J]of Object.entries(U.days)){let Or=new Date(Y).getTime();Number.isFinite(Or)&&Or>=u.start&&Or<u.end&&(A+=J.durationMs)}A>0&&(pe=A)}r({streak:H,listeningDays:de,dailyPlayCounts:ae,priorPeriodTotalDuration:pe},2)}),d.then(O=>{N=O.ok?O.data:[],fe=!0,Re()})];await Promise.allSettled(St);let[ze]=await Promise.allSettled([v]),k=Sr(ze),z=ke(ze),oe=new Array(24).fill(0);if(z?.hours)for(let[O,A]of Object.entries(z.hours)){let Y=Number(O);Y>=0&&Y<24&&(oe[Y]=A.count)}let Ee=oe.reduce((O,A,Y,J)=>A>J[O]?Y:O,0),me,_;if(z!=null&&(Object.keys(z.hours??{}).length>0||Object.keys(z.weekDays??{}).length>0)&&z?.weekDays){me=new Array(7).fill(0);for(let[O,A]of Object.entries(z.weekDays)){let Y=Number(O)-1;Y>=0&&Y<7&&(me[Y]=A.count)}_=me.reduce((O,A,Y,J)=>A>J[O]?Y:O,0)}return k?r({hourlyDistribution:new Array(24).fill(0),peakHour:0},3,Ln(k.status,k.message)):r({hourlyDistribution:oe,peakHour:Ee,weekdayDistribution:me,peakWeekday:_},3),{topTracks:Q,topArtists:j,topAlbums:$,topGenres:Z,totalPlays:E?.count??0,totalDuration:E?.durationMs??0,recentPlays:C,hourlyDistribution:oe,peakHour:Ee,skipRate:0,uniqueTrackCount:E?.cardinality.tracks??0,uniqueArtistCount:E?.cardinality.artists??0,streak:H,listeningDays:de,weekdayDistribution:me,peakWeekday:_,dailyPlayCounts:ae,newArtistCount:te,priorPeriodTotalDuration:pe,isFreeTier:!c&&Q.every(O=>O.count===0)}}async init(){let e=localStorage.getItem(L.STATSFM_CONFIG);if(!e)return;try{let n=JSON.parse(e);if(typeof n?.username!="string"||!n.username)throw new Error("invalid stats.fm config shape");typeof n.lastValidated!="number"&&(n.lastValidated=0),this.config=n}catch(n){console.warn("[listening-stats] Discarding invalid stats.fm config:",n),localStorage.removeItem(L.STATSFM_CONFIG),this.config=null;return}if(Date.now()-this.config.lastValidated>Vo){let n=await Zi(this.config.username);n.valid&&(this.config.isPlus=n.isPlus,this.config.lastValidated=Date.now(),localStorage.setItem(L.STATSFM_CONFIG,JSON.stringify(this.config)))}}destroy(){De.invalidate()}},ts=new Bn;ue();Lt();var vt={enabled:!1,trackCount:10,providerId:"local",periodId:"this-week",isPublic:!1},Yo=new Set(["today","sfm-today"]);function Wo(t){return(t==="statsfm"?nt:rt).filter(r=>!Yo.has(r.id))}function rs(t){let e=Wo(t.providerId);return e.find(r=>r.id===t.periodId)??e[0]}function Fn(){try{let t=localStorage.getItem(L.PLAYLIST_CONFIG);if(!t)return{...vt};let e=JSON.parse(t);return{enabled:typeof e.enabled=="boolean"?e.enabled:vt.enabled,trackCount:typeof e.trackCount=="number"&&e.trackCount>0?e.trackCount:vt.trackCount,providerId:e.providerId==="statsfm"?"statsfm":"local",periodId:typeof e.periodId=="string"?e.periodId:vt.periodId,isPublic:typeof e.isPublic=="boolean"?e.isPublic:vt.isPublic}}catch{return{...vt}}}function kr(){try{let t=localStorage.getItem(L.PLAYLIST_STATE);if(!t)return{playlistUri:null,lastBuiltDay:null};let e=JSON.parse(t);return{playlistUri:typeof e.playlistUri=="string"?e.playlistUri:null,lastBuiltDay:typeof e.lastBuiltDay=="string"?e.lastBuiltDay:null}}catch{return{playlistUri:null,lastBuiltDay:null}}}function ns(t){let e={...kr(),...t};try{localStorage.setItem(L.PLAYLIST_STATE,JSON.stringify(e))}catch{}}function qo(t){return new Promise((e,r)=>{let n=new Image;n.crossOrigin="anonymous",n.onload=()=>e(n),n.onerror=()=>r(new Error(`cover art failed to load: ${t}`)),n.src=t})}async function is(t,e){let r=document.createElement("canvas");r.width=640,r.height=640;let n=r.getContext("2d");if(!n)throw new Error("canvas 2d context unavailable");let i=null;if(t&&(i=await qo(t).catch(()=>null)),i)n.drawImage(i,0,0,640,640);else{let o=n.createLinearGradient(0,0,640,640);o.addColorStop(0,"#1e3264"),o.addColorStop(1,"#121212"),n.fillStyle=o,n.fillRect(0,0,640,640)}let s=n.createLinearGradient(0,640*.55,0,640);s.addColorStop(0,"rgba(0,0,0,0)"),s.addColorStop(1,"rgba(0,0,0,0.85)"),n.fillStyle=s,n.fillRect(0,0,640,640),n.fillStyle="#ffffff",n.textBaseline="alphabetic",n.font="600 36px CircularSp, 'Helvetica Neue', Arial, sans-serif",n.fillText("Listening Stats",40,544);let a=64;for(n.font=`700 ${a}px CircularSp, 'Helvetica Neue', Arial, sans-serif`;a>24&&n.measureText(e).width>560;)a-=4,n.font=`700 ${a}px CircularSp, 'Helvetica Neue', Arial, sans-serif`;return n.fillText(e,40,604),r.toDataURL("image/jpeg",.9)}var ss=100;function Zo(){let t=globalThis.Spicetify?.Platform;return!t?.RootlistAPI?.createPlaylist||!t?.PlaylistAPI?.add?null:{rootlist:t.RootlistAPI,playlist:t.PlaylistAPI}}async function Xo(t,e){let r=kr().playlistUri;if(r)try{return await Spicetify.Platform.PlaylistAPI.getMetadata(r),r}catch{}let n=await t.createPlaylist(e,{before:"start"}),i=typeof n=="string"?n:n?.uri;if(!i)throw new Error("createPlaylist returned no URI");return i}async function Qo(t,e,r){if(typeof t.clear=="function")await t.clear(e);else for(;;){let n=await t.getContents(e,{limit:ss,offset:0});if(!n.items.length||(await t.remove(e,n.items.map(({uri:i,uid:s})=>({uri:i,uid:s}))),n.items.length<ss))break}await t.add(e,r,{after:"end"})}async function Jo(t,e,r){if(typeof t.uploadImage!="function")return;let n=Spicetify.Platform.Session?.accessToken;if(!n)return;let i=await(await fetch(r)).blob(),s=new File([i],"cover.jpg",{type:"image/jpeg"}),a=await t.uploadImage(s),o=e.split(":").pop(),l=await fetch(`https://spclient.wg.spotify.com/playlist/v2/playlist/${o}/register-image`,{method:"POST",headers:{Authorization:`Bearer ${n}`,"Content-Type":"application/json"},body:JSON.stringify({uploadToken:a})});if(!l.ok)throw new Error(`register-image failed: ${l.status}`);let c=await l.arrayBuffer(),p=[...new Uint8Array(c)].map(d=>d.toString(16).padStart(2,"0")).join(""),u=p.startsWith("0a14")?p.slice(4):p;await t.setAttributes(e,{picture:u}),typeof t.resync=="function"&&await t.resync(e)}async function el(t,e){let r=Spicetify.Platform.PlaylistPermissionsAPI;if(typeof r?.setBasePermission=="function")try{await r.setBasePermission(t,e?"VIEWER":"BLOCKED")}catch(n){console.warn("[listening-stats] playlist visibility update failed:",n)}}var _r=null;function tl(){return _r||(_r=rl().finally(()=>{_r=null})),_r}async function rl(){let t=Fn();if(!t.enabled)return{status:"skipped",reason:"disabled"};let e=Zo();if(!e)return{status:"error",message:"Spotify playlist APIs unavailable in this client version"};try{let r=rs(t),s=(await(t.providerId==="statsfm"?ts:qi).calculateStats(r)).topTracks.filter(l=>l.trackUri.startsWith("spotify:track:")).slice(0,t.trackCount);if(s.length===0)return{status:"skipped",reason:"no-tracks"};let a=`Listening Stats \xB7 ${r.label}`,o=await Xo(e.rootlist,a);await Qo(e.playlist,o,s.map(l=>l.trackUri)),await e.playlist.setAttributes(o,{name:a,description:`Your top ${s.length} tracks (${r.label.toLowerCase()}) - auto-updated daily by Listening Stats`}),await el(o,t.isPublic);try{let l=await is(s[0].albumArt,r.label);await Jo(e.playlist,o,l)}catch(l){console.warn("[listening-stats] playlist cover update failed:",l)}return ns({playlistUri:o,lastBuiltDay:ve(Date.now())}),{status:"built",playlistUri:o,trackCount:s.length}}catch(r){let n=r instanceof Error?r.message:String(r);return console.error("[listening-stats] playlist build failed:",r),{status:"error",message:n}}}async function Un(){Fn().enabled&&kr().lastBuiltDay!==ve(Date.now())&&await tl()}var nl=6e4;function as(){let t=ve(Date.now());Un().catch(e=>{console.error("[listening-stats] playlist scheduler run failed:",e)}),setInterval(()=>{let e=ve(Date.now());e!==t&&(t=e,Un().catch(r=>{console.error("[listening-stats] playlist scheduler run failed:",r)}))},nl)}ue();Tn();Ne();var Pr="listening-stats-backup";async function il(){let t=await B.playEvents.toArray();return{version:1,exportedAt:Date.now(),fromDbVersion:B.verno,count:t.length,events:t}}async function os(t){if(t.version!==1)throw new Error("Unknown export format version");await B.transaction("rw",B.playEvents,async()=>{await B.playEvents.clear(),await B.playEvents.bulkAdd(t.events)})}async function Er(){let t=await il();if(t.count===0)return;await Pe.delete(Pr);let e=new Pe(Pr);e.version(1).stores({snapshots:""}),await e.open(),await e.table("snapshots").put(t,"latest"),e.close()}async function ls(){try{let t=new Pe(Pr);t.version(1).stores({snapshots:""}),await t.open();let e=await t.table("snapshots").get("latest");return t.close(),e??null}catch{return null}}async function cs(){try{let t=new Pe(Pr);t.version(1).stores({snapshots:""}),await t.open();let e=await t.table("snapshots").count();return t.close(),e>0}catch{return!1}}Ne();ue();Ne();async function us(){if(!localStorage.getItem(L.LAST_WRITE))return{ok:!0,wipeDetected:!1,backupAvailable:!1,restored:!1};let e;try{e=await B.playEvents.count()}catch{return{ok:!1,wipeDetected:!1,backupAvailable:!1,restored:!1,warning:"DB not openable"}}if(e>0)return{ok:!0,wipeDetected:!1,backupAvailable:!1,restored:!1};if(await cs()){let n=await ls();if(n)return await os(n),{ok:!0,wipeDetected:!0,backupAvailable:!0,restored:!0}}return{ok:!1,wipeDetected:!0,backupAvailable:!1,restored:!1,warning:"Data was wiped externally and no backup exists"}}ue();Ne();var sl=5;async function al(t){t>=sl||t===0||await Er()}async function ol(){try{if(typeof indexedDB.databases=="function")return(await indexedDB.databases()).find(r=>r.name==="listening-stats")?.version??0}catch{}return B.isOpen()?B.verno:0}async function ds(){if(!B.isOpen()){let t=await ol();await al(t),localStorage.setItem(L.MIGRATION_PENDING,"1");try{await B.open(),localStorage.removeItem(L.MIGRATION_PENDING)}catch(e){console.error("[listening-stats] DB upgrade failed, will retry on next open",e)}}return B}Ne();async function ps(t){let e=Math.floor(t.startedAt/3e3)*3e3,r=e+3e3;return B.transaction("rw",B.playEvents,async()=>await B.playEvents.where("startedAt").between(e,r).filter(i=>i.trackUri===t.trackUri).count()>0?null:await B.playEvents.add(t)??null)}async function fs(t,e,r){await B.playEvents.update(t,{playedMs:e,endedAt:r})}yt();ue();function ll(t,e,r){return e<=0?"skip":t/e>=.9||t>=r?"play":"skip"}function cl(t){if(t.provider==="narration"||t.provider==="ad")return!1;let e=t.uri??"";return!(e.startsWith("spotify:narration:")||e.startsWith("spotify:ad:")||e.startsWith("spotify:interruption:"))}function ul(t){if(!t.startsWith("spotify:local:"))return null;let e=t.split(":"),r=n=>{if(!n)return"";let i=n.replace(/\+/g," ");try{return decodeURIComponent(i)}catch{return i}};return{artist:r(e[2]),album:r(e[3]),title:r(e[4])}}var Ar=class t{constructor(e){this._crossWritePromise=null;this._deps=e,this._state=t._initialState()}static _initialState(){return{state:"idle",trackUri:null,playStartTime:null,accumulatedPlayMs:0,isPlaying:!1,durationMs:0,capturedData:null,lastProgressMs:0,lastLoopDetectedAt:0,lastRecordedUri:null,recordedEventId:null}}get state(){return this._state.state}getSnapshot(){return{...this._state,capturedData:this._state.capturedData?{...this._state.capturedData}:null}}async handleSongChange(e){if(this._state.state==="tracking"&&this._state.capturedData&&(this._state.state="completing",await this._finalizePlayEvent(this._totalPlayedMs())),this._state.lastProgressMs=0,e?.item&&cl(e.item)){let r=e.item,n=r.metadata,i=ul(r.uri),s=r.name||n?.title||i?.title||"Unknown Track",a=n?.artist_name||i?.artist||"Unknown Artist",o=n?.album_title||i?.album||"Unknown Album",l=n?.artist_uri||"",c=n?.album_uri||"";i&&(l||(l=`local:artist:${a.toLowerCase()}`),c||(c=`local:album:${a.toLowerCase()}:${o.toLowerCase()}`)),this._state.capturedData={trackUri:r.uri,trackName:s,artistName:a,artistUri:l,albumName:o,albumUri:c,albumArt:Te(n?.image_url||n?.image_xlarge_url),durationMs:r.duration?.milliseconds||0,startedAt:Date.now()},this._state.trackUri=r.uri,this._state.durationMs=r.duration?.milliseconds||0,this._state.playStartTime=Date.now(),this._state.accumulatedPlayMs=0,this._state.isPlaying=!e.isPaused,this._state.recordedEventId=null,this._state.state="tracking",await this._maybeRecordThresholdCross()}else this._state={...t._initialState(),lastRecordedUri:this._state.lastRecordedUri}}handlePlayPause(e){let r=this._state.isPlaying;r&&e?(this._state.playStartTime!==null&&(this._state.accumulatedPlayMs+=Date.now()-this._state.playStartTime),this._state.isPlaying=!1,this._maybeRecordThresholdCross()):!r&&!e&&(this._state.playStartTime=Date.now(),this._state.isPlaying=!0)}handleProgress(e,r,n){if(n===2&&r>0&&this._state.state==="tracking"){let i=this._state.lastProgressMs>r*.9,s=e<r*.1,a=Date.now()-this._state.lastLoopDetectedAt>=2e3;i&&s&&a&&(this._state.lastLoopDetectedAt=Date.now(),this._finalizePlayEvent(this._totalPlayedMs()).then(()=>{this._state.accumulatedPlayMs=0,this._state.recordedEventId=null,this._state.isPlaying&&(this._state.playStartTime=Date.now()),this._state.capturedData&&(this._state.capturedData={...this._state.capturedData,startedAt:Date.now()})}))}this._state.lastProgressMs=e,this._maybeRecordThresholdCross()}destroy(){}_totalPlayedMs(){return this._state.accumulatedPlayMs+(this._state.isPlaying&&this._state.playStartTime!==null?Date.now()-this._state.playStartTime:0)}async _maybeRecordThresholdCross(){if(this._state.state!=="tracking"||!this._state.capturedData||this._state.recordedEventId!==null||this._crossWritePromise!==null||this._deps.isTrackingPaused())return;let e=this._state.capturedData.durationMs;if(e<=0)return;let r=Math.min(this._deps.resolveThresholdMs(e),e*.9);if(this._totalPlayedMs()<r||this._deps.isSkipRepeatsEnabled()&&this._state.capturedData.trackUri===this._state.lastRecordedUri)return;let n=(async()=>{try{let i=await this._writeEvent("play",this._totalPlayedMs());this._state.recordedEventId=i??0}catch(i){console.warn("[listening-stats] Failed to write play event:",i)}})();this._crossWritePromise=n;try{await n}finally{this._crossWritePromise=null}}async _finalizePlayEvent(e){if(!this._state.capturedData)return;if(this._crossWritePromise!==null&&await this._crossWritePromise,this._state.recordedEventId!==null){if(this._state.recordedEventId>0)try{await this._deps.updatePlayEvent(this._state.recordedEventId,e,Date.now())}catch(i){console.warn("[listening-stats] Failed to update play event:",i)}return}if(this._deps.isTrackingPaused()){this._deps.dispatchEvent(new CustomEvent(re.TRACKING_PAUSED));return}let r=this._deps.resolveThresholdMs(this._state.capturedData.durationMs),n=ll(e,this._state.capturedData.durationMs,r);if(!(n==="play"&&this._deps.isSkipRepeatsEnabled()&&this._state.capturedData.trackUri===this._state.lastRecordedUri))try{await this._writeEvent(n,e)}catch(i){console.warn("[listening-stats] Failed to write play event:",i)}}async _writeEvent(e,r){if(!this._state.capturedData)return null;let n={trackUri:this._state.capturedData.trackUri,trackName:this._state.capturedData.trackName,artistName:this._state.capturedData.artistName,artistUri:this._state.capturedData.artistUri,albumName:this._state.capturedData.albumName,albumUri:this._state.capturedData.albumUri,albumArt:this._state.capturedData.albumArt,durationMs:this._state.capturedData.durationMs,playedMs:r,startedAt:this._state.capturedData.startedAt,endedAt:Date.now(),type:e},i=await this._deps.addPlayEvent(n);if(i!==null){e==="play"&&this._deps.isSkipRepeatsEnabled()&&(this._state.lastRecordedUri=this._state.capturedData.trackUri);let s=e==="play"?re.PLAY_RECORDED:re.SKIP_RECORDED;this._deps.dispatchEvent(new CustomEvent(s,{detail:n})),localStorage.getItem(L.LOGGING)==="true"&&console.log(`[listening-stats] ${e}: "${n.trackName}" by ${n.artistName} (${Math.round(n.playedMs/1e3)}s)`)}return i}};yt();ue();var Tr=class{constructor(){this._state={healthy:!0,lastWriteAt:null,lastTrackName:null,errorCount:0,lastError:null}}getHealth(){return{...this._state}}recordSuccess(e){this._state.healthy=!0,this._state.lastWriteAt=Date.now(),this._state.lastTrackName=e,this._state.errorCount=0,this._state.lastError=null,this.publish()}recordFailure(e){this._state.healthy=!1,this._state.errorCount+=1,this._state.lastError=e,this.publish()}publish(){try{localStorage.setItem(L.TRACKING_HEALTH,JSON.stringify(this._state))}catch{}window.dispatchEvent(new CustomEvent(re.HEALTH_CHANGED,{detail:{...this._state}}))}};ue();var dl=3e4,pl=25;function fl(){try{let t=localStorage.getItem(L.PLAY_THRESHOLD);if(t!==null){let e=parseInt(t,10);if(!Number.isNaN(e)&&e>=0&&e<=6e4)return e}}catch{}return dl}function ml(){try{let t=localStorage.getItem(L.PLAY_THRESHOLD_PERCENT);if(t!==null){let e=parseInt(t,10);if(!Number.isNaN(e)&&e>=0&&e<=100)return e}}catch{}return pl}function hl(){try{return localStorage.getItem(L.PLAY_THRESHOLD_MODE)==="percent"?"percent":"seconds"}catch{return"seconds"}}function ms(t){return hl()==="percent"?t<=0?Number.POSITIVE_INFINITY:Math.round(t*ml()/100):fl()}function hs(){try{return localStorage.getItem(L.TRACKING_PAUSED)==="1"}catch{return!1}}function gs(){try{return localStorage.getItem(L.SKIP_REPEATS)==="1"}catch{return!1}}var Dr=class{constructor(e){this._intervalId=null;this._visibilityHandler=null;this.config={intervalMs:e.intervalMs??3e5,sentinelKey:e.sentinelKey??"__lsSongHandler",onReRegister:e.onReRegister,pingDb:e.pingDb}}start(){this._intervalId!==null&&clearInterval(this._intervalId),this._intervalId=setInterval(()=>{window[this.config.sentinelKey]||this.config.onReRegister()},this.config.intervalMs),this._visibilityHandler!==null&&document.removeEventListener("visibilitychange",this._visibilityHandler),this._visibilityHandler=()=>{document.visibilityState==="visible"&&(window[this.config.sentinelKey]||this.config.onReRegister(),this.config.pingDb().catch(()=>{}))},document.addEventListener("visibilitychange",this._visibilityHandler)}stop(){this._intervalId!==null&&(clearInterval(this._intervalId),this._intervalId=null),this._visibilityHandler!==null&&(document.removeEventListener("visibilitychange",this._visibilityHandler),this._visibilityHandler=null)}};var Bt=null,xt=null,ys=null;async function vs(){let t=window;if(t.__lsPollerInitialized)return;t.__lsPollerInitialized=!0,xt=new Tr,Bi(()=>{xt?.recordFailure("DB connection closed  -  version upgrade in another tab")}),await ds();let e=await us();e.wipeDetected&&(e.restored?xt.recordSuccess("Restored from backup after external wipe"):xt.recordFailure(e.warning??"External data wipe detected  -  play history lost")),e.ok&&Er().catch(()=>{});let r=async i=>{try{let s=await ps(i);return s!==null&&(xt?.recordSuccess(i.trackName),localStorage.setItem(L.LAST_WRITE,String(Date.now()))),s}catch(s){throw xt?.recordFailure(s instanceof Error?s.message:String(s)),s}};Bt=new Ar({addPlayEvent:r,updatePlayEvent:fs,resolveThresholdMs:ms,isTrackingPaused:hs,isSkipRepeatsEnabled:gs,dispatchEvent:i=>window.dispatchEvent(i)}),bs();let n=globalThis.Spicetify?.Player?.data;n&&n.item&&Bt.handleSongChange(n).catch(i=>{console.warn("[listening-stats] initial song capture error:",i)}),ys=new Dr({intervalMs:3e5,sentinelKey:"__lsSongHandler",onReRegister:bs,pingDb:()=>B.playEvents.count().then(()=>{})}),ys.start()}function bs(){let t=window,e=globalThis.Spicetify?.Player;if(!e?.addEventListener)return;if(e.removeEventListener){let s=t.__lsSongHandler,a=t.__lsPauseHandler,o=t.__lsProgressHandler;s&&e.removeEventListener("songchange",s),a&&e.removeEventListener("onplaypause",a),o&&e.removeEventListener("onprogress",o)}let r=()=>{Bt?.handleSongChange(e.data).catch(s=>{console.warn("[listening-stats] songchange error:",s)})},n=()=>{let s=e.data;Bt?.handlePlayPause(s?.isPaused??!0)},i=()=>{Bt?.handleProgress(e.getProgress?.()??0,e.getDuration?.()??0,e.getRepeat?.()??0)};e.addEventListener("songchange",r),e.addEventListener("onplaypause",n),e.addEventListener("onprogress",i),t.__lsSongHandler=r,t.__lsPauseHandler=n,t.__lsProgressHandler=i}var Vs=100,Gs=3e4;(function(){let e=Date.now(),r=!1;function n(){let i=globalThis.Spicetify;if(!i?.Player?.addEventListener||!i.React||!i.ReactDOM){if(Date.now()-e>Gs){console.error("[listening-stats] Spicetify init timeout: Player API not found after 30s");return}setTimeout(n,Vs);return}if(r||(r=!0,Promise.resolve().then(()=>(Hs(),js)).then(({mountPlaybarWidget:s})=>s()).catch(s=>{console.error("[listening-stats] playbar widget mount error:",s)})),!globalThis.Spicetify?.Player?.data?.item){if(Date.now()-e>Gs){console.warn("[listening-stats] Spicetify init timeout: Player data not loaded after 30s");return}setTimeout(n,Vs);return}console.log("[listening-stats] extension loaded, initializing tracker"),vs().catch(s=>{console.error("[listening-stats] tracker init error:",s)}),as()}n()})();})();
