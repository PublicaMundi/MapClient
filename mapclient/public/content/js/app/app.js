define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

    var members = {
		ui: {
			section: 'group'
		},
        config: module.config(),
        ckan: null,
        resources: null,
        map: {
            control: null,
            interactions: {
                zoom: {
                    control: null
                },
                bbox: {
                    control: null,
                    feature: null,
                    overlay: null
                }
            }
        },
        tools: {
            length: null,
            area: null,
            export: null
        },
        actions: {
            export: null
        },
        query: null,
        resource: null
    };

    var initializeParameters = function () {
        var resource = module.config().resource;

        // Set default values
        members.config.geolocation = true;
        members.config.map.minZoom = 3;
        members.config.map.maxZoom = 19;

        // Get additional configuration from the query string
        var query = URI.parse(window.location.href).query;
        if (query) {
            // Location parameters (zoom, center, geolocation, bounding box, etc.)
            var params = URI.parseQuery(query);

            if (params.bbox) {
                members.config.map.bbox = params.bbox.split(',').map(Number);
            } else {
                members.config.map.bbox = null;
            }

            if (params.center) {
                members.config.map.center = params.center.split(',').map(Number);
            }

            if (params.zoom) {
                members.config.map.zoom = params.zoom;
            }

            if (params.geolocation === 'off') {
                members.config.geolocation = false;
            }

            // Check for resource in query string (overrides main page parameter)
            if(params.resource) {
                resource = params.resource;
            }
        }

        if(resource) {
            if ((members.config.ckan) && (members.config.ckan.endpoint)) {
                var uri = new URI(members.config.ckan.endpoint);
                uri.segment(['api', '3', 'action', 'resource_show']);
                uri.addQuery({ id: resource });

                members.resource = uri.toString();
            }
        }
    };

	var createBaseLayer = function(type, set) {
		var layer = null;
		switch(type) {
			case 'bing':
				if(members.config.bing.key) {
					layer = new ol.layer.Tile({
						source: new ol.source.BingMaps({
							key: members.config.bing.key,
							imagerySet: set
						})
					});
				}
				break;
			case 'stamen':
				layer = new ol.layer.Tile({
					source: new ol.source.Stamen({layer: set })
				});
				break;
			case 'mapquest':
				layer = new ol.layer.Tile({
					source: new ol.source.MapQuest({layer: set })
				});
				break;
			case 'osm':
				layer = new ol.layer.Tile({
					source: new ol.source.OSM()
				});
				break;
			case 'ktimatologio':
				/* http://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx?				   
				   SERVICE=WMS&VERSION=1.1.0&
				   REQUEST=GetMap&
				   FORMAT=image%2Fpng&
				   TRANSPARENT=true&
				   LAYERS=KTBASEMAP&
				   WIDTH=256&HEIGHT=256&SRS=EPSG%3A900913&
				   STYLES=&
				   BBOX=2504688.542848654%2C4852834.0517692715%2C2661231.576776695%2C5009377.085697313					    
			   */
				var params = {
					'SERVICE': 'WMS',
					'VERSION': '1.1.0',
					'LAYERS': 'KTBASEMAP'
				};

				var source = new ol.source.TileWMS({
					url: 'http://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx',
					params: params,
					projection: 'EPSG:900913'
				});
				
				var fn = source.tileUrlFunction;
				
				source.tileUrlFunction = function(tileCoord, pixelRatio, projection) {
					var url = fn(tileCoord, pixelRatio, projection);
					var parts = URI.parse(url) || {};											
					var params = (parts.query ? URI.parseQuery(parts.query) : {});

					params.SRS = 'EPSG:900913';						

					var fixedUrl = URI.build({
						protocol: (parts.protocol ? parts.protocol : 'http'),
						hostname: parts.hostname,
						port: (parts.port === '80' ? '' : parts.port),
						path: parts.path,
						query: URI.buildQuery(params)
					});
					
					return fixedUrl;
				}
				
				layer = new ol.layer.Tile({
					source: source
				});
				break;
			default:
				console.log('Base layer of type ' + type + ' is not supported.');
		}

		return layer;
	};
  
    var initializeMap = function () {
        var minZoom = members.config.map.minZoom, 
            maxZoom = members.config.map.maxZoom, 
            zoom = members.config.map.zoom || members.config.map.minZoom;

        if ((zoom < minZoom) || (zoom > maxZoom)) {
            zoom = minZoom;
        }

        var view = new ol.View({
            projection: PublicaMundi.Maps.CRS.Mercator,
            center: members.config.map.center || [0, 0],
            zoom: zoom,
            minZoom: minZoom,
            maxZoom: maxZoom
        });

        var layers = [];

		var selection = $('#base_layer option:selected')
		var layer = createBaseLayer($(selection).data('type'), $(selection).data('set'));
            
		layers.push(layer);
		layers.push(new ol.layer.Tile({
			source: new ol.source.OSM(),
			opacity: ($('#base-layer-opacity').val() / 100.0)
		}));

        var interactions = ol.interaction.defaults();
        
        interactions.removeAt(interactions.getLength() -1);

        members.map.interactions.zoom.control = new ol.interaction.DragZoom({
            condition: ol.events.condition.shiftKeyOnly,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [255, 255, 255, 0.4]
                }),
                stroke: new ol.style.Stroke({
                    color: '#3399CC',
                    width: 2
                })
            })
        });

        interactions.push(members.map.interactions.zoom.control);
        
        members.map.control = new ol.Map({
            target: members.config.map.target,
            view: view,
            controls: [],
            interactions: interactions,
            ol3Logo: false,
            layers: layers
        });

        if (members.config.map.bbox) {
            var size = members.map.control.getSize();
            view.fitExtent(members.config.map.bbox, size);
        }

        if ((navigator.geolocation) && (members.config.geolocation)) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var center = ol.proj.transform([position.coords.longitude, position.coords.latitude], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                view.setCenter(center);
                view.setZoom(10);
            });
        }

        //Mouse Position
        var mousePositionControl = new ol.control.MousePosition({
            coordinateFormat: function (coordinate) {
                return ol.coordinate.format(coordinate, '{x} , {y}', 4);
            },
            projection: $('#pos_epsg option:selected').val(),
            className: 'mouse-pos-text',
            target: $('.mouse-pos')[0]
        });
        members.map.control.addControl(mousePositionControl);

        $('#pos_epsg').selectpicker().change(function () {
            mousePositionControl.setProjection(ol.proj.get($('#pos_epsg option:selected').val()));
            $('[data-id="pos_epsg"]').blur();
        });

		// Scale line control
		var scaleLineControl = new ol.control.ScaleLine({
			target: document.getElementById('scale-line')
		});
		members.map.control.addControl(scaleLineControl);

        // Feature overlays       
        members.map.interactions.bbox.overlay = new ol.FeatureOverlay({
            style: [
                new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: [255, 255, 255, 0.4]
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#27AE60',
                        width: 2
                    })
                })
            ]
        });
        members.map.interactions.bbox.overlay.setMap(members.map.control);
        
        // BBOX draw
        members.map.interactions.bbox.control = new ol.interaction.DragBox({
            condition: ol.events.condition.shiftKeyOnly,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [255, 255, 255, 0.4]
                }),
                stroke: new ol.style.Stroke({
                    color: '#27AE60',
                    width: 2
                })
            })
        });

        members.map.interactions.bbox.control.on('change:active', function (e) {

        });
        
        members.map.interactions.bbox.control.on('boxstart', function (e) {            
            members.map.interactions.bbox.overlay.getFeatures().clear();
            members.map.interactions.bbox.feature = null;
        });
        
        members.map.interactions.bbox.control.on('boxend', function (e) {            
            var geom = members.map.interactions.bbox.control.getGeometry();
            var feature = new ol.Feature({ name: 'bbox', geometry: geom });

            members.map.interactions.bbox.overlay.getFeatures().clear();
            members.map.interactions.bbox.overlay.addFeature(feature);

            members.map.interactions.bbox.feature = feature;
        });

        members.map.control.addInteraction(members.map.interactions.bbox.control);
        members.map.interactions.bbox.control.setActive(false);
    };

    var resize = function() {
        $('#dialog-container').height($(window).height()-50).width(($(window).width()-5));
        
        var height = $(window).height();

        var headerHeight = $('#layer-tree-header').outerHeight(true) + 
                           $('#layer-selection-header').outerHeight(true) + 
                           $('#tools-header').outerHeight(true);

        var selectionHeight = ( $('#layer-selection').is(':visible') ? $('#layer-selection').outerHeight(true) : 0);
        var toolsHeight = ( $('#tools').is(':visible') ? $('#tools').outerHeight(true) : 0);

        var offset = 100;
        
        $('#panel-content-left').height(height - offset);
        
        $('#layer-tree-group').height(height - headerHeight - selectionHeight - toolsHeight - offset);
        $('#layer-tree-organization').height(height - headerHeight - selectionHeight - toolsHeight - offset);
        $('#layer-tree-search').height(height - headerHeight - selectionHeight - toolsHeight - offset);
    };
          
    var initializeUI = function() {
        // Left sliding panel accordion events
        $('#layer-selection-header').click(function() {
            $('#layer-selection').show();
            $('#tools').hide();
            resize();
        });
        
        $('#tools-header').click(function() {
            $('#tools').show();
            $('#layer-selection').hide();
            resize();
        });
                
        // CKAN catalog
		members.ckan = new PublicaMundi.Maps.CKAN.Metadata({
			endpoint: module.config().ckan.endpoint
		});

        // Resources
		members.resources = new PublicaMundi.Maps.Resources.ResourceManager({
            path: (members.config.path ? members.config.path + '/' : ''),
			proxy: PublicaMundi.getProxyUrl(module.config().proxy)
		});

        // UI components
		members.components = {};

		members.components.layerTreeGroup = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-group',
			map: members.map,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByGroup,
			visible: true
		});
		
		members.components.layerTreeOrganization = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-organization',
			map: members.map,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByOrganization,
			visible: false
		});

        members.components.layerTreeSearch = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-search',
			map: members.map,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByFilter,
			visible: false
        });

		members.components.layerSelection = new PublicaMundi.Maps.LayerSelection({
			element: 'layer-selection',
			map: members.map,
			ckan: members.ckan,
			resources: members.resources
		});
        
        // Dialogs
        members.components.catalogInfoDialog = new PublicaMundi.Maps.Dialog({
            title: '',
            element: 'dialog-1',
            target : 'dialog-container',
            visible: false,
            width: 400,
            height: 200,
            buttons: {
                close : {
                    text: 'Κλείσιμο',
                    style: 'primary'
                }
            }
        });

        members.components.catalogInfoDialog.on('dialog:action', function(args){
                switch(args.action){ 
                    case 'close':
                        this.hide();
                        break;
                }
        });
        
        members.components.tableBrowserDialog = new PublicaMundi.Maps.DialogTableBrowser({
            title: 'Table Data',
            element: 'dialog-2',
            target : 'dialog-container',
            visible: false,
            width: 800,
            height: 400,
            buttons: {
                close : {
                    text: 'Κλείσιμο',
                    style: 'primary'
                }
            },
            endpoint: (members.config.path ? members.config.path + '/' : '') + members.config.api.endpoint
        });

        members.components.tableBrowserDialog.on('dialog:action', function(args){
                switch(args.action){ 
                    case 'close':
                        this.hide();
                        break;
                }
        });
        
        // UI actions
        members.actions.export = new PublicaMundi.Maps.Action({
            element: 'action-export',
            name: 'export',
            image: 'content/images/download-w.png',
            title: 'Εξαγωγή σε ShapeFile',
            visible: false
        });
        
        members.actions.export.on('action:execute', function() {
            if(this.isBusy()) {
                return;
            };

            var feature = members.tools.export.getFeature();

            if(feature) {
                var format = new ol.format.GeoJSON();
                var polygon = JSON.parse(format.writeGeometry(feature.getGeometry()));

                var layers = members.resources.getSelectedLayers();
                var resources = members.resources.getQueryableResources();

                var quyarable = [];
                for(var i=0; i<layers.length; i++) {
                    for(var j=0; j<resources.length; j++) {
                        if(layers[i].resource_id == resources[j].wms) {
                            quyarable.push({
                                table: resources[j].table,
                                title: layers[i].title
                            });
                            break;
                        }
                    }
                }

                if(quyarable.length > 0) {
                    this.suspendUI();
                                            
                    var query = members.query;
                    
                    query.reset().format(PublicaMundi.Data.Format.GeoJSON)

                    var files= [];
                    for(var i=0; i<quyarable.length; i++) {
                        files.push(quyarable[i].title);
                        
                        query.resource(quyarable[i].table).
                              contains(
                                polygon, {
                                    resource: quyarable[i].table, 
                                    name : 'the_geom'
                                });
                        if(i < (quyarable.length-1)) {
                            query.queue();
                        }
                    }
                    query.export(downloadShapeFile, files);
                }
            }
        });
                
        // UI tools
        members.tools.length = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-length',
            name: 'length',
            images: {
                enabled: 'content/images/ruler-w.png',
                disabled: 'content/images/ruler.png'
            },
            title: 'Μέτρηση απόστασης',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Length
        });
        
        members.tools.area = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-area',
            name: 'area',
            images: {
                enabled: 'content/images/surface-w.png',
                disabled: 'content/images/surface.png'
            },
            title: 'Μέτρηση εμβαδού',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Area
        });
        
        members.tools.export = new PublicaMundi.Maps.ExportTool({
            element: 'tool-export',
            name: 'export',
            images: {
                enabled: 'content/images/polygon-w.png',
                disabled: 'content/images/polygon.png'
            },
            title: 'Σχεδίαση πολυγώνου',
            map: members.map.control,
            actions: [members.actions.export]
        });

        members.tools.select = new PublicaMundi.Maps.SelectTool({
            element: 'tool-select',
            name: 'select',
            images: {
                enabled: 'content/images/cursor-w.png',
                disabled: 'content/images/cursor.png'
            },
            title: 'Επιλογή αντικειμένου',
            map: members.map.control,
            resources: members.resources,
            endpoint: members.config.api.endpoint
        });

        var handleToolToggle = function(args) {
            var name = args.name;
            for(var item in members.tools) {
                if((args.active) && (args.name != members.tools[item].getName())) {
                    members.tools[item].setActive(false);
                }
            }
            resize();
        };
                
        members.tools.length.on('tool:toggle', handleToolToggle);
        members.tools.area.on('tool:toggle', handleToolToggle);
        members.tools.export.on('tool:toggle', handleToolToggle);
        members.tools.select.on('tool:toggle', handleToolToggle);
        
        
        // Left sliding panel
		$('body').on('click', '.panel-left-hidden', function(e) {
			$('.panel-left-handler').trigger('click');
		});
		
        $('.panel-left-handler').click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			if($('.panel-left').hasClass('panel-left-visible')) {
				$('.panel-left').removeClass('panel-left-visible');
				$('.panel-left').addClass('panel-left-hidden');
				$('.panel-left-handler').addClass('panel-left-handler-toggle');
				$('.panel-left').find('.panel-content').addClass('panel-content-hidden');
				switch(members.ui.section) {
					case 'group':
						$('.panel-left-label').css({
							bottom: 125,
							right: -80
						});
						$('.panel-left-label').find('img').attr('src', 'content/images/comments.png');
						$('.panel-left-label').find('span').html('Θεματικές Ενότητες');
						break;
					case 'organization':
						$('.panel-left-label').css({
							bottom: 90,
							right: -47
						});
						$('.panel-left-label').find('img').attr('src', 'content/images/organization.png');
						$('.panel-left-label').find('span').html('Οργανισμοί');
						break;
					case 'search':
						$('.panel-left-label').css({
							bottom: 90,
							right: -44
						});
						$('.panel-left-label').find('img').attr('src', 'content/images/search.png');
						$('.panel-left-label').find('span').html('Αναζήτηση');
						break;
				}
				$('.panel-left-label').show();
			} else {
				$('.panel-left').removeClass('panel-left-hidden');
				$('.panel-left').addClass('panel-left-visible');
				$('.panel-left-handler').removeClass('panel-left-handler-toggle');
				$('.panel-left').find('.panel-content').removeClass('panel-content-hidden');
				$('.panel-left-label').hide();
			}
		});
       
        // Tooltips
        $('.selected-layer-opacity-label, .img-text').tooltip();

        // Tab control
		$('#organization, #group, #search').click(function() {
			if($(this).data('selected')) {
				return;
			}
			
			var id = $(this).attr('id');
			
			$(this).data('selected', true).removeClass('active').addClass('inactive');
			$('#' + members.ui.section).data('selected', false).removeClass('inactive').addClass('active');
			$('#' + members.ui.section + '-label').addClass('section-label-hidden');
			$('#' + id + '-label').removeClass('section-label-hidden');
			
			members.ui.section = id;
			
			if(id === 'organization') {
				members.components.layerTreeGroup.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeOrganization.show();
			} else if (id === 'group') {
				members.components.layerTreeOrganization.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeGroup.show();
			} if (id === 'search') {
                members.components.layerTreeGroup.hide();
				members.components.layerTreeOrganization.hide();
                members.components.layerTreeSearch.show();
			}
		});
		
        // Layer handling events
		var layerAdded = function(args) {
			members.components.layerSelection.add(args.id, args.title, args.legend);
		};
		
		var layerRemoved  = function(args) {
			members.components.layerSelection.remove(args.id);
		}
		
        var showCatalogObjectInfo = function(args) {
            if(args.data) {
                switch(args.type) {
                    case 'group':
                        members.components.catalogInfoDialog.setTitle(args.data.caption);
                        members.components.catalogInfoDialog.setContent(args.data.description);
                        members.components.catalogInfoDialog.show();
                        break;
                    case 'organization':
                        members.components.catalogInfoDialog.setTitle(args.data.caption);
                        members.components.catalogInfoDialog.setContent(args.data.description);
                        members.components.catalogInfoDialog.show();
                        break;
                    case 'package':
                        members.components.catalogInfoDialog.setTitle(args.data.title);
                        members.components.catalogInfoDialog.setContent(args.data.notes);
                        members.components.catalogInfoDialog.show();
                        break;
                }
            }
        };
        
		members.components.layerTreeGroup.on('layer:added', layerAdded);
		members.components.layerTreeGroup.on('layer:removed', layerRemoved);
        members.components.layerTreeGroup.on('catalog:info', showCatalogObjectInfo);
        
		members.components.layerTreeOrganization.on('layer:added', layerAdded);
        members.components.layerTreeOrganization.on('layer:removed', layerRemoved);
        members.components.layerTreeOrganization.on('catalog:info', showCatalogObjectInfo);
        
        members.components.layerTreeSearch.on('layer:added', layerAdded);
        members.components.layerTreeSearch.on('layer:removed', layerRemoved);
        members.components.layerTreeSearch.on('catalog:info', showCatalogObjectInfo);

        // Interaction events
        members.components.layerTreeSearch.on('bbox:draw', function(args) {
            disableAllTools();
            disableAllInteractions('bbox');
        });

        members.components.layerTreeSearch.on('bbox:apply', function(args) {
            disableAllInteractions('zoom');
            
            this.setQueryBoundingBox(members.map.interactions.bbox.feature);
            
            enableAllTools();
        });

        members.components.layerTreeSearch.on('bbox:cancel', function(args) {
            disableAllInteractions('zoom');
            
            members.map.interactions.bbox.overlay.getFeatures().clear();
            
            var feature = this.getQueryBoundingBox();
            if(feature) {
                members.map.interactions.bbox.overlay.addFeature(feature);
                members.map.interactions.bbox.feature = feature;
            } else {
                members.map.interactions.bbox.feature = null;
            }
            
            enableAllTools();
        });
        
        members.components.layerTreeSearch.on('bbox:remove', function(args) {
            members.map.interactions.bbox.overlay.getFeatures().clear();
            members.map.interactions.bbox.feature = null;
            
            this.setQueryBoundingBox(null);
        });
        
		var layerSelectionAdded  = function(args) {
            resize();
		}
        
		var layerSelectionRemoved  = function(args) {
			members.components.layerTreeGroup.remove(args.id);
            resize();
		}
		
		members.components.layerSelection.on('layer:added', layerSelectionAdded);
        
        members.components.layerSelection.on('layer:removed', layerSelectionRemoved);
        
        // Initialize layeout
        resize();
        
        $(window).resize(resize);
	};

    var attachEvents = function () {	
        attachBaseLayerSelectionEvents();
	};
    	
    var attachBaseLayerSelectionEvents = function () {	
        $('#base_layer').selectpicker().change(function(e) {	
			var selection = $('#base_layer option:selected')
            var newBaseLayer = createBaseLayer($(selection).data('type'), $(selection).data('set'));
            
			var oldBaseLayer = members.map.control.getLayers().item(0);

            members.map.control.getLayers().insertAt(0, newBaseLayer);
            setTimeout(function () {
                members.map.control.getLayers().remove(oldBaseLayer);
            }, 1000);
            
            $('[data-id="base_layer"]').blur();
        });
        
        $('#base-layer-opacity').change(function() {
			members.map.control.getLayers().item(1).setOpacity($(this).val() / 100.0);
		});
    };

    var disableAllTools = function() {
        for(var item in members.tools) {
            if(members.tools[item]) {
                members.tools[item].setEnabled(false);
            }
        }
    }
    
    var enableAllTools = function() {
        for(var item in members.tools) {
            if(members.tools[item]) {
                members.tools[item].setEnabled(true);
            }
        }
    }
    
    var disableAllInteractions = function(name) {
        for(var item in members.map.interactions) {
            members.map.interactions[item].control.setActive(false);
        }
        
        if(name) {
            enableInteraction(name);
        }
    };

    var enableInteraction = function(name) {
        members.map.interactions[name].control.setActive(true);
    };

    var downloadShapeFile = function(data, execution) {
        members.actions.export.resumeUI();

        if(data.success) {
            jQuery('#export-download-frame').remove();
            jQuery('body').append('<div id="export-download-frame" style="display: none"><iframe src="' + members.config.api.endpoint + 'api/download?code=' + data.code + '"></iframe></div>');
        }
    }
    
    var initializeResourcePreview = function () {
        if (!members.resource) {
            return;
        }

        var url = members.resource;

        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (response) {
            if ((response.success) && (response.result)) {
                members.resources.addResourceFromCatalog(members.map.control, response.result);
            }
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.log('Failed to load resource ' + url);
        });
    };

    PublicaMundi.initialize = function () {
        initializeParameters();

        initializeMap();

		initializeUI();
		
        attachEvents();

		$('#loading-text').html('Initializing Catalog ... 0%');
		
        members.ckan.loadGroups().then(function(groups) {
			$('#loading-text').html('Initializing Catalog ... 50%');
			members.ckan.loadOrganizations().then(function(organization) {
				$('#loading-text').html('Initializing Catalog ... 100%');

				members.components.layerTreeGroup.refresh();
				members.components.layerTreeOrganization.refresh();

				$('#loading-text').html('Loading Metadata ... 0%');
				members.resources.updateQueryableResources().then(function(resources) {				
					members.query = new PublicaMundi.Data.Query(members.config.api.endpoint);
					
					$('#loading-text').html('Loading Metadata ... 100%');
					
					setTimeout(function () {
						$('#block-ui').fadeOut(500).hide();
						$('body').css('overflow-y', 'auto');

						if ($('#view-layers').hasClass('ui-panel-closed')) {
							$('#view-layers').panel('toggle');
						}
						$('#search').focus();
						
						initializeResourcePreview();
					}, 500);
				});
			});
		});

        // Debug ...
        window.members = members;
    };

    return PublicaMundi;
});
