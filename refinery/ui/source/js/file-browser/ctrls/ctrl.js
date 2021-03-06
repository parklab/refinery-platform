/**
 * File Browser Ctrl
 * @namespace FileBrowserCtrl
 * @desc Main ctrl which handles the files tab (main) view and also
 * generates the ui-grid table.
 * @memberOf refineryFileBrowser
 */
(function () {
  'use strict';

  angular
    .module('refineryFileBrowser')
    .controller('FileBrowserCtrl', FileBrowserCtrl);

  FileBrowserCtrl.$inject = [
    '$httpParamSerializer',
    '$log',
    '$q',
    '$scope',
    '$timeout',
    '$uibModal',
    '$window',
    'uiGridConstants',
    'uiGridExporterConstants',
    'uiGridExporterService',
    '_',
    'assayFiltersService',
    'dataSetPropsService',
    'fileBrowserFactory',
    'fileBrowserSettings',
    'fileParamService',
    'filesLoadingService',
    'fileRelationshipService',
    'nodesV2Service',
    'resetGridService',
    'selectedFilterService',
    'activeNodeService',
    'toolSelectService'
  ];

  function FileBrowserCtrl (
    $httpParamSerializer,
    $log,
    $q,
    $scope,
    $timeout,
    $uibModal,
    $window,
    uiGridConstants,
    uiGridExporterConstants,
    uiGridExporterService,
    _,
    assayFiltersService,
    dataSetPropsService,
    fileBrowserFactory,
    fileBrowserSettings,
    fileParamService,
    filesLoadingService,
    fileRelationshipService,
    nodesV2Service,
    resetGridService,
    selectedFilterService,
    activeNodeService,
    toolSelectService
  ) {
    var dataSetUuid = $window.dataSetUuid;
    var fileService = fileRelationshipService;
    var maxFileRequest = fileBrowserSettings.maxFileRequest;
    var nodesService = activeNodeService;
    var paramService = fileParamService;
    var toolService = toolSelectService;
    var vm = this;
    vm.activeNodeRow = nodesService.activeNodeRow;
    vm.analysisFilter = assayFiltersService.analysisFilter;
    // attribute list from api
    vm.assayAttributes = fileBrowserFactory.assayAttributes;
    vm.assayFilterFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilterFilesCount;
    vm.assayFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilesCount;
    // objs used by ui to generate filters
    vm.attributeFilter = assayFiltersService.attributeFilter;
    // variable supporting ui-grid dynamic scrolling
    vm.cachePages = 2;
    vm.checkDataLength = checkDataLength;
    vm.collapsedToolPanel = toolService.isToolPanelCollapsed;
    vm.currentTypes = fileService.currentTypes;
    vm.dataSet = {};
    vm.downloadCsv = downloadCsv;
    vm.downloadCsvQuery = downloadCsvQuery;
    vm.editMode = false;
    vm.fileEditsUpdating = false;
    vm.firstPage = 0;
    vm.getDataDown = getDataDown;
    vm.getDataUp = getDataUp;
    vm.gridApi = undefined; // avoids duplicate grid generation
    // Main ui-grid options
    var editCellTemplate = '<div>' +
    '<form name="inputForm" class="ui-grid-edit-form ng-pristine ng-valid"> ' +
    '<input type="text" ui-grid-editor ng-model="row.entity[col.colDef.field]"' +
    ' class="ng-pristine ng-untouched ng-valid ng-not-empty"></form></div>';

    vm.gridOptions = {
      appScopeProvider: vm,
      columnDefs: fileBrowserFactory.customColumnNames,
      data: fileBrowserFactory.assayFiles,
      editableCellTemplate: editCellTemplate,
      enableCellEdit: false,
      exporterAllDataFn: function () {
        return fileBrowserFactory.getAssayFiles(paramService.fileParam);
      },
      exporterSuppressColumns: ['Input Groups'],
      gridFooterTemplate: '<rp-is-assay-files-loading></rp-is-assay-files-loading>',
      infiniteScrollRowsFromEnd: 40,
      infiniteScrollUp: true,
      infiniteScrollDown: true,
      multiSelect: true,
      onRegisterApi: gridRegister,
      rowHeight: 35,
      rowTemplate: '<rp-ui-grid-row-template></rp-ui-grid-row-template>',
      selectionRowHeaderWidth: 35,
      showGridFooter: true,
      useExternalSorting: true
    };
    vm.inputFileTypeColor = fileService.inputFileTypeColor;
    vm.isFiltered = isFiltered;
    vm.lastPage = 0;  // variable supporting ui-grid dynamic scrolling
    vm.nodeSelectCollection = fileService.nodeSelectCollection;
    vm.openPermissionEditor = openPermissionEditor;
    vm.openSelectionPopover = openSelectionPopover;
    vm.refreshAssayFiles = refreshAssayFiles;
    vm.reset = reset;
    vm.rowCount = maxFileRequest;
    vm.tool = toolService.selectedTool;
    vm.sortChanged = sortChanged;
    vm.toggleEditMode = toggleEditMode;
    vm.toggleToolPanel = toggleToolPanel;
    vm.totalPages = 1;  // variable supporting ui-grid dynamic scrolling
    vm.userPerms = dataSetPropsService.userPerms;

    activate();
    /*
     * -----------------------------------------------------------------------------
     * Methods
     * -----------------------------------------------------------------------------
     */
    function activate () {
      // Ensure data owner or group permission to modify (run tools)
    //  refreshDataSetProps();
    }

    // Helper method to keep track when data should be discard or added
    function checkDataLength (discardDirection) {
      // work out whether we need to discard a page, if so discard from the
      // direction passed in to
      if (vm.lastPage - vm.firstPage > vm.cachePages) {
        // we want to remove a page
        vm.gridApi.infiniteScroll.saveScrollPercentage();

        if (discardDirection === 'up') {
          fileBrowserFactory.trimAssayFiles(vm.rowCount);
          vm.firstPage++;
          $timeout(function () {
            // wait for grid to ingest data changes
            vm.gridApi.infiniteScroll.dataRemovedTop(
              vm.firstPage > 0, vm.lastPage < vm.totalPages
            );
          });
        } else {
          fileBrowserFactory.trimAssayFiles(vm.rowCount * vm.cachePages, 0);
          vm.lastPage--;
          $timeout(function () {
            // wait for grid to ingest data changes
            vm.gridApi.infiniteScroll.dataRemovedBottom(
              vm.firstPage > 0, vm.lastPage < vm.totalPages
            );
          });
        }
      }
    }

    /**
     * @name downloadCsv
     * @desc  VM method used to call the uiGridExporterService.csvExport
     * with the appropriate "visibility" based on whether or not the user
     * has begun filtering with the FileBrowser facets or not
     * @memberOf FileBrowserCtrl
    **/
    function downloadCsv () {
      var visibility = uiGridExporterConstants.ALL;
      if (isFiltered()) {
        visibility = uiGridExporterConstants.VISIBLE;
      }
      uiGridExporterService.csvExport(vm.gridApi.grid, visibility, visibility);
    }

    /**
     * @name downloadCsvQuery
     * @desc  VM method used to construct the query parameters to be sent
     * to the `/files_download` endpoint
     * @memberOf FileBrowserCtrl
    **/
    function downloadCsvQuery () {
      return $httpParamSerializer({
        filter_attribute: selectedFilterService.attributeSelectedFields,
        assay_uuid: $window.externalAssayUuid,
        limit: 100000000
      });
    }

    // Gets the data set properties
    function refreshDataSetProps () {
      vm.dataSet = dataSetPropsService.dataSet;
      vm.setCsvFileName(vm.dataSet.title);
      // initialize the dataset and updates ui-grid selection, filters, and url
      initializeDataOnPageLoad();
    }

    // Helper method for dynamic scrolling, grabs data when scrolling down
    function getDataDown () {
      vm.lastPage++;
      paramService.fileParam.offset = vm.lastPage * vm.rowCount;
      paramService.fileParam.limit = vm.rowCount;
      var promise = $q.defer();
      filesLoadingService.setIsAssayFilesLoading(true);
      fileBrowserFactory.getAssayFiles(paramService.fileParam)
        .then(function () {
          vm.gridApi.infiniteScroll.saveScrollPercentage();
          vm.gridOptions.data = fileBrowserFactory.assayFiles;
          filesLoadingService.setIsAssayFilesLoading(false);
          vm.gridApi.infiniteScroll
            .dataLoaded(vm.firstPage > 0, vm.lastPage < vm.totalPages)
            .then(function () {
              vm.checkDataLength('up');
            })
            .then(function () {
              promise.resolve();
            });
        }, function () {
          vm.gridApi.infiniteScroll.dataLoaded();
          promise.reject();
        });
      return promise.promise;
    }

    // Helper method for dynamic scrolling, grabs data when scrolling up
    function getDataUp () {
      if (vm.firstPage > 0) {
        vm.firstPage--;
      }

      paramService.fileParam.offset = vm.firstPage * vm.rowCount;
      paramService.fileParam.limit = vm.rowCount;
      var promise = $q.defer();
      filesLoadingService.setIsAssayFilesLoading(true);
      fileBrowserFactory.getAssayFiles(paramService.fileParam)
        .then(function () {
          vm.gridApi.infiniteScroll.saveScrollPercentage();
          vm.gridOptions.data = fileBrowserFactory.assayFiles;
          filesLoadingService.setIsAssayFilesLoading(false);
          vm.gridApi.infiniteScroll
            .dataLoaded(vm.firstPage > 0, vm.lastPage < vm.totalPages)
            .then(function () {
              vm.checkDataLength('down');
            })
            .then(function () {
              promise.resolve();
            });
        }, function () {
          vm.gridApi.infiniteScroll.dataLoaded();
          promise.reject();
        });
      return promise.promise;
    }

    // Ui-grid methods for catching grid events
    function gridRegister (gridApi) {
      // prevent scoping issues, after reset or initial generation
      if (!vm.gridApi) {
        gridApi.infiniteScroll.on.needLoadMoreData(null, vm.getDataDown);
        gridApi.infiniteScroll.on.needLoadMoreDataTop(null, vm.getDataUp);

        vm.gridApi = gridApi;

        // Sort events
        vm.gridApi.core.on.sortChanged(null, vm.sortChanged);
        vm.sortChanged(vm.gridApi.grid, [vm.gridOptions.columnDefs[1]]);

        // Catches event when user clicks on cell to edit.
        vm.gridApi.edit.on.beginCellEdit(null, function (rowEntity, colDef) {
          // need to add class manually due to how rows are generated
          var colId = vm.gridApi.grid.getColumn(colDef.name).uid;
          angular.element('.ui-grid-header-cell.ui-grid-col' +
            colId).addClass('select-highlight');
          var params = {
            uuid: rowEntity.uuid,
            related_attribute_nodes: colDef.field
          };
           // grab related node uuids (nodes which will be effected by update)
          nodesV2Service.query(params).$promise.then(function (relatedNodeUuids) {
            var rows = vm.gridApi.grid.rows;
            for (var index in rows) {
              if (relatedNodeUuids.includes(rows[index].entity.uuid)) {
                angular.element('.ui-grid-cell.ui-grid-row' + rows[index].uid +
                  '.ui-grid-col' + colId).addClass('warning-border');
              }
            }
          }, function (error) {
            $log.error(error);
          });
        });
        // Catches event when user finishes editing (clicks away from cell)
        vm.gridApi.edit.on.afterCellEdit(null, function (rowEntity, colDef, newValue, oldValue) {
          var colId = vm.gridApi.grid.getColumn(colDef.name).uid;
          angular.element('.ui-grid-header-cell.ui-grid-col' +
            colId).removeClass('select-highlight');
          angular.element('.ui-grid-col' + colId).removeClass('warning-border');

          var params = {
            uuid: rowEntity.uuid,
            attribute_solr_name: colDef.field,
            attribute_value: newValue
          };
          if (newValue !== oldValue) {
            vm.fileEditsUpdating = true;
            nodesV2Service.partial_update(params).$promise.then(function () {
              refreshAssayFiles().then(function () {
                vm.fileEditsUpdating = false;
              });
            }, function () {
              rowEntity[colDef.field] = oldValue;
              vm.fileEditsUpdating = false;
            });
          }
        });
      }
    }

    /** view method to aid in determining if the user has begun using the
     *  facets to filter the FileBrowser table's results.*/
    function isFiltered () {
      // Note: paramService.fileParam.filter_attribute can be both
      // undefined and an empty object. Both of these scenarios correlate
      // to facet filtering not having happened yet.

      var filtered = true;

      if (paramService.fileParam.filter_attribute === undefined) {
        filtered = false;
      } else {
        filtered = Boolean(
          Object.keys(paramService.fileParam.filter_attribute).length
        );
      }
      return filtered;
    }

    /** view method to open the permissions modal component, in commons
     *  directive*/
    function openPermissionEditor () {
      $uibModal.open({
        component: 'rpPermissionEditorModal',
        resolve: {
          config: function () {
            return {
              model: 'data_sets',
              uuid: dataSetUuid
            };
          }
        }
      });
    }

    /** vm method to open the selection popover and disable all popovers, so
     * only one shows at a time. Needed in the ctrl due to ui-grid template.
     * @param nodeUuid
     */
    function openSelectionPopover (nodeRow) {
      if (_.isEmpty(nodesService.activeNodeRow)) {
        // active nodes are cleared after popovers are closed
        angular.copy(nodeRow, nodesService.activeNodeRow);
        vm.activeNodeRow = nodesService.activeNodeRow;
        angular.element('#' + nodeRow.uuid).popover('show');
        angular.element('.ui-grid-selection-row-header-buttons').popover('disable');
      } else {
        // user selects a different row, triggers closing all open popovers
        fileService.hideNodePopover = true;
      }
    }

    /**
     * A main method which grabs all the data set nodes, attributes, and updates
     * ui-grid params.
     */
    function refreshAssayFiles () {
      paramService.fileParam.offset = vm.lastPage * vm.rowCount;
      paramService.fileParam.limit = vm.rowCount;
      dataSetPropsService.refreshDataSet();

      var promise = $q.defer();
      fileBrowserFactory.getAssayFiles(paramService.fileParam).then(function () {
        // create column names
        vm.gridOptions.columnDefs = fileBrowserFactory.createColumnDefs();
        // Grabbing 100 files per request, keeping max of 300 at a time
        // Ui-grid rows generated from assay files
        vm.gridOptions.data = fileBrowserFactory.assayFiles;
        vm.assayFilterFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilterFilesCount;
        vm.assayFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilesCount;
        // turns off infinite scroll for data sets < 100 files
        if (vm.assayFilterFilesTotal < maxFileRequest && vm.gridApi) {
          vm.gridApi.infiniteScroll.setScrollDirections(false, false);
        }
        vm.totalPages = Math.floor(vm.assayFilterFilesTotal / vm.rowCount);
        vm.assayAttributes = fileBrowserFactory.assayAttributes;
        vm.attributeFilter = assayFiltersService.attributeFilter;
        vm.analysisFilter = assayFiltersService.analysisFilter;
        promise.resolve();
      }, function (error) {
        $log.error(error);
      });
      return promise.promise;
    }

    // Reset the data, selected rows, and scroll position in the grid
    function reset () {
      vm.firstPage = 0;
      vm.lastPage = 0;
      // reset service data
      angular.copy([], fileBrowserFactory.assayFiles);

      // turn off the infinite scroll handling up and down
      if (typeof vm.gridApi !== 'undefined') {
        vm.gridApi.infiniteScroll.setScrollDirections(false, false);

        vm.refreshAssayFiles(paramService.fileParam).then(function () {
          $timeout(function () {
            // timeout needed allows digest cycle to complete,and grid to ingest the data
            vm.gridApi.infiniteScroll.resetScroll(vm.firstPage > 0, vm.lastPage < vm.totalPages);
            vm.nodeSelectCollection = fileService.nodeSelectCollection;
            resetGridService.setResetGridFlag(false);
          });
        });
      }
    }


    /**
     * @name setCsvFileName
     * @desc  VM method used to set the filename of the exportable .csv once
     * we have the dataSet info
     * @memberOf FileBrowserCtrl
    **/
    vm.setCsvFileName = function (dataSetTitle) {
      vm.gridOptions.exporterCsvFilename = dataSetTitle + '.csv';
    };

    /**
     * Generates sort param for api call from ui-grid response and calls grid
     * reset
     * @param {obj} grid - ui-grid obj
     * @param {string} sortColumns - string defining sort direction
     */
    function sortChanged (grid, sortColumns) {
      if (typeof sortColumns !== 'undefined' &&
        typeof sortColumns[0] !== 'undefined' &&
        typeof sortColumns[0].sort !== 'undefined') {
        switch (sortColumns[0].sort.direction) {
          case uiGridConstants.ASC:
            paramService.fileParam.sort = sortColumns[0].field + ' asc';
            vm.reset();
            break;
          case uiGridConstants.DESC:
            paramService.fileParam.sort = sortColumns[0].field + ' desc';
            vm.reset();
            break;
          default:
            vm.reset();
            break;
        }
      }
    }

    // View method which sets the table into an edit mode (note, the ui only
    // allows owners to edit).
    function toggleEditMode () {
      vm.editMode = !vm.editMode;
      vm.gridOptions.enableCellEdit = vm.editMode;
      vm.gridOptions.enableCellEditOnFocus = vm.editMode;
      resetGridService.setRefreshGridFlag(true);
    }

    // Helper method: toggles the tool related columns, selection & input groups
    function toggleToolColumn () {
      if (_.isEmpty(toolService.selectedTool) &&
        fileBrowserFactory.customColumnNames[0].visible) {
        // Explicitly toggle to avoid a bug when data doesn't show on tabbing
        fileBrowserFactory.customColumnNames[0].visible = false;
        fileBrowserFactory.customColumnNames[1].visible = false;
        vm.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
      } else if (!_.isEmpty(toolService.selectedTool) &&
        !fileBrowserFactory.customColumnNames[0].visible) {
        fileBrowserFactory.customColumnNames[0].visible = true;
        fileBrowserFactory.customColumnNames[1].visible = true;
        vm.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
      }
    }

    // View method which toggles the collapsedToolPanel variable.
    // Needed to resize UI-Grid and alternate text in button.
    function toggleToolPanel () {
      if (toolService.isToolPanelCollapsed) {
        toolService.isToolPanelCollapsed = false;
      } else {
        toolService.isToolPanelCollapsed = true;
      }
      // resize window with toggling
      vm.collapsedToolPanel = toolService.isToolPanelCollapsed;
      vm.gridApi.core.handleWindowResize();
    }

    // Helper method which check for any data updates during soft loads (tabbing)
    function checkAndUpdateGridData () {
      fileBrowserFactory.getAssayFiles(paramService.fileParam)
        .then(function () {
          if (vm.assayFilterFilesTotal !== fileBrowserFactory
            .assayFilesTotal.assayFilterFilesCount) {
            if (vm.assayFilterFilesTotal < maxFileRequest) {
              vm.gridOptions.data = fileBrowserFactory.assayFiles;
            }
            vm.assayFilterFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilterFilesCount;
            vm.assayFilesTotal = fileBrowserFactory.assayFilesTotal.assayFilesCount;
          }
        });
    }

    /**
     * Checks whether the page requires data (hard/soft page load) and
     * updates data, filters, ui-grid selections, and url query
     */
    function initializeDataOnPageLoad () {
      // Hard reset / url with query requires waiting for api response
      if (fileBrowserFactory.assayFiles.length === 0) {
        vm.refreshAssayFiles();
        // Tabbing does not require api response wait and update query in URL
      } else {
        checkAndUpdateGridData();
      }
    }

    /*
     * -----------------------------------------------------------------------------
     * Watchers
     * -----------------------------------------------------------------------------
     */

    /**
     *  Refresh grid flag if set to true, grid, but keep params, filters, & nodes
     *  Require for utils modal as it lives in this parent ctrl scope.
     */
    $scope.$watch(
      function () {
        return resetGridService.refreshGridFlag;
      },
      function () {
        if (resetGridService.refreshGridFlag) {
          // reset assayFiles
          angular.copy([], fileBrowserFactory.assayFiles);
          initializeDataOnPageLoad();
          resetGridService.setRefreshGridFlag(false);
        }
      }
    );

    // when a new row is selected/deselected
    $scope.$watch(
      function () {
        return nodesService.activeNodeRow;
      },
      function () {
        vm.activeNodeRow = nodesService.activeNodeRow;
      }
    );

    // when a node is added/removed from a tool input group
    $scope.$watchCollection(
      function () {
        return fileService.nodeSelectCollection;
      },
      function () {
        vm.nodeSelectCollection = fileService.nodeSelectCollection;
        vm.inputFileTypeColor = fileService.inputFileTypeColor;
      }
    );

    // only show the selection and input group column when a tool is selected
    $scope.$watchCollection(
      function () {
        return toolService.selectedTool;
      },
      function () {
        vm.currentTypes = fileService.currentTypes;
        vm.tool = toolService.selectedTool;
        if (fileBrowserFactory.customColumnNames.length > 0) {
          toggleToolColumn();
        }
      }
    );

    $scope.$watch(
        function () {
          return dataSetPropsService.userPerms;
        },
        function () {
          vm.userPerms = dataSetPropsService.userPerms;
        }
    );

    // needed for after a tool_launch and a dataset is not clean
    $scope.$watchCollection(
      function () {
        return dataSetPropsService.dataSet;
      },
      function () {
        refreshDataSetProps();
      }
    );

    $scope.$watch(function () {
      return vm.assayFilterFilesTotal;
    }, function () {
      // turn off infinite scrolling when file list is short
      if (vm.assayFilterFilesTotal <= maxFileRequest && typeof vm.gridApi !== 'undefined') {
        vm.gridApi.infiniteScroll.setScrollDirections(false, false);
      }
    });
  }
})();
