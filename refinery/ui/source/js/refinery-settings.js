angular
  .module('refineryApp')
  .constant('settings', {
    appRoot: document.location.protocol + '//' + document.location.host,
    authThrottling: 60000,
    dashboard: {
      preview: {
        maxBadges: 20
      },
      analysesSorting: [
        {
          djangoAttribute: 'name',
          label: 'Name'
        },
        {
          djangoAttribute: 'time_start',
          label: 'Start time'
        },
        {
          djangoAttribute: 'time_end',
          label: 'End time'
        }
      ],
      dataSetsSorting: [
        {
          djangoAttribute: 'creation_date',
          label: 'Creation date'
        },
        {
          djangoAttribute: 'file_count',
          label: 'Number of files'
        },
        {
          djangoAttribute: 'modification_date',
          label: 'Modification date'
        },
        {
          djangoAttribute: 'title',
          label: 'Name'
        }
      ],
      workflowsSorting: [
        {
          djangoAttribute: 'name',
          label: 'Name'
        }
      ]
    },
    djangoApp: window.djangoApp,
    debounceSearch: 250,
    debounceWindowResize: 250,
    neo4jApi: '/neo4j',
    refineryApi: '/api/v1',
    solrApi: '/solr',
    treemap: {
      singleRequestLimit: 200
    }
  });
