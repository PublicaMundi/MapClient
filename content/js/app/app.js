define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

    var PREVIEW = {
        WMS: 'WMS',
        WFS: 'WFS',
        KML: 'KML',
        Package: 'Package',
        Resource: 'Resource',
        CKAN: 'CKAN'
    };

    // Private members
    var members = {
        config: module.config(),
        map: {
            control: null,
            interactions: {
                bbox: null
            }
        },
        resources: null,
        views: null,
        view: null,
        preview: []
    };

    members.resources = new PublicaMundi.Maps.Resources.ResourceManager({
        config: module.config()
    });

    members.views = new PublicaMundi.Maps.Resources.UI.ViewManager({
        config: module.config()
    });

    var supsendUI = function () {
        $('.progress-loader').show();
    };

    var resumeUI = function () {
        $('.progress-loader').fadeOut(400).hide();
    };

    var initializeParameters = function () {
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

            // Metdata parameters

            // Check for url (wms/wfs)
            if (params.url) {
                var url = decodeURI(params.url);
                var urlParams = URI.parseQuery(URI.parse(params.url).query);

                for (var key in urlParams) {
                    if (key.toLowerCase() === 'service') {
                        switch (urlParams[key].toUpperCase()) {
                            case PREVIEW.WMS:
                                members.preview.push({
                                    type: PREVIEW.WMS,
                                    url: url
                                });
                                break;
                            case PREVIEW.WFS:
                                members.preview.push({
                                    type: PREVIEW.WFS,
                                    url: url
                                });
                                break;
                        }
                    }
                }
            }

            // Check for dataset/package/resource
            if ((members.config.ckan) && (members.config.ckan.endpoint)) {
                if ((params.dataset) || (params.package)) {
                    var uri = new URI(members.config.ckan.endpoint);
                    uri.segment(['api', '3', 'action', 'package_show']);
                    uri.addQuery({ id: (params.dataset || params.package) });

                    members.preview.push({
                        type: PREVIEW.Package,
                        url: uri.toString()
                    });
                } else if (params.resource) {
                    var uri = new URI(members.config.ckan.endpoint);
                    uri.segment(['api', '3', 'action', 'resource_show']);
                    uri.addQuery({ id: params.resource });

                    members.preview.push({
                        type: PREVIEW.Resource,
                        url: uri.toString()
                    });
                }
            }
        }
    };

    var initializeLayout = function () {
        var types = members.resources.getResourceTypes();

        var content = [];

        content.push('<div data-role="popup" id="actions" data-theme="a"><ul data-role="listview" data-inset="true" style="min-width: 210px;">');
        content.push('<li data-role="list-divider">Select resource type</li>');

        for (var i = 0; i < types.length; i++) {
            content.push('<li data-icon="false"><a class="link-create-layer" data-type="' + types[i].type + '" href="#">' + types[i].title + '</a></li>');
        }

        content.push('</ul></div>');

        $('#main').append(content.join(''));

        $('#actions').popup();
        $('#actions ul').listview();

        var action = null;

        $('.link-create-layer').click(function () {
            $('#actions').popup('close');

            var type = $(this).data('type');

            var view = members.views.createView({
                resourceType: type,
                viewType: PublicaMundi.Maps.Resources.UI.Views.CREATE,
                target: 'main'
            });

            view.on('create', function (sender, options) {
                supsendUI();
                members.resources.addResource(options);
            });

            view.on('cancel', function (sender) {

            });

            members.view = view;
        });

        $('#actions').popup({
            afterclose: function (event, ui) {
                if (members.view) {
                    members.view.show();
                    members.view = null;
                }
            }
        });
    };

    var initializeMap = function () {
        var minZoom = members.config.map.minZoom, maxZoom = members.config.map.maxZoom, zoom = members.config.map.zoom || members.config.map.minZoom;
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

        var layers = [
            new ol.layer.Tile({
                source: new ol.source.BingMaps({
                    key: members.config.bing.key,
                    imagerySet: 'Road'
                })
            })
        ];

        members.map.control = new ol.Map({
            target: members.config.map.target,
            view: view,
            controls: [],
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
                return ol.coordinate.format(coordinate, 'Coordinate is {x} , {y}', 4);
            },
            projection: $('#pos_epsg option:selected').val(),
            className: 'mouse-pos-text',
            target: $('.mouse-pos')[0]
        });
        members.map.control.addControl(mousePositionControl);

        $('#pos_epsg').change(function () {
            mousePositionControl.setProjection(ol.proj.get($('#pos_epsg option:selected').val()));
        });

        // BBOX draw
        members.map.interactions.bbox = new ol.interaction.DragBox({
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

        members.map.control.addInteraction(members.map.interactions.bbox);

        members.map.interactions.bbox.on('boxend', function (e) {
            var extent = members.map.interactions.bbox.getGeometry().getExtent();
            var geom = members.map.interactions.bbox.getGeometry();
            var feature = new ol.Feature({ name: 'bbox', geometry: geom });
            var format = new ol.format.GeoJSON();

            console.log(extent);
            console.log(JSON.stringify(format.writeFeatures([feature])));
        });
    };

    var attachEvents = function () {
        attachLayerFilterEvents();

        attachBaseLayerSelectionEvents();

        attachLayerActionEvents();
    };

    var attachLayerFilterEvents = function () {
        $("#services").filterable("option", "filterCallback", function (index, searchValue) {
            var selectedOnly = $('#filter-selected option:selected').val() || 'All';
            if (selectedOnly === 'Selected') {
                var layer = members.resources.getLayerById($(this).attr('id'));
                if (layer) {
                    return !layer.viewer.visible;
                }
            }
            return (("" + ($.mobile.getAttribute(this, "filtertext") || $(this).text())).toLowerCase().indexOf(searchValue) === -1);
        });

        $("#filter-selected").bind("change", function (event, ui) {
            $("#services").filterable("refresh");
        });

        $("#services").on("filterablefilter", function (event, ui) {
            var parents = $(ui.items).find('ul').parents('.ui-collapsible');
            for (var i = 0; i < parents.length; i++) {
                var count = $(parents[i]).find('li:not(.ui-screen-hidden)').size();

                $(parents[i]).find('span.ui-li-count-resource').html(count);
            }
        });
    };

    var attachBaseLayerSelectionEvents = function () {
        $('.base-layer img').click(function () {
            if ($(this).parent('div').hasClass('base-layer-selected')) {
                return;
            }
            $('.base-layer').removeClass('base-layer-selected');
            $(this).parent('div').addClass('base-layer-selected');

            var newBaseLayer = new ol.layer.Tile({
                source: new ol.source.BingMaps({
                    key: members.config.bing.key,
                    imagerySet: $(this).data('image-set')
                })
            });

            var oldBaseLayer = members.map.control.getLayers().item(0);

            members.map.control.getLayers().insertAt(0, newBaseLayer);
            setTimeout(function () {
                members.map.control.getLayers().remove(oldBaseLayer);
            }, 1000);
        });
    };

    var attachLayerActionEvents = function () {
        $('#view-layers').on('change', '.layer-selector :checkbox', function (e) {
            if ($(this).is(':checked')) {
                members.resources.createLayer(members.map.control, $(this).data('layer'));
            } else {
                members.resources.destroyLayer(members.map.control, $(this).data('layer'));
            }
        });

        $('#view-layers').on('click', 'img.legend', function (e) {
            if ($('#legendPopup-screen').is(":visible")) {
                $('#legendPopup').popup('close');
            }
            var nWidth = $(this).prop('naturalWidth');
            var sWidth = $(this).width();
            var nHeight = $(this).prop('naturalHeight');
            var sHeight = $(this).height();
            var pHeight = $(this).parent().height();

            if ((nWidth > sWidth) || (nHeight > sHeight) || (nHeight > pHeight)) {
                $('#legendZoom').attr('src', $(this).attr('src'));
                $('#legendPopup').popup('open');
            }
        });

        $('#view-layers').on('click', '.btn-layer-config', function () {
            var layer = members.resources.getLayerById($(this).data('layer'));

            if (!layer) {
                return;
            }

            var parameters = {
                map: members.map.control,
                metadata: layer,
                layer: layer.__object
            };

            var view = members.views.createView({
                resourceType: layer.type,
                viewType: PublicaMundi.Maps.Resources.UI.Views.CONFIG,
                target: 'main'
            });

            view.on('save', function (sender, settings) {
                layer.viewer.opacity = settings.opacity;
                if (settings.style) {
                    layer.viewer.style = settings.style;
                }
            });

            view.on('discard', function (sender) {

            });

            view.show(parameters);
        });
    };

    var initializePreview = function (reccursion) {
        if (members.preview.length === 0) {
            return;
        }
        reccursion = reccursion || 0;
        
        // TODO : Debug ...
        if (reccursion > 1) {
            throw 'Resource preview reccursion is invalid!';
        }

        var entry = members.preview.splice(0, 1)[0]

        switch (entry.type) {
            case PREVIEW.WMS:
                members.resources.addResource({
                    type: PREVIEW.WMS,
                    url: entry.url,
                    title: entry.title
                });
                break;
            case PREVIEW.WFS:
                members.resources.addResource({
                    type: PREVIEW.WFS,
                    title: entry.title,
                    url: entry.url,
                    format: PublicaMundi.Maps.Resources.WFS.Format.GML
                });
                break;
            case PREVIEW.KML:
                members.resources.addResource({
                    type: PREVIEW.KML,
                    title: entry.title,
                    url: entry.url,
                    projection: 'EPSG:4326',
                    format: 'KML'
                });
                break;
            case PREVIEW.Package:
                $.ajax({
                    url: entry.url,
                    dataType: 'jsonp',
                    context: this,
                }).done(function (response) {
                    if ((response.success) && (response.result) && (response.result.resources)) {
                        for (var i = 0; i < response.result.resources.length; i++) {
                            parseCkanResourceMetadata(response.result.resources[i]);

                            initializePreview(reccursion + 1);
                        }
                    }
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    console.log('Failed to load dataset ' + entry.url);
                });
                break;
            case PREVIEW.Resource:
                $.ajax({
                    url: entry.url,
                    dataType: 'jsonp',
                    context: this,
                }).done(function (response) {
                    if ((response.success) && (response.result)) {
                        parseCkanResourceMetadata(response.result);

                        initializePreview(reccursion + 1);
                    }
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    console.log('Failed to load resource ' + entry.url);
                });
                break;
        };
    };

    var parseCkanResourceMetadata = function (resource) {
        switch (resource.format.toUpperCase()) {
            case PREVIEW.WMS:
                members.preview.push({
                    type: PREVIEW.WMS,
                    url: resource.url,
                    title: resource.name
                });
                break;
            case PREVIEW.WFS:
                members.preview.push({
                    type: PREVIEW.WFS,
                    url: resource.url,
                    title: resource.name
                });
                break;
            case PREVIEW.KML:
                members.preview.push({
                    type: PREVIEW.KML,
                    url: resource.url,
                    title: resource.name,
                    projection: 'EPSG:4326',
                    format: 'KML'
                });
                break;
        }
    };

    var onResourceAdded = function (sender, resource) {
        var selectedLayers = [];

        var builder = members.resources.getBuilder(resource.metadata.type);

        var content = [];
        content.push('<div data-role="collapsible" id="' + resource.id + '">');

        content.push(builder.renderLayerGroup(resource));

        content.push('<ul data-role="listview" data-filter-theme="a" data-divider-theme="a">');

        for (var i = 0; i < resource.metadata.layers.length; i++) {
            var layer = resource.metadata.layers[i];

            content.push('<li id="' + layer.id + '" class="li-' + resource.metadata.type.toLowerCase() + '">');

            content.push(builder.renderLayerItem(resource, layer));

            content.push('</li>');

            if ($.inArray(layer.name, resource.metadata.parameters.selected) !== -1) {
                selectedLayers.push(layer.id);
            }
        }
        content.push('</ul></div>');

        // Create collapsible list and refresh search controls
        $('#services').append(content.join('')).collapsibleset('refresh');
        $('#' + resource.id + ' ul').listview();

        $('#' + resource.id + '_rl').click(function (e) {
            members.resources.removeResource($(this).data('resource'));
        });

        if ($('#view-layers').hasClass('ui-panel-closed')) {
            $('#view-layers').panel('toggle');
        }

        $('#' + resource.id).collapsible('expand');

        for (var l = 0; l < selectedLayers.length; l++) {
            $('.layer-selector :checkbox[data-layer="' + selectedLayers[l] + '"]').trigger('click');
        }

        $("#services").filterable("refresh");
        resumeUI();
    };

    var onResourceRemoved = function (sender, resource) {
        for (var i = 0; i < resource.metadata.layers.length; i++) {
            var layer = resource.metadata.layers[i];
            if (layer.__object) {
                members.map.control.removeLayer(layer.__object);
            }
        }

        $('#' + resource.id).collapsible('destroy').remove();

        $('#services').collapsibleset('refresh');
        $("#services").filterable("refresh");
    };

    members.resources.on('resource:add', onResourceAdded);

    members.resources.on('resource:remove', onResourceRemoved);

    PublicaMundi.initialize = function () {
        initializeParameters();

        initializeLayout();

        initializeMap();

        attachEvents();

        setTimeout(function () {
            $('#block-ui').fadeOut(500).hide();
            $('body').css('overflow-y', 'auto');
        }, 500);

        initializePreview();
    };

    return PublicaMundi;
});