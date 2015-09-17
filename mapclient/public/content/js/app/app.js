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
			import: null,
            export: null,
            upload: null,
            position: null
        },
        preview: null,
        locale: null
    };

    window.members = members;

    members.config.path = members.config.path || '/';

    PublicaMundi.Data.configure({
        proxy: PublicaMundi.getProxyUrl(module.config().proxy),
        endpoint: members.config.path,
        wps: module.config().api.wps
    });

    PublicaMundi.Data.WPS.configure({
        debug: module.config().debug,
        mappings : {
            'Buffer': {
                id: 'ogr.Buffer',
                params: [{
                    name: 'InputPolygon',
                    type: 'complex',
                    mimeType: 'text/xml'
                }, {
                    name :'BufferDistance',
                    type: 'literal'
                }],
                result: 'Result'
            },
            'Voronoi': {
                id: 'cgal.Voronoi',
                params: [{
                    name : 'InputPoints',
                    type: 'complex',
                    mimeType: 'text/xml'
                }],
                result: 'Result'
            },
            'Centroid': {
                id: 'ogr.Centroid',
                params: [{
                    name : 'InputPolygon',
                    type: 'complex',
                    mimeType: 'text/xml'
                }],
                result: 'Result'
            }
        }
    });

    var initializeParameters = function () {
        // Set default values
        members.config.geolocation = true;
        members.config.map.minZoom = 7;
        members.config.map.maxZoom = 19;

        // Get additional configuration from the query string
        var query = URI.parse(window.location.href).query;
        if (query) {
            // Location parameters (zoom, center, geolocation, bounding box, etc.)
            var params = URI.parseQuery(query);

            if (params.config) {
                members.map.config = params.config;
            }

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

            // Set locale
            if (params.locale) {
                members.locale = params.locale;
            }

            // Preview resource
            if((!params.config) && (params.package) && (params.resource)) {
				members.preview = {
					package : params.package,
					resource : params.resource
				};
			}
        }
    };

	var createBaseLayer = function(type, set, opacity) {
		var layer = null;
        opacity = (opacity === 0 ? opacity : opacity || 100);

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
					projection: 'EPSG:900913',
					attributions: [
						new ol.Attribution({
							html: '<a href="' + PublicaMundi.i18n.getResource('attribution.ktimatologio.url') + '" ' +
								  'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">' +
								  '<img src="content/images/ktimatologio-logo.png"/></a>'
						})
					]
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

        layer.publicamundi = {
            'type' : type,
            'set' : set
        };

        layer.setOpacity(opacity);

		return layer;
	};

    var getDefaultZoomLevel = function() {
        var minZoom = members.config.map.minZoom,
            maxZoom = members.config.map.maxZoom,
            zoom = members.config.map.zoom || members.config.map.minZoom;

        if ((zoom < minZoom) || (zoom > maxZoom)) {
            zoom = minZoom;
        }

        return zoom;
    };

    var initializeMap = function () {
        var view = new ol.View({
            projection: PublicaMundi.Maps.CRS.Mercator,
            center: members.config.map.center || [0, 0],
            zoom: getDefaultZoomLevel(),
            minZoom: members.config.map.minZoom,
            maxZoom: members.config.map.maxZoom,
            extent: [-20026376.39, -20048966.10, 20026376.39, 20048966.10]
        });

        var layers = [];

		var selection = $('#base_layer option:selected')
		var layer = createBaseLayer($(selection).data('type'), $(selection).data('set'));

		layers.push(layer);
		layers.push(new ol.layer.Tile({
			source: new ol.source.OSM({
				attributions: [
					ol.source.OSM.ATTRIBUTION
				]
			}),
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

        var controls = []; //ol.control.defaults();
        controls.push(new ol.control.Zoom({
			zoomInTipLabel : '',
			zoomOutTipLabel : ''
		}));
        controls.push(new ol.control.ZoomSlider());
        controls.push(new ol.control.Attribution({
			tipLabel: '',
			collapsible : false
		}));

        members.map.control = new ol.Map({
            target: members.config.map.target,
            view: view,
            controls: controls,
            interactions: interactions,
            ol3Logo: false,
            layers: layers
        });

        if (members.config.map.bbox) {
            var size = members.map.control.getSize();
            view.fitExtent(members.config.map.bbox, size);
        }

        if ((!members.map.config) && (!members.preview) && (navigator.geolocation) && (members.config.geolocation)) {
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
            var projection = ol.proj.get($('#pos_epsg option:selected').val());

            mousePositionControl.setProjection(projection);
            members.actions.position.setProjection(projection);

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

    // TODO : Propagate resize events to controls
    var resize = function() {
        $('.dialog-container').height($(window).height()-50).width(($(window).width()-20));

        var width = $(window).width();
        var height = $(window).height();

        var headerHeight = $('.header').outerHeight(true);

        var catalogHeight = $('#layer-tree-header').outerHeight(true) +
                            $('#layer-selection-header').outerHeight(true);

        var selectionHeight = $('#layer-selection').outerHeight(true);

        var footerHeight = $('.footer').outerHeight(true) + 60;

        $('#layer-tree-group-result-container').height(height - catalogHeight - selectionHeight - footerHeight - $('#tree-filter').outerHeight(true));
        $('#layer-tree-organization-result-container').height(height - catalogHeight - selectionHeight - footerHeight - $('#tree-filter').outerHeight(true));
        $('#layer-tree-search').height(height - catalogHeight - selectionHeight - footerHeight - $('#tree-filter').outerHeight(true));

        $('#map').offset({top : headerHeight , left : 0}).height(height - footerHeight + 10);

        $('.resource-data-search').width(width - 933);

        members.map.control.setSize([$('#map').width(), $('#map').height()]);
    };

    var setHeaderPosition = function(section) {
        if($('.panel-left').hasClass('panel-left-hidden')) {
            switch(section) {
                case 'group':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.topics.position')[1],
                        right: PublicaMundi.i18n.getResource('index.topics.position')[0]
                    });
                    $('.panel-left-label').find('img').attr('src', 'content/images/comments.png');
                    $('.panel-left-label').find('span').html(PublicaMundi.i18n.getResource('index.topics'));
                    break;
                case 'organization':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.organizations.position')[1],
                        right: PublicaMundi.i18n.getResource('index.organizations.position')[0]
                    });
                    $('.panel-left-label').find('img').attr('src', 'content/images/organization.png');
                    $('.panel-left-label').find('span').html(PublicaMundi.i18n.getResource('index.organizations'));
                    break;
                case 'search':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.search.position')[1],
                        right: PublicaMundi.i18n.getResource('index.search.position')[0]
                    });
                    $('.panel-left-label').find('img').attr('src', 'content/images/search.png');
                    $('.panel-left-label').find('span').html(PublicaMundi.i18n.getResource('index.search'));
                    break;
            }
        }
    };

    var initializeUI = function() {
        // Tools panel accordion events
        $('#tools-header').click(function() {

        });

        // CKAN catalog
		members.ckan = new PublicaMundi.Maps.CKAN.Metadata({
			endpoint: module.config().ckan.endpoint,
            metadata: {
                path: module.config().ckan.metadata.path,
                version: module.config().ckan.metadata.version
            }
		});

        // Resource manager
		members.resources = new PublicaMundi.Maps.ResourceManager({
            path: members.config.path,
			proxy: PublicaMundi.getProxyUrl(module.config().proxy),
			extent: members.config.map.extent,
            maxLayerCount: 5
		});

        // UI components
		members.components = {};

		members.components.textSearch = new PublicaMundi.Maps.TextSearch({
			element: 'location-search',
			map: members.map.control,
			endpoint: members.config.path
		});

		members.components.layerTreeGroup = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-group',
			map: members.map.control,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByGroup,
			visible: true
		});

		members.components.layerTreeOrganization = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-organization',
			map: members.map.control,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByOrganization,
			visible: false
		});

        members.components.layerTreeSearch = new PublicaMundi.Maps.LayerTree({
			element: 'layer-tree-search',
			map: members.map.control,
			ckan: members.ckan,
			resources: members.resources,
			mode: PublicaMundi.Maps.LayerTreeViewMode.ByFilter,
			visible: false
        });

		members.components.layerSelection = new PublicaMundi.Maps.LayerSelection({
			element: 'layer-selection',
			map: members.map.control,
			ckan: members.ckan,
			resources: members.resources
		});

        // Dialogs
        members.components.catalogInfoDialog = new PublicaMundi.Maps.Dialog({
            title: '',
            element: 'dialog-1',
            visible: false,
            width: 400,
            height: 200,
            buttons: {
                close : {
                    text: 'button.close',
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
            visible: false,
            width: 800,
            height: 400,
            buttons: {
                close : {
                    text: 'button.close',
                    style: 'primary'
                }
            }
        });

        members.components.tableBrowserDialog.on('dialog:action', function(args){
                switch(args.action){
                    case 'close':
                        this.hide();
                        break;
                }
        });

        // UI actions
        members.actions.restoreZoomLevel = new PublicaMundi.Maps.Action({
            element: 'restore-zoom',
            name: 'restore-zoom',
            image: 'content/images/restore-zoom-w.png',
            title: 'index.resotre-zoom',
            visible: true
        });

        members.actions.restoreZoomLevel.on('action:execute', function(args) {
            members.map.control.getView().setZoom(getDefaultZoomLevel());
        });

        if(members.config.feedback) {
            members.actions.feedback = new PublicaMundi.Maps.Action({
                element: 'action-feedback',
                name: 'feedback',
                image: 'content/images/comments-w.png',
                title: 'index.feedback',
                visible: true
            });

            members.actions.feedback.on('action:execute', function(args) {
                window.open(members.config.feedback);
            });
        }

        members.actions.export = new PublicaMundi.Maps.Action({
            element: 'action-export',
            name: 'export',
            image: 'content/images/download-w.png',
            title: 'action.export.title',
            visible: false
        });

        members.actions.import = new PublicaMundi.Maps.ImportWmsTool({
            element: 'action-wms',
            name: 'wms',
            image: 'content/images/layers-w.png',
            title: 'action.import-wms.title',
            map: members.map.control,
            resources: members.resources
        });

		members.actions.import.on('layer:added', function(args) {
			if(members.resources.createLayer(members.map.control, args.metadata, args.id)) {
				members.components.layerSelection.add(args.id, args.metadata);
			}
		});

        members.actions.upload = new PublicaMundi.Maps.UploadFileTool({
            element: 'action-upload',
            name: 'upload',
            image: 'content/images/upload-w.png',
            title: 'action.upload-resource.title',
            map: members.map.control,
            resources: members.resources,
            endpoint: members.config.path
        });

        members.actions.link = new PublicaMundi.Maps.PermalinkTool({
            element: 'action-link',
            name: 'link',
            image: 'content/images/map-w.png',
            title: 'action.create-link.title',
            map: members.map.control,
            resources: members.resources,
            ckan: members.ckan,
            endpoint: members.config.path
        });

        members.actions.upload.on('resource:loaded', function(args) {
            members.resources.getResourceMetadata(args.format.toUpperCase(), {
                url: args.url,
                text: args.text,
                filename: args.name,
                title: args.title,
                projection: args.projection
            }).then(function(metadata) {
                if(members.resources.createLayer(members.map.control, metadata, args.id)) {
                    members.components.layerSelection.add(args.id, metadata);
                }
            });
        });

        members.actions.position = new PublicaMundi.Maps.PositionTool({
            element: 'action-position',
            name: 'position',
            image: 'content/images/center-direction-w.png',
            title: 'action.set-position.title',
            map: members.map.control,
            projection: ol.proj.get($('#pos_epsg option:selected').val())
        });

        // UI tools
        members.tools.length = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-length',
            name: 'length',
            images: {
                enabled: 'content/images/ruler-w.png',
                disabled: 'content/images/ruler.png'
            },
            title: 'tool.length.title',
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
            title: 'tool.area.title',
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
            title: 'tool.export.title',
            map: members.map.control,
            resources: members.resources,
            action: members.actions.export,
            disabledFormats: members.config.export.disabledFormats,
            endpoint: members.config.path
        });

        members.tools.select = new PublicaMundi.Maps.SelectTool({
            name: 'select',
            active: true,
            map: members.map.control,
            resources: members.resources
        });

        members.tools.select.setActive(true);

        var handleToolToggle = function(args) {
            var name = args.name;
            if(args.active) {
                for(var item in members.tools) {
                    if(args.name != members.tools[item].getName()) {
                        members.tools[item].setActive(false);
                    }
                }
            } else {
                members.tools.select.setActive(true);
            }
            resize();
        };

        members.tools.length.on('tool:toggle', handleToolToggle);
        members.tools.area.on('tool:toggle', handleToolToggle);
        members.tools.export.on('tool:toggle', handleToolToggle);

        // Layer manager
        members.resources.on('layer:created', function(args) {
			members.components.layerSelection.add(args.id);
		});

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

                setHeaderPosition(members.ui.section);

				$('.panel-left-label').show();
			} else {
				$('.panel-left').removeClass('panel-left-hidden');
				$('.panel-left').addClass('panel-left-visible');
				$('.panel-left-handler').removeClass('panel-left-handler-toggle');
				$('.panel-left').find('.panel-content').removeClass('panel-content-hidden');
				$('.panel-left-label').hide();
			}
		});

        // Make tool window draggable
        $('.tools-container').draggable({handle : '.tools-header', containment: 'parent'})

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
		var layerRemoved  = function(args) {
			members.components.layerSelection.remove(args.id);
		}

        var showCatalogObjectInfo = function(args) {
            if(args.data) {
                switch(args.type) {
                    case 'group':
                        members.components.catalogInfoDialog.setTitle(args.data.caption[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.setContent(args.data.description[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.show();
                        break;
                    case 'organization':
                        members.components.catalogInfoDialog.setTitle(args.data.caption[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.setContent(args.data.description[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.show();
                        break;
                    case 'package':
                        members.components.catalogInfoDialog.setTitle(args.data.title[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.setContent(args.data.notes[PublicaMundi.i18n.getLocale()]);
                        members.components.catalogInfoDialog.show();
                        break;
                }
            }
        };

		members.components.layerTreeGroup.on('layer:removed', layerRemoved);
        members.components.layerTreeGroup.on('catalog:info', showCatalogObjectInfo);

        members.components.layerTreeOrganization.on('layer:removed', layerRemoved);
        members.components.layerTreeOrganization.on('catalog:info', showCatalogObjectInfo);

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

        // Enable locale selection
        $("#locale_selection").val(PublicaMundi.i18n.getLocale());

        $('#locale_selection').selectpicker().change(function () {
            PublicaMundi.i18n.setLocale($('#locale_selection option:selected').val());
            $('[data-id="locale_selection"]').blur();
        });

        // Enable package filtering
        $('#tree-filter-text').keyup(function() {
            var term = $(this).val();

            members.components.layerTreeGroup.filter(term);
            members.components.layerTreeOrganization.filter(term);
        });


        $('#tree-filter-remove').click(function() {
            $('#tree-filter-text').val('');
            members.components.layerTreeGroup.filter(null);
            members.components.layerTreeOrganization.filter(null);
            $(this).blur();
        });

        // Initialize layout
        $(window).resize(resize);
	};

    var attachEvents = function () {
        attachBaseLayerSelectionEvents();
	};

    var setBaseLayer = function(type, set, opacity) {
        var newBaseLayer = createBaseLayer(type, set, opacity);

        var oldBaseLayer = members.map.control.getLayers().item(0);

        members.map.control.getLayers().insertAt(0, newBaseLayer);
        setTimeout(function () {
            members.map.control.getLayers().remove(oldBaseLayer);
        }, 1000);

        $('#base_layer').val(type + '-' + set).selectpicker('refresh');
    };

    var attachBaseLayerSelectionEvents = function () {
        $('#base_layer').selectpicker().change(function(e) {
			var selection = $('#base_layer option:selected')

            setBaseLayer($(selection).data('type'), $(selection).data('set'));

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

    var initializeConfiguration = function() {
        return new Promise(function(resolve, reject) {
            var uri = new URI(members.config.path);
            uri.segment(['config', 'load', members.map.config]);

            $.ajax({
                url: uri.toString(),
                context: this,
                dataType: "json",
            }).done(function (response) {
                if(response.success) {
                    var config = response.config;

                    setBaseLayer(config.base.type, config.base.set, config.base.opacity);

                    var index = 0;

                    var loader = function() {
                        if(index < config.layers.length) {
                            var layer = config.layers[index];
                            index++;

                            members.ckan.loadPackageById(layer.package).then(function(data) {
                                var resource = members.ckan.getResourceById(layer.resource);
                                if(resource) {
                                    members.resources.addResourceFromCatalog(members.map.control, resource, layer.opacity).then(loader);
                                }
                            }, function(error) {
                                console.log('Failed to load resource ' + layer.resource + ' from package ' + layer.package);
                            });
                        } else {
                            // All layers have been loaded. Any metadata have been loaded asynchronously
                            members.map.control.getView().setCenter(config.center);
                            members.map.control.getView().setZoom(config.zoom);
                        }
                    };

                    loader();
                }

                resolve(response);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                console.log('Failed to save configuration : ' + JSON.stringify(config));

                reject(errorThrown);
            });
        });
    };

    var initializeResourcePreview = function () {
        if (!members.preview) {
            return;
        }

        members.ckan.loadPackageById(members.preview.package).then(function(data) {
			var resource = members.ckan.getResourceById(members.preview.resource);
			if(resource) {
				members.resources.addResourceFromCatalog(members.map.control, resource);
			}
		}, function(error) {
			console.log('Failed to load resource ' + members.preview.resource + ' from package ' + members.preview.package);
		});
    };

    var localizeUI = function() {
        var locale = PublicaMundi.i18n.getLocale();

        $('[data-i18n-id]').each(function(index, element) {
            var type = $(this).data('i18n-type');
            switch(type) {
                case 'title':
                    $(this).attr('title', PublicaMundi.i18n.getResource($(this).data('i18n-id')));
                    break;
                case 'attribute':
                    $(this).attr($(this).data('i18n-name'), PublicaMundi.i18n.getResource($(this).data('i18n-id')));
                    break;
                default:
                    var text = PublicaMundi.i18n.getResource($(this).data('i18n-id'));
                    if(text) {
                        $(this).html(text);
                    }
                    break;
            }
        });

        for(var c in members.components) {
            members.components[c].localizeUI(locale);
        }

        $('#base_layer').selectpicker('refresh');

        setHeaderPosition(members.ui.section);
    };

    var mergeCkanResources = function() {
        var locale = PublicaMundi.i18n.getLocale();
        if(members.ckan) {
            var organizations = members.ckan.getOrganizations();

            for(var o=0; o < organizations.length; o++) {
                PublicaMundi.i18n.setResource(locale, 'organization.' + organizations[o].id, organizations[o].caption[locale]);
            }
            var groups = members.ckan.getGroups();
            for(var g=0; g < groups.length; g++) {
                PublicaMundi.i18n.setResource(locale, 'group.' + groups[g].id, groups[g].caption[locale]);
            }
        }
    }

    PublicaMundi.initialize = function () {
        initializeParameters();

        PublicaMundi.i18n.setLocale(members.locale || 'el').then(function(strings) {
            PublicaMundi.i18n.on('locale:load', function() {
                mergeCkanResources();
            });

            PublicaMundi.i18n.on('locale:change', function() {
                localizeUI();

                members.components.layerTreeGroup.refresh();
                members.components.layerTreeOrganization.refresh();

                resize();
            });

            mergeCkanResources();

            localizeUI();

            initializeMap();

            initializeUI();

            attachEvents();

            $('#loading-text').html('Initializing Catalog ... 0%');

            var afterPreload = function() {
                // Refresh localization strings (CKAN metadata may have added new resources)
                localizeUI();

                members.components.layerTreeGroup.refresh();
                members.components.layerTreeOrganization.refresh();

                var term = $('#tree-filter-text').val();

                members.components.layerTreeGroup.filter(term);
                members.components.layerTreeOrganization.filter(term);

                $('#loading-text').html('Loading Metadata ... 0%');
                members.resources.updateQueryableResources().then(function(resources) {
                    $('#loading-text').html('Loading Metadata ... 100%');

                    setTimeout(function () {
                        $('#block-ui').fadeOut(500).hide();
                        $('body').css('overflow-y', 'auto');

                        if ($('#view-layers').hasClass('ui-panel-closed')) {
                            $('#view-layers').panel('toggle');
                        }
                        $('#search').focus();

                        if(members.map.config) {
                            initializeConfiguration();
                        } else {
                            initializeResourcePreview();
                        }
                    }, 500);
                });

                resize();
            }

            if(members.ckan.isPreloadingEnabled()) {
                members.ckan.preload().then(afterPreload);
            } else {
                members.ckan.loadGroups().then(function(groups) {
                    $('#loading-text').html('Initializing Catalog ... 50%');
                    members.ckan.loadOrganizations().then(function(organization) {
                        $('#loading-text').html('Initializing Catalog ... 100%');

                        afterPreload();
                    });
                });
            }
        });
    };

    return PublicaMundi;
});
