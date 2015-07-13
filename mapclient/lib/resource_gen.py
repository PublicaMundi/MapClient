#!/usr/bin/python

import sys
import os
import json
import argparse
import urlparse
import requests

# ./resource_gen.py -output ~/ -catalog http://web.dev.publicamundi.eu/

def get_metadata(output, catalog):
    timeout = 30

    parts = urlparse.urlsplit(catalog)
    if not parts.scheme or not parts.netloc:
        raise Exception('Invalid URL.')

    if not os.path.isdir(output):
        raise Exception('Folder [{output}] does not exist.'.format(output = output))

    try:
        metadata = {
            'organizations': [],
            'groups': [],
            'packages': []
        }

        filename = os.path.join(output, 'metadata.json')

        # Example : http://labs.geodata.gov.gr/api/3/action/organization_list?all_fields=true

        resource = urlparse.urljoin(catalog, 'api/3/action/organization_list?all_fields=true')
        request_organizations = requests.get(resource, timeout = timeout)
       
        if request_organizations.status_code == 200:           
            organizations = request_organizations.json()
            if organizations['success'] == True:
                for o in organizations['result']:
                    query = '?lang_codes=el'
                    
                    organization = {
                        'id': o['id'],
                        'name': o['name'],
                        'caption': {
                            'en': o['display_name'],
                            'el': o['display_name']
                        },
                        'title': {
                            'en': o['title'],
                            'el': o['title']
                        },
                        # 'description': {
                        #     'en': o['description'],
                        #     'el': o['description']
                        # },
                        'image': o['image_display_url']
                    }

                    query = query + '&terms=' + o['display_name'] + '&terms' +  o['description'] + '&terms=' + o['title']
                    
                    resource = urlparse.urljoin(catalog, 'api/3/action/term_translation_show' + query)
                    translation_request = requests.get(resource, timeout = timeout)
                    
                    if translation_request.status_code == 200:
                        translation = translation_request.json()
                        if translation['success'] == True:
                            for t in translation['result']:
                                if organization['caption']['en'] == t['term']:
                                    organization['caption']['el'] = t['term_translation']
                                if organization['title']['en'] == t['term']:
                                    organization['title']['el'] = t['term_translation']
                                #if organization['description']['en'] == t['term']:
                                #    organization['description']['el'] = t['term_translation']

                    metadata['organizations'].append(organization)

        if os.path.exists(filename):
            os.remove(filename)
        
        with open(filename, 'w') as outfile:
            json.dump(metadata, outfile)
    except requests.exceptions.HTTPError as ex:
        details = 'Could not proxy resource. Server responded with %s %s' % (
            ex.response.status_code, error.response.reason)
        abort(409, detail=details)
    except requests.exceptions.ConnectionError as ex:
        details = '''Could not proxy resource because a connection error occurred. %s''' % ex
        abort(502, detail=details)
    except requests.exceptions.Timeout as ex:
        details = 'Could not proxy resource because the connection timed out.'
        abort(504, detail=details)

try:
    parser = argparse.ArgumentParser(description='Downloads organization, group and package metadata from the catalog and extracts information for the Map Client application')
    parser.add_argument('-output', metavar='path', type=str, help='folder where the produced files are created', required=True)
    parser.add_argument('-catalog', metavar='url', type=str, help='CKAN catalog endpoint', required=True)

    args = parser.parse_args()
           
    get_metadata(args.output, args.catalog)
except Exception as ex:
    print 'Export has failed: ' + str(ex)
