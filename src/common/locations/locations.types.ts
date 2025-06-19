import * as _ from 'lodash';
import { AdminZones, FilterConstant } from 'src/utils/types';

export const Departments = [
  {
    name: 'Ain (01)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Aisne (02)',
    zone: AdminZones.LILLE,
    region: 'Hauts-de-France',
  },
  {
    name: 'Allier (03)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Alpes-de-Haute-Provence (04)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Hautes-Alpes (05)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Alpes-Maritimes (06)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Ardèche (07)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Ardennes (08)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Ariège (09)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Aube (10)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Aude (11)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Aveyron (12)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Bouches-du-Rhône (13)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Calvados (14)',
    zone: AdminZones.HZ,
    region: 'Normandie',
  },
  {
    name: 'Cantal (15)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Charente (16)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Charente-Maritime (17)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Cher (18)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Corrèze (19)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: "Côte-d'Or (21)",
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: "Côtes-d'Armor (22)",
    zone: AdminZones.RENNES,
    region: 'Bretagne',
  },
  {
    name: 'Creuse (23)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Dordogne (24)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Doubs (25)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Drôme (26)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Eure (27)',
    zone: AdminZones.HZ,
    region: 'Normandie',
  },
  {
    name: 'Eure-et-Loir (28)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Finistère (29)',
    zone: AdminZones.RENNES,
    region: 'Bretagne',
  },
  {
    name: 'Corse-du-Sud (2A)',
    zone: AdminZones.HZ,
    region: 'Corse',
  },
  {
    name: 'Haute-Corse (2B)',
    zone: AdminZones.HZ,
    region: 'Corse',
  },
  {
    name: 'Gard (30)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Haute-Garonne (31)',
    zone: AdminZones.SUDOUEST,
    region: 'Occitanie',
  },
  {
    name: 'Gers (32)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Gironde (33)',
    zone: AdminZones.SUDOUEST,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Hérault (34)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Ille-et-Vilaine (35)',
    zone: AdminZones.RENNES,
    region: 'Bretagne',
  },
  {
    name: 'Indre (36)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Indre-et-Loire (37)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Isère (38)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Jura (39)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Landes (40)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Loir-et-Cher (41)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Loire (42)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Haute-Loire (43)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Loire-Atlantique (44)',
    zone: AdminZones.HZ,
    region: 'Pays de la Loire',
  },
  {
    name: 'Loiret (45)',
    zone: AdminZones.HZ,
    region: 'Centre-Val de Loire',
  },
  {
    name: 'Lot (46)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Lot-et-Garonne (47)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Lozère (48)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Maine-et-Loire (49)',
    zone: AdminZones.HZ,
    region: 'Pays de la Loire',
  },
  {
    name: 'Manche (50)',
    zone: AdminZones.HZ,
    region: 'Normandie',
  },
  {
    name: 'Marne (51)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Haute-Marne (52)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Mayenne (53)',
    zone: AdminZones.HZ,
    region: 'Pays de la Loire',
  },
  {
    name: 'Meurthe-et-Moselle (54)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Meuse (55)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Morbihan (56)',
    zone: AdminZones.LORIENT,
    // TODO put back to Bretagne
    region: 'Lorient',
  },
  {
    name: 'Moselle (57)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Nièvre (58)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Nord (59)',
    zone: AdminZones.LILLE,
    region: 'Hauts-de-France',
  },
  {
    name: 'Oise (60)',
    zone: AdminZones.LILLE,
    region: 'Hauts-de-France',
  },
  {
    name: 'Orne (61)',
    zone: AdminZones.HZ,
    region: 'Normandie',
  },
  {
    name: 'Pas-de-Calais (62)',
    zone: AdminZones.LILLE,
    region: 'Hauts-de-France',
  },
  {
    name: 'Puy-de-Dôme (63)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Pyrénées-Atlantiques (64)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Hautes-Pyrénées (65)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Pyrénées-Orientales (66)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Bas-Rhin (67)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Haut-Rhin (68)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Rhône (69)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Haute-Saône (70)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Saône-et-Loire (71)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Sarthe (72)',
    zone: AdminZones.HZ,
    region: 'Pays de la Loire',
  },
  {
    name: 'Savoie (73)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Haute-Savoie (74)',
    zone: AdminZones.LYON,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    name: 'Paris (75)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Seine-Maritime (76)',
    zone: AdminZones.HZ,
    region: 'Normandie',
  },
  {
    name: 'Seine-et-Marne (77)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Yvelines (78)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Deux-Sèvres (79)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Somme (80)',
    zone: AdminZones.LILLE,
    region: 'Hauts-de-France',
  },
  {
    name: 'Tarn (81)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Tarn-et-Garonne (82)',
    zone: AdminZones.HZ,
    region: 'Occitanie',
  },
  {
    name: 'Var (83)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Vaucluse (84)',
    zone: AdminZones.HZ,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    name: 'Vendée (85)',
    zone: AdminZones.HZ,
    region: 'Pays de la Loire',
  },
  {
    name: 'Vienne (86)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Haute-Vienne (87)',
    zone: AdminZones.HZ,
    region: 'Nouvelle-Aquitaine',
  },
  {
    name: 'Vosges (88)',
    zone: AdminZones.HZ,
    region: 'Grand Est',
  },
  {
    name: 'Yonne (89)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Territoire de Belfort (90)',
    zone: AdminZones.HZ,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    name: 'Essonne (91)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Hauts-de-Seine (92)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Seine-Saint-Denis (93)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Val-de-Marne (94)',
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: "Val-d'Oise (95)",
    zone: AdminZones.PARIS,
    region: 'Île-de-France',
  },
  {
    name: 'Guadeloupe (971)',
    zone: AdminZones.HZ,
    region: 'Guadeloupe',
  },
  {
    name: 'Martinique (972)',
    zone: AdminZones.HZ,
    region: 'Martinique',
  },
  {
    name: 'Guyane (973)',
    zone: AdminZones.HZ,
    region: 'Guyane',
  },
  {
    name: 'La Réunion (974)',
    zone: AdminZones.HZ,
    region: 'La Réunion',
  },
  {
    name: 'Mayotte (976)',
    zone: AdminZones.HZ,
    region: 'Mayotte',
  },
] as const;

export type Department = (typeof Departments)[number]['name'];
export type Region = (typeof Departments)[number]['region'];

const RegionLabels: Partial<Record<Region, string>> = {
  'Île-de-France': 'Paris et sa région',
  'Auvergne-Rhône-Alpes': 'Lyon et sa région',
  'Hauts-de-France': 'Lille et sa région',
  Bretagne: 'Rennes et sa région',
  Lorient: 'Lorient',
};

/*
interface Region extends FilterConstant<typeof Departments[number]['region']> {
  value: typeof Departments[number]['region'];
  label: RegionLabel | typeof Departments[number]['region'];
  zone: AdminZone;
  children: typeof Departments[number][];
}
*/

export const RegionFilters: FilterConstant<Region, Department>[] = _.sortBy(
  Object.values(
    Departments.reduce((acc, curr) => {
      if (acc[curr.region]) {
        return {
          ...acc,
          [curr.region]: {
            ...acc[curr.region],
            children: [...acc[curr.region].children, curr.name],
          },
        };
      }
      return {
        ...acc,
        [curr.region]: {
          value: curr.region,
          label: RegionLabels[curr.region as Region] || curr.region,
          zone: curr.zone,
          children: [curr.name],
        },
      };
    }, {} as Record<Region, FilterConstant<Region>>)
  ),
  'label'
);

export const DepartmentFilters: FilterConstant<Department>[] = [
  ...Departments.map(({ name, zone }) => {
    return {
      value: name,
      label: name,
      zone,
    };
  }),
];
