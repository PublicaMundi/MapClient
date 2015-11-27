{
    appDir: '../mapclient/public/content/js',
    baseUrl: './',
    dir: '../mapclient/public/content/jsmin',
    modules: [
        {
            name: 'client-main-mobile.min',
            create: false
        }
    ],
    findNestedDependencies: true,
    fileExclusionRegExp: /^(r|build)\.js$/,
    optimizeCss: 'standard',
    removeCombined: false,
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
