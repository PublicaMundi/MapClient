define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

    // Private members
    var members = {
        config: module.config(),
        ckan: null,
        map: {
            control: null,
            interactions: {
                bbox: null
            }
        },
        resources: null,
        views: null,
        view: null,
        preview: null
    };

    members.resources = new PublicaMundi.Maps.Resources.ResourceManager({
        config: module.config()
    });

    members.views = new PublicaMundi.Maps.Resources.UI.ViewManager({
        config: module.config()
    });

    members.ckan = new PublicaMundi.Maps.CKAN.Metadata({
        config: module.config()
    });

    var supsendUI = function () {
        $('.progress-loader').show();
    };

    var resumeUI = function () {
        $('.progress-loader').fadeOut(400).hide();
    };

    var initializeParameters = function () {
        var resource = window.resource;

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

                members.preview = uri.toString();
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
            projection: PublicaMundi.Maps.CRS.Google,
            center: members.config.map.center || [0, 0],
            zoom: zoom,
            minZoom: minZoom,
            maxZoom: maxZoom
        });

        var layers = [];

       layers.push(new ol.layer.Tile({
            source: new ol.source.OSM()
        }));

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
                return ol.coordinate.format(coordinate, '{x} , {y}', 4);
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

        attachCatalogEvents();

        attachDatasetEvents();

        attachLayerActionEvents();
    };

    var attachLayerFilterEvents = function () {
        $('#catalog').filterable("option", "filterCallback", function (index, searchValue) {
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
            $('#catalog').filterable("refresh");
        });

        $('#catalog').on("filterablefilter", function (event, ui) {
            var parents = $(ui.items).find('ul').parents('.ui-collapsible');
            for (var i = 0; i < parents.length; i++) {
                var count = $(parents[i]).find('li:not(.ui-screen-hidden)').size();

                $(parents[i]).find('span.ui-li-count-resource').html(count);
            }
        });
    };

    var attachBaseLayerSelectionEvents = function () {
        $('#base_layer-listbox-popup').on( "popupbeforeposition", function( event, ui ) {
            var items = $('#base_layer-listbox-popup').find('li a');
            var options = $('#base_layer').find('option');
            for(var i=0; i < options.length; i++){
                if($(items[i]).find('img').size()===0) {
                    $(items[i]).css('padding-left', '35px');
                    $(items[i]).append('<img src="' + $(options[i]).data('img') + '" alt="" class="base-layer-list-icon"/>');
                }
            }
        });

        var setBaseLayer = function(type, set) {
            var newBaseLayer;
            switch(type) {
                case 'bing':
                    if(members.config.bing.key) {
                        newBaseLayer = new ol.layer.Tile({
                            source: new ol.source.BingMaps({
                                key: members.config.bing.key,
                                imagerySet: set
                            })
                        });
                    }
                    break;
                case 'stamen':
                    newBaseLayer = new ol.layer.Tile({
                        source: new ol.source.Stamen({layer: set })
                    });
                    break;
                case 'mapquest':
                    newBaseLayer = new ol.layer.Tile({
                        source: new ol.source.MapQuest({layer: set })
                    });
                    break;
                case 'osm':
                    newBaseLayer = new ol.layer.Tile({
                        source: new ol.source.OSM()
                    });
                default:
                    console.log('Base layer of type ' + type + ' is not supported.');
            }

            var oldBaseLayer = members.map.control.getLayers().item(0);

            members.map.control.getLayers().insertAt(0, newBaseLayer);
            setTimeout(function () {
                members.map.control.getLayers().remove(oldBaseLayer);
            }, 1000);
        };

        $('#base_layer').change(function(e) {
            var selection = $('#base_layer option:selected')
            setBaseLayer($(selection).data('type'), $(selection).data('set'));
        });
    };

    var attachCatalogEvents = function () {

        $('#catalog-return').click(function (e) {
            $(this).hide();

            $('#catalog-header').html('Catalog');

            $('#datasets').fadeOut(200, function () {
                $('#topics').fadeIn(200, function () {
                    $("#view-layers").trigger("updatelayout");
                });
            });
        });

        $('#toggle-catalog').click(function (e) {
            if ($(this).hasClass('ui-icon-minus')) {
                $(this).removeClass('ui-icon-minus').addClass('ui-icon-plus');
                $('#catalog').hide();
                $("#view-layers").trigger("updatelayout");
            } else {
                $(this).removeClass('ui-icon-plus').addClass('ui-icon-minus');
                $('#catalog').show();
                $("#view-layers").trigger("updatelayout");
            }
        });

        $('#catalog').on('click', '.btn-dataset-resource-add', function (e) {
            var resource = members.ckan.getResourceById($(this).data('resource'));

            if (!members.resources.addResourceFromCatalog(resource)) {
                $('#message-popup-text').html('Preview is not supported for format ' + resource.format);
                $('#message-popup').popup('open')
            }
        });
    };

    var attachDatasetEvents = function () {
        $('#topics').on('click', 'div.topic', function (e) {
            members.ckan.getTopicById($(this).data('id'));
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

    var initializePreview = function () {
        if (!members.preview) {
            return;
        }

        var url = members.preview;

        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (response) {
            if ((response.success) && (response.result)) {
                members.resources.addResourceFromCatalog(response.result);
            }
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.log('Failed to load resource ' + url);
        });
    };

    var onResourceAdded = function (sender, resource) {
        var selectedLayers = [];

        var layerFactory = members.resources.getLayerFactory(resource.metadata.type);

        var content = [], selector;

        if (resource.metadata.isLayer) {
            content.push('<ul id="' + resource.id + '" data-role="listview" data-inset="true" data-filter-theme="a" data-divider-theme="a" style="border-top: 1px solid #dddddd; position: relative;">');
            content.push('<li id="' + resource.metadata.layers[0].id + '" class="li-' + resource.metadata.type.toLowerCase() + '">');
            content.push(layerFactory.renderLayerGroup(resource));
            content.push('</li>');
            content.push('</ul>');

            selectedLayers.push(resource.metadata.layers[0].id);

            selector = '#' + resource.id
        } else {
            content.push('<div data-role="collapsible" id="' + resource.id + '">');

            content.push(layerFactory.renderLayerGroup(resource));

            content.push('<ul data-role="listview" data-filter-theme="a" data-divider-theme="a">');

            for (var i = 0; i < resource.metadata.layers.length; i++) {
                var layer = resource.metadata.layers[i];

                content.push('<li id="' + layer.id + '" class="li-' + resource.metadata.type.toLowerCase() + '">');

                content.push(layerFactory.renderLayerItem(resource, layer));

                content.push('</li>');

                if ($.inArray(layer.name, resource.metadata.parameters.selected) !== -1) {
                    selectedLayers.push(layer.id);
                }
            }
            content.push('</ul></div>');

            selector = '#' + resource.id + ' ul';
        }

        $('#services').append(content.join(''));
        $(selector).listview();

        $('#' + resource.id + '_rl').click(function (e) {
            members.resources.removeResource($(this).data('resource'));
        });

        if ($('#view-layers').hasClass('ui-panel-closed')) {
            $('#view-layers').panel('toggle');
        }

        $('#' + resource.id).collapsible().collapsible('expand');

        for (var l = 0; l < selectedLayers.length; l++) {
            $('.layer-selector :checkbox[data-layer="' + selectedLayers[l] + '"]').trigger('click');
        }

        $('#catalog').filterable("refresh");

        $('.ui-mobile').scrollTop($('#' + resource.id).position().top)
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

        $('#catalog').filterable("refresh");
    };

    members.resources.on('resource:add', onResourceAdded);

    members.resources.on('resource:remove', onResourceRemoved);

    var onTopicRefresh = function (sender, topics) {
        var topic, title, i, content = [];

        $('#topics').html('');

        if ((Array.isArray(topics)) && (topics.length > 0)) {
            for (i = 0; i < topics.length; i++) {
                topic = topics[i];

                content.push('<div class="topic" data-id="' + topic.id + '" data-topic="' + topic.name + '">');

                if (topic.image) {
                    content.push('<img class="topic" src="' + topic.image + '" title="' + (topic.description ? topic.description : topic.title) + '"></img>');
                    title = topic.title;
                    if (title.length > 20) {
                        title = title.substring(0, 20) + ' ...';
                    }
                    content.push('<span class="topic">' + title + '</span>');
                }
                content.push('</div>');
            }
            $('#topics').html(content.join(''));
        }
    };


    var onTopicLoaded = function (sender, topic) {
        var content, temp, d, r, dataset, resource, totalResourceCount = 0, datasetResourceCount = 0;

        // Get all resources from all datasets and create HTML
        content = [];
        content.push('<ul id="dataset-listview" data-role="listview" class="ui-listview-outer" data-inset="true">');
        for (d = 0; d < topic.datasets.length; d++) {
            dataset = topic.datasets[d];
            datasetResourceCount = 0;
            temp = [];

            temp.push('<li id="li_' + dataset.id + '" data-role="collapsible" data-iconpos="left" data-shadow="false" data-corners="false" style="padding: 0px !important;">');
            temp.push('<h3><p style="padding-right: 20px; font-size: 1em !important; font-weight: bold">' + dataset.title + '</p>');
            if (dataset.notes) {
                temp.push('<a data-dataset="' + dataset.id + '" style="position: absolute; margin-top: -11px; top: 50%; right: 4px;" href="#" class="ui-btn ui-btn-icon-notext ui-icon-info ui-corner-all dataset-info"></a>');
            }
            temp.push('</h3>');

            temp.push('<ul id="ul_' + dataset.id + '" data-role="listview" data-shadow="false" data-inset="true" data-corners="false">');

            for (r = 0; r < dataset.resources.length; r++) {
                resource = dataset.resources[r];

                if ((resource.format) && (PublicaMundi.Maps.Resources.Types[resource.format.toUpperCase()])) {
                    datasetResourceCount++;
                    totalResourceCount++;
                } else {
                    // Resource type is not supported
                    continue;
                }

                temp.push('<li>');

                temp.push('<p style="font-size: 0.75em;"><span class="layer-title">' + resource.name +
'</span><a class="ui-btn ui-btn-icon-notext ui-icon-action btn-dataset-resource-add" data-resource="' + resource.id + '" href="#" style="position: absolute; right: 4px; top: 10px;"></a></p>');
                if (resource.size) {
                    temp.push('<p style=""><span class="layer-title">Size : ' + (resource.size / 1024.0).toFixed(2) + ' Kb</span></p>');
                }

                temp.push('</li>');
            }
            temp.push('</ul></li>');

            if (datasetResourceCount > 0) {
                content = content.concat(temp);
            }
        }
        content.push('</ul>');

        if (totalResourceCount > 0) {
            $('#topics').fadeOut(200, function () {
                $('#catalog-header').html('Catalog : ' + topic.caption);

                $('#datasets').html(content.join(''));

                $('.dataset-info').click(function (e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    var dataset = members.ckan.getDatasetById($(this).data('dataset'));
                    if (dataset.notes) {
                        setTimeout(function () {
                            $('#dataset-popup-title').html(dataset.title);
                            $('#dataset-popup-notes').html(dataset.notes);
                            $('#dataset-popup').popup('open');
                        }, 150);
                    }
                });

                // Initialize jQuery Mobile widgets
                for (d = 0; d < topic.datasets.length; d++) {
                    dataset = topic.datasets[d];
                    $('#ul_' + dataset.id).listview();
                    $('#li_' + dataset.id).collapsible();

                    for (r = 0; r < dataset.resources.length; r++) {
                        resource = dataset.resources[r];
                        $('#ul_' + resource.id).listview();
                        $('#li_' + resource.id).collapsible();
                    }
                }
                $('#dataset-listview').listview();

                $('#datasets').show();
                $('#catalog-return').show();
                $("#view-layers").trigger("updatelayout");
            });
        } else {
            $('#message-popup-text').html('No datasets found');
            $('#message-popup').popup('open')
        }
    };

    members.ckan.on('topic:refresh', onTopicRefresh);

    members.ckan.on('topic:loaded', onTopicLoaded);

    PublicaMundi.initialize = function () {
        initializeParameters();

        initializeLayout();

        initializeMap();

        attachEvents();

        members.ckan.getTopics();

        setTimeout(function () {
            $('#block-ui').fadeOut(500).hide();
            $('body').css('overflow-y', 'auto');

            if ($('#view-layers').hasClass('ui-panel-closed')) {
                $('#view-layers').panel('toggle');
            }
        }, 500);

        initializePreview();

        // Debug ...
        window.members = members;
    };

    return PublicaMundi;
});
