try:
    from setuptools import setup, find_packages
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages

entry_points = {
    'paste.app_factory': [
        'main = mapclient.config.middleware:make_app',
    ],
    'paste.app_install': [
        'main = pylons.util:PylonsInstaller',
    ]
}
setup(
    name='mapclient',
    version='0.1',
    description='',
    author='',
    author_email='',
    url='',
    packages=find_packages(exclude=['ez_setup']),
    include_package_data=True,
    test_suite='nose.collector',
    package_data={'mapclient': ['i18n/*/LC_MESSAGES/*.mo']},
    message_extractors={'mapclient': [
            ('**.py', 'python', None),
            ('public/**', 'ignore', None)]},
    zip_safe=False,
    entry_points=entry_points,
    scripts=['bin/pm-resource-gen'],
)
