import { Departments } from 'src/common/locations/locations.types';
import { DepartmentCode } from 'src/utils/types/departments.types';

/**
 * Maps each French department code to its correct locative phrase.
 * Accounts for grammatical gender, number, and preposition contractions.
 */
const DEPARTMENT_LOCATIVES: Record<DepartmentCode, string> = {
  // dans l' — vowel sound (including H muet: Hérault)
  [DepartmentCode.Ain]: "dans l'Ain",
  [DepartmentCode.Aisne]: "dans l'Aisne",
  [DepartmentCode.Allier]: "dans l'Allier",
  [DepartmentCode.Ardeche]: "dans l'Ardèche",
  [DepartmentCode.Ariege]: "dans l'Ariège",
  [DepartmentCode.Aube]: "dans l'Aube",
  [DepartmentCode.Aude]: "dans l'Aude",
  [DepartmentCode.Aveyron]: "dans l'Aveyron",
  [DepartmentCode.Essonne]: "dans l'Essonne",
  [DepartmentCode.Eure]: "dans l'Eure",
  [DepartmentCode.EureEtLoir]: "dans l'Eure-et-Loir",
  [DepartmentCode.Herault]: "dans l'Hérault",
  [DepartmentCode.IlleEtVilaine]: "dans l'Ille-et-Vilaine",
  [DepartmentCode.Indre]: "dans l'Indre",
  [DepartmentCode.IndreEtLoire]: "dans l'Indre-et-Loire",
  [DepartmentCode.Isere]: "dans l'Isère",
  [DepartmentCode.Oise]: "dans l'Oise",
  [DepartmentCode.Orne]: "dans l'Orne",
  [DepartmentCode.Yonne]: "dans l'Yonne",

  // dans les — plural
  [DepartmentCode.AlpesDeHauteProvence]: 'dans les Alpes-de-Haute-Provence',
  [DepartmentCode.HautesAlpes]: 'dans les Hautes-Alpes',
  [DepartmentCode.AlpesMaritimes]: 'dans les Alpes-Maritimes',
  [DepartmentCode.Ardennes]: 'dans les Ardennes',
  [DepartmentCode.BouchesDuRhone]: 'dans les Bouches-du-Rhône',
  [DepartmentCode.CotesDArmor]: "dans les Côtes-d'Armor",
  [DepartmentCode.DeuxSevres]: 'dans les Deux-Sèvres',
  [DepartmentCode.HautesPyrenees]: 'dans les Hautes-Pyrénées',
  [DepartmentCode.HautsDeSeine]: 'dans les Hauts-de-Seine',
  [DepartmentCode.Landes]: 'dans les Landes',
  [DepartmentCode.PyreneesAtlantiques]: 'dans les Pyrénées-Atlantiques',
  [DepartmentCode.PyreneesOrientales]: 'dans les Pyrénées-Orientales',
  [DepartmentCode.Vosges]: 'dans les Vosges',
  [DepartmentCode.Yvelines]: 'dans les Yvelines',

  // dans la — feminine singular
  [DepartmentCode.Charente]: 'dans la Charente',
  [DepartmentCode.CharenteMaritime]: 'dans la Charente-Maritime',
  [DepartmentCode.Correze]: 'dans la Corrèze',
  [DepartmentCode.CoteDOr]: "dans la Côte-d'Or",
  [DepartmentCode.Creuse]: 'dans la Creuse',
  [DepartmentCode.Dordogne]: 'dans la Dordogne',
  [DepartmentCode.Drome]: 'dans la Drôme',
  [DepartmentCode.Gironde]: 'dans la Gironde',
  [DepartmentCode.HauteCorse]: 'dans la Haute-Corse',
  [DepartmentCode.HauteGaronne]: 'dans la Haute-Garonne',
  [DepartmentCode.HauteLoire]: 'dans la Haute-Loire',
  [DepartmentCode.HauteMarne]: 'dans la Haute-Marne',
  [DepartmentCode.HauteSaone]: 'dans la Haute-Saône',
  [DepartmentCode.HauteSavoie]: 'dans la Haute-Savoie',
  [DepartmentCode.HauteVienne]: 'dans la Haute-Vienne',
  [DepartmentCode.Loire]: 'dans la Loire',
  [DepartmentCode.LoireAtlantique]: 'dans la Loire-Atlantique',
  [DepartmentCode.Lozere]: 'dans la Lozère',
  [DepartmentCode.Manche]: 'dans la Manche',
  [DepartmentCode.Marne]: 'dans la Marne',
  [DepartmentCode.Mayenne]: 'dans la Mayenne',
  [DepartmentCode.Meuse]: 'dans la Meuse',
  [DepartmentCode.Moselle]: 'dans la Moselle',
  [DepartmentCode.Nievre]: 'dans la Nièvre',
  [DepartmentCode.SaoneEtLoire]: 'dans la Saône-et-Loire',
  [DepartmentCode.Sarthe]: 'dans la Sarthe',
  [DepartmentCode.Savoie]: 'dans la Savoie',
  [DepartmentCode.SeineEtMarne]: 'dans la Seine-et-Marne',
  [DepartmentCode.SeineMaritime]: 'dans la Seine-Maritime',
  [DepartmentCode.SeineSaintDenis]: 'dans la Seine-Saint-Denis',
  [DepartmentCode.Somme]: 'dans la Somme',
  [DepartmentCode.Vendee]: 'dans la Vendée',
  [DepartmentCode.Vienne]: 'dans la Vienne',
  [DepartmentCode.CorseDuSud]: 'dans la Corse-du-Sud',

  // dans le — masculine singular
  [DepartmentCode.BasRhin]: 'dans le Bas-Rhin',
  [DepartmentCode.Calvados]: 'dans le Calvados',
  [DepartmentCode.Cantal]: 'dans le Cantal',
  [DepartmentCode.Cher]: 'dans le Cher',
  [DepartmentCode.Doubs]: 'dans le Doubs',
  [DepartmentCode.Finistere]: 'dans le Finistère',
  [DepartmentCode.Gard]: 'dans le Gard',
  [DepartmentCode.Gers]: 'dans le Gers',
  [DepartmentCode.HautRhin]: 'dans le Haut-Rhin',
  [DepartmentCode.Jura]: 'dans le Jura',
  [DepartmentCode.LoirEtCher]: 'dans le Loir-et-Cher',
  [DepartmentCode.Loiret]: 'dans le Loiret',
  [DepartmentCode.Lot]: 'dans le Lot',
  [DepartmentCode.LotEtGaronne]: 'dans le Lot-et-Garonne',
  [DepartmentCode.MaineEtLoire]: 'dans le Maine-et-Loire',
  [DepartmentCode.MeurtheEtMoselle]: 'dans le Meurthe-et-Moselle',
  [DepartmentCode.Morbihan]: 'dans le Morbihan',
  [DepartmentCode.Nord]: 'dans le Nord',
  [DepartmentCode.PasDeCalais]: 'dans le Pas-de-Calais',
  [DepartmentCode.PuyDeDome]: 'dans le Puy-de-Dôme',
  [DepartmentCode.Rhone]: 'dans le Rhône',
  [DepartmentCode.TarnEtGaronne]: 'dans le Tarn-et-Garonne',
  [DepartmentCode.Tarn]: 'dans le Tarn',
  [DepartmentCode.TerritoireDeBelfort]: 'dans le Territoire de Belfort',
  [DepartmentCode.ValDeMarne]: 'dans le Val-de-Marne',
  [DepartmentCode.ValDOise]: "dans le Val-d'Oise",
  [DepartmentCode.Var]: 'dans le Var',
  [DepartmentCode.Vaucluse]: 'dans le Vaucluse',

  // à / en — îles et cas particuliers
  [DepartmentCode.Paris]: 'à Paris',
  [DepartmentCode.Guadeloupe]: 'en Guadeloupe',
  [DepartmentCode.Martinique]: 'en Martinique',
  [DepartmentCode.Guyane]: 'en Guyane',
  [DepartmentCode.LaReunion]: 'à La Réunion',
  [DepartmentCode.Mayotte]: 'à Mayotte',
};

/**
 * Returns the grammatically correct locative phrase for a department.
 * Accepts the raw `profile.department` value (e.g. "Pas-de-Calais (62)").
 * Falls back to "dans sa région" if the department is unknown.
 */
export function getDepartmentLocative(rawDepartment: string | null): string {
  if (!rawDepartment) return 'dans sa région';

  const entry = Departments.find((d) => d.name === rawDepartment);
  if (!entry) return 'dans sa région';

  return DEPARTMENT_LOCATIVES[entry.code] ?? 'dans sa région';
}
