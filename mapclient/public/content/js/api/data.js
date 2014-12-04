(function (global) {
    if (typeof PublicaMundi === 'undefined') {
        PublicaMundi = {};
    }

    PublicaMundi.Data = {};

    PublicaMundi.Data.Format = {
        JSON: 'json',
        GeoJSON: 'geojson'
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
                    obj.resource = arg.resource;
                }
                return obj;
            case 'string':
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
                obj.resource = arg.resource;
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

    PublicaMundi.Data.Query = function (endpoint) {
        if (typeof endpoint !== 'string') {
            throw new PublicaMundi.Data.SyntaxException('Service endpoint is not set.');
        }
        this.endpoint = endpoint;
        this.callback = null;
        this.query = {
            resources: [],
            fields: [],
            filters: [],
            offset: 0,
            limit: -1,
            format: PublicaMundi.Data.Format.GeoJSON
        };
    };

    PublicaMundi.Data.Query.prototype.toString = function () {
        return JSON.stringify(this.query, null, ' ');
    };

    PublicaMundi.Data.Query.prototype.resource = function (resource, alias) {
        var obj = {
            name: '',
            alias: ''
        };

        switch (typeof resource) {
            case 'object':
                if (resource.hasOwnProperty('name')) {
                    obj.name = resource.name;
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
                obj.name = resource;
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

        obj = {
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
                    obj.resource = resource.resource;
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
                        obj.resource = resource;
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

    PublicaMundi.Data.Query.prototype.setCallback = function (callback) {
        if (typeof callback === 'function') {
            this.callback = callback;
        }
        return this;
    };

    PublicaMundi.Data.Query.prototype.reset = function (resource) {
        this.query = {
            resources: [],
            fields: [],
            filters: [],
            offset: 0,
            limit: -1,
            format: PublicaMundi.Data.Format.GeoJSON
        };

        return this;
    };

    PublicaMundi.Data.Query.prototype.format = function (format) {
        for (var prop in PublicaMundi.Data.Format) {
            if (PublicaMundi.Data.Format[prop] === format) {
                this.query.format = format;
                return this;
            }
        }

        throw new PublicaMundi.Data.SyntaxException('Format is not supported.');
    };

    PublicaMundi.Data.Query.prototype.execute = function (callback) {
        callback = callback || this.callback;

        $.ajax({
            type: "POST",
            url: this.endpoint,
            context: this,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify(this.query)
        }).done(function (data) {
            if (typeof callback === 'function') {
                callback.call(this, data);
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

    if (typeof global.PublicaMundi === 'undefined') {
        global.PublicaMundi = PublicaMundi;
    } else {
        global.PublicaMundi.Data = PublicaMundi.Data;
    }
})(window);
