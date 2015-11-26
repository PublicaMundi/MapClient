/*!
	query-string
	Parse and stringify URL query strings
	https://github.com/sindresorhus/query-string
	by Sindre Sorhus
	MIT License
*/

(function(){"use strict";var e={};e.parse=function(e){return typeof e!="string"?{}:(e=e.trim().replace(/^\?/,""),e?e.trim().split("&").reduce(function(e,t){var n=t.replace(/\+/g," ").split("="),r=n[0],i=n[1];return r=decodeURIComponent(r),i=i===undefined?null:decodeURIComponent(i),e.hasOwnProperty(r)?Array.isArray(e[r])?e[r].push(i):e[r]=[e[r],i]:e[r]=i,e},{}):{})},e.stringify=function(e){return e?Object.keys(e).map(function(t){var n=e[t];return Array.isArray(n)?n.map(function(e){return encodeURIComponent(t)+"="+encodeURIComponent(e)}).join("&"):encodeURIComponent(t)+"="+encodeURIComponent(n)}).join("&"):""},typeof define=="function"&&define.amd?define([],e):typeof module!="undefined"&&module.exports?module.exports=e:window.queryString=e})();