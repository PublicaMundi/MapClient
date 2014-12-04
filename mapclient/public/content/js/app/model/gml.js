define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.GmlMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.FileMetadataReader, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.type = PublicaMundi.Maps.Resources.File.Format.GML;
        }
    });

    PublicaMundi.Maps.Resources.Types.GML = PublicaMundi.Maps.Resources.Types.GML || 'GML';

    PublicaMundi.Maps.registerResourceType(PublicaMundi.Maps.Resources.Types.GML, 'GML', PublicaMundi.Maps.Resources.GmlMetadataReader, PublicaMundi.Maps.Resources.FileLayerFactory);

    return PublicaMundi;

});