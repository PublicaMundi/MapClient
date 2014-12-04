
var path = '/maps/';
var map = null;

var vectorSource = new ol.source.GeoJSON({
    projection: 'EPSG:3857'
});

var select = new ol.interaction.Select({
    condition: ol.events.condition.click
});

$(function () {
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
                    'LAYERS': 'publicamundi:00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                    projection: ol.proj.get('EPSG:900913')
                }
            })
        }),
        vectorLayer
    ];

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

    map = new ol.Map({
        layers: layers,
        target: 'map',
        view: new ol.View({
            center: [2555281.3085910575, 4950157.678740002],
            zoom: 14
        })
    });

    map.addInteraction(select);
});

var renderFeatures = function (data) {
    if ('success' in data) {
        if (!data.success) {
            console.log(data.message);
        }
    } else {
        select.getFeatures().clear();

        var format = new ol.format.GeoJSON();
        var features = format.readFeatures(data, {
            dataProjection: 'EPSG:3857',
            featureProjection: 'EPSG:3857'
        });

        vectorSource.clear();
        vectorSource.addFeatures(features);

        // map.getView().fitExtent(vectorSource.getExtent(), map.getSize());
    }
};

var query = new PublicaMundi.Data.Query(path + 'api/query');

var point = {
    "type": "Point",
    "coordinates": [
        2556034.848391745,
        4949267.502643947
    ]
};

query.resource('00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd', 'table1').
      resource('507076a5-8b40-4cd0-a519-632f375babf7', 'table2').
      field('arot').field('tk').field('address').
      field('table1', 'the_geom', 'polygon').
      equal({ 'name': 'tk' }, '54625').
      distanceGreaterOrEqual(point, { 'resource': 'table1', 'name': 'the_geom' }, 300).
      distanceLessOrEqual(point, { 'resource': 'table1', 'name': 'the_geom' }, 600).
      format(PublicaMundi.Data.Format.GeoJSON);

query.setCallback(renderFeatures);
