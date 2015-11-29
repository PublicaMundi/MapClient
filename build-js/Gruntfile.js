module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        clean: {
            options: {
                force: true
            },
            mapclient: {
                src: ['../mapclient/public/content/js/app/*.min.js', '../mapclient/public/content/js/shared/*.min.js']
            }
        },
        jshint: {
            options: {
                reporter: require('jshint-stylish')
            },
            mapclient: ['../mapclient/public/content/js/app/*.js', '../mapclient/public/content/js/shared/*.js']
        },
        uglify: {
            options: {
                banner: '/* <%= pkg.description %> version <%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                sourceMap: true
            },
            mapclient: {
                files: {
                    '../mapclient/public/content/js/app/client.min.js': ['../mapclient/public/content/js/app/client.js'],
                    '../mapclient/public/content/js/app/controls.min.js': ['../mapclient/public/content/js/app/controls.js'],
                    '../mapclient/public/content/js/app/ckan.min.js': ['../mapclient/public/content/js/app/ckan.js'],
                    '../mapclient/public/content/js/app/wms.min.js': ['../mapclient/public/content/js/app/client.js'],
                    '../mapclient/public/content/js/app/file.min.js': ['../mapclient/public/content/js/app/file.js'],
                    '../mapclient/public/content/js/shared/shared.min.js': ['../mapclient/public/content/js/shared/shared.js']
                }
            }
        },
        requirejs: {
            mapclient: {
                options: {
                    appDir: '../mapclient/public/content/js',
                    baseUrl: './',
                    dir: '../mapclient/public/content/jsmin',
                    modules: [
                        {
                            name: 'client-main',
                            create: false
                        }
                    ],
                    findNestedDependencies: true,
                    fileExclusionRegExp: /^(r|build|client-main-mobile)\.js$/,
                    optimizeCss: 'standard',
                    removeCombined: false,
                    keepBuildDir: true,
                    paths: {
                        promise: 'lib/promise/promise-6.1.0.min',
                        jquery: 'lib/jquery/jquery-2.1.3.min',
                        jqueryui: 'lib/jquery-ui/jquery-ui.1.11.4.min',
                        bootstrap: 'lib/bootstrap/bootstrap.min',
                        bootstrap_select: 'lib/bootstrap-select/bootstrap-select.min',
                        ol: 'empty:',
                        URIjs: 'lib/uri',
                        app: 'app/client',
                        controls: 'app/controls',
                        shared: 'shared/shared',
                        wms: 'app/wms',
                        file: 'app/file',
                        proj4: 'lib/proj4js/proj4',
                        ckan: 'app/ckan',
                        data_api: 'lib/data-api/data',
                        data_api_wps: 'lib/data-api/extensions/wps',
                        typeahead : 'lib/typeahead/typeahead.jquery.min',
                        bloodhound: 'lib/typeahead/bloodhound.min',
                        handlebars: 'lib/handlebars/handlebars-v3.0.3',
                        fileupload: 'lib/fileupload/jquery.fileupload',
                        iframetransport: 'lib/fileupload/jquery.iframe-transport',
                        locale_en: 'i18n/en/strings',
                        locale_el: 'i18n/el/strings',
                        xml2json: 'lib/x2js/xml2json.min'
                    },
                    shim: {
                        jquery: {
                            deps : ['promise']
                        },
                        bootstrap : {
                            deps : ['jquery']
                        },
                        bootstrap_select : {
                            deps : ['bootstrap', 'jquery']
                        },
                        typeahead: {
                            deps: [
                                'jquery',
                                'bloodhound'
                            ]
                        },
                        iframetransport: {
                            deps: [
                                'jquery'
                            ]
                        },
                        fileupload: {
                            deps: [
                                'jqueryui',
                                'iframetransport'
                            ]
                        },
                        jqueryui: {
                            deps: ['jquery']
                        },
                        ol: {
                            deps: ['proj4']
                        },
                        ckan: {
                            deps: [
                                'jquery',
                                'URIjs/URI',
                                'shared'
                            ]
                        },
                        shared: {
                            deps: [
                                'jquery',
                                'URIjs/URI',
                            ]
                        },
                        controls: {
                            deps: [
                                'shared',
                                'typeahead',
                                'handlebars',
                                'data_api'
                            ]
                        },
                        app: {
                            deps: [
                                'jquery',
                                'bootstrap',
                                'bootstrap_select',
                                'jqueryui',
                                'proj4',
                                'ol',
                                'URIjs/URI',
                                'shared',
                                'ckan',
                                'controls',
                                'wms',
                                'file',
                                'data_api',
                                'fileupload'
                            ]
                        },
                        wms: {
                            deps: [
                                'shared',
                                'xml2json'
                            ]
                        },
                        file: {
                            deps: [
                                'shared'
                            ]
                        },
                        xml2json: {
                          exports: "X2JS",
                        }
                    }
                }
            },
            mapclient_mobile: {
                options: {
                    appDir: '../mapclient/public/content/js',
                    baseUrl: './',
                    dir: '../mapclient/public/content/jsmin',
                    modules: [
                        {
                            name: 'client-main-mobile',
                            create: false
                        }
                    ],
                    findNestedDependencies: true,
                    fileExclusionRegExp: /^(r|build|client-main)\.js$/,
                    optimizeCss: 'standard',
                    removeCombined: false,
                    keepBuildDir: true,
                    paths: {
                        promise: 'lib/promise/promise-6.1.0.min',
                        jquery: 'lib/jquery/jquery-2.1.3.min',
                        jqueryui: 'lib/jquery-ui/jquery-ui.1.11.4.min',
                        jqueryui_touch_punch: 'lib/jquery-ui.touch-punch/jquery.ui.touch-punch.min',
                        bootstrap: 'lib/bootstrap/bootstrap.min',
                        bootstrap_select: 'lib/bootstrap-select/bootstrap-select.min',
                        ol: 'empty:',
                        URIjs: 'lib/uri',
                        app: 'app/client',
                        controls: 'app/controls',
                        shared: 'shared/shared',
                        wms: 'app/wms',
                        file: 'app/file',
                        proj4: 'lib/proj4js/proj4',
                        ckan: 'app/ckan',
                        data_api: 'lib/data-api/data',
                        data_api_wps: 'lib/data-api/extensions/wps',
                        typeahead : 'lib/typeahead/typeahead.jquery.min',
                        bloodhound: 'lib/typeahead/bloodhound.min',
                        handlebars: 'lib/handlebars/handlebars-v3.0.3',
                        fileupload: 'lib/fileupload/jquery.fileupload',
                        iframetransport: 'lib/fileupload/jquery.iframe-transport',
                        locale_en: 'i18n/en/strings',
                        locale_el: 'i18n/el/strings',
                        xml2json: 'lib/x2js/xml2json.min'
                    },
                    shim: {
                        jquery: {
                            deps : ['promise']
                        },
                        bootstrap : {
                            deps : ['jquery']
                        },
                        bootstrap_select : {
                            deps : ['bootstrap', 'jquery']
                        },
                        typeahead: {
                            deps: [
                                'jquery',
                                'bloodhound'
                            ]
                        },
                        iframetransport: {
                            deps: [
                                'jquery'
                            ]
                        },
                        fileupload: {
                            deps: [
                                'jqueryui',
                                'iframetransport'
                            ]
                        },
                        jqueryui: {
                            deps: ['jquery']
                        },
                        ol: {
                            deps: ['proj4']
                        },
                        ckan: {
                            deps: [
                                'jquery',
                                'URIjs/URI',
                                'shared'
                            ]
                        },
                        shared: {
                            deps: [
                                'jquery',
                                'URIjs/URI',
                            ]
                        },
                        controls: {
                            deps: [
                                'shared',
                                'typeahead',
                                'handlebars',
                                'data_api'
                            ]
                        },
                        app: {
                            deps: [
                                'jquery',
                                'bootstrap',
                                'bootstrap_select',
                                'jqueryui',
                                'jqueryui_touch_punch',
                                'proj4',
                                'ol',
                                'URIjs/URI',
                                'shared',
                                'ckan',
                                'controls',
                                'wms',
                                'file',
                                'data_api',
                                'fileupload'
                            ]
                        },
                        wms: {
                            deps: [
                                'shared',
                                'xml2json'
                            ]
                        },
                        file: {
                            deps: [
                                'shared'
                            ]
                        },
                        xml2json: {
                          exports: "X2JS",
                        },
                        jqueryui_touch_punch: {
                            deps: ['jqueryui']
                        }
                    }
                }

            }
        }
    });

    // Load the plugins
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-requirejs');

    // Default task(s).
    grunt.registerTask('default', ['clean', 'jshint', 'uglify', 'requirejs']);

};
