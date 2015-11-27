/*
 Copyright 2011-2013 Abdulla Abdurakhmanov
 Original sources are available at https://code.google.com/p/x2js/

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

function X2JS(e){"use strict";function n(){e.escapeMode===undefined&&(e.escapeMode=!0),e.attributePrefix=e.attributePrefix||"_",e.arrayAccessForm=e.arrayAccessForm||"none",e.emptyNodeForm=e.emptyNodeForm||"text",e.enableToStringFunc===undefined&&(e.enableToStringFunc=!0),e.arrayAccessFormPaths=e.arrayAccessFormPaths||[],e.skipEmptyTextNodesForObj===undefined&&(e.skipEmptyTextNodesForObj=!0),e.stripWhitespaces===undefined&&(e.stripWhitespaces=!0),e.datetimeAccessFormPaths=e.datetimeAccessFormPaths||[]}function i(){function e(e){var t=String(e);return t.length===1&&(t="0"+t),t}typeof String.prototype.trim!="function"&&(String.prototype.trim=function(){return this.replace(/^\s+|^\n+|(\s|\n)+$/g,"")}),typeof Date.prototype.toISOString!="function"&&(Date.prototype.toISOString=function(){return this.getUTCFullYear()+"-"+e(this.getUTCMonth()+1)+"-"+e(this.getUTCDate())+"T"+e(this.getUTCHours())+":"+e(this.getUTCMinutes())+":"+e(this.getUTCSeconds())+"."+String((this.getUTCMilliseconds()/1e3).toFixed(3)).slice(2,5)+"Z"})}function s(e){var t=e.localName;t==null&&(t=e.baseName);if(t==null||t=="")t=e.nodeName;return t}function o(e){return e.prefix}function u(e){return typeof e=="string"?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;"):e}function a(e){return e.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&#x2F;/g,"/")}function f(t,n,r){switch(e.arrayAccessForm){case"property":t[n]instanceof Array?t[n+"_asArray"]=t[n]:t[n+"_asArray"]=[t[n]]}if(!(t[n]instanceof Array)&&e.arrayAccessFormPaths.length>0){var i=0;for(;i<e.arrayAccessFormPaths.length;i++){var s=e.arrayAccessFormPaths[i];if(typeof s=="string"){if(s==r)break}else if(s instanceof RegExp){if(s.test(r))break}else if(typeof s=="function"&&s(t,n,r))break}i!=e.arrayAccessFormPaths.length&&(t[n]=[t[n]])}}function l(e){var t=e.split(/[-T:+Z]/g),n=new Date(t[0],t[1]-1,t[2]),r=t[5].split(".");n.setHours(t[3],t[4],r[0]),r.length>1&&n.setMilliseconds(r[1]);if(t[6]&&t[7]){var i=t[6]*60+Number(t[7]),s=/\d\d-\d\d:\d\d$/.test(e)?"-":"+";i=0+(s=="-"?-1*i:i),n.setMinutes(n.getMinutes()-i-n.getTimezoneOffset())}else e.indexOf("Z",e.length-1)!==-1&&(n=new Date(Date.UTC(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours(),n.getMinutes(),n.getSeconds(),n.getMilliseconds())));return n}function c(t,n,r){if(e.datetimeAccessFormPaths.length>0){var i=r.split(".#")[0],s=0;for(;s<e.datetimeAccessFormPaths.length;s++){var o=e.datetimeAccessFormPaths[s];if(typeof o=="string"){if(o==i)break}else if(o instanceof RegExp){if(o.test(i))break}else if(typeof o=="function"&&o(obj,n,i))break}return s!=e.datetimeAccessFormPaths.length?l(t):t}return t}function h(t,n){if(t.nodeType==r.DOCUMENT_NODE){var i=new Object,u=t.childNodes;for(var l=0;l<u.length;l++){var p=u.item(l);if(p.nodeType==r.ELEMENT_NODE){var d=s(p);i[d]=h(p,d)}}return i}if(t.nodeType==r.ELEMENT_NODE){var i=new Object;i.__cnt=0;var u=t.childNodes;for(var l=0;l<u.length;l++){var p=u.item(l),d=s(p);p.nodeType!=r.COMMENT_NODE&&(i.__cnt++,i[d]==null?(i[d]=h(p,n+"."+d),f(i,d,n+"."+d)):(i[d]!=null&&(i[d]instanceof Array||(i[d]=[i[d]],f(i,d,n+"."+d))),i[d][i[d].length]=h(p,n+"."+d)))}for(var v=0;v<t.attributes.length;v++){var m=t.attributes.item(v);i.__cnt++,i[e.attributePrefix+m.name]=m.value}var g=o(t);return g!=null&&g!=""&&(i.__cnt++,i.__prefix=g),i["#text"]!=null&&(i.__text=i["#text"],i.__text instanceof Array&&(i.__text=i.__text.join("\n")),e.escapeMode&&(i.__text=a(i.__text)),e.stripWhitespaces&&(i.__text=i.__text.trim()),delete i["#text"],e.arrayAccessForm=="property"&&delete i["#text_asArray"],i.__text=c(i.__text,d,n+"."+d)),i["#cdata-section"]!=null&&(i.__cdata=i["#cdata-section"],delete i["#cdata-section"],e.arrayAccessForm=="property"&&delete i["#cdata-section_asArray"]),i.__cnt==1&&i.__text!=null?i=i.__text:i.__cnt==0&&e.emptyNodeForm=="text"?i="":i.__cnt>1&&i.__text!=null&&e.skipEmptyTextNodesForObj&&(e.stripWhitespaces&&i.__text==""||i.__text.trim()=="")&&delete i.__text,delete i.__cnt,e.enableToStringFunc&&(i.__text!=null||i.__cdata!=null)&&(i.toString=function(){return(this.__text!=null?this.__text:"")+(this.__cdata!=null?this.__cdata:"")}),i}if(t.nodeType==r.TEXT_NODE||t.nodeType==r.CDATA_SECTION_NODE)return t.nodeValue}function p(t,n,r,i){var s="<"+(t!=null&&t.__prefix!=null?t.__prefix+":":"")+n;if(r!=null)for(var o=0;o<r.length;o++){var a=r[o],f=t[a];e.escapeMode&&(f=u(f)),s+=" "+a.substr(e.attributePrefix.length)+"='"+f+"'"}return i?s+="/>":s+=">",s}function d(e,t){return"</"+(e.__prefix!=null?e.__prefix+":":"")+t+">"}function v(e,t){return e.indexOf(t,e.length-t.length)!==-1}function m(t,n){return e.arrayAccessForm=="property"&&v(n.toString(),"_asArray")||n.toString().indexOf(e.attributePrefix)==0||n.toString().indexOf("__")==0||t[n]instanceof Function?!0:!1}function g(e){var t=0;if(e instanceof Object)for(var n in e){if(m(e,n))continue;t++}return t}function y(t){var n=[];if(t instanceof Object)for(var r in t)r.toString().indexOf("__")==-1&&r.toString().indexOf(e.attributePrefix)==0&&n.push(r);return n}function b(t){var n="";return t.__cdata!=null&&(n+="<![CDATA["+t.__cdata+"]]>"),t.__text!=null&&(e.escapeMode?n+=u(t.__text):n+=t.__text),n}function w(t){var n="";return t instanceof Object?n+=b(t):t!=null&&(e.escapeMode?n+=u(t):n+=t),n}function E(e,t,n){var r="";if(e.length==0)r+=p(e,t,n,!0);else for(var i=0;i<e.length;i++)r+=p(e[i],t,y(e[i]),!1),r+=S(e[i]),r+=d(e[i],t);return r}function S(e){var t="",n=g(e);if(n>0)for(var r in e){if(m(e,r))continue;var i=e[r],s=y(i);if(i==null||i==undefined)t+=p(i,r,s,!0);else if(i instanceof Object)if(i instanceof Array)t+=E(i,r,s);else if(i instanceof Date)t+=p(i,r,s,!1),t+=i.toISOString(),t+=d(i,r);else{var o=g(i);o>0||i.__text!=null||i.__cdata!=null?(t+=p(i,r,s,!1),t+=S(i),t+=d(i,r)):t+=p(i,r,s,!0)}else t+=p(i,r,s,!1),t+=w(i),t+=d(i,r)}return t+=w(e),t}var t="1.1.5";e=e||{},n(),i();var r={ELEMENT_NODE:1,TEXT_NODE:3,CDATA_SECTION_NODE:4,COMMENT_NODE:8,DOCUMENT_NODE:9};this.parseXmlString=function(e){var t=window.ActiveXObject||"ActiveXObject"in window;if(e===undefined)return null;var n;if(window.DOMParser){var r=new window.DOMParser,i=null;if(!t)try{i=r.parseFromString("INVALID","text/xml").childNodes[0].namespaceURI}catch(s){i=null}try{n=r.parseFromString(e,"text/xml"),i!=null&&n.getElementsByTagNameNS(i,"parsererror").length>0&&(n=null)}catch(s){n=null}}else e.indexOf("<?")==0&&(e=e.substr(e.indexOf("?>")+2)),n=new ActiveXObject("Microsoft.XMLDOM"),n.async="false",n.loadXML(e);return n},this.asArray=function(e){return e instanceof Array?e:[e]},this.toXmlDateTime=function(e){return e instanceof Date?e.toISOString():typeof e=="number"?(new Date(e)).toISOString():null},this.asDateTime=function(e){return typeof e=="string"?l(e):e},this.xml2json=function(e){return h(e)},this.xml_str2json=function(e){var t=this.parseXmlString(e);return t!=null?this.xml2json(t):null},this.json2xml_str=function(e){return S(e)},this.json2xml=function(e){var t=this.json2xml_str(e);return this.parseXmlString(t)},this.getVersion=function(){return t}};