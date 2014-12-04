define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    PublicaMundi.Maps.Resources.UI.WmsViewFactory = PublicaMundi.Class(PublicaMundi.Maps.Resources.UI.ViewFactory, {
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
                    return new PublicaMundi.Maps.UI.WmsCreateResourceView(options);
                case PublicaMundi.Maps.Resources.UI.Views.CONFIG:
                    return new PublicaMundi.Maps.UI.LayerConfigView(options);
            }

            return null;
        }
    });

    PublicaMundi.Maps.UI.WmsCreateResourceView = PublicaMundi.Class(PublicaMundi.Maps.UI.CreateResourceView, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.UI.CreateResourceView.prototype.initialize === 'function') {
                PublicaMundi.Maps.UI.CreateResourceView.prototype.initialize.apply(this, arguments);
            }
        },
        render: function (target) {
            var content = [];

            this.values.id = this.values.id || (PublicaMundi.Maps.Resources.Types.WMS + '-' + PublicaMundi.Maps.Resources.UI.Views.CREATE);

            content.push('<div data-role="popup" id="' + this.values.id + '" data-dismissible="false" data-overlay-theme="a" data-theme="c" class="pm-popup  ui-corner-all">');
            content.push('<div data-role="header" data-theme="a" class="ui-corner-top">');
            content.push('<h3 id="add-wms-header">Add WMS resource</h3>');
            content.push('</div>');
            content.push('<div data-role="content" data-theme="d" class="ui-corner-bottom ui-content">');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wms_title">Title</label>');
            content.push('<input type="text" name="wms_title" id="wms_title" value="Agriculture" placeholder="Resource title..." data-clear-btn="true" data-mini="true" />');
            content.push('</div>');
            content.push('<div class="ui-field-contain">');
            content.push('<label for="wms_url" style="padding-left: 0.23em;">Endpoint</label>');
            content.push('<input type="text" name="wms_url" id="wms_url" value="http://webservices.nationalatlas.gov/wms/agriculture" data-clear-btn="true" data-mini="true">');
            content.push('</div>');
            content.push('<div class="ui-grid-a">');
            content.push('<div class="ui-block-a"><a id="btn-wms-cancel" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-b ui-mini btn-resource-cancel" style="margin-left: 0px !important;">Cancel</a></div>');
            content.push('<div class="ui-block-b"><a href="#" id="btn-wms-create" class="ui-btn ui-shadow ui-corner-all ui-btn-a ui-mini btn-resource-add" style="margin-right: 0px !important;">Add</a></div>');
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');

            return content.join('');
        },
        getParameters: function () {
            return {
                type: PublicaMundi.Maps.Resources.Types.WMS,
                title: $('#wms_title').val(),
                url: $('#wms_url').val()
            };
        },
        show: function () {
            var self = this;

            $('#' + this.values.id).remove();
            $('#' + this.values.target).append(this.render());
            $('#' + this.values.id).popup().trigger('create');

            $('#btn-wms-create').click(function () {
                parameters = self.getParameters();
                $('#' + self.values.id).popup('close').popup('destroy').remove();

                self.trigger('create', parameters);
            });

            $('#btn-wms-cancel').click(function () {
                $('#' + self.values.id).popup('close').popup('destroy').remove();
                self.trigger('cancel', null);
            });

            setTimeout(function () {
                $('#' + self.values.id).popup('open');
            }, 50);
        }
    });

    PublicaMundi.Maps.Resources.Types.WMS = PublicaMundi.Maps.Resources.Types.WMS || 'WMS';

    PublicaMundi.Maps.registerViewFactory(PublicaMundi.Maps.Resources.Types.WMS, PublicaMundi.Maps.Resources.UI.WmsViewFactory);

    return PublicaMundi;
});
