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
            config: null
        },
        interactions: { },
        tools: { },
        actions: { },
        preview: null,
        locale: null
    };

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

        $('.resource-data-search').width(width - 933);

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
                    $('.panel-left-label-image').attr('src', 'content/images/topics.svg');
                    $('.panel-left-label-text').html(PublicaMundi.i18n.getResource('index.topics')).css('padding', '4px 0 0 7px');
                    break;
                case 'organization':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.organizations.position')[1],
                        right: PublicaMundi.i18n.getResource('index.organizations.position')[0]
                    });
                    $('.panel-left-label-image').attr('src', 'content/images/organization.svg');
                    $('.panel-left-label-text').html(PublicaMundi.i18n.getResource('index.organizations')).css('padding', '4px 0 0 7px');
                    break;
                case 'search':
                    $('.panel-left-label').css({
                        bottom: PublicaMundi.i18n.getResource('index.search.position')[1],
                        right: PublicaMundi.i18n.getResource('index.search.position')[0]
                    });
                    $('.panel-left-label-image').attr('src', 'content/images/search.svg');
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
			proxy: PublicaMundi.getProxyUrl(module.config().proxy),
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
            image: 'content/images/restore-zoom-w.svg',
            title: 'index.resotre-zoom',
            visible: true
        });

        members.actions.restoreZoomLevel.on('action:execute', function(args) {
            members.map.control.getView().setZoom(getDefaultZoomLevel());
        });

        if(members.config.feedback) {
            $('.feedback-label').click(function() {
                window.open(members.config.feedback);
            });
        }

        members.actions.export = new PublicaMundi.Maps.Action({
            element: 'action-export',
            name: 'export',
            image: 'content/images/download-w.svg',
            title: 'action.export.title',
            visible: false
        });

        members.actions.import = new PublicaMundi.Maps.ImportWmsTool({
            element: 'action-wms',
            name: 'wms',
            image: 'content/images/add-layer-w.svg',
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
            image: 'content/images/upload-w.svg',
            title: 'action.upload-resource.title',
            map: members.map.control,
            resources: members.resources,
            endpoint: members.config.path
        });

        members.actions.link = new PublicaMundi.Maps.PermalinkTool({
            element: 'action-link',
            name: 'link',
            image: 'content/images/permalink-w.svg',
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
            image: 'content/images/embed-map-w.svg',
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
            image: 'content/images/coordinates-w.svg',
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
            image: 'content/images/map-location-w.svg',
            title: 'action.set-position.title',
            map: members.map.control,
            projection: ol.proj.get($('#pos_epsg option:selected').val())
        });

        // UI tools
        members.tools.length = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-length',
            name: 'length',
            images: {
                enabled: 'content/images/distance-w.svg',
                disabled: 'content/images/distance.svg'
            },
            title: 'tool.length.title',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Length
        });

        members.tools.area = new PublicaMundi.Maps.MeasureTool({
            element: 'tool-area',
            name: 'area',
            images: {
                enabled: 'content/images/area-w.svg',
                disabled: 'content/images/area.svg'
            },
            title: 'tool.area.title',
            map: members.map.control,
            type: PublicaMundi.Maps.MeasureToolType.Area
        });

        members.tools.export = new PublicaMundi.Maps.ExportTool({
            element: 'tool-export',
            name: 'export',
            images: {
                enabled: 'content/images/draw-polygon-w.svg',
                disabled: 'content/images/draw-polygon.svg'
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
                var name = args.sender.getName();
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
        $('.tools-container').draggable({handle : '.tools-header', containment: 'parent'})

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
                $('#tree-filter').show()
				members.components.layerTreeGroup.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeOrganization.show();
			} else if (id === 'group') {
                $('#tree-filter').show()
				members.components.layerTreeOrganization.hide();
                members.components.layerTreeSearch.hide();
				members.components.layerTreeGroup.show();
			} if (id === 'search') {
                $('#tree-filter').hide()
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
		}

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
                members.components.catalogInfoDialog.setContent('<div style="width: 100%; text-align: center;"><img style="text-align: center;" src="content/images/ajax-loader-big.gif"></div>');
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
		}

		var layerSelectionRemoved  = function(args) {
			members.components.layerTreeGroup.remove(args.id);
            members.components.layerTreeOrganization.remove(args.id);
            members.components.layerTreeSearch.remove(args.id);
            resize();
		}

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
                ui.position.left = Math.max( 260, ui.position.left );
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

        var newBaseLayer = createBaseLayer(type, set);

        var oldBaseLayer = members.map.control.getLayers().item(0);

        var overlayBaseLayer = members.map.control.getLayers().item(1);
        overlayBaseLayer.setOpacity(opacity / 100.0);

        members.map.control.getLayers().insertAt(1, newBaseLayer);

        setTimeout(function () {
            members.map.control.getLayers().remove(oldBaseLayer);
        }, 1000);

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

    var enableAllTools = function(name) {
        for(var item in members.tools) {
            if(members.tools[item]) {
                members.tools[item].setEnabled(true);
            }
        }
        if((name) && (members.tools.hasOwnProperty(name))) {
            members.tools[name].setActive(true);
        }
    }

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
            uri.segment([(members.config.path === '/' ? '' : members.config.path), 'config', 'load', members.map.config]);

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
                            var title = null;
                            index++;

                            members.ckan.loadPackageById(layer.package).then(function(_package) {
                                var resource = members.ckan.getResourceById(layer.resource);
                                if(resource) {
                                    resource = members.resources.setCatalogResourceMetadataOptions(resource);

                                    if(!!resource.metadata.extras.layer) {
                                        title = (_package.resources.length == 1 ? _package.title[PublicaMundi.i18n.getLocale()] : resource.name[PublicaMundi.i18n.getLocale()]);
                                    }
                                    members.resources.addResourceFromCatalog(members.map.control, resource, layer.opacity, layer.key, layer.title).then(loader);
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
            var nodes = members.ckan.getNodeChidlren();
            for(var n=0; n < nodes.length; n++) {
                PublicaMundi.i18n.setResource(locale, 'node.' + nodes[n].id, nodes[n].caption[locale]);
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

            initializeHelpSystem();

            attachEvents();

            $('#loading-text').html('Initializing Catalog ... 0%');

            var afterQueryableLoaded = function() {
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

                members.components.layerTreeGroup.refresh();
                members.components.layerTreeOrganization.refresh();

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
