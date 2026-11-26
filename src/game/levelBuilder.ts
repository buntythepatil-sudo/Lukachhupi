import { buildSchoolCampusMap } from './mapsPart1';
import { buildMangoFarmMap } from './mangoFarmMap';
import { buildOldMarketMap } from './oldMarketMap';
import { buildRailwayColonyMap } from './railwayColonyMap';
import { buildHauntedHaveliMap } from './hauntedHaveliMap';
import { buildRiverVillageMap } from './riverVillageMap';
import { buildFestivalVillageMap } from './mapsPart2';
import { VillageTextureSet } from './textures';
import { buildIndianVillage, VillageBuildResult } from './village';

/**
 * Builds the 3D environment, colliders, hiding spots, patrol points, and
 * minimap layout for any of the 8 playable levels.
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
    case 1:
    default:
      return buildIndianVillage(textures);
  }
}
