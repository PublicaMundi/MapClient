requirejs.config({
    enforceDefine: false,
    // Disable caching
    urlArgs: "v=" + (new Date()).getTime(),
    paths: {
		promise: [
			'lib/promise/promise-6.1.0.min',
			'https://www.promisejs.org/polyfills/promise-6.1.0.min'
		],
        jquery: [
            'lib/jquery/jquery-2.1.3.min'
        ],
        jqueryui: [
            'lib/jquery-ui/jquery-ui.1.11.4.min'
        ],
        proj4: 'lib/proj4js/proj4',
        ol: [
            'lib/ol3/ol.3.4.0'
        ],
        URIjs: 'lib/uri',
        shared: 'app/shared',
		data_api: 'lib/data-api/data',
        data_api_wps: 'lib/data-api/extensions/wps',
		queries: 'demo/data-api-queries',
        app: 'demo/app',
        // WPS support
        hogan: 'lib/hogan/hogan-3.0.2.min',
        xml2json: 'lib/x2js/xml2json.min',
        queryString: 'lib/query-string/query-string',
        wpsPayloads: 'lib/zoo-client/payloads',
        wpsPayload: 'lib/zoo-client/wps-payload',
        utils: 'lib/zoo-client/utils',
        zoo: 'lib/zoo-client/zoo'
    },
    shim: {
		jquery: {
			deps : ['promise']
		},
        jqueryui: {
            deps: ['jquery']
        },
        ol: {
            deps: [
                'proj4'
            ],
            exports: 'ol'
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
                'jqueryui',                
                'proj4',
                'ol',
                'URIjs/URI',
                'data_api',
                'data_api_wps',
                'queries'
            ]
        },
        queries: {
            deps: [
				'data_api'
            ]
        },
        data_api: {
            deps: [
                'shared'
            ]
        },
        data_api_wps: {
            deps: [
                'data_api',
                'zoo',
                'wpsPayload'
            ]
        },
        wpsPayloads: {
            deps: ['hogan'],
        },
        wpsPayload: {
            deps: ['wpsPayloads'],
            exports: 'wpsPayload',
        },
        hogan: {
            exports: 'Hogan',
        },
        xml2json: {
          exports: "X2JS",
        },
        queryString: {
            exports: 'queryString',
        }
	}
});

define(function () {
    "use strict";

    require(['jquery', 'app'], function ($, PublicaMundi) {
        $(function () {
            window.PublicaMundi = PublicaMundi;
        });
    });
});

