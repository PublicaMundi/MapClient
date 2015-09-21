#!/bin/bash

# See: http://stackoverflow.com/questions/7538628/virtualenvwrapper-functions-unavailable-in-shell-scripts

# if virtualenvwrapper.sh is in your PATH (i.e. installed with pip)
source `which virtualenvwrapper.sh`
#source /path/to/virtualenvwrapper.sh # if it's not in your PATH

workon $1

python $2 \
    -c <url to CKAN catalog> \
    -e <Data API endpoint> \
    -d <connection string to MapClient database> \
	-o <output filename> \
	-g <optional translations for topics> \
	-t 10

deactivate

# Example: virtualenv-run.sh mapclient-gdal ~/<path to MapClient installation>/bin/pm-resource-gen.py
