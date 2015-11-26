(function() {
    var factory = function ($, global) {
        "use strict";

        // Create namespaces

        /**
         * Data API client exported module.
         * @exports PublicaMundi
         */
        var PublicaMundi = global;

        if(typeof PublicaMundi === 'undefined') {
            PublicaMundi = {
                __namespace: 'PublicaMundi'
            };
        }

        /**
         * Declares Data API classes.
         * @namespace
         */
        PublicaMundi.Data = {
            __namespace: 'PublicaMundi.Data'
        };

        /** Supported coordinate systems.
         * @namespace
         */
        PublicaMundi.Data.CRS = {
            __namespace: 'PublicaMundi.Data.CRS',
            /** Google Maps Global Mercator.
             *  @constant
            */
            Google: 'EPSG:900913',
            /** WGS 84 / Pseudo-Mercator.
             *  @constant
            */
            Mercator: 'EPSG:3857',
            /** JavaScript Object Notation.
             *  @constant
            */
            WGS84: 'EPSG:4326',
            /** WGS 84 - World Geodetic System 1984.
             *  @constant
            */
            CRS84: 'CRS:84',
            /** GGRS87 / Greek Grid.
             *  @constant
            */
            GGRS87: 'EPSG:2100',
            /** EPSG:4258 Europe.
             *  @constant
            */
            ETRS89: 'EPSG:4258'
        };

        /** Export data operation supported formats. For {@link module:PublicaMundi.Data.Query#execute execute} operation only {@link module:PublicaMundi.Data.Format.JSON JSON} and {@link module:PublicaMundi.Data.Format.GeoJSON GeoJSON} formats are supported.
         * @namespace
         */
        PublicaMundi.Data.Format = {
            __namespace: 'PublicaMundi.Data.Format',
            /** JavaScript Object Notation.
             *  @constant
            */
            JSON : 'JSON',
            /**  	ESRI Shapefile.
             *  @constant
            */
            ESRI : 'ESRI Shapefile',
            /** Geography Markup Language.
             *  @constant
            */
            GML : 'GML',
            /** Keyhole Markup Language.
             *  @constant
            */
            KML : 'KML',
            /** OGC GeoPackage.
             *  @constant
            */
            GPKG : 'GPKG',
            /** AutoCAD DXF.
             *  @constant
            */
            DXF : 'DXF',
            /** Comma Separated Value.
             *  @constant
            */
            CSV : 'CSV',
            /** GeoJSON: A geospatial data interchange format based on JavaScript Object Notation (JSON).
             *  @constant
            */
            GeoJSON : 'GeoJSON',
            /** Geospatial PDF.
             *  @constant
            */
            PDF : 'PDF'
        };

        var operators = {
            EQUAL: 'EQUAL',
            NOT_EQUAL: 'NOT_EQUAL',
            GREATER: 'GREATER',
            GREATER_OR_EQUAL: 'GREATER_OR_EQUAL',
            LESS: 'LESS',
            LESS_OR_EQUAL: 'LESS_OR_EQUAL',
            LIKE: 'LIKE',
            AREA: 'AREA',
            DISTANCE: 'DISTANCE',
            CONTAINS: 'CONTAINS',
            INTERSECTS: 'INTERSECTS'
        };

        // Data API configuration
        var configuration = {
            debug: false,
            endpoint: null,
            alias: {}
        };

        /**
         * Sets configuration options for all {@link module:PublicaMundi.Data.Query Query} instances.
         * @function
         * @static
         * @param {object} options Configuration options.
         * @param {boolean} [options.debug=false] Enables debug mode.
         * @param {string} [options.endpoint] Data API service endpoint. Endpoint value can be overriden when creating a new {@link module:PublicaMundi.Data.Query Query} instance.
         * @param {object} options.alias Declares alias names for resources.
         * @example
         *
         *   PublicaMundi.Data.configure({
         *      debug: true,
         *      alias: {
         *          'roads': 'f62e6867-f74c-4342-9755-976b574ac7f7',
         *          'cities': 'b6fc004b-07bd-4945-bf34-8ad4a8781c91'
         *      }
         *  });
         */
        PublicaMundi.Data.configure = function(options) {
            extend(configuration, options);
            if(configuration.debug) {
                console.log(JSON.stringify(configuration, null, '\t'));
            }
        };

        /**
         * Returns the current Data API configuration options
         * @function
         * @static
         */
        PublicaMundi.Data.getConfiguration = function() {
            return clone(configuration);
        };

        // Exceptions

        /**
         * Creates a new exception.
         * @class
         * @classdesc Represents an exception.
         * @param {string} message Exception message.
         */
        PublicaMundi.Data.SyntaxException = function (message) {
            this.name = 'PublicaMundi.Data.SyntaxException';
            this.message = message;
        };

        PublicaMundi.Data.SyntaxException.prototype = new Error();

        PublicaMundi.Data.SyntaxException.prototype.constructor = PublicaMundi.Data.SyntaxException;

        PublicaMundi.Data.SyntaxException.prototype.toString = function () {
            return this.name + ": " + this.message;
        };

        // Helper methods
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

        function getResourceFromAlias(name) {
            if((name) && (configuration.alias) && (configuration.alias.hasOwnProperty(name))) {
                return configuration.alias[name];
            }
            return name;
        };

        function getArgument(arg, index) {
            switch (typeof arg) {
                case 'object':
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

        function getArgumentField(arg, index) {
            switch (typeof arg) {
                case 'object':
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
                case 'string':
                    return obj = {
                        name: arg
                    };
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

        function getArgumentLiteral(arg, index) {
            if(typeof arg === 'string') {
                return arg;
            }

            return arg.toString();
        }

        function getArgumentGeometry(arg, index) {
            switch (typeof arg) {
                case 'object':
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
                case 'string':
                    return {
                        name: arg
                    };
                default:
                    throw new PublicaMundi.Data.SyntaxException('Type of argument ' + index + ' is invalid.');
            }
        }

        function isField(arg) {
            if ((typeof arg === 'object') && (arg.hasOwnProperty('name'))) {
                return true;
            }
            return false;
        }

        // Public Data API methods

        /**
         * Represents a query.
         * @class
         * @classdesc This class provides the core functionality of the Data API. It offers the methods for creating queries and submiting requests. Internally the query is stored as an object. Users can format queries manually and submit JSON messages to the API endpoint<sup>*</sup>.
         * </br>
         * </br>
         * <i><sup>*</sup>It is recommended that the fluent API is used instead of creating custom queries.</i>
         * @param {string} endpoint - Data API endpoint. If no endpoint is defined, the default configuration property is used. If API has not been configured current is used.
         */
        PublicaMundi.Data.Query = function (endpoint) {
            if (typeof endpoint === 'string') {
                this.endpoint = endpoint;
            } else {
                this.endpoint = configuration.endpoint;
            }
            this.endpoint = this.endpoint || '';

            this.callbacks = {
                success : null,
                failure : null,
                complete : null
            };

            this.reset();
        };

        /**
         * Returns the JSON notation that represents the query.
         * @function
         * @param {boolean} format  Enables standard pretty-print appearance.
         */
        PublicaMundi.Data.Query.prototype.toString = function (format) {
            if(format) {
                return JSON.stringify(this.request, null, '\t');
            }
            return JSON.stringify(this.request);
        };

        /**
         * Returns an object that represents the query. Changes to the returned object do not affect the query.
         * @function
         */
        PublicaMundi.Data.Query.prototype.toObject = function () {
            return clone(this.request);
        };

        /**
         * Parses text in JSON notation and initializes a query.
         * @function
         * @param {string} text Query in JSON notation.
         */
        PublicaMundi.Data.Query.prototype.parse = function(text) {
            this.reset();
            this.request = JSON.parse(text);

            return this;
        };

        /**
         * Declares a resource. Declaring more than one resources will create a cross join query.
         * @name resource
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} resource Resource unique name or alias.
         * @param {string} [alias] Optional resource alias.
         */

        /**
         * Declares a resource. Declaring more than one resources will create a cross join query.
         * @name resource
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {object} options Resource properties.
         * @param {string} options.resource Resource unique name.
         * @param {string} [options.alias] Resource unique alias.
         */

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

        /**
         * Declares a field to be included in the response. Declaring no fields will result in including all fields from all declared resources in the response. In this case ambiguous field name exceptions may occur.
         * @name field
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} resource Field resource.
         * @param {string} name Field name.
         * @param {string} [alias] Field alias.
         */

        /**
         * Declares a field to be included in the response. Declaring no fields will result in including all fields from all declared resources in the response. In this case ambiguous field name exceptions may occur.
         * @name field
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} name Field name. Resource will be deduced by the declared resources. Not declaring a resource may result in ambiguous field name exceptions.
         * @param {string} [alias] Field alias.
         */

        /**
         * Declares a field to be included in the response. Declaring no fields will result in including all fields from all declared resources in the response. In this case ambiguous field name exceptions may occur.
         * @name field
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {object} options Field properties.
         * @param {string} [options.resource] Field resource.
         * @param {string} options.name Field name.
         * @param {string} [options.alias] Field alias.
         */

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

        /**
         * Declares a computed field for the area of a resource field or a geometry expressed in GeoJSON format.
         * @function
         * @param {string|object} arg1 Field or geometry expressed in GeoJSON format.
         * @param {string} alias Computed field name.
         */
        PublicaMundi.Data.Query.prototype.area = function (arg1, alias) {
            var field = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1)
                ],
                alias: (alias ? alias : '')
            };

            this.query.fields.push(field);
            return this;
        };

        /**
         * Declares a computed field for the distance between two geometries represented either as a resource field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 Field or geometry expressed in GeoJSON format.
         * @param {string|object} arg2 Field or geometry expressed in GeoJSON format.
         * @param {string} alias Computed field name.
         */
        PublicaMundi.Data.Query.prototype.distance = function (arg1, arg2, alias) {
            var field = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2)
                ],
                alias: (alias ? alias : '')
            };
            this.query.fields.push(field);
            return this;
        };

        /**
         * Adds a filter that checks if two arguments (field or value) are equal.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.equal = function (arg1, arg2) {
            var filter = {
                operator: operators.EQUAL,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if two arguments (field or value) are not equal.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.notEqueal = function (arg1, arg2) {
            var filter = {
                operator: operators.NOT_EQUAL,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the first argument is less than the second argument.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.less = function (arg1, arg2) {
            var filter = {
                operator: operators.LESS,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the first argument is less or equal than the second argument.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.lessOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.LESS_OR_EQUAL,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the first argument is greater than the second argument.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.greater = function (arg1, arg2) {
            var filter = {
                operator: operators.GREATER,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the first argument is greater or equal than the second argument.
         * @function
         * @param {string|object} arg1 First field or value.
         * @param {string|object} arg2 Second field of value.
         */
        PublicaMundi.Data.Query.prototype.greaterOrEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.GREATER_OR_EQUAL,
                arguments: [
                    getArgument(arg1, 1),
                    getArgument(arg2, 2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if a string field contains a value.
         * @function
         * @param {string|object} field Field to search.
         * @param {string|object} value Value to search.
         */
        PublicaMundi.Data.Query.prototype.like = function (arg1, arg2) {
            var filter;

            var field1 = getArgument(arg1, 1);
            var field2 = getArgument(arg2, 2);

            if((isField(field1) && isField(field2))) {
                throw new PublicaMundi.Data.SyntaxException('Operator ' + operators.LIKE + ' requires exactly one field and one literal argument.');
            }

            if((!isField(field1) && !isField(field2))) {
                //Assumes that the first argument is a field. Server will check if an actual field exists
                filter = {
                    operator: operators.LIKE,
                    arguments: [
                        getArgumentField(arg1, 1),
                        getArgumentLiteral(arg2, 2)
                    ]
                };
            } else if(isField(field1)) {
                filter = {
                    operator: operators.LIKE,
                    arguments: [
                        getArgument(arg1, 1),
                        getArgumentLiteral(arg2, 2)
                    ]
                };
            } else {
                filter = {
                    operator: operators.LIKE,
                    arguments: [
                        getArgument(arg2, 2),
                        getArgumentLiteral(arg1, 1)
                    ]
                };
            }

            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the distance between two geometries expressed as a field or as an object in GeoJSON format is equal to a specific value.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         * @param {number} distance Distance between two geometries.
         */
        PublicaMundi.Data.Query.prototype.distanceEqual = function (arg1, arg2, arg3) {
            var filter = {
                operator: operators.DISTANCE,
                arguments: [
                    getArgumentGeometry(arg1),
                    getArgumentGeometry(arg2),
                    operators.EQUAL,
                    getArgumentNumber(arg3)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the distance between two geometries expressed as a field or as an object in GeoJSON format is less or equal than a specific value.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         * @param {number} distance Distance between two geometries.
         */
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

        /**
         * Adds a filter that checks if the distance between two geometries expressed as a field or as an object in GeoJSON format is less than a specific value.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         * @param {number} distance Distance between two geometries.
         */
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

        /**
         * Adds a filter that checks if the distance between two geometries expressed as a field or as an object in GeoJSON format is greater or equal than a specific value.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         * @param {number} distance Distance between two geometries.
         */
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

        /**
         * Adds a filter that checks if the distance between two geometries expressed as a field or as an object in GeoJSON format is greater than a specific value.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         * @param {number} distance Distance between two geometries.
         */
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

        /**
         * Adds a filter that checks if the area of two geometries expressed as a field or as an object in GeoJSON format is equal.'
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
        PublicaMundi.Data.Query.prototype.areaEqual = function (arg1, arg2) {
            var filter = {
                operator: operators.AREA,
                arguments: [
                    getArgumentGeometry(arg1),
                    operators.EQUAL,
                    getArgumentNumber(arg2)
                ]
            };
            this.query.filters.push(filter);
            return this;
        };

        /**
         * Adds a filter that checks if the area of first geometry is less or equal than the area of the second geometry. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Adds a filter that checks if the area of first geometry is less than the area of the second geometry. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Adds a filter that checks if the area of first geometry is greater or equal than the area of the second geometry. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Adds a filter that checks if the area of first geometry is greater than the area of the second geometry. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Adds a filter that checks if the first geometry contains the second geometry. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Adds a filter that checks if two geometries intersect. Geometries are expressed as a field or as an object in GeoJSON format.
         * @function
         * @param {string|object} arg1 First field or geometry.
         * @param {string|object} arg2 Second field of geometry.
         */
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

        /**
         * Sorts the results
         * @name orderBy
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} name Field name.
         */

        /**
         * Sorts the results
         * @name orderBy
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} name Field name.
         * @param {boolean} desc Sorts the result in descending order.
         */

        /**
         * Sorts the results
         * @name orderBy
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} resource Field resource.
         * @param {string} name Field name.
         */

        /**
         * Sorts the results
         * @name orderBy
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {string} resource Field resource.
         * @param {string} name Field name.
         * @param {boolean} desc Sorts the result in descending order.
         */

        /**
         * Sorts the results
         * @name orderBy
         * @memberof module:PublicaMundi.Data.Query
         * @function
         * @instance
         * @param {object} options Sort field.
         * @param {string} [options.resource] Field resource.
         * @param {string} options.name Field name.
         * @param {string} [options.desc] Sorts the result in descending order.
         */

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

        /**
         * This callback executes when a request has completed successfully.
         * @callback module:PublicaMundi.Data.Query~setSuccessCallback
         * @param {object} response Response data.
         * @param {boolean} response.success True if query has executed successfully.
         * @param {string} response.message Error message. Empty if query execution was successful.
         * @param {object[]} [response.data] Query results (applicable only to {@link module:PublicaMundi.Data.Query#execute execute} requests).
         * @param {string} [response.code] Contains a link to the exported file (applicable only to {@link module:PublicaMundi.Data.Query#export export} requests).
         */

        /**
         * Sets the success callback for the query.
         * @function
         * @param {setSuccessCallback} callback - The {@link module:PublicaMundi.Data.Query~setSuccessCallback callback} that handles a successful response.
         */
        PublicaMundi.Data.Query.prototype.setSuccess = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.success = callback;
            }
            return this;
        };

        /**
         * This callback executes when a request has failed.
         * @callback module:PublicaMundi.Data.Query~setFailureCallback
         * @param {string} message Error message.
         */

        /**
         * Sets the failure callback for the query.
         * @function
         * @param {setFailureCallback} callback - The {@link module:PublicaMundi.Data.Query~setFailureCallback callback} that handles a failed request.
         */
        PublicaMundi.Data.Query.prototype.setFailure = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.failure = callback;
            }
            return this;
        };

        /**
         * This callback always executes after a request is completed.
         * @callback module:PublicaMundi.Data.Query~setCompleteCallback
         */

        /**
         * Sets a callback that executes after a request is completed.
         * @function
         * @param {setCompleteCallback} callback - The {@link module:PublicaMundi.Data.Query~setCompleteCallback callback} that handles a failed request.
         */
        PublicaMundi.Data.Query.prototype.setComplete = function (callback) {
            if (typeof callback === 'function') {
                this.callbacks.complete = callback;
            }
            return this;
        };

        /**
         * Resets a query and removes any resources, fields and filters.
         * @function
         */
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

        /**
         * Sets the response format. For query operations only {@link module:PublicaMundi.Data.Format.JSON JSON} and {@link module:PublicaMundi.Data.Format.GeoJSON GeoJSON} formats are supported.
         * @function
         * @param {string} format Response format. See {@link module:PublicaMundi.Data.Format PublicaMundi.Data.Format} for supported formats
         */
        PublicaMundi.Data.Query.prototype.format = function (format) {
            for (var prop in PublicaMundi.Data.Format) {
                if (PublicaMundi.Data.Format[prop] === format) {
                    this.request.format = format;
                    return this;
                }
            }

            throw new PublicaMundi.Data.SyntaxException('Format is not supported.');
        };

        /**
         * Sets the response CRS. The default CRS is  {@link module:PublicaMundi.Data.CRS.Mercator Mercator}.
         * @function
         * @param {string} format Response CRS. See {@link module:PublicaMundi.Data.CRS PublicaMundi.Data.CRS} for supported CRS codes.
         */
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

        /**
         * Executes a query.
         * @function
         * @param {object} options Execution options
         * @param {string} [options.success] Success {@link module:PublicaMundi.Data.Query~setSuccessCallback callback}.
         * @param {string} [options.failure] Failure {@link module:PublicaMundi.Data.Query~setFailureCallback callback}.
         * @param {string} [options.complete] Complete {@link module:PublicaMundi.Data.Query~setCompleteCallback callback}.
         */
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

        /**
         * Executes a query and exports data.
         * @function
         * @param {object} options Execution options
         * @param {string} [options.success] Success {@link module:PublicaMundi.Data.Query~setSuccessCallback callback}.
         * @param {string} [options.failure] Failure {@link module:PublicaMundi.Data.Query~setFailureCallback callback}.
         * @param {string} [options.complete] Complete {@link module:PublicaMundi.Data.Query~setCompleteCallback callback}.
         */
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

        /**
         * Sets the maximum number of rows returned.
         * @function
         * @param {number} value Maximum number of rows to return.
         */
        PublicaMundi.Data.Query.prototype.take = function (value) {
            if (isNaN(value)) {
                throw new PublicaMundi.Data.SyntaxException('Invalid number.');
            }
            this.query.limit = value;
            return this;
        };

        /**
         * Sets the number of rows to skip.
         * @function
         * @param {number} value Number of rows to skip.
         */
        PublicaMundi.Data.Query.prototype.skip = function (value) {
            if (isNaN(value)) {
                throw new PublicaMundi.Data.SyntaxException('Invalid number.');
            }
            this.query.offset = value;
            return this;
        };

        /**
         * This callback executes when {@link module:PublicaMundi.Data.Query#getResources getResources} has completed successfully.
         * @callback module:PublicaMundi.Data.Query~setGetResourcesSuccessCallback
         * @param {object} response Response data.
         * @param {boolean} response.success True if query has executed successfully.
         * @param {string} response.message Error message. Empty if query execution was successful.
         * @param {object} [response.resources] Dictionary of resource metadata with resource unique id values as keys.
         */

        /**
         * Returns metadata for all resources. Function {@link module:PublicaMundi.Data.Query#getResources getResources} returns metadata for all resources available in the catalog. The result may contains resources that are not visible in the MapClient application.
         * @function
         * @param {object} options Execution options
         * @param {string} [options.context] The value of this provided for the function call.
         * @param {string} [options.success] Success {@link module:PublicaMundi.Data.Query~setGetResourcesSuccessCallback callback}.
         * @param {string} [options.failure] Failure {@link module:PublicaMundi.Data.Query~setFailureCallback callback}.
         * @param {string} [options.complete] Complete {@link module:PublicaMundi.Data.Query~setCompleteCallback callback}.
         */
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

        /**
         * This callback executes when {@link module:PublicaMundi.Data.Query#describeResource describeResource} has completed successfully.
         * @callback module:PublicaMundi.Data.Query~setDescribeResourceSuccessCallback
         * @param {object} response Response data.
         * @param {boolean} response.success True if query has executed successfully.
         * @param {string} response.message Error message. Empty if query execution was successful.
         * @param {object} [response.resource] Resource schema information
         */

        /**
         * Returns the schema information of a resource.
         * @function
         * @param {object} options Execution options
         * @param {string} [options.context] The value of this provided for the function call.
         * @param {string} options.id Resource unique id.
         * @param {string} [options.success] Success {@link module:PublicaMundi.Data.Query~setDescribeResourceSuccessCallback callback}.
         * @param {string} [options.failure] Failure {@link module:PublicaMundi.Data.Query~setFailureCallback callback}.
         * @param {string} [options.complete] Complete {@link module:PublicaMundi.Data.Query~setCompleteCallback callback}.
         */
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
    };

    if((typeof define != 'undefined') && (define.amd)) {
        define(['jquery'], factory);
    } else {
        if(typeof PublicaMundi === 'undefined') {
            PublicaMundi = {
                __namespace: 'PublicaMundi'
            };
        }
        factory($, PublicaMundi);
    }
})();
