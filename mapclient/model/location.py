from sqlalchemy import Table, Column

from sqlalchemy.orm import mapper
from sqlalchemy.orm.properties import ColumnProperty

from sqlalchemy.sql.expression import func

from geoalchemy import GeometryColumn, Geometry

from mapclient.model.meta import metadata, engine
from mapclient.model.geometry import GeometryEntityMixIn

locations = Table('toponymia',
             metadata,
             Column('the_geom_sm', Geometry(900913)),
             autoload=True,
             autoload_with=engine)

class Location(GeometryEntityMixIn):

    __table__ = locations

mapper(Location, locations)
