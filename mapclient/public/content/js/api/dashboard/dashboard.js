define(['module', 'jquery', 'ol', 'URIjs/URI', 'data_api', 'shared'], function (module, $, ol, URI, API, PublicaMundi) {
    "use strict";

    // Properties
    var properties = {
        resources: null,
        layer: null,
        map: {
            query : null,
            layer: null
        }
    };

    var queryIndex = 0;

    var QueryMode = {
        JSON : 'json',
        FLUENT : 'fluent',
        WPS: 'wps'
    };

    var index = window.location.href.indexOf('api/dashboard');
    var relativePath = window.location.href.substr(0, index);

    // Data API configuration options
    var options = {
        debug: module.config().debug,
        endpoint: relativePath,
        proxy: relativePath + 'proxy/proxy_resource?url=',
        alias: module.config().api.alias,
        wps: {
            corsEnabled: false,
            endpoint: module.config().api.wps,
            delay: 2000
        }
    };

    API.Data.configure(options);

    // Data API WPS extension configuration options
    var wpsOptions = {
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
            },
            'Boundary': {
                id: 'ogr.Boundary',
                params: [{
                    name: 'InputPolygon',
                    type: 'complex',
                    mimeType: 'text/xml'
                }],
                result: 'Result'
            },
            'ConvexHull': {
                id: 'ogr.ConvexHull',
                params: [{
                    name: 'InputPolygon',
                    type: 'complex',
                    mimeType: 'text/xml'
                }],
                result: 'Result'
            }
        }
    };

    API.Data.WPS.configure(wpsOptions);

    var suspendActionUI = function() {
        $('.action-img-button').addClass('action-img-button-disabled').removeClass('action-img-button');
    };

    var resumeActionUI = function() {
        $('.action-img-button-disabled').addClass('action-img-button').removeClass('action-img-button-disabled');
    };

    var isBusy = function() {
        return $('.progress-loader').is(':visible');
    };

    var createOSM = function() {
        if(module.config().servers.osm.length > 0) {
            // 1: Use custom XYZ source
            return new ol.layer.Tile({
                source: new ol.source.XYZ({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ],
                    urls: module.config().servers.osm
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        } else if(module.config().servers.mapproxy.length > 0) {
            // 2: User Map Proxy
            return new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ],
                    url: module.config().servers.mapproxy,
                    params: {
                        'SERVICE': 'WMS',
                        'VERSION': '1.1.1',
                        'LAYERS': module.config().layers.osm
                    }
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        } else {
            // 3: Use default OSM tiles (not recommended)
            // http://wiki.openstreetmap.org/wiki/Tile.openstreetmap.org/Usage_policy

            return new ol.layer.Tile({
                source: new ol.source.OSM ({
                    attributions: [
                        ol.source.OSM.ATTRIBUTION
                    ]
                }),
                opacity: ($('#base-layer-opacity').val() / 100.0)
            });
        }
    };

    properties.map.layer = new ol.Map({
        layers: [createOSM()],
        target: 'map-layer',
        view: new ol.View({
            center: [2448716, 4600000],
            zoom: 9
        })
    });

    var queryEditor = CodeMirror.fromTextArea(document.getElementById('query'), {
        lineNumbers: true,
        mode: {name: 'javascript', globalVars: true},
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        extraKeys: {'Ctrl-Space': 'autocomplete'}
    });

    queryEditor.on('keyup', function(sender, e) {
        if(e.key==='.') {
            queryEditor.showHint(e);
        }
    });

    var outputEditor = CodeMirror.fromTextArea(document.getElementById('output'), {
        lineNumbers: true,
        mode: 'application/json',
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        readOnly: true
    });

    var jsonSyntaxEditor = CodeMirror.fromTextArea(document.getElementById('json-syntax'), {
        lineNumbers: true,
        mode: 'application/json',
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        readOnly: true
    });

    $('img.action-button').tooltip();

    $.widget( 'custom.iconselectmenu', $.ui.selectmenu, {
        _renderItem: function( ul, item ) {
            var li = $('<li>', { text: item.label } );
            if ( item.disabled ) {
                li.addClass( 'ui-state-disabled' );
            }
            $( '<span>', {
                style: item.element.attr( 'data-style' ),
                'class': 'ui-icon ' + item.element.attr( 'data-class' )
            }).appendTo( li );
            return li.appendTo( ul );
        }
    });

    $('#resource_id').selectmenu().selectmenu('disable');
    $('#resource_id-menu').css({'max-height' : '200px', 'min-width' : '350px'});

    $('#process_id').selectmenu().selectmenu('disable');
    $('#process_id-menu').css({'max-height' : '200px', 'min-width' : '350px'});

    var vectorSource = new ol.source.GeoJSON({
        projection: 'EPSG:3857'
    });

    $('#process_show').click(function () {
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();

        var query = new API.Data.Query();

        query.getProcesses({
            success: function(data) {
                $('#output').val(JSON.stringify(data, null, ' '));
                $('#examples-tabs').tabs('option', 'active', 1);
                outputEditor.setValue($('#output').val());

                var processes = data.Capabilities.ProcessOfferings.Process;

                $('#process_id').find('option').remove();

                for (var p=0; p < processes.length; p++) {
                    $('#process_id').append($('<option>', {
                        value: processes[p].Identifier.__text,
                        text: processes[p].Identifier.__text
                    }));
                }
                if($('#process_id').find('option').size() === 0) {
                    $('#process_id').selectmenu().selectmenu('disable');
                } else {
                    $('#process_id').selectmenu().selectmenu('enable');
                    var value = $('#process_id').find('option').eq(0).val();
                    $('#process_id').val(value);
                    $('#process_id').selectmenu('refresh');
                }
            },
            complete: function() {
                $('.progress-loader').hide();
            }
        });
    });

    $('#process_describe').click(function () {
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();

        var query = new API.Data.Query();

        query.describeProcess({
            id: $('#process_id').val(),
            success : function(data) {
                $('#output').val(JSON.stringify(data, null, ' '));
                $('#examples-tabs').tabs('option', 'active', 1);
                outputEditor.setValue($('#output').val());
            },
            complete: function() {
                $('.progress-loader').hide();
            }
        });
    });

    var resourceShow = function(data, execution) {
        $('#output').val(JSON.stringify(data, null, ' '));
        $('#examples-tabs').tabs('option', 'active', 1);
        outputEditor.setValue($('#output').val());

        renderExecutionStats(execution);

        $('#resource_id').find('option').remove();
        for (var id in data.resources) {
            $('#resource_id').append($('<option>', {
                value: id,
                text: id
            }));
        }
        if($('#resource_id').find('option').size() === 0) {
            $('#resource_id').selectmenu().selectmenu('disable');
        } else {
            $('#resource_id').selectmenu().selectmenu('enable');
            var value = $('#resource_id').find('option').eq(0).val();
            $('#resource_id').val(value);
            $('#resource_id').selectmenu('refresh');
        }
    };

    $('#resource_show').click(function () {
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();

        var query = new API.Data.Query();

        query.getResources({
            context: this,
            success: resourceShow,
            complete: function() {
                $('.progress-loader').hide();
            }
        });
    });

    var describeResource = function(data, execution) {
        renderExecutionStats(execution);

        $('#output').val(JSON.stringify(data, null, ' '));
        $('#examples-tabs').tabs('option', 'active', 1);
        outputEditor.setValue($('#output').val());
    };

    $('#resource_describe').click(function () {
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();

        var query = new API.Data.Query();

        query.describeResource({
            id: $('#resource_id').val(),
            context: this,
            success: describeResource,
            complete: function() {
                $('.progress-loader').hide();
            }
        });
    });

    var renderExecutionStats = function(execution) {
        if(execution) {
            if(execution.size) {
                $('#query_size').html(execution.size.toFixed(2) + ' Kbs').show();
            }
            if((execution.start) && (execution.end)) {
                $('#query_time').html(((execution.end - execution.start)/1000.0).toFixed(2) + ' secs').show();
            }
        }
    }

    var downloadFile = function(data, execution) {
        $('#output').val(JSON.stringify(data, null, ' '));
        outputEditor.setValue($('#output').val());

        renderExecutionStats(execution);

        vectorSource.clear();

        if(data.success) {
            jQuery('#export-download-frame').remove();
            jQuery('body').append('<div id="export-download-frame" style="display: none"><iframe src="' + relativePath + 'api/download/' + data.code + '"></iframe></div>');
        } else {
            $('#examples-tabs').tabs('option', 'active', 1);
        }
    }

    var onSuccess = function(response, execution) {
        $('.progress-loader').hide();

        $('#output').val(JSON.stringify(response, null, ' '));
        outputEditor.setValue($('#output').val());

        renderExecutionStats(execution);

        if('success' in response) {
            if(!response.success) {
                $('#examples-tabs').tabs('option', 'active', 1);
                return;
            }
        }
        if(Array.isArray(response.data[0])) {
            $('#examples-tabs').tabs('option', 'active', 1);
        } else {
            var format = new ol.format.GeoJSON();
            var features = format.readFeatures(response.data[0], {
                dataProjection: 'EPSG:3857',
                featureProjection: 'EPSG:3857'
            });

            vectorSource.clear();
            vectorSource.addFeatures(features);

            properties.map.query.getView().fitExtent(vectorSource.getExtent(), properties.map.query.getSize());

            $('#examples-tabs').tabs('option', 'active', 0);
        }
    };

    var onFailure = function(message, execution) {
        renderExecutionStats(execution);

        $('#dialog-message-text').html(message);
        $( "#dialog-message" ).dialog({
            modal: true
        });
    };

    var onComplete = function() {
        $('.progress-loader').hide();

        resumeActionUI();
    };

    var initializeExecution = function() {
        vectorSource.clear();
        select.getFeatures().clear();

        $('#query_size, #query_time').hide();

        return {
            size : null,
            start : (new Date()).getTime(),
            end : null
        };
    };

    var executeQuery = function(action) {
        var execution = initializeExecution();

        var mode = $('.query-mode-option-selected').data('mode');
        switch(mode) {
            case QueryMode.JSON:
                var query = new API.Data.Query();

                query.parse(queryEditor.getValue(' '));

                switch(action) {
                    case 'execute':
                        query.execute({
                            context: this,
                            success: onSuccess,
                            failure: onFailure,
                            complete: onComplete
                        });
                        break;
                    case 'export':
                        query.format(API.Data.Format.ESRI).export({
                            context: this,
                            success: downloadFile,
                            failure: onFailure,
                            complete: onComplete
                        });
                        break;
                }
                break;
            case QueryMode.FLUENT:
                if(typeof PublicaMundi.queries[queryIndex].method === 'function' ) {
                    try {
                        var dynamicFunction = null;
                        var dynamicFunctionBody =  queryEditor.getValue();

                        dynamicFunctionBody = dynamicFunctionBody.split('PublicaMundi.Data').join('API.Data');

                        eval('dynamicFunction = function(onSuccess, onFailure, onComplete) { ' + dynamicFunctionBody + '};');
                        if(typeof dynamicFunction === 'function') {
                            dynamicFunction.call(this, onSuccess, onFailure, onComplete);
                        }
                    } catch (e) {
                        console.log(e.toString());
                    }
                }
                break;
            case QueryMode.WPS:
                if(typeof PublicaMundi.queries[queryIndex].process === 'function' ) {
                    try {
                        var dynamicFunction = null;
                        var dynamicFunctionBody =  queryEditor.getValue();

                        dynamicFunctionBody = dynamicFunctionBody.split('PublicaMundi.Data').join('API.Data');

                        eval('dynamicFunction = function(onSuccess, onFailure, onComplete) { ' + dynamicFunctionBody + '};');
                        if(typeof dynamicFunction === 'function') {
                            dynamicFunction.call(this, onSuccess, onFailure, onComplete);
                        }
                    } catch (e) {
                        console.log(e.toString());
                    }
                }
                break;
        }
    };

    var setQuery = function(index) {
        var mode = $('.query-mode-option-selected').data('mode');

        $('#query_size, #query_time').hide();
        if(index === 0) {
            $('#query_prev').removeClass('query-button-enabled').addClass('query-button-disabled');
        } else if(!$('#query_prev').hasClass('query-button-enabled')) {
            $('#query_prev').addClass('query-button-enabled');
        }

        if(index === PublicaMundi.queries.length-1) {
            $('#query_next').removeClass('query-button-enabled').addClass('query-button-disabled');
        } else if(!$('#query_next').hasClass('query-button-enabled')) {
            $('#query_next').addClass('query-button-enabled');
        }

        $('#query_index').html(index+1);

        $('#query-notes').html(PublicaMundi.queries[index].description);
        switch(mode) {
            case QueryMode.JSON:
                var text = JSON.stringify(PublicaMundi.queries[index].query, null, '  ')

                var config = API.Data.getConfiguration();

                if(config.alias) {
                    for(var prop in config.alias) {
                        text = text.split('"' + prop + '"').join('"' + config.alias[prop] + '"');
                    }
                }

                $('#query').val(text);
                break;
            case QueryMode.FLUENT:
                $('#query').val(PublicaMundi.queries[index].method.toString());
                break;
            case QueryMode.WPS:
                $('#query').val(PublicaMundi.queries[index].process.toString());
                break;
        }

        queryEditor.setValue($('#query').val());
        queryEditor.refresh();

        if((mode === QueryMode.FLUENT) || (mode === QueryMode.WPS)) {
            queryEditor.execCommand('goDocEnd');
            queryEditor.execCommand('deleteLine');
            queryEditor.execCommand('goDocStart');
            queryEditor.execCommand('deleteLine');
            queryEditor.refresh();
        }
    };

    setQuery(queryIndex);

    $('#query_prev').click(function(e) {
        if(queryIndex > 0) {
            queryIndex--;
            setQuery(queryIndex);
        }
    });

    $('#query_next').click(function(e) {
        if(queryIndex < PublicaMundi.queries.length-1) {
            queryIndex++;
            setQuery(queryIndex);
        }
    });

    $('#query_exec').click(function(e) {
        if(isBusy()) {
            return;
        }
        suspendActionUI();

        var mode = $('.query-mode-option-selected').data('mode');
        if(mode == QueryMode.WPS) {
            $('.query-mode-option[data-mode=json]').click();
        }

        $('.progress-loader').show();
        executeQuery('execute');
    });

    $('#query_export').click(function(e) {
        if(isBusy()) {
            return;
        }
        suspendActionUI();

        var mode = $('.query-mode-option-selected').data('mode');
        if(mode != QueryMode.JSON) {
            $('.query-mode-option[data-mode=json]').click();
        }

        $('.progress-loader').show();
        executeQuery('export');
    });

    $('#query_wps').click(function(e) {
        if(isBusy()) {
            return;
        }
        suspendActionUI();

        var mode = $('.query-mode-option-selected').data('mode');
        if(mode != QueryMode.WPS) {
            $('.query-mode-option[data-mode=wps]').click();
        }

        $('.progress-loader').show();
        executeQuery('process');
    });

    $('.query-mode-option').click(function(e) {
        if($(this).hasClass('query-mode-option-selected')) {
            return;
        }
        $('.query-mode-option').removeClass('query-mode-option-selected');
        $(this).addClass('query-mode-option-selected');
        switch($(this).data('mode')) {
            case QueryMode.JSON:
                setQuery(queryIndex);
                break;
            case QueryMode.FLUENT:
                setQuery(queryIndex);
                break;
            case QueryMode.WPS:
                setQuery(queryIndex);
                break;
        }
    });

    var timeout = null;

    var toggleResourceTiles = function() {
        if(timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        timeout = setTimeout(function() {
            var term = $('#resource-filter').val();
            if(term) {
                $('.resource-title').each(function(index, element) {
                    if($(this).html().indexOf(term) == -1) {
                        $(this).parents('.resource-tile').hide();
                    } else {
                        $(this).parents('.resource-tile').show();
                    }
                });
            } else {
                $('.resource-tile').show();
            }
        }, 250);
    };

    $('#resource-filter').on('keydown', function(e) {
        toggleResourceTiles();
    });

    var vectorLayer = new ol.layer.Vector({
        source: vectorSource
    });

    var select = new ol.interaction.Select({
        condition: ol.events.condition.click
    });

    select.getFeatures().on('change:length', function (e) {
        if (e.target.getArray().length === 0) {
            // this means it's changed to no features selected
            window.features = null;
            if($('#feature-dialog').hasClass('ui-dialog-content')) {
                $('#feature-dialog').dialog('close');
            }
        } else {
            // this means there is at least 1 feature selected
            var features = e.target;
            var feature = features.getArray()[0];

            var text = [];
            text.push('<table class="feature-table">');
            var keys = feature.getKeys();
            for (var i = 0; i < keys.length; i++) {
                if (keys[i] != feature.getGeometryName()) {
                    text.push('<tr class="feature-row"><td class="feature-prop-key">' + keys[i] + '</td><td class="feature-prop-value">' + feature.get(keys[i]) + '</td></tr>');
                }
            }
            text.push('</table>');

            $('#feature-dialog .feature-dialog-content').html(text.join('\n'));
            if(!$('#feature-dialog').is(':visible')) {
                $('#feature-dialog').dialog({
                    width: 400,
                    position: { my: 'right-15 top+15', at: 'right top', of: '#map' }
                });
            }
        }
    });

    properties.map.query = new ol.Map({
        layers: [createOSM(), new ol.layer.Vector({ source: vectorSource })],
        target: 'map',
        view: new ol.View({
            center: [2748716, 4600000],
            zoom: 7
        })
    });

    properties.map.query.addInteraction(select);

    $('#examples-accordion').accordion({
        heightStyle: 'fill'
    });

    $('body').on('focus', '.resource-tile-table', function() {
        $(this).select();
    });

    $('#examples-tabs').tabs({
        heightStyle: 'fill',
        activate: function( event, ui ) {
            switch(ui.newTab.index()) {
                case 1:
                    outputEditor.refresh();
                    break;
                case 2:
                    jsonSyntaxEditor.refresh();
                    break;
            }
        }
    });

    $('button.action').button();

    // Resource loading
    var loadResourcesFromCatalog = function(forceLoad) {
        if((!properties.resources) || (forceLoad)) {
            $.ajax({
                url: '../metadata/load', // 'http://geodata.gov.gr/maps/metadata/load'
                context: this,
                dataType: 'json'
            }).done(function(data, textStatus, jqXHR) {
                var content = [], catalog = module.config().catalog;

                properties.resources = data;

                for(var i=0; i < data.packages.length; i++) {
                    var p = data.packages[i];
                    for(var j=0; j < p.resources.length; j++) {
                        var r = p.resources[j];
                        if(r.queryable) {
                            content.push('<div class="resource-tile">');

                            content.push('<div class="clearfix resource-label">Title</div>');
                            content.push('<div class="clearfix resource-title resource-value">' + p.title.en + '</div>');
                            content.push('<div class="clearfix resource-label">Resource Id</div>');
                            content.push('<div class="clearfix resource-value">');
                            content.push('<div class="clearfix resource-tile-map"><img src="../content/images/api/dashboard/layers.svg" data-package="' + p.id + '" data-resource="' + r.id + '" /></span></div>');
                            content.push('<div class="clearfix resource-value-text"><input value="' + r.queryable.resource + '" class="resource-tile-table" /></div>');
                            content.push('</div>');
                            content.push('<div class="clearfix resource-label">SRID</div>');
                            content.push('<div class="clearfix resource-value">' + r.queryable.srid + '</div>');

                            var mapLink = '../?package=' + p.id + '&resource=' + r.id;
                            var catalogLink = catalog + 'dataset/' + p.id;

                            content.push('<div class="clearfix">');
                            content.push('<a class="resource-tile-link" href="' + catalogLink + '" target="_blank">View in catalog</a>');
                            content.push('<a class="resource-tile-link" href="' + mapLink+ '" target="_blank">View in maps</a>');
                            content.push('</div>');

                            content.push('</div>');
                        }
                    }
                }
                $('#resource-catalog-content').html(content.join(''));

                toggleResourceTiles();

                $('#resource-catalog-header').show();
                $('#resource-catalog-content').fadeIn(250);
            });
        }
    };

    // Resource viewing
    var viewResource = function(packageId, resourceId) {
        var resources= properties.resources;
        if(!resources) {
            return;
        }

        var packageData = null, resourceData = null;

        for(var i=0; i < resources.packages.length; i++) {
            if(resources.packages[i].id == packageId) {
                packageData = resources.packages[i];
                break;
            }
        }

        if(packageData) {
            for(var i=0; i< packageData.resources.length; i++) {
                if(packageData.resources[i].id == resourceId) {
                    resourceData = packageData.resources[i];
                    break;
                }
            }
        }

        if((!resourceData) || (!resourceData.wms_server) || (!resourceData.wms_layer)){
            return;
        }

        var extent = [1948226, 4024868, 4008846, 5208724];

        if(packageData.spatial) {
            var source = new ol.source.GeoJSON({
                object:{
                    'type': 'FeatureCollection',
                    'crs': {
                        'type': 'name',
                        'properties': {'name': 'EPSG:4326'}
                    },
                    'features': [{
                        'type': 'Feature',
                        'geometry': packageData.spatial
                    }]
                },
                projection: 'EPSG:3857'
            });
            extent = source.getFeatures()[0].getGeometry().getExtent();
        }


        if(properties.layer) {
            properties.map.layer.removeLayer(properties.layer);
        }

        properties.layer = new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: resourceData.wms_server,
                params: {
                    'VERSION': '1.3.0',
                    'LAYERS': resourceData.wms_layer,
                    projection: ol.proj.get('EPSG:900913')
                }

            })
        });

        properties.map.layer.addLayer(properties.layer);

        if($('#map-dialog').is(':ui-dialog')) {
            if(!$('#map-dialog').dialog('isOpen')) {
                $('#map-dialog').dialog('open');
            }
            var view = properties.map.layer.getView();
            var size = properties.map.layer.getSize();
            view.fitExtent(extent, size);
        } else {
            $('#map-dialog').dialog({
                title: 'Layer Preview',
                width: 400,
                height: 400,
                position: { my: "right bottom", at: "right bottom", of: $('#page-resources') },
                open: function() {
                    $('#map-layer').height($('#map-dialog').height()-5).width($('#map-dialog').width() - 2);
                    properties.map.layer.updateSize();

                    var view = properties.map.layer.getView();
                    var size = properties.map.layer.getSize();
                    view.fitExtent(extent, size);
                },
                resize: function() {
                    $('#map-layer').height($('#map-dialog').height()-5).width($('#map-dialog').width() - 2);
                    properties.map.layer.updateSize();
                }
            });
        }
    };

    $('body').on('click', '.resource-tile-map img', function() {
        var p = $(this).data('package');
        var r = $(this).data('resource');

        //var url = '../?package=' + p + '&resource=' + r;
        //window.open(url, '_blank');

        viewResource(p, r);
    });

    // Page navigation
    $('.section').click(function(e) {
        // Get old/new pages
        if($(this).hasClass('section-selected')) {
            return;
        }

        suspendPageUI();

        var selected = $(this).data('page');
        var old = $('.section-selected').data('page');

        // Update styling
        $('.section-selected').removeClass('section-selected');
        $(this).addClass('section-selected');

        $('#' + old).hide();
        $('#' + selected).show();

        switch(selected) {
            case 'page-resources':
                loadResourcesFromCatalog();
                break;
        }

        resize();
        resumePageUI();
    });

    // Page layout
    var suspendPageUI = function() {
        $('#page-overlay').show();
    };

    var resumePageUI = function() {
        $('#page-overlay').fadeOut(400);
    };

    var resize = function() {
        var pageId = $('.section-selected').data('page');

        var page = $('#' + pageId);

        $('.page').height($(window).height()-75).width($(window).width() - 20);

        switch(pageId) {
            case 'page-docs':
                $('#docs-frame').height($(page).height()).width($(page).width());
            case 'page-syntax':
                $('#page-syntax .CodeMirror').height($(page).height()).width($(page).width());
                jsonSyntaxEditor.refresh();
                break;
            case 'page-resources':
                $('#resource-catalog-content').height($(window).height()-115).width($(window).width() - 20);
                break;
            case 'page-examples':
                $('#examples-accordion-container').height($(window).height()-90);
                $('#examples-accordion').accordion('refresh');

                $('#query-container .CodeMirror').height($(window).height()-291);
                queryEditor.refresh();

                $('#examples-tabs-container').height($(window).height()-91).width($(window).width() - 470);
                $('#examples-tabs').tabs('refresh');

                $('#map').height($(window).height()-150).width($(window).width() - 485);
                properties.map.query.updateSize();


                $('#examples-tabs-2 .CodeMirror').height($(window).height()-150).width($(window).width() - 482);
                outputEditor.refresh();
                break;
        };
    };

    // Initialize
    $(function() {
        $(window).resize(resize);
        resize();

        // Load query syntax
        $.ajax({
            url: '../content/js/api/dashboard/json-syntax.js',
            context: this,
            dataType: 'text'
        }).done(function(data, textStatus, jqXHR) {
            // Update syntax
            $('#json-syntax').val(data);
            jsonSyntaxEditor.setValue($('#json-syntax').val());

            // Display default page
            $('#block-ui').fadeOut(500, function() {
                $('#page-docs').fadeIn(200);
                jsonSyntaxEditor.refresh();
            });
        });
    });

    return PublicaMundi;
});
