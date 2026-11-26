import { buildSchoolCampusMap } from './mapsPart1';
import { buildMangoFarmMap } from './mangoFarmMap';
import { buildOldMarketMap } from './oldMarketMap';
import { buildRailwayColonyMap } from './railwayColonyMap';
import { buildHauntedHaveliMap } from './hauntedHaveliMap';
import { buildRiverVillageMap } from './riverVillageMap';
import { buildFestivalVillageMap } from './mapsPart2';
import {
  buildCoastalLighthouseMap,
  buildDesertFortMap,
  buildHillStationMap,
  buildTeaEstateMap,
} from './pixarMapsPart1';
import {
  buildGrandMelaMap,
  buildPalaceGardensMap,
  buildSnowHamletMap,
} from './pixarMapsPart2';
import { VillageTextureSet } from './textures';
import { buildIndianVillage, VillageBuildResult } from './village';

/**
 * Builds the 3D environment, colliders, hiding spots, patrol points,
 * minimap layout, and optional Pixar animation rig for any of the 15 playable levels.
 */
export function buildLevelMap(
  levelId: number,
  textures: VillageTextureSet,
): VillageBuildResult {
  switch (levelId) {
    case 2:
      return buildSchoolCampusMap(textures);
    case 3:
      return buildMangoFarmMap(textures);
    case 4:
      return buildOldMarketMap(textures);
    case 5:
      return buildRailwayColonyMap(textures);
    case 6:
      return buildHauntedHaveliMap(textures);
    case 7:
      return buildRiverVillageMap(textures);
    case 8:
      return buildFestivalVillageMap(textures);
    case 9:
      return buildHillStationMap(textures);
    case 10:
      return buildDesertFortMap(textures);
    case 11:
      return buildTeaEstateMap(textures);
    case 12:
      return buildCoastalLighthouseMap(textures);
    case 13:
      return buildPalaceGardensMap(textures);
    case 14:
      return buildGrandMelaMap(textures);
    case 15:
      return buildSnowHamletMap(textures);
    case 1:
    default:
      return buildIndianVillage(textures);
  }
}
