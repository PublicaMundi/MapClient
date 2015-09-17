from sqlalchemy import Table

from sqlalchemy.orm import mapper

from mapclient.model.meta import metadata, engine

links = Table('links',
             metadata,
             autoload=True,
             autoload_with=engine)

class Link(object):
    pass

mapper(Link, links)
