define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.KMLResource = PublicaMundi.Class(PublicaMundi.Maps.Resources.FileResource, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.type = PublicaMundi.Maps.Resources.File.Format.KML;
        }
    });

    PublicaMundi.Maps.Resources.Types.KML = PublicaMundi.Maps.Resources.Types.KML || 'KML';

    PublicaMundi.Maps.registerResource(PublicaMundi.Maps.Resources.Types.KML, 'KML', PublicaMundi.Maps.Resources.KMLResource, PublicaMundi.Maps.Resources.FileLayerBuilder);

    return PublicaMundi;

});