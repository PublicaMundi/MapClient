define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.UI.FileViewBuilder = PublicaMundi.Class(PublicaMundi.Maps.Resources.UI.ViewBuilder, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.UI.ViewBuilder.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.UI.ViewBuilder.prototype.initialize.apply(this, arguments);
            }
        },
        build: function (options) {
            if (!PublicaMundi.Maps.Resources.UI.Views[options.viewType]) {
                throw 'View type is not supported.';
            }

            switch (PublicaMundi.Maps.Resources.UI.Views[options.viewType]) {
                case PublicaMundi.Maps.Resources.UI.Views.CREATE:
                    return new PublicaMundi.Maps.UI.FileResourceConfigView(options);
                case PublicaMundi.Maps.Resources.UI.Views.CONFIG:
                    return new PublicaMundi.Maps.UI.LayerConfigView(options);
            }

            return null;
        }
    });

    PublicaMundi.Maps.UI.FileResourceConfigView = PublicaMundi.Class(PublicaMundi.Maps.UI.ResourceConfigView, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.UI.ResourceConfigView.prototype.initialize === 'function') {
                PublicaMundi.Maps.UI.ResourceConfigView.prototype.initialize.apply(this, arguments);
            }
        },
        render: function (target) {
            var content = [];

            this.values.id = this.values.id || (this.values.resourceType + '-' + this.values.viewType);

            content.push('<div data-role="popup" id="' + this.values.id + '" data-dismissible="false" data-overlay-theme="a" data-theme="c" class="pm-popup  ui-corner-all">');
            content.push('<div data-role="header" data-theme="a" class="ui-corner-top">');
            content.push('<h3 id="add-file-header">Add link</h3>');
            content.push('</div>');
            content.push('<div data-role="content" data-theme="d" class="ui-corner-bottom ui-content">');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="file_title">Name</label>');
            content.push('<input type="text" name="file_title" id="file_title" value="" placeholder="Resource name..." data-clear-btn="true" data-mini="true" />');
            content.push('</div>');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="file_link">Endpoint</label>');
            content.push('<textarea name="file_link" id="file_link" data-clear-btn="true" data-mini="true"></textarea>');
            content.push('</div>');
            content.push('<div id="file_projection_container" class="ui-field-contain">');
            content.push('<label for="file_projection">Data Projection</label>');
            content.push('<select name="file_projection" id="file_projection" data-native-menu="false">');
            content.push('<option value="">Unknown</option>');
            content.push('<option value="EPSG:4326">EPSG:4326</option>');
            content.push('<option value="EPSG:3857">EPSG:3857</option>');
            content.push('</select>');
            content.push('</div>');
            content.push('<div class="ui-field-contain gml_specific">');
            content.push('<label for="gml_version">GML Version</label>');
            content.push('<select name="gml_version" id="gml_version" data-native-menu="false">');
            content.push('<option value="GML2">' + PublicaMundi.Maps.Resources.GML.Version.GML2  + '</option>');
            content.push('<option value="GML3" selected="true">' + PublicaMundi.Maps.Resources.GML.Version.GML3  +'</option>');
            content.push('</select>');
            content.push('</div>');
            content.push('<div class="ui-field-contain gml_specific">');
            content.push('<label for="gml_ns">Feature Namespace</label>');
            content.push('<input type="text" name="gml_ns" id="gml_ns" value="" data-clear-btn="true" data-mini="true">');
            content.push('</div>');
            content.push('<div class="ui-field-contain gml_specific">');
            content.push('<label for="gml_type">Feature Type</label>');
            content.push('<input type="text" name="gml_type" id="gml_type" value="" data-clear-btn="true" data-mini="true">');
            content.push('</div>');
            content.push('<div class="ui-grid-a">');
            content.push('<div class="ui-block-a"><a id="btn-file-cancel" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-b ui-mini btn-resource-cancel" style="margin-left: 0px !important;">Cancel</a></div>');
            content.push('<div class="ui-block-b"><a id="btn-file-create" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-a ui-mini btn-resource-add" style="margin-right: 0px !important;">Add</a></div>');
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');

            return content.join('');
        },
        getParameters: function () {
            var format, featureNS, featureType, version;

            switch (this.values.resourceType) {
                case PublicaMundi.Maps.Resources.Types.GeoJSON:
                    format = PublicaMundi.Maps.Resources.File.Format.GeoJSON;
                    break;
                case PublicaMundi.Maps.Resources.Types.GML:
                    format = PublicaMundi.Maps.Resources.File.Format.GML;
                    featureNS = $('#gml_ns').val();
                    featureType = $('#gml_type').val();
                    version = $('#gml_version').val();
                    break;
                case PublicaMundi.Maps.Resources.Types.KML:
                    format = PublicaMundi.Maps.Resources.File.Format.KML;
                    break;
            }
            return {
                type: this.values.resourceType,
                title: $('#file_title').val(),
                url: $('#file_link').val(),
                format: format,
                projection: $('#file_projection option:selected').val() || null,
                featureNS: featureNS,
                featureType: featureType,
                version: version
            };
        },
        show: function () {
            var self = this;

            $('#' + this.values.id).remove();
            $('#' + this.values.target).append(this.render());
            $('#' + this.values.id).popup().trigger('create');

            if (this.values.resourceType === 'KML') {
                $('#file_projection_container').hide();
            } else {
                $('#file_projection_container').show();
            }
            if (this.values.resourceType !== 'GML') {
                $('.gml_specific').hide();
            }
            if (this.values.resourceType === 'GML') {
                $('#file_projection option[value="EPSG:3857"]').prop('selected', true);
                $('#file_projection').selectmenu('refresh');
                $('#file_projection option[value=""]').hide();
            }

            $('#btn-file-create').click(function () {
                var parameters = self.getParameters();
                $('#' + self.values.id).popup('close').popup('destroy').remove();
                self.trigger('create', parameters);
            });

            $('#btn-file-cancel').click(function () {
                $('#' + self.values.id).popup('close').popup('destroy').remove();
                self.trigger('cancel', null);
            });

            setTimeout(function () {
                $('#' + self.values.id).popup('open');
            }, 50);
        }
    });

    PublicaMundi.Maps.Resources.Types.GeoJSON = PublicaMundi.Maps.Resources.Types.GeoJSON || 'GeoJSON';
    PublicaMundi.Maps.Resources.Types.KML = PublicaMundi.Maps.Resources.Types.KML || 'KML';
    PublicaMundi.Maps.Resources.Types.GML = PublicaMundi.Maps.Resources.Types.GML || 'GML';

    PublicaMundi.Maps.registerViewBuilder(PublicaMundi.Maps.Resources.Types.GeoJSON, PublicaMundi.Maps.Resources.UI.FileViewBuilder);

    PublicaMundi.Maps.registerViewBuilder(PublicaMundi.Maps.Resources.Types.KML, PublicaMundi.Maps.Resources.UI.FileViewBuilder);

    PublicaMundi.Maps.registerViewBuilder(PublicaMundi.Maps.Resources.Types.GML, PublicaMundi.Maps.Resources.UI.FileViewBuilder);

    return PublicaMundi;
});
