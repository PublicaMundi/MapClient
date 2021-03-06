﻿var config = {
    enforceDefine: false,
    waitSeconds: 30,
    //urlArgs: "v=" + (new Date()).getTime(),
    paths: {
		promise: 'lib/promise/promise-6.1.0.min',
        jquery: 'lib/jquery/jquery-2.1.3.min',
        jqueryui: 'lib/jquery-ui/jquery-ui.1.11.4.min',
        jqueryui_touch_punch: 'lib/jquery-ui.touch-punch/jquery.ui.touch-punch.min',
		bootstrap: 'lib/bootstrap/bootstrap.min',
		bootstrap_select: 'lib/bootstrap-select/bootstrap-select.min',
        ol: 'lib/ol3/ol.3.5.0',
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
        jqueryui: {
            deps: ['jquery']
        },
		bootstrap : {
			deps : ['jquery']
		},
		bootstrap_select : {
			deps : ['bootstrap', 'jquery']
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
        typeahead: {
            deps: [
                'jquery',
                'bloodhound'
            ]
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
};

requirejs.config(config);

var initialization = {
    scriptCounter : 0,
    scriptTotal : 6,
    scripts : []
};

for(var s in config.shim) {
	if(initialization.scripts.indexOf(s) === -1) {
		initialization.scripts.push(s);
		initialization.scriptTotal++;

        if(config.shim[s].deps) {
            for(var i=0, count = config.shim[s].deps.length; i < count; i++) {
                if(initialization.scripts.indexOf(config.shim[s].deps[i]) === -1) {
                    initialization.scripts.push(config.shim[s].deps[i]);
                    initialization.scriptTotal++;
                }
            }
        }
	}
}

requirejs.onResourceLoad = function (context, map, depArray) {
	initialization.scriptCounter++;
	document.getElementById("loading-text").innerHTML = 'Loading Scripts ... ' + (100 * (initialization.scriptCounter) / initialization.scriptTotal).toFixed(0) + '%'
};

require(['app', 
         'jquery', 
         'promise', 
         'jqueryui',
         'jqueryui_touch_punch',
         'bootstrap', 
         'bootstrap_select', 
         'iframetransport', 
         'fileupload', 
         'bloodhound', 
         'typeahead',
         'handlebars',
         'controls',
         'ckan',
         'wms', 
         'file', 
         'data_api', 
         'xml2json'], function (PublicaMundi, $) {
    $(function () {
        // Add code for application initialization here
        PublicaMundi.initialize();
    });
});
