var query = {
    // File names for exporting layers
    files: [],
    // Output CRS
    crs: 'EPSG:3857',
    // Data format
    format: 'GeoJSON',
    // List of queries to execute. When executing a WPS process chain, only a single query is allowed. When exporting data and 
    // files parameter is set, queue and files arrays length should be equal.
    queue: [{
        // (Required) Catalog resources of type "data_table"
        resources : [

            // Resource expressed as a object
            {
                // (Required) Unique resource id.
                "name": "97569331-a2fb-45eb-92c9-064ef4f70d38",
                // (Optional) Resource alias used for expressing fields and sort attributes.
                "alias": "table1"
            },

            // Resource expressed as a string
            "97569331-a2fb-45eb-92c9-064ef4f70d38"
        ],

        // (Optional) Projected fields. If no field is specified, all fields from all resources 
        // are selected. If more than one resources with fields with the same name are selected,
        // an exception will be raised for ambiguous field names.
        fields : [

            // Field expressed as an object
            {
                // (Optional) Field resource. If no resource is specified, it will be deduced by
                // the values in resources property.
                "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                // (Required) Field name
                "name": "the_geom",
                // (Optional) Field alias
                "alias": "polygon"
            },

            // Field name. Resource will be deduced by the values in the resources property.
            "the_geom"
        ],

        // Filter expressions
        filters : [
            // Filter expressed as objects
            {
                // (Required) Scalar operator. Valid values : 'EQUAL', 'NOT_EQUAL', 'GREATER', 'GREATER_OR_EQUAL', 'LESS', 'LESS_OR_EQUAL',
                "operator": "GREATER",

                // Argument list consisting of two items
                "arguments": [
                    // Field name expressed as an object
                    {
                        // (Optional) Resource name or alias
                        "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                        // Field name. Current release does not support field aliases in filters.
                        "name": "population"
                    },
                    // Scalar value expressed as a literal
                    10000
                ]
            },
            {
                // (Required) Area spatial operator
                "operator": "AREA",

                // Argument list consisting of three items
                "arguments": [
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        // (Optional) Resource name or alias
                        "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                        // Field name. Current release does not support field aliases in filters.
                        "name": "the_geom"
                    },
                    // Scalar operator
                    "GREATER",
                    // Scalar value expressed as a literal. Currently supported geometry area comparison is not supported
                    10000
                ]
            },
            {
                // (Required) Distance spatial operator
                "operator": "DISTANCE",

                // Argument list consisting of four items
                "arguments": [
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        // (Optional) Resource name or alias
                        "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                        // Field name. Current release does not support field aliases in filters.
                        "name": "the_geom"
                    },
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        "type" : "Point",
                        "coordinates" : [2556034.848391745, 4949267.502643947]
                    },
                    // Scalar operator
                    "GREATER",
                    // Scalar value expressed as a literal. The value must be a valid number
                    10000
                ]
            },
            {
                // (Required) Contains spatial operator
                "operator": "CONTAINS",

                // Argument list consisting of two items
                "arguments": [
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        // (Optional) Resource name or alias
                        "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                        // Field name. Current release does not support field aliases in filters.
                        "name": "the_geom"
                    },
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [ 2687295.037100175, 4520261.073751386],
                                [ 2687295.037100175, 4368610.009633597],
                                [ 2914771.633276859, 4368610.009633597],
                                [ 2914771.633276859, 4520261.073751386],
                                [ 2687295.037100175, 4520261.073751386]
                            ]
                        ]
                    }
                ]
            },
            {
                // (Required) Intersects spatial operator
                "operator": "INTERSECTS",

                // Argument list consisting of two items
                "arguments": [
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        // (Optional) Resource name or alias
                        "resource": "d0e3e91c-33e0-426c-b4b3-b9e2bc78a7f6",
                        // Field name. Current release does not support field aliases in filters.
                        "name": "the_geom"
                    },
                    // Field name expressed as an object or a geometry expressed in GeoJSON. If a field is selected, it must be a geometry column
                    {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [ 2687295.037100175, 4520261.073751386],
                                [ 2687295.037100175, 4368610.009633597],
                                [ 2914771.633276859, 4368610.009633597],
                                [ 2914771.633276859, 4520261.073751386],
                                [ 2687295.037100175, 4520261.073751386]
                            ]
                        ]
                    }
                ]
            }
        ],

        // Sort attributes
        sort : [

            // Sort attribute as an object
            {
                // (Required) Field name or alias
                "name": "field1",
                // (Optional) True for ascending ordering. False for descending ordering. Default "true"
                "desc": true
            },

            // Field name or alias. Ascending ordering is implied.
            "field1"
        ],

        // (Optional) Number of records or features to skip before fetching data. Default 0.
        offset: 10,

        // (Optional) Maximum number of features or records returned. An implicit limit of
        // 1000 features or records is enforced by the server. Default -1.
        limit : 10
    }]
}
