(function() {
    var factory = function (PublicaMundi, ZooProcess, wpsPayload) {
        "use strict";

        if(typeof PublicaMundi.Data.WPS === 'undefined') {
                /**
                 * Extends Data API with WPS support.
                 * @name WPS
                 * @namespace
                 * @memberof module:PublicaMundi.Data
                 */
                PublicaMundi.Data.WPS = {
                __namespace: 'PublicaMundi.Data.WPS'
            };
        }

        var processMappings = { };

        var getResultFromWPS = function(data) {
            return (data.ExecuteResponse.ProcessOutputs ? data.ExecuteResponse.ProcessOutputs.Output.Reference._href : null);
        };

        var getErrorFromWPS = function(data) {
            if((data.ExecuteResponse) && (data.ExecuteResponse.Status) && (data.ExecuteResponse.Status.ProcessFailed)) {
                return data.ExecuteResponse.Status.ProcessFailed.ExceptionReport.Exception.ExceptionText.__text;
            }
            return null;
        };

        /**
         * Sets configuration options for WPS support. Since every WPS service supports an arbitary collection of operations, Data API must be configured with additional metadata for calling an operation. Still WPS services can be called directly using the ZOO client.
         * <br/><br/>
         * Declaring an operation using mappings automatically creates a new method named after the key in the mappings dictionary and the prefix <code class="highlight">process</code>. The following example declares the method <code class="highlight">processBuffer</code>.
         * @function
         * @memberof module:PublicaMundi.Data.WPS
         * @param {object} options Configuration options.
         * @param {string} options.endpoint WPS service endpoint.
         * @param {boolean} [options.corsEnabled=false] Indicates if CORS is supported by the WPS service.
         * @param {string} [options.proxy] Proxy service endpoint for executing requests when CORS is not enabled.
         * @param {number} [options.delay=2000] The time (in milliseconds) between each polling requests.
         * @param {object} [options.mappings] Dictionary of mappings for WPS operations.
         * @example
         *
         *   API.Data.WPS.configure({
         *      endpoint: 'http://zoo.dev.publicamundi.eu/cgi-bin/zoo_loader.cgi',
         *      delay: 2500,
         *      mappings : {
         *          'Buffer': {
         *              id: 'ogr.Buffer',
         *              params: [{
         *                  name: 'InputPolygon',
         *                  type: 'complex',
         *                  mimeType: 'text/xml'
         *              }, {
         *                  name :'BufferDistance',
         *                  type: 'literal'
         *              }],
         *              result: 'Result'
         *          }
         *      }
         *  });
         *
         */
        PublicaMundi.Data.WPS.configure = function(options) {
            console.log(options);
            PublicaMundi.Data.configure({
                wps: {
                    endpoint: options.endpoint,
                    corsEnabled: options.corsEnabled,
                    proxy: options.proxy,
                    delay: options.delay || 2000
                }
            });

            var mappings = options.mappings || {};

            for(var prop in processMappings) {
                if(PublicaMundi.Data.Query.prototype.hasOwnProperty('process' + prop)) {
                    delete PublicaMundi.Data.Query.prototype['process' + prop];
                }
            }

            processMappings = mappings;

            for(var prop in processMappings) {
                (function(op, name, process) {
                    PublicaMundi.Data.Query.prototype[name] = function() {
                        if(this.request.queue.length > 1) {
                            throw new PublicaMundi.Data.SyntaxException('WPS operations can be applied only to requests with a single query.');
                        }

                        if(!this.request.processes) {
                            this.request.processes = [];
                        }
                        if ((process.params) && ((process.params.length-1) != arguments.length)) {
                            throw new PublicaMundi.Data.SyntaxException('Function '  +
                                                                        name +
                                                                        ' expects '  +
                                                                        (process.params.length - 1) +
                                                                        ' parameter(s). Only ' +
                                                                        arguments.length +
                                                                        ' specified.');
                        }

                        this.request.processes.push({
                            name: op,
                            id: process.id,
                            args: arguments
                        });

                        return this;
                    }
                })(prop, 'process' + prop, processMappings[prop]);
            }
        };

        var fn_queue = PublicaMundi.Data.Query.prototype.queue;

        PublicaMundi.Data.Query.prototype.queue = function () {
            if((this.request.processes) && (this.request.processes.length > 0) && (this.request.queue.length > 0)) {
                throw new PublicaMundi.Data.SyntaxException('WPS operations can be applied only to requests with a single query.');
            }
            return fn_queue.call(this);
        };

        PublicaMundi.Data.Query.prototype.wps = function (options) {
            if((!this.request.processes) || (this.request.processes.length == 0)) {
                return this.execute(options);
            }

            var configuration = PublicaMundi.Data.getConfiguration();
            var debug = configuration.debug;

            options = options || {};

            options.success = options.success || this.callbacks.success;
            options.failure = options.failure || this.callbacks.failure;
            options.complete = options.complete || this.callbacks.complete;

            var execution = {
                size : null,
                start : (new Date()).getTime(),
                end : null
            };

            var processes = [].concat(this.request.processes).reverse();
            var processIndex = 0;

            var endpoint = (configuration.wps.corsEnabled ? configuration.wps.endpoint : configuration.wps.proxy + configuration.wps.endpoint);

            var myZooObject = new ZooProcess({
                url: endpoint,
                delay: (configuration.wps.delay ? configuration.wps.delay : 2000),
            });

            var queryCallback = function(data, execution) {
                if(data.success) {
                    var url = this.endpoint + 'api/download/' + data.code;
                    // When debugging fetch data to the client
                    if(debug) {
                        $.ajax({
                            method: 'GET',
                            url: url
                        }).done(initProcessingCallback).fail(function() {
                            execution.end = (new Date()).getTime();

                            if (typeof options.failure === 'function') {
                                options.failure.call( options.context || this, 'Failed to download file from [' + url + '].', execution);
                            }

                            if (typeof options.complete === 'function') {
                                options.complete.call( options.context || this);
                            }
                        });
                    } else {
                        // Send the link to the WPS server
                        initProcessingCallback(url);
                    }
                } else {
                    execution.end = (new Date()).getTime();

                    if (typeof options.success === 'function') {
                        options.success.call( options.context || this, data, execution);
                    }

                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }
                }
            };

            var initProcessingCallback = function(data) {
                var process = processes.pop();
                processIndex++;

                var dataInputs = [];
                var dataOutputs = [];

                var metadata = processMappings[process.name];

                if($.isXMLDoc(data)) {
                    data = (new XMLSerializer()).serializeToString(data);
                }
                if(debug) {
                    var doctype = '<?xml version="1.0" encoding="utf-8" ?>';
                    data = data.substr(doctype.length);
                }

                for(var i=0; i < metadata.params.length; i++) {
                    var input = {
                        'identifier': metadata.params[i].name
                    };
                    switch(metadata.params[i].type) {
                        case 'complex':
                            if(debug) {
                                input.value = (i == 0 ? data : process.args[i-1]);
                            } else if(i==0) {
                                input.href = data;
                            } else {
                                input.value = process.args[i-1];
                            }
                            break;
                        case 'literal':
                            input.value = (i == 0 ? data : process.args[i-1]);
                            break;
                        default:
                            throw new PublicaMundi.Data.SyntaxException('Parameter type [' + metadata.params[i].type + '] is not supported.');
                    }
                    if(metadata.params[i].mimeType) {
                        input.mimeType = metadata.params[i].mimeType
                    }

                    dataInputs.push(input);
                }

                if(processes.length == 0) {
                    dataOutputs.push({'identifier': metadata.result,'mimeType':'application/json','type':'raw'});
                } else {
                    dataOutputs.push({'identifier': metadata.result,'mimeType':'application/json','asReference':true});
                }

                if(debug) {
                    console.log(dataInputs);
                    console.log(dataOutputs);
                }

                myZooObject.execute({
                    identifier: process.id,
                    dataInputs: dataInputs,
                    dataOutputs: dataOutputs,
                    type: 'POST',
                    success: (processes.length == 0 ? resultCallback : processCallback),
                    error: function(data){
                        var message = getErrorFromWPS(data) || 'Unhandled exception has occured. Execution of process [' + process.id + '] has failed. Process index is [' + processIndex + ']';

                        execution.end = (new Date()).getTime();

                        if (typeof options.failure === 'function') {
                            options.failure.call(
                                options.context || this,
                                message,
                                execution
                            );
                        } else if(debug) {
                            console.log(message);
                        }

                        if (typeof options.complete === 'function') {
                            options.complete.call( options.context || this);
                        }
                    }
                });
            };

            var processCallback = function(data) {
                var process = processes.pop();
                processIndex++;

                var dataInputs = [];
                var dataOutputs = [];

                var metadata = processMappings[process.name];

                var href = getResultFromWPS(data);
                if(!href) {
                    var message = getErrorFromWPS(data) || 'Can not execute process [' + process.id + ']. Failed to get response from previous process. Process index is [' + processIndex + ']';

                    execution.end = (new Date()).getTime();

                    if (typeof options.failure === 'function') {
                        options.failure.call(
                            options.context || this,
                            message,
                            execution
                        );
                    } else if(debug) {
                        console.log(message);
                    }

                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }

                    return;
                }
                var input = {
                    'identifier': metadata.params[0].name,
                    'href': href,
                    'mimeType': 'application/json'
                };

                if(metadata.params.mimeType) {
                    input.mimeType = metadata.params.mimeType
                }

                dataInputs.push(input);

                for(var i=1; i < metadata.params.length; i++) {
                    var input = {
                        'identifier': metadata.params[i].name
                    };
                    switch(metadata.params[i].type) {
                        case 'complex':
                            input.value = process.args[i-1];
                            break;
                        case 'literal':
                            input.value = process.args[i-1];
                            break;
                        default:
                            throw new PublicaMundi.Data.SyntaxException('Parameter type [' + metadata.params[i].type + '] is not supported.');
                    }
                    if(metadata.params[i].mimeType) {
                        input.mimeType = metadata.params[i].mimeType
                    }

                    dataInputs.push(input);
                }

                if(processes.length == 0) {
                    dataOutputs.push({'identifier': metadata.result,'mimeType':'application/json','type':'raw'});
                } else {
                    dataOutputs.push({'identifier': metadata.result,'mimeType':'application/json','asReference':true});
                }

                if(debug) {
                    console.log(dataInputs);
                    console.log(dataOutputs);
                }

                myZooObject.execute({
                    identifier: process.id,
                    dataInputs: dataInputs,
                    dataOutputs: dataOutputs,
                    type: 'POST',
                    success: (processes.length == 0 ? resultCallback : processCallback),
                    error: function(data){
                        var message = getErrorFromWPS(data) || 'Unhandled exception has occured. Execution of process [' + process.id + '] has failed. Process index is [' + processIndex + ']';

                        execution.end = (new Date()).getTime();

                        if (typeof options.failure === 'function') {
                            options.failure.call(
                                options.context || this,
                                message,
                                execution
                            );
                        } else if(debug) {
                            console.log(message);
                        }

                        if (typeof options.complete === 'function') {
                            options.complete.call( options.context || this);
                        }
                    }
                });
            };

            var resultCallback = function(data) {
                execution.end = (new Date()).getTime();

                if (typeof options.success === 'function') {
                    options.success.call( options.context || this, {
                        success: true,
                        data: [ data ],
                        message: null
                    }, execution);
                }

                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            };

            $.ajax({
                type: "POST",
                url: this.endpoint + 'api/wps',
                context: this,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(this.request)
            }).done(function (data, textStatus, jqXHR) {
                execution.end = (new Date()).getTime();

                queryCallback.call( options.context || this, data, execution);
            }).fail(function(jqXHR, textStatus, errorThrown) {
                execution.end = (new Date()).getTime();
                if (typeof options.failure === 'function') {
                    options.failure.call( options.context || this, (errorThrown ? errorThrown : textStatus), execution);
                }
                if (typeof options.complete === 'function') {
                    options.complete.call( options.context || this);
                }
            });

            return this;
        };

        PublicaMundi.Data.Query.prototype.getProcesses = function (options) {
            var configuration = PublicaMundi.Data.getConfiguration();

            var endpoint = (configuration.wps.corsEnabled ? configuration.wps.endpoint : configuration.wps.proxy + configuration.wps.endpoint);

            var myZooObject = new ZooProcess({
                url: endpoint,
                delay: (configuration.wps.delay ? configuration.wps.delay : 2000),
            });

            myZooObject.getCapabilities({
               type: 'POST',
                success: function(data){
                    if (typeof options.success === 'function') {
                        options.success.call( options.context || this, data);
                    }
                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }
                },
                error: function(data) {
                    if (typeof options.failure === 'function') {
                        options.failure.call( options.context || this, data);
                    }
                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }
                }
            });

            return this;
        };

        PublicaMundi.Data.Query.prototype.describeProcess = function (options) {
            var configuration = PublicaMundi.Data.getConfiguration();

            var endpoint = (configuration.wps.corsEnabled ? configuration.wps.endpoint : configuration.wps.proxy + configuration.wps.endpoint);

            var myZooObject = new ZooProcess({
                url: endpoint,
                delay: (configuration.wps.delay ? configuration.wps.delay : 2000),
            });

            myZooObject.describeProcess({
                type: 'POST',
                identifier: options.id || 'all',
                success: function(data){
                    if (typeof options.success === 'function') {
                        options.success.call( options.context || this, data);
                    }
                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }
                },
                error: function(data){
                    if (typeof options.failure === 'function') {
                        options.failure.call( options.context || this, data);
                    }
                    if (typeof options.complete === 'function') {
                        options.complete.call( options.context || this);
                    }
                }
            });
        };

        return PublicaMundi;
    };

    if((define) && (define.amd)) {
        define(['data_api', 'zoo', 'wpsPayload'], factory);
    } else {
        factory(PublicaMundi, ZooProcess, wpsPayload);
    }
})();
