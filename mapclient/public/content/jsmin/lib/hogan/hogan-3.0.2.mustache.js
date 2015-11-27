/*!
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Hogan={};(function(e){function t(e,t,n){var r;return t&&typeof t=="object"&&(t[e]!==undefined?r=t[e]:n&&t.get&&typeof t.get=="function"&&(r=t.get(e))),r}function n(e,t,n,r,i,s){function o(){}function u(){}o.prototype=e,u.prototype=e.subs;var a,f=new o;f.subs=new u,f.subsText={},f.buf="",r=r||{},f.stackSubs=r,f.subsText=s;for(a in t)r[a]||(r[a]=t[a]);for(a in r)f.subs[a]=r[a];i=i||{},f.stackPartials=i;for(a in n)i[a]||(i[a]=n[a]);for(a in i)f.partials[a]=i[a];return f}function f(e){return String(e===null||e===undefined?"":e)}function l(e){return e=f(e),a.test(e)?e.replace(r,"&amp;").replace(i,"&lt;").replace(s,"&gt;").replace(o,"&#39;").replace(u,"&quot;"):e}e.Template=function(e,t,n,r){e=e||{},this.r=e.code||this.r,this.c=n,this.options=r||{},this.text=t||"",this.partials=e.partials||{},this.subs=e.subs||{},this.buf=""},e.Template.prototype={r:function(e,t,n){return""},v:l,t:f,render:function(t,n,r){return this.ri([t],n||{},r)},ri:function(e,t,n){return this.r(e,t,n)},ep:function(e,t){var r=this.partials[e],i=t[r.name];if(r.instance&&r.base==i)return r.instance;if(typeof i=="string"){if(!this.c)throw new Error("No compiler available.");i=this.c.compile(i,this.options)}if(!i)return null;this.partials[e].base=i;if(r.subs){t.stackText||(t.stackText={});for(key in r.subs)t.stackText[key]||(t.stackText[key]=this.activeSub!==undefined&&t.stackText[this.activeSub]?t.stackText[this.activeSub]:this.text);i=n(i,r.subs,r.partials,this.stackSubs,this.stackPartials,t.stackText)}return this.partials[e].instance=i,i},rp:function(e,t,n,r){var i=this.ep(e,n);return i?i.ri(t,n,r):""},rs:function(e,t,n){var r=e[e.length-1];if(!c(r)){n(e,t,this);return}for(var i=0;i<r.length;i++)e.push(r[i]),n(e,t,this),e.pop()},s:function(e,t,n,r,i,s,o){var u;return c(e)&&e.length===0?!1:(typeof e=="function"&&(e=this.ms(e,t,n,r,i,s,o)),u=!!e,!r&&u&&t&&t.push(typeof e=="object"?e:t[t.length-1]),u)},d:function(e,n,r,i){var s,o=e.split("."),u=this.f(o[0],n,r,i),a=this.options.modelGet,f=null;if(e==="."&&c(n[n.length-2]))u=n[n.length-1];else for(var l=1;l<o.length;l++)s=t(o[l],u,a),s!==undefined?(f=u,u=s):u="";return i&&!u?!1:(!i&&typeof u=="function"&&(n.push(f),u=this.mv(u,n,r),n.pop()),u)},f:function(e,n,r,i){var s=!1,o=null,u=!1,a=this.options.modelGet;for(var f=n.length-1;f>=0;f--){o=n[f],s=t(e,o,a);if(s!==undefined){u=!0;break}}return u?(!i&&typeof s=="function"&&(s=this.mv(s,n,r)),s):i?!1:""},ls:function(e,t,n,r,i){var s=this.options.delimiters;return this.options.delimiters=i,this.b(this.ct(f(e.call(t,r)),t,n)),this.options.delimiters=s,!1},ct:function(e,t,n){if(this.options.disableLambda)throw new Error("Lambda features disabled.");return this.c.compile(e,this.options).render(t,n)},b:function(e){this.buf+=e},fl:function(){var e=this.buf;return this.buf="",e},ms:function(e,t,n,r,i,s,o){var u,a=t[t.length-1],f=e.call(a);return typeof f=="function"?r?!0:(u=this.activeSub&&this.subsText&&this.subsText[this.activeSub]?this.subsText[this.activeSub]:this.text,this.ls(f,a,n,u.substring(i,s),o)):f},mv:function(e,t,n){var r=t[t.length-1],i=e.call(r);return typeof i=="function"?this.ct(f(i.call(r)),r,n):i},sub:function(e,t,n,r){var i=this.subs[e];i&&(this.activeSub=e,i(t,n,this,r),this.activeSub=!1)}};var r=/&/g,i=/</g,s=/>/g,o=/\'/g,u=/\"/g,a=/[&<>\"\']/,c=Array.isArray||function(e){return Object.prototype.toString.call(e)==="[object Array]"}})(typeof exports!="undefined"?exports:Hogan),function(e){function a(e){e.n.substr(e.n.length-1)==="}"&&(e.n=e.n.substring(0,e.n.length-1))}function f(e){return e.trim?e.trim():e.replace(/^\s*|\s*$/g,"")}function l(e,t,n){if(t.charAt(n)!=e.charAt(0))return!1;for(var r=1,i=e.length;r<i;r++)if(t.charAt(n+r)!=e.charAt(r))return!1;return!0}function h(t,n,r,i){var s=[],o=null,u=null,a=null;u=r[r.length-1];while(t.length>0){a=t.shift();if(!(!u||u.tag!="<"||a.tag in c))throw new Error("Illegal content in < super tag.");if(e.tags[a.tag]<=e.tags.$||p(a,i))r.push(a),a.nodes=h(t,a.tag,r,i);else{if(a.tag=="/"){if(r.length===0)throw new Error("Closing tag without opener: /"+a.n);o=r.pop();if(a.n!=o.n&&!d(a.n,o.n,i))throw new Error("Nesting error: "+o.n+" vs. "+a.n);return o.end=a.i,s}a.tag=="\n"&&(a.last=t.length==0||t[0].tag=="\n")}s.push(a)}if(r.length>0)throw new Error("missing closing tag: "+r.pop().n);return s}function p(e,t){for(var n=0,r=t.length;n<r;n++)if(t[n].o==e.n)return e.tag="#",!0}function d(e,t,n){for(var r=0,i=n.length;r<i;r++)if(n[r].c==e&&n[r].o==t)return!0}function v(e){var t=[];for(var n in e)t.push('"'+y(n)+'": function(c,p,t,i) {'+e[n]+"}");return"{ "+t.join(",")+" }"}function m(e){var t=[];for(var n in e.partials)t.push('"'+y(n)+'":{name:"'+y(e.partials[n].name)+'", '+m(e.partials[n])+"}");return"partials: {"+t.join(",")+"}, subs: "+v(e.subs)}function y(e){return e.replace(s,"\\\\").replace(n,'\\"').replace(r,"\\n").replace(i,"\\r").replace(o,"\\u2028").replace(u,"\\u2029")}function b(e){return~e.indexOf(".")?"d":"f"}function w(e,t){var n="<"+(t.prefix||""),r=n+e.n+g++;return t.partials[r]={name:e.n,partials:{}},t.code+='t.b(t.rp("'+y(r)+'",c,p,"'+(e.indent||"")+'"));',r}function E(e,t){t.code+="t.b(t.t(t."+b(e.n)+'("'+y(e.n)+'",c,p,0)));'}function S(e){return"t.b("+e+");"}var t=/\S/,n=/\"/g,r=/\n/g,i=/\r/g,s=/\\/g,o=/\u2028/,u=/\u2029/;e.tags={"#":1,"^":2,"<":3,$:4,"/":5,"!":6,">":7,"=":8,_v:9,"{":10,"&":11,_t:12},e.scan=function(r,i){function S(){v.length>0&&(m.push({tag:"_t",text:new String(v)}),v="")}function x(){var n=!0;for(var r=b;r<m.length;r++){n=e.tags[m[r].tag]<e.tags._v||m[r].tag=="_t"&&m[r].text.match(t)===null;if(!n)return!1}return n}function T(e,t){S();if(e&&x())for(var n=b,r;n<m.length;n++)m[n].text&&((r=m[n+1])&&r.tag==">"&&(r.indent=m[n].text.toString()),m.splice(n,1));else t||m.push({tag:"\n"});g=!1,b=m.length}function N(e,t){var n="="+E,r=e.indexOf(n,t),i=f(e.substring(e.indexOf("=",t)+1,r)).split(" ");return w=i[0],E=i[i.length-1],r+n.length-1}var s=r.length,o=0,u=1,c=2,h=o,p=null,d=null,v="",m=[],g=!1,y=0,b=0,w="{{",E="}}";i&&(i=i.split(" "),w=i[0],E=i[1]);for(y=0;y<s;y++)h==o?l(w,r,y)?(--y,S(),h=u):r.charAt(y)=="\n"?T(g):v+=r.charAt(y):h==u?(y+=w.length-1,d=e.tags[r.charAt(y+1)],p=d?r.charAt(y+1):"_v",p=="="?(y=N(r,y),h=o):(d&&y++,h=c),g=y):l(E,r,y)?(m.push({tag:p,n:f(v),otag:w,ctag:E,i:p=="/"?g-w.length:y+E.length}),v="",y+=E.length-1,h=o,p=="{"&&(E=="}}"?y++:a(m[m.length-1]))):v+=r.charAt(y);return T(g,!0),m};var c={_t:!0,"\n":!0,$:!0,"/":!0};e.stringify=function(t,n,r){return"{code: function (c,p,i) { "+e.wrapMain(t.code)+" },"+m(t)+"}"};var g=0;e.generate=function(t,n,r){g=0;var i={code:"",subs:{},partials:{}};return e.walk(t,i),r.asString?this.stringify(i,n,r):this.makeTemplate(i,n,r)},e.wrapMain=function(e){return'var t=this;t.b(i=i||"");'+e+"return t.fl();"},e.template=e.Template,e.makeTemplate=function(e,t,n){var r=this.makePartials(e);return r.code=new Function("c","p","i",this.wrapMain(e.code)),new this.template(r,t,this,n)},e.makePartials=function(e){var t,n={subs:{},partials:e.partials,name:e.name};for(t in n.partials)n.partials[t]=this.makePartials(n.partials[t]);for(t in e.subs)n.subs[t]=new Function("c","p","t","i",e.subs[t]);return n},e.codegen={"#":function(t,n){n.code+="if(t.s(t."+b(t.n)+'("'+y(t.n)+'",c,p,1),'+"c,p,0,"+t.i+","+t.end+',"'+t.otag+" "+t.ctag+'")){'+"t.rs(c,p,"+"function(c,p,t){",e.walk(t.nodes,n),n.code+="});c.pop();}"},"^":function(t,n){n.code+="if(!t.s(t."+b(t.n)+'("'+y(t.n)+'",c,p,1),c,p,1,0,0,"")){',e.walk(t.nodes,n),n.code+="};"},">":w,"<":function(t,n){var r={partials:{},code:"",subs:{},inPartial:!0};e.walk(t.nodes,r);var i=n.partials[w(t,n)];i.subs=r.subs,i.partials=r.partials},$:function(t,n){var r={subs:{},code:"",partials:n.partials,prefix:t.n};e.walk(t.nodes,r),n.subs[t.n]=r.code,n.inPartial||(n.code+='t.sub("'+y(t.n)+'",c,p,i);')},"\n":function(e,t){t.code+=S('"\\n"'+(e.last?"":" + i"))},_v:function(e,t){t.code+="t.b(t.v(t."+b(e.n)+'("'+y(e.n)+'",c,p,0)));'},_t:function(e,t){t.code+=S('"'+y(e.text)+'"')},"{":E,"&":E},e.walk=function(t,n){var r;for(var i=0,s=t.length;i<s;i++)r=e.codegen[t[i].tag],r&&r(t[i],n);return n},e.parse=function(e,t,n){return n=n||{},h(e,"",[],n.sectionTags||[])},e.cache={},e.cacheKey=function(e,t){return[e,!!t.asString,!!t.disableLambda,t.delimiters,!!t.modelGet].join("||")},e.compile=function(t,n){n=n||{};var r=e.cacheKey(t,n),i=this.cache[r];if(i){var s=i.partials;for(var o in s)delete s[o].instance;return i}return i=this.generate(this.parse(this.scan(t,n.delimiters),t,n),t,n),this.cache[r]=i}}(typeof exports!="undefined"?exports:Hogan);var Mustache=function(e){function t(t,n,r,i){var s=this.f(t,n,r,0),o=n;return s&&(o=o.concat(s)),e.Template.prototype.rp.call(this,t,o,r,i)}var n=function(n,r,i){this.rp=t,e.Template.call(this,n,r,i)};n.prototype=e.Template.prototype;var r,i=function(){this.cache={},this.generate=function(e,t,i){return new n(new Function("c","p","i",e),t,r)}};return i.prototype=e,r=new i,{to_html:function(e,t,n,i){var s=r.compile(e),o=s.render(t,n);if(!i)return o;i(o)}}}(Hogan);