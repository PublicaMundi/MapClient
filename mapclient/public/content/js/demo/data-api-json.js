$(function () {    
    var queryIndex = 0;

    var QueryMode = {
        JSON : 'json',
        FLUENT : 'fluent'
    };

    var queryEditor = CodeMirror.fromTextArea(document.getElementById("query"), {
        lineNumbers: true,
        mode: "text/javascript",
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        height: "500px"
    });

    var outputEditor = CodeMirror.fromTextArea(document.getElementById("output"), {
        lineNumbers: true,
        mode: "text/javascript",
        matchBrackets: true,
        lineWrapping: true,
        tabSize: 8,
        readOnly: true
    });

    $('#query_exec').tooltip();

    $.widget( "custom.iconselectmenu", $.ui.selectmenu, {
        _renderItem: function( ul, item ) {
            var li = $('<li>', { text: item.label } );
            if ( item.disabled ) {
                li.addClass( "ui-state-disabled" );
            }
            $( "<span>", {
                style: item.element.attr( "data-style" ),
                "class": "ui-icon " + item.element.attr( "data-class" )
            }).appendTo( li );
            return li.appendTo( ul );
        }
    });

    $('#resource_id').selectmenu().selectmenu('disable');

    var vectorSource = new ol.source.GeoJSON({
        projection: 'EPSG:3857'
    });

    var resourceShow = function(data, execution) {
        $('#output').val(JSON.stringify(data, null, " "));
        $("#tabs").tabs("option", "active", 1);
        outputEditor.setValue($('#output').val());

        if(execution.size) {
            $('#query_size').html(execution.size.toFixed(2) + ' Kbs').show();
        }
        if((execution.start) && (execution.end)) {
            $('#query_time').html(((execution.end - execution.start)/1000.0).toFixed(2) + ' secs').show();
        }

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
        var url = path + 'api/resource_show';
        var execution = {
            size : null,
            start : (new Date()).getTime(),
            end : null
        };
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();
/*
        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           resourceShow(data);
        }).always(function() {
           $('.progress-loader').hide();
        });
*/

        $.ajax({
            url: url,
            context: this
        }).done(function(data, textStatus, jqXHR) {
            execution.end = (new Date()).getTime();
            var contentLength = jqXHR.getResponseHeader('Content-Length');
            if(contentLength) {
                execution.size =  contentLength / 1024.0;
            }
            resourceShow(data, execution);
        }).always(function() {
            $('.progress-loader').hide();
        });

    });

    var describeResource = function(data, execution) {
        if(execution.size) {
            $('#query_size').html(execution.size.toFixed(2) + ' Kbs').show();
        }
        if((execution.start) && (execution.end)) {
            $('#query_time').html(((execution.end - execution.start)/1000.0).toFixed(2) + ' secs').show();
        }

        $('#output').val(JSON.stringify(data, null, " "));
        $("#tabs").tabs("option", "active", 1);
        outputEditor.setValue($('#output').val());
    };

    $('#resource_describe').click(function () {
        var id = $('#resource_id').val();
        var url = path + 'api/resource_describe/' + (id ? id : '');
        var execution = {
            size : null,
            start : (new Date()).getTime(),
            end : null
        };
        $('#query_size, #query_time').hide();
        $('.progress-loader').show();
/*
        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           describeResource(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.log('Failed to load dataset ' + entry.url);
        }).always(function() {
            $('.progress-loader').hide();
        });
*/
        $.ajax({
            url: url,
            context: this
        }).done(function (data, textStatus, jqXHR) {
            execution.end = (new Date()).getTime();
            var contentLength = jqXHR.getResponseHeader('Content-Length');
            if(contentLength) {
                execution.size =  contentLength / 1024.0;
            }
            describeResource(data, execution);
        }).always(function() {
            $('.progress-loader').hide();
        });
    });

    var renderFeatures = function(data, execution) {
        $('.progress-loader').hide();

        $('#output').val(JSON.stringify(data, null, " "));
        outputEditor.setValue($('#output').val());

        if(execution.size) {
            $('#query_size').html(execution.size.toFixed(2) + ' Kbs').show();
        }
        if((execution.start) && (execution.end)) {
            $('#query_time').html(((execution.end - execution.start)/1000.0).toFixed(2) + ' secs').show();
        }

        if('success' in data) {
            if(!data.success) {
                $("#tabs").tabs("option", "active", 1);
                return;
            }
        }

        var format = new ol.format.GeoJSON();
        var features = format.readFeatures(data, {
            dataProjection: 'EPSG:3857',
            featureProjection: 'EPSG:3857'
        });

        vectorSource.clear();
        vectorSource.addFeatures(features);

        map.getView().fitExtent(vectorSource.getExtent(), map.getSize());

        $("#tabs").tabs("option", "active", 0);
    };

    var executeQuery = function() {
        vectorSource.clear();
        select.getFeatures().clear();

        $('#query_size, #query_time').hide();

        var url = path + 'api/query';

        var execution = {
            size : null,
            start : (new Date()).getTime(),
            end : null
        };
/*
        $.ajax({
            url: url + '?query=' + $('#query').val(),
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           renderFeatures(data);
        }).always(function() {
            $('.progress-loader').hide();
        });
*/

        var mode = $('.query-mode-option-selected').data('mode');
        switch(mode) {
            case QueryMode.JSON:
                $.ajax({
                    type: "POST",
                    url: url,
                    context: this,
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    data: queryEditor.getValue(' ')
                }).done(function (data, textStatus, jqXHR) {
                    execution.end = (new Date()).getTime();
                    var contentLength = jqXHR.getResponseHeader('Content-Length');
                    if(contentLength) {
                        execution.size =  contentLength / 1024.0;
                    }

                    renderFeatures(data, execution);
                }).always(function() {
                    $('.progress-loader').hide();
                });
                break;
            case QueryMode.FLUENT:
                if(typeof queries[queryIndex].method === 'function' ) {
                    queries[queryIndex].method(renderFeatures);
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

        if(index === queries.length-1) {
            $('#query_next').removeClass('query-button-enabled').addClass('query-button-disabled');
        } else if(!$('#query_next').hasClass('query-button-enabled')) {
            $('#query_next').addClass('query-button-enabled');
        }

        $('#query_index').html(index+1);

        $('#query-notes').html(queries[index].description);
        switch(mode) {
            case QueryMode.JSON:
                $('#query').val(JSON.stringify(queries[index].query, null, "  "));
                break;
            case QueryMode.FLUENT:
                $('#query').val(queries[index].method.toString());
                break;
        }

        queryEditor.setValue($('#query').val());
        queryEditor.refresh();

        if(mode === QueryMode.FLUENT) {
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
        if(queryIndex < queries.length-1) {
            queryIndex++;
            setQuery(queryIndex);
        }
    });

    $('#query_exec').click(function(e) {
        $('.progress-loader').show();
        executeQuery();
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
            if(!$('#feature-dialog').is(":visible")) {
                $('#feature-dialog').dialog({
                    width: 400,
                    position: { my: "right-15 top+15", at: "right top", of: '#map' }
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
        $('#accordion-container').height($(window).height()-70);
        $('#accordion').accordion('refresh');

        $('#tabs-container').height($(window).height()-71).width($(window).width() - 470);
        $('#tabs').tabs( "refresh" );

        $('#map').height($(window).height()-130).width($(window).width() - 485);

        map.updateSize();

        $('.CodeMirror').eq(0).height($(window).height()-221);
        queryEditor.refresh();

        $('.CodeMirror').eq(1).height($(window).height()-126).width($(window).width() - 482);
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
            }
        }
    });

    $('button.action').button();

    resize();
    $(window).resize(resize);

    setTimeout(function () {
        $('#block-ui').fadeOut(300).hide();
    }, 1000);
});
