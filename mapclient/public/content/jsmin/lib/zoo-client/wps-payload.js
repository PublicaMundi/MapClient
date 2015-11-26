/**
 * Author : Samuel Souk aloun
 *
 * Copyright (c) 2014 GeoLabs SARL
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

define(["jquery","utils"],function(e,t){return{getPayload:function(e){if(e.request=="DescribeProcess")return this.getPayload_DescribeProcess(e);if(e.request=="GetCapabilities")return this.getPayload_GetCapabilities(e);if(e.request=="Execute")return this.getPayload_Execute(e);if(e.request=="Dismiss")return this.getPayload_Dismiss(e);console.log("#### UNKNOWN REQUEST ####")},getPayload_GetCapabilities:function(e){var t="payload_GetCapabilities";return e.version=="2.0.0"&&(t+="2"),templates[t].render(e)},getPayload_DescribeProcess:function(t){var n="payload_DescribeProcess";t.version=="2.0.0"&&(n+="2");if(t.Identifier)return e.isArray(t.Identifier)?templates[n].render({identifiers:t.Identifier,language:t.language}):templates[n].render({identifiers:[t.Identifier],language:t.language})},getPayload_Dismiss:function(t){var n="payload_Dismiss";t.version="2.0.0";if(t.jobid)return e.isArray(t.jobid)?templates[n].render({jobid:t.jobid}):templates[n].render({jobid:[t.jobid]})},getPayload_Execute:function(e){var t="payload_Execute";e.version=="2.0.0"&&(t+="2");if(e.DataInputs)for(var n=0;n<e.DataInputs.length;n++){var r=!1,i={data:"literal",mime:"complex"};for(j in i)if(e.DataInputs[n][j+"Type"]){e.DataInputs[n]["is_"+i[j]]=!0,e.DataInputs[n].type=i[j];if(j=="mime"){e.DataInputs[n].is_XML=e.DataInputs[n][j+"Type"]=="text/xml";if(!e.DataInputs[n].is_XML){var s=e.DataInputs[n][j+"Type"].split(";");e.DataInputs[n].is_XML=s[0]=="text/xml"}}r=!0}if(!r){if(e.DataInputs[n]["type"]=="bbox"||e.DataInputs[n].dimension||e.DataInputs[n].crs)e.DataInputs[n].is_bbox=!0,e.DataInputs[n].type="bbox",r=!0;r||(e.DataInputs[n].is_literal=!0,e.DataInputs[n].type="literal")}e.DataInputs[n].type=="bbox"&&(e.DataInputs[n].crs||(e.DataInputs[n].crs="EPSG:4326"),e.DataInputs[n].dimension||(e.DataInputs[n].dimension=2)),e.DataInputs[n].complexPayload_callback&&(e.DataInputs[n].value=window[e.DataInputs[n].complexPayload_callback]),e.DataInputs[n].href&&(e.DataInputs[n].is_reference=!0,e.DataInputs[n].method=="POST"?e.DataInputs[n].is_post=!0:e.DataInputs[n].is_get=!0)}if(e.DataOutputs||e.storeExecuteResponse||e.status||e.lineage)for(var n=0;n<e.DataOutputs.length;n++)e.DataOutputs[n].type&&(e.DataOutputs[n]["is_"+e.DataOutputs[n].type]=!0);return templates[t].render(e)}}});