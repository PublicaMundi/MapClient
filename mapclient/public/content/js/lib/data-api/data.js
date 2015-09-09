(function() {
    var factory = function ($, PublicaMundi) {
        "use strict";

        if(typeof PublicaMundi.Data === 'undefined') {
                PublicaMundi.Data = {
                __namespace: 'PublicaMundi.Data'
            };
        }

        if(typeof PublicaMundi.Data.CRS === 'undefined') {
                PublicaMundi.Data.CRS = {
                __namespace: 'PublicaMundi.Data.CRS'
            };
        }

        PublicaMundi.Data.CRS.Google = 'EPSG:900913';
        PublicaMundi.Data.CRS.Mercator = 'EPSG:3857';
        PublicaMundi.Data.CRS.WGS84 = 'EPSG:4326';
        PublicaMundi.Data.CRS.CRS84 = 'CRS:84';

        PublicaMundi.Data.CRS.GGRS87 = 'EPSG:2100';
        PublicaMundi.Data.CRS.ETRS89 = 'EPSG:4258';

        PublicaMundi.Data.Format = {
            JSON : 'JSON',
            ESRI : 'ESRI Shapefile',
            GML : 'GML',
            KML : 'KML',
            GPKG : 'GPKG',
            DXF : 'DXF',
            CSV : 'CSV',
            GeoJSON : 'GeoJSON',
            PDF : 'PDF'
        };

        var operators = {
            EQUAL: 'EQUAL',
            NOT_EQUAL: 'NOT_EQUAL',
            GREATER: 'GREATER',
            GREATER_OR_EQUAL: 'GREATER_OR_EQUAL',
            LESS: 'LESS',
            LESS_OR_EQUAL: 'LESS_OR_EQUAL',
            AREA: 'AREA',
            DISTANCE: 'DISTANCE',
            CONTAINS: 'CONTAINS',
            INTERSECTS: 'INTERSECTS'
        };

        function clone(obj) {
            var target = {};
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    if (typeof obj[prop] === 'object') {
                        target[prop] = clone(obj[prop]);
                    } else {
                        target[prop] = obj[prop];
                    }
                }
            }
            return target;
        }

        function getArgumentField(arg, index) {
            switch (typeof arg) {
                case 'object':
                    // Check for field name
                    var obj = {
                        name: ''
                    };
                    if (arg.hasOwnProperty('name')) {
                        obj.name = arg.name;
                    } else {
                        throw new PublicaMundi.Data.SyntaxException('Name of argument ' + index + ' is missing.');
                    }
                    if (arg.hasOwnProperty('resource')) {
                        obj.resource = getResourceFromAlias(arg.resource);
                    }
                    return obj;
                case 'string': case 'number':
                    return arg;
                default:
                    throw new PublicaMundi.Data.SyntaxException('Type of argument ' + index + ' is invalid.');
            }
        }

        function getArgumentNumber(arg, index) {
            if (isNaN(arg)) {
                throw new PublicaMundi.Data.SyntaxException('Type of argument ' + index + ' is invalid. Numeric value is expected.');
            }
            return arg;
        }

        function getResourceFromAlias(name) {
            console.log(configuration);
            if((name) && (configuration.alias) && (configuration.alias.hasOwnProperty(name))) {
                return configuration.alias[name];
            }
            return name;
        };

        function getArgumentGeometry(arg, index) {
            if (typeof arg === 'object') {
                // Check for geometry expressed in GeoJSON
                if ((arg.hasOwnProperty('coordinates')) && (arg.hasOwnProperty('type'))) {
                    return arg;
                }
                // Check for field name
                var obj = {
                    name: ''
                };
                if (arg.hasOwnProperty('name')) {
                    obj.name = arg.name;
                } else {
                    throw new PublicaMundi.Data.SyntaxException('Name of argument ' + index + ' is missing.');
                }
                if (arg.hasOwnProperty('resource')) {
                    obj.resource = getResourceFromAlias(arg.resource);
                }
                return obj;
            }
            throw new PublicaMundi.Data.SyntaxException('Type of argument ' + index + ' is invalid.');
        }

        PublicaMundi.Data.SyntaxException = function (message) {
            this.name = 'PublicaMundi.Data.SyntaxException';
            this.message = message;
        };

        PublicaMundi.Data.SyntaxException.prototype = new Error();

        PublicaMundi.Data.SyntaxException.prototype.constructor = PublicaMundi.Data.SyntaxException;

        PublicaMundi.Data.SyntaxException.prototype.toString = function () {
            return this.name + ": " + this.message;
        };

        var configuration = {
            debug: false,
            proxy: null,
            endpoint: null
        };

        var extend = function (target, source) {
            if(!target) {
                return;
            }

            if (source) {
                for (var property in source) {
                    if (source.hasOwnProperty(property)) {
                        if((typeof source[property] === 'object') && (source[property])) {
                            if(typeof target[property] !== 'object') {
                                target[property] = {};
                            }
                            extend(target[property], source[property]);
                        } else {
                            target[property] = source[property];
                        }
                    }
                }
            }
            return target;
        };

        PublicaMundi.Data.configure = function(options) {
            extend(configuration, options);
        };

        PublicaMundi.Data.getConfiguration = function() {
            return clone(configuration);
        };

        PublicaMundi.Data.Query = function (endpoint) {
            if (typeof endpoint === 'string') {
                this.endpoint = endpoint;
            } else {
                this.endpoint = configuration.endpoint;
            }
            if(!this.endpoint) {
                throw new PublicaMundi.Data.SyntaxException('Service endpoint is not set.');
            }

            this.callbacks = {
                success : null,
                failure : null,
                complete : null
            };

            this.reset();
        };

        PublicaMundi.Data.Query.prototype.toString = function (formatted) {
            if(formatted) {
                return JSON.stringify(this.request, null, ' ');
            }
            return JSON.stringify(this.request);
        };

        PublicaMundi.Data.Query.prototype.toObject = function () {
            return clone(this.request);
        };

        PublicaMundi.Data.Query.prototype.parse = function(text) {
            this.reset();
            this.request = JSON.parse(text);

            return this;
        };

        PublicaMundi.Data.Query.prototype.resource = function (resource, alias) {
            var obj = {
                name: '',
                alias: ''
            };

            switch (typeof resource) {
                case 'object':
                    if (resource.hasOwnProperty('name')) {
                        obj.name = getResourceFromAlias(resource.name);
                    } else {
                        throw new PublicaMundi.Data.SyntaxException('Resource name is not defined.');
                    }
                    if (resource.hasOwnProperty('alias')) {
                        obj.alias = resource.alias;
                    } else {
                        obj.alias = obj.name;
                    }
                    break;
                case 'string':
                    obj.name = getResourceFromAlias(resource);
                    if (typeof alias === 'string') {
                        obj.alias = alias;
                    } else {
                        obj.alias = obj.name;
                    }
                    break;
                default:
                    throw new PublicaMundi.Data.SyntaxException('Resource name is malformed.');
            }
            for (var index in this.query.resources) {
                if (this.query.resources[index].alias === obj.alias) {
                    throw new PublicaMundi.Data.SyntaxException('Resource ' + obj.alias + ' is already registered.');
                }
            }
            this.query.resources.push(obj);
            return this;
        };

        PublicaMundi.Data.Query.prototype.field = function (resource, name, alias) {
            var index;

            var obj = {
                name: ''
            };
            switch (typeof resource) {
                case 'object':
                    if (resource.hasOwnProperty('name')) {
                        obj.name = resource.name;
                    } else {
                        throw new PublicaMundi.Data.SyntaxException('Field name is not defined.');
                    }
                    if (resource.hasOwnProperty('resource')) {
                        obj.resource = getResourceFromAlias(resource.resource);
                    }
                    if (resource.hasOwnProperty('alias')) {
                        obj.alias = resource.alias;
                    } else {
                        obj.alias = resource.name;
                    }
                    break;
                case 'string':
                    switch (typeof name) {
                        case 'undefined':
                            obj.name = resource;
                            obj.alias = resource;
                            break;
                        case 'string':
                            obj.alias = name;
                            obj.name = name;
                            obj.resource = getResourceFromAlias(resource);
                            break;
                        default:
                            throw new PublicaMundi.Data.SyntaxException('Field name is malformed.');
                    }
                    if (typeof alias === 'string') {
                        obj.alias = alias;
                    }

                    var resourceExists = false;
                    if (obj.resource) {
                        for (index in this.query.resources) {
                            if ((this.query.resources[index].name === obj.resource) || (this.query.resources[index].alias === obj.resource)) {
                                resourceExists = true;
                                break;
                            }
                        }
                        if (!resourceExists) {
                            throw new PublicaMundi.Data.SyntaxException('Resource ' + obj.resource + ' is does not exist.');
                        }
                    }

                    var fieldExists = false;
                    for (index in this.query.fields) {
                        if (obj.alias === this.query.fields[index].alias) {
                            throw new PublicaMundi.Data.SyntaxException('Field ' + obj.alias + ' already exists.');
                        }
                    }

                    this.query.fields.push(obj);
                    break;
            }
            return this;
        };

        PublicaMundi.Data.Query.prototype.equal = function (arg1, arg2) {
            var filter = {
                operator: operators.EQUAL,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.notEqueal = function (arg1, arg2) {
            var filter = {
                operator: operators.NOT_EQUAL,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.less = function (arg1, arg2) {
            var filter = {
                operator: operators.LESS,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.lessOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.LESS_OR_EQUAL,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.greater = function (arg1, arg2) {
            var filter = {
                operator: operators.GREATER,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.greaterOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.GREATER_OR_EQUAL,
                arguments: [
                    getArgumentField(arg1, 1, false),
                    getArgumentField(arg2, 2, false)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.distanceLessOrEqual = function (arg1, arg2, arg3) {
            var filter = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2),
                    operators.LESS_OR_EQUAL,
                    getArgumentNumber(arg3)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.distanceLess = function (arg1, arg2, arg3) {
            var filter = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2),
                    operators.LESS,
                    getArgumentNumber(arg3)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.distanceGreaterOrEqual = function (arg1, arg2, arg3) {
            var filter = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2),
                    operators.GREATER_OR_EQUAL,
                    getArgumentNumber(arg3)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.distanceGreater = function (arg1, arg2, arg3) {
            var filter = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2),
                    operators.GREATER,
                    getArgumentNumber(arg3)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.areaLessOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1),
                    operators.LESS_OR_EQUAL,
                    getArgumentNumber(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.areaLess = function (arg1, arg2) {
            var filter = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1),
                    operators.LESS,
                    getArgumentNumber(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.areaGreaterOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1),
                    operators.GREATER_OR_EQUAL,
                    getArgumentNumber(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.areaGreater = function (arg1, arg2) {
            var filter = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1),
                    operators.GREATER,
                    getArgumentNumber(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.contains = function (arg1, arg2) {
            var filter = {
                operator: operators.CONTAINS,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.intersects = function (arg1, arg2) {
            var filter = {
                operator: operators.INTERSECTS,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        PublicaMundi.Data.Query.prototype.orderBy = function (resource, name, desc) {
            var index;

            var obj = {
                name: '',
                desc: false
            };
            switch (typeof resource) {
                case 'object':
                    if (resource.hasOwnProperty('name')) {
                        obj.name = resource.name;
                    } else {
                        throw new PublicaMundi.Data.SyntaxException('Sorting field name is not defined.');
                    }
                    if (resource.hasOwnProperty('resource')) {
                        obj.resource = getResourceFromAlias(resource.resource);
                    }
                    if ((resource.hasOwnProperty('desc')) && (typeof resource.desc === 'boolean')) {
                        obj.desc = resource.desc;
                    }
                    break;
                case 'string':
                    switch (typeof name) {
                        case 'undefined':
                            obj.name = resource;
                            break;
                        case 'string':
                            obj.name = name;
                            obj.resource = getResourceFromAlias(resource);
                            break;
                        case 'boolean':
                            obj.name = resource;
                            obj.desc = name;
                            break;
                        default:
                            throw new PublicaMundi.Data.SyntaxException('Sorting field name is malformed.');
                    }
                    if (typeof desc === 'boolean') {
                        obj.desc = desc;
                    }

                    var resourceExists = false;
                    if (obj.resource) {
                        for (index in this.query.resources) {
                            if ((this.query.resources[index].name === obj.resource) || (this.query.resources[index].alias === obj.resource)) {
                                resourceExists = true;
                                break;
                            }
                        }
                        if (!resourceExists) {
                            throw new PublicaMundi.Data.SyntaxException('Resource ' + obj.resource + ' is does not exist.');
                        }
                    }

                    this.query.sort.push(obj);
                    break;
            }
            return this;
        };

        PublicaMundi.Data.Query.prototype.setSuccess = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.success = callback;
            }
            return this;
        };

        PublicaMundi.Data.Query.prototype.setFailure = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.failure = callback;
            }
            return this;
        };

        PublicaMundi.Data.Query.prototype.setComplete = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.complete = callback;
            }
            return this;
        };

        PublicaMundi.Data.Query.prototype.reset = function () {
            this.request= {
                queue: [],
                files: null,
                format: PublicaMundi.Data.Format.GeoJSON
            };

            this.queue();

            return this;
        };

        PublicaMundi.Data.Query.prototype.queue = function () {
            this.request.queue.push({
                resources: [],
                fields: [],
                filters: [],
                sort: [],
                offset: 0,
                limit: -1
            });

            this.query = this.request.queue[this.request.queue.length -1];

            return this;
        };

        PublicaMundi.Data.Query.prototype.format = function (format) {
            for (var prop in PublicaMundi.Data.Format) {
                if (PublicaMundi.Data.Format[prop] === format) {
                    this.request.format = format;
                    return this;
                }
            }

            throw new PublicaMundi.Data.SyntaxException('Format is not supported.');
        };

        PublicaMundi.Data.Query.prototype.crs = function (crs) {
            var parts = crs.split(':');
            if((parts.length != 2) || (parts[0] != 'EPSG')) {
                throw new PublicaMundi.Data.SyntaxException('CRS is not supported.');
            }

            for (var prop in PublicaMundi.Data.CRS) {
                if (PublicaMundi.Data.CRS[prop] === crs) {
                    this.request.crs = crs;
                    return this;
                }
            }

            throw new PublicaMundi.Data.SyntaxException('CRS is not supported.');
        };

        PublicaMundi.Data.Query.prototype.execute = function (options) {
            options = options || {};
            options.success = options.success || this.callbacks.success;
            options.failure = options.failure || this.callbacks.failure;
            options.complete = options.complete || this.callbacks.complete;

            var execution = {
                size : null,
                start : (new Date()).getTime(),
                end : null
            };

            $.ajax({
                type: "POST",
                url: this.endpoint + 'api/query',
                context: this,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(this.request)
            }).done(function (data, textStatus, jqXHR) {
                execution.end = (new Date()).getTime();
                var contentLength = jqXHR.getResponseHeader('Content-Length');
                if(contentLength) {
                    execution.size =  contentLength / 1024.0;
                }

                if (typeof options.success === 'function') {
                    options.success.call( options.context || this, data, execution);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                execution.end = (new Date()).getTime();
                if (typeof options.failure === 'function') {
                    options.failure.call( options.context || this, (errorThrown ? errorThrown : textStatus), execution);
                }
            }).always(function(dataOrJqXHR, textStatus, jqXHROrErrorThrown ) {
                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            });

            return this;
        };

        PublicaMundi.Data.Query.prototype.export = function (options) {
            options = options || {};
            options.success = options.success || this.callbacks.success;
            options.failure = options.failure || this.callbacks.failure;
            options.complete = options.complete || this.callbacks.complete;

            options.files = options.files || null;

            if(options.files) {
                if(options.files.length != this.request.queue.length) {
                    throw new PublicaMundi.Data.SyntaxException('Filenames and queries arrays must be of the same length.');
                } else {
                    this.request.files = options.files;
                }
            }

            var execution = {
                size : null,
                start : (new Date()).getTime(),
                end : null
            };

            $.ajax({
                type: "POST",
                url: this.endpoint + 'api/export',
                context: this,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(this.request)
            }).done(function (data, textStatus, jqXHR) {
                execution.end = (new Date()).getTime();
                var contentLength = jqXHR.getResponseHeader('Content-Length');
                if(contentLength) {
                    execution.size =  contentLength / 1024.0;
                }

                if (typeof options.success === 'function') {
                    options.success.call( options.context || this, data, execution);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                execution.end = (new Date()).getTime();
                if (typeof options.failure === 'function') {
                    options.failure.call( options.context || this, (errorThrown ? errorThrown : textStatus), execution);
                }
            }).always(function(dataOrJqXHR, textStatus, jqXHROrErrorThrown ) {
                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            });

            return this;
        };

        PublicaMundi.Data.Query.prototype.take = function (value) {
            if (isNaN(value)) {
                throw new PublicaMundi.Data.SyntaxException('Invalid number.');
            }
            this.query.limit = value;
            return this;
        };

        PublicaMundi.Data.Query.prototype.skip = function (value) {
            if (isNaN(value)) {
                throw new PublicaMundi.Data.SyntaxException('Invalid number.');
            }
            this.query.offset = value;
            return this;
        };

        PublicaMundi.Data.Query.prototype.getResources = function (options) {
            options = options || {};
            options.success = options.success || this.callbacks.success;
            options.failure = options.failure || this.callbacks.failure;
            options.complete = options.complete || this.callbacks.complete;

            var execution = {
                size : null,
                start : (new Date()).getTime(),
                end : null
            };

            $.ajax({
                url: this.endpoint + 'api/resource_show',
                context: this
            }).done(function (data, textStatus, jqXHR) {
                execution.end = (new Date()).getTime();
                var contentLength = jqXHR.getResponseHeader('Content-Length');
                if(contentLength) {
                    execution.size =  contentLength / 1024.0;
                }

                if((data.success) && (data.resources) && (configuration.alias)) {
                    for(var id in data.resources) {
                        for(var key in configuration.alias) {
                            if(configuration.alias[key] == id) {
                                data.resources[id].alias = key;
                            }
                        }
                    }
                }

                if (typeof options.success === 'function') {
                    options.success.call( options.context || this, data, execution);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                execution.end = (new Date()).getTime();
                if (typeof options.failure === 'function') {
                    options.failure.call( options.context || this, (errorThrown ? errorThrown : textStatus), execution);
                }
            }).always(function(dataOrJqXHR, textStatus, jqXHROrErrorThrown ) {
                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            });

            return this;
        };

        PublicaMundi.Data.Query.prototype.describeResource = function (options) {
            options.success = options.success || this.callbacks.success;
            options.failure = options.failure || this.callbacks.failure;
            options.complete = options.complete || this.callbacks.complete;

            var execution = {
                size : null,
                start : (new Date()).getTime(),
                end : null
            };

            $.ajax({
                url: this.endpoint + 'api/resource_describe/' + (options.id ? options.id : ''),
                context: this
            }).done(function (data, textStatus, jqXHR) {
                execution.end = (new Date()).getTime();
                var contentLength = jqXHR.getResponseHeader('Content-Length');
                if(contentLength) {
                    execution.size =  contentLength / 1024.0;
                }

                if (typeof options.success === 'function') {
                    options.success.call( options.context || this, data, execution);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                execution.end = (new Date()).getTime();
                if (typeof options.failure === 'function') {
                    options.failure.call( options.context || this, (errorThrown ? errorThrown : textStatus), execution);
                }
            }).always(function(dataOrJqXHR, textStatus, jqXHROrErrorThrown) {
                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            });

            return this;
        };

        return PublicaMundi;
    }

    if((define) && (define.amd)) {
        define(['jquery', 'shared'], factory);
    } else {
        if(!PublicaMundi) {
            PublicaMundi = {
                __namespace: 'PublicaMundi'
            };
        }
        factory($, PublicaMundi);
    }
})();
