define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.define('Maps.Resources.File');
    PublicaMundi.define('Maps.Resources.GML');

    PublicaMundi.Maps.Resources.File.Format = {
        GML: 'GML',
        GeoJSON: 'GeoJSON',
        KML: 'KML'
    };

    PublicaMundi.Maps.Resources.GML.Version = {
        GML2: 'GML2',
        GML3: 'GML3'
    };

    PublicaMundi.Maps.Resources.FileMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.ResourceMetadataReader, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }
        },
        getMetadata: function (callback) {
            if (!this.values.url) {
                return null;
            }

            var filename = this.values.url.replace(/^.*[\\\/]/, '');

            var metadata = {
                type: this.values.type,
                key: this.values.url,
                title: this.values.title || filename,
                base: this.values.url,
                url: this.values.url,
                parameters: {
                    layers: [(this.values.title || filename)],
                    selected: [(this.values.title || filename)]
                },
                layers: [{
                    key: this.values.url,
                    type: this.values.type,
                    name: this.values.title || filename,
                    base: this.values.url,
                    title: this.values.title || filename,
                    bbox: null,
                    queryable: true,
                    legend: null,
                    featureNS: this.values.featureNS,
                    featureType: this.values.featureType,
                    gml: this.values.version,
                    loader: {
                        queue: []
                    },
                    viewer: {
                        visible: false,
                        opacity: 100,
                        style: {
                            fill: [255, 255, 255, 0.4],
                            color: '#3399CC',
                            width: 1
                        }
                    }
                }],
                projection: this.values.projection,
                format: this.values.format,
                isLayer: true
            };
            if (metadata.format === PublicaMundi.Maps.Resources.File.Format.KML) {
                metadata.layers[0].viewer.style = null;
            }
            if (typeof callback === 'function') {
                callback(metadata);
            }
        }
    });

    PublicaMundi.Maps.Resources.FileLayerFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.LayerFactory, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize.apply(this, arguments);
            }
        },
        create: function (map, resource, layer) {
            var url = resource.metadata.url;
            var proxy = PublicaMundi.getProxy(this.values.config.proxy);

            if (PublicaMundi.isProxyRequired(proxy, url)) {
                url = proxy + encodeURIComponent(resource.metadata.url);
            }

            var self = this;

            switch (resource.metadata.format) {
                case PublicaMundi.Maps.Resources.File.Format.KML:
                    layer.__object = new ol.layer.Vector({
                        source: new ol.source.KML({
                            projection: PublicaMundi.Maps.CRS.Mercator,
                            url: url
                        })
                    });
                    layer.__object.setOpacity(layer.viewer.opacity / 100.0);

                    map.addLayer(layer.__object);
                    break;
                case PublicaMundi.Maps.Resources.File.Format.GeoJSON:
                    $('#' + layer.id + '_p').show();

                    $.get(url).done(function (response) {
                        var format = new ol.format.GeoJSON();

                        var features = format.readFeatures(response, { dataProjection: resource.metadata.projection, featureProjection: PublicaMundi.Maps.CRS.Mercator });

                        var source = new ol.source.GeoJSON({
                            projection: PublicaMundi.Maps.CRS.Mercator
                        });
                        source.addFeatures(features);

                        layer.__object = new ol.layer.Vector({
                            source: source,
                            style: self.createStyle(layer.viewer.style)
                        });
                        layer.__object.setOpacity(layer.viewer.opacity / 100.0);

                        map.addLayer(layer.__object);

                        var extent = source.getExtent();
                        if (extent) {
                            var view = map.getView();
                            var size = map.getSize();
                            view.fitExtent(extent, size);
                        }
                    }).always(function () {
                        $('#' + layer.id + '_p').hide();
                    });

                    break;
                case PublicaMundi.Maps.Resources.File.Format.GML:
                    $('#' + layer.id + '_p').show();

                    $.get(url).done(function (response) {
                        var gmlFormat;

                        switch (layer.gml) {
                            case PublicaMundi.Maps.Resources.GML.Version.GML2:
                                gmlFormat = new ol.format.GML2();
                                break;
                            case PublicaMundi.Maps.Resources.GML.Version.GML3:
                                gmlFormat = new ol.format.GML3();
                                break;
                        }

                        var format = new ol.format.WFS({
                            featureNS: (layer.featureNS ? layer.featureNS : undefined),
                            featureType: (layer.featureType ? layer.featureType : undefined),
                            gmlFormat: gmlFormat
                        });

                        var features = format.readFeatures(response, {
                            dataProjection: (resource.metadata.projection ? resource.metadata.projection : PublicaMundi.Maps.CRS.WGS84),
                            featureProjection: PublicaMundi.Maps.CRS.Mercator
                        });

                        var source = new ol.source.GeoJSON({
                            projection: PublicaMundi.Maps.CRS.Mercator
                        });

                        source.addFeatures(features);

                        layer.__object = new ol.layer.Vector({
                            source: source,
                            style: self.createStyle(layer.viewer.style)
                        });
                        layer.__object.setOpacity(layer.viewer.opacity / 100.0);

                        map.addLayer(layer.__object);

                        var extent = source.getExtent();
                        if (extent) {
                            var view = map.getView();
                            var size = map.getSize();
                            view.fitExtent(extent, size);
                        }
                    }).always(function () {
                        $('#' + layer.id + '_p').hide();
                    });
                    break;
            }
        },
        destroy: function (map, resource, layer) {
            map.removeLayer(layer.__object);

            layer.__object = null;
        },
        renderLayerGroup: function (resource) {
            var layer = resource.metadata.layers[0];

            var text = [];
            text.push('<a class="ui-btn ui-btn-icon-notext ui-icon-edit btn-layer-config" data-layer="' + layer.id + '" href="#" style="left: 8px; position: absolute; top: 0.8em;"></a>');
            text.push('<p style="margin:  0px 0px 0px 11px; font-size: 13px; font-weigh: bold;"><span class="layer-title">' + layer.title +
            '</span></p>');
            text.push('<p style="margin:  0px 0px 0px 16px; font-size: 0.65em;"><a id="' + resource.id + '_rl" class="remove-resource" href="#" data-resource="' + resource.id + '">Remove</a></p>');
            text.push('<label class="layer-loading ui-li-aside" style="position: absolute; top: 19px; right: 2px;"><img style="display: none;" id="' + layer.id +
            '_p" src="' + this.values.config.imagePath + 'ajax-loader-small.gif" /></label>');
            text.push('<label class="layer-selector ui-li-aside" style="position: absolute; right: 4px; top: 0.4em;"><input type="checkbox" data-layer="' + layer.id + '"></label>');

            return text.join('');
        }
    });

    return PublicaMundi;
});
