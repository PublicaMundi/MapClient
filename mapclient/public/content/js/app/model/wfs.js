define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.define('Maps.Resources.WFS');

    PublicaMundi.Maps.Resources.WFS.Format = {
        GML: 'GML',
        GeoJSON: 'GeoJSON'
    };

    var _isBoundingBoxFinite = function (bbox) {
        for (var i = 0; i < bbox.length; i++) {
            if (!isFinite(bbox[i])) {
                return false;
            }
        }
        return true;
    };

    PublicaMundi.Maps.Resources.WfsMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.ResourceMetadataReader, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.ResourceMetadataReader.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.ResourceMetadataReader.prototype.initialize.apply(this, arguments);
            }

            if (this.values.config) {
                this.values.proxy = PublicaMundi.getProxy(this.values.config.proxy);
            }
            if (!this.values.url) {
                throw 'Parameter url is required.';
            }
            if (!this.values.format) {
                throw 'Parameter format is required.';
            }
        },
        getMetadata: function (callback) {
            var defaults = {
                service: PublicaMundi.Maps.Resources.Types.WFS,
                version: '1.1.0'
            };

            var parts = URI.parse(this.values.url) || {};
            var params = (parts.query ? URI.parseQuery(parts.query) : {});

            var typename = null;

            for (var param in params) {
                if ((param.toLowerCase() === 'version') && (params[param])) {
                    defaults[param] = params[param];
                }
                if ((param.toLowerCase() === 'map') && (params[param])) {
                    defaults[param] = params[param];
                }
                if ((param.toLowerCase() === 'typename') && (params[param])) {
                    typename = params[param];
                }
            }

            var baseUrl = URI.build({
                protocol: (parts.protocol ? parts.protocol : 'http'),
                hostname: parts.hostname,
                port: (parts.port === '80' ? '' : parts.port),
                path: parts.path
            });

            var metadata = {
                type: PublicaMundi.Maps.Resources.Types.WFS,
                key: baseUrl,
                title: this.values.title,
                base: baseUrl,
                url: URI.build({
                    protocol: (parts.protocol ? parts.protocol : 'http'),
                    hostname: parts.hostname,
                    port: (parts.port === '80' ? '' : parts.port),
                    path: parts.path,
                    query: URI.buildQuery(defaults)
                }),
                parameters: PublicaMundi.extend(defaults, {
                    typename: (typename ? typename.split(',') : null),
                    selected: (typename ? typename.split(',') : null)
                }),
                layers: [],
                format: this.values.format,
                customParameters: this.values.parameters,
                isLayer: false
            };

            var getCapabilitiesUrl = metadata.url + '&request=GetCapabilities';

            if (this.values.proxy) {
                getCapabilitiesUrl = this.values.proxy + encodeURIComponent(getCapabilitiesUrl);
            }

            $.ajax({
                url: getCapabilitiesUrl,
                context: this
            }).done(function (response) {
                var parser = new X2JS(), result;
                if(typeof response === 'string') {
                    result = parser.xml_str2json(response);
                } else {
                    result = parser.xml2json(response);
                }

                metadata.title = this.values.title || result.WFS_Capabilities.ServiceIdentification.Title.__text || result.WFS_Capabilities.ServiceIdentification.Title;
                if (result.WFS_Capabilities._version) {
                    metadata.parameters.version = result.WFS_Capabilities._version;
                }

                for (var i = 0; i < result.WFS_Capabilities.FeatureTypeList.FeatureType.length; i++) {
                    var bbox = null;
                    var bbox_meta = result.WFS_Capabilities.FeatureTypeList.FeatureType[i].WGS84BoundingBox;
                    if (bbox_meta) {
                        bbox = (bbox_meta.LowerCorner.__text + ' ' + bbox_meta.UpperCorner.__text).split(' ').map(Number);
                        var bottomLeft = ol.proj.transform([bbox[0], bbox[1]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                        var topRight = ol.proj.transform([bbox[2], bbox[3]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                        bbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];
                        if (!_isBoundingBoxFinite(bbox)) {
                            bbox = null;
                        }
                    }
                    var name = result.WFS_Capabilities.FeatureTypeList.FeatureType[i].Name.__text || result.WFS_Capabilities.FeatureTypeList.FeatureType[i].Name;
                    var nameParts = (name ? name.split(':') : ['', '']);

                    var layer = {
                        key: name,
                        type: PublicaMundi.Maps.Resources.Types.WFS,
                        name: name,
                        base: metadata.base,
                        title: result.WFS_Capabilities.FeatureTypeList.FeatureType[i].Title.__text || result.WFS_Capabilities.FeatureTypeList.FeatureType[i].Title,
                        bbox: bbox,
                        queryable: true,
                        legend: null,
                        version: metadata.parameters.version,
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
                    };

                    if (nameParts[0] && result.WFS_Capabilities['_xmlns:' + nameParts[0]]) {
                        layer.featureNs = result.WFS_Capabilities['_xmlns:' + nameParts[0]];
                    }
                    if (nameParts[1]) {
                        layer.featureType = nameParts[1];
                    }
                    metadata.layers.push(layer);
                }
            }).fail(function (jqXHR) {
                console.log('Failed to execute request : ' + getCapabilitiesUrl);

                metadata = null;
            }).always(function () {
                if (typeof callback === 'function') {
                    callback(metadata);
                }
            });
        }
    });

    PublicaMundi.Maps.Resources.WfsLayerFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.LayerFactory, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize.apply(this, arguments);
            }
        },
        create: function (map, resource, layer) {
            var self = this;

            var format = null;

            switch (resource.metadata.format) {
                case PublicaMundi.Maps.Resources.WFS.Format.GeoJSON:
                    format = new ol.format.GeoJSON();
                    break;
                case PublicaMundi.Maps.Resources.WFS.Format.GML:
                    format = new ol.format.WFS({
                        featureNS: layer.featureNs,
                        featureType: layer.featureType,
                        gmlFormat: (resource.metadata.parameters.version === '1.0.0' ? new ol.format.GML2() : new ol.format.GML3())
                    });
                    break;
            }

            var vectorSource = new ol.source.ServerVector({
                projection: PublicaMundi.Maps.CRS.Mercator,
                loader: function (extent, resolution, projection) {
                    if (layer.viewer.visible) {
                        $('#' + layer.id + '_p').show();

                        var url = layer.base + '?service=WFS&version=' + layer.version + '&request=GetFeature&typename=' + layer.name + '&srsname=' + PublicaMundi.Maps.CRS.Mercator + '&bbox=' + extent.join(',') + ',' + PublicaMundi.Maps.CRS.Mercator;
                        var source = this, xhr;

                        switch (resource.metadata.format) {
                            case PublicaMundi.Maps.Resources.WFS.Format.GML:
                                url = PublicaMundi.getProxy(self.values.config.proxy) + encodeURIComponent(url);

                                xhr = $.get(url).done(function (response) {
                                    for (var i = 0; i < layer.loader.queue.length; i++) {
                                        if (layer.loader.queue[i] === xhr) {
                                            layer.loader.queue.splice(i, 1);
                                            break;
                                        }
                                    }
                                    if (layer.loader.queue.length === 0) {
                                        $('#' + layer.id + '_p').hide();
                                    }

                                    var features = format.readFeatures(response, { dataProjection: PublicaMundi.Maps.CRS.Mercator, featureProjection: PublicaMundi.Maps.CRS.Mercator });

                                    source.addFeatures(features);
                                });
                                layer.loader.queue.push(xhr);
                                break;
                            case PublicaMundi.Maps.Resources.WFS.Format.GeoJSON:
                                url += '&' + resource.metadata.customParameters || 'outputFormat=text/javascript&format_options=callback:loadFeatures';

                                var loadFeatures = function (data) {

                                };
                                xhr = $.ajax({
                                    url: url,
                                    dataType: 'jsonp',
                                    context: this,
                                    jsonpCallback: 'loadFeatures'
                                }).done(function (response) {
                                    for (var i = 0; i < layer.loader.queue.length; i++) {
                                        if (layer.loader.queue[i] === xhr) {
                                            layer.loader.queue.splice(i, 1);
                                            break;
                                        }
                                    }
                                    if (layer.loader.queue.length === 0) {
                                        $('#' + layer.id + '_p').hide();
                                    }

                                    var features = format.readFeatures(response, { dataProjection: PublicaMundi.Maps.CRS.Mercator, featureProjection: PublicaMundi.Maps.CRS.Mercator });

                                    source.addFeatures(features);
                                }).fail(function (jqXHR, textStatus, errorThrown) {
                                    for (var i = 0; i < layer.loader.queue.length; i++) {
                                        if (layer.loader.queue[i] === xhr) {
                                            layer.loader.queue.splice(i, 1);
                                            break;
                                        }
                                    }
                                });
                                layer.loader.queue.push(xhr);
                                break;
                        }
                    }
                },
                strategy: ol.loadingstrategy.createTile(new ol.tilegrid.XYZ({
                    maxZoom: this.values.config.map.maxZoom
                }))
            });

            layer.__object = new ol.layer.Vector({
                source: vectorSource,
                style: this.createStyle(layer.viewer.style)
            });
            layer.__object.setOpacity(layer.viewer.opacity / 100.0);

            map.addLayer(layer.__object);
        },
        destroy: function (map, resource, layer) {
            $('#' + layer.id + '_p').hide();

            map.removeLayer(layer.__object);

            layer.__object = null;
        },
        renderLayerItem: function (resource, layer) {
            return '<p><a class="ui-btn ui-btn-icon-notext ui-icon-edit btn-layer-config" data-layer="' + layer.id + '" href="#" style="float: left;"></a><span class="layer-title">' + layer.title +
            '</span></p><label class="layer-loading ui-li-aside"><img style="display: none;" id="' + layer.id +
            '_p" src="' + this.values.config.imagePath + 'ajax-loader-small.gif" /></label><label class="layer-selector ui-li-aside"><input type="checkbox" data-layer="' + layer.id + '"></label>';
        }
    });

    PublicaMundi.Maps.Resources.Types.WFS = PublicaMundi.Maps.Resources.Types.WFS || 'WFS';

    PublicaMundi.Maps.registerResourceType(PublicaMundi.Maps.Resources.Types.WFS, 'WFS', PublicaMundi.Maps.Resources.WfsMetadataReader, PublicaMundi.Maps.Resources.WfsLayerFactory);

    return PublicaMundi;
});
