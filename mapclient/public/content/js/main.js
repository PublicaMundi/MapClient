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
		bootstrap: [
			'lib/bootstrap/current/bootstrap.min'
		],
		bootstrap_select: [
			'lib/bootstrap-select/bootstrap-select.min'
		],
        ol: [
            'lib/ol3/ol.3.4.0'
        ],
        URIjs: 'lib/uri',
        app: 'app/app',
        controls: 'app/controls',
        shared: 'app/shared',
        wms: 'app/wms',
        proj4: 'lib/proj4js/proj4',
        ckan: 'app/ckan',
        api: 'api/data'
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
		fuelux: {
			deps : ['jquery'] 
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
                'shared'
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
                'ckan',
                'controls',                
                'wms',
                'api'
            ]
        },
        wms: {
            deps: [
                'shared'
            ]
        },
        api: {
            deps: [
                'shared'
            ]
        }
	}
});

var scriptCounter = 0;

requirejs.onResourceLoad = function (context, map, depArray) {
	if(typeof $ !== 'undefined') {
		scriptCounter++;
		$('#loading-text').html('Loading Scripts ... ' + (100 * scriptCounter / 10).toFixed(0) + '%');
	}
};

define(['module'], function (module) {
    "use strict";

    require(['jquery', 'app'], function ($, PublicaMundi) {
        $(function () {
            // Add code for application initialization here
            PublicaMundi.initialize();

            window.PublicaMundi = PublicaMundi;
        });
    });
});

