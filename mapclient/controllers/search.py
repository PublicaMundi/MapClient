# -*- coding: utf-8 -*-

import logging

from pylons import config, request, response, session
from pylons.controllers.util import abort

from mapclient.lib.base import BaseController

from mapclient.model.meta import Session
from mapclient.model.location import locations, Location

import json
import geojson
import geojson.codec
import shapely.wkb
import shapely.wkt
import shapely.geometry
import shapely.geometry.base

import os
import string
import time



log = logging.getLogger(__name__)

MAX_LIMIT = 30

import logging

class ShapelyGeoJsonEncoder(geojson.codec.GeoJSONEncoder):
    def default(self, obj):
        if isinstance(obj, shapely.geometry.base.BaseGeometry):
            return shapely.geometry.mapping(obj)
        return json.GeoJSONEncoder.default(self, obj)

class SearchController(BaseController):


    def _set_headers(self):
        if request.environ["REQUEST_METHOD"] == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'

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

            locations = []
            if term:
                locations = Session.query(Location).filter(Location.name.like(u'%' + term + u'%')).limit(limit).all()

            records = []
            for l in locations:
                records.append({
                    'name' : l.name,
                    'geometry' : shapely.wkb.loads(l.the_geom_sm.geom_wkb.decode("hex"))
                })

            return json.dumps(records, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
        except Exception as ex:
            log.error(ex)

        abort(500, 'Internal server error')

