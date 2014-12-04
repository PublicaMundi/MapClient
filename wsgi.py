import logging, logging.config
import os

here = os.path.dirname(os.path.realpath(__file__))
ini_file = os.path.join(here, 'development.ini')

# Activate enviroment
activate_this = os.path.realpath(os.path.join(here, '../..', 'bin/activate_this.py'))
execfile(activate_this, dict(__file__=activate_this))

# Setup loggers
logging.config.fileConfig(ini_file)

from paste.deploy import loadapp

# Load WSGI application
application = loadapp('config:%s' %(ini_file));

if __name__ == '__main__':
    from wsgiref.simple_server import make_server
    httpd = make_server('', 5000, application)
    print "Serving on port 5000 ..."
    httpd.serve_forever()
