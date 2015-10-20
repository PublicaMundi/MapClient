# -*- coding: utf-8 -*-

import logging

from pylons import config, request, response, session
from pylons.controllers.util import abort

from sqlalchemy import Table, Column, or_
from sqlalchemy.orm import mapper, noload, contains_eager
from sqlalchemy.orm.properties import ColumnProperty
from sqlalchemy.sql.expression import func

from geoalchemy import GeometryColumn, Geometry, WKTSpatialElement

from mapclient.lib.base import BaseController

from mapclient.model.meta import Session, metadata, engine, Session_ckan_data, metadata_ckan_data, engine_ckan_data
from mapclient.model.location import locations, Location
from mapclient.model.schema import Queryable, Field, Resource
from mapclient.model.geometry import GeometryEntityMixIn

import json
import geojson
import geojson.codec
import shapely.wkb
import shapely.wkt
import shapely.geometry
import shapely.geometry.base

import os
import string
from threading import Lock, ThreadError
import calendar, datetime


log = logging.getLogger(__name__)

MAX_LIMIT = 30

import logging

class ShapelyGeoJsonEncoder(geojson.codec.GeoJSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime) or isinstance(obj, datetime.date):
            return datetime.datetime.now().isoformat()

        if isinstance(obj, shapely.geometry.base.BaseGeometry):
            return shapely.geometry.mapping(obj)

        return json.GeoJSONEncoder.default(self, obj)

class SearchController(BaseController):

    __lock__ = Lock()

    __tables__ = {}
    __types__ = {}

    def _set_headers(self):
        if request.environ["REQUEST_METHOD"] == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'

    def _searchResources(self, resources, term):
        records = []

        limit = 10
        tolerance = 2

        try:
            query = Session.query(Queryable).options(noload('*'), contains_eager(Queryable.fields)).join(Resource).join(Field)
            query = query.filter(Queryable.resource.in_(tuple(resources)))
            query = query.filter(Queryable.fields.any(Field.active == True))
            query = query.filter(Resource.visible == True)

            queryables = query.all()

            for q in queryables:
                # Default field shown as input in the auto-complete text control
                default_field = None
                default_fields = [str(f.name) for f in q.fields if f.export == True and f.default == True]

                if len(default_fields) != 1:
                    continue
                else:
                    default_field = default_fields[0]

                # Text template rendered in the drop down list of the auto-complete text control
                template = q.template
                if not template:
                    template = '%(' + default_field + ')s'

                tablename = 'Table_' + q.table
                typename = 'Class_' + q.table

                dynamic_table = None
                dynamic_type = None

                SearchController.__lock__.acquire()

                if tablename in SearchController.__tables__:
                    dynamic_table = SearchController.__tables__[tablename]
                    dynamic_type = SearchController.__types__[typename]
                else:
                    dynamic_table = Table(q.table, metadata_ckan_data, Column(q.geometry_column, Geometry(q.srid)), autoload=True, autoload_with=engine_ckan_data)

                    SearchController.__tables__[tablename] = dynamic_table

                    if not typename in SearchController.__types__:
                        exported_fields = [f.name for f in q.fields if f.export == True]

                        properties = {
                            'exported_fields' : exported_fields,
                            'default_field' : default_field,
                            'template' : template,
                            'geometry_column' : q.geometry_column,
                            '__table__' : dynamic_table
                        }

                        dynamic_type = type(str(typename), (GeometryEntityMixIn,), properties)

                        if q.geometry_type == 'POINT':
                            if q.srid != 900913 and q.srid != 3857:
                                mapper(dynamic_type, dynamic_table, properties = { q.geometry_column + '_transform': ColumnProperty(func.ST_Transform(getattr(dynamic_table.c, q.geometry_column), 3857).label(q.geometry_column + '_transform')) } )
                            else:
                                mapper(dynamic_type, dynamic_table)
                        else:
                            if q.srid == 900913 or q.srid == 3857:
                                mapper(dynamic_type,
                                       dynamic_table,
                                       properties = {
                                            q.geometry_column + '_simple': ColumnProperty(func.ST_Simplify(getattr(dynamic_table.c, q.geometry_column), tolerance).label(q.geometry_column + '_simple'))
                                       })
                            else:
                                mapper(dynamic_type,
                                       dynamic_table,
                                       properties = {
                                            q.geometry_column + '_simple': ColumnProperty(func.ST_Simplify(func.ST_Transform(getattr(dynamic_table.c, q.geometry_column), 3857), tolerance).label(q.geometry_column + '_simple')),
                                            q.geometry_column + '_transform': ColumnProperty(func.ST_Transform(getattr(dynamic_table.c, q.geometry_column), 3857).label(q.geometry_column + '_transform'))
                                       })

                        SearchController.__types__[typename] = dynamic_type

                SearchController.__lock__.release()


                filtered_fields = [str(f.name) for f in q.fields if f.active == True]

                filters = [getattr(dynamic_type, name).like(u'%' + term + u'%') for name in filtered_fields]

                result = []
                if len(filters) == 1:
                    result = Session_ckan_data.query(dynamic_type).filter(filters[0]).limit(limit).all()
                elif len(filters) > 1:
                    result = Session_ckan_data.query(dynamic_type).filter(or_(*filters)).limit(limit).all()

                records.extend(filter(None, [r.toObject() for r in result]))

            return records
        finally:
            try:
                SearchController.__lock__.release()
            except ThreadError as tEx:
                pass

        return []

    def query(self):
        self._set_headers()

        records = []
        try:
            limit = MAX_LIMIT
            if 'limit' in request.params and int(request.params['limit']) < limit:
                limit = request.params['limit']

            term = None
            if 'term' in request.params and request.params['term']:
                term = request.params['term']

            records = []
            if 'resources' in request.params:
                records = self._searchResources(filter(None, request.params['resources'].split(',')), term)

            locations = []
            if term:
                locations = Session.query(Location).filter(Location.name.like(u'%' + term + u'%')).limit(limit).all()

            for l in locations:
                records.append({
                    'properties': {
                        'dd_default_text': l.name,
                        'dd_default_suggest': l.name
                    },
                    'geometry': shapely.wkb.loads(l.the_geom_sm.geom_wkb.decode("hex"))
                })

            return json.dumps(records, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
        except Exception as ex:
            log.error(ex)

        abort(500, 'Internal server error')

