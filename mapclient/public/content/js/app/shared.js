define(['module', 'jquery', 'ol', 'URIjs/URI'], function (module, $, ol, URI) {
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

       
    PublicaMundi.Maps.Resources.ResourceManager = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.readers = {};
            this.values.layers = []
            this.values.layerCounter = 0;

            this.event('resource:add');
            this.event('resource:remove');
        },
        setCatalogResourceMetadataOptions: function(resource) {
            if (!resource) {
                throw 'Resource is missing.';
            }
            if (typeof shared.adapters[resource.format.toUpperCase()] !== 'object') {
                throw 'Resource typ ' + resource.format.toUpperCase() + ' is not registered.';
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
        addResourceFromCatalog: function (map, resource) {
            var self = this;
            
            if (!resource) {
                throw 'Resource is missing.';
            }
            if (typeof shared.adapters[resource.format.toUpperCase()] !== 'object') {
                return false;
            }

            resource = this.setCatalogResourceMetadataOptions(resource);

            var adapter = new shared.adapters[resource.format.toUpperCase()].adapter();
            adapter.setOptions(resource);

            this.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
                var layer;

                for(var i=0; i < metadata.layers.length; i++){
                    if(metadata.layers[i].key == resource.metadata.extras.layer) {
                        layer = metadata.layers[i];
                        break;
                    }
                }
                if(layer) {
                    self.createLayer(map, metadata, layer.key, resource.id + '_' + layer.key, layer.title);
                }
            });
            return true;
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
        createLayer: function (map, metadata, layer, id, title) {
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

				this.values.layers.push({
					id: id,
					layer : factory.create(map, metadata, layer, title),
                    title: title
				});

				this.values.layerCounter++;
			}
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
            }
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
                    title: currentValue.title
                }
            });
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
			
			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
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
				var replaced = map.getLayers().item(currentIndex+1);
				map.getLayers().setAt(currentIndex+1, __object);
				map.getLayers().setAt(currentIndex, replaced);
				
				return true;
			}
			
			return false;
		},
		moveLayerDown: function(map, id) {
			var __object = null;
			
			for(var i=0; i < this.values.layers.length; i++) {
				if(this.values.layers[i].id == id) {
					__object = this.values.layers[i].layer;
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
				var replaced = map.getLayers().item(currentIndex-1);
				map.getLayers().setAt(currentIndex-1, __object);
				map.getLayers().setAt(currentIndex, replaced);
				
				return true;
			}
			
			return false;
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

    return PublicaMundi;
});
