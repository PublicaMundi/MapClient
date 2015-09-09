define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

    var queryIndex = 0;

    var QueryMode = {
        JSON : 'json',
        FLUENT : 'fluent',
        WPS: 'wps'
    };

    var index = window.location.href.indexOf('demo/data-api.html');
    var relativePath = window.location.href.substr(0, index);

    // Data API configuration options
    var options = {
        debug: module.config().debug,
        endpoint: relativePath,
        proxy: relativePath + 'proxy/proxy_resource?url=',
        alias: {
            'cities' : '97569331-a2fb-45eb-92c9-064ef4f70d38',
            'blocksKalamaria' : 'd0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',
            'roadsKalamaria': '9e5f0732-092b-4a36-9b2b-6cc3b3f78ab6',
            'blueFlags2010' : 'ad815665-ec88-4e81-a27a-8d72cffa7dd2'
        },
        wps: {
            corsEnabled: false,
            endpoint: 'http://zoo.dev.publicamundi.eu/cgi-bin/zoo_loader.cgi',
            delay: 2000
        }
    };

    PublicaMundi.Data.configure(options);

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

    PublicaMundi.Data.WPS.configure(wpsOptions);

    var suspendUI = function() {
        $('.action-img-button').addClass('action-img-button-disabled').removeClass('action-img-button');
    };

    var resumeUI = function() {
        $('.action-img-button-disabled').addClass('action-img-button').removeClass('action-img-button-disabled');
    };

    var isBusy = function() {
        return $('.progress-loader').is(':visible');
    };

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
        mode: 'text/javascript',
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        readOnly: true
    });

    var jsonSyntaxEditor = CodeMirror.fromTextArea(document.getElementById('json-syntax'), {
        lineNumbers: true,
        mode: 'text/javascript',
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        readOnly: true
    });

    $.ajax({
        url: '../content/js/demo/json-syntax.js',
        context: this,
        dataType: 'text'
    }).done(function(data, textStatus, jqXHR) {
        $('#json-syntax').val(data);
        jsonSyntaxEditor.setValue($('#json-syntax').val());
        jsonSyntaxEditor.refresh();
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

        var query = new PublicaMundi.Data.Query();

        query.getProcesses({
            success: function(data) {
                $('#output').val(JSON.stringify(data, null, ' '));
                $('#tabs').tabs('option', 'active', 1);
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

        var query = new PublicaMundi.Data.Query();

        query.describeProcess({
            id: $('#process_id').val(),
            success : function(data) {
                $('#output').val(JSON.stringify(data, null, ' '));
                $('#tabs').tabs('option', 'active', 1);
                outputEditor.setValue($('#output').val());
            },
            complete: function() {
                $('.progress-loader').hide();
            }
        });
    });

    var resourceShow = function(data, execution) {
        $('#output').val(JSON.stringify(data, null, ' '));
        $('#tabs').tabs('option', 'active', 1);
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

        var query = new PublicaMundi.Data.Query();

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
        $('#tabs').tabs('option', 'active', 1);
        outputEditor.setValue($('#output').val());
    };

    $('#resource_describe').click(function () {
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();

        var query = new PublicaMundi.Data.Query();

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
            $('#tabs').tabs('option', 'active', 1);
        }
    }

    var onSuccess = function(response, execution) {
        $('.progress-loader').hide();

        $('#output').val(JSON.stringify(response, null, ' '));
        outputEditor.setValue($('#output').val());

        renderExecutionStats(execution);

        if('success' in response) {
            if(!response.success) {
                $('#tabs').tabs('option', 'active', 1);
                return;
            }
        }

        var format = new ol.format.GeoJSON();
        var features = format.readFeatures(response.data[0], {
            dataProjection: 'EPSG:3857',
            featureProjection: 'EPSG:3857'
        });

        vectorSource.clear();
        vectorSource.addFeatures(features);

        map.getView().fitExtent(vectorSource.getExtent(), map.getSize());

        $('#tabs').tabs('option', 'active', 0);
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

        resumeUI();
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
                var query = new PublicaMundi.Data.Query();

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
                        query.format(PublicaMundi.Data.Format.ESRI).export({
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
                        eval('dynamicFunction = function(onSuccess, onFailure, onComplete) { ' + queryEditor.getValue() + '};');
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
                        eval('dynamicFunction = function(onSuccess, onFailure, onComplete) { ' + queryEditor.getValue() + '};');
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

                var config = PublicaMundi.Data.getConfiguration();

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
        suspendUI();

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
        suspendUI();

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
        suspendUI();

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


    var vectorLayer = new ol.layer.Vector({
        source: vectorSource
    });

    var layers = [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        }),
        /*new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: 'http://geoserver.dev.publicamundi.eu:8080/geoserver/wms',
                params: {
                    'VERSION': '1.3.0',
                    'LAYERS': 'publicamundi:d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',

                    projection: ol.proj.get('EPSG:900913')
                }

            })
        }),*/
        vectorLayer
    ];

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

    var map = new ol.Map({
        layers: layers,
        target: 'map',
        view: new ol.View({
            center: [2555281.3085910575, 4950157.678740002],
            zoom: 15
        })
    });

    map.addInteraction(select);

    window.map = map;
    window.vector = vectorLayer;

    window.outputEditor = outputEditor;

    var resize = function() {
        $('#accordion-container').height($(window).height()-120);
        $('#accordion').accordion('refresh');

        $('#tabs-container').height($(window).height()-121).width($(window).width() - 470);
        $('#tabs').tabs( 'refresh' );

        $('#map').height($(window).height()-180).width($(window).width() - 485);

        map.updateSize();

        $('#query-container .CodeMirror').height($(window).height()-311);
        queryEditor.refresh();

        $('#tabs-2 .CodeMirror').height($(window).height()-176).width($(window).width() - 482);
        outputEditor.refresh();

        $('#tabs-3 .CodeMirror').height($(window).height()-176).width($(window).width() - 482);
        outputEditor.refresh();
    }

    $('#accordion').accordion({
        heightStyle: 'fill'
    });

    $('#tabs').tabs({
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

    resize();
    $(window).resize(resize);

    setTimeout(function () {
        $('#block-ui').fadeOut(300).hide();
    }, 1000);

    return PublicaMundi;
});

