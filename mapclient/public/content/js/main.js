requirejs.config({
    enforceDefine: true,
    // Disable caching...
    urlArgs: "v=" + (new Date()).getTime(),
    paths: {
        jquery: [
            //'//code.jquery.com/jquery-2.1.1.min',
            'lib/jquery/jquery-2.1.1.min'
        ],
        jqueryui: [
            //'//code.jquery.com/ui/1.11.2/jquery-ui.min',
            'lib/jquery-ui/jquery-ui.min'
        ],
        jquerymobile: [
            //'//code.jquery.com/mobile/1.4.5/jquery.mobile-1.4.5.min',
            'lib/jquery-mobile/jquery.mobile-1.4.5'
        ],
        ol: [
            'lib/ol3/ol'
        ],
        URIjs: 'lib/uri',
        x2js: 'lib/x2js/xml2json',
        app: 'app/app',
        shared: 'app/shared',
        wms: 'app/model/wms',
        'wms-ui': 'app/view/wms',
        wfs: 'app/model/wfs',
        'wfs-ui': 'app/view/wfs',
        file: 'app/model/file',
        'file-ui': 'app/view/file',
        geojson: 'app/model/geojson',
        gml: 'app/model/gml',
        kml: 'app/model/kml',
        proj4: 'lib/proj4js/proj4',
        config: 'app/view/config',
        ckan: 'app/ckan'
    },
    shim: {
        jqueryui: {
            deps: ['jquery']
        },
        jquerymobile: {
            deps: ['jquery']
        },
        ol: {
            deps: [
                'proj4'
            ],
            exports: 'ol'
        },
        x2js: {
            exports: "X2JS",
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
        app: {
            deps: [
                'jquery',
                'jquerymobile',
                'proj4',
                'ol',
                'URIjs/URI',
                'x2js',
                'ckan',
                'wms',
                'wms-ui',
                'wfs',
                'wfs-ui',
                'file',
                'file-ui',
                'geojson',
                'gml',
                'kml',
            ]
        },
        wms: {
            deps: [
                'shared'
            ]
        },
        config: {
            deps: [
                'shared'
            ]
        },
        'wms-ui': {
            deps: [
                'shared', 'wms', 'config'
            ]
        },
        wfs: {
            deps: [
                'shared'
            ]
        },
        'wfs-ui': {
            deps: [
                'shared', 'wfs', 'config'
            ]
        },
        file: {
            deps: [
                'shared'
            ]
        },
        geojson: {
            deps: [
                'shared',
                'file'
            ]
        },
        gml: {
            deps: [
                'shared',
                'file'
            ]
        },
        kml: {
            deps: [
                'shared',
                'file'
            ]
        },
        'file-ui': {
            deps: [
            'shared', 'file', 'config'
            ]
        }
    }
});

requirejs.onResourceLoad = function (context, map, depArray) {
    //console.log(map.name + ' : ' + map.url);
};

define(['module'], function (module) {
    "use strict";

    require(['jquery'], function ($) {
        $(document).on("mobileinit", function () {
            // Add code for jQuery mobile initialization here ...

            // $.mobile.ignoreContentEnabled = true;
        });

        $(document).on('pageinit', function () {
            // Add code for main page initialization here ...
        });
    });

    require(['jquery', 'app'], function ($, PublicaMundi) {
        $(function () {
            // Add code for application initialization here
            PublicaMundi.initialize();

            window.PublicaMundi = PublicaMundi;
        });
    });
});

