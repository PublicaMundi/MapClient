define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";
    
    // "{"type":"Point","coordinates":[2556034.848391745, 4949267.502643947]}"
    
	PublicaMundi.queries = [
    {
        description: 'Selects all cities with population greater than <b>10000</b>.</br></br>WPS process: <b>Voronoi</b>.',
        query: {
            queue: [{
                resources: [
                    {
                        name : 'cities',
                        alias : 'table1'
                    }
                ],
                filters: [{
                    operator: 'GREATER',
                    arguments: [
                        {
                            name: 'pop'
                        },
                        10000
                    ]
                }],
                sort: [
                    {
                        name: 'pop',
                        desc: true
                    }
                ],
                offset: 20,
                limit: 50
            }]
        },
        method: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			query.resource('cities', 
						   'table1').
				  greater({name : 'pop'}, 10000).
				  orderBy('pop', true).
				  skip(20).
				  take(50);

			query.execute({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		},
        process: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			query.resource('cities', 
						   'table1').
				  greater({name : 'pop'}, 10000).
				  orderBy('pop', true).
				  skip(20).
				  take(50);

			query.processVoronoi().wps({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		}
	}, {
		description: 'Selects all city blocks that have area greater or equal to <b>15000</b> square meters.</br></br>WPS process chain: <b>ConvexHull</b>, <b>Buffer(50)</b>.',
		query: {
            queue : [{
                resources: ['blocksKalamaria'],
                fields: [{
                    resource: 'blocksKalamaria',
                    name: 'AROT'
                }, {
                    resource: 'blocksKalamaria',
                    name: 'the_geom',
                    alias: 'polygon'
                }],
                filters: [{
                    operator: 'AREA',
                    arguments: [{
                        resource: 'blocksKalamaria',
                        name: 'the_geom'
                    },
                        "GREATER_OR_EQUAL",
                        15000.0
                    ]
                }]
            }],
			format: 'GeoJSON'
		},
		method: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			query.resource('blocksKalamaria').
				  field('blocksKalamaria', 'AROT').
				  field('blocksKalamaria', 'the_geom', 'polygon').
				  areaGreaterOrEqual({
					resource: 'blocksKalamaria', 
					name : 'the_geom'
				  }, 15000.0).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.execute({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });

		},
        process: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			query.resource('blocksKalamaria').
				  field('blocksKalamaria', 'AROT').
				  field('blocksKalamaria', 'the_geom', 'polygon').
				  areaGreaterOrEqual({
					resource: 'blocksKalamaria', 
					name : 'the_geom'
				  }, 15000.0).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.processConvexHull().processBuffer(50).wps({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		}
	}, {
		description: 'Selects fields from  datasets \'Urban and rural regions\' and \'Blue flag beaches (2010)\'. The population of every region must be less than <b>3000</b> and the distance between a region and a beach must be less than <b>5000</b>. Moreover, all results should be inside a specific region.</br></br>WPS process: <b>Voronoi</b>.',
		query: {
            queue: [{
                "resources": [
                "cities",
                "blueFlags2010"
                ],
                "fields": [
                  {
                      "name": "name_eng"
                  }, {
                      "name": "city_eng"
                  }, {
                      "name": "nisos_eng"
                  },
                  "dimos_eng", {
                      "name": "pop"
                  }, {
                      "resource": "blueFlags2010",
                      "name": "NOMOS"
                  },
                  {
                      "resource": "blueFlags2010",
                      "name": "the_geom"
                  },
                  "DESCRIPT",
                  "REGION"
                ],
                "filters": [
                  {
                      "operator": "LESS",
                      "arguments": [
                        {
                            "name": "pop"
                        },
                        3000
                      ]
                  }, {
                      "operator": "DISTANCE",
                      "arguments": [
                        {
                            "resource": "cities",
                            "name": "the_geom"
                        }, {
                            "resource": "blueFlags2010",
                            "name": "the_geom"
                        },
                        "LESS",
                        5000
                      ]
                  }, {
                      operator: 'CONTAINS',
                      arguments: [
                          {
                              "type": "Polygon", "coordinates": [[[2687295.037100175, 4520261.073751386], [2687295.037100175, 4368610.009633597], [2914771.6332768593, 4368610.009633597], [2914771.6332768593, 4520261.073751386], [2687295.037100175, 4520261.073751386]]]
                          }, {
                              resource: 'blueFlags2010',
                              name: 'the_geom'
                          }]
                  }
                ]
            }],
			format: "GeoJSON"
		},
		method: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			var polygon = {
					"type": "Polygon", 
					"coordinates": [
						[
							[2687295.037100175, 4520261.073751386], 
							[2687295.037100175, 4368610.009633597], 
							[2914771.6332768593, 4368610.009633597], 
							[2914771.6332768593, 4520261.073751386], 
							[2687295.037100175, 4520261.073751386]]
					]
			};

			query.resource('cities').
				  resource('blueFlags2010').
				  field('name_eng').field('city_eng').
				  field('nisos_eng').field('dimos_eng').
				  field('pop').field('NOMOS').
				  field('blueFlags2010', 'the_geom').
				  field('DESCRIPT').field('REGION').
				  less({ name : 'pop'}, 3000).
				  distanceLess({
					resource: 'cities', 
					name : 'the_geom'
				  }, {
					resource: 'blueFlags2010', 
					name : 'the_geom'
				  }, 5000).
				  contains( polygon, {
					  resource: 'blueFlags2010',
					  name: 'the_geom'
				  }).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.execute({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		},
		process: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			var polygon = {
					"type": "Polygon", 
					"coordinates": [
						[
							[2687295.037100175, 4520261.073751386], 
							[2687295.037100175, 4368610.009633597], 
							[2914771.6332768593, 4368610.009633597], 
							[2914771.6332768593, 4520261.073751386], 
							[2687295.037100175, 4520261.073751386]]
					]
			};

			query.resource('cities').
				  resource('blueFlags2010').
				  field('name_eng').field('city_eng').
				  field('nisos_eng').field('dimos_eng').
				  field('pop').field('NOMOS').
				  field('blueFlags2010', 'the_geom').
				  field('DESCRIPT').field('REGION').
				  less({ name : 'pop'}, 3000).
				  distanceLess({
					resource: 'cities', 
					name : 'the_geom'
				  }, {
					resource: 'blueFlags2010', 
					name : 'the_geom'
				  }, 5000).
				  contains( polygon, {
					  resource: 'blueFlags2010',
					  name: 'the_geom'
				  }).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.processVoronoi().wps({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		}
	}, {
		description: 'Select geometries from the road network for Municipality of Kalamaria is provided that is inside a specific polygon.</br></br>WPS process: <b>Buffer(15)</b>.',
		query: {
            queue: [{
                "resources": [
                  "roadsKalamaria"
                ],
                "fields": [
                  "NAME_LABEL", "the_geom"
                ],
                "filters": [
                  {
                      "operator": "CONTAINS",
                      "arguments": [
                        {
                            "type": "Polygon",
                            "coordinates": [
                              [
                                [
                                  2554722.9073085627,
                                  4951114.104686448
                                ],
                                [
                                  2554722.9073085627,
                                  4950158.641832884
                                ],
                                [
                                  2556232.5386171946,
                                  4950158.641832884
                                ],
                                [
                                  2556232.5386171946,
                                  4951114.104686448
                                ],
                                [
                                  2554722.9073085627,
                                  4951114.104686448
                                ]
                              ]
                            ]
                        },
                        {
                            "name": "the_geom"
                        }
                      ]
                  }
                ]
            }],
			format: "GeoJSON"
		},
		method: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			var polygon = {
					"type": "Polygon", 
					"coordinates": [
						[
							[2554722.9073085627, 4951114.104686448],
							[2554722.9073085627, 4950158.641832884],
							[2556232.5386171946, 4950158.641832884],
							[2556232.5386171946, 4951114.104686448],
							[2554722.9073085627, 4951114.104686448]
						]
					]
			};

			query.resource('roadsKalamaria').
				  field('NAME_LABEL').field('the_geom').
				  contains( polygon, {
					  resource: 'roadsKalamaria',
					  name: 'the_geom'
				  }).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.execute({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		},
        process: function(onSuccess, onFailure, onComplete) {
			var query = new PublicaMundi.Data.Query();

			var polygon = {
					"type": "Polygon", 
					"coordinates": [
						[
							[2554722.9073085627, 4951114.104686448],
							[2554722.9073085627, 4950158.641832884],
							[2556232.5386171946, 4950158.641832884],
							[2556232.5386171946, 4951114.104686448],
							[2554722.9073085627, 4951114.104686448]
						]
					]
			};

			query.resource('roadsKalamaria').
				  field('NAME_LABEL').field('the_geom').
				  contains( polygon, {
					  resource: 'roadsKalamaria',
					  name: 'the_geom'
				  }).
				  format(PublicaMundi.Data.Format.GeoJSON);

			query.processBuffer(15).wps({
                success: onSuccess,
                failure: onFailure,
                complete: onComplete
            });
		}
	}];

	return PublicaMundi;
});
