define(['jquery', 'URIjs/URI', 'shared'], function ($, URI, PublicaMundi) {
    "use strict";

    PublicaMundi.define('Maps.CKAN');

    PublicaMundi.Maps.CKAN.Metadata = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.values.topics = null;

            this.event('topic:refresh');
            this.event('topic:loaded');
        },
        getTopics: function () {
            var self = this;

            var uri = new URI(this.values.config.ckan.endpoint);
            uri.segment(['api', '3', 'action', 'group_list']);
            uri.addQuery({ 'all_fields': true });

            $.ajax({
                url: uri.toString(),
                dataType: 'jsonp',
                context: this,
            }).done(function (response) {
                var topics = [];
                if ((response.success) && (response.result)) {
                    topics = response.result.map(function (value, index, array) {
                        return {
                            id: value.id,
                            name: value.name,
                            caption: value.display_name,
                            title: value.title,
                            description: value.description,
                            image: value.image_display_url,
                        };
                    });
                }

                this.values.topics = topics;

                self.trigger('topic:refresh', topics);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                console.log('Failed to load CKAN topics : ' + uri.toString());
            });
        },
        getTopicById: function (id) {
            // Example : http://web.dev.publicamundi.eu/api/3/action/group_show?id=03256ce0-d6ec-4e23-89cb-e94d95e386b8

            var self = this;

            var uri = new URI(this.values.config.ckan.endpoint);
            uri.segment(['api', '3', 'action', 'group_show']);
            uri.addQuery({ id: id });

            $.ajax({
                url: uri.toString(),
                dataType: 'jsonp',
                context: this,
            }).done(function (response) {
                var t, p, r, dataset, resource, topic = null;

                if ((response.success) && (response.result)) {

                    topic = {
                        id: response.result.id,
                        name: response.result.name,
                        caption: response.result.display_name,
                        title: response.result.title,
                        description: response.result.description,
                        image: response.result.image_display_url,
                        datasets: []
                    };

                    for (p = 0; p < response.result.packages.length; p++) {
                        dataset = response.result.packages[p];

                        topic.datasets.push({
                            id: dataset.id,
                            name: dataset.name,
                            title: dataset.title,
                            notes: dataset.notes,
                            spatial_extent: dataset.spatial,
                            organization: {
                                id: dataset.organization.id,
                                name: dataset.organization.name,
                                title: dataset.organization.title,
                                description: dataset.organization.description,
                                image: dataset.organization.image_url
                            },
                            resources: []
                        });

                        for (r = 0; r < dataset.resources.length; r++) {
                            resource = dataset.resources[r];

                            topic.datasets[p].resources.push({
                                id: resource.id,
                                name: resource.name,
                                description: resource.description,
                                format: resource.format,
                                size: resource.size,
                                mimetype: resource.mimetype,
                                url: resource.url
                            });
                        }
                    }
                }

                if (this.values.topics) {
                    for (t = 0; t < this.values.topics.length; t++) {
                        if (this.values.topics[t].id === topic.id) {
                            this.values.topics[t].datasets = topic.datasets;
                            break;
                        }
                    }
                }
                self.trigger('topic:loaded', topic);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                console.log('Failed to load CKAN topic : ' + uri.toString());
            });
        },
        getDatasetById: function (id) {
            var t, d, topic;
            if (this.values.topics) {
                for (t = 0; t < this.values.topics.length; t++) {
                    topic = this.values.topics[t];
                    if (topic.datasets) {
                        for (d = 0; d < topic.datasets.length; d++) {
                            if (topic.datasets[d].id === id) {
                                return topic.datasets[d];
                            }
                        }
                    }
                }
            }
            return null;
        },
        getResourceById: function (id) {
            var t, d, r, topic, dataset;
            if (this.values.topics) {
                for (t = 0; t < this.values.topics.length; t++) {
                    topic = this.values.topics[t];
                    if (topic.datasets) {
                        for (d = 0; d < topic.datasets.length; d++) {
                            dataset = topic.datasets[d];
                            if (dataset.resources) {
                                for (r = 0; r < dataset.resources.length; r++) {
                                    if (dataset.resources[r].id === id) {
                                        return dataset.resources[r];
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return null;
        }
    });
});
