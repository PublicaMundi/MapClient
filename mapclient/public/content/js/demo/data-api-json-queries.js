// "{"type":"Point","coordinates":[2556034.848391745, 4949267.502643947]}"
var queries = [
    {
        description: 'Selects all cities with population greater than <b>10000</b>.',
        query:
        {
            resources: ['97569331-a2fb-45eb-92c9-064ef4f70d38'],
            filters: [{
                operator: 'GREATER',
                arguments: [
                    {
                        name: 'pop'
                    },
                    10000
                ]
            }],
            format: 'geojson'
        }
    },
    {
        description: 'Selects all city blocks that have area greater or equal to <b>15000</b> square meters.',
        query: {
            resources: ['d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6'],
            fields: [{
                resource: 'd0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',
                name: 'AROT'
            }, {
                resource: 'd0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',
                name: 'the_geom',
                alias: 'polygon'
            }],
            filters: [{
                operator: 'AREA',
                arguments: [{
                    resource: 'd0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',
                    name: 'the_geom'
                },
                    "GREATER_OR_EQUAL",
                    15000.0
                ]
            }],
            format: 'geojson'
        }
    }, {
        description: 'Selects fields from  datasets \'Urban and rural regions\' and \'Blue flag beaches (2010)\'. The population of every region must be less than <b>3000</b> and the distance between a region and a beach must be less than <b>5000</b>. Moreover, all results should be inside a specific region.',
        query: {
            "resources": [
            "97569331-a2fb-45eb-92c9-064ef4f70d38",
            "ad815665-ec88-4e81-a27a-8d72cffa7dd2"
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
                  "resource": "ad815665-ec88-4e81-a27a-8d72cffa7dd2",
                  "name": "NOMOS"
              },
              {
                  "resource": "ad815665-ec88-4e81-a27a-8d72cffa7dd2",
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
                        "resource": "97569331-a2fb-45eb-92c9-064ef4f70d38",
                        "name": "the_geom"
                    }, {
                        "resource": "ad815665-ec88-4e81-a27a-8d72cffa7dd2",
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
                          resource: 'ad815665-ec88-4e81-a27a-8d72cffa7dd2',
                          name: 'the_geom'
                      }]
              }
            ],
            "format": "geojson"
        }
    }, {
        description: 'Select geometries from the road network for Municipality of Kalamaria is provided that is inside a specific polygon ',
        query: {
            "resources": [
              "9e5f0732-092b-4a36-9b2b-6cc3b3f78ab6"
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
            ],
            "format": "geojson"
        }
    }];
