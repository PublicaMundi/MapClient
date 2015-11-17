    PublicaMundi.noConflict();

    PublicaMundi.ready(function () {
        var map, popup;

        // Data API configuration options   
        var options = {
            endpoint: '../',
            alias: config.api.alias
        };

        PublicaMundi.Data.configure(options);
    
        // Initialize map
        var options = {
            target: 'map',
            center: [2658716, 4600000],
            zoom: 9,
            layers: [{
                title: 'Open Street Maps',
                type: PublicaMundi.LayerType.WMS,
                url: config.servers.mapproxy,
                params: { 
                    'layers' : config.layers.osm
                }
            }]
        };

        map = PublicaMundi.map(options);

        //Initialize popup handler
        popup = map.addOverlay($('#popup').get()[0]);
       
        // Search
        var state = null;

        var clear = function() {
            $('#location-filter-text').val('');
            
            if((state) && (state.layer.city)) {
                map.removeLayer(state.layer.city);
            };
            if((state) && (state.layer.flags)) {
                map.removeLayer(state.layer.flags);
            };
            
            state = {
                layer: {
                    city: null,
                    flags: null
                },
                selection: null,
                result: null
            };
        };

        $('#location-filter-remove').click(function() {
            clear();
        });

        clear();

        $('#map').click(function() {
            if($('#popup').data('bs.popover')) {
                $('#popup').popover('hide');
            }
        });

        var formatCity = function(feature) {
            return feature.label;
        };

        var formatFlag = function(feature) {
            var content = [];
            
            content.push('<div style="white-space: nowrap;">' + feature.WATERNAME + ' ');
            if(feature.distance > 1000) {
                content.push((feature.distance/1000).toFixed(2) + ' km');
            } else {
                content.push(feature.distance.toFixed(2) + ' m');
            }
            content.push('</div>');
            
            return content.join('');
        };
        
        var onFeatureClick = function(features, coordinate) {
            var feature = null;
            
            if (features) {
                feature = features[0];
            }

            map.setOverlayPosition(popup, coordinate);

            var text = (feature.hasOwnProperty('label') ? formatCity(feature) : formatFlag(feature));
           
            if($('#popup').data('bs.popover')) {
                $('#popup').data('bs.popover').options.content = text;
            } else {
                $('#popup').popover({
                    'placement' : 'top',
                    'animation' : true,
                    'html' : true,
                    'content' : text
                });
            }

            $('#popup').popover('show');
        };
          
        // Query and variables
        var query = new PublicaMundi.Data.Query();

        // Callbacks
        var onSelectSuccess = function(result) {
            state.result = result;

            if(state.layer.city) {
                map.removeLayer(state.layer.city);
            };

            if(state.layer.flags) {
                map.removeLayer(state.layer.flags);
            };

            if(state.result.success) {
                state.layer.city = map.geoJSON({
                    data: state.selection,
                    click: onFeatureClick
                });

                state.layer.flags = map.geoJSON({
                    data: state.result.data[0],
                    click: onFeatureClick
                });
            
                map.setCenter(state.selection.geometry.coordinates);
                map.setZoom(12);
            }
        };

        var onSelectFailure = function(result) {
        };

        var showFeatures = function() {
            query.reset().
                resource('flags').
                field('the_geom').field('PROVINCE').field('DESCRIPT').field('WATERNAME').
                distance({  name : 'the_geom' }, state.selection.geometry, 'distance').
                distanceLessOrEqual({ name : 'the_geom'}, state.selection.geometry, 5000).
                orderBy('distance', true).
                take(20).
                setSuccess(onSelectSuccess).
                setFailure(onSelectFailure).
                execute();
        };

        // Search location
        $( '#location-filter-text' ).autocomplete({
            source: function( request, response ) {
                // Success text search callback
                var onSearchSuccess = function(result) {                   
                    if(result.success) {
                        
                        response(result.data[0].features.map(function(currentValue, index, array) {
                            return {
                                label: currentValue.properties.label,
                                value: currentValue.properties.label,
                                record: currentValue
                            };
                        }));
                    } else {
                        response([]);
                    }
                };

                // Failure text search callback
                var onSearchFailure = function(result) {
                    response([]);
                };

                // Search locations
                query.reset().
                    resource('cities').resource('flags').
                    field('cities', 'the_geom').field('cities', 'NAME_OIK', 'label').
                    like({ name: 'NAME_OIK' }, request.term).
                    distanceLessOrEqual({ resource: 'cities', name : 'the_geom'}, { resource: 'flags', name : 'the_geom'}, 5000).
                    orderBy('label').
                    take(10).
                    setSuccess(onSearchSuccess).
                    setFailure(onSearchFailure).
                    execute();
			},
            select: function( event, ui ) {
                state.selection = ui.item.record;
                
                showFeatures();
            },
            minLength: 3,
            _renderItem: function( ul, item ) {
                return $( "<li>" )
                    .attr( "data-value", item.value )
                    .append( item.label )
                    .appendTo( ul );
            }
        });

        $('#location-filter-text').focus();
    });
