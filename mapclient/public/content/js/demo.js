requirejs.config({
    enforceDefine: false,
    // Disable caching
    urlArgs: "v=" + (new Date()).getTime(),
    paths: {
		promise: [
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
		api: 'api/data',
		queries: 'demo/data-api-queries',
        app: 'demo/data-api'
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
                'api',
                'queries'
            ]
        },
        queries: {
            deps: [
				'api'
            ]
        },
        api: {
            deps: [
				'jquery',
                'shared'
            ]
        }
	}
});

define(['module'], function (module) {
    "use strict";

    require(['jquery', 'app'], function ($, PublicaMundi) {
        $(function () {
            window.PublicaMundi = PublicaMundi;
        });
    });
});

