define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.KmlMetadataReader = PublicaMundi.Class(PublicaMundi.Maps.Resources.FileMetadataReader, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.type = PublicaMundi.Maps.Resources.File.Format.KML;
        }
    });

    PublicaMundi.Maps.Resources.KmlCkanResourceMetadataReaderAdapter = PublicaMundi.Class(PublicaMundi.Maps.Resources.CkanResourceMetadataReaderAdapter, {
        initialize: function (options) {
            PublicaMundi.extend(this.values, options);
        },
        getOptions: function (resource) {
            if ((resource.format) && (resource.format.toUpperCase() === 'KML')) {
                return {
                    type: PublicaMundi.Maps.Resources.Types.KML,
                    title: resource.name,
                    url: resource.url,
                    format: PublicaMundi.Maps.Resources.File.Format.KML,
                    projection: PublicaMundi.Maps.CRS.WGS84
                }
            }
            return null;
        }
    });

    PublicaMundi.Maps.Resources.Types.KML = PublicaMundi.Maps.Resources.Types.KML || 'KML';

    PublicaMundi.Maps.registerResourceType(PublicaMundi.Maps.Resources.Types.KML, 'KML', PublicaMundi.Maps.Resources.KmlMetadataReader, PublicaMundi.Maps.Resources.FileLayerFactory);

    PublicaMundi.Maps.registerResourceTypeAdapter('KML', PublicaMundi.Maps.Resources.Types.KML, PublicaMundi.Maps.Resources.KmlCkanResourceMetadataReaderAdapter);

    return PublicaMundi;

});