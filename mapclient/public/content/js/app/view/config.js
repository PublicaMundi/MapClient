define(['jquery', 'ol', 'URIjs/URI', 'shared'], function ($, ol, URI, PublicaMundi) {

    var colorArrayToHex = function (color) {
        if (!Array.isArray(color)) {
            return null;
        }
        if ((color.length < 3) || (color.length > 4)) {
            throw 'Invalid color array.';
        }
        var parts = color.slice(0, 3).map(function (value) {
            var temp = value.toString(16);
            return (temp.length === 1 ? '0' + temp : temp);
        });

        return ('#' + parts.join(''));
    };

    var colorHexToArray = function (color, opacity) {
        color = (color.charAt(0) === '#' ? color.substring(1, 7) : color);
        if ((typeof opacity === 'undefined') || (opacity === null)) {
            opacity = 1.0;
        }
        if (opacity < 0) {
            opacity = 0.0;
        }
        if (opacity > 1) {
            opacity = 1.0;
        }
        return [parseInt(color.substring(0, 2), 16), parseInt(color.substring(2, 4), 16), parseInt(color.substring(4, 6), 16), opacity];
    };

    var getLayerIndex = function (map, layer) {
        if (layer) {
            var layers = map.getLayers().getArray();

            for (var i = 1; i < layers.length; i++) {
                if (layers[i] === layer) {
                    return i;
                }
            }
        }

        return -1;
    };

    var createStyle = function (options) {
        options.fill = options.fill || [255, 255, 255, 0.4];
        options.color = options.color || '#3399CC';
        options.width = options.width || 1;

        var fill = new ol.style.Fill({
            color: options.fill
        });

        var stroke = new ol.style.Stroke({
            color: options.color,
            width: options.width
        });

        var styles = [
          new ol.style.Style({
              image: new ol.style.Circle({
                  fill: fill,
                  stroke: stroke,
                  radius: 5
              }),
              fill: fill,
              stroke: stroke
          })
        ];

        return styles;
    };

    var bind = function (options) {
        $('#layer_title').html(options.metadata.title);

        $('#layer_opacity').val(options.metadata.viewer.opacity);
        if (options.layer) {
            options.layer.setOpacity(options.metadata.viewer.opacity / 100.0);
        }
        $('#layer_opacity').slider('refresh');

        var layerCount = options.map.getLayers().getLength();
        var layerIndex = getLayerIndex(options.map, options.layer);

        if ((layerIndex !== -1) && (layerCount > 2)) {
            $('#layer_index').attr('max', layerCount - 1);
            $('#layer_index').val(layerIndex);
            $('#layer_index').slider('refresh');
            $('#layer-index-config').show();
        } else {
            $('#layer-index-config').hide();
        }

        if (options.metadata.viewer.style) {
            var strokeColor, fillColor;

            $('#style_stroke_width').val(options.metadata.viewer.style.width);
            $('#style_stroke_width').slider('refresh');

            strokeColor = options.metadata.viewer.style.color;
            strokeColor = (strokeColor.charAt(0) === '#' ? strokeColor.substring(1, 7) : strokeColor);
            $('#style_stroke_color').val(strokeColor);
            $('.color-palette[data-property="style_stroke_color"]').find('.color-tile-' + strokeColor).addClass('ui-btn ui-btn-icon-notext ui-icon-check');

            fillColor = colorArrayToHex(options.metadata.viewer.style.fill);
            fillColor = (fillColor.charAt(0) === '#' ? fillColor.substring(1, 7) : fillColor);
            $('#style_fill_color').val(fillColor);
            $('.color-palette[data-property="style_fill_color"]').find('.color-tile-' + fillColor).addClass('ui-btn ui-btn-icon-notext ui-icon-check');

            $('#style_fill_opacity').val(options.metadata.viewer.style.fill[3] * 100);
            $('#style_fill_opacity').slider('refresh');

            $('#layer-style-config').show();
        } else {
            $('#layer-style-config').hide();
        }
    };

    var ensureStyle = function (metadata, layer) {
        if (layer) {
            var style = {};

            style.width = $('#style_stroke_width').val();

            var strokeColor = $('#style_stroke_color').val();
            style.color = (strokeColor.charAt(0) === '#' ? strokeColor : '#' + strokeColor);

            style.fill = colorHexToArray($('#style_fill_color').val(), $('#style_fill_opacity').val() / 100.0);

            if (metadata.viewer.style) {
                layer.setStyle(createStyle(style));
            }
        }
    };

    PublicaMundi.Maps.UI.LayerConfigView = PublicaMundi.Class(PublicaMundi.Maps.UI.View, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.UI.View.prototype.initialize === 'function') {
                PublicaMundi.Maps.UI.View.prototype.initialize.apply(this, arguments);
            }

            this.event('save');
            this.event('discard');
        },
        render: function (target) {
            var content = [];

            this.values.id = this.values.id || (PublicaMundi.Maps.Resources.Types.WFS + '-' + PublicaMundi.Maps.Resources.UI.Views.CREATE);

            content.push('<div data-role="popup" id="' + this.values.id + '" data-dismissible="true" data-overlay-theme="a" data-theme="c" class="pm-popup ui-corner-all clearfix">');
            content.push('<div data-role="header" data-theme="a" class="ui-corner-top">');
            content.push('<h3 id="layer_title" class="layer-title-header"></h3>');
            content.push('</div>');
            content.push('<div data-role="content" data-theme="d" class="ui-corner-bottom ui-content clearfix">');
            content.push('<div id="layer-index-config" class="ui-field-contain full-width-slider">');
            content.push('<label for="layer_index">Index</label>');
            content.push('<input type="range" data-show-value="true" name="layer_index" id="layer_index" min="1" max="1" value="1">');
            content.push('</div>');
            content.push('<div class="ui-field-contain full-width-slider">');
            content.push('<label for="layer_opacity">Opacity</label>');
            content.push('<input type="range" data-show-value="true" name="layer_opacity" id="layer_opacity" min="0" max="100" value="100">');
            content.push('</div>');
            content.push('<div id="layer-style-config" class="clearfix" style="display: none;">');
            content.push('<div class="ui-field-contain full-width-slider">');
            content.push('<label for="style_stroke_width">Stroke Width and Color</label>');
            content.push('<input type="range" data-show-value="true" name="style_stroke_width" id="style_stroke_width" min="1" max="10" value="10">');
            content.push('</div>');
            content.push('<div class="ui-field-contain full-width-slider">');
            content.push('<div class="color-palette" data-property="style_stroke_color"></div>');
            content.push('<input id="style_stroke_color" type="hidden" value="" />');
            content.push('</div>');
            content.push('<div class="ui-field-contain full-width-slider">');
            content.push('<label for="style_fill_opacity">Fill Opacity and Color</label>');
            content.push('<input type="range" data-show-value="true" name="style_fill_opacity" id="style_fill_opacity" min="0" max="100" value="100">');
            content.push('</div>');
            content.push('<div class="ui-field-contain full-width-slider">');
            content.push('<div class="color-palette" data-property="style_fill_color"></div>');
            content.push('<input id="style_fill_color" type="hidden" value="" />');
            content.push('</div>');
            content.push('</div>');
            content.push('<div class="footer-center clearfix">');
            content.push('<div class="ui-block-a"><a id="btn-config-discard" href="#" data-rel="close" class="ui-btn ui-shadow ui-corner-all ui-btn-b ui-mini btn-resource-cancel" style="margin-left: 0px !important;">Cancel</a></div>');
            content.push('<div class="ui-block-b"><a id="btn-config-update" href="#" class="ui-btn ui-shadow ui-corner-all ui-btn-a ui-mini btn-resource-add" style="margin-right: 0px !important;">Update</a></div>');
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');

            return content.join('');
        },
        show: function (options) {
            var self = this;

            // Create
            $('#' + this.values.id).remove();
            $('#' + this.values.target).append(this.render());
            $('#' + this.values.id).popup().trigger('create');

            // TODO : Need a plugin for color picker
            var colors = ['ffffff', 'f2f2f2', '7f7f7f', 'ddd9c3', 'c6d9f0', 'dbe5f1', 'f2dcdb', 'ebf1dd', 'e5e0ec', 'dbeef3', 'fdeada',
'd8d8d8', '595959', 'c4bd97', '8db3e2', 'b8cce4', 'e5b9b7', 'd7e3bc', 'ccc1d9', 'b7dde8', 'fbd5b5',
'bfbfbf', '3f3f3f', '938953', '548dd4', '95b3d7', 'd99694', 'c3d69b', 'b2a2c7', '92cddc', 'fac08f',
'a5a5a5', '262626', '494429', '17365d', '366092', '953734', '76923c', '5f497a', '31859b', 'e36c09',
'3399CC', '0c0c0c', '1d1b10', '0f243e', '244061', '632423', '4f6128', '3f3151', '205867', '974806', 'ff0000',
'00ff00', '0000ff'];

            var elements = [];

            for (var i = 0; i < colors.length; i++) {
                elements.push('<div class="color-tile color-tile-' + colors[i] + '" data-color="' + colors[i] + '" style="background: #' + colors[i] + '"><span/></div>');
            }

            $('.color-palette').html('');
            $('.color-palette').append(elements.join(''));
            $('.color-tile').removeClass('ui-btn ui-btn-icon-notext ui-icon-check');

            // Bind
            bind(options);

            // Attach events
            $('#layer_index').change(function () {
                if (options.layer) {
                    var index = $('#layer_index').val();

                    var currentIndex = getLayerIndex(options.map, options.layer);
                    var replaced = options.map.getLayers().item(index);
                    options.map.getLayers().setAt(index, options.layer);
                    options.map.getLayers().setAt(currentIndex, replaced);
                }
            });

            $('.color-tile').click(function () {
                $(this).parent('.color-palette').find('.color-tile').removeClass('ui-btn ui-btn-icon-notext ui-icon-check');
                $(this).addClass('ui-btn ui-btn-icon-notext ui-icon-check');

                var field = $(this).parent('div[data-property]').data('property');
                $('#' + field).val($(this).data('color'));

                if (options.layer) {
                    ensureStyle(options.metadata, options.layer);
                }
            });

            $('#layer_opacity').change(function () {
                if (options.layer) {
                    options.layer.setOpacity($('#layer_opacity').val() / 100.0);
                }
            });

            $('#style_stroke_width').change(function () {
                ensureStyle(options.metadata, options.layer);
            });

            $('#style_fill_opacity').change(function () {
                ensureStyle(options.metadata, options.layer);
            });

            $('#' + self.values.id).popup({
                afterclose: function (event, ui) {
                    $('#' + self.values.id).popup('destroy').remove();
                }
            });

            $('#btn-config-update').click(function () {
                var settings = {
                    opacity: $('#layer_opacity').val(),
                    style: null
                };
                if (options.metadata.viewer.style) {
                    settings.style = {};

                    settings.style.width = $('#style_stroke_width').val();
                    var strokeColor = $('#style_stroke_color').val();
                    settings.style.color = (strokeColor.charAt(0) === '#' ? strokeColor : '#' + strokeColor);
                    settings.style.fill = colorHexToArray($('#style_fill_color').val(), $('#style_fill_opacity').val() / 100.0);
                }

                $('#' + self.values.id).popup('close');

                self.trigger('save', settings);
            });

            $('#btn-config-discard').click(function () {
                // Reset
                bind(options);
                ensureStyle(options.metadata, options.layer);

                $('#' + self.values.id).popup('close');
            });

            setTimeout(function () {
                $('#' + self.values.id).popup('open');
            }, 50);
        }
    });

    return PublicaMundi;
});
