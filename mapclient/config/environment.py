"""Pylons environment configuration"""
import os

from jinja2 import ChoiceLoader, Environment, FileSystemLoader
from pylons import config
from sqlalchemy import engine_from_config

import mapclient.lib.app_globals as app_globals
import mapclient.lib.helpers
from mapclient.config.routing import make_map
from mapclient.model import init_model

def load_environment(global_conf, app_conf):
    """Configure the Pylons environment via the ``pylons.config``
    object
    """
    # Pylons paths
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths = dict(root=root,
                 controllers=os.path.join(root, 'controllers'),
                 static_files=os.path.join(root, 'public'),
                 templates=[os.path.join(root, 'templates')])

    # Initialize config with the basic options
    config.init_app(global_conf, app_conf, package='mapclient', paths=paths)

    config['routes.map'] = make_map()
    config['pylons.app_globals'] = app_globals.Globals()
    config['pylons.h'] = mapclient.lib.helpers

    # Create the Jinja2 Environment
    config['pylons.app_globals'].jinja2_env = Environment(loader=ChoiceLoader(
            [FileSystemLoader(path) for path in paths['templates']]))
    # Jinja2's unable to request c's attributes without strict_c
    config['pylons.strict_c'] = True

    # Setup the SQLAlchemy database engine
    engine = engine_from_config(config, 'mapclient.sqlalchemy.')
    engine_ckan_data = engine_from_config(config, 'vectorstore.sqlalchemy.')
    init_model(engine, engine_ckan_data)

    # CONFIGURATION OPTIONS HERE (note: all config options will override
    # any Pylons config options)
