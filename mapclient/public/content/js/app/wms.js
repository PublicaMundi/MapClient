define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.Types.WMS = PublicaMundi.Maps.Resources.Types.WMS || 'WMS';

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
        var bbox = currentValue.extent, bottomLeft, topRight;
        switch(currentValue.crs) {
            case PublicaMundi.Maps.CRS.Mercator: case PublicaMundi.Maps.CRS.Google:
                return currentValue.extent;
            case PublicaMundi.Maps.CRS.WGS84:
                bottomLeft = ol.proj.transform([bbox[1], bbox[0]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                topRight = ol.proj.transform([bbox[3], bbox[2]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                bbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];
                if (_isBoundingBoxFinite(bbox)) {
                    return bbox;
                }
                break;
            case PublicaMundi.Maps.CRS.CRS84:
                bottomLeft = ol.proj.transform([bbox[0], bbox[1]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
                topRight = ol.proj.transform([bbox[2], bbox[3]], PublicaMundi.Maps.CRS.WGS84, PublicaMundi.Maps.CRS.Mercator);
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

            this.values.cache = {};
        },
        getMetadata: function (options) {
			options = options || { url: null };

			var self = this;

			if (!options.url) {
                throw 'Parameter url is required.';
            }

            if((!this.values.proxy) && (PublicaMundi.isProxyRequired(window.location.href, options.url))) {
				throw 'Parameter proxy is not set.';
			}

            var defaults = {
                service: 'WMS',
                version: '1.3.0'
            };

            var getCapabilitiesQuery  = {
                request : 'GetCapabilities',
                service : 'WMS'
            };

            var layers = [];

            var parts = URI.parse(options.url) || {};
            var params = (parts.query ? URI.parseQuery(parts.query) : {});

            for (var param in params) {
                if ((param.toLowerCase() === 'version') && (params[param])) {
                    defaults[param] = params[param];
                    getCapabilitiesQuery[param] = params[param];
                }
                if ((param.toLowerCase() === 'map') && (params[param])) {
                    defaults[param] = params[param];
                    getCapabilitiesQuery[param] = params[param];
                }
                if ((param.toLowerCase() === 'layers') && (params[param])) {
                    defaults[param] = params[param];
                }
            }

            var endpoint = URI.build({
                protocol: (parts.protocol ? parts.protocol : 'http'),
                hostname: parts.hostname,
                port: (parts.port === '80' ? '' : parts.port),
                path: parts.path
            });

            var metadata = {
                type: PublicaMundi.Maps.Resources.Types.WMS,
                key: endpoint,
                endpoint: endpoint,
                parameters: defaults,
                layers: [],
                title: null
			};

			var getCapabilitiesUrl = URI.build({
				protocol: (parts.protocol ? parts.protocol : 'http'),
				hostname: parts.hostname,
				port: (parts.port === '80' ? '' : parts.port),
				path: parts.path,
				query: URI.buildQuery(getCapabilitiesQuery)
			});

            if (PublicaMundi.isProxyRequired(window.location.href, getCapabilitiesUrl)) {
                getCapabilitiesUrl = this.values.proxy + encodeURIComponent(getCapabilitiesUrl);
            }

			return new Promise(function(resolve, reject) {
				if(self.values.cache[metadata.key]) {
					resolve(self.values.cache[metadata.key]);
					return;
				}

				$.ajax({
					url: getCapabilitiesUrl,
					context: self,
                    headers: {
                        'Accept' : 'text/xml; charset=utf-8',
                        'Content-Type': 'text/xml; charset=utf-8'
                    }
				}).done(function (response) {
					var parser = new ol.format.WMSCapabilities();
					var result = parser.read(response);

					// Refresh default metadata values from response
					metadata.title = result.Service.Title;
					metadata.parameters.version = result.version || metadata.parameters.version;

					// TODO : Handle all cases
					var layers = [];
					if((typeof result.Capability !== 'undefined') && (typeof result.Capability.Layer !== 'undefined')) {
						if((typeof result.Capability.Layer.Layer !== 'undefined') && ($.isArray(result.Capability.Layer.Layer))) {
							layers = result.Capability.Layer.Layer;
						} else {
							layers.push(result.Capability.Layer);
						}
					}

					for (var i = 0; i < layers.length; i++) {
						var layer = {
							key: layers[i].Name,
							name: layers[i].Name,
							title: layers[i].Title,
							bbox: layers[i].BoundingBox.reduce(_bboxReduce, null),
							queryable: layers[i].queryable,
							legend: null
						};

						if ((layers[i].Style) &&
							(layers[i].Style.length > 0) &&
							(layers[i].Style[0].LegendURL) &&
							(layers[i].Style[0].LegendURL.length > 0)) {
							layer.legend = layers[i].Style[0].LegendURL[0].OnlineResource;
						}

						metadata.layers.push(layer);
					}

					self.values.cache[metadata.key] = metadata;
					resolve(metadata);
				}).fail(function (jqXHR) {
					console.log('Failed to execute request : ' + getCapabilitiesUrl);

					reject({
						status: jqXHR.status,
						statusText : jqXHR.statusText
					});
				});
			});
        }
    });

    PublicaMundi.Maps.Resources.WmsCkanResourceMetadataReaderAdapter = PublicaMundi.Class(PublicaMundi.Maps.Resources.CkanResourceMetadataReaderAdapter, {
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        setOptions: function (resource) {
			resource.metadata = null;

            if ((resource.format) && (resource.format.toUpperCase() === 'WMS')) {
				var url = resource.wms_server || resource.url || '';
				var layer = resource.wms_layer || '';

				if(url) {
					if(!layer) {
						var parts = URI.parse(url) || {};
						var params = (parts.query ? URI.parseQuery(parts.query) : {});

						for (var param in params) {
							if ((param.toLowerCase() === 'layers') && (params[param])) {
								layer = params[param];
							}
						}
					}

					resource.metadata = {
						type: PublicaMundi.Maps.Resources.Types.WMS,
						parameters : {
							url: url
						},
						extras: {
							layer : layer
						}
					};
				}
            }

            return resource;
        }
    });

    PublicaMundi.Maps.Resources.WmsLayerFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.LayerFactory, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.LayerFactory.prototype.initialize.apply(this, arguments);
            }
        },
        create: function (map, metadata, layer, title) {
            var params = {
                'LAYERS': layer,
                tiled: true
            };

            for (var param in metadata.parameters) {
                if ((param.toLowerCase() === 'map') && (metadata.parameters[param])) {
                    params.MAP = metadata.parameters[param];
                }
                if ((param.toLowerCase() === 'version') && (metadata.parameters[param])) {
                    params.VERSION = metadata.parameters[param];
                }
            }

            var __object = new ol.layer.Tile({
                title: title,
                source: new ol.source.TileWMS({
                    url: metadata.endpoint,
                    params: params,
                    projection: PublicaMundi.Maps.CRS.Mercator
                }),
            });

			return __object;
        }
    });

    PublicaMundi.Maps.Resources.registerResourceType(PublicaMundi.Maps.Resources.Types.WMS,
                                           'WMS',
                                           PublicaMundi.Maps.Resources.WmsMetadataReader,
                                           PublicaMundi.Maps.Resources.WmsLayerFactory);

    PublicaMundi.Maps.Resources.registerResourceTypeAdapter('WMS', PublicaMundi.Maps.Resources.Types.WMS, PublicaMundi.Maps.Resources.WmsCkanResourceMetadataReaderAdapter);

    return PublicaMundi;
});
