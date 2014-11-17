define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.GMLResource = PublicaMundi.Class(PublicaMundi.Maps.Resources.FileResource, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.type = PublicaMundi.Maps.Resources.File.Format.GML;
        }
    });

    PublicaMundi.Maps.Resources.Types.GML = PublicaMundi.Maps.Resources.Types.GML || 'GML';

    PublicaMundi.Maps.registerResource(PublicaMundi.Maps.Resources.Types.GML, 'GML', PublicaMundi.Maps.Resources.GMLResource, PublicaMundi.Maps.Resources.FileLayerBuilder);

    return PublicaMundi;

});