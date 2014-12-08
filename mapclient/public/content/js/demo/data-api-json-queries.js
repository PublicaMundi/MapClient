// "{"type":"Point","coordinates":[2556034.848391745, 4949267.502643947]}"
var queries = [
    {
        description: 'Selects all cities with population greater than 10000.',
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
        description: 'Selects all city blocks that have area greater or equal to 15000 square meters.',
        query: {
            resources: ['d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6'],
            fields: [{
                resource: 'd0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6',
                name: 'AROT'
            },{
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
        description: '',
        query: {
            resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                            '507076a5-8b40-4cd0-a519-632f375babf7'],
            fields: [{
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'arot'
            }, {
                resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                name: 'tk'
            }, {
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'the_geom',
                alias: 'polygon'
            }, {
                resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                name: 'address'
            }],
            filters: [{
                operator: 'EQUAL',
                arguments: [
                    {
                        resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                        name: 'tk'
                    },
                    '54625'
                ]
            }, {
                operator: 'CONTAINS',
                arguments: [{
                    "type": "Polygon", "coordinates": [[[2554722.9073085627, 4951114.104686448], [2554722.9073085627, 4950158.641832884], [2556232.5386171946, 4950158.641832884], [2556232.5386171946, 4951114.104686448], [2554722.9073085627, 4951114.104686448]]]
                }, {
                    resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                    name: 'the_geom'
                }]
            }],
            format: 'geojson'
        }
    },
    {
        description: '',
        query: {
            resources: ['00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                            '507076a5-8b40-4cd0-a519-632f375babf7'],
            fields: [{
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'arot'
            }, {
                resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                name: 'tk'
            }, {
                resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                name: 'the_geom',
                alias: 'polygon'
            }, {
                resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                name: 'address'
            }],
            filters: [{
                operator: 'EQUAL',
                arguments: [
                    {
                        resource: '507076a5-8b40-4cd0-a519-632f375babf7',
                        name: 'tk'
                    },
                    '54625'
                ]
            }, {
                operator: 'INTERSECTS',
                arguments: [{
                    "type": "Polygon", "coordinates": [[[2554722.9073085627, 4951114.104686448], [2554722.9073085627, 4950158.641832884], [2556232.5386171946, 4950158.641832884], [2556232.5386171946, 4951114.104686448], [2554722.9073085627, 4951114.104686448]]]
                }, {
                    resource: '00f51ed5-3bd0-40b4-b2a4-76ad5a324bdd',
                    name: 'the_geom'
                }]
            }],
            format: 'geojson'
        }
    }];
