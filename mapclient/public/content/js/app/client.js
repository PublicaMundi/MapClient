﻿define(['module', 'jquery', 'ol', 'URIjs/URI', 'data_api', 'shared'], function (module, $, ol, URI, API, PublicaMundi) {
    "use strict";

    var members = {
		ui: {
			section: 'group'
		},
        config: module.config(),
        ckan: null,
        resources: null,
        map: {
            config: null,
            control: null,
            google: null
        },
        interactions: { },
        tools: { },
        actions: { },
        preview: null,
        locale: null
    };

    members.config.path = members.config.path || '/';

    API.Data.configure({
        debug: members.config.debug,
        endpoint: members.config.path
    });

    var initializeParameters = function () {
        // Set default values
        members.config.geolocation = true;
        members.config.map.minZoom = members.config.map.minZoom || 7;
        members.config.map.maxZoom = members.config.map.maxZoom || 19;

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

    var createOSM = function() {
        if(members.config.servers.osm.length > 0) {
            // 1: Use custom XYZ source
            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: new ol.source.XYZ({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ],
                    urls: members.config.servers.osm
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        } else if(members.config.servers.mapproxy.length > 0) {
            // 2: User Map Proxy
            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: new ol.source.TileWMS({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ],
                    url: members.config.servers.mapproxy,
                    params: {
                        'SERVICE': 'WMS',
                        'VERSION': '1.1.1',
                        'LAYERS': members.config.layers.osm
                    }
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        } else {
            // 3: Use default OSM tiles (not recommended)
            // http://wiki.openstreetmap.org/wiki/Tile.openstreetmap.org/Usage_policy

            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: new ol.source.OSM ({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ]
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        }

        return null;
    };

    var createHellenicCadastreBaseLayer = function() {
        var source, fn;

        if(members.config.servers.tilecache.length > 0) {
            // 1: Use tilecache if available
            var tileGrid = new ol.tilegrid.TileGrid({
                    origin: [1948226, 4024868],
                    extent: [1948226, 4024868, 4008846, 5208724],
                    tileSize: 512,
                    resolutions: [156543.03390000001, 78271.516950000005, 39135.758475000002, 19567.879237500001, 9783.9396187500006, 4891.9698093750003, 2445.9849046875001,
                                  1222.9924523437501, 611.49622617187504, 305.74811308593752, 152.87405654296876, 76.43702827148438, 38.21851413574219, 19.109257067871095,
                                  9.5546285339355475, 4.7773142669677737, 2.3886571334838869, 1.1943285667419434, 0.59716428337097172, 0.29858214168548586, 0.14929107084274293,
                                  0.074645535421371464, 0.037322767710685732, 0.018661383855342866]
            });

            source = new ol.source.TileWMS({
                urls: members.config.servers.tilecache,
                params: {
                    VERSION: '1.1.0',
                    LAYERS: members.config.layers.ktimatologio,
                    TRANSPARENT :true
                },
                projection: 'EPSG:900913',
                attributions: [
                    new ol.Attribution({
                        html: '<a href="' + PublicaMundi.i18n.getResource('attribution.ktimatologio.url') + '" ' +
                              'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">' +
                              '<img src="content/images/app/ktimatologio-logo.png"/></a>'
                    })
                ],
                tileGrid: tileGrid
            });

            fn = source.tileUrlFunction;

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
            };

            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: source
            });
        } else if(members.config.servers.mapproxy.length > 0) {
            // 2: Use Map Proxy if available
            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: new ol.source.TileWMS({
                    projection: 'EPSG:900913',
                    attributions: [
                        new ol.Attribution({
                            html: '<a href="' + PublicaMundi.i18n.getResource('attribution.ktimatologio.url') + '" ' +
                                  'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">' +
                                  '<img src="content/images/app/ktimatologio-logo.png"/></a>'
                        })
                    ],
                    url: members.config.servers.mapproxy,
                    params: {
                        'SERVICE': 'WMS',
                        'VERSION': '1.1.0',
                        'LAYERS': 'ktimatologio'
                    }
                })
            });
        } else {
            // 3: Use default WMS
            var params = {
                'SERVICE': 'WMS',
                'VERSION': '1.1.0',
                'LAYERS': 'KTBASEMAP'
            };

            source = new ol.source.TileWMS({
                url: 'http://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx',
                params: params,
                projection: 'EPSG:900913',
                attributions: [
                    new ol.Attribution({
                        html: '<a href="' + PublicaMundi.i18n.getResource('attribution.ktimatologio.url') + '" ' +
                              'data-i18n-id="attribution.ktimatologio.url" data-i18n-type="attribute" data-i18n-name="href">' +
                              '<img src="content/images/app/ktimatologio-logo.png"/></a>'
                    })
                ]
            });

            fn = source.tileUrlFunction;

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
            };

            return new ol.layer.Tile({
                extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
                source: source
            });
        }

        return null;
    };

    var createTileGrid = function() {
        var canvasFunction = function(extent, resolution, pixelRatio, size, projection) {
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');

            var canvasWidth = size[0], canvasHeight = size[1];
            canvas.setAttribute('width', canvasWidth);
            canvas.setAttribute('height', canvasHeight);

            var map = members.map.control;
            var mapExtent = map.getView().calculateExtent(map.getSize());
            var mapOrigin = map.getPixelFromCoordinate([mapExtent[0], mapExtent[3]]);

            var canvasOrigin = map.getPixelFromCoordinate([extent[0], extent[3]]);

            var delta = [mapOrigin[0]-canvasOrigin[0], mapOrigin[1]-canvasOrigin[1]];

            var img=$("#grid-tiles")[0];
            var pat=context.createPattern(img,"repeat");
            context.rect(canvasOrigin[0],canvasOrigin[1],canvasWidth - canvasOrigin[0],canvasHeight - canvasOrigin[1]);
            context.fillStyle=pat;
            context.fill();

            var osmExtent = [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408];
            var topLeft = map.getPixelFromCoordinate([osmExtent[0], osmExtent[3]]);
            var bottomRight = map.getPixelFromCoordinate([osmExtent[2], osmExtent[1]]);

            context.clearRect((topLeft[0] + delta[0])*pixelRatio,
                              (topLeft[1] + delta[1])*pixelRatio,
                              (bottomRight[0]-topLeft[0])*pixelRatio,
                              (bottomRight[1]-topLeft[1])*pixelRatio);

            return canvas;
        };

        return new ol.layer.Image({
            source: new ol.source.ImageCanvas({
                canvasFunction: canvasFunction,
                projection: 'EPSG:3857'
            })
        });
    };

    var syncGoogleCenter = function() {
        var view = members.map.control.getView();
        var center = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
        members.map.google.setCenter(new google.maps.LatLng(center[1], center[0]));
    };

    var syncGoogleResolution = function() {
        var view = members.map.control.getView();
        members.map.google.setZoom(view.getZoom());
    };

    var enableGoogleMaps = function(set) {
        if(!members.map.google) {
            members.map.google = new google.maps.Map(document.getElementById('gmap'), {
                mapTypeId: google.maps.MapTypeId.SATELLITE,
                disableDefaultUI: true,
                keyboardShortcuts: false,
                draggable: false,
                disableDoubleClickZoom: true,
                scrollwheel: false,
                streetViewControl: false
            });
        }
        var view = members.map.control.getView();

        view.on('change:center', syncGoogleCenter);

        view.on('change:resolution', syncGoogleResolution);

        var $olMapDiv = $('#' + members.config.map.target);
        $olMapDiv.remove();

        view.setCenter(view.getCenter());
        view.setZoom(view.getZoom());

        members.map.google.controls[google.maps.ControlPosition.TOP_LEFT].push($olMapDiv[0]);

        $('#' + members.config.google.target).show();

        $('.ol-attribution').addClass('ol-attribution-google');

        updateDragZoomInteractionKinetic(true);
    };

    var disableGoogleMaps = function() {
        var $olMapDiv = $('#' + members.config.map.target);

        $('#' + members.config.google.target).hide();
        members.map.google.controls[google.maps.ControlPosition.TOP_LEFT].pop();

        $('#' + members.config.google.target).parent().append($olMapDiv);

        var view = members.map.control.getView();
        view.un('change:center', syncGoogleCenter);
        view.un('change:resolution', syncGoogleResolution);

        $('.ol-attribution').removeClass('ol-attribution-google');

        updateDragZoomInteractionKinetic(false);
    };

    var updateDragZoomInteractionKinetic = function(isGoogle) {
        var dragPan, index = 0, interactions = members.map.control.getInteractions();
        interactions.forEach(function(interaction) {
            if (interaction instanceof ol.interaction.DragPan) {
                if(isGoogle) {
                    interactions.setAt(index, new ol.interaction.DragPan({
                        kinetic: new ol.Kinetic(-1, 10, 200)
                    }));
                } else {
                    interactions.setAt(index, new ol.interaction.DragPan({
                        kinetic: new ol.Kinetic(-0.005, 0.05, 100)
                    }));
                }
            }
            index++;
        }, this);
    };

	var createBaseLayer = function(type, set) {
		var layer = null, prev_propeties = null;

        prev_propeties = members.map.control.get('base_layer_properties');

        members.map.control.set('base_layer_properties', {
            type : type,
            set : set,
            exists: (type != 'google')
        });

		switch(type) {
			case 'bing':
				if(members.config.bing.key) {
					layer = new ol.layer.Tile({
                        extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
						source: new ol.source.BingMaps({
							key: members.config.bing.key,
							imagerySet: set
						})
					});
				}
				break;
			case 'stamen':
				layer = new ol.layer.Tile({
                    extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
					source: new ol.source.Stamen({layer: set })
				});
				break;
			case 'mapquest':
				layer = new ol.layer.Tile({
                    extent: [2137334.22323, 4117771.96011, 3332905.55435, 5150499.54408],
					source: new ol.source.MapQuest({layer: set })
				});
				break;
			case 'ktimatologio':
                layer = createHellenicCadastreBaseLayer();
				break;
            case 'google':
                enableGoogleMaps(set);
                break;
			default:
				console.log('Base layer of type ' + type + ' is not supported.');
		}

        if((prev_propeties) && (prev_propeties.type == 'google')) {
            disableGoogleMaps();
        }

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
        // View
        var view = new ol.View({
            projection: PublicaMundi.Maps.CRS.Mercator,
            center: members.config.map.center || [0, 0],
            zoom: getDefaultZoomLevel(),
            minZoom: members.config.map.minZoom,
            maxZoom: members.config.map.maxZoom,
            extent: [-20037508.3392, -20048966.10, 20037508.3392, 20048966.10]
        });

        // Map Interactions
        var interactions = ol.interaction.defaults();
        interactions.removeAt(interactions.getLength() -1);

        members.interactions.zoom = new ol.interaction.DragZoom({
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

        interactions.push(members.interactions.zoom);

        // Map Controls
        var controls = [];
        controls.push(new ol.control.Zoom({
			zoomInTipLabel : '',
			zoomOutTipLabel : ''
		}));
        controls.push(new ol.control.ZoomSlider());
        controls.push(new ol.control.Attribution({
			tipLabel: '',
			collapsible : false
		}));

        // Map
        members.map.control = new ol.Map({
            target: members.config.map.target,
            view: view,
            controls: controls,
            interactions: interactions,
            ol3Logo: false
        });

        // Map Base Layers
        var layer;

		var selection = $('#base_layer option:selected');

		layer = createBaseLayer($(selection).data('type'), $(selection).data('set'));
        members.map.control.addLayer(layer);

        layer = createOSM();
        members.map.control.addLayer(layer);

        layer = createTileGrid();
        members.map.control.getLayers().insertAt(0, layer);

        // Initialize View
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

        // Map External Controls
        var mousePositionControl = new ol.control.MousePosition({
            coordinateFormat: function (coordinate) {
                return ol.coordinate.format(coordinate, '{x} , {y}', 4);
            },
            projection: $('#pos_epsg option:selected').val(),
            className: 'mouse-pos-text',
            target: $('.mouse-pos')[0]
        });
        members.map.control.addControl(mousePositionControl);

		var scaleLineControl = new ol.control.ScaleLine({
			target: document.getElementById('scale-line')
		});
		members.map.control.addControl(scaleLineControl);

        // Custom controls
        $('#pos_epsg').selectpicker().change(function () {
            var projection = ol.proj.get($('#pos_epsg option:selected').val());

            mousePositionControl.setProjection(projection);
            members.actions.position.setProjection(projection);

            $('[data-id="pos_epsg"]').blur();
        });
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
        $('#layer-tree-search-result').height(height - catalogHeight - selectionHeight - footerHeight - 105);
        $('#layer-tree-search-result-container').height(height - catalogHeight - selectionHeight - footerHeight - 105);

        $('#map').offset({top : headerHeight , left : 0}).height(height - footerHeight + 10);

        $('.resource-data-search').width(width - 930 + ($('#base-layer-label').is(':visible') ? 0 : 310));

        if($('#panel-left-splitter').is(":visible")) {
            $('#panel-left-splitter').css('left', $('#panel-left').width());
        }

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
                    $('.panel-left-label-image').attr('src', 'content/images/app/topics.svg');
                    $('.panel-left-label-text').html(PublicaMundi.i18n.getResource('index.topics')).css('padding', '4px 0 0 7px');
                    break;
                case 'organization':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.organizations.position')[1],
                        right: PublicaMundi.i18n.getResource('index.organizations.position')[0]
                    });
                    $('.panel-left-label-image').attr('src', 'content/images/app/organization.svg');
                    $('.panel-left-label-text').html(PublicaMundi.i18n.getResource('index.organizations')).css('padding', '4px 0 0 7px');
                    break;
                case 'search':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.search.position')[1],
                        right: PublicaMundi.i18n.getResource('index.search.position')[0]
                    });
                    $('.panel-left-label-image').attr('src', 'content/images/app/search.svg');
                    $('.panel-left-label-text').html(PublicaMundi.i18n.getResource('index.search')).css('padding', '0px 0 0 7px');
                    break;
            }
        }
    };

    var initializeUI = function() {
        // CKAN catalog
		members.ckan = new PublicaMundi.Maps.CKAN.Metadata({
            path: members.config.path,
			endpoint: members.config.ckan.endpoint,
            metadata: {
                database: members.config.ckan.metadata.database,
                path: members.config.ckan.metadata.path,
                version: members.config.ckan.metadata.version
            }
		});

        // Resource manager
		members.resources = new PublicaMundi.Maps.ResourceManager({
            path: members.config.path,
			proxy: PublicaMundi.getProxyUrl(members.config.proxy),
			extent: members.config.map.extent,
            maxLayerCount: 5
		});

        // UI components
		members.components = {};

		members.components.textSearch = new PublicaMundi.Maps.TextSearch({
			element: 'location-search',
			map: members.map.control,
			endpoint: members.config.path,
            resources: members.resources
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
            image: 'content/images/app/restore-zoom-w.svg',
            title: 'index.resotre-zoom',
            visible: true
        });

        members.actions.restoreZoomLevel.on('action:execute', function(args) {
            members.map.control.getView().setZoom(getDefaultZoomLevel());
        });

        if(members.config.feedback) {
            $('.feedback-label').click(function() {
                window.open(members.config.feedback[PublicaMundi.i18n.getLocale()]);
            });
        }

        members.actions.export = new PublicaMundi.Maps.Action({
            element: 'action-export',
            name: 'export',
            image: 'content/images/app/download-w.svg',
            title: 'action.export.title',
            visible: false
        });

        members.actions.import = new PublicaMundi.Maps.ImportWmsTool({
            element: 'action-wms',
            name: 'wms',
            image: 'content/images/app/add-layer-w.svg',
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
            image: 'content/images/app/upload-w.svg',
            title: 'action.upload-resource.title',
            map: members.map.control,
            resources: members.resources,
            endpoint: members.config.path
        });

        members.actions.link = new PublicaMundi.Maps.PermalinkTool({
            element: 'action-link',
            name: 'link',
            image: 'content/images/app/permalink-w.svg',
            title: 'action.create-link.title',
            map: members.map.control,
            resources: members.resources,
            ckan: members.ckan,
            endpoint: members.config.path,
            mode: PublicaMundi.Maps.PermalinkTool.Mode.Link
        });

        members.actions.embed = new PublicaMundi.Maps.PermalinkTool({
            element: 'action-embed',
            name: 'embed',
            image: 'content/images/app/embed-map-w.svg',
            title: 'action.create-link-embed.title',
            map: members.map.control,
            resources: members.resources,
            ckan: members.ckan,
            endpoint: members.config.path,
            mode: PublicaMundi.Maps.PermalinkTool.Mode.Embed
        });

        members.actions.parse = new PublicaMundi.Maps.CoordinateParser({
            element: 'action-parse',
            name: 'parse',
            image: 'content/images/app/coordinates-w.svg',
            title: 'action.parse-coordinates.title',
            map: members.map.control,
            resources: members.resources
        });

        members.actions.upload.on('resource:loaded', function(args) {
            members.resources.getResourceMetadata(args.format.toUpperCase(), {
                url: args.url,
                text: args.text,
                filename: args.name,
                title: args.title,
                projection: args.projection
            }).then(function(metadata) {
                if(members.resources.createLayer(members.map.control, metadata, args.id, args.title)) {
                    members.components.layerSelection.add(args.id, metadata);
                }
            });
        });

        members.actions.position = new PublicaMundi.Maps.PositionTool({
            element: 'action-position',
            name: 'position',
            image: 'content/images/app/map-location-w.svg',
            title: 'action.set-position.title',
            map: members.map.control,
            projection: ol.proj.get($('#pos_epsg option:selected').val())
        });

        members.actions.clear = new PublicaMundi.Maps.Action({
            element: 'action-clear',
            name: 'clear',
            image: 'content/images/app/clear-w.svg',
            title: 'action.clear.title',
            visible: true,
            enabled: true,
            class: 'btn-danger'
        });

        members.actions.clear.on('action:execute', function(args) {
            var item;

            for(item in members.tools) {
                members.tools[item].clear();
            }
            for(item in members.actions) {
                members.actions[item].clear();
            }
            for(item in members.components) {
                members.components[item].clear();
            }
        });

        // UI tools
        members.tools.length = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-length',
            name: 'length',
            images: {
                enabled: 'content/images/app/distance-w.svg',
                disabled: 'content/images/app/distance.svg'
            },
            title: 'tool.length.title',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Length
        });

        members.tools.area = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-area',
            name: 'area',
            images: {
                enabled: 'content/images/app/area-w.svg',
                disabled: 'content/images/app/area.svg'
            },
            title: 'tool.area.title',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Area
        });

        members.tools.export = new PublicaMundi.Maps.ExportTool({
            element: 'tool-export',
            name: 'export',
            images: {
                enabled: 'content/images/app/draw-polygon-w.svg',
                disabled: 'content/images/app/draw-polygon.svg'
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
            $('.tools-container').height('auto');

            var name = args.name;
            if(args.active) {
                if(args.sender.hasActions()) {
                    $('#tool-actions-header').show();
                } else {
                    $('#tool-actions-header').hide();
                }
                name = args.sender.getName();
                for(var item in members.tools) {
                    if(name != members.tools[item].getName()) {
                        members.tools[item].setActive(false);
                    }
                }
            } else {
                $('#tool-actions-header').hide();

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

            var parts = args.id.split('_');
			var resource = parts[0];

            members.components.layerTreeGroup.expand(resource);
            members.components.layerTreeOrganization.expand(resource);
		});

        // Left sliding panel
		$('body').on('click', '.panel-left-hidden', function(e) {
			$('.panel-left-handler').trigger('click');
		});

        $('.panel-left-handler').click(function(e) {
			e.preventDefault();
			e.stopPropagation();

			if($('.panel-left').hasClass('panel-left-hidden')) {
				$('.panel-left-label').hide();

                $('.panel-left').removeClass('panel-left-hidden');
				$('.panel-left-handler').removeClass('panel-left-handler-toggle');
				$('.panel-left').find('.panel-content').removeClass('panel-content-hidden');
                $('.panel-left-splitter').show();
                $('.panel-left').width($('.panel-left-splitter').position().left);
			} else {
                $('.panel-left-splitter').hide();
				$('.panel-left-label').show();

				$('.panel-left').addClass('panel-left-hidden');
				$('.panel-left-handler').addClass('panel-left-handler-toggle');
				$('.panel-left').find('.panel-content').addClass('panel-content-hidden');
                $('.panel-left').width(30);

                setHeaderPosition(members.ui.section);
			}
		});

        // Make tool window draggable
        $('.tools-container').draggable({handle : '.tools-header', containment: 'parent'});

        $('.tools-header-handler').click(function() {
            $('.tools-container-placholder').fadeIn(400);
            $('.tools-container').effect(
                'transfer', {
                    to: $('.tools-container-placholder')
                },
                400,
                function() {
                    $('.tools-container').fadeOut(200);
                }
            );
        });

        $('.tools-container-placholder').click(function() {
            $('.tools-container').fadeIn(400);
            $('.tools-container-placholder').effect(
                'transfer', {
                    to: $('.tools-container')
                },
                400,
                function() {
                    $('.tools-container-placholder').fadeOut(200);
                }
            );
        });
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
                $('#tree-filter').show();
				members.components.layerTreeGroup.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeOrganization.show();
			} else if (id === 'group') {
                $('#tree-filter').show();
				members.components.layerTreeOrganization.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeGroup.show();
			} if (id === 'search') {
                $('#tree-filter').hide();
                members.components.layerTreeGroup.hide();
				members.components.layerTreeOrganization.hide();
                members.components.layerTreeSearch.show();
			}

            resize();
		});

        // Layer handling events
		var layerRemoved  = function(args) {
            if(args.sender != members.components.layerTreeGroup) {
                members.components.layerTreeGroup.remove(args.id, false);
            }
            if(args.sender != members.components.layerTreeOrganization) {
                members.components.layerTreeOrganization.remove(args.id, false);
            }
            if(args.sender != members.components.layerTreeSearch) {
                members.components.layerTreeSearch.remove(args.id, false);
            }

			members.components.layerSelection.remove(args.id);

            resize();
		};

        var showCatalogObjectInfo = function(args) {
            if(args.data) {
                members.components.catalogInfoDialog.setTitle(args.data.title[PublicaMundi.i18n.getLocale()]);
                members.components.catalogInfoDialog.setContent(args.data.description[PublicaMundi.i18n.getLocale()]);
                members.components.catalogInfoDialog.show();
            }
        };

        var resetCatalogObjectInfo = function(args) {
            if(args.title) {
                members.components.catalogInfoDialog.setTitle(args.title[PublicaMundi.i18n.getLocale()]);
                members.components.catalogInfoDialog.setContent('<div style="width: 100%; text-align: center;"><img style="text-align: center;" src="content/images/app/ajax-loader-big.gif"></div>');
                members.components.catalogInfoDialog.show();
            }
        };

        var layerAdded = function(args) {
            if(args.sender != members.components.layerTreeGroup) {
                members.components.layerTreeGroup.add(args.id, false);
            }
            if(args.sender != members.components.layerTreeOrganization) {
                members.components.layerTreeOrganization.add(args.id, false);
            }
            if(args.sender != members.components.layerTreeSearch) {
                members.components.layerTreeSearch.add(args.id, false);
            }
        };

        members.components.layerTreeGroup.on('layer:added', layerAdded);
		members.components.layerTreeGroup.on('layer:removed', layerRemoved);
        members.components.layerTreeGroup.on('catalog:info-loading', resetCatalogObjectInfo);
        members.components.layerTreeGroup.on('catalog:info-loaded', showCatalogObjectInfo);

        members.components.layerTreeOrganization.on('layer:added', layerAdded);
        members.components.layerTreeOrganization.on('layer:removed', layerRemoved);
        members.components.layerTreeOrganization.on('catalog:info-loading', resetCatalogObjectInfo);
        members.components.layerTreeOrganization.on('catalog:info-loaded', showCatalogObjectInfo);

        members.components.layerTreeSearch.on('layer:added', layerAdded);
        members.components.layerTreeSearch.on('layer:removed', layerRemoved);
        members.components.layerTreeSearch.on('catalog:info-loading', resetCatalogObjectInfo);
        members.components.layerTreeSearch.on('catalog:info-loaded', showCatalogObjectInfo);

        // Interaction events
        members.components.layerTreeSearch.on('bbox:draw', function(args) {
            disableAllTools();
            disableAllInteractions();
        });

        members.components.layerTreeSearch.on('bbox:apply', function(args) {
            disableAllInteractions('zoom');

            enableAllTools('select');
        });

        members.components.layerTreeSearch.on('bbox:cancel', function(args) {
            disableAllInteractions('zoom');

            enableAllTools('select');
        });
		var layerSelectionAdded  = function(args) {
            resize();
		};

		var layerSelectionRemoved  = function(args) {
			members.components.layerTreeGroup.remove(args.id);
            members.components.layerTreeOrganization.remove(args.id);
            members.components.layerTreeSearch.remove(args.id);
            resize();
		};

		members.components.layerSelection.on('layer:added', layerSelectionAdded);

        members.components.layerSelection.on('layer:removed', layerSelectionRemoved);

        // Enable locale selection
        $("#locale_selection").val(PublicaMundi.i18n.getLocale());

        $('#locale_selection').selectpicker().change(function () {
            PublicaMundi.i18n.setLocale($('#locale_selection option:selected').val());
            $('[data-id="locale_selection"]').blur();

            var term = $('#tree-filter-text').val();

            members.components.layerTreeGroup.setFilter(term);
            members.components.layerTreeOrganization.setFilter(term);

            // Refresh tooltips
            $('.selectpicker, .img-text').tooltip();
            $('.selectpicker').tooltip('disable');
        });

        // Enable package filtering
        $('#tree-filter-text').keyup(function() {
            var term = $(this).val();

            members.components.layerTreeGroup.setFilter(term);
            members.components.layerTreeOrganization.setFilter(term);
        });


        $('#tree-filter-remove').click(function() {
            $('#tree-filter-text').val('');
            members.components.layerTreeGroup.setFilter(null);
            members.components.layerTreeOrganization.setFilter(null);
            $(this).blur();
        });

        // Left pane splitter
        $('#panel-left-splitter').draggable({
            axis: 'x',
            opacity : 0.5,
            handle: '.panel-left-splitter-handler',
            start: function( event, ui ) {
                $(this).addClass('panel-left-splitter-dragging');
            },
            stop: function( event, ui ) {
                $('#panel-left').width(ui.position.left);
                $(this).removeClass('panel-left-splitter-dragging');
            },
            drag: function( event, ui ) {
                ui.position.left = Math.max( 280, ui.position.left );
                ui.position.left = Math.min( 550, ui.position.left );
            }
        });
        $('.panel-left-splitter-handler').dblclick(function(e) {
        });

        // Tooltips
        $('.selectpicker, .img-text').tooltip();
        $('.selectpicker').tooltip('disable');

        // Initialize layout
        $(window).resize(resize);
	};

    var initializeHelpSystem = function() {
        /*
        $('.help').addClass('help-active').on('click.help', function(e) {
            e.preventDefault();
            e.stopPropagation();

            alert($(this).parent('.help').data('help-resource'));
        });
        */
    };


    var attachEvents = function () {
        attachBaseLayerSelectionEvents();
	};

    var setBaseLayer = function(type, set, opacity) {
        opacity = (opacity === 0 ? opacity : opacity || 100);

        var baseLayerProperties = members.map.control.get('base_layer_properties');
        var oldBaseLayer = (baseLayerProperties.exists ? members.map.control.getLayers().item(1) : null);

        var overlayBaseLayer = members.map.control.getLayers().item((baseLayerProperties.exists ? 2 : 1));
        overlayBaseLayer.setOpacity(opacity / 100.0);

        var newBaseLayer = createBaseLayer(type, set);

        if(newBaseLayer) {
            members.map.control.getLayers().insertAt((baseLayerProperties.exists ? 2 : 1), newBaseLayer);
        }

        if(oldBaseLayer) {
            setTimeout(function () {
                members.map.control.getLayers().remove(oldBaseLayer);
            }, 500);
        }

        $('#base-layer-opacity').val(opacity);

        $('#base_layer').val(type + '-' + set).selectpicker('refresh');
        $('.selectpicker').tooltip().tooltip('disable');
    };

    var attachBaseLayerSelectionEvents = function () {
        $('#base_layer').selectpicker().change(function(e) {
			var selection = $('#base_layer option:selected');
            var opacity = $('#base-layer-opacity').val();

            setBaseLayer($(selection).data('type'), $(selection).data('set'), opacity);

            $('[data-id="base_layer"]').blur();
        });

        $('#base-layer-opacity').change(function() {
            var baseLayerProperties = members.map.control.get('base_layer_properties');
			members.map.control.getLayers().item((baseLayerProperties.exists ? 2 : 1)).setOpacity($(this).val() / 100.0);
		});
    };

    var disableAllTools = function() {
        for(var item in members.tools) {
            if(members.tools[item]) {
                members.tools[item].setEnabled(false);
            }
        }
    };

    var enableAllTools = function(name) {
        for(var item in members.tools) {
            if(members.tools[item]) {
                members.tools[item].setEnabled(true);
            }
        }
        if((name) && (members.tools.hasOwnProperty(name))) {
            members.tools[name].setActive(true);
        }
    };

    var disableAllInteractions = function(name) {
        for(var item in members.interactions) {
            members.interactions[item].setActive(false);
        }

        if(name) {
            enableInteraction(name);
        }
    };

    var enableInteraction = function(name) {
        if((name) && (members.interactions.hasOwnProperty(name))) {
            members.interactions[name].setActive(true);
        }
    };

    var initializeConfiguration = function() {
        return new Promise(function(resolve, reject) {
            var uri = new URI();
            if(members.config.path === '/') {
                uri.segment(['config', 'load', members.map.config]);
            } else {
                uri.segment([members.config.path, 'config', 'load', members.map.config]);
            }

            $.ajax({
                url: uri.toString().replace(/\/\//g, '/').replace(/:\//g, '://'),
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

                            members.ckan.loadPackageById(layer.package).then(function(_package) {
                                var resource = members.ckan.getResourceById(layer.resource);
                                if(resource) {
                                    resource = members.resources.setCatalogResourceMetadataOptions(resource);

                                    members.resources.addResourceFromCatalog(members.map.control, resource, layer.opacity, layer.key).then(loader);
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
        $('.selectpicker').tooltip().tooltip('disable');

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
            var packages = members.ckan.getPackages();
            for(var p=0; p < packages.length; p++) {
                for(var r=0; r < packages[p].resources.length; r++) {
                    PublicaMundi.i18n.setResource(locale, 'node.resource.' + packages[p].resources[r].id, packages[p].resources[r].name[locale]);
                }
            }
            var nodes = members.ckan.getNodes();
            for(var key in nodes) {
                PublicaMundi.i18n.setResource(locale, 'node.' + nodes[key].id, nodes[key].caption[locale]);
            }
        }
    };

    PublicaMundi.initialize = function () {
        initializeParameters();

        PublicaMundi.i18n.setLocale(members.locale || 'el').then(function(strings) {
            PublicaMundi.i18n.on('locale:load', function() {
                mergeCkanResources();
            });

            PublicaMundi.i18n.on('locale:change', function() {
                localizeUI();

                resize();
            });

            mergeCkanResources();

            initializeMap();

            initializeUI();

            initializeHelpSystem();

            attachEvents();

            $('#loading-text').html('Initializing Catalog ... 0%');

            var afterQueryableLoaded = function() {
                members.components.layerTreeGroup.refresh();
                members.components.layerTreeOrganization.refresh();

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

                resize();
            };

            var afterPreload = function() {
                // Refresh localization strings (CKAN metadata may have added new resources)
                localizeUI();

                var term = $('#tree-filter-text').val();

                members.components.layerTreeGroup.setFilter(term);
                members.components.layerTreeOrganization.setFilter(term);

                if(members.ckan.isPreloadingEnabled()) {
                    var resources = [];
                    var packages = members.ckan.getPackages();
                    for(var p=0;p<packages.length;p++) {
                        for(var r=0; r<packages[p].resources.length;r++) {
                            var resource = packages[p].resources[r];
                            if(resource.queryable) {
                                resources.push({
                                    wms: resource.id,
                                    table : resource.queryable.resource,
                                    geometry_type: resource.queryable.geometry,
                                    srid: resource.queryable.srid,
                                    template: resource.queryable.template
                                });
                            }
                        }
                    }
                    members.resources.setQueryableResources(resources);

                    afterQueryableLoaded();
                } else {
                    $('#loading-text').html('Loading Metadata ... 0%');
                    members.resources.updateQueryableResources().then(function(resources) {
                        $('#loading-text').html('Loading Metadata ... 100%');

                        afterQueryableLoaded();
                    });
                }
            };

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
    window.PublicaMundi = PublicaMundi;
    return PublicaMundi;
});
