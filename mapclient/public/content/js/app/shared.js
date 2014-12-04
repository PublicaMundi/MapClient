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
    PublicaMundi.define('Maps.Resources.UI');

    // Built-in coordinate systems
    PublicaMundi.Maps.CRS = {
        Google: 'EPSG:900913',
        Mercator: 'EPSG:3857',
        WGS84: 'EPSG:4326'
    };

    // Supported resources
    PublicaMundi.Maps.Resources.Types = {};

    // Supported resource view types
    PublicaMundi.Maps.Resources.UI.Views = {
        CREATE: 'CREATE',
        CONFIG: 'CONFIG'
    };

    // Add support for simple class hierarchy 
    var __extendClass = function (derived, base) {
        for (var prop in base) if (base.hasOwnProperty(prop)) derived[prop] = base[prop];
        function Empty() {
            this.constructor = derived;
        }
        Empty.prototype = base.prototype;
        derived.prototype = new Empty();
    };

    PublicaMundi.extend = function (target, source) {
        target = target || {};

        if (source) {
            for (var property in source) {
                if (source.hasOwnProperty(property)) {
                    target[property] = source[property];
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

    PublicaMundi.getProxy = function (path, parameter) {
        var proxy = path, query = parameter;
        if (typeof path === 'object') {
            proxy = path.path;
            query = path.param;
        }
        if ((!proxy)) {
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

    // Simple event system
    PublicaMundi.Maps.Observable = PublicaMundi.Class({
        initialize: function (options) {
            this.values = {
                events: {}
            };
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
        on: function (event, callback) {
            if (typeof this.values.events[event] === 'undefined') {
                throw 'Event not supported.';
            }
            var listeners = this.values.events[event].listeners.push(callback);
        },
        off: function (callback) {
            for (var key in this.values.events) {
                for (var i = 0; i < this.values.events[key].listenters; i++) {
                    if (this.values.events[key].listeners[i] === callback) {
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
                listeners[i](this, args);
            }
        }
    });

    // Resource registry
    var resourceTypeRegistry = {};

    PublicaMundi.Maps.registerResourceType = function (type, title, metadataReader, layerFactory) {
        if (!type) {
            throw 'Parameter type is not set.';
        }
        if (typeof title === 'undefined') {
            throw 'Parameter title is not set.';
        }
        if (typeof metadataReader !== 'function') {
            throw 'Parameter metadataReader is not a function.';
        }
        if (typeof layerFactory !== 'function') {
            throw 'Parameter layerFactory is not a function.';
        }

        resourceTypeRegistry[type] = {
            title: title,
            metadataReader: metadataReader,
            layerFactory: layerFactory
        };
    };

    // Adapter registry
    var adapterRegistry = {};

    PublicaMundi.Maps.registerResourceTypeAdapter = function (format, type, adapter) {
        if (!format) {
            throw 'Parameter format is not set.';
        }
        if (!PublicaMundi.Maps.Resources.Types.hasOwnProperty(type)) {
            throw 'Parameter type is invalid.';
        }
        if (typeof adapter !== 'function') {
            throw 'Parameter adapter is not a function.';
        }

        adapterRegistry[format] = {
            type: type,
            adapter: adapter
        };
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
        getOptions: function (resource) {
            PublicaMundi.operationNotImplemented();
        }
    });

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
        renderLayerGroup: function (resource) {
            var text = '<h2>' + resource.metadata.title + '<p class="remove-resource"><a id="' + resource.id + '_rl" class="remove-resource" href="#" data-resource="' + resource.id + '">Remove</a></p>';
            if (resource.metadata.layers.length > 1) {
                text += '<span class="ui-li-count ui-li-count-resource">' + resource.metadata.layers.length + '</span>';
            }
            text += '</h2>';

            return text;
        },
        renderLayerItem: function (resource, layer) {
            var legend = layer.legend;// || this.values.config.imagePath + 'blank.gif';

            return ((layer.legend ? '<img src="' + layer.legend + '" alt="" class="legend" /><p>' : '<p style="margin-left: -9px">') + '<a class="ui-btn ui-btn-icon-notext ui-icon-edit btn-layer-config" data-layer="' + layer.id + '" href="#" style="float: left;"></a><span class="layer-title">' + layer.title + '</span></p><label class="layer-selector ui-li-aside"><input type="checkbox" data-layer="' + layer.id + '"></label>');
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

            this.values.registry = {
                counter: 0,
                resources: []
            };

            this.event('resource:add');
            this.event('resource:remove');
        },
        addResource: function (options) {
            if (typeof options.type === 'undefined') {
                throw 'Resource type is missing.';
            }
            if (typeof resourceTypeRegistry[options.type] !== 'object') {
                throw 'Resource type is not supported.';
            }
            options.config = this.values.config;

            var metadataReader = new resourceTypeRegistry[options.type].metadataReader(options);

            var self = this;

            metadataReader.getMetadata(function (metadata) {
                var existingResource = self.getResourceByTypeAndKey(options.type, metadata.key);

                if (existingResource) {
                    self.removeResource(existingResource.id);
                }
                self.values.registry.counter++;

                var newResource = {
                    id: 'resource_' + self.values.registry.counter,
                    metadata: metadata
                };

                for (var l = 0; l < newResource.metadata.layers.length; l++) {
                    PublicaMundi.extend(newResource.metadata.layers[l], {
                        id: newResource.id + '_' + l
                    });
                }
                self.values.registry.resources.push(newResource);

                self.trigger('resource:add', newResource);
            });

            return true;
        },
        addResourceFromCatalog: function (resource) {
            if (!resource) {
                throw 'Resource is missing.';
            }
            if (typeof adapterRegistry[resource.format.toUpperCase()] !== 'object') {
                return false;
            }
            var adapter = new adapterRegistry[resource.format.toUpperCase()].adapter();

            this.addResource(adapter.getOptions(resource));

            return true;
        },
        removeResource: function (id) {
            var resource = this.getResourceById(id), i;

            for (i = 0; i < resource.metadata.layers.length; i++) {
                var layer = resource.metadata.layers[i];
                if ((layer.viewer.visible) && (layer.loader.queue)) {
                    for (var q = 0; q < layer.loader.queue.length; q++) {
                        if (layer.loader.queue[q].readyState !== 4) {
                            layer.loader.queue[q].abort();
                        }
                    }
                }
                layer.loader.queue = [];
            }

            for (i = 0; i < this.values.registry.resources.length; i++) {
                if (this.values.registry.resources[i].id === resource.id) {
                    this.values.registry.resources.splice(i, 1)[0];

                    this.trigger('resource:remove', resource);
                    break;
                }
            }

            return resource;
        },
        getResourceById: function (id) {
            var parts = id.split('_');
            var prefix = parts[0] + '_' + parts[1];

            for (var i = 0; i < this.values.registry.resources.length; i++) {
                var resource = this.values.registry.resources[i];
                if (resource.id === prefix) {
                    return resource;
                }
            }
            return null;
        },
        getLayerById: function (id) {
            var parts = id.split('_');

            var resource = this.getResourceById(parts[0] + '_' + parts[1]);

            if (resource) {
                return resource.metadata.layers[parts[2]];
            }
            return null;
        },
        getResourceByTypeAndKey: function (type, key) {
            if (typeof resourceTypeRegistry[type] === 'undefined') {
                throw 'Resource type is not supported.';
            }
            if (!key) {
                return null;
            }

            for (var i = 0; i < this.values.registry.resources.length; i++) {
                var resource = this.values.registry.resources[i];
                if ((resource.metadata.type === type) && (resource.metadata.key === key)) {
                    return resource;
                }
            }
            return null;
        },
        getResourceTypes: function () {
            var types = [];

            for (var type in resourceTypeRegistry) {
                types.push({
                    type: type,
                    title: resourceTypeRegistry[type].title
                });
            }

            return types;
        },
        createLayer: function (map, id) {
            var resource = this.getResourceById(id);
            var layer = this.getLayerById(id);

            if ((resource) && (layer)) {
                var layerFactory = new resourceTypeRegistry[resource.metadata.type].layerFactory({
                    config: this.values.config
                });

                layer.viewer.visible = true;

                layerFactory.create(map, resource, layer);
            }
        },
        destroyLayer: function (map, id) {
            var resource = this.getResourceById(id);
            var layer = this.getLayerById(id);

            if ((resource) && (layer)) {
                var layerFactory = new resourceTypeRegistry[resource.metadata.type].layerFactory({
                    config: this.values.config
                });

                layer.viewer.visible = false;

                for (var i = 0; i < layer.loader.queue.length; i++) {
                    if (layer.loader.queue[i].readyState !== 4) {
                        layer.loader.queue[i].abort();
                    }
                }

                layer.loader.queue = [];

                layerFactory.destroy(map, resource, layer);
            }
        },
        getLayerFactory: function (type) {
            return new resourceTypeRegistry[type].layerFactory({
                config: this.values.config
            });
        }
    });

    var viewFactoryRegistry = {};

    PublicaMundi.Maps.registerViewFactory = function (type, constructor) {
        if (PublicaMundi.Maps.Resources.Types[type] === undefined) {
            throw 'Resource type is not supported.';
        }

        if (typeof constructor !== 'function') {
            throw 'Parameter constructor is not a function.';
        }

        viewFactoryRegistry[type] = constructor;
    };

    PublicaMundi.Maps.Resources.UI.ViewFactory = PublicaMundi.Class({
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        build: function () {
            PublicaMundi.operationNotImplemented();
        }
    });

    PublicaMundi.Maps.Resources.UI.ViewManager = PublicaMundi.Class({
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        createView: function (options) {
            if (typeof viewFactoryRegistry[options.resourceType] !== 'function') {
                throw 'View type is not supported.';
            }

            var buidler = new viewFactoryRegistry[options.resourceType]({
                config: this.values.config
            });

            return buidler.build(options);
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

    PublicaMundi.Maps.UI.CreateResourceView = PublicaMundi.Class(PublicaMundi.Maps.UI.View, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.UI.View.prototype.initialize === 'function') {
                PublicaMundi.Maps.UI.View.prototype.initialize.apply(this, arguments);
            }

            this.event('create');
            this.event('cancel');
        },
        getParameters: function () {

        }
    });

    return PublicaMundi;
});
