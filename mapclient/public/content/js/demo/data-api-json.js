var path = '/';

$(function () {
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

    var resourceShow = function(data, size) {
        $('#output').val(JSON.stringify(data, null, " "));
        $("#tabs").tabs("option", "active", 1);
        outputEditor.setValue($('#output').val());

        if(size) {
            $('#query_status').html(size.toFixed(2) + ' Kbs');
            $('#query_status').show();
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

/*
        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           resourceShow(data);
        });
*/

        $.ajax({
            url: url,
            context: this
        }).done(function(data, textStatus, jqXHR) {
            var size = null;
            var contentLength = jqXHR.getResponseHeader('Content-Length');
            if(contentLength) {
                size =  contentLength / 1024.0;
            }
            resourceShow(data, size);
        });

    });

    var describeResource = function(data, size) {
        if(size) {
            $('#query_status').html(size.toFixed(2) + ' Kbs');
            $('#query_status').show();
        }

        $('#output').val(JSON.stringify(data, null, " "));
        $("#tabs").tabs("option", "active", 1);
        outputEditor.setValue($('#output').val());
    };

    $('#resource_describe').click(function () {
        var id = $('#resource_id').val();

        var url = path + 'api/resource_describe/' + (id ? id : '');

/*
        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           describeResource(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.log('Failed to load dataset ' + entry.url);
        });
*/
        $.ajax({
            url: url,
            context: this
        }).done(function (data, textStatus, jqXHR) {
            var size = null;
            var contentLength = jqXHR.getResponseHeader('Content-Length');
            if(contentLength) {
                size =  contentLength / 1024.0;
            }
            describeResource(data, size);
        });
    });

    var renderFeatures = function(data, size) {
        $('#output').val(JSON.stringify(data, null, " "));
        outputEditor.setValue($('#output').val());

        if(size) {
            $('#query_status').html(size.toFixed(2) + ' Kbs');
            $('#query_status').show();
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

        $('#query_status').hide();

        var url = path + 'api/query';
/*
        $.ajax({
            url: url + '?query=' + $('#query').val(),
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           renderFeatures(data);
        });
*/

        $.ajax({
            type: "POST",
            url: url,
            context: this,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: queryEditor.getValue(' ')
        }).done(function (data, textStatus, jqXHR) {
            var size = null;
            var contentLength = jqXHR.getResponseHeader('Content-Length');
            if(contentLength) {
                size =  contentLength / 1024.0;
            }
            renderFeatures(data, size);
        });
    };

    var queryIndex = 0;
    var setQuery = function(index) {
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

        $('#query').val(JSON.stringify(queries[index].query, null, "  "));
        $('#query-notes').html(queries[index].description);
        queryEditor.setValue($('#query').val());
        queryEditor.refresh();
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
        executeQuery();
    });

    var vectorLayer = new ol.layer.Vector({
        source: vectorSource
    });

    var layers = [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        }),
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: 'http://geoserver.dev.publicamundi.eu:8080/geoserver/wms',
                params: {
                    'VERSION': '1.3.0',
                    'LAYERS': 'publicamundi:d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',

                    projection: ol.proj.get('EPSG:900913')
                }

            })
        }),
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

        $('#tabs-container').height($(window).height()-71).width($(window).width() - 430);
        $('#tabs').tabs( "refresh" );

        $('#map').height($(window).height()-130).width($(window).width() - 445);

        map.updateSize();

        $('.CodeMirror').eq(0).height($(window).height()-221);
        queryEditor.refresh();

        $('.CodeMirror').eq(1).height($(window).height()-126).width($(window).width() - 454);
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
