var config = {
    enforceDefine: false,
    waitSeconds: 30,
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
		bootstrap: [
			'lib/bootstrap/current/bootstrap.min'
		],
		bootstrap_select: [
			'lib/bootstrap-select/bootstrap-select.min'
		],
        ol: [
            'lib/ol3/ol.3.5.0'
        ],
        URIjs: 'lib/uri',
        app: 'app/app',
        controls: 'app/controls',
        shared: 'app/shared',
        wms: 'app/wms',
        file: 'app/file',
        proj4: 'lib/proj4js/proj4',
        ckan: 'app/ckan',
        api: 'api/data',
        typeahead : 'lib/typeahead/typeahead.jquery.min',
        bloodhound: 'lib/typeahead/bloodhound.min',
        handlebars: 'lib/handlebars/handlebars-v3.0.3',
        fileupload: 'lib/fileupload/jquery.fileupload',
        iframetransport: 'lib/fileupload/jquery.iframe-transport',
        locale_en: 'i18n/en/strings',
        locale_el: 'i18n/el/strings'
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
				'handlebars'
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
                'api',
                'fileupload'
            ]
        },
        wms: {
            deps: [
                'shared'
            ]
        },
        file: {
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
};

requirejs.config(config);

var scriptCounter = 0;
var scriptTotal = 4;

var scripts = [];
for(var s in config.shim) {
	if(scripts.indexOf(s) === -1) {
		scripts.push(s);
		scriptTotal++;
		
		for(var i=0, count = config.shim[s].deps.length; i < count; i++) {
			if(scripts.indexOf(config.shim[s].deps[i]) === -1) {
				scripts.push(config.shim[s].deps[i]);
				scriptTotal++;
			}
		}
	}
}

requirejs.onResourceLoad = function (context, map, depArray) {
	scriptCounter++;
	document.getElementById("loading-text").innerHTML = 'Loading Scripts ... ' + (100 * (scriptCounter) / scriptTotal).toFixed(0) + '%'
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

