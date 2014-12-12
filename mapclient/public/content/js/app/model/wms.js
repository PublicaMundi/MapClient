define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    var _isBoundingBoxFinite = function (bbox) {
        for (var i = 0; i < bbox.length; i++) {
            if (!isFinite(bbox[i])) {
                return false;
            }
        }
        return true;
    };

    var _bboxReduce = function (previousValue, currentValue, index, array) {
        if (previousValue) {
            return previousValue;
        }
        var bbox = currentValue.extent;

        switch(currentValue.crs) {
            case  PublicaMundi.Maps.CRS.Mercator:
                return currentValue.extent;
                break;
            case PublicaMundi.Maps.CRS.WGS84:
                var bottomLeft = ol.proj.transform([bbox[1], bbox[0]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                var topRight = ol.proj.transform([bbox[3], bbox[2]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                bbox = [bottomLeft[1], bottomLeft[0], topRight[1], topRight[0]];
                if (_isBoundingBoxFinite(bbox)) {
                    return bbox;
                }
                break;
            case 'CRS:84':
                var bottomLeft = ol.proj.transform([bbox[0], bbox[1]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                var topRight = ol.proj.transform([bbox[2], bbox[3]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                bbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];
                if (_isBoundingBoxFinite(bbox)) {
                    return bbox;
                }
                break;
        }
        return null;
    };

    PublicaMundi.Maps.Resources.WmsMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.ResourceMetadataReader, {
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
        },
        getMetadata: function (callback) {
            var defaults = {
                service: PublicaMundi.Maps.Resources.Types.WMS,
                version: '1.3.0'
            };

            var parts = URI.parse(this.values.url) || {};
            var params = (parts.query ? URI.parseQuery(parts.query) : {});

            var layers = null;

            for (var param in params) {
                if ((param.toLowerCase() === 'version') && (params[param])) {
                    defaults[param] = params[param];
                }
                if ((param.toLowerCase() === 'map') && (params[param])) {
                    defaults[param] = params[param];
                }
                if ((param.toLowerCase() === 'layers') && (params[param])) {
                    layers = params[param];
                }
            }

            var baseUrl = URI.build({
                protocol: (parts.protocol ? parts.protocol : 'http'),
                hostname: parts.hostname,
                port: (parts.port === '80' ? '' : parts.port),
                path: parts.path
            });

            var metadata = {
                type: PublicaMundi.Maps.Resources.Types.WMS,
                key: baseUrl,
                title: this.values.title,
                base: baseUrl,
                url :URI.build({
                    protocol: (parts.protocol ? parts.protocol : 'http'),
                    hostname: parts.hostname,
                    port: (parts.port === '80' ? '' : parts.port),
                    path: parts.path,
                    query: URI.buildQuery(defaults)
                }),
                parameters: PublicaMundi.extend(defaults, {
                    layers: (layers ? layers.split(',') : null),
                    selected: (layers ? layers.split(',') : null)
                }),
                layers: [],
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
                var parser = new ol.format.WMSCapabilities();
                var result = parser.read(response);

                // Refresh default metadata values from response
                metadata.title = this.values.title || result.Service.Title;
                metadata.parameters.version = result.version || metadata.parameters.version;
                metadata.url = URI.build({
                    protocol: (parts.protocol ? parts.protocol : 'http'),
                    hostname: parts.hostname,
                    port: (parts.port === '80' ? '' : parts.port),
                    path: parts.path,
                    query: URI.buildQuery(defaults)
                });

                for (var i = 0; i < result.Capability.Layer.Layer.length; i++) {
                    var layer = {
                        key: result.Capability.Layer.Layer[i].Name,
                        type: PublicaMundi.Maps.Resources.Types.WMS,
                        name: result.Capability.Layer.Layer[i].Name,
                        base: metadata.base,
                        title: result.Capability.Layer.Layer[i].Title,
                        bbox: result.Capability.Layer.Layer[i].BoundingBox.reduce(_bboxReduce, null),
                        queryable: result.Capability.Layer.Layer[i].queryable,
                        legend: null,
                        version: metadata.parameters.version,
                        loader: {
                            queue: []
                        },
                        viewer: {
                            visible: false,
                            opacity: 100,
                            style: null
                        }
                    };

                    if ((result.Capability.Layer.Layer[i].Style) &&
                        (result.Capability.Layer.Layer[i].Style.length > 0) &&
                        (result.Capability.Layer.Layer[i].Style[0].LegendURL.length > 0)) {
                        layer.legend = result.Capability.Layer.Layer[i].Style[0].LegendURL[0].OnlineResource;
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

    PublicaMundi.Maps.Resources.WmsCkanResourceMetadataReaderAdapter = PublicaMundi.Class(PublicaMundi.Maps.Resources.CkanResourceMetadataReaderAdapter, {
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        getOptions: function (resource) {
            if ((resource.format) && (resource.format.toUpperCase() === 'WMS')) {
                return {
                    type: PublicaMundi.Maps.Resources.Types.WMS,
                    title: resource.name,
                    url: (resource.wms_server || resource.url) + '?LAYERS=' + (resource.wms_layer || '')
                };
            }
            return null;
        }
    });

    PublicaMundi.Maps.Resources.WmsLayerFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.LayerFactory, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize.apply(this, arguments);
            }
        },
        create: function (map, resource, layer) {
            var params = {
                'LAYERS': layer.name
            };

            if (layer.version) {
                params.VERSION = layer.version;
            }

            for (var param in resource.parameters) {
                if ((param.toLowerCase() === 'map') && (params[param])) {
                    params.MAP = params[param];
                }
            }
            layer.__object = new ol.layer.Tile({
                title: layer.title,
                source: new ol.source.TileWMS({
                    url: layer.base,
                    params: params,
                    projection: 'EPSG:3857'
                }),
            });
            layer.__object.setOpacity(layer.viewer.opacity / 100.0);

            map.addLayer(layer.__object);

            if (layer.bbox) {
                var view = map.getView();
                var size = map.getSize();
                view.fitExtent(layer.bbox, size);
            }
        },
        destroy: function (map, resource, layer) {
            map.removeLayer(layer.__object);

            layer.__object = null;
        }
    });

    PublicaMundi.Maps.Resources.Types.WMS = PublicaMundi.Maps.Resources.Types.WMS || 'WMS';

    PublicaMundi.Maps.registerResourceType(PublicaMundi.Maps.Resources.Types.WMS,
                                           'WMS',
                                           PublicaMundi.Maps.Resources.WmsMetadataReader,
                                           PublicaMundi.Maps.Resources.WmsLayerFactory);

    PublicaMundi.Maps.registerResourceTypeAdapter('WMS', PublicaMundi.Maps.Resources.Types.WMS, PublicaMundi.Maps.Resources.WmsCkanResourceMetadataReaderAdapter);

    return PublicaMundi;
});
