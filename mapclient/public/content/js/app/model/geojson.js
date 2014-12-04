define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.GeoJsonMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.FileMetadataReader, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.type = PublicaMundi.Maps.Resources.File.Format.GeoJSON;
        }
    });

    PublicaMundi.Maps.Resources.Types.GeoJSON = PublicaMundi.Maps.Resources.Types.GeoJSON || 'GeoJSON';

    PublicaMundi.Maps.registerResourceType(PublicaMundi.Maps.Resources.Types.GeoJSON, 'GeoJSON', PublicaMundi.Maps.Resources.GeoJsonMetadataReader, PublicaMundi.Maps.Resources.FileLayerFactory);

    return PublicaMundi;

});