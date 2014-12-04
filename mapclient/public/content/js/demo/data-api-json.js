var path = '/';

$(function () {
    var vectorSource = new ol.source.GeoJSON({
        projection: 'EPSG:3857'
    });

    var resourceShow = function(data) {
        $('#response').val(JSON.stringify(data, null, " "));

        for (var id in data.resources) {
            $('#resource_id').append($('<option>', {
                value: id,
                text: id
            }));
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
        }).done(function (data) {
            resourceShow(data);
        });

    });

    $('#resource_describe').click(function () {
        var url = path + 'api/resource_describe/' + $('#resource_id').val();

/*
        $.ajax({
            url: url,
            dataType: 'jsonp',
            context: this,
        }).done(function (data) {
           $('#response').val(JSON.stringify(data, null, " "));
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.log('Failed to load dataset ' + entry.url);
        });
*/
        $.ajax({
            url: url,
            context: this
        }).done(function (data) {
            $('#response').val(JSON.stringify(data, null, " "));
        });
    });

    var renderFeatures = function(data) {
        $('#response').val(JSON.stringify(data, null, " "));
        var format = new ol.format.GeoJSON();
        var features = format.readFeatures(data, {
            dataProjection: 'EPSG:3857',
            featureProjection: 'EPSG:3857'
        });

        vectorSource.clear();
        vectorSource.addFeatures(features);

        // map.getView().fitExtent(vectorSource.getExtent(), map.getSize());
    };

    $('#resource_query').click(function () {
        vectorSource.clear();
        select.getFeatures().clear();

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
            data: $('#query').val()
        }).done(function (data) {
            renderFeatures(data);
        });
    });

    // "{"type":"Point","coordinates":[2556034.848391745, 4949267.502643947]}"
    var queries = [{
        resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                     '507076a5-8b40-4cd0-a519-632f375babf7'],
        fields: [{
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'arot'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'tk'
        }, {
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'the_geom',
            alias: 'polygon'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'address'
        }],
        filters: [{
            operator: 'EQUAL',
            arguments: [
                {
                    resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                    name: 'tk'
                },
                '54625'
            ]
        }, {
            operator: 'DISTANCE',
            arguments: [
                {
                    'type': 'Point',
                    'coordinates': [2556034.848391745, 4949267.502643947]
                }, {
                    resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                    name: 'the_geom'
                },
                "LESS_OR_EQUAL",
                600.0
            ]
        }, {
            operator: 'DISTANCE',
            arguments: [
                {
                    'type': 'Point',
                    'coordinates': [2556034.848391745, 4949267.502643947]
                }, {
                    resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                    name: 'the_geom'
                },
                "GREATER_OR_EQUAL",
                300.0
            ]
        }],
        format: 'geojson'
    }, {
        resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                     '507076a5-8b40-4cd0-a519-632f375babf7'],
        fields: [{
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'arot'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'tk'
        }, {
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'the_geom',
            alias: 'polygon'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'address'
        }],
        filters: [{
            operator: 'EQUAL',
            arguments: [
                {
                    resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                    name: 'tk'
                },
                '54625'
            ]
        }, {
            operator: 'AREA',
            arguments: [{
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'the_geom'
            },
                "GREATER_OR_EQUAL",
                15000.0
            ]
        }],
        format: 'geojson'
    }, {
        resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                     '507076a5-8b40-4cd0-a519-632f375babf7'],
        fields: [{
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'arot'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'tk'
        }, {
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'the_geom',
            alias: 'polygon'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'address'
        }],
        filters: [{
            operator: 'EQUAL',
            arguments: [
                {
                    resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                    name: 'tk'
                },
                '54625'
            ]
        }, {
            operator: 'CONTAINS',
            arguments: [{
                "type":"Polygon","coordinates":[[[2554722.9073085627,4951114.104686448],[2554722.9073085627,4950158.641832884],[2556232.5386171946,4950158.641832884],[2556232.5386171946,4951114.104686448],[2554722.9073085627,4951114.104686448]]]
            }, {
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'the_geom'
            }]
        }],
        format: 'geojson'
    }, {
        resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                     '507076a5-8b40-4cd0-a519-632f375babf7'],
        fields: [{
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'arot'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'tk'
        }, {
            resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
            name: 'the_geom',
            alias: 'polygon'
        }, {
            resource: '507076a5-8b40-4cd0-a519-632f375babf7',
            name: 'address'
        }],
        filters: [{
            operator: 'EQUAL',
            arguments: [
                {
                    resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                    name: 'tk'
                },
                '54625'
            ]
        }, {
            operator: 'INTERSECTS',
            arguments: [{
                "type":"Polygon","coordinates":[[[2554722.9073085627,4951114.104686448],[2554722.9073085627,4950158.641832884],[2556232.5386171946,4950158.641832884],[2556232.5386171946,4951114.104686448],[2554722.9073085627,4951114.104686448]]]
            }, {
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'the_geom'
            }]
        }],
        format: 'geojson'
    }];

    $('#query').val(JSON.stringify(queries[0], null, " "));

    $('#query_id').change(function (e) {
        var index = $("#query_id option:selected").first().val();

        $('#query').val(JSON.stringify(queries[index], null, " "));
    });

    var vectorLayer = new ol.layer.Vector({
        source: vectorSource
    });

    var layers = [
        /*new ol.layer.Tile({
            source: new ol.source.MapQuest({layer: 'sat'})
        }),*/
        new ol.layer.Tile({
            source: new ol.source.OSM()
        }),
        // http://geoserver.dev.publicamundi.eu:8080/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=publicamundi%3A00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd&WIDTH=256&HEIGHT=256&CRS=EPSG%3A900913&STYLES=&BBOX=2553608.2409511693%2C4950673.447974294%2C2553913.98906431%2C4950979.196087435
        new ol.layer.Tile({

            source: new ol.source.TileWMS({

                url: 'http://geoserver.dev.publicamundi.eu:8080/geoserver/wms',

                params: {
                    'VERSION': '1.3.0',
                    'LAYERS': 'publicamundi:00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',

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
        } else {
            // this means there is at least 1 feature selected
            var features = e.target;
            var feature = features.getArray()[0];

            var text = [];
            var keys = feature.getKeys();
            for (var i = 0; i < keys.length; i++) {
                if (keys[i] != feature.getGeometryName()) {
                    text.push(keys[i] + ' : ' + feature.get(keys[i]));
                }
            }
            alert(text.join('\n'));
        }
    });

    var map = new ol.Map({
        layers: layers,
        target: 'map',
        view: new ol.View({
            center: [2555281.3085910575, 4950157.678740002],
            zoom: 14
        })
    });

    map.addInteraction(select);

    window.map = map;
    window.vector = vectorLayer;
});
