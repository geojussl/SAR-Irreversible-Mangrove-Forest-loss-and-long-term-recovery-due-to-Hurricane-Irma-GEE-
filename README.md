# Irreversible Mangrove Forest Loss after Hurricane Irma in Florida (2017)

## Overview

This repository contains the code and data used for a remote sensing case study on **persistent mangrove forest loss after Hurricane Irma in Southwest Florida**. The analysis focuses on mangrove-dominated areas around the **Everglades National Park**, where Hurricane Irma caused substantial wind, storm surge and inundation impacts in September 2017.
The main objective is to identify areas where mangrove-like vegetation showed a strong vegetation decline directly after Hurricane Irma and did not recover to pre-event conditions in the following years, Using Sentinel-1 and Sentinel-2 Data.

## Data
The analysis uses satellite data accessed through Copernicus Data Space Ecosystem.
### Main datasets
- **Sentinel-2 L2A**
- **Sentinel-1 GRD** (Derived in ESA SNAP)
- **Dynamic World**
  - Used to support masking of tree-covered and flooded vegetation classes

## Time Periods
This analysis compares three main periods:
-Pre-Irma: The manggrove conditions before hurricane Irma (21.10.2016-09.09.2017)
-Post-Irma: Direct damages of the mangroves after the Hurricane (29.09.2017)
-long-term: long-term recovery of the mangroves, damaged through irma (2018-2025)

## Methodology
The workflow was implemented in **Google Earth Engine** through the following workflow:
### 1. Sentinel-2 preprocessing
Sentinel-2 Level-2A images were filtered by:
- study area (handdrawn rectangle around a Part of the Everglades national Park)
- date range
- cloud cover
- Scene Classification Layer masks
Clouds, cloud shadows, cirrus and invalid pixels were removed before creating median composites for each time period.

### 2. NDVI calculation
Vegetation condition was assessed using the Normalized Difference Vegetation Index:
```text
NDVI = (NIR - Red) / (NIR + Red)
````
where:
* NIR = Sentinel-2 B08
* Red = Sentinel-2 B04

### 3. Green vegetation mask
A pre-hurricane green vegetation mask was created using:
```text
NDVI_pre > 0.50
```
Additional masks were used to reduce the influence of open water and non-mangrove land cover.

### 4. Direct hurricane damage
Direct vegetation loss after Hurricane Irma was estimated using:
```text
ΔNDVI_post = NDVI_post - NDVI_pre
```
Pixels were classified as directly damaged when:
```text
ΔNDVI_post < -0.20
```

### 5. Long-term persistent loss

Long-term recovery was assessed by comparing recent NDVI conditions with the pre-Irma baseline:
```text
ΔNDVI_recent = NDVI_recent - NDVI_pre
```
Persistent loss was defined as areas that:
1. were green before Hurricane Irma,
2. showed strong NDVI loss after the hurricane,
3. remained below pre-Irma NDVI levels in the recent period.

The long-term loss threshold was:
```text
ΔNDVI_recent < -0.15
```
Small isolated pixels were removed using a connected-pixel filter. The final persistent-loss layer was exported as GeoJSON polygons.

## Output
vectorized GeoJSON polygons of persistent loss hotspots

## Author
Justin Lingg-Laham
