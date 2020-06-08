/* eslint-disable no-console, no-plusplus */

/* global d3, turf, Sha1 */

// Variables

let timerIntersect;
let timerUnion;
let tsIntersectTotalElapsed;
let mergeElapsed;
let mergeCount = 0;
const resource = 'geo-buffer.geojson';
let layers = [];

// Functions

// polyfill for missing turf method
if (turf.bbox === undefined) {
  turf.bbox = (polygon) => {
    // did we get a polygon?
    if (polygon.geometry.type.toLowerCase() !== 'polygon') {
      throw new Error('TypeError', 'Expected Polygon');
    }

    // Get the coordinates
    const linearRing = polygon.geometry.coordinates;
    // console.log("linearRing", linearRing)

    // Compute the extent
    const extentLng = d3.extent(linearRing[0], (d) => d[1]);
    const extentLat = d3.extent(linearRing[0], (d) => d[0]);

    // Generate result
    return [extentLat[0], extentLng[0], extentLat[1], extentLng[1]];
  };
}

async function getGeojson(geojson, callback) {
  try {
    fetch(geojson)
      .then((response) => {
        response.json().then((data) => {
          callback(data);
        });
      });
  } catch (e) {
    console.log(`Could not fetch resource ${resource}`);
  }
}

function init() {
  var doMerge = false;
  console.log('init', layers);

  layers[0] = toPolygonArray(layers[0])
  layers[0] = turf.featurecollection(layers[0])
  console.log('main layer: ', layers[0])

  mapboxgl.accessToken = 'pk.eyJ1IjoiYm9lcmljIiwiYSI6IkZEU3BSTjQifQ.XDXwKy2vBdzFEjndnE4N7Q';
  var center = [-122.45, 37.75];

  var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/boeric/cipbfpxon001kbbnp2hd32fe4',
      center: center,
      zoom: 12
  });
  map.addControl(new mapboxgl.Navigation());

  map.on('click', function(e) {
    var p = {
      'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [e.lngLat.lng, e.lngLat.lat]
      }
    };
    console.log('[' + e.lngLat.lng + ', ' + e.lngLat.lat + '],')
  })
  map.getCanvas().style.cursor = 'crosshair'

  //map.scrollZoom.disable()
  map.dragRotate.disable();
  map.off('contextmenu')

  // Setup our svg layer that we can manipulate with d3
  var container = map.getCanvasContainer()

  var path = d3.geo.path()
      .projection(function(lonlat, i) {
        try {
          var p = map.project(new mapboxgl.LngLat(lonlat[0], lonlat[1]))
          return [p.x, p.y];
        } catch(e) {
          console.log(e, i, lonlat)
        }
      });

  var buffered = buffer(layers[0], 200, 'meters');
  console.log('buffered', buffered);

  var svg = d3.select(container).append('svg')
  var land = svg.append('path')
    .datum(layers[0])
    .attr('class', 'land');

  function render() { land.attr('d', path); }
  render();

  var setStrokeWidth = function(w) {
    land.style('stroke-width', w + 'px')
  }

  var lastRadius = 200;
  var setRadius = function(r) {
    console.log('setting radius ', r);
    r = r || lastRadius;
    lastRadius = r;

    var startTime = Date.now();

    enableUI(false);
    buffered = buffer(layers[0], r, 'meters');
    enableUI(true);

    var buffTime = Date.now();
    land.datum(r === 0 ? layers[0] : buffered);
    var datumTime = Date.now();
    render();
    var renderTime = Date.now();

    //console.log("turf.buffer: ", buffTime - startTime)
    d3.select('#bufferTime').text('Buffer computation: ' + (buffTime - startTime) + ' ms');
    d3.select('#unionTime').text('Union computation: ');
    //console.log("d3.datum: ", datumTime - startTime)
    //console.log("d3.render: ", renderTime - startTime)

    tsIntersectTotalElapsed = 0;

    if (doMerge) {
        enableUI(false);

        console.log('do merge...')
        d3.select('#unionTime').text('Union computation: (computing...)');

        setTimeout(function() {
          console.log('generating union...');

          mergeCount = 0;
          mergeElapsed = 0;
          var start = Date.now();

          var merged = fCPolygonUnion(buffered);

          enableUI(true);

          var end = Date.now();
          console.log('generated union, elapsed time: ', end - start);
          console.log('mergeCount', mergeCount)

          console.log('IntersectTotalElapsed', tsIntersectTotalElapsed);
          console.log('mergeElapsed', mergeElapsed)
          d3.select('#unionTime').text('Union computation: ' + mergeElapsed + ' ms');

          land.style('stroke', 'black')
          land.datum(merged);
          render();

        }, 100)
    }

    return true;
  }

  d3.select('#control').select('input[type=range]').on('change', function() {
    var elem = d3.select(this);
    var value = elem.property('value')
    d3.select('#distanceLabel').text('Distance From Park: ' + value + ' meters');
    setRadius(value);
  })

  d3.select('#control').select('input[type=range]').on('input', function() {
    var elem = d3.select(this);
    var value = elem.property('value')
    d3.select('#distanceLabel').text('Distance From Park: ' + value + ' meters');
  })

  d3.select('#polygonStrokeCheckbox').on('click', function() {
    var elem = d3.select(this);
    var checked = elem.property('checked');
    console.log('checked', checked);
    var stroke = checked ? 'black' : 'none'
    land.style('stroke', stroke)
  })

  d3.select('#mergePolygonsCheckbox').on('click', function() {
    var elem = d3.select(this);
    var checked = elem.property('checked');
    console.log('checked', checked);
    doMerge = checked;
    setRadius();
  })

  var uiElements = [
    d3.select('input[type=range]'),
    d3.select('#polygonStrokeCheckbox'),
    d3.select('#mergePolygonCheckbox')
  ]
  uiElements.length = 1;
  function enableUI(bool) {
    uiElements.forEach(function(d) {
      console.log(d, bool)
      d.property('disabled', !bool);
    })
  }

  // re-render our visualization whenever the view changes
  map.on('viewreset', function() { render(); })
  map.on('move', function() { render(); })
}


function buffer(fC, r) {

  var polygons = toPolygonArray(fC);
  var bufferedPolygons = [];

  polygons.forEach(function(polygon) {
    try {
      var fCTemp = turf.buffer(polygon, r, 'meters');
      var bufferedPolygon = fCTemp.features[0];
      var linearRing = bufferedPolygon.geometry.coordinates;
      var id = Sha1.hash(JSON.stringify(linearRing));
      var name = polygon.properties['map_park_n'];
      var polygon = turf.polygon(linearRing, { id: id, map_park_n: name });
      bufferedPolygons.push(polygon)
    } catch(e) {
      console.error('Error: ' + e)
    }
  })

  d3.select('#inputPolygons').text('Input polygons: ' + bufferedPolygons.length)
  d3.select('#outputPolygons').text('Output polygons: ' + bufferedPolygons.length)

  bufferedPolygons = turf.featurecollection(bufferedPolygons);
  console.log('bufferedPolygons', bufferedPolygons);

  return bufferedPolygons;
}

// Take a multiPolygon feature and return an array of polygon features
function multiToArray(m) {
  const polygons = [];

  if (m.geometry.type.toLowerCase() != 'multipolygon') {
    throw new Error('TypeError', 'Expected MultiPolygon');
  }

  // create polygons
  m.geometry.coordinates.forEach((linearRing) => {
    const id = Sha1.hash(JSON.stringify(linearRing));
    const polygon = turf.polygon(linearRing, { id });
    polygons.push(polygon);
  });

  return polygons;
}

// Flatten a feature collection consisting of polygons and multi polygons
function toPolygonArray(fC) {
  let arr = [];

  fC.features.forEach((feature) => {
    const type = feature.geometry.type.toLowerCase();
    let linearRing;
    let id;
    let name;
    let polygon;

    switch (type) {
      case 'polygon':
        linearRing = feature.geometry.coordinates;
        id = Sha1.hash(JSON.stringify(linearRing));
        name = feature.properties.map_park_n;
        polygon = turf.polygon(linearRing, { id: id, map_park_n: name });
        arr.push(polygon);
        break;
      case 'multipolygon':
        arr = arr.concat(multiToArray(feature));
        break;
      default:
        console.error(`Invalid geometry type: ${type}`);
    }
  });
  return arr;
}

/**
 *  Function to reduce the polygon count of a GeoJSON FeatureCollection,
 *  by merging overlapping polygons, using turf.intersect and turf.union
 */

function fCPolygonUnion(fC) {
/*
  Algorithm:

  1. Flatten the fC to an array of polygons
  2. Create master combined polygon map object
  3. Loop through polygon array
     - For each test polygon
       - Loop through all current polygons in map
       - Generate array of intersecting polygons
       – If no intersecting polygons, add test polygon to map
       - Process intersecting polygons recursively
       – Create a copy intersecting array
       - Create temporary polygon, initially set to test polygon
       – Recursively process array copy, removing and processing one polygon at a time
       - Perform union of temporary polygon and current polygon
       - Replace temporary polygon with unioned polygon
       - Repeat until array copy is empty
       - Delete the intersecting polygons from map
       - Add the temporary polygon to map
  4. Convert polygon map to array
  5. Create feature collection from array
*/

  timerIntersect = 0;
  timerUnion = 0;
  // let timerMerge = 0;

  // create array of polygons
  const polygons = toPolygonArray(fC);
  console.log('Input polygon count: ', polygons.length);

/*
  // ensure that each has a unique id
  polygons.forEach(function(polygon) {
    delete polygon.properties.id;

    if (!(id in polygon.properties)) {
      var linearRing = polygon.geometry.coordinates;
      var id = Sha1.hash(JSON.stringify(linearRing));
      polygon.properties.id = id;
    }
  })
*/

  // Create map to hold unioned polygons
  const polygonMap = {};

  // Process each polygon
  polygons.forEach((testPolygon, i) => {
    // console.log("Processing polygon: ", i, testPolygon.properties["map_park_n"])

    // Get all current keys in the polygon map
    const mapItems = Object.keys(polygonMap);

    // is the map empty?
    if (mapItems.length > 0) {
      // Map not empty
      const tsIntersectTotalStart = Date.now();

      // array to hold potential intersections between test polygon and map polygons
      const intersects = [];

      // Loop through each map polygon
      mapItems.forEach((mapItem) => {
        // Get the map polygon
        const mapPolygon = polygonMap[mapItem];

        // Perform bounding box check before using turf.intersect (which is expensive)
        const tBB = turf.bbox(testPolygon);
        // console.log("tBB", JSON.stringify(tBB, null, 1))

        /* eslint-disable prefer-destructuring */
        const mBB = turf.bbox(mapPolygon);
        tBB.minX = tBB[0];
        tBB.maxX = tBB[2];
        tBB.minY = tBB[1];
        tBB.maxY = tBB[3];
        mBB.minX = mBB[0];
        mBB.maxX = mBB[2];
        mBB.minY = mBB[1];
        mBB.maxY = mBB[3];
        /* eslint-enable prefer-destructuring */
        // console.log("testBB", JSON.stringify(testPolygonBB, null, 1));

        function BBIntersect(tBB, mBB) {
          if (tBB.maxX < mBB.minX) return false; // tBB is left of mBB
          if (tBB.minX > mBB.maxX) return false; // tBB is right of mBB
          if (tBB.maxY < mBB.minY) return false; // tBB is above mBB
          if (tBB.minY > mBB.maxY) return false; // tBB is below mBB
          return true; // tBB overlap mBB
        }

        if (BBIntersect(tBB, mBB)) {
          // Test for intersection
          const tsStart = Date.now();
          let intersect;

          try {
            intersect = turf.intersect(testPolygon, mapPolygon);
            // console.log("intersect", JSON.stringify(intersect,null, 1))
          } catch (e) {
            console.error('Error in turf.intersect: ' + e + ', polygon: ' + testPolygon.properties.map_park_n);
            return;
          }
          const tsEnd = Date.now();
          timerIntersect += tsEnd - tsStart;

          // if intersection, save the map polygon
          if (intersect !== undefined) {
            intersects.push(mapPolygon);
          }
        }
      })

      var tsIntersectTotalEnd = Date.now();
      tsIntersectTotalElapsed += tsIntersectTotalEnd - tsIntersectTotalStart;

      if (intersects.length == 0) {
        // no intersection: add test polygon to polygon map
        testPolygon.properties.mergeCount = 1;
        polygonMap[testPolygon.properties.id] = testPolygon;

      } else {
        // intersection(s) found, merge in the test polygon taking into account the intersects
        mergeMap(testPolygon, intersects);
      }

    } else {
      // map empty

      //initialize map
      testPolygon.properties.mergeCount = 1;
      polygonMap[testPolygon.properties.id] = testPolygon;
    }
  });

  // Function to merge in
  function mergeMap(testPolygon, intersects) {
    // console.log("  Creating union polygon of ", intersects.length, " polygons (total polygons: ", Object.keys(polygonMap).length + ")");

    // Object to mutate through the recursion (set initially to the polygon under test)
    let enteringPolygon = JSON.parse(JSON.stringify(testPolygon));
    enteringPolygon.properties.mergeCount = 0;

    // Copy of the intersection array
    const polygons = intersects.slice();

    // Function to recursivly merge an array of polygons
    function merge() {
      mergeCount++;

      // Pluck first item off the polygon array
      const mapPolygon = polygons.shift();

      // Perform union of the entering polygon and this map polygon
      const tsStart = Date.now();
      let unionPolygon;
      try {
        unionPolygon = turf.union(enteringPolygon, mapPolygon);
      } catch (e) {
        console.error(`Error in turf.union: ' ${e} ', polygon: '${testPolygon.properties.map_park_n}`);
        return;
      }
      const tsEnd = Date.now();
      timerUnion += tsEnd - tsStart;

      if (unionPolygon.geometry.type.toLowerCase() != 'polygon') {
        throw new Error('TypeError', 'Polygon was expected')
      }

      // Create id for union polygon
      const linearRing = unionPolygon.geometry.coordinates;
      const id = Sha1.hash(JSON.stringify(linearRing));
      unionPolygon.properties.id = id;
      unionPolygon.properties.map_park_n =
        `${enteringPolygon.properties.map_park_n} | ${mapPolygon.properties.map_park_n}`;
      unionPolygon.properties.mergeCount = enteringPolygon.properties.mergeCount + mapPolygon.properties.mergeCount + 1;

      // Replace entering polygon
      enteringPolygon = unionPolygon;

      // Repeat until done
      if (polygons.length > 0) {
        merge();
      };
    }

    // merge the polygons recursively
    const mergeStart = Date.now();
    merge();
    mergeElapsed += Date.now() - mergeStart;

    // Remove the intersecting polygons
    intersects.forEach((removePolygon) => {
      delete polygonMap[removePolygon.properties.id];
    });

    // Add entering polygon to map
    polygonMap[enteringPolygon.properties.id] = enteringPolygon;
  }

  // Create output polygon array
  const finalPolygons = [];
  Object.keys(polygonMap).forEach((mapItem) => {
    finalPolygons.push(polygonMap[mapItem]);
  });
  console.log('Output polygon count: ', finalPolygons.length);
  d3.select('#outputPolygons').text(`Output polygons: ${finalPolygons.length}`)

  console.log(`Intersect test time: ${timerIntersect}`);
  console.log(`Union processing time: ${timerUnion}`);

  const fCFinal = turf.featurecollection(finalPolygons);
  return fCFinal;

} // end fCPolygonUnion

// Entry point
getGeojson(resource, (data) => {
  layers = [data];
  init();
});
