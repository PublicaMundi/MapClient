define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.UI.WfsViewFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.UI.ViewFactory, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Resources.UI.ViewFactory.prototype.initialize === 'function') {
                PublicaMundi.Maps.Resources.UI.ViewFactory.prototype.initialize.apply(this, arguments);
            }
        },
        build: function (options) {
            if (!PublicaMundi.Maps.Resources.UI.Views[options.viewType]) {
                throw 'View type is not supported.';
            }

            switch (PublicaMundi.Maps.Resources.UI.Views[options.viewType]) {
                case PublicaMundi.Maps.Resources.UI.Views.CREATE:
                    return new PublicaMundi.Maps.UI.WfsCreateResourceView(options);
                case PublicaMundi.Maps.Resources.UI.Views.CONFIG:
                    return new PublicaMundi.Maps.UI.LayerConfigView(options);
            }

            return null;
        }
    });

    PublicaMundi.Maps.UI.WfsCreateResourceView = PublicaMundi.Class(PublicaMundi.Maps.UI.CreateResourceView, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.UI.CreateResourceView.prototype.initialize === 'function') {
                PublicaMundi.Maps.UI.CreateResourceView.prototype.initialize.apply(this, arguments);
            }
        },
        render: function (target) {
            var content = [];

            this.values.id = this.values.id || (PublicaMundi.Maps.Resources.Types.WFS + '-' + PublicaMundi.Maps.Resources.UI.Views.CREATE);

            content.push('<div data-role="popup" id="' + this.values.id + '" data-dismissible="false" data-overlay-theme="a" data-theme="c" class="pm-popup  ui-corner-all clearfix">');
            content.push('<div data-role="header" data-theme="a" class="ui-corner-top">');
            content.push('<h3 id="add-wfs-header">Add WFS resource</h3>');
            content.push('</div>');
            content.push('<div data-role="content" data-theme="d" class="ui-corner-bottom ui-content">');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wfs_title">Name</label>');
            content.push('<input type="text" name="wfs_title" id="wfs_title" value="Transportation" placeholder="Resource title..." data-clear-btn="true" data-mini="true" />');
            content.push('</div>');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wfs_url" style="padding-left: 0.23em;">Endpoint</label>');
            content.push('<input type="text" name="wfs_url" id="wfs_url" value="http://services.nationalmap.gov/arcgis/services/WFS/transportation/MapServer/WFSServer" data-clear-btn="true" data-mini="true">');
            content.push('</div>');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wfs_format">Format</label>');
            content.push('<select name="wfs_format" id="wfs_format" data-native-menu="false">');
            content.push('<option value="GeoJSON">GeoJSON</option>');
            content.push('<option value="GML">GML</option>');
            content.push('</select>');
            content.push('</div>');
            content.push('<div class="ui-grid-a">');
            content.push('<div class="ui-block-a"><a id="btn-wfs-cancel" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-b ui-mini btn-resource-cancel" style="margin-left: 0px !important;">Cancel</a></div>');
            content.push('<div class="ui-block-b"><a id="btn-wfs-create" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-a ui-mini btn-resource-add" style="margin-right: 0px !important;">Add</a></div>');
            content.push('</div>');
            content.push('</div>');
            content.push('<div id="wfs_advanced_options">');
            content.push('<div data-role="header" data-theme="a" class="ui-corner-top">');
            content.push('<h3 id="wfs_advanced">Advanced</h3>');
            content.push('</div>');
            content.push('<div data-role="content" data-theme="d" class="ui-corner-bottom ui-content">');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wfs_custom_parameters">Callaback Parameter</label>');
            content.push('<input type="text" name="wfs_custom_parameters" id="wfs_custom_parameters" value="outputFormat=text/javascript&format_options=callback:loadFeatures" data-clear-btn="true" data-mini="true">');
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');

            return content.join('');
        },
        getParameters: function () {
            return {
                type: PublicaMundi.Maps.Resources.Types.WFS,
                title: $('#wfs_title').val(),
                url: $('#wfs_url').val(),
                format: $('#wfs_format option:selected').val() || PublicaMundi.Maps.Resources.WFS.Format.GML,
                parameters: $('#wfs_custom_parameters').val()
            };
        },
        show: function () {
            var self = this;

            $('#' + this.values.id).remove();
            $('#' + this.values.target).append(this.render());
            $('#' + this.values.id).popup().trigger('create');

            if ($('#wfs_format option:selected').val() === 'GeoJSON') {
                $('#wfs_advanced_options').show();
            } else {
                $('#wfs_advanced_options').hide();
            }

            $("#wfs_format").bind("change", function (event, ui) {
                if ($('#wfs_format option:selected').val() === 'GeoJSON') {
                    $('#wfs_advanced_options').show();
                } else {
                    $('#wfs_advanced_options').hide();
                }
            });

            $('#btn-wfs-create').click(function () {
                var parameters = self.getParameters();
                $('#' + self.values.id).popup('close').popup('destroy').remove();
                self.trigger('create', parameters);
            });

            $('#btn-wfs-cancel').click(function () {
                $('#' + self.values.id).popup('close').popup('destroy').remove();
                self.trigger('cancel', null);
            });

            setTimeout(function () {
                $('#' + self.values.id).popup('open');
            }, 50);
        }
    });

    PublicaMundi.Maps.Resources.Types.WFS = PublicaMundi.Maps.Resources.Types.WFS || 'WFS';

    PublicaMundi.Maps.registerViewFactory(PublicaMundi.Maps.Resources.Types.WFS, PublicaMundi.Maps.Resources.UI.WfsViewFactory);

    return PublicaMundi;
});
