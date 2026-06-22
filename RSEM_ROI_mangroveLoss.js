/*
Remote Sensing and Environmental Modelling - Synthetic Aperture Radar 
Topic: Irreversible Mangrove loss due to Hurricane Irma (2017), Florida.

GEE-Script to detect mangrove loss caused by Hurricane Irma, 
to find Sentinel-1 GRD and Sentinel-2 GRD products in Copernicus Data Hub. 
 
Area: Southwest Florida (Wood Key Cove)
Output: Log-Term Mangrove loss ROI as GeoJson

Course: MNF-Geogr-332: Remote Sensing and Environmental Modelling - Synthetic Aperture Radar (Exercise) (060174)
Author: Justin Lingg-Laham
*/


// 1. Study area (Defined by visuall search and comparing to Liang et al. 2025, Figure 2)
var aoi = roi;

Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: "white"}, "ROI");

// 2. Time Scale (Reference: US Department of Commerce)
// Hurricane Irma in Florida: September 10th, 2017
var pre_start = "2017-06-01";
var pre_end   = "2017-09-09";

var post_start = "2017-09-15";
var post_end   = "2017-12-31";

// Long-term comparison
var recent_start = "2026-01-01";
var recent_end   = "2026-06-21";

// 3. Parameters
// Green mask threshold (High = Vegetation (Mangrove))
var ndvi_threshold = 0.50;

// Direct Hurricane damage threshold
var hurricane_ndvi_drop = -0.20;

// Long-term Mangrove loss threshold (recent NDVI lower than pre-Hurricane-NDVI)
var longterm_ndvi_drop = -0.15;

// Removing tiny noice patches (50 pixels at 10m = ca. 0.5 ha)
var min_connected_pixels = 50;

// 4. Sentinel-2 cloud masking (Reference: Wright et al. 2024)
function cloudS2Mask(image) {
  var scl = image.select("SCL");
  var mask = scl.neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));
    
  var optical = image.select(["B2", "B3", "B4", "B8", "B11", "B12"])
    .divide(10000);
    
  return image
    .addBands(optical, null, true)
    .updateMask(mask)
    .copyProperties(image, ["system:time_start"]);
}

// 5. Indices
function addIndices(image) {
  // NDVI (For Mangroves)
  var ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI");
  
  // MNDWI (For open Water (Green - SWIR1))
  var mndwi = image.normalizedDifference(["B3", "B11"]).rename("MNDWI");
  
  return image.addBands([ndvi, mndwi]);
}

// 6. Load Sentinel-2 L2A 

var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(aoi)
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80))
  .map(cloudS2Mask)
  .map(addIndices);
  
// Image Composite 
function makeComposite(start, end, label) {
  var col = s2.filterDate(start, end);

  print(label + " image count:", col.size());
  return col.median().clip(aoi);
}

var pre = makeComposite(pre_start, pre_end, "Pre-Irma");
var post = makeComposite(post_start, post_end, "Post-Irma");
var recent = makeComposite(recent_start, recent_end, "Recent");

// 7. NDVI layers

var ndviPre = pre.select("NDVI").rename("NDVI_pre");
var ndviPost = post.select("NDVI").rename("NDVI_post");
var ndviRecent = recent.select("NDVI").rename("NDVI_recent");

// Difference NDVI
var dNdviPost = ndviPost.subtract(ndviPre).rename("dNDVI_post_minus_pre");
var dNdviRecent = ndviRecent.subtract(ndviPre).rename("dNDVI_recent_minus_pre");

// 8. GReen-Mask

var greenMask = ndviPre.gt(ndvi_threshold);

// Exclude open water using pre-Irma MNDWI
var notOpenWater = pre.select("MNDWI").lt(0.2);

// LAndCover Classification - Dynamic World (10m): pre-Irma Classificatio
// Label 1 = trees, label 3 = flooded vegetation (Mangroves can fall into either class)

var dwPre = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .filterBounds(aoi)
  .filterDate(pre_start, pre_end)
  .select("label")
  .mode()
  .clip(aoi);
var dwMangroveLike = dwPre.eq(1).or(dwPre.eq(3));

// Final analysis mask (Find out real Mangroves)
var analysisMask = greenMask
  .and(notOpenWater)
  .and(dwMangroveLike)
  .rename("pre_irma_green_mangrove_candidate");

// 9. Direct damage and long-term loss

// Direct loss after Hurricane
var directDamage = analysisMask
  .and(dNdviPost.lt(hurricane_ndvi_drop))
  .rename("direct_damage_after_irma");

// Long-term persistent loss (damaged after Irma AND still below pre-Irma NDVI in recent years)
var longTermLoss = directDamage
  .and(dNdviRecent.lt(longterm_ndvi_drop))
  .rename("long_term_persistent_loss");

// Areas that were damaged but recovered (Recent NDVI under Treshold)
var recovered = directDamage
  .and(dNdviRecent.gt(-0.05))
  .rename("recovered_after_damage");

// 10. Remove small noisy patches

var connected = longTermLoss
  .selfMask()
  .connectedPixelCount(100, true);

var longTermLossClean = longTermLoss
  .updateMask(connected.gte(min_connected_pixels))
  .rename("long_term_loss_clean");

// 11. Visualization

var rgbVis = {
  bands: ["B4", "B3", "B2"],
  min: 0.02,
  max: 0.35,
  gamma: 1.2
};

var ndviVis = {
  min: 0,
  max: 0.9,
  palette: ["white", "yellow", "green"]
};

var diffVis = {
  min: -0.5,
  max: 0.3,
  palette: ["red", "orange", "white", "lightblue", "blue"]
};

Map.addLayer(pre, rgbVis, "RGB pre-Irma 2017", false);
Map.addLayer(post, rgbVis, "RGB post-Irma 2017", false);
Map.addLayer(recent, rgbVis, "RGB recent", false);

Map.addLayer(ndviPre, ndviVis, "NDVI pre-Irma", false);
Map.addLayer(ndviPost, ndviVis, "NDVI post-Irma", false);
Map.addLayer(ndviRecent, ndviVis, "NDVI recent", false);

Map.addLayer(dNdviPost, diffVis, "ΔNDVI direct post - pre", true);
Map.addLayer(dNdviRecent, diffVis, "ΔNDVI recent - pre", false);

Map.addLayer(analysisMask.selfMask(), {palette: ["00ff00"]}, "Pre-Irma green mangrove mask", false);
Map.addLayer(directDamage.selfMask(), {palette: ["ff9900"]}, "Direct damage after Irma mask", true);
Map.addLayer(longTermLoss.selfMask(), {palette: ["ff0000"]}, "Long-term persistent loss mask", false);
Map.addLayer(longTermLossClean.selfMask(), {palette: ["ff00ff"]}, "Long-term persistent loss patches mask", true);
Map.addLayer(recovered.selfMask(), {palette: ["00ffff"]}, "Damaged but recovered", false);

// 12. Area statistics

function areaKm2(mask, name) {
  var area = ee.Image.pixelArea()
    .divide(1000000)
    .rename("area_km2")
    .updateMask(mask);

  var stats = area.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
  });
  print(name, stats);
}
areaKm2(analysisMask, "Pre-Irma Mangrove Mask area [km²]");
areaKm2(directDamage, "Direct damage after Irma [km²]");
areaKm2(longTermLossClean, "Long-term persistent loss patches [km²]");
areaKm2(recovered, "Damaged but recovered [km²]");

// 13. Vectorize long-term loss hotspots

var lossVectors = longTermLossClean
  .selfMask()
  .reduceToVectors({
    geometry: aoi,
    scale: 20,
    geometryType: "polygon",
    eightConnected: true,
    labelProperty: "loss",
    reducer: ee.Reducer.countEvery(),
    maxPixels: 1e13
  });

Map.addLayer(
  lossVectors.style({
    color: "yellow",
    fillColor: "00000000",
    width: 2
  }),
  {},
  "Vectorized long-term loss hotspots",
  true
);

print("Long-term loss hotspot polygons:", lossVectors);

// 14. Export results

Export.table.toDrive({
  collection: lossVectors,
  description: 'Irma_Long_Term_Mangrove_Loss_Hotspots_GeoJSON',
  folder: 'RSEM_2026_MangroveLoss',
  fileNamePrefix: 'irma_long_term_mangrove_loss_hotspots',
  fileFormat: 'GeoJSON'
});

/* References
X. Liang, Z. Dai, X. Mei, R. Wang, W. Zeng, and S. Fagherazzi, “Hurricanes Induced 
Irreversible Large-Scale Loss of Mangrove Forests,” Geophysical Research Letters,
vol. 52, no. 9, p. e2025GL115692, 2025, _eprint:
https://agupubs.onlinelibrary.wiley.com/doi/pdf/10.1029/2025GL115692. [Online]. 
Available: https://onlinelibrary.wiley.com/doi/abs/10.1029/2025GL

US Department of Commerce, N. (o. J.). Hurricane Irma Local Report/Summary.
NOAA’s National Weather Service. Abgerufen 21. Juni 2026, 
von https://www.weather.gov/mfl/hurricaneirma

Wright, N., Duncan, J. M. A., Callow, J. N., Thompson, S. E., & George, R. J. (2024). CloudS2Mask:
A novel deep learning approach for improved cloud and cloud shadow masking in Sentinel-2
15 imagery. Remote Sensing https://doi.org/10.1016/j.rse.2024.114122

*/
