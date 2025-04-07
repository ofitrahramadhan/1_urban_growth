//--------------------------------data processing------------------------------------

//1. center to the aoi
Map.centerObject(aoi, 9);

//2.1 calculate the urban area size overtime (2001 - 2023)
var urban = ee.ImageCollection('MODIS/061/MCD12Q1').select('LC_Type1')
.map(function(img){
  var urban_area = img.eq(13);
  var urban_mask = img.updateMask(urban_area);
  var mask_area = urban_area.multiply(ee.Image.pixelArea().divide(1e6));
  return mask_area.copyProperties(img, ['system:time_start','system:time_end']);
});
print(urban);

//2.2 calculate annual urban growth
var start_time = ee.Date('2001');
var end_time = ee.Date('2023');
var dif = end_time.difference(start_time, 'year').round();
var list = ee.List.sequence(0, dif.subtract(1), 1).map(function(delta) {
  var list_date = start_time.advance(delta, 'year');
  return list_date;
});
print(list);

var urban_growth = list.map(function(time) {
  var t_1 = ee.Date(time);
  var t = t_1.advance(1, 'year');
  
  var urban_t_1 = urban.filterDate(t_1, t).sum();
  var area_t_1 = urban_t_1.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 500,
    maxPixels: 1e13
  }).getNumber('LC_Type1');
  
  var urban_t = urban.filterDate(t, t.advance(1, 'year')).sum();
  var area_t = urban_t.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 500,
    maxPixels: 1e13
  }).getNumber('LC_Type1');
  
  var growth_t = ((area_t.subtract(area_t_1)).divide(area_t_1)).multiply(100);
  return ee.Feature(null, {
    'year': t.get('year'),
    'urban_growth_rate_%': growth_t
  });
  
});
print(urban_growth);

//3.1. visualize the latest urban area
var urban23 = ee.ImageCollection('MODIS/061/MCD12Q1').select('LC_Type1');
urban23 = urban23.filterDate('2023-01-01','2024-01-01').first();
urban23 = urban23.clip(aoi);
urban23 = urban23.eq(13);
urban23 = urban23.updateMask(urban23);
//print(urban23);

//3.2. visualize the earliest urban area
var urban01 = ee.ImageCollection('MODIS/061/MCD12Q1').select('LC_Type1');
urban01 = urban01.filterDate('2001-01-01', '2002-01-01').first();
urban01 = urban01.clip(aoi);
urban01 = urban01.eq(13);
urban01 = urban01.updateMask(urban01);
//print(urban01);

//--------------------------------visualization------------------------------------

//b. visualization
Map.addLayer(aoi, {}, 'administrasi cekban', false, 0.7);
Map.addLayer(urban23, {palette: ['ff0000']}, 'IGBP land cover 2023', false, 0.7);
Map.addLayer(urban01, {palette: ['009900']}, 'IGBP land cover 2001', false, 0.7);

//b.1. absolute urban growth
var abs_urban_growth =  ui.Chart.image.series(urban, aoi, ee.Reducer.sum(), 500, 'system:time_start')
  .setOptions({
    title: 'The Absolute Growth of Bandung Metropolitan Area in 2001-2024',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Square Kilometers" (km²)'},
    series: {0: {color: 'blue'}}
  });
print(abs_urban_growth);
  
//b.2. annual urban growth
var urban_growth_fc = ee.FeatureCollection(urban_growth);
print(urban_growth_fc, 'Urban Growth Collection');

var annual_growth_chart = ui.Chart.feature.byFeature(urban_growth_fc, 'year', 'urban_growth_rate_%')
  .setOptions({
    title: 'Annual Growth Rate of Bandung Metropolitan Area 2002 - 2023 (%)',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Growth Rate (%)'},
    series: {0: {color: 'blue'}}
  });
print(annual_growth_chart);

//c. export map
//Export.image.toAsset({
//  image: urban01,
//  description: 'urban_cekban_2001',
//  assetId: 'users/ofitrahramadhan/tutorial',
//  scale: 500,
//  region: urban01.geometry().bounds(),
//  maxPixels: 1e13
//});

//Export.image.toAsset({
//  image: urban23,
//  description: 'urban_cekban_2023',
//  assetId: 'users/ofitrahramadhan/tutorial',
//  scale: 500,
//  region: urban23.geometry().bounds(),
//  maxPixels: 1e13
//});

//--------------------------------user interface------------------------------------

// Create two maps
var leftMap = ui.Map();
var rightMap = ui.Map();

// Create before and after map layers
var beforeLayer = ui.Map.Layer(urban01, {palette: ['009900']}, 'Urban 2001');
var afterLayer = ui.Map.Layer(urban23, {palette: ['ff0000']}, 'Urban 2023');

// Add layers to the maps
leftMap.layers().set(0, beforeLayer);
rightMap.layers().set(0, afterLayer);

// Synchronize both maps
var linker = ui.Map.Linker([leftMap, rightMap]);
leftMap.centerObject(aoi, 0);

// Create a split panel
var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  orientation: 'horizontal', // Left-Right comparison
  wipe: true // Enables draggable slider
});

// Add the split panel to the UI
ui.root.widgets().reset([splitPanel]);