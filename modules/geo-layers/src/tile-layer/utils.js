import {lngLatToWorld} from '@math.gl/web-mercator';

const TILE_SIZE = 512;

/**
 * gets the bounding box of a viewport
 */
function getBoundingBox(viewport) {
  const corners = [
    viewport.unproject([0, 0]),
    viewport.unproject([viewport.width, 0]),
    viewport.unproject([0, viewport.height]),
    viewport.unproject([viewport.width, viewport.height])
  ];
  return [
    Math.min(corners[0][0], corners[1][0], corners[2][0], corners[3][0]),
    Math.min(corners[0][1], corners[1][1], corners[2][1], corners[3][1]),
    Math.max(corners[0][0], corners[1][0], corners[2][0], corners[3][0]),
    Math.max(corners[0][1], corners[1][1], corners[2][1], corners[3][1])
  ];
}

/*
 * get the OSM tile index at the given location
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
function getOSMTileIndex(lngLat, scale) {
  let [x, y] = lngLatToWorld(lngLat);
  x *= scale / TILE_SIZE;
  y = (1 - y / TILE_SIZE) * scale;
  return [x, y];
}

function getTileIndex([x, y], scale) {
  return [(x * scale) / TILE_SIZE, (y * scale) / TILE_SIZE];
}

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon..2Flat._to_tile_numbers_2
function osmTile2lngLat(x, y, z) {
  const scale = Math.pow(2, z);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
}

function tile2XY(x, y, z) {
  const scale = Math.pow(2, z);
  return [(x / scale) * TILE_SIZE, (y / scale) * TILE_SIZE];
}

export function tileToBoundingBox(viewport, x, y, z) {
  if (viewport.isGeospatial) {
    const [west, north] = osmTile2lngLat(x, y, z);
    const [east, south] = osmTile2lngLat(x + 1, y + 1, z);
    return {west, north, east, south};
  }
  const [left, top] = tile2XY(x, y, z);
  const [right, bottom] = tile2XY(x + 1, y + 1, z);
  return {left, top, right, bottom};
}

function getIdentityTileIndices(viewport, z) {
  const bbox = getBoundingBox(viewport);
  const scale = 2 ** z;

  const [minX, minY] = getTileIndex([bbox[0], bbox[1]], scale);
  const [maxX, maxY] = getTileIndex([bbox[2], bbox[3]], scale);
  const indices = [];

  /*
      |  TILE  |  TILE  |  TILE  |
        |(minX)            |(maxX)
   */
  for (let x = Math.floor(minX); x < maxX; x++) {
    for (let y = Math.floor(minY); y < maxY; y++) {
      indices.push({x, y, z});
    }
  }

  return indices;
}

function getOSMTileIndices(viewport, z) {
  const bbox = getBoundingBox(viewport);
  const scale = 2 ** z;
  /*
    minX, maxX could be out of bounds if longitude is near the 180 meridian or multiple worlds
    are shown:
                |       |
    actual   -2 -1  0  1  2  3
    expected  2  3  0  1  2  3
   */
  let [minX, minY] = getOSMTileIndex([bbox[0], bbox[3]], scale);
  let [maxX, maxY] = getOSMTileIndex([bbox[2], bbox[1]], scale);
  const indices = [];

  /*
      |  TILE  |  TILE  |  TILE  |
        |(minX)            |(maxX)
   */
  minX = Math.floor(minX);
  maxX = Math.min(minX + scale, maxX); // Avoid creating duplicates
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(scale, maxY);
  for (let x = minX; x < maxX; x++) {
    for (let y = minY; y < maxY; y++) {
      // Cast to valid x between [0, scale]
      const normalizedX = x - Math.floor(x / scale) * scale;
      indices.push({x: normalizedX, y, z});
    }
  }

  return indices;
}

/**
 * Returns all tile indices in the current viewport. If the current zoom level is smaller
 * than minZoom, return an empty array. If the current zoom level is greater than maxZoom,
 * return tiles that are on maxZoom.
 */
export function getTileIndices(viewport, maxZoom, minZoom) {
  let z = Math.ceil(viewport.zoom);
  if (Number.isFinite(minZoom) && z < minZoom) {
    return [];
  }
  if (Number.isFinite(maxZoom) && z > maxZoom) {
    z = maxZoom;
  }

  return viewport.isGeospatial
    ? getOSMTileIndices(viewport, z)
    : getIdentityTileIndices(viewport, z);
}
