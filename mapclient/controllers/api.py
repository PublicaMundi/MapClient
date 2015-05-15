import logging

from pylons import config, request, response, session, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

from mapclient.lib.base import BaseController, render

from sqlalchemy import create_engine
from sqlalchemy.sql import text
from sqlalchemy.engine import ResultProxy
from sqlalchemy.exc import ProgrammingError, IntegrityError, DBAPIError, DataError

import json
import geojson

import shapely.wkb
import shapely.wkt
import shapely.geometry
import shapely.geometry.base

import numbers
import os
import tempfile
import shutil
import zipfile
import uuid
import string

from mapclient.lib.ogr2ogr import main as ogr_export

log = logging.getLogger(__name__)

FORMAT_JSON = 'json'
FORMAT_GEOJSON = 'geojson'

ACTION_QUERY = 'query'
ACTION_EXPORT = 'export'

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

# See http://www.postgresql.org/docs/9.3/static/errcodes-appendix.html
_PG_ERR_CODE = {
    'query_canceled': '57014',
    'undefined_object': '42704',
    'syntax_error': '42601',
    'permission_denied': '42501'
}

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
        arg1_type = None
        if arg1_is_field:
            arg1_type = self._get_field_type(metadata, mapping, arg1)

        arg2_is_field = self._is_field(metadata, mapping, arg2)
        arg2_type = None
        if arg2_is_field:
            arg2_type = self._get_field_type(metadata, mapping, arg2)

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
            convert_to = ''
            if arg1_type == 'varchar' and isinstance(arg2, numbers.Number):
                if isinstance(arg2, int):
                    convert_to = '::int'
                if isinstance(arg2, float):
                    convert_to = '::float'

            return ('(' +aliased_arg1 + convert_to + ' ' + expression + ' %s)', arg2)
        elif not arg1_is_field and arg2_is_field:
            aliased_arg2 = '{table}."{field}"'.format(
                table = metadata[mapping[arg2['resource']]]['alias'],
                field = arg2['name']
            )
            convert_to = ''
            if arg2_type == 'varchar' and isinstance(arg1, numbers.Number):
                if isinstance(arg1, int):
                    convert_to = '::int'
                if isinstance(arg1, float):
                    convert_to = '::float'

            return ('(' + aliased_arg2 + convert_to  + ' ' + expression + ' %s)', arg1)
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

    def _get_field_type(self, metadata, mapping, f):
        if not self._is_field(metadata, mapping, f):
            return None

        return metadata[mapping[f['resource']]]['fields'][f['name']]['type'] 

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

    #https://gist.github.com/seanh/93666
    def _format_filename(self, filename):
        """Take a string and return a valid filename constructed from the string.
    Uses a whitelist approach: any characters not present in valid_chars are
    removed. Also spaces are replaced with underscores.
     
    Note: this method may produce invalid filenames such as ``, `.` or `..`
    When I use this method I prepend a date string like '2009_01_15_19_46_32_'
    and append a file extension like '.txt', so I avoid the potential of using
    an invalid filename.
     
    """
        valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
        filename = ''.join(c for c in filename if c in valid_chars)
        filename = filename.replace(' ','_') # I don't like spaces in filenames.
        return filename
    
    def download(self):
        method = request.environ["REQUEST_METHOD"]
        
        if method == 'GET' and 'code' in request.params and request.params['code'] in session:
            response.headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
            response.headers['Content-Disposition'] = 'attachment; filename="export.zip"'
            
            filename = session[request.params['code']]

            with open(filename, 'r') as f:
                shutil.copyfileobj(f, response)
            
            shutil.rmtree(os.path.dirname(filename))
            
            del session[request.params['code']]

    def export(self):
        try:
            result = self._execute_collection(ACTION_EXPORT)
            
            files = result['files']
            
            result = {
                'data': result['data'],
                'success': True,
                'message': None
            }
            
            path = tempfile.mkdtemp()
            token = str(uuid.uuid4())

            index = 1
            for i in range(0, len(result['data'])):
                filename = 'export' + str(index)
                if not files is None and files[i]:
                    filename = files[i]

                if len(result['data'][i]['features']) > 0:
                    self._export_partial_result(self._format_response(result['data'][i], None, FORMAT_GEOJSON), path, filename)
                    index+=1
            
            f_output_zipped = os.path.join(path, 'exported-layers.zip')
            
            self._zip_folder(path, f_output_zipped)
            
            session[token] = f_output_zipped
            session.save()
            
            response = { 'success' : True, 'code' : token, 'message' : None }
                   
            return json.dumps(response, encoding='utf-8')
        
        except DataApiException as apiEx:
            return self._format_response({
                'success': False,
                'message': apiEx.message
            }, None)
        except DBAPIError as dbEx:
            log.error(dbEx)

            message = 'Unhandled exception has occured.'
            if dbEx.orig.pgcode == _PG_ERR_CODE['query_canceled']:
                message = 'Execution exceeded timeout.'

            return self._format_response({
                'success': False,
                'message': message,
                'details': (dbEx.message if config['dataapi.error.details'] else '')
            }, None)
        except Exception as ex:
            log.error(ex)
            return self._format_response({
                'success': False,
                'message': 'Unhandled exception has occured.',
                'details': (ex.message if config['dataapi.error.details'] else '')
            }, None)
        
    def query(self):
        callback = None
        try:
            result = self._execute_collection(ACTION_QUERY)
            
            
            output_format = result['format']
            callback = result['callback']
           
            result = {
                'data': result['data'],
                'success': True,
                'message': None
            }
            
            if output_format == FORMAT_GEOJSON:
                return self._format_response(result, callback, output_format)

            return self._format_response(result, callback)
        
        except DataApiException as apiEx:
            return self._format_response({
                'success': False,
                'message': apiEx.message
            }, callback)
        except DBAPIError as dbEx:
            log.error(dbEx)

            message = 'Unhandled exception has occured.'
            if dbEx.orig.pgcode == _PG_ERR_CODE['query_canceled']:
                message = 'Execution exceeded timeout.'

            return self._format_response({
                'success': False,
                'message': message,
                'details': (dbEx.message if config['dataapi.error.details'] else '')
            }, callback)
        except Exception as ex:
            log.error(ex)
            return self._format_response({
                'success': False,
                'message': 'Unhandled exception has occured.',
                'details': (ex.message if config['dataapi.error.details'] else '')
            }, callback)
        
    def _execute_collection(self, action):
        query = None
        callback = None
        output_format = FORMAT_GEOJSON
        
        method = request.environ["REQUEST_METHOD"]
        
        if method == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
                callback = request.params['callback']
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'

        # Parse request
        if method == 'POST':
            query = json.loads(request.body, cls=ShapelyJsonDecoder, encoding=request.charset)
        else:
            if not 'query' in request.params:
                raise DataApiException('Parameter query is required.')

            query = json.loads(request.params['query'], cls=ShapelyJsonDecoder, encoding=request.charset)

        # Set format
        if 'format' in query:
            if not query['format'] in [FORMAT_JSON, FORMAT_GEOJSON]:
                raise DataApiException('Output format {format} is not supported.'.format(format = query['format']))

            output_format = query['format']

        # Get queue
        if not 'queue' in query:
            raise DataApiException('Parameter queue is required.')

        if not type(query['queue']) is list or len(query['queue']) == 0:
            raise DataApiException('Parameter queue should be a list with at least one item.')

        # Check filenames
        files = None
        if action == ACTION_EXPORT and 'files' in query:
            if not type(query['files']) is list:
                raise DataApiException('Parameter files should be a list with at least one item.')
            if len(query['queue']) <> len(query['files']):
                raise DataApiException('Arrays queue and files should be of the same length.')
            for i in range(0, len(query['files'])):
                query['files'][i] = self._format_filename(query['files'][i])
            if  len(query['files'])!=len(set(query['files'])):
                raise DataApiException('Filenames must be unique.')
            files = query['files']

        result = []
        for q in query['queue']:
            partial_result = self._execute(q, output_format)
        
            if output_format == FORMAT_GEOJSON:
                partial_result = {
                    'features': partial_result['records'], 
                    'type': 'FeatureCollection'
                }
            
            result.append(partial_result)

        return {
            'data': result,
            'success': True,
            'message': None,
            'format': output_format,
            'callback': callback,
            'files': files
        }

    def _execute(self, query, output_format):  
        engine_ckan = None
        connection_ckan = None
        
        engine_data = None
        connection_data = None
        
        srid = 3857
        timeout = config['dataapi.timeout'] if 'dataapi.timeout' in config else 10000
        offset = 0
        limit = 10000
        result = {
            'success': True,
            'message': None,
            'records': []
        }

        count_geom_columns = 0;

        metadata = {
        }

        parsed_query = {
            'resources' : {},
            'fields': {},
            'filters' : [],
            'sort' : []
        }

        try:
            # Initialize database
            engine_ckan = create_engine(config['dataapi.sqlalchemy.catalog'], echo=True)
            engine_data = create_engine(config['dataapi.sqlalchemy.vectorstore'], echo=True)
            connection_ckan = engine_ckan.connect()
            connection_data = engine_data.connect()

            # Get limit
            if 'limit' in query:
                if not isinstance(query['limit'], numbers.Number):
                    raise DataApiException('Parameter limit must be a number.')
                if query['limit'] < limit and query['limit'] > 0 :
                    limit = query['limit']

            # Get offset
            if 'offset' in query:
                if not isinstance(query['offset'], numbers.Number):
                    raise DataApiException('Parameter offset must be a number.')
                if query['offset'] >= 0:
                    offset = query['offset']

            # Get resources
            if not 'resources' in query:
                raise DataApiException('No resource selected.')

            if not type(query['resources']) is list:
                raise DataApiException('Parameter resource should be a list with at least one item.')

            db_resources = self._get_resources(connection_ckan)

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
                        raise DataApiException('Resource name is missing.')
                    if 'alias' in resource:
                        resource_alias = resource['alias']
                    else:
                        resource_alias = resource_name
                elif isinstance(resource, basestring):
                    resource_name = resource
                    resource_alias = resource
                else:
                    raise DataApiException('Resource parameter is malformed. Instance of string or dictionary is expected.')

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
                    raise DataApiException('Resource {resource} does not exist.'.format(
                        resource = resource_name
                    ))
           
            # If no fields are selected, all fields are added to the response.
            # This may result in some fields names being ambiguous.
            addAllFields = False
            if not 'fields' in query:
                addAllFields = True
            elif not type(query['fields']) is list:
                raise DataApiException('Parameter fields should be a list.')
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
            for i in range(0, len(query['fields'])):
                field_resource = None
                field_name = None
                field_alias = None

                if type(query['fields'][i]) is dict:
                    if 'name' in query['fields'][i]:
                        field_name = query['fields'][i]['name']
                    else:
                        raise DataApiException('Field name is missing.')
                    if 'alias' in query['fields'][i]:
                        field_alias = query['fields'][i]['alias']
                    else:
                        field_alias = field_name
                    if 'resource' in query['fields'][i]:
                        field_resource = query['fields'][i]['resource']
                elif isinstance(query['fields'][i], basestring):
                    field_name = query['fields'][i]
                    field_alias = query['fields'][i]
                else:
                    raise DataApiException('Field is malformed. Instance of string or dictionary is expected.')

                # Set resource if not set
                if field_resource is None:
                    resources = self._get_resources_by_field_name(metadata, field_name)
                    if len(resources) == 0:
                        raise DataApiException(u'Field {field} does not exist.'.format(
                            field = field_name
                        ))
                    elif len(resources) == 1:
                        field_resource = resources[0]
                    else:
                        raise DataApiException(u'Field {field} is ambiguous for resources {resources}.'.format(
                            field = field_name,
                            resources = u','.join(resources)
                        ))

                if not field_resource in resource_mapping or not resource_mapping[field_resource] in metadata:
                    raise DataApiException(u'Resource {resource} for field {field} does not exist.'.format(
                        resource = field_resource,
                        field = field_name
                    ))

                db_resource = metadata[resource_mapping[field_resource]]

                if field_name in db_resource['fields']:
                    db_field = db_resource['fields'][field_name]

                    if field_alias in parsed_query['fields']:
                       raise DataApiException(u'Field {field} in resource {resource} is ambiguous.'.format(
                            field = db_field['name'],
                            resource = field_resource
                        ))

                    parsed_query['fields'][field_alias] = {
                        'fullname' : '{table}."{field}"'.format(
                            table = db_resource['alias'],
                            field = db_field['name']
                        ),
                        'name' : db_field['name'],
                        'alias' : field_alias,
                        'type' : db_field['type'],
                        'is_geom' : True if db_field['name'] == db_resource['geometry_column'] else False,
                        'srid' :  db_resource['srid'] if db_field['name'] == db_resource['geometry_column'] else None
                    }
                else:
                    raise DataApiException(u'Field {field} does not exist in resource {resource}.'.format(
                        field = field_name,
                        resource = field_resource
                    ))

            # Check the number of geometry columns
            if output_format == FORMAT_GEOJSON:
                count_geom_columns = reduce(lambda x, y: x+y, [1 if parsed_query['fields'][field]['is_geom'] else 0 for field in parsed_query['fields'].keys()])
                if count_geom_columns != 1:
                    raise DataApiException(u'Format {format} requires only one geometry column'.format(
                        format = output_format
                    ))

            # Get constraints
            if 'filters' in query and not type(query['filters']) is list:
                raise DataApiException(u'Parameter filters should be a list with at least one item.')

            if 'filters' in query and len(query['filters']) > 0:
                for f in query['filters']:
                    parsed_query['filters'].append(self._create_filter(metadata, resource_mapping, f, srid))

            # Get order by
            if 'sort' in query:
                if not type(query['sort']) is list:
                    raise DataApiException('Parameter sort should be a list.')
                elif len(query['sort']) > 0:
                    for i in range(0, len(query['sort'])):
                        # Get sort field properties
                        sort_resource = None
                        sort_name = None
                        sort_alias = None
                        sort_desc = False

                        if type(query['sort'][i]) is dict:
                            if 'name' in query['sort'][i]:
                                sort_name = query['sort'][i]['name']
                                sort_alias = sort_name
                            else:
                                raise DataApiException('Sorting field name is missing.')
                            if 'resource' in query['sort'][i]:
                                sort_resource = query['sort'][i]['resource']
                            if 'desc' in query['sort'][i] and isinstance(query['sort'][i]['desc'], bool):
                                sort_desc = query['sort'][i]['desc']
                        elif isinstance(query['sort'][i], basestring):
                            sort_name = query['sort'][i]
                            sort_alias = sort_name
                        else:
                            raise DataApiException('Sorting field is malformed. Instance of string or dictionary is expected.')

                        # Check if a field name or an alias is specified. In the latter case, set the database field name
                        if sort_name in parsed_query['fields']:
                            if parsed_query['fields'][sort_name]['name'] != sort_name:
                               sort_name = parsed_query['fields'][sort_name]['name'] 

                        # Set resource if missing
                        if sort_resource is None:
                            resources = self._get_resources_by_field_name(metadata, sort_name)

                            if len(resources) == 0:
                                raise DataApiException(u'Sorting field {field} does not exist.'.format(
                                    field = sort_name
                                ))
                            elif len(resources) == 1:
                                sort_resource = resources[0]
                            else:
                                raise DataApiException(u'Sorting field {field} is ambiguous for resources {resources}.'.format(
                                    field = sort_name,
                                    resources = u','.join(resources)
                                ))

                        # Check if resource exists in metadata
                        if not sort_resource in resource_mapping or not resource_mapping[sort_resource] in metadata:
                            raise DataApiException(u'Resource {resource} for sorting field {field} does not exist.'.format(
                                resource = sort_resource,
                                field = sort_name
                            ))

                        parsed_query['sort'].append('{table}."{field}" {desc}'.format(
                            table = metadata[resource_mapping[sort_resource]]['alias'],
                            field = sort_name,
                            desc = 'desc' if sort_desc else ''
                        ))

            # Build SQL command
            fields = []
            tables = []
            wheres = []
            values = ()
            where_clause = ''
            orderby_clause = ''

            # Select clause fields
            for field in parsed_query['fields']:
                if parsed_query['fields'][field]['is_geom'] and parsed_query['fields'][field]['srid'] != srid:
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

            # From clause tables
            tables = [ '"' + parsed_query['resources'][r]['table'] + '" as ' + parsed_query['resources'][r]['alias'] for r in parsed_query['resources']]                  

            # Where clause
            if len(parsed_query['filters']) > 0:
                for filter_tuple in parsed_query['filters']:
                    wheres.append(filter_tuple[0])
                    values += filter_tuple[1:]

            if len(wheres) > 0: 
                where_clause = u'where ' + u' AND '.join(wheres)

            # Order by clause
            if len(parsed_query['sort']) > 0:
                orderby_clause = u'order by ' +u', '.join(parsed_query['sort'])

            # Build SQL
            sql = "select distinct {fields} from {tables} {where} {orderby} limit {limit} offset {offset};".format(
                fields = u','.join(fields),
                tables = u','.join(tables),
                where = where_clause,
                orderby = orderby_clause,
                limit = limit,
                offset = offset
            )

            connection_data.execute(u'SET LOCAL statement_timeout TO {0};'.format(timeout))
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
        finally:
            if not connection_ckan is None:
                connection_ckan.close()
            if not connection_data is None:
                connection_data.close()

        return result

    def _export_partial_result(self, text, path, filename):
        # ogr2ogr -t_srs EPSG:4326 -s_srs EPSG:3857 -f "ESRI Shapefile" query.shp query.geojson
        
        f_input = os.path.join(path, filename + '.geojson')
        f_output = os.path.join(path, filename + '.shp')
        
        with open(f_input, "w") as text_file:
            text_file.write(text)

        ogr_export(['', '-t_srs', 'EPSG:4326', '-s_srs', 'EPSG:3857', '-f', 'ESRI Shapefile', f_output, f_input])

    def _zip_folder(self, path, filename):       
        shapeFiles = [ f for f in os.listdir(path) if (os.path.splitext(f)[-1].lower() <> '.geojson') ]

        with zipfile.ZipFile(filename, "w", zipfile.ZIP_DEFLATED) as compressedFile:
            for f in shapeFiles:
                 compressedFile.write(os.path.join(path,f), f)
                 
    def _get_resources(self, connection):
        resources = None
        result = {}

        try:
            sql = u"""
                    select  resource_db.resource_id as db_resource_id,
                            package_revision.title as package_title,
                            package_revision.notes as package_notes,
                            resource_db.resource_name as resource_name,
                            resource_wms.resource_id as wms_resource_id,
                            resource_db.geometry_type as geometry_type,
                            resource_wms.wms_server as wms_server,
                            resource_wms.wms_layer as wms_layer
                    from 
                        (
                        select  id as resource_id,
                                json_extract_path_text((extras::json),'vectorstorer_resource') as vector_storer,
                                json_extract_path_text((extras::json),'geometry') as geometry_type,
                                json_extract_path_text((extras::json),'parent_resource_id') as resource_parent_id,
                                resource_group_id as group_id,
                                name as resource_name
                        from	resource_revision
                        where	format = 'data_table'
                                and current = True
                                and state = 'active'
                                and json_extract_path_text((extras::json),'vectorstorer_resource')  = 'True'
                        ) as resource_db
                        left outer join
                            (
                            select	id as resource_id,
                                    json_extract_path_text((extras::json),'vectorstorer_resource') as vector_storer,
                                    json_extract_path_text((extras::json),'geometry') as ggeometry_type,
                                    json_extract_path_text((extras::json),'parent_resource_id') as resource_parent_id,
                                    resource_group_id as group_id,
                                    json_extract_path_text((extras::json),'wms_server') as wms_server,
                                    json_extract_path_text((extras::json),'wms_layer') as wms_layer
                            from	resource_revision
                            where	format = 'wms'
                                    and current = True
                                    and state = 'active'
                                    and json_extract_path_text((extras::json),'vectorstorer_resource')  = 'True'
                            ) as resource_wms
                                on	resource_db.group_id = resource_wms.group_id
                                    and resource_db.resource_id = resource_wms.resource_parent_id
                        left outer join resource_group_revision
                                on	resource_group_revision.id = resource_db.group_id
                                    and resource_group_revision.state = 'active'
                                    and resource_group_revision.current = True
                        left outer join	package_revision
                                on	resource_group_revision.package_id = package_revision.id
                                    and package_revision.state = 'active'
                                    and package_revision.current = True;
            """

            resources = connection.execute(sql)
            for resource in resources:
                result[resource['db_resource_id'].decode('utf-8')] = {
                    'table': resource['db_resource_id'].decode('utf-8'),
                    'resource_name' : resource['resource_name'].decode('utf-8'),
                    'package_title' : resource['package_title'].decode('utf-8'),
                    'package_notes' : resource['package_notes'].decode('utf-8'),
                    'wms': None if resource['wms_resource_id'] is None else resource['wms_resource_id'].decode('utf-8'),
                    'wms_server': None if resource['wms_server'] is None else resource['wms_server'].decode('utf-8'),
                    'wms_layer': None if resource['wms_layer'] is None else resource['wms_layer'].decode('utf-8'),
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

            resources = self._get_resources(connection)
            
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
            print id
            if id is None:
                result = {
                    "success" : False,
                    "message" : u'Resource id is missing.',
                    "resource": None
                }
            else:
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
