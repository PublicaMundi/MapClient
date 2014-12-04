import logging

from pylons import config, request, response, session, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

from mapclient.lib.base import BaseController, render

from sqlalchemy import create_engine
from sqlalchemy.sql import text
from sqlalchemy.engine import ResultProxy

import json
import geojson

import shapely.wkb
import shapely.wkt
import shapely.geometry
import shapely.geometry.base

import numbers

log = logging.getLogger(__name__)

FORMAT_JSON = 'json'
FORMAT_GEOJSON = 'geojson'

OP_EQ = 'EQUAL'
OP_NOT_EQ = 'NOT_EQUAL'
OP_GT = 'GREATER'
OP_GET = 'GREATER_OR_EQUAL'
OP_LT = 'LESS'
OP_LET = 'LESS_OR_EQUAL'

OP_AREA = 'AREA'
OP_DISTANCE = 'DISTANCE'
OP_CONTAINS = 'CONTAINS'
OP_INTERSECTS = 'INTERSECTS'

COMPARE_OPERATORS = [OP_EQ, OP_NOT_EQ, OP_GT, OP_GET, OP_LT, OP_LET]
COMPARE_EXPRESSIONS = ['=', '<>', '>', '>=', '<', '<=']

SPATIAL_OPERATORS = [OP_AREA, OP_DISTANCE, OP_CONTAINS, OP_INTERSECTS]

ALL_OPERATORS = [OP_EQ, OP_NOT_EQ, OP_GT, OP_GET, OP_LT, OP_LET, OP_AREA, OP_DISTANCE, OP_CONTAINS, OP_INTERSECTS]

class DataApiException(Exception):
    def __init__(self, message):
        self.message = message

    def __str__(self):
        return repr(self.message)

class ShapelyJsonEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, shapely.geometry.base.BaseGeometry):
            return shapely.geometry.mapping(obj)
        return json.JSONEncoder.default(self, obj)

class ShapelyJsonDecoder(json.JSONDecoder):
    def decode(self, json_string):   
        def shapely_object_hook(obj):
            if 'coordinates' in obj and 'type' in obj:
                return shapely.geometry.shape(obj)
            return obj
        
        return json.loads(json_string, object_hook=shapely_object_hook)

class ShapelyGeoJsonEncoder(geojson.codec.GeoJSONEncoder):
    def default(self, obj):
        if isinstance(obj, shapely.geometry.base.BaseGeometry):
            return shapely.geometry.mapping(obj)
        return json.GeoJSONEncoder.default(self, obj)

class ApiController(BaseController):

    def _create_filter(self, metadata, mapping, f, srid):
        if not type(f) is dict:
            raise DataApiException('Filter must be a dictionary.')

        if not 'operator' in f:
            raise DataApiException('Parameter operator is missing from filter.')

        if not f['operator'] in ALL_OPERATORS:
            raise DataApiException('Operator {operator} is not supported.'.format(operator = f['operator']))

        if not 'arguments' in f:
            raise DataApiException('Parameter arguments is missing from filter.')

        if not type(f['arguments']) is list or len(f['arguments']) == 0:
            raise DataApiException('Parameter arguments must be a list with at least one member.')

        try:
            if f['operator'] in COMPARE_OPERATORS:
                index = COMPARE_OPERATORS.index(f['operator'])
                return self._create_filter_compare(metadata, mapping, f, f['operator'], COMPARE_EXPRESSIONS[index])
                
            if f['operator'] in SPATIAL_OPERATORS:
                return self._create_filter_spatial(metadata, mapping, f, f['operator'], srid)
                
        except ValueError as ex:
            raise DataApiException('Operator {operator} is not supported.'.format(operator = f['operator']))
            
        return None

    def _create_filter_compare(self, metadata, mapping, f, operator, expression):
        if len(f['arguments']) != 2:
            raise DataApiException('Operator {operator} expects two arguments.'.format(operator = operator))

        arg1 = f['arguments'][0]
        arg2 = f['arguments'][1]

        arg1_is_field = self._is_field(metadata, mapping, arg1)
        arg2_is_field = self._is_field(metadata, mapping, arg2)

        arg1_is_field_geom = self._is_field_geom(metadata, mapping, arg1)
        arg2_is_field_geom = self._is_field_geom(metadata, mapping, arg2)

        if arg1_is_field_geom or arg2_is_field_geom:
            raise DataApiException('Operator {operator} does not support geometry types.'.format(operator = operator))

        if arg1_is_field and arg2_is_field:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            return ('(' + aliased_arg1 + ' ' + expression + ' ' + aliased_arg2 + ')',)
        elif arg1_is_field and not arg2_is_field:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            return ('(' +aliased_arg1 + ' ' + expression + ' %s)', arg2)
        elif not arg1_is_field and arg2_is_field:
            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            return ('(' + aliased_arg2 + ' ' + expression + ' %s)', arg1)
        else:
            return ('(%s ' + expression + ' %s)', arg1, arg2)

    def _create_filter_spatial(self, metadata, mapping, f, operator, srid):
        if operator == OP_AREA:
            if len(f['arguments']) != 3:  
                raise DataApiException('Operator {operator} expects three arguments.'.format(operator = operator))        
            return self._create_filter_area(metadata, mapping, f, operator, srid)
        elif operator == OP_DISTANCE:
            if len(f['arguments']) != 4:  
                raise DataApiException('Operator {operator} expects four arguments.'.format(operator = operator))                
            return self._create_filter_distance(metadata, mapping, f, operator, srid)
        elif operator == OP_CONTAINS:
            if len(f['arguments']) != 2:  
                raise DataApiException('Operator {operator} expects two.'.format(operator = operator))        
            return self._create_filter_spatial_relation(metadata, mapping, f, operator, 'ST_Contains', srid)
        elif operator == OP_INTERSECTS:
            if len(f['arguments']) != 2:
                raise DataApiException('Operator {operator} expects two arguments.'.format(operator = operator))        
            return self._create_filter_spatial_relation(metadata, mapping, f, operator, 'ST_Intersects', srid)
            
    def _create_filter_area(self, metadata, mapping, f, operator, srid):
        arg1 = f['arguments'][0]
        arg2 = f['arguments'][1]
        arg3 = f['arguments'][2]
        
        if arg2 in COMPARE_OPERATORS:
            arg2 = COMPARE_EXPRESSIONS[COMPARE_OPERATORS.index(arg2)]
        else:
            raise DataApiException('Expression {expression} for operator {operator} is not valid.'.format(expression = arg2, operator = operator))
                
        arg1_is_field = self._is_field(metadata, mapping, arg1)
        arg1_srid = srid
        arg1_is_field_geom = self._is_field_geom(metadata, mapping, arg1)
        if arg1_is_field_geom:
            arg1_srid = self._get_field_srid(metadata, mapping, arg1)
        arg1_is_geom = self._is_geom(metadata, arg1)

        if not arg1_is_field_geom and not arg1_is_geom:
            raise DataApiException('First argument for operator {operator} must be a geometry field or a GeoJSON encoded geometry.'.format(operator = operator))

        if not isinstance(arg3, numbers.Number):
            raise DataApiException('Third argument for operator {operator} must be number.'.format(operator = operator))

        if arg1_is_field_geom:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            if arg1_srid != srid: 
                aliased_arg1 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg1,
                srid = srid
            )

            return ('(ST_Area(' + aliased_arg1 + ') ' + arg2 + ' %s)', arg3)
        else:
            return ('(ST_Area(ST_GeomFromText(%s, 3857)) ' + arg2 + ' %s)', shapely.wkt.dumps(arg1), arg3)

    def _create_filter_distance(self, metadata, mapping, f, operator, srid):
        arg1 = f['arguments'][0]
        arg2 = f['arguments'][1]
        arg3 = f['arguments'][2]
        arg4 = f['arguments'][3]

        if arg3 in COMPARE_OPERATORS:
            arg3 = COMPARE_EXPRESSIONS[COMPARE_OPERATORS.index(arg3)]
        else:
            raise DataApiException('Expression {expression} for operator {operator} is not valid.'.format(expression = arg3, operator = operator))
                
        arg1_is_field = self._is_field(metadata, mapping, arg1)
        arg2_is_field = self._is_field(metadata, mapping, arg2)

        arg1_srid = srid
        arg2_srid = srid

        arg1_is_field_geom = self._is_field_geom(metadata, mapping, arg1)
        if arg1_is_field_geom:
            arg1_srid = self._get_field_srid(metadata, mapping, arg1)

        arg2_is_field_geom = self._is_field_geom(metadata, mapping, arg2)
        if arg2_is_field_geom:
            arg2_srid = self._get_field_srid(metadata, mapping, arg2)

        arg1_is_geom = self._is_geom(metadata, arg1)
        arg2_is_geom = self._is_geom(metadata, arg2)

        if not arg1_is_field_geom and not arg1_is_geom:
            raise DataApiException('First argument for operator {operator} must be a geometry field or a GeoJSON encoded geometry.'.format(operator = OP_DISTANCE))

        if not arg2_is_field_geom and not arg2_is_geom:
            raise DataApiException('Second argument for operator {operator} must be a geometry field or a GeoJSON encoded geometry.'.format(operator = OP_DISTANCE))

        if not isinstance(arg4, numbers.Number):
            raise DataApiException('Third argument for operator {operator} must be number.'.format(operator = OP_DISTANCE))

        if arg1_is_field_geom and arg2_is_field_geom:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            if arg1_srid != srid: 
                aliased_arg1 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg1,
                srid = srid
            )

            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            if arg2_srid != srid: 
                aliased_arg2 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg2,
                srid = srid
            )
            return ('(ST_Distance(' + aliased_arg1 + ',' + aliased_arg2 + ') ' + arg3 + ' %s)', arg4)
        elif arg1_is_field_geom and not arg2_is_field_geom:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            if arg1_srid != srid: 
                aliased_arg1 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg1,
                srid = srid
            )
            return ('(ST_Distance(' + aliased_arg1 + ', ST_GeomFromText(%s, 3857)) ' + arg3 + ' %s)', shapely.wkt.dumps(arg2), arg4)
        elif not arg1_is_field_geom and arg2_is_field_geom:
            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            if arg2_srid != srid: 
                aliased_arg2 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg2,
                srid = srid
            )
            return ('(ST_Distance(' + aliased_arg2 + ', ST_GeomFromText(%s, 3857)) ' + arg3 + ' %s)', shapely.wkt.dumps(arg1), arg4)
        else:
            return ('(ST_Distance(ST_GeomFromText(%s, 3857), ST_GeomFromText(%s, 3857)) ' + arg3 + ' %s)', shapely.wkt.dumps(arg1), shapely.wkt.dumps(arg2), arg4)

    def _create_filter_spatial_relation(self, metadata, mapping, f, operator, spatial_operator, srid):
        arg1 = f['arguments'][0]
        arg2 = f['arguments'][1]
        
        arg1_is_field = self._is_field(metadata, mapping, arg1)
        arg2_is_field = self._is_field(metadata, mapping, arg2)

        arg1_srid = srid
        arg2_srid = srid

        arg1_is_field_geom = self._is_field_geom(metadata, mapping, arg1)
        if arg1_is_field_geom:
            arg1_srid = self._get_field_srid(metadata, mapping, arg1)

        arg2_is_field_geom = self._is_field_geom(metadata, mapping, arg2)
        if arg2_is_field_geom:
            arg2_srid = self._get_field_srid(metadata, mapping, arg2)

        arg1_is_geom = self._is_geom(metadata, arg1)
        arg2_is_geom = self._is_geom(metadata, arg2)

        if not arg1_is_field_geom and not arg1_is_geom:
            raise DataApiException('First argument for operator {operator} must be a geometry field or a GeoJSON encoded geometry.'.format(operator = OP_DISTANCE))

        if not arg2_is_field_geom and not arg2_is_geom:
            raise DataApiException('Second argument for operator {operator} must be a geometry field or a GeoJSON encoded geometry.'.format(operator = OP_DISTANCE))

        if arg1_is_field_geom and arg2_is_field_geom:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            if arg1_srid != srid: 
                aliased_arg1 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg1,
                srid = srid
            )

            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            if arg2_srid != srid: 
                aliased_arg2 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg2,
                srid = srid
            )
            return ('(' + spatial_operator +'(' + aliased_arg1 + ',' + aliased_arg2 + ') = TRUE)', )
        elif arg1_is_field_geom and not arg2_is_field_geom:
            aliased_arg1 = '{table}."{field}"'.format(
                table = metadata[mapping[arg1['resource']]]['alias'],
                field = arg1['name']
            )
            if arg1_srid != srid: 
                aliased_arg1 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg1,
                srid = srid
            )
            return ('(' + spatial_operator +'(' + aliased_arg1 + ', ST_GeomFromText(%s, 3857)) = TRUE)', shapely.wkt.dumps(arg2))
        elif not arg1_is_field_geom and arg2_is_field_geom:
            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            if arg2_srid != srid: 
                aliased_arg2 = 'ST_Transform({field}, {srid})'.format(
                field = aliased_arg2,
                srid = srid
            )
            return ('(' + spatial_operator +'(ST_GeomFromText(%s, 3857), ' + aliased_arg2 + ') = TRUE)', shapely.wkt.dumps(arg1))
        else:
            return ('(' + spatial_operator +'(ST_GeomFromText(%s, 3857), ST_GeomFromText(%s, 3857))  = TRUE)', shapely.wkt.dumps(arg1), shapely.wkt.dumps(arg2))

    def _is_field(self, metadata, mapping, f):
        if f is None:
            return False

        if not type(f) is dict:
            return False

        if not 'name' in f:
            return False
       
        if 'resource' in f and (not f['resource'] in mapping or not mapping[f['resource']] in metadata):
            raise DataApiException('Resource {resource} does not exist.'.format(resource = f['resource']))

        # Set default resource of arguments if not already set
        if not 'resource' in f:
            resources = self._get_resources_by_field_name(metadata, f['name'])
            if len(resources) == 0:
                raise DataApiException(u'Field {field} does not exist.'.format(
                    field = f['name']
                ))
            elif len(resources) == 1:
                f['resource'] = resources[0]
            else:
                raise DataApiException(u'Field {field} is ambiguous for resources {resources}.'.format(
                    field = f['name'],
                    resources = u','.join(resources)
                ))

        if not f['name'] in metadata[mapping[f['resource']]]['fields']:
            raise DataApiException('Field {field} does not belong to resource {resource}.'.format(field = f['name'], resource = f['resource']))

        return True

    def _is_field_geom(self, metadata, mapping, f):
        if not self._is_field(metadata, mapping, f):
            return False

        if f['name'] == metadata[mapping[f['resource']]]['geometry_column']:
            return True

        return False

    def _get_field_srid(self, metadata, mapping, f):
        if not self._is_field_geom(metadata, mapping, f):
            return None

        return metadata[mapping[f['resource']]]['srid']

    def _is_geom(self, metadata, f):
        return isinstance(f, shapely.geometry.base.BaseGeometry)

    def _format_response(self, response, callback=None, format=FORMAT_JSON):
        if not callback is None:
            if format == FORMAT_GEOJSON:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = geojson.dumps(response, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
                )
            else:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = json.dumps(response, cls=ShapelyJsonEncoder, encoding='utf-8')
                )
        if format == FORMAT_GEOJSON:
            return geojson.dumps(response, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
        else:
            return json.dumps(response, cls=ShapelyJsonEncoder, encoding='utf-8')

    def _get_resources_by_field_name(self, metadata, field):
        resources = []

        for resource in metadata:
            if field in metadata[resource]['fields']:
                resources.append(resource)

        return resources

    def query(self):
        query = None
        callback = None

        method = request.environ["REQUEST_METHOD"]
        
        if method == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
                callback = request.params['callback']
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
    
        engine_ckan = None
        connection_ckan = None
        engine_data = None
        connection_data = None
        srid = 3857
        timeout = 10000
        offset = 0
        limit = 1000
        result = {
            'success': True,
            'message': None,
            'records': []
        }
        output_format = FORMAT_JSON
        count_geom_columns = 0;

        metadata = {
        }

        parsed_query = {
            'resources' : {},
            'fields': {},
            'filters' : []
        }

        try:
            # Parse request
            if method == 'POST':
                query = json.loads(request.body, cls=ShapelyJsonDecoder, encoding=request.charset)
            else:
                if not 'query' in request.params:
                    return self._format_response({
                        'success': False,
                        'message': 'Parameter query is required.'
                    }, callback)

                query = json.loads(request.params['query'], cls=ShapelyJsonDecoder, encoding=request.charset)

            # Set format
            if 'format' in query:
                if not query['format'] in [FORMAT_JSON, FORMAT_GEOJSON]:
                    return self._format_response({
                        'success': False,
                        'message': 'Output format {format} is not supported.'.format(format = query['format'])
                    }, callback)

                output_format = query['format']

            # Initialize database
            engine_ckan = create_engine(config['dataapi.sqlalchemy.catalog'], echo=True)
            engine_data = create_engine(config['dataapi.sqlalchemy.vectorstore'], echo=True)
            connection_ckan = engine_ckan.connect()
            connection_data = engine_data.connect()

            # Get limit
            if 'limit' in query:
                if not isinstance(query['limit'], numbers.Number):
                    raise DataApiException('Parameter limit must be number.')
                if query['limit'] < limit and query['limit'] > 0 :
                    limit = query['limit']

            # Get offset
            if 'offset' in query:
                if not isinstance(query['offset'], numbers.Number):
                    raise DataApiException('Parameter offset must be number.')
                if query['offset'] >= 0:
                    offset = query['offset']

            # Get resources
            if not 'resources' in query:
                return self._format_response({
                    'success': False,
                    'message': 'No resource selected.'
                }, callback)
            

            if not type(query['resources']) is list:
                return self._format_response({
                    'success': False,
                    'message': 'Parameter resource should be a list with at least one resource.'
                }, callback)

            db_resources = self._resource_show(connection_ckan)

            resource_mapping = {}
            
            resource_count = 0
            for resource in query['resources']:
                db_resource = None
                
                resource_name = None
                resource_alias = None
                
                if type(resource) is dict:
                    if 'name' in resource:
                        resource_name = resource['name']
                    else:
                        return self._format_response({
                            'success': False,
                            'message': 'Resource name is missing.'
                        }, callback)
                    if 'alias' in resource:
                        resource_alias = resource['alias']
                    else:
                        resource_alias = resource_name
                else:
                    resource_name = resource
                    resource_alias = resource

                resource_mapping[resource_name] = resource_name
                resource_mapping[resource_alias] = resource_name
                
                if resource_name in db_resources:
                    db_resource = db_resources[resource_name]

                    # Add alias
                    resource_count += 1 
                    db_resource['alias'] = 't{index}'.format(index = resource_count)

                    # Add fields
                    db_fields = self._resource_describe(connection_data, resource_name)
                    db_resource['srid'] = db_fields['srid']
                    db_resource['geometry_column'] = db_fields['geometry_column']
                    db_resource['fields'] = db_fields['fields']
                   
                    # Add resource metadata
                    metadata[resource_name] = db_resource

                    parsed_query['resources'][resource_name] = {
                        'table' : db_resource['table'],
                        'alias' : db_resource['alias']
                    }
                else:
                    return self._format_response({
                        'success': False,
                        'message': 'Resource {resource} does not exist.'.format(
                            resource = resource_name
                        )
                    }, callback)
           
            # If no fields are selected, all fields are added to the response.
            # This may result in some fields names being ambiguous.
            addAllFields = False
            if not 'fields' in query:
                addAllFields = True
            elif not type(query['fields']) is list:
                return self._format_response({
                    'success': False,
                    'message': 'Parameter fields should be a list with at least one field.'
                }, callback)
            elif len(query['fields']) == 0:
                addAllFields = True

            if addAllFields:
                query['fields'] = []
                for resource in metadata:
                    for field in metadata[resource]['fields']:
                        query['fields'].append({
                            'resource' : resource,
                            'name' :  metadata[resource]['fields'][field]['name']
                        })

            # Get fields
            if len(query['fields']) > 0:
                for i in range(0, len(query['fields'])):
                    query_field = query['fields'][i]

                    if not 'alias' in query_field:
                        query_field['alias'] = query_field['name']

                    # Set resource if not set
                    if not 'resource' in query_field:
                        resources = self._get_resources_by_field_name(metadata, query_field['name'])
                        if len(resources) == 0:
                            return self._format_response({
                                'success': False,
                                'message': u'Field {field} does not exist.'.format(
                                    field = query_field['name']
                                )
                            }, callback)
                        elif len(resources) == 1:
                            query_field['resource'] = resources[0]
                        else:
                            return self._format_response({
                                'success': False,
                                'message': u'Field {field} is ambiguous for resources {resources}.'.format(
                                    field = query_field['name'],
                                    resources = u','.join(resources)
                                )
                            }, callback)

                    if not query_field['resource'] in resource_mapping or not resource_mapping[query_field['resource']] in metadata:
                        return self._format_response({
                            'success': False,
                            'message': u'Resource {resource} for field {field} does not exist.'.format(
                                resource = query_field['resource'],
                                field = query_field['name']
                            )
                        }, callback)

                    db_resource = metadata[resource_mapping[query_field['resource']]]

                    if query_field['name'] in db_resource['fields']:
                        db_field = db_resource['fields'][query_field['name']]

                        if query_field['alias'] in parsed_query['fields']:
                            return self._format_response({
                                'success': False,
                                'message': 'Field {field} in resource {resource} is ambiguous.'.format(
                                    field = db_field['name'],
                                    resource = query_field['resource']
                                )
                            }, callback)

                        parsed_query['fields'][query_field['alias']] = {
                            'fullname' : '{table}."{field}"'.format(
                                table = db_resource['alias'],
                                field = db_field['name']
                            ),
                            'name' : db_field['name'],
                            'alias' : query_field['alias'],
                            'type' : db_field['type'],
                            'is_geom' : True if db_field['name'] == db_resource['geometry_column'] else False,
                            'srid' :  db_resource['srid'] if db_field['name'] == db_resource['geometry_column'] else None
                        }
                    else:
                        return self._format_response({
                            'success': False,
                            'message': 'Field {field} does not exist in resource {resource}.'.format(
                                field = query_field['name'],
                                resource = query_field['resource']
                            )
                        }, callback)
            else:
                # TODO : Allow users to select whole tables
                return self._format_response({
                    'success': False,
                    'message': 'At least one field must be selected.'.format(
                        resource = resource
                    )
                }, callback)

            if output_format == FORMAT_GEOJSON:
                count_geom_columns = reduce(lambda x, y: x+y, [1 if parsed_query['fields'][field]['is_geom'] else 0 for field in parsed_query['fields'].keys()])
                if count_geom_columns != 1:
                    return self._format_response({
                        'success': False,
                        'message': 'Format {format} requires only one geometry column'.format(
                            format = output_format
                        )
                    }, callback)

            # Get constraints
            if 'filters' in query and not type(query['filters']) is list:
                return self._format_response({
                    'success': False,
                    'message': 'Parameter filters should be a list with at least one field.'
                }, callback)

            if 'filters' in query and len(query['filters']) > 0:
                for f in query['filters']:
                    try:
                        parsed_query['filters'].append(self._create_filter(metadata, resource_mapping, f, srid))
                    except DataApiException as ex:
                        return self._format_response({
                            'success': False,
                            'message': ex.message
                        }, callback)

            # Build SQL command
            fields = []
            for field in parsed_query['fields'].keys():
                if parsed_query['fields'][field]['is_geom'] and parsed_query['fields'][field]['srid'] != srid:
                    parsed_query['fields'][field]['fullname']
                    fields.append('ST_Transform({geom}, {srid}) as "{alias}"'.format(
                        geom = parsed_query['fields'][field]['fullname'],
                        srid = srid,
                        alias = parsed_query['fields'][field]['alias']
                    ))
                else:
                    fields.append('{field} as "{alias}"'.format(
                        field = parsed_query['fields'][field]['fullname'],
                        alias = parsed_query['fields'][field]['alias']
                    ))

            tables = [ '"' + parsed_query['resources'][r]['table'] + '" as ' + parsed_query['resources'][r]['alias'] for r in parsed_query['resources'].keys()]

            for resource in parsed_query['resources'].keys():
                if not metadata[resource]['geometry_column'] is None and\
                   not metadata[resource]['srid'] is None:
                    pass
                    
            wheres = []
            values = ()
            where_clause = None

            if len(parsed_query['filters']) > 0:
                for where_and_value in parsed_query['filters']:
                    wheres.append(where_and_value[0])
                    values += where_and_value[1:]

            if len(wheres) > 0: 
                where_clause = u'WHERE ' +u' AND '.join(wheres)

            if where_clause is None:
                where_clause = ''

            sql = "select distinct {fields} from {tables} {where} limit {limit} offset {offset}".format(
                fields = u','.join(fields),
                tables = u','.join(tables),
                where = where_clause,
                limit = limit,
                offset = offset
            )

            connection_data.execute(u'SET LOCAL statement_timeout TO {0}'.format(timeout))
            records = connection_data.execute(sql, values)
 
            if output_format == FORMAT_GEOJSON:
                # Add GeoJSON records
                feature_id = 0
                for r in records:
                    feature_id += 1
                    feature = {
                        'id' : feature_id,
                        'properties': {},
                        'geometry': None,
                        'type': 'Feature'
                    }
                    for field in parsed_query['fields'].keys():
                        if parsed_query['fields'][field]['is_geom']:
                            feature['geometry'] = shapely.wkb.loads(r[field].decode("hex"))
                        else:
                            feature['properties'][field] = r[field]
                    result['records'].append(feature)
            else:
                # Add flat json records
                for r in records:
                    record = {}
                    for field in parsed_query['fields'].keys():
                        if parsed_query['fields'][field]['is_geom']:
                            record[field] = shapely.wkb.loads(r[field].decode("hex"))
                        else:
                            record[field] = r[field]
                    result['records'].append(record)

        except DataApiException as dEx:
            return self._format_response({
                'success': False,
                'message': dEx.message
            }, callback)
        except Exception as ex:
            log.error(ex)
        finally:
            if not connection_ckan is None:
                connection_ckan.close()
            if not connection_data is None:
                connection_data.close()

        if output_format == FORMAT_GEOJSON:
            featureCollection = {
                'features': result['records'], 
                'type': 'FeatureCollection'
            }
            return self._format_response(featureCollection, callback, output_format)

        return self._format_response(result, callback)

    def _resource_show(self, connection):
        resources = None
        result = {}

        try:
            sql = u"""
                select	resource_db.resource_id as db_resource_id,
                        resource_wms.resource_id as wms_resource_id,
                        resource_db.geometry_type as geometry_type
                from 
                    (
                    select	id as resource_id,
                        json_extract_path_text((extras::json),'vectorstorer_resource') as vector_storer,
                        json_extract_path_text((extras::json),'geometry') as geometry_type,
                        json_extract_path_text((extras::json),'parent_resource_id') as resource_parent_id
                    from	resource as child
                    where	format = 'data_table' and 
                            state = 'active' and
                            json_extract_path_text((extras::json),'vectorstorer_resource')  = 'True'
                    ) as resource_db
                    inner join
                    (
                    select	id as resource_id,
                        json_extract_path_text((extras::json),'vectorstorer_resource') as vector_storer,
                        json_extract_path_text((extras::json),'geometry') as ggeometry_type,
                        json_extract_path_text((extras::json),'parent_resource_id') as resource_parent_id
                    from	resource as child
                    where	format = 'wms' and 
                            state = 'active' and
                            json_extract_path_text((extras::json),'vectorstorer_resource')  = 'True'
                    ) as resource_wms
                    on resource_db.resource_id = resource_wms.resource_parent_id;
            """

            resources = connection.execute(sql)
            for resource in resources:
                result[resource['db_resource_id'].decode('utf-8')] = {
                    'table': resource['db_resource_id'].decode('utf-8'),
                    'wms': resource['wms_resource_id'].decode('utf-8'),
                    'geometry_type': resource['geometry_type']
                }
        finally:
            if not resources is None:
                resources.close()

        return result

    def resource_show(self):
        method = request.environ["REQUEST_METHOD"]
        callback = None
        
        if method == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
                callback = request.params['callback']
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
        
        result = None
        engine = None
        connection = None
        result = []

        try:
            engine = create_engine(config['dataapi.sqlalchemy.catalog'], echo=True)

            connection = engine.connect()

            resources = self._resource_show(connection)
            
            result = {
                "success" : True,
                "message" : None,
                "resources" : resources
            }
        except Exception as ex:
            log.error(ex)
            result = {
                "success" : False,
                "message" : u'Failed to load metadata for resources.',
                "resource": None
            }
        finally:
            if not connection is None:
                connection.close()

        if not callback is None:
            return '{callback}({json});'.format(
                    callback = callback,
                    json = json.dumps(result, encoding='utf-8')
            )
            
        return json.dumps(result, encoding='utf-8')

    def _resource_describe(self, connection, id):
        fields = None
        result = {}
        geometry_column = None
        srid = None

        try:
            sql = text(u"""
                SELECT	attname::varchar as "name",
	                    pg_type.typname::varchar as "type",
    	                pg_attribute.attnum as "position",
    	                geometry_columns.srid as srid
                FROM	pg_class
	    	                inner join pg_attribute
	    		                on pg_attribute.attrelid = pg_class.oid
	    	                inner join pg_type
	    		                on pg_attribute.atttypid = pg_type.oid
	    	                left outer join geometry_columns
	    		                on geometry_columns.f_table_name = pg_class.relname and
	    		                   pg_type.typname = 'geometry'
                WHERE	pg_attribute.attisdropped = False and
    	                pg_class.relname = :resource and
    	                pg_attribute.attnum > 0
            """)

            fields = connection.execute(sql, resource = id).fetchall()
            for field in fields:
                if field['name'].decode('utf-8').startswith('_'):
                    continue

                result[field['name'].decode('utf-8')] = {
                    'name': field['name'].decode('utf-8'),
                    'type': field['type'].decode('utf-8')
                }

                if not field['srid'] is None:
                    if not srid is None:
                        raise DataApiException('More than 1 geometry columns found in resource {id}'.format(id = id))

                    geometry_column = field['name'].decode('utf-8')
                    srid = field['srid']
        finally:
            pass

        return {
            "fields" : result,
            "srid": srid,
            "geometry_column" : geometry_column
        }

    def resource_describe(self, id):     
        method = request.environ["REQUEST_METHOD"]
        callback = None
        
        if method == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
                callback = request.params['callback']
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'

        result = None
        engine = None
        connection = None
        fields = None

        try:
            engine = create_engine(config['dataapi.sqlalchemy.vectorstore'], echo=True)
            connection = engine.connect()

            fields = self._resource_describe(connection, id)
            
            result = {
                "success" : True,
                "message" : None,
                "resource": {
                    "id" : id,
                    "fields" : fields['fields'],
                    "srid": fields['srid'],
                    "geometry_column" : fields['geometry_column']
                }
            }
        except Exception as ex:
            log.error(ex)
            result = {
                "success" : False,
                "message" : u'Failed to load resource {resource} metadata.'.format(resource = resource),
                "resource": None
            }
        finally:
            if not connection is None:
                connection.close()

        if not callback is None:
            return '{callback}({json});'.format(
                    callback = callback,
                    json = json.dumps(result, encoding='utf-8')
            )
            
        return json.dumps(result, encoding='utf-8')
