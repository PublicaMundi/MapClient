var global = this;

define(['module', 'jquery', 'ol', 'proj4', 'URIjs/URI'], function (module, $, ol, proj4, URI) {
    "use strict";

    // PublicaMundi namespace
    var PublicaMundi = {
        __namespace: 'PublicaMundi'
    };

    // Define a new namespace using dot (.) notation e.g. Maps.UI in the PublicaMundi namespace
    PublicaMundi.define = function (namespace, root) {
        if (!namespace) return;

        if (typeof root === 'undefined') {
            root = this;
        }

        if (!root.hasOwnProperty('__namespace')) {
            throw 'Property __namespace does not exist.';
        }

        var parts = namespace.split('.');

        for (var current = this, index = 0; index < parts.length; index++) {
            if (!parts[index]) {
                continue;
            }
            if (typeof current[parts[index]] === 'undefined') {
                current[parts[index]] = {
                    __namespace: this.__namespace + '.' + parts.slice(0, index + 1).join('.')
                };
            }
            current = current[parts[index]];
        }
    };

    // Define namespaces
    PublicaMundi.define('Maps.UI');
    PublicaMundi.define('Maps.CRS');
    PublicaMundi.define('Maps.Resources');

    // Built-in coordinate systems
    PublicaMundi.Maps.CRS.Google = 'EPSG:900913';
	PublicaMundi.Maps.CRS.Mercator = 'EPSG:3857';
	PublicaMundi.Maps.CRS.WGS84 = 'EPSG:4326';
	PublicaMundi.Maps.CRS.CRS84 = 'CRS:84';

    PublicaMundi.Maps.CRS.GGRS87 = 'EPSG:2100';
    PublicaMundi.Maps.CRS.ETRS89 = 'EPSG:4258';

    if(typeof proj4.defs['EPSG:4258'] === 'undefined') {
        proj4.defs("EPSG:4258","+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs");
    }
    if(typeof proj4.defs['EPSG:2100'] === 'undefined') {
        proj4.defs("EPSG:2100","+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=-199.87,74.79,246.62,0,0,0,0 +units=m +no_defs");
    }

    global.proj4 = proj4;

    // Supported resource types
    PublicaMundi.Maps.Resources.Types = {};

    // Add support for simple class hierarchy
    var __extendClass = function (derived, base) {
        for (var prop in base) if (base.hasOwnProperty(prop)) derived[prop] = base[prop];
        function Empty() {
            this.constructor = derived;
        }
        Empty.prototype = base.prototype;
        derived.prototype = new Empty();
    };

    PublicaMundi.extend = function (target, source, deepCopy) {
		var exclude = ['values'];

        target = target || {};
		deepCopy = deepCopy || false;

        if (source) {
            for (var property in source) {
                if ((exclude.indexOf(property) < 0) && (source.hasOwnProperty(property))) {
					if((deepCopy) && (typeof source[property] === 'object') && (source[property])) {
						if(typeof target[property] !== 'object') {
							target[property] = {};
						}
						PublicaMundi.extend(target[property], source[property]);
					} else {
						target[property] = source[property];
					}
                }
            }
        }
        return target;
    };

    PublicaMundi.Class = function (base, options) {
        var inherit = true;
        if (typeof base !== 'function') {
            options = base;
            inherit = false;
        }
        if (!options) {
            throw 'Parameter options is required.';
        }
        if (typeof options !== 'object') {
            throw 'Parameter options must be an object.';
        }
        if (inherit) {
            // Implement inheritance
            return (function (__super) {
                var Class = function () {
                    this.values = {};

                    if (typeof this.initialize === 'function') {
                        this.initialize.apply(this, arguments);
                    }
                };
                __extendClass(Class, __super);

                PublicaMundi.extend(Class.prototype, options);

                return Class;
            })(base);
        }

        // Create simple class
        return (function () {
            var Class = function () {
                this.values = {};

                if (typeof this.initialize === 'function') {
                    this.initialize.apply(this, arguments);
                }
            };

            PublicaMundi.extend(Class.prototype, options);

            return Class;
        })();
    };

    PublicaMundi.operationNotImplemented = function () {
        throw 'Function not implemented.';
    };

    PublicaMundi.getProxyUrl = function (path, parameter) {
        var proxy = path, query = parameter;
        if (typeof path === 'object') {
            proxy = path.path;
            query = path.param;
        }
        if (!proxy) {
            return null;
        }

        var url, parts, params;

        parts = URI.parse(proxy);

        if (parts.protocol) {
            url = (proxy.indexOf('?') === -1 ? proxy + '?' : proxy);
            if (query) {
                url += (proxy.indexOf('&') === -1 ? '' : '&') + query + '=';
            }
        } else {
            parts = URI.parse(window.location.href);

            url = URI.build({
                protocol: (parts.protocol ? parts.protocol : 'http'),
                hostname: parts.hostname,
                port: (parts.port === '80' ? '' : parts.port),
                path: proxy,
                query: (query ? query + '=' : '')
            });
        }
        return url;
    };

    PublicaMundi.isProxyRequired = function (proxy, address) {
        if (proxy) {
            var a1 = URI.parse(proxy);
            var a2 = URI.parse(address);

            return ((a1.protocol !== a2.protocol) || (a1.hostname !== a2.hostname) || (a1.port !== a2.port));
        } else {
            return false;
        }
    };

    // Base class implementing simple event system
    PublicaMundi.Maps.Observable = PublicaMundi.Class({
        initialize: function (options) {
			this.values.events = {};

            PublicaMundi.extend(this.values, options);
		},
        event: function (event) {
            if (typeof this.values.events[event] === 'undefined') {
                this.values.events[event] = {
                    name: event,
                    listeners: []
                };
            }
        },
        on: function (event, callback, context) {
            if (typeof this.values.events[event] === 'undefined') {
                throw 'Event not supported.';
            }
            var listeners = this.values.events[event].listeners.push({'callback' : callback, 'context' : context});
        },
        off: function (callback) {
            for (var key in this.values.events) {
                for (var i = 0; i < this.values.events[key].listenters; i++) {
                    if (this.values.events[key].listeners[i].callback === callback) {
                        this.values.events[key].listeners.splice(i, 1);
                        return;
                    }
                }
            }
        },
        trigger: function (event, args) {
            if (typeof this.values.events[event] === 'undefined') {
                throw 'Event not supported.';
            }

            var listeners = this.values.events[event].listeners;

            for (var i = 0; i < listeners.length; i++) {
                listeners[i].callback.call((listeners[i].context ? listeners[i].context : this), args);
            }
        }
    });

    // Resource registry
    var shared = {
		resources : {},
		adapters: {}
	};

    PublicaMundi.Maps.Resources.ResourceMetadataReader = PublicaMundi.Class({
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        getMetadata: function (resource) {
            PublicaMundi.operationNotImplemented();
        }
    });

    PublicaMundi.Maps.Resources.CkanResourceMetadataReaderAdapter = PublicaMundi.Class({
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        setOptions: function (resource) {
            PublicaMundi.operationNotImplemented();
        }
    });

    PublicaMundi.Maps.Resources.registerResourceType = function (type, title, reader, factory) {
        if (!type) {
            throw 'Parameter type is not set.';
        }
        if (!title) {
            throw 'Parameter title is not set.';
        }
        if (typeof reader !== 'function') {
            throw 'Parameter reader is not a function.';
        }
        if (typeof factory !== 'function') {
            throw 'Parameter factory is not a function.';
        }

        shared.resources[type] = {
            title: title,
            reader: reader,
            factory: factory
        };
    };

    PublicaMundi.Maps.Resources.registerResourceTypeAdapter = function (format, type, adapter) {
        if (!format) {
            throw 'Parameter format is not set.';
        }
        if ((!type) || (!PublicaMundi.Maps.Resources.Types.hasOwnProperty(type))) {
            throw 'Parameter type is invalid.';
        }
        if (typeof adapter !== 'function') {
            throw 'Parameter adapter is not a function.';
        }

        shared.adapters[format] = {
            type: type,
            adapter: adapter
        };
    };

    PublicaMundi.Maps.Resources.LayerFactory = PublicaMundi.Class({
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        create: function (map, resource, layer) {
            PublicaMundi.operationNotImplemented();
        },
        destroy: function (map, resource, layer) {
            PublicaMundi.operationNotImplemented();
        },
        createStyle: function (options) {
            options.fill = options.fill || [255, 255, 255, 0.4];
            options.color = options.color || '#3399CC';
            options.width = options.width || 1;

            var fill = new ol.style.Fill({
                color: options.fill
            });

            var stroke = new ol.style.Stroke({
                color: options.color,
                width: options.width
            });

            var styles = [
              new ol.style.Style({
                  image: new ol.style.Circle({
                      fill: fill,
                      stroke: stroke,
                      radius: 5
                  }),
                  fill: fill,
                  stroke: stroke
              })
            ];

            return styles;
        },
    });

    PublicaMundi.Maps.ResourceManager = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.readers = {};
            this.values.layers = []
            this.values.layerCounter = 0;
            this.values.maxLayerCount = this.values.maxLayerCount || 5;
            this.values.queryable = [];

            this.event('layer:created');
        },
        setCatalogResourceMetadataOptions: function(resource) {
            if (!resource) {
                throw 'Resource is missing.';
            }
            if (typeof shared.adapters[resource.format.toUpperCase()] !== 'object') {
                throw 'Resource type ' + resource.format.toUpperCase() + ' is not registered.';
            }
			if(resource.hasOwnProperty('metadata')) {
				return resource;
			}
            var adapter = new shared.adapters[resource.format.toUpperCase()].adapter();
            adapter.setOptions(resource);

            return resource;
		},
        getResourceMetadata: function (type, parameters) {
            if (typeof type === 'undefined') {
                throw 'Resource type is missing.';
            }
            if (typeof shared.resources[type] !== 'object') {
                throw 'Resource type is not supported.';
            }
			if(typeof this.values.readers[type] !== 'object') {
				this.values.readers[type] = new shared.resources[type].reader({ proxy : this.values.proxy});
			}

			return this.values.readers[type].getMetadata(parameters);
        },
        addResourceFromCatalog: function (map, resource, opacity) {
            var self = this;

            if(this.values.layerCounter >= this.values.maxLayerCount) {
                return null;
            }

            opacity = opacity || 100.0;
            if(opacity < 0) {
                opacity = 0.0;
            } else if(opacity > 100) {
                opacity = 100.0;
            }

            if (!resource) {
                throw 'Resource is missing.';
            }
            if (typeof shared.adapters[resource.format.toUpperCase()] !== 'object') {
                return null;
            }

            resource = this.setCatalogResourceMetadataOptions(resource);

            return this.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
                var layer = null;

                for(var i=0; i < metadata.layers.length; i++){
                    if(metadata.layers[i].key == resource.metadata.extras.layer) {
                        layer = metadata.layers[i];
                        break;
                    }
                }
                if(layer) {
                    var __object = self.createLayer(map, metadata, resource.id + '_' + layer.key);

                    if(__object) {
                        __object.setOpacity(opacity / 100.0);
                    }
                }
            });
        },
        getResourceTypes: function () {
            var types = [];

            for (var type in shared.resources) {
                types.push({
                    type: type,
                    title: shared.resources[type].title
                });
            }

            return types;
        },
        setQueryableResources: function(resources) {
            this.values.queryable = resources;
        },
        updateQueryableResources: function() {
            var self = this;

            var url = this.values.path + 'api/resource_show';

            return new Promise(function(resolve, reject) {
                $.ajax({
                    url: url,
                    context: this
                }).done(function(data, textStatus, jqXHR) {
                    self.values.queryable= [];

                    if((data) && (data.success)) {
                         for (var id in data.resources) {
                            if((data.resources[id].wms_layer) && (data.resources[id].wms_server)) {
                                self.values.queryable.push(data.resources[id]);
                            }
                        }
                    }

                    resolve(self.values.queryable);
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    console.log('Failed to load DATA API resource metadata: ' + url);

                    reject(errorThrown);
                });
            });
        },
        getQueryableResources: function() {
            return this.values.queryable;
        },
        createLayer: function (map, metadata, id) {
            if(this.values.layerCounter >= this.values.maxLayerCount) {
                return null;
            }

			var title = '', bbox = null;

			var parts = id.split('_');
			var resource = parts[0];
			var layer = parts.splice(1).join('_');

			for(var i=0; i<metadata.layers.length;i++) {
				if(metadata.layers[i].key == layer) {
					title = metadata.layers[i].title;
					bbox = metadata.layers[i].bbox;
					break;
				}
			}

			var __object = null;
			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
					break;
				}
			}

			if(!__object) {
				var factory = new shared.resources[metadata.type].factory({
					proxy: this.values.proxy
				});

                __object = factory.create(map, metadata, layer, title)

				this.values.layers.push({
					id: id,
					layer : __object,
                    title: title
				});

                if(bbox) {
                    if(this.values.extent) {
                        if(bbox[0] < this.values.extent[0]) {
                            bbox[0] = this.values.extent[0];
                        }
                        if(bbox[1] < this.values.extent[1]) {
                            bbox[1] = this.values.extent[1];
                        }
                        if(bbox[2] > this.values.extent[2]) {
                            bbox[2] = this.values.extent[2];
                        }
                        if(bbox[3] > this.values.extent[3]) {
                            bbox[3] = this.values.extent[3];
                        }
                    }
                    var view = map.getView();
                    var size = map.getSize();
                    view.fitExtent(bbox, size);
                }

				this.values.layerCounter++;

                this.trigger('layer:created', { id : id});

				return __object;
			}

			return null;
        },
        destroyLayer: function (map, id) {
			var index = -1, __object = null;

			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					index = i;
					__object = this.values.layers[i].layer;
					break;
				}
			}

            if(__object) {
				map.removeLayer(__object);

				this.values.layers.splice(index, 1);

				this.values.layerCounter--;

				return true;
            }

            return false;
        },
        getLayerById: function(id) {
			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					return this.values.layers[i].layer;
				}
			}

            return null;
        },
        getLayerCount: function() {
			return this.values.layerCounter;
		},
        getSelectedLayers: function() {
            return this.values.layers.map(function(currentValue, index, array) {
                var parts = currentValue.id.split('_');

                return {
                    resource_id: parts[0],
                    layer_id: parts[1],
                    title: currentValue.title,
                    opacity: (currentValue.layer.getOpacity() * 100)
                }
            });
        },
        isLayerSelected: function(id) {
            for(var i=0; i < this.values.layers.length; i++) {
                if(id === this.values.layers[i].id) {
                    return true;
                }
            }
            return false;
        },
		setLayerOpacity: function(id, opacity) {
			var __object = null;
			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
					break;
				}
			}
			if(__object) {
				__object.setOpacity(opacity / 100.0);
			}
		},
		moveLayerUp: function(map, id) {
			var __object = null;
            var index;

			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
                    index = i;
					break;
				}
			}

			var layers = map.getLayers().getArray();
			var currentIndex = -1;

            for (var i = 2; i < layers.length; i++) {
                if (layers[i] === __object) {
                    currentIndex = i;
                    break;
                }
            }

            if((__object) && ((currentIndex+1) < layers.length)) {
				var layer = map.getLayers().removeAt(currentIndex);
                map.getLayers().insertAt(currentIndex+1, layer);

                this.values.layers.splice(index+1, 0, this.values.layers.splice(index, 1)[0]);

				return true;
			}

			return false;
		},
		moveLayerDown: function(map, id) {
			var __object = null;
            var index;

			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
                    index = i;
					break;
				}
			}

			var layers = map.getLayers().getArray();
			var currentIndex = -1;

            for (var i = 2; i < layers.length; i++) {
                if (layers[i] === __object) {
                    currentIndex = i;
                    break;
                }
            }

            if((__object) && ((currentIndex-1) > 1)) {
                var layer = map.getLayers().removeAt(currentIndex);
                map.getLayers().insertAt(currentIndex-1, layer);

                this.values.layers.splice(index-1, 0, this.values.layers.splice(index, 1)[0]);

				return true;
			}

			return false;
		},
        getMaxLayerCount: function() {
            return this.values.maxLayerCount;
        }
    });

    PublicaMundi.Maps.UI.View = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            PublicaMundi.extend(this.values, options);
        },
        render: function (target) {

        },
        show: function () {

        }
    });

    var LocaleManager = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.event('locale:load');
            this.event('locale:change');

			this.values.i18n = {
                locale : 'el',
                strings : {
                },
                loaded: {
                    el : false,
                    en : false
                }
            };
        },
        setLocale : function(locale) {
            var self = this;

            if(this.values.i18n.loaded.hasOwnProperty(locale)) {
                this.values.i18n.locale = locale;
            } else {
                this.values.i18n.locale = 'el';
            }

            return this.loadResources().then(function() {
                self.trigger('locale:change', locale);
            });
        },
        getLocale : function() {
            return this.values.i18n.locale;
        },
        getResource : function(id, text) {
            return this.values.i18n.strings[this.values.i18n.locale][id] || text || '';
        },
        loadResources : function() {
            var self = this;

            var uri = new URI();
            uri.segment([(this.values.path === '/' ? '' : this.values.path), 'content', 'js', 'i18n', this.values.i18n.locale, 'strings.js']);
            uri.addQuery({ 'v': (new Date()).getTime() });

            return new Promise(function(resolve, reject) {
                if(self.values.i18n.loaded[self.values.i18n.locale]) {
                    self.trigger('locale:load', self.values.i18n.locale);

                    resolve(self.values.i18n.strings[self.values.i18n.locale]);
                    return;
                }
                $.ajax({
                    url: uri.toString(),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    context: self
                }).done(function (data) {
                    self.values.i18n.loaded[self.values.i18n.locale] = true;

                    self.values.i18n.strings[self.values.i18n.locale] = data;

                    self.trigger('locale:load', self.values.i18n.locale);

                    resolve(self.values.i18n.strings[self.values.i18n.locale]);
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    console.log('Failed to load resources : ' + uri.toString());

                    reject(errorThrown);
                });
            });
        },
        setResource: function(locale, id, value) {
            this.values.i18n.strings[locale][id] = value;
        }
    });

    PublicaMundi.i18n = new LocaleManager({
        path : module.config().path
    });

    return PublicaMundi;
});
