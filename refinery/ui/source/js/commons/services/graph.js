function GraphFactory (_, Webworker) {

  function Graph () {}

  /**
   * Update a graph's annotations
   *
   * @method  updateAnnotations
   * @author  Fritz Lekschas
   * @date    2015-12-21
   * @static
   * @return  {Graph}  Updated graph.
   */
  Graph.updateAnnotations = function (graph, annotations) {
    // Note: Looping over the large graph unconditionally and looping again over
    // all annotations is **faster** than one conditional loop, which is
    // potentially due to the high number of comparisons.
    var nodeKeys = Object.keys(graph), i;

    for (i = nodeKeys.length; i--;) {
      graph[nodeKeys[i]].numDataSets = 0;
    }

    nodeKeys = Object.keys(annotations);
    for (i = nodeKeys.length; i--;) {
      if (graph[nodeKeys[i]]) {
        graph[nodeKeys[i]].numDataSets = annotations[nodeKeys[i]].total;
      }
    }
  };

  Graph.accumulateAndPruneNew = function (graph, root, valueProperty) {
    var nodeIndex = {};

    function init () {
      traverseDepthFirst(graph[root], 0, 0);
    }

    function processChild (parentNode, childNode) {
      // Store a reference to the parent
      if (!childNode.parents) {
        childNode.parents = [];
      }
      childNode.parents.push(parentNode);
    }

    function processLeaf (node, childNo) {
      if (node.value) {
        child.meta.leaf = true;
      } else {
        if (node.parent) {
          // Remove node from the parent's children array if parent exist.
          node.parent.children.splice(childNo, 1);
        }
        node.deleted = true;
      }
    }

    function processInnerNode (node) {
      if (node.children.length === 1 && node.value === 0) {

      }
    }

    function processNode (node, childNo) {
      // Set `value` property depending on the lenght of the actual value
      node.value = Object.keys(node[valueProp]).length;

      if (node.children.length) {
        // Inner node
        processInnerNode(node);
      } else {
        // Leaf
        processLeaf(node, childNo);
      }
    }

    function traverseDepthFirst (node, depth, childNo) {
      if (nodeIndex[node.uri]) {
        // Skip node
        return;
      }

      if (!node.meta) {
        node.meta = {};
      }

      // Distance to `OWL:Thing`
      node.meta.originalDepth = depth;

      // Traverse over all children from the last to the first
      for (var i = node.children.length; i--;) {
        processChild(node, graph[node.children[i]]);
        traverseDepthFirst(graph[node.children[i]], depth + 1, i);
      }

      processNode(node, childNo);
    }

    init();
  };

  /**
   * Prune graph and accumulate the value property.
   *
   * @method  accumulateAndPrune
   * @author  Fritz Lekschas
   * @date    2015-12-21
   *
   * @param   {Object}  data        Original graph.
   * @param   {String}  valueProp   Name of the property holding the value to be
   *                                accumulated.
   * @return  {Object}              Pruned graph.
   */
  Graph.accumulateAndPrune = function (graph, root, valueProp) {
    var node = graph[root];
    var nodeIndex = {};
    var numChildren = node.children ? node.children.length : false;

    node.meta = node.meta || {};

    if (numChildren) {
      accumulateAndPruneChildren(node, numChildren, valueProp, 0);
    }

    /**
     * Recursively accumulate `valueProp` values and prune _empty_ leafs.
     *
     * This function traverses all inner loops and stops one level BEFORE a leaf
     * to be able to splice (delete) empty leafs from the list of children
     *
     * @method  accumulateAndPruneChildren
     * @author  Fritz Lekschas
     * @date    2016-01-15
     *
     * @param   {Object}   node         D3 data object of the node.
     * @param   {Number}   numChildren  Number of children of `node.
     * @param   {String}   valueProp    Name of the property that represents an
     *   object of unique elements. The number of unique elements accounts for
     *   the rectangle size of the tree map and length of the bar charts. The
     *   property needs to be an object to easily assess unique IDs without
     *   having to iterate over the array all the time.
     * @param   {Number}   depth        Original depth of the current node.
     * @param   {Boolean}  root         If node is the root.
     */
    function accumulateAndPruneChildren (node, numChildren, valueProp, depth) {
      // Check if node has been processed already
      if (nodeIndex[node.uri]) {
        // Skip node
        return;
      }

      // A reference for later
      node.meta.originalDepth = depth;
      var i = numChildren;
      var j;
      var childValue;
      var parentsUri;

      // We move in reverse order so that deleting nodes doesn't affect future
      // indices.
      while (i--) {
        var child = graph[node.children[i]];
        var numChildChildren = child.children ? child.children.length : false;

        // Store a reference to the parent
        if (!child.parents) {
          child.parents = {};
        }
        child.parents[node.uri] = node;

        child.meta = child.meta || {};

        if (numChildChildren) {
          // Inner node.
          accumulateAndPruneChildren(
            child, numChildChildren, valueProp, depth + 1);
          numChildChildren = child.children.length;
        }

        childValue = Object.keys(child[valueProp]);

        // We check again the number of children of the child since it can happen
        // that all children have been deleted meanwhile and the inner node became
        // a leaf as well.
        if (numChildChildren) {
          // Inner node.
          if (childValue.length) {
            // Add own `numDataSets` to existing `value`.
            child.value = childValue.length;
          } else {
            // We prune `child` because it doesn't have any direct value in
            // two cases:
            // A) `child` is the only child of `node` or
            // B) `child` only has one child.
            // This way we ensure that the out degree of `child` is two or higher.
            if (numChildren === 1 || numChildChildren === 1) {
              // We can remove the inner node since it wasn't used for any
              // annotations.
              for (j = 0, len = child.children.length; j < len; j++) {
                // We keep a reference of _pruned_ children
                if (graph[child.children[j]].meta.pruned) {
                  graph[child.children[j]].meta.pruned.unshift(child.name);
                } else {
                  graph[child.children[j]].meta.pruned = [child.name];
                }

                // Decrease the actual depth
                graph[child.children[j]].meta.depth--;

                if (graph[child.children[j]].parents) {
                  parentsUri = Object.keys(graph[child.children[j]].parents);
                  for (var o = parentsUri.length; o--;) {
                    // Remove child as parent from child's children and add node
                    // as a parent.
                    if (graph[child.children[j]].parents[parentsUri[o]] === child) {
                      // Remove former parent
                      graph[child.children[j]].parents[parentsUri[o]] = undefined;
                      delete graph[child.children[j]].parents[parentsUri[o]];
                      // Set new parent
                      graph[child.children[j]].parents[node.uri] = node;
                    }
                  }
                }

                node.children.push(child.children[j]);
              }
              // Remove the child with the empty valueProp
              node.children.splice(i, 1);

              child.pruned = true;

              // Check if we've processed the parent of the child to be pruned
              // already and set `pruned` to false.
              parentsUri = Object.keys(child.parents);
              for (var k = parentsUri.length; k--;) {
                if (nodeIndex[child.parents[parentsUri[k]].uri]) {
                  // Revert pruning
                  child.pruned = false;
                  break;
                }
              }
            } else {
              // From this perspective the child doesn't need to be pruned. If
              // it has been marked as such already we should revert this.
              child.pruned = false;
            }
          }
        } else {
          // Leaf.
          if (childValue.length === 0) {
            // Leaf was not used for annotation so we remove it.
            node.children.splice(i, 1);
            numChildren--;
            child.pruned = true;
            continue;
          } else {
            child.value = childValue.length;
            child.meta.leaf = true;
            child.parents = {};
            child.parents[node.uri] = node;
          }
        }

        // Merge child's `valueProp` with the parent's, i.e. `node`,
        // `valueProp`.
        for (var p = childValue.length; p--;) {
          node[valueProp][childValue[p]] = true;
        }
        node.value = Object.keys(node[valueProp]).length;
      }

      // Mark node as being parsed
      nodeIndex[node.uri] = true;
    }

    // Make sure that the root node has at least 2 children
    if (node.children.length === 1) {
      graph[root].pruned = true;
      root = node.children[0];
    }

    // Clear pruned nodes
    var uris = Object.keys(graph);
    for (var i = uris.length; i--;) {
      if (graph[uris[i]].pruned) {
        graph[uris[i]] = undefined;
        delete graph[uris[i]];
      }
    }

    return {
      graph: graph,
      root: root
    };
  };

  /**
   * Initialize precision and recall in-place.
   *
   * @description
   * Initially recall will always be `1` because we are expected to return all
   * datasets in the beginning.
   *
   * @method  initPrecisionRecall
   * @author  Fritz Lekschas
   * @date    2015-12-22
   * @param   {Object}   graph            Graph to be initialized.
   * @param   {String}   valueProp        Name of the property that represents
   *   an object of unique elements. The number of unique elements accounts for
   *   the rectangle size of the tree map and length of the bar charts. The
   *   property needs to be an object to easily assess unique IDs without
   *   having to iterate over the array all the time.
   * @param   {Integer}  numAnnoDataSets  Total number of annotated datasets.
   *   This number might be smaller than the total number of all data sets since
   *   some might not be annotated.
   */
  Graph.initPrecisionRecall = function (graph, valueProperty, numAnnoDataSets) {
    var uris = Object.keys(graph), node;

    for (var i = uris.length; i--;) {
      node = graph[uris[i]];
      node.precision = Object.keys(node[valueProperty]).length /
        numAnnoDataSets;
      node.precisionTotal = node.precision;
      node.recall = 1;
    }
  };

  Graph.updatePrecisionRecall = function (graph, valueProperty, numAnnoDataSets) {
    var uris = Object.keys(graph), node;

    for (var i = uris.length; i--;) {
      node = graph[uris[i]];

      if (!node.clone) {
        node.precision = Object.keys(node[valueProperty]).length /
          numAnnoDataSets;
        node.recall = 1;
      }
    }
  };

  /**
   * Helper function to copy in-place properties to `data.bars` which is needed
   * by the list graph.
   *
   * @description
   * The reason for having an extra `data` property is that cloned nodes will be
   * unique in any way except for their `data` property.
   *
   * @example
   * Given the following graph:
   * ```
   * {
   *   children: [...],
   *   name: 'test',
   *   length: 10
   * }
   * ```
   * The property `length` would be copied over like so:
   * ```
   * {
   *   children: [...],
   *   name: 'test',
   *   length: 10,
   *   data: {
   *     bars:
   *   }
   * }
   * ```
   *
   *
   * @method  propertyToBar
   * @author  Fritz Lekschas
   * @date    2015-12-22
   * @param   {Object}  graph       Graph to be modified.
   * @param   {Array}   properties  List of properties to be copied.
   */
  Graph.propertyToBar = function (graph, properties) {
    var uris = Object.keys(graph), node, propLeng = properties.length;

    for (var i = uris.length; i--;) {
      node = graph[uris[i]];
      if (!node.data) {
        node.data = { bars: {} };
      } else {
        if (!node.data.bars) {
          node.data.bars = {};
        }
      }
      for (var j = propLeng; j--;) {
        if (node[properties[j]]) {
          node.data.bars[properties[j]] = node[properties[j]];
        } else {
          node.data.bars[properties[j]] = 0;
        }
      }
    }
  };

  Graph.updatePropertyToBar = function (graph, properties) {
    var uris = Object.keys(graph), node, propLeng = properties.length;

    for (var i = uris.length; i--;) {
      node = graph[uris[i]];
      for (var j = propLeng; j--;) {
        if (node[properties[j]]) {
          for (var k = node.data.bars.length; k--;) {
            if (node.data.bars[k].id === properties[j]) {
              node.data.bars[k].value = node[properties[j]];
            }
          }
        }
      }
    }
  };

  Graph.propertyToData = function (graph, properties) {
    var uris = Object.keys(graph), node, propLeng = properties.length;

    for (var i = uris.length; i--;) {
      node = graph[uris[i]];
      if (!node.data) {
        node.data = {};
      }

      for (var j = propLeng; j--;) {
        node.data[properties[j]] = node[properties[j]];
      }
    }
  };

  Graph.toTreemap = function (graph, root) {
    var newGraph = _.cloneDeep(graph),
        nodes = Object.keys(newGraph),
        node,
        uris;

    for (var i = nodes.length; i--;) {
      node = newGraph[nodes[i]];
      // Remove parent reference
      node.parents = undefined;
      delete node.parents;
      // Copy URIs temporarily
      uris = node.children.slice();
      // Initialize new array
      node.children = [];
      // Push node references into `children`
      for (var j = uris.length; j--;) {
        node.children.push(newGraph[uris[j]]);
      }
    }

    // Deep clone object to be usable by D3's tree map layout.
    return JSON.parse(JSON.stringify(newGraph[root]));
  };

  Graph.toTree = function (graph, root) {
    var nodeVisited = {},
        tree = {};

    function duplicateNode (originalNode) {
      originalNode.meta.numClones++;

      var newId = originalNode.uri + '.' + originalNode.meta.numClones;

      tree[newId] = {
        children: [],
        childrenIds: [],
        cloneId: originalNode.meta.numClones,
        uri: newId,
        meta: originalNode.meta,
        name: originalNode.name,
        value: originalNode.value
      };

      for (var j = 0, jLen = originalNode.childrenIds.length; j < jLen; j++) {
        tree[newId].childrenIds.push(originalNode.childrenIds[j]);
      }

      return tree[newId];
    }

    function traverse (node) {
      var child;

      nodeVisited[node.uri] = true;

      if (!node.meta) {
        node.meta = {};
      }

      if (!node.cloneId) {
        node.childrenIds = node.children;
        node.children = [];
        node.cloneId = 0;
        node.meta.numClones = 0;
      }

      for (var i = node.childrenIds.length; i--;) {
        if (!nodeVisited[node.childrenIds[i]]) {
          child = tree[node.childrenIds[i]];
          node.children.push(tree[node.childrenIds[i]]);
        } else {
          // Need to duplicate node
          child = duplicateNode(tree[node.childrenIds[i]]);
          // Update parent's child ID
          node.childrenIds[i] = child.uri;
          node.children.push(child);
        }
        traverse(child);
      }
    }

    function copyNodes(oldGraph, newGraph) {
      var nodeIds = Object.keys(oldGraph),
          properties;

      for (var i = nodeIds.length; i--;) {
        newGraph[nodeIds[i]] = {};
        properties = Object.keys(oldGraph[nodeIds[i]]);
        for (var j = properties.length; j--;) {
          newGraph[nodeIds[i]][properties[j]] = oldGraph[nodeIds[i]][properties[j]];
        }
      }
    }

    function removeUnusedNodes () {
      var ids = Object.keys(tree), counterDelete = 0, counterKeep = 0;
      for (var k = ids.length; k--;) {
        if (!nodeVisited[ids[k]]) {
          counterDelete++;
          delete tree[ids[k]];
          tree[ids[k]] = undefined;
        } else {
          counterKeep++;
        }
      }
      // console.log('Kept: ' + counterKeep + ' | Deleted: ' + counterDelete);
    }

    copyNodes(graph, tree);
    traverse(tree[root]);
    removeUnusedNodes();

    return tree[root];
  };

  Graph.addPseudoRootAndSibling = function (graph, root, allDsIds) {
    var dataSets = {},
        annotatedDsIds = Object.keys(graph[root].dataSets),
        notAnnotatedDsIds = {},
        allDsIdsObj = {};

    for (var i = allDsIds.length; i--;) {
      allDsIdsObj[allDsIds[i]] = true;
      notAnnotatedDsIds[allDsIds[i]] = true;
    }

    for (var j = annotatedDsIds.length; j--;) {
      notAnnotatedDsIds[annotatedDsIds[j]] = undefined;
      delete notAnnotatedDsIds[annotatedDsIds[j]];
    }

    graph['_no_annotations'] = {
      assertedDataSets: {},
      children: [],
      meta: {
        originalDepth: 0,
        leaf: true
      },
      parents: {},
      dataSets: notAnnotatedDsIds,
      name: 'No annotations',
      numDataSets: Object.keys(notAnnotatedDsIds).length,
      ontId: '_no_annotations',
      uri: '_no_annotations',
      value: Object.keys(notAnnotatedDsIds).length,
    };

    graph['_root'] = {
      assertedDataSets: {},
      children: [root, '_no_annotations'],
      dataSets: allDsIdsObj,
      name: 'Root',
      meta: {
        originalDepth: -1
      },
      numDataSets: Object.keys(allDsIdsObj).length,
      ontId: '_root',
      uri: '_root',
      value: Object.keys(allDsIdsObj).length,
    };

    graph['_no_annotations'].parents['_root'] = graph['_root'];
    graph[root].parents = {};
    graph[root].parents['_root'] = graph['_root'];

    return '_root';
  };

  return Graph;
}

angular
  .module('refineryApp')
  .service('graph', [
    '_',
    'Webworker',
    GraphFactory
  ]);