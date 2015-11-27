/*
 * jQuery File Upload Plugin 5.42.3
 * https://github.com/blueimp/jQuery-File-Upload
 *
 * Copyright 2010, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

(function(e){"use strict";typeof define=="function"&&define.amd?define(["jquery","jqueryui"],e):typeof exports=="object"?e(require("jquery"),require("./vendor/jquery.ui.widget")):e(window.jQuery)})(function(e){"use strict";function t(t){var n=t==="dragover";return function(r){r.dataTransfer=r.originalEvent&&r.originalEvent.dataTransfer;var i=r.dataTransfer;i&&e.inArray("Files",i.types)!==-1&&this._trigger(t,e.Event(t,{delegatedEvent:r}))!==!1&&(r.preventDefault(),n&&(i.dropEffect="copy"))}}e.support.fileInput=!(new RegExp("(Android (1\\.[0156]|2\\.[01]))|(Windows Phone (OS 7|8\\.0))|(XBLWP)|(ZuneWP)|(WPDesktop)|(w(eb)?OSBrowser)|(webOS)|(Kindle/(1\\.0|2\\.[05]|3\\.0))")).test(window.navigator.userAgent)&&!e('<input type="file">').prop("disabled"),e.support.xhrFileUpload=!!window.ProgressEvent&&!!window.FileReader,e.support.xhrFormDataFileUpload=!!window.FormData,e.support.blobSlice=window.Blob&&(Blob.prototype.slice||Blob.prototype.webkitSlice||Blob.prototype.mozSlice),e.widget("blueimp.fileupload",{options:{dropZone:e(document),pasteZone:undefined,fileInput:undefined,replaceFileInput:!0,paramName:undefined,singleFileUploads:!0,limitMultiFileUploads:undefined,limitMultiFileUploadSize:undefined,limitMultiFileUploadSizeOverhead:512,sequentialUploads:!1,limitConcurrentUploads:undefined,forceIframeTransport:!1,redirect:undefined,redirectParamName:undefined,postMessage:undefined,multipart:!0,maxChunkSize:undefined,uploadedBytes:undefined,recalculateProgress:!0,progressInterval:100,bitrateInterval:500,autoUpload:!0,messages:{uploadedBytes:"Uploaded bytes exceed file size"},i18n:function(t,n){return t=this.messages[t]||t.toString(),n&&e.each(n,function(e,n){t=t.replace("{"+e+"}",n)}),t},formData:function(e){return e.serializeArray()},add:function(t,n){if(t.isDefaultPrevented())return!1;(n.autoUpload||n.autoUpload!==!1&&e(this).fileupload("option","autoUpload"))&&n.process().done(function(){n.submit()})},processData:!1,contentType:!1,cache:!1},_specialOptions:["fileInput","dropZone","pasteZone","multipart","forceIframeTransport"],_blobSlice:e.support.blobSlice&&function(){var e=this.slice||this.webkitSlice||this.mozSlice;return e.apply(this,arguments)},_BitrateTimer:function(){this.timestamp=Date.now?Date.now():(new Date).getTime(),this.loaded=0,this.bitrate=0,this.getBitrate=function(e,t,n){var r=e-this.timestamp;if(!this.bitrate||!n||r>n)this.bitrate=(t-this.loaded)*(1e3/r)*8,this.loaded=t,this.timestamp=e;return this.bitrate}},_isXHRUpload:function(t){return!t.forceIframeTransport&&(!t.multipart&&e.support.xhrFileUpload||e.support.xhrFormDataFileUpload)},_getFormData:function(t){var n;return e.type(t.formData)==="function"?t.formData(t.form):e.isArray(t.formData)?t.formData:e.type(t.formData)==="object"?(n=[],e.each(t.formData,function(e,t){n.push({name:e,value:t})}),n):[]},_getTotal:function(t){var n=0;return e.each(t,function(e,t){n+=t.size||1}),n},_initProgressObject:function(t){var n={loaded:0,total:0,bitrate:0};t._progress?e.extend(t._progress,n):t._progress=n},_initResponseObject:function(e){var t;if(e._response)for(t in e._response)e._response.hasOwnProperty(t)&&delete e._response[t];else e._response={}},_onProgress:function(t,n){if(t.lengthComputable){var r=Date.now?Date.now():(new Date).getTime(),i;if(n._time&&n.progressInterval&&r-n._time<n.progressInterval&&t.loaded!==t.total)return;n._time=r,i=Math.floor(t.loaded/t.total*(n.chunkSize||n._progress.total))+(n.uploadedBytes||0),this._progress.loaded+=i-n._progress.loaded,this._progress.bitrate=this._bitrateTimer.getBitrate(r,this._progress.loaded,n.bitrateInterval),n._progress.loaded=n.loaded=i,n._progress.bitrate=n.bitrate=n._bitrateTimer.getBitrate(r,i,n.bitrateInterval),this._trigger("progress",e.Event("progress",{delegatedEvent:t}),n),this._trigger("progressall",e.Event("progressall",{delegatedEvent:t}),this._progress)}},_initProgressListener:function(t){var n=this,r=t.xhr?t.xhr():e.ajaxSettings.xhr();r.upload&&(e(r.upload).bind("progress",function(e){var r=e.originalEvent;e.lengthComputable=r.lengthComputable,e.loaded=r.loaded,e.total=r.total,n._onProgress(e,t)}),t.xhr=function(){return r})},_isInstanceOf:function(e,t){return Object.prototype.toString.call(t)==="[object "+e+"]"},_initXHRData:function(t){var n=this,r,i=t.files[0],s=t.multipart||!e.support.xhrFileUpload,o=e.type(t.paramName)==="array"?t.paramName[0]:t.paramName;t.headers=e.extend({},t.headers),t.contentRange&&(t.headers["Content-Range"]=t.contentRange);if(!s||t.blob||!this._isInstanceOf("File",i))t.headers["Content-Disposition"]='attachment; filename="'+encodeURI(i.name)+'"';s?e.support.xhrFormDataFileUpload&&(t.postMessage?(r=this._getFormData(t),t.blob?r.push({name:o,value:t.blob}):e.each(t.files,function(n,i){r.push({name:e.type(t.paramName)==="array"&&t.paramName[n]||o,value:i})})):(n._isInstanceOf("FormData",t.formData)?r=t.formData:(r=new FormData,e.each(this._getFormData(t),function(e,t){r.append(t.name,t.value)})),t.blob?r.append(o,t.blob,i.name):e.each(t.files,function(i,s){(n._isInstanceOf("File",s)||n._isInstanceOf("Blob",s))&&r.append(e.type(t.paramName)==="array"&&t.paramName[i]||o,s,s.uploadName||s.name)})),t.data=r):(t.contentType=i.type||"application/octet-stream",t.data=t.blob||i),t.blob=null},_initIframeSettings:function(t){var n=e("<a></a>").prop("href",t.url).prop("host");t.dataType="iframe "+(t.dataType||""),t.formData=this._getFormData(t),t.redirect&&n&&n!==location.host&&t.formData.push({name:t.redirectParamName||"redirect",value:t.redirect})},_initDataSettings:function(e){this._isXHRUpload(e)?(this._chunkedUpload(e,!0)||(e.data||this._initXHRData(e),this._initProgressListener(e)),e.postMessage&&(e.dataType="postmessage "+(e.dataType||""))):this._initIframeSettings(e)},_getParamName:function(t){var n=e(t.fileInput),r=t.paramName;return r?e.isArray(r)||(r=[r]):(r=[],n.each(function(){var t=e(this),n=t.prop("name")||"files[]",i=(t.prop("files")||[1]).length;while(i)r.push(n),i-=1}),r.length||(r=[n.prop("name")||"files[]"])),r},_initFormSettings:function(t){if(!t.form||!t.form.length)t.form=e(t.fileInput.prop("form")),t.form.length||(t.form=e(this.options.fileInput.prop("form")));t.paramName=this._getParamName(t),t.url||(t.url=t.form.prop("action")||location.href),t.type=(t.type||e.type(t.form.prop("method"))==="string"&&t.form.prop("method")||"").toUpperCase(),t.type!=="POST"&&t.type!=="PUT"&&t.type!=="PATCH"&&(t.type="POST"),t.formAcceptCharset||(t.formAcceptCharset=t.form.attr("accept-charset"))},_getAJAXSettings:function(t){var n=e.extend({},this.options,t);return this._initFormSettings(n),this._initDataSettings(n),n},_getDeferredState:function(e){return e.state?e.state():e.isResolved()?"resolved":e.isRejected()?"rejected":"pending"},_enhancePromise:function(e){return e.success=e.done,e.error=e.fail,e.complete=e.always,e},_getXHRPromise:function(t,n,r){var i=e.Deferred(),s=i.promise();return n=n||this.options.context||s,t===!0?i.resolveWith(n,r):t===!1&&i.rejectWith(n,r),s.abort=i.promise,this._enhancePromise(s)},_addConvenienceMethods:function(t,n){var r=this,i=function(t){return e.Deferred().resolveWith(r,t).promise()};n.process=function(t,s){if(t||s)n._processQueue=this._processQueue=(this._processQueue||i([this])).pipe(function(){return n.errorThrown?e.Deferred().rejectWith(r,[n]).promise():i(arguments)}).pipe(t,s);return this._processQueue||i([this])},n.submit=function(){return this.state()!=="pending"&&(n.jqXHR=this.jqXHR=r._trigger("submit",e.Event("submit",{delegatedEvent:t}),this)!==!1&&r._onSend(t,this)),this.jqXHR||r._getXHRPromise()},n.abort=function(){return this.jqXHR?this.jqXHR.abort():(this.errorThrown="abort",r._trigger("fail",null,this),r._getXHRPromise(!1))},n.state=function(){if(this.jqXHR)return r._getDeferredState(this.jqXHR);if(this._processQueue)return r._getDeferredState(this._processQueue)},n.processing=function(){return!this.jqXHR&&this._processQueue&&r._getDeferredState(this._processQueue)==="pending"},n.progress=function(){return this._progress},n.response=function(){return this._response}},_getUploadedBytes:function(e){var t=e.getResponseHeader("Range"),n=t&&t.split("-"),r=n&&n.length>1&&parseInt(n[1],10);return r&&r+1},_chunkedUpload:function(t,n){t.uploadedBytes=t.uploadedBytes||0;var r=this,i=t.files[0],s=i.size,o=t.uploadedBytes,u=t.maxChunkSize||s,a=this._blobSlice,f=e.Deferred(),l=f.promise(),c,h;return!(this._isXHRUpload(t)&&a&&(o||u<s))||t.data?!1:n?!0:o>=s?(i.error=t.i18n("uploadedBytes"),this._getXHRPromise(!1,t.context,[null,"error",i.error])):(h=function(){var n=e.extend({},t),l=n._progress.loaded;n.blob=a.call(i,o,o+u,i.type),n.chunkSize=n.blob.size,n.contentRange="bytes "+o+"-"+(o+n.chunkSize-1)+"/"+s,r._initXHRData(n),r._initProgressListener(n),c=(r._trigger("chunksend",null,n)!==!1&&e.ajax(n)||r._getXHRPromise(!1,n.context)).done(function(i,u,a){o=r._getUploadedBytes(a)||o+n.chunkSize,l+n.chunkSize-n._progress.loaded&&r._onProgress(e.Event("progress",{lengthComputable:!0,loaded:o-n.uploadedBytes,total:o-n.uploadedBytes}),n),t.uploadedBytes=n.uploadedBytes=o,n.result=i,n.textStatus=u,n.jqXHR=a,r._trigger("chunkdone",null,n),r._trigger("chunkalways",null,n),o<s?h():f.resolveWith(n.context,[i,u,a])}).fail(function(e,t,i){n.jqXHR=e,n.textStatus=t,n.errorThrown=i,r._trigger("chunkfail",null,n),r._trigger("chunkalways",null,n),f.rejectWith(n.context,[e,t,i])})},this._enhancePromise(l),l.abort=function(){return c.abort()},h(),l)},_beforeSend:function(e,t){this._active===0&&(this._trigger("start"),this._bitrateTimer=new this._BitrateTimer,this._progress.loaded=this._progress.total=0,this._progress.bitrate=0),this._initResponseObject(t),this._initProgressObject(t),t._progress.loaded=t.loaded=t.uploadedBytes||0,t._progress.total=t.total=this._getTotal(t.files)||1,t._progress.bitrate=t.bitrate=0,this._active+=1,this._progress.loaded+=t.loaded,this._progress.total+=t.total},_onDone:function(t,n,r,i){var s=i._progress.total,o=i._response;i._progress.loaded<s&&this._onProgress(e.Event("progress",{lengthComputable:!0,loaded:s,total:s}),i),o.result=i.result=t,o.textStatus=i.textStatus=n,o.jqXHR=i.jqXHR=r,this._trigger("done",null,i)},_onFail:function(e,t,n,r){var i=r._response;r.recalculateProgress&&(this._progress.loaded-=r._progress.loaded,this._progress.total-=r._progress.total),i.jqXHR=r.jqXHR=e,i.textStatus=r.textStatus=t,i.errorThrown=r.errorThrown=n,this._trigger("fail",null,r)},_onAlways:function(e,t,n,r){this._trigger("always",null,r)},_onSend:function(t,n){n.submit||this._addConvenienceMethods(t,n);var r=this,i,s,o,u,a=r._getAJAXSettings(n),f=function(){return r._sending+=1,a._bitrateTimer=new r._BitrateTimer,i=i||((s||r._trigger("send",e.Event("send",{delegatedEvent:t}),a)===!1)&&r._getXHRPromise(!1,a.context,s)||r._chunkedUpload(a)||e.ajax(a)).done(function(e,t,n){r._onDone(e,t,n,a)}).fail(function(e,t,n){r._onFail(e,t,n,a)}).always(function(e,t,n){r._onAlways(e,t,n,a),r._sending-=1,r._active-=1;if(a.limitConcurrentUploads&&a.limitConcurrentUploads>r._sending){var i=r._slots.shift();while(i){if(r._getDeferredState(i)==="pending"){i.resolve();break}i=r._slots.shift()}}r._active===0&&r._trigger("stop")}),i};return this._beforeSend(t,a),this.options.sequentialUploads||this.options.limitConcurrentUploads&&this.options.limitConcurrentUploads<=this._sending?(this.options.limitConcurrentUploads>1?(o=e.Deferred(),this._slots.push(o),u=o.pipe(f)):(this._sequence=this._sequence.pipe(f,f),u=this._sequence),u.abort=function(){return s=[undefined,"abort","abort"],i?i.abort():(o&&o.rejectWith(a.context,s),f())},this._enhancePromise(u)):f()},_onAdd:function(t,n){var r=this,i=!0,s=e.extend({},this.options,n),o=n.files,u=o.length,a=s.limitMultiFileUploads,f=s.limitMultiFileUploadSize,l=s.limitMultiFileUploadSizeOverhead,c=0,h=this._getParamName(s),p,d,v,m,g=0;f&&(!u||o[0].size===undefined)&&(f=undefined);if(!(s.singleFileUploads||a||f)||!this._isXHRUpload(s))v=[o],p=[h];else if(!s.singleFileUploads&&!f&&a){v=[],p=[];for(m=0;m<u;m+=a)v.push(o.slice(m,m+a)),d=h.slice(m,m+a),d.length||(d=h),p.push(d)}else if(!s.singleFileUploads&&f){v=[],p=[];for(m=0;m<u;m+=1){c+=o[m].size+l;if(m+1===u||c+o[m+1].size+l>f||a&&m+1-g>=a)v.push(o.slice(g,m+1)),d=h.slice(g,m+1),d.length||(d=h),p.push(d),g=m+1,c=0}}else p=h;return n.originalFiles=o,e.each(v||o,function(s,o){var u=e.extend({},n);return u.files=v?o:[o],u.paramName=p[s],r._initResponseObject(u),r._initProgressObject(u),r._addConvenienceMethods(t,u),i=r._trigger("add",e.Event("add",{delegatedEvent:t}),u),i}),i},_replaceFileInput:function(t){var n=t.fileInput,r=n.clone(!0);t.fileInputClone=r,e("<form></form>").append(r)[0].reset(),n.after(r).detach(),e.cleanData(n.unbind("remove")),this.options.fileInput=this.options.fileInput.map(function(e,t){return t===n[0]?r[0]:t}),n[0]===this.element[0]&&(this.element=r)},_handleFileTreeEntry:function(t,n){var r=this,i=e.Deferred(),s=function(e){e&&!e.entry&&(e.entry=t),i.resolve([e])},o=function(e){r._handleFileTreeEntries(e,n+t.name+"/").done(function(e){i.resolve(e)}).fail(s)},u=function(){a.readEntries(function(e){e.length?(f=f.concat(e),u()):o(f)},s)},a,f=[];return n=n||"",t.isFile?t._file?(t._file.relativePath=n,i.resolve(t._file)):t.file(function(e){e.relativePath=n,i.resolve(e)},s):t.isDirectory?(a=t.createReader(),u()):i.resolve([]),i.promise()},_handleFileTreeEntries:function(t,n){var r=this;return e.when.apply(e,e.map(t,function(e){return r._handleFileTreeEntry(e,n)})).pipe(function(){return Array.prototype.concat.apply([],arguments)})},_getDroppedFiles:function(t){t=t||{};var n=t.items;return n&&n.length&&(n[0].webkitGetAsEntry||n[0].getAsEntry)?this._handleFileTreeEntries(e.map(n,function(e){var t;return e.webkitGetAsEntry?(t=e.webkitGetAsEntry(),t&&(t._file=e.getAsFile()),t):e.getAsEntry()})):e.Deferred().resolve(e.makeArray(t.files)).promise()},_getSingleFileInputFiles:function(t){t=e(t);var n=t.prop("webkitEntries")||t.prop("entries"),r,i;if(n&&n.length)return this._handleFileTreeEntries(n);r=e.makeArray(t.prop("files"));if(!r.length){i=t.prop("value");if(!i)return e.Deferred().resolve([]).promise();r=[{name:i.replace(/^.*\\/,"")}]}else r[0].name===undefined&&r[0].fileName&&e.each(r,function(e,t){t.name=t.fileName,t.size=t.fileSize});return e.Deferred().resolve(r).promise()},_getFileInputFiles:function(t){return t instanceof e&&t.length!==1?e.when.apply(e,e.map(t,this._getSingleFileInputFiles)).pipe(function(){return Array.prototype.concat.apply([],arguments)}):this._getSingleFileInputFiles(t)},_onChange:function(t){var n=this,r={fileInput:e(t.target),form:e(t.target.form)};this._getFileInputFiles(r.fileInput).always(function(i){r.files=i,n.options.replaceFileInput&&n._replaceFileInput(r),n._trigger("change",e.Event("change",{delegatedEvent:t}),r)!==!1&&n._onAdd(t,r)})},_onPaste:function(t){var n=t.originalEvent&&t.originalEvent.clipboardData&&t.originalEvent.clipboardData.items,r={files:[]};n&&n.length&&(e.each(n,function(e,t){var n=t.getAsFile&&t.getAsFile();n&&r.files.push(n)}),this._trigger("paste",e.Event("paste",{delegatedEvent:t}),r)!==!1&&this._onAdd(t,r))},_onDrop:function(t){t.dataTransfer=t.originalEvent&&t.originalEvent.dataTransfer;var n=this,r=t.dataTransfer,i={};r&&r.files&&r.files.length&&(t.preventDefault(),this._getDroppedFiles(r).always(function(r){i.files=r,n._trigger("drop",e.Event("drop",{delegatedEvent:t}),i)!==!1&&n._onAdd(t,i)}))},_onDragOver:t("dragover"),_onDragEnter:t("dragenter"),_onDragLeave:t("dragleave"),_initEventHandlers:function(){this._isXHRUpload(this.options)&&(this._on(this.options.dropZone,{dragover:this._onDragOver,drop:this._onDrop,dragenter:this._onDragEnter,dragleave:this._onDragLeave}),this._on(this.options.pasteZone,{paste:this._onPaste})),e.support.fileInput&&this._on(this.options.fileInput,{change:this._onChange})},_destroyEventHandlers:function(){this._off(this.options.dropZone,"dragenter dragleave dragover drop"),this._off(this.options.pasteZone,"paste"),this._off(this.options.fileInput,"change")},_setOption:function(t,n){var r=e.inArray(t,this._specialOptions)!==-1;r&&this._destroyEventHandlers(),this._super(t,n),r&&(this._initSpecialOptions(),this._initEventHandlers())},_initSpecialOptions:function(){var t=this.options;t.fileInput===undefined?t.fileInput=this.element.is('input[type="file"]')?this.element:this.element.find('input[type="file"]'):t.fileInput instanceof e||(t.fileInput=e(t.fileInput)),t.dropZone instanceof e||(t.dropZone=e(t.dropZone)),t.pasteZone instanceof e||(t.pasteZone=e(t.pasteZone))},_getRegExp:function(e){var t=e.split("/"),n=t.pop();return t.shift(),new RegExp(t.join("/"),n)},_isRegExpOption:function(t,n){return t!=="url"&&e.type(n)==="string"&&/^\/.*\/[igm]{0,3}$/.test(n)},_initDataAttributes:function(){var t=this,n=this.options,r=this.element.data();e.each(this.element[0].attributes,function(e,i){var s=i.name.toLowerCase(),o;/^data-/.test(s)&&(s=s.slice(5).replace(/-[a-z]/g,function(e){return e.charAt(1).toUpperCase()}),o=r[s],t._isRegExpOption(s,o)&&(o=t._getRegExp(o)),n[s]=o)})},_create:function(){this._initDataAttributes(),this._initSpecialOptions(),this._slots=[],this._sequence=this._getXHRPromise(!0),this._sending=this._active=0,this._initProgressObject(this),this._initEventHandlers()},active:function(){return this._active},progress:function(){return this._progress},add:function(t){var n=this;if(!t||this.options.disabled)return;t.fileInput&&!t.files?this._getFileInputFiles(t.fileInput).always(function(e){t.files=e,n._onAdd(null,t)}):(t.files=e.makeArray(t.files),this._onAdd(null,t))},send:function(t){if(t&&!this.options.disabled){if(t.fileInput&&!t.files){var n=this,r=e.Deferred(),i=r.promise(),s,o;return i.abort=function(){return o=!0,s?s.abort():(r.reject(null,"abort","abort"),i)},this._getFileInputFiles(t.fileInput).always(function(e){if(o)return;if(!e.length){r.reject();return}t.files=e,s=n._onSend(null,t),s.then(function(e,t,n){r.resolve(e,t,n)},function(e,t,n){r.reject(e,t,n)})}),this._enhancePromise(i)}t.files=e.makeArray(t.files);if(t.files.length)return this._onSend(null,t)}return this._getXHRPromise(!1,t&&t.context)}})});