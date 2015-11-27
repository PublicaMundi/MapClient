define(["module","jquery","ol","URIjs/URI","data_api","shared"],function(e,t,n,r,i,s){"use strict";var o={ui:{section:"group"},config:e.config(),ckan:null,resources:null,map:{config:null,control:null,google:null},interactions:{},tools:{},actions:{},preview:null,locale:null};o.config.path=o.config.path||"/",i.Data.configure({debug:o.config.debug,endpoint:o.config.path});var u=function(){o.config.geolocation=!0,o.config.map.minZoom=o.config.map.minZoom||7,o.config.map.maxZoom=o.config.map.maxZoom||19;var e=r.parse(window.location.href).query;if(e){var t=r.parseQuery(e);t.config&&(o.map.config=t.config),t.bbox?o.config.map.bbox=t.bbox.split(",").map(Number):o.config.map.bbox=null,t.center&&(o.config.map.center=t.center.split(",").map(Number)),t.zoom&&(o.config.map.zoom=t.zoom),t.geolocation==="off"&&(o.config.geolocation=!1),t.locale&&(o.locale=t.locale),!t.config&&t.package&&t.resource&&(o.preview={"package":t.package,resource:t.resource})}},a=function(){return o.config.servers.osm.length>0?new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.XYZ({attributions:[n.source.OSM.ATTRIBUTION],urls:o.config.servers.osm}),opacity:t("#base-layer-opacity").val()/100}):o.config.servers.mapproxy.length>0?new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.TileWMS({attributions:[n.source.OSM.ATTRIBUTION],url:o.config.servers.mapproxy,params:{SERVICE:"WMS",VERSION:"1.1.1",LAYERS:o.config.layers.osm}}),opacity:t("#base-layer-opacity").val()/100}):new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.OSM({attributions:[n.source.OSM.ATTRIBUTION]}),opacity:t("#base-layer-opacity").val()/100})},f=function(){var e,t;if(o.config.servers.tilecache.length>0){var i=new n.tilegrid.TileGrid({origin:[1948226,4024868],extent:[1948226,4024868,4008846,5208724],tileSize:512,resolutions:[156543.0339,78271.51695,39135.758475,19567.8792375,9783.93961875,4891.969809375,2445.9849046875,1222.99245234375,611.496226171875,305.7481130859375,152.87405654296876,76.43702827148438,38.21851413574219,19.109257067871095,9.554628533935547,4.777314266967774,2.388657133483887,1.1943285667419434,.5971642833709717,.29858214168548586,.14929107084274293,.07464553542137146,.03732276771068573,.018661383855342866]});return e=new n.source.TileWMS({urls:o.config.servers.tilecache,params:{VERSION:"1.1.0",LAYERS:o.config.layers.ktimatologio,TRANSPARENT:!0},projection:"EPSG:900913",attributions:[new n.Attribution({html:'<a href="'+s.i18n.getResource("attribution.ktimatologio.url")+'" '+'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">'+'<img src="content/images/app/ktimatologio-logo.png"/></a>'})],tileGrid:i}),t=e.tileUrlFunction,e.tileUrlFunction=function(e,n,i){var s=t(e,n,i),o=r.parse(s)||{},u=o.query?r.parseQuery(o.query):{};u.SRS="EPSG:900913";var a=r.build({protocol:o.protocol?o.protocol:"http",hostname:o.hostname,port:o.port==="80"?"":o.port,path:o.path,query:r.buildQuery(u)});return a},new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:e})}if(o.config.servers.mapproxy.length>0)return new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.TileWMS({projection:"EPSG:900913",attributions:[new n.Attribution({html:'<a href="'+s.i18n.getResource("attribution.ktimatologio.url")+'" '+'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">'+'<img src="content/images/app/ktimatologio-logo.png"/></a>'})],url:o.config.servers.mapproxy,params:{SERVICE:"WMS",VERSION:"1.1.0",LAYERS:"ktimatologio"}})});var u={SERVICE:"WMS",VERSION:"1.1.0",LAYERS:"KTBASEMAP"};return e=new n.source.TileWMS({url:"http://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx",params:u,projection:"EPSG:900913",attributions:[new n.Attribution({html:'<a href="'+s.i18n.getResource("attribution.ktimatologio.url")+'" '+'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">'+'<img src="content/images/app/ktimatologio-logo.png"/></a>'})]}),t=e.tileUrlFunction,e.tileUrlFunction=function(e,n,i){var s=t(e,n,i),o=r.parse(s)||{},u=o.query?r.parseQuery(o.query):{};u.SRS="EPSG:900913";var a=r.build({protocol:o.protocol?o.protocol:"http",hostname:o.hostname,port:o.port==="80"?"":o.port,path:o.path,query:r.buildQuery(u)});return a},new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:e})},l=function(){var e=function(e,n,r,i,s){var u=document.createElement("canvas"),a=u.getContext("2d"),f=i[0],l=i[1];u.setAttribute("width",f),u.setAttribute("height",l);var c=o.map.control,h=c.getView().calculateExtent(c.getSize()),p=c.getPixelFromCoordinate([h[0],h[3]]),d=c.getPixelFromCoordinate([e[0],e[3]]),v=[p[0]-d[0],p[1]-d[1]],m=t("#grid-tiles")[0],g=a.createPattern(m,"repeat");a.rect(d[0],d[1],f-d[0],l-d[1]),a.fillStyle=g,a.fill();var y=[2137334.22323,4117771.96011,3332905.55435,5150499.54408],b=c.getPixelFromCoordinate([y[0],y[3]]),w=c.getPixelFromCoordinate([y[2],y[1]]);return a.clearRect((b[0]+v[0])*r,(b[1]+v[1])*r,(w[0]-b[0])*r,(w[1]-b[1])*r),u};return new n.layer.Image({source:new n.source.ImageCanvas({canvasFunction:e,projection:"EPSG:3857"})})},c=function(){var e=o.map.control.getView(),t=n.proj.transform(e.getCenter(),"EPSG:3857","EPSG:4326");o.map.google.setCenter(new google.maps.LatLng(t[1],t[0]))},h=function(){var e=o.map.control.getView();o.map.google.setZoom(e.getZoom())},p=function(e){o.map.google||(o.map.google=new google.maps.Map(document.getElementById("gmap"),{mapTypeId:google.maps.MapTypeId.SATELLITE,disableDefaultUI:!0,keyboardShortcuts:!1,draggable:!1,disableDoubleClickZoom:!0,scrollwheel:!1,streetViewControl:!1}));var n=o.map.control.getView();n.on("change:center",c),n.on("change:resolution",h);var r=t("#"+o.config.map.target);r.remove(),n.setCenter(n.getCenter()),n.setZoom(n.getZoom()),o.map.google.controls[google.maps.ControlPosition.TOP_LEFT].push(r[0]),t("#"+o.config.google.target).show(),t(".ol-attribution").addClass("ol-attribution-google"),v(!0)},d=function(){var e=t("#"+o.config.map.target);t("#"+o.config.google.target).hide(),o.map.google.controls[google.maps.ControlPosition.TOP_LEFT].pop(),t("#"+o.config.google.target).parent().append(e);var n=o.map.control.getView();n.un("change:center",c),n.un("change:resolution",h),t(".ol-attribution").removeClass("ol-attribution-google"),v(!1)},v=function(e){var t,r=0,i=o.map.control.getInteractions();i.forEach(function(t){t instanceof n.interaction.DragPan&&(e?i.setAt(r,new n.interaction.DragPan({kinetic:new n.Kinetic(-1,10,200)})):i.setAt(r,new n.interaction.DragPan({kinetic:new n.Kinetic(-0.005,.05,100)}))),r++},this)},m=function(e,t){var r=null,i=null;i=o.map.control.get("base_layer_properties"),o.map.control.set("base_layer_properties",{type:e,set:t,exists:e!="google"});switch(e){case"bing":o.config.bing.key&&(r=new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.BingMaps({key:o.config.bing.key,imagerySet:t})}));break;case"stamen":r=new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.Stamen({layer:t})});break;case"mapquest":r=new n.layer.Tile({extent:[2137334.22323,4117771.96011,3332905.55435,5150499.54408],source:new n.source.MapQuest({layer:t})});break;case"ktimatologio":r=f();break;case"google":p(t);break;default:console.log("Base layer of type "+e+" is not supported.")}return i&&i.type=="google"&&d(),r},g=function(){var e=o.config.map.minZoom,t=o.config.map.maxZoom,n=o.config.map.zoom||o.config.map.minZoom;if(n<e||n>t)n=e;return n},y=function(){var e=new n.View({projection:s.Maps.CRS.Mercator,center:o.config.map.center||[0,0],zoom:g(),minZoom:o.config.map.minZoom,maxZoom:o.config.map.maxZoom,extent:[-20037508.3392,-20048966.1,20037508.3392,20048966.1]}),r=n.interaction.defaults();r.removeAt(r.getLength()-1),o.interactions.zoom=new n.interaction.DragZoom({condition:n.events.condition.shiftKeyOnly,style:new n.style.Style({fill:new n.style.Fill({color:[255,255,255,.4]}),stroke:new n.style.Stroke({color:"#3399CC",width:2})})}),r.push(o.interactions.zoom);var i=[];i.push(new n.control.Zoom({zoomInTipLabel:"",zoomOutTipLabel:""})),i.push(new n.control.ZoomSlider),i.push(new n.control.Attribution({tipLabel:"",collapsible:!1})),o.map.control=new n.Map({target:o.config.map.target,view:e,controls:i,interactions:r,ol3Logo:!1});var u,f=t("#base_layer option:selected");u=m(t(f).data("type"),t(f).data("set")),o.map.control.addLayer(u),u=a(),o.map.control.addLayer(u),u=l(),o.map.control.getLayers().insertAt(0,u);if(o.config.map.bbox){var c=o.map.control.getSize();e.fitExtent(o.config.map.bbox,c)}!o.map.config&&!o.preview&&navigator.geolocation&&o.config.geolocation&&navigator.geolocation.getCurrentPosition(function(t){var r=n.proj.transform([t.coords.longitude,t.coords.latitude],s.Maps.CRS.WGS84,s.Maps.CRS.Mercator);e.setCenter(r),e.setZoom(10)});var h=new n.control.MousePosition({coordinateFormat:function(e){return n.coordinate.format(e,"{x} , {y}",4)},projection:t("#pos_epsg option:selected").val(),className:"mouse-pos-text",target:t(".mouse-pos")[0]});o.map.control.addControl(h);var p=new n.control.ScaleLine({target:document.getElementById("scale-line")});o.map.control.addControl(p),t("#pos_epsg").selectpicker().change(function(){var e=n.proj.get(t("#pos_epsg option:selected").val());h.setProjection(e),o.actions.position.setProjection(e),t('[data-id="pos_epsg"]').blur()})},b=function(){t(".dialog-container").height(t(window).height()-50).width(t(window).width()-20);var e=t(window).width(),n=t(window).height(),r=t(".header").outerHeight(!0),i=t("#layer-tree-header").outerHeight(!0)+t("#layer-selection-header").outerHeight(!0),s=t("#layer-selection").outerHeight(!0),u=t(".footer").outerHeight(!0)+60;t("#layer-tree-group-result-container").height(n-i-s-u-t("#tree-filter").outerHeight(!0)),t("#layer-tree-organization-result-container").height(n-i-s-u-t("#tree-filter").outerHeight(!0)),t("#layer-tree-search-result").height(n-i-s-u-105),t("#layer-tree-search-result-container").height(n-i-s-u-105),t("#map").offset({top:r,left:0}).height(n-u+10),t(".resource-data-search").width(e-930+(t("#base-layer-label").is(":visible")?0:310)),t("#panel-left-splitter").is(":visible")&&t("#panel-left-splitter").css("left",t("#panel-left").width()),o.map.control.setSize([t("#map").width(),t("#map").height()])},w=function(e){if(t(".panel-left").hasClass("panel-left-hidden"))switch(e){case"group":t(".panel-left-label").css({bottom:s.i18n.getResource("index.topics.position")[1],right:s.i18n.getResource("index.topics.position")[0]}),t(".panel-left-label-image").attr("src","content/images/app/topics.svg"),t(".panel-left-label-text").html(s.i18n.getResource("index.topics")).css("padding","4px 0 0 7px");break;case"organization":t(".panel-left-label").css({bottom:s.i18n.getResource("index.organizations.position")[1],right:s.i18n.getResource("index.organizations.position")[0]}),t(".panel-left-label-image").attr("src","content/images/app/organization.svg"),t(".panel-left-label-text").html(s.i18n.getResource("index.organizations")).css("padding","4px 0 0 7px");break;case"search":t(".panel-left-label").css({bottom:s.i18n.getResource("index.search.position")[1],right:s.i18n.getResource("index.search.position")[0]}),t(".panel-left-label-image").attr("src","content/images/app/search.svg"),t(".panel-left-label-text").html(s.i18n.getResource("index.search")).css("padding","0px 0 0 7px")}},E=function(){o.ckan=new s.Maps.CKAN.Metadata({path:o.config.path,endpoint:o.config.ckan.endpoint,metadata:{database:o.config.ckan.metadata.database,path:o.config.ckan.metadata.path,version:o.config.ckan.metadata.version}}),o.resources=new s.Maps.ResourceManager({path:o.config.path,proxy:s.getProxyUrl(o.config.proxy),extent:o.config.map.extent,maxLayerCount:5}),o.components={},o.components.textSearch=new s.Maps.TextSearch({element:"location-search",map:o.map.control,endpoint:o.config.path,resources:o.resources}),o.components.layerTreeGroup=new s.Maps.LayerTree({element:"layer-tree-group",map:o.map.control,ckan:o.ckan,resources:o.resources,mode:s.Maps.LayerTreeViewMode.ByGroup,visible:!0}),o.components.layerTreeOrganization=new s.Maps.LayerTree({element:"layer-tree-organization",map:o.map.control,ckan:o.ckan,resources:o.resources,mode:s.Maps.LayerTreeViewMode.ByOrganization,visible:!1}),o.components.layerTreeSearch=new s.Maps.LayerTree({element:"layer-tree-search",map:o.map.control,ckan:o.ckan,resources:o.resources,mode:s.Maps.LayerTreeViewMode.ByFilter,visible:!1}),o.components.layerSelection=new s.Maps.LayerSelection({element:"layer-selection",map:o.map.control,ckan:o.ckan,resources:o.resources}),o.components.catalogInfoDialog=new s.Maps.Dialog({title:"",element:"dialog-1",visible:!1,width:400,height:200,buttons:{close:{text:"button.close",style:"primary"}}}),o.components.catalogInfoDialog.on("dialog:action",function(e){switch(e.action){case"close":this.hide()}}),o.components.tableBrowserDialog=new s.Maps.DialogTableBrowser({title:"Table Data",element:"dialog-2",visible:!1,width:800,height:400,buttons:{close:{text:"button.close",style:"primary"}}}),o.components.tableBrowserDialog.on("dialog:action",function(e){switch(e.action){case"close":this.hide()}}),o.actions.restoreZoomLevel=new s.Maps.Action({element:"restore-zoom",name:"restore-zoom",image:"content/images/app/restore-zoom-w.svg",title:"index.resotre-zoom",visible:!0}),o.actions.restoreZoomLevel.on("action:execute",function(e){o.map.control.getView().setZoom(g())}),o.config.feedback&&t(".feedback-label").click(function(){window.open(o.config.feedback[s.i18n.getLocale()])}),o.actions.export=new s.Maps.Action({element:"action-export",name:"export",image:"content/images/app/download-w.svg",title:"action.export.title",visible:!1}),o.actions.import=new s.Maps.ImportWmsTool({element:"action-wms",name:"wms",image:"content/images/app/add-layer-w.svg",title:"action.import-wms.title",map:o.map.control,resources:o.resources}),o.actions.import.on("layer:added",function(e){o.resources.createLayer(o.map.control,e.metadata,e.id)&&o.components.layerSelection.add(e.id,e.metadata)}),o.actions.upload=new s.Maps.UploadFileTool({element:"action-upload",name:"upload",image:"content/images/app/upload-w.svg",title:"action.upload-resource.title",map:o.map.control,resources:o.resources,endpoint:o.config.path}),o.actions.link=new s.Maps.PermalinkTool({element:"action-link",name:"link",image:"content/images/app/permalink-w.svg",title:"action.create-link.title",map:o.map.control,resources:o.resources,ckan:o.ckan,endpoint:o.config.path,mode:s.Maps.PermalinkTool.Mode.Link}),o.actions.embed=new s.Maps.PermalinkTool({element:"action-embed",name:"embed",image:"content/images/app/embed-map-w.svg",title:"action.create-link-embed.title",map:o.map.control,resources:o.resources,ckan:o.ckan,endpoint:o.config.path,mode:s.Maps.PermalinkTool.Mode.Embed}),o.actions.parse=new s.Maps.CoordinateParser({element:"action-parse",name:"parse",image:"content/images/app/coordinates-w.svg",title:"action.parse-coordinates.title",map:o.map.control,resources:o.resources}),o.actions.upload.on("resource:loaded",function(e){o.resources.getResourceMetadata(e.format.toUpperCase(),{url:e.url,text:e.text,filename:e.name,title:e.title,projection:e.projection}).then(function(t){o.resources.createLayer(o.map.control,t,e.id,e.title)&&o.components.layerSelection.add(e.id,t)})}),o.actions.position=new s.Maps.PositionTool({element:"action-position",name:"position",image:"content/images/app/map-location-w.svg",title:"action.set-position.title",map:o.map.control,projection:n.proj.get(t("#pos_epsg option:selected").val())}),o.actions.clear=new s.Maps.Action({element:"action-clear",name:"clear",image:"content/images/app/clear-w.svg",title:"action.clear.title",visible:!0,enabled:!0,"class":"btn-danger"}),o.actions.clear.on("action:execute",function(e){var t;for(t in o.tools)o.tools[t].clear();for(t in o.actions)o.actions[t].clear();for(t in o.components)o.components[t].clear()}),o.tools.length=new s.Maps.MeasureTool({element:"tool-length",name:"length",images:{enabled:"content/images/app/distance-w.svg",disabled:"content/images/app/distance.svg"},title:"tool.length.title",map:o.map.control,type:s.Maps.MeasureToolType.Length}),o.tools.area=new s.Maps.MeasureTool({element:"tool-area",name:"area",images:{enabled:"content/images/app/area-w.svg",disabled:"content/images/app/area.svg"},title:"tool.area.title",map:o.map.control,type:s.Maps.MeasureToolType.Area}),o.tools.export=new s.Maps.ExportTool({element:"tool-export",name:"export",images:{enabled:"content/images/app/draw-polygon-w.svg",disabled:"content/images/app/draw-polygon.svg"},title:"tool.export.title",map:o.map.control,resources:o.resources,action:o.actions.export,disabledFormats:o.config.export.disabledFormats,endpoint:o.config.path}),o.tools.select=new s.Maps.SelectTool({name:"select",active:!0,map:o.map.control,resources:o.resources}),o.tools.select.setActive(!0);var e=function(e){t(".tools-container").height("auto");var n=e.name;if(e.active){e.sender.hasActions()?t("#tool-actions-header").show():t("#tool-actions-header").hide(),n=e.sender.getName();for(var r in o.tools)n!=o.tools[r].getName()&&o.tools[r].setActive(!1)}else t("#tool-actions-header").hide(),o.tools.select.setActive(!0);b()};o.tools.length.on("tool:toggle",e),o.tools.area.on("tool:toggle",e),o.tools.export.on("tool:toggle",e),o.resources.on("layer:created",function(e){o.components.layerSelection.add(e.id);var t=e.id.split("_"),n=t[0];o.components.layerTreeGroup.expand(n),o.components.layerTreeOrganization.expand(n)}),t("body").on("click",".panel-left-hidden",function(e){t(".panel-left-handler").trigger("click")}),t(".panel-left-handler").click(function(e){e.preventDefault(),e.stopPropagation(),t(".panel-left").hasClass("panel-left-hidden")?(t(".panel-left-label").hide(),t(".panel-left").removeClass("panel-left-hidden"),t(".panel-left-handler").removeClass("panel-left-handler-toggle"),t(".panel-left").find(".panel-content").removeClass("panel-content-hidden"),t(".panel-left-splitter").show(),t(".panel-left").width(t(".panel-left-splitter").position().left)):(t(".panel-left-splitter").hide(),t(".panel-left-label").show(),t(".panel-left").addClass("panel-left-hidden"),t(".panel-left-handler").addClass("panel-left-handler-toggle"),t(".panel-left").find(".panel-content").addClass("panel-content-hidden"),t(".panel-left").width(30),w(o.ui.section))}),t(".tools-container").draggable({handle:".tools-header",containment:"parent"}),t(".tools-header-handler").click(function(){t(".tools-container-placholder").fadeIn(400),t(".tools-container").effect("transfer",{to:t(".tools-container-placholder")},400,function(){t(".tools-container").fadeOut(200)})}),t(".tools-container-placholder").click(function(){t(".tools-container").fadeIn(400),t(".tools-container-placholder").effect("transfer",{to:t(".tools-container")},400,function(){t(".tools-container-placholder").fadeOut(200)})}),t("#organization, #group, #search").click(function(){if(t(this).data("selected"))return;var e=t(this).attr("id");t(this).data("selected",!0).removeClass("active").addClass("inactive"),t("#"+o.ui.section).data("selected",!1).removeClass("inactive").addClass("active"),t("#"+o.ui.section+"-label").addClass("section-label-hidden"),t("#"+e+"-label").removeClass("section-label-hidden"),o.ui.section=e,e==="organization"?(t("#tree-filter").show(),o.components.layerTreeGroup.hide(),o.components.layerTreeSearch.hide(),o.components.layerTreeOrganization.show()):e==="group"&&(t("#tree-filter").show(),o.components.layerTreeOrganization.hide(),o.components.layerTreeSearch.hide(),o.components.layerTreeGroup.show()),e==="search"&&(t("#tree-filter").hide(),o.components.layerTreeGroup.hide(),o.components.layerTreeOrganization.hide(),o.components.layerTreeSearch.show()),b()});var r=function(e){e.sender!=o.components.layerTreeGroup&&o.components.layerTreeGroup.remove(e.id,!1),e.sender!=o.components.layerTreeOrganization&&o.components.layerTreeOrganization.remove(e.id,!1),e.sender!=o.components.layerTreeSearch&&o.components.layerTreeSearch.remove(e.id,!1),o.components.layerSelection.remove(e.id),b()},i=function(e){e.data&&(o.components.catalogInfoDialog.setTitle(e.data.title[s.i18n.getLocale()]),o.components.catalogInfoDialog.setContent(e.data.description[s.i18n.getLocale()]),o.components.catalogInfoDialog.show())},u=function(e){e.title&&(o.components.catalogInfoDialog.setTitle(e.title[s.i18n.getLocale()]),o.components.catalogInfoDialog.setContent('<div style="width: 100%; text-align: center;"><img style="text-align: center;" src="content/images/app/ajax-loader-big.gif"></div>'),o.components.catalogInfoDialog.show())},a=function(e){e.sender!=o.components.layerTreeGroup&&o.components.layerTreeGroup.add(e.id,!1),e.sender!=o.components.layerTreeOrganization&&o.components.layerTreeOrganization.add(e.id,!1),e.sender!=o.components.layerTreeSearch&&o.components.layerTreeSearch.add(e.id,!1)};o.components.layerTreeGroup.on("layer:added",a),o.components.layerTreeGroup.on("layer:removed",r),o.components.layerTreeGroup.on("catalog:info-loading",u),o.components.layerTreeGroup.on("catalog:info-loaded",i),o.components.layerTreeOrganization.on("layer:added",a),o.components.layerTreeOrganization.on("layer:removed",r),o.components.layerTreeOrganization.on("catalog:info-loading",u),o.components.layerTreeOrganization.on("catalog:info-loaded",i),o.components.layerTreeSearch.on("layer:added",a),o.components.layerTreeSearch.on("layer:removed",r),o.components.layerTreeSearch.on("catalog:info-loading",u),o.components.layerTreeSearch.on("catalog:info-loaded",i),o.components.layerTreeSearch.on("bbox:draw",function(e){C(),L()}),o.components.layerTreeSearch.on("bbox:apply",function(e){L("zoom"),k("select")}),o.components.layerTreeSearch.on("bbox:cancel",function(e){L("zoom"),k("select")});var f=function(e){b()},l=function(e){o.components.layerTreeGroup.remove(e.id),o.components.layerTreeOrganization.remove(e.id),o.components.layerTreeSearch.remove(e.id),b()};o.components.layerSelection.on("layer:added",f),o.components.layerSelection.on("layer:removed",l),t("#locale_selection").val(s.i18n.getLocale()),t("#locale_selection").selectpicker().change(function(){s.i18n.setLocale(t("#locale_selection option:selected").val()),t('[data-id="locale_selection"]').blur();var e=t("#tree-filter-text").val();o.components.layerTreeGroup.setFilter(e),o.components.layerTreeOrganization.setFilter(e),t(".selectpicker, .img-text").tooltip(),t(".selectpicker").tooltip("disable")}),t("#tree-filter-text").keyup(function(){var e=t(this).val();o.components.layerTreeGroup.setFilter(e),o.components.layerTreeOrganization.setFilter(e)}),t("#tree-filter-remove").click(function(){t("#tree-filter-text").val(""),o.components.layerTreeGroup.setFilter(null),o.components.layerTreeOrganization.setFilter(null),t(this).blur()}),t("#panel-left-splitter").draggable({axis:"x",opacity:.5,handle:".panel-left-splitter-handler",start:function(e,n){t(this).addClass("panel-left-splitter-dragging")},stop:function(e,n){t("#panel-left").width(n.position.left),t(this).removeClass("panel-left-splitter-dragging")},drag:function(e,t){t.position.left=Math.max(280,t.position.left),t.position.left=Math.min(550,t.position.left)}}),t(".panel-left-splitter-handler").dblclick(function(e){}),t(".selectpicker, .img-text").tooltip(),t(".selectpicker").tooltip("disable"),t(window).resize(b)},S=function(){},x=function(){N()},T=function(e,n,r){r=r===0?r:r||100;var i=o.map.control.get("base_layer_properties"),s=i.exists?o.map.control.getLayers().item(1):null,u=o.map.control.getLayers().item(i.exists?2:1);u.setOpacity(r/100);var a=m(e,n);a&&o.map.control.getLayers().insertAt(i.exists?2:1,a),s&&setTimeout(function(){o.map.control.getLayers().remove(s)},500),t("#base-layer-opacity").val(r),t("#base_layer").val(e+"-"+n).selectpicker("refresh"),t(".selectpicker").tooltip().tooltip("disable")},N=function(){t("#base_layer").selectpicker().change(function(e){var n=t("#base_layer option:selected"),r=t("#base-layer-opacity").val();T(t(n).data("type"),t(n).data("set"),r),t('[data-id="base_layer"]').blur()}),t("#base-layer-opacity").change(function(){var e=o.map.control.get("base_layer_properties");o.map.control.getLayers().item(e.exists?2:1).setOpacity(t(this).val()/100)})},C=function(){for(var e in o.tools)o.tools[e]&&o.tools[e].setEnabled(!1)},k=function(e){for(var t in o.tools)o.tools[t]&&o.tools[t].setEnabled(!0);e&&o.tools.hasOwnProperty(e)&&o.tools[e].setActive(!0)},L=function(e){for(var t in o.interactions)o.interactions[t].setActive(!1);e&&A(e)},A=function(e){e&&o.interactions.hasOwnProperty(e)&&o.interactions[e].setActive(!0)},O=function(){return new Promise(function(e,n){var i=new r;o.config.path==="/"?i.segment(["config","load",o.map.config]):i.segment([o.config.path,"config","load",o.map.config]),t.ajax({url:i.toString().replace(/\/\//g,"/").replace(/:\//g,"://"),context:this,dataType:"json"}).done(function(t){if(t.success){var n=t.config;T(n.base.type,n.base.set,n.base.opacity);var r=0,i=function(){if(r<n.layers.length){var e=n.layers[r];r++,o.ckan.loadPackageById(e.package).then(function(t){var n=o.ckan.getResourceById(e.resource);n&&(n=o.resources.setCatalogResourceMetadataOptions(n),o.resources.addResourceFromCatalog(o.map.control,n,e.opacity,e.key).then(i))},function(t){console.log("Failed to load resource "+e.resource+" from package "+e.package)})}else o.map.control.getView().setCenter(n.center),o.map.control.getView().setZoom(n.zoom)};i()}e(t)}).fail(function(e,t,r){console.log("Failed to save configuration : "+JSON.stringify(config)),n(r)})})},M=function(){if(!o.preview)return;o.ckan.loadPackageById(o.preview.package).then(function(e){var t=o.ckan.getResourceById(o.preview.resource);t&&o.resources.addResourceFromCatalog(o.map.control,t)},function(e){console.log("Failed to load resource "+o.preview.resource+" from package "+o.preview.package)})},_=function(){var e=s.i18n.getLocale();t("[data-i18n-id]").each(function(e,n){var r=t(this).data("i18n-type");switch(r){case"title":t(this).attr("title",s.i18n.getResource(t(this).data("i18n-id")));break;case"attribute":t(this).attr(t(this).data("i18n-name"),s.i18n.getResource(t(this).data("i18n-id")));break;default:var i=s.i18n.getResource(t(this).data("i18n-id"));i&&t(this).html(i)}});for(var n in o.components)o.components[n].localizeUI(e);t("#base_layer").selectpicker("refresh"),t(".selectpicker").tooltip().tooltip("disable"),w(o.ui.section)},D=function(){var e=s.i18n.getLocale();if(o.ckan){var t=o.ckan.getOrganizations();for(var n=0;n<t.length;n++)s.i18n.setResource(e,"organization."+t[n].id,t[n].caption[e]);var r=o.ckan.getGroups();for(var i=0;i<r.length;i++)s.i18n.setResource(e,"group."+r[i].id,r[i].caption[e]);var u=o.ckan.getPackages();for(var a=0;a<u.length;a++)for(var f=0;f<u[a].resources.length;f++)s.i18n.setResource(e,"node.resource."+u[a].resources[f].id,u[a].resources[f].name[e]);var l=o.ckan.getNodes();for(var c in l)s.i18n.setResource(e,"node."+l[c].id,l[c].caption[e])}};return s.initialize=function(){u(),s.i18n.setLocale(o.locale||"el").then(function(e){s.i18n.on("locale:load",function(){D()}),s.i18n.on("locale:change",function(){_(),b()}),D(),y(),E(),S(),x(),t("#loading-text").html("Initializing Catalog ... 0%");var n=function(){o.components.layerTreeGroup.refresh(),o.components.layerTreeOrganization.refresh(),setTimeout(function(){t("#block-ui").fadeOut(500).hide(),t("body").css("overflow-y","auto"),t("#view-layers").hasClass("ui-panel-closed")&&t("#view-layers").panel("toggle"),t("#search").focus(),o.map.config?O():M()},500),b()},r=function(){_();var e=t("#tree-filter-text").val();o.components.layerTreeGroup.setFilter(e),o.components.layerTreeOrganization.setFilter(e);if(o.ckan.isPreloadingEnabled()){var r=[],i=o.ckan.getPackages();for(var s=0;s<i.length;s++)for(var u=0;u<i[s].resources.length;u++){var a=i[s].resources[u];a.queryable&&r.push({wms:a.id,table:a.queryable.resource,geometry_type:a.queryable.geometry,srid:a.queryable.srid,template:a.queryable.template})}o.resources.setQueryableResources(r),n()}else t("#loading-text").html("Loading Metadata ... 0%"),o.resources.updateQueryableResources().then(function(e){t("#loading-text").html("Loading Metadata ... 100%"),n()})};o.ckan.isPreloadingEnabled()?o.ckan.preload().then(r):o.ckan.loadGroups().then(function(e){t("#loading-text").html("Initializing Catalog ... 50%"),o.ckan.loadOrganizations().then(function(e){t("#loading-text").html("Initializing Catalog ... 100%"),r()})})})},window.PublicaMundi=s,s});