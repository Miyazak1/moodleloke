import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { pickLocalized, type LocalizedMap } from '../../i18n/locale-utils';
import type { Locale } from '../../i18n/locales';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

function subjectPath(subject: string) {
  return routes.cscaSubjects + '/' + subject;
}

function subjectFormulaPath(subject: string) {
  return routes.cscaSubjects + '/' + subject + '/formulas';
}

function chemText<T>(locale: Locale, en: T, zhCN: T, vi?: T): T {
  if (locale === 'vi') return vi ?? en;
  return pickLocalized({ en, 'zh-CN': zhCN }, locale);
}

function chemValue<T>(locale: Locale, value: LocalizedMap<T>): T {
  return pickLocalized(value, locale);
}

const CHEM_ION_POSITIONS = [
  [5, 34], [12, 40], [18, 58], [25, 48], [32, 28], [38, 72], [45, 22], [52, 40], [58, 30], [66, 52],
  [74, 26], [84, 44], [92, 28], [8, 74], [20, 84], [34, 90], [44, 82], [56, 76], [68, 84], [80, 90],
  [94, 82], [14, 26], [28, 62], [40, 46], [50, 58], [62, 24], [72, 68], [88, 62], [22, 70], [36, 34],
  [48, 88], [60, 44], [70, 36], [82, 76], [30, 18], [54, 66], [78, 18], [90, 70]
] as const;

const REACTION_RATE_PARTICLES = Array.from({ length: 64 }, (_, index) => ({
  id: index,
  x: 5 + ((index * 37) % 90),
  y: 8 + ((index * 53) % 82),
  delay: -((index * 0.17) % 2.8)
}));

const REACTION_RATE_CHART = {
  width: 620,
  height: 300,
  left: 48,
  right: 590,
  top: 24,
  bottom: 252,
  duration: 8
};

type RedoxCellOption = {
  id: string;
  label: string;
  anode: {
    metal: string;
    ion: string;
    potential: number;
    color: string;
    solution: string;
  };
  cathode: {
    metal: string;
    ion: string;
    potential: number;
    color: string;
    solution: string;
  };
  anodeHalf: string;
  cathodeHalf: string;
  cellNotation: string;
  totalReaction: string;
  oxidationChange: string;
  reductionChange: string;
};

const REDOX_CELL_OPTIONS: RedoxCellOption[] = [
  {
    id: 'zn-cu',
    label: 'Zn / Cu',
    anode: { metal: 'Zn', ion: 'Zn²⁺', potential: -0.76, color: '#94a3b8', solution: 'ZnSO₄' },
    cathode: { metal: 'Cu', ion: 'Cu²⁺', potential: 0.34, color: '#d97706', solution: 'CuSO₄' },
    anodeHalf: 'Zn → Zn²⁺ + 2e⁻',
    cathodeHalf: 'Cu²⁺ + 2e⁻ → Cu',
    cellNotation: 'Zn(s) | Zn²⁺(aq) || Cu²⁺(aq) | Cu(s)',
    totalReaction: 'Zn + Cu²⁺ → Zn²⁺ + Cu',
    oxidationChange: 'Zn: 0 → +2',
    reductionChange: 'Cu: +2 → 0'
  },
  {
    id: 'fe-cu',
    label: 'Fe / Cu',
    anode: { metal: 'Fe', ion: 'Fe²⁺', potential: -0.44, color: '#6b7280', solution: 'FeSO₄' },
    cathode: { metal: 'Cu', ion: 'Cu²⁺', potential: 0.34, color: '#d97706', solution: 'CuSO₄' },
    anodeHalf: 'Fe → Fe²⁺ + 2e⁻',
    cathodeHalf: 'Cu²⁺ + 2e⁻ → Cu',
    cellNotation: 'Fe(s) | Fe²⁺(aq) || Cu²⁺(aq) | Cu(s)',
    totalReaction: 'Fe + Cu²⁺ → Fe²⁺ + Cu',
    oxidationChange: 'Fe: 0 → +2',
    reductionChange: 'Cu: +2 → 0'
  },
  {
    id: 'zn-ag',
    label: 'Zn / Ag',
    anode: { metal: 'Zn', ion: 'Zn²⁺', potential: -0.76, color: '#94a3b8', solution: 'ZnSO₄' },
    cathode: { metal: 'Ag', ion: 'Ag⁺', potential: 0.80, color: '#cbd5e1', solution: 'AgNO₃' },
    anodeHalf: 'Zn → Zn²⁺ + 2e⁻',
    cathodeHalf: '2Ag⁺ + 2e⁻ → 2Ag',
    cellNotation: 'Zn(s) | Zn²⁺(aq) || Ag⁺(aq) | Ag(s)',
    totalReaction: 'Zn + 2Ag⁺ → Zn²⁺ + 2Ag',
    oxidationChange: 'Zn: 0 → +2',
    reductionChange: 'Ag: +1 → 0'
  },
  {
    id: 'mg-cu',
    label: 'Mg / Cu',
    anode: { metal: 'Mg', ion: 'Mg²⁺', potential: -2.37, color: '#a8a29e', solution: 'MgSO₄' },
    cathode: { metal: 'Cu', ion: 'Cu²⁺', potential: 0.34, color: '#d97706', solution: 'CuSO₄' },
    anodeHalf: 'Mg → Mg²⁺ + 2e⁻',
    cathodeHalf: 'Cu²⁺ + 2e⁻ → Cu',
    cellNotation: 'Mg(s) | Mg²⁺(aq) || Cu²⁺(aq) | Cu(s)',
    totalReaction: 'Mg + Cu²⁺ → Mg²⁺ + Cu',
    oxidationChange: 'Mg: 0 → +2',
    reductionChange: 'Cu: +2 → 0'
  }
];

type TitrationAcidId = 'hcl' | 'acetic';

type TitrationAcidOption = {
  id: TitrationAcidId;
  label: string;
  formula: string;
  strength: 'strong' | 'weak';
  ka?: number;
  note: string;
};

const TITRATION_ACIDS: TitrationAcidOption[] = [
  { id: 'hcl', label: '盐酸', formula: 'HCl', strength: 'strong', note: '强酸完全电离，强酸强碱等量点 pH = 7。' },
  { id: 'acetic', label: '醋酸', formula: 'CH₃COOH', strength: 'weak', ka: 1.8e-5, note: '弱酸部分电离，半等量点 pH = pKa，等量点 pH > 7。' }
];

type ChemIonType = 'H+' | 'OH-' | 'Na+' | 'Cl-';

const CHEM_DEFAULT_ACID_MOLES = 0.5;
const CHEM_MIN_ACID_MOLES = 0.1;
const CHEM_MAX_ACID_MOLES = 0.5;
const CHEM_ELECTROLYTE_CONCENTRATION = 1;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function reactionRateState(initialConcentration: number, temperature: number, activationEnergy: number, catalyst: boolean, time: number) {
  const effectiveEa = catalyst ? Math.max(activationEnergy - 20, 5) : activationEnergy;
  const k = 0.34 * Math.exp((temperature - 300) / 55) * Math.exp((50 - effectiveEa) / 35);
  const concentrationA = initialConcentration * Math.exp(-k * time);
  const concentrationB = Math.max(initialConcentration - concentrationA, 0);
  const rate = k * concentrationA;
  const initialRate = k * initialConcentration;
  const halfLife = Math.log(2) / Math.max(k, 0.0001);
  return { effectiveEa, k, concentrationA, concentrationB, rate, initialRate, halfLife };
}

function reactionRateCurvePath(initialConcentration: number, k: number, product: boolean, chart = REACTION_RATE_CHART) {
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;
  return Array.from({ length: 90 }, (_, index) => {
    const t = (index / 89) * chart.duration;
    const a = initialConcentration * Math.exp(-k * t);
    const value = product ? initialConcentration - a : a;
    const x = chart.left + (t / chart.duration) * plotWidth;
    const y = chart.bottom - (value / 1.6) * plotHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${clampNumber(y, chart.top, chart.bottom).toFixed(2)}`;
  }).join(' ');
}

function getTitrationState(acid: TitrationAcidOption, acidConcentration: number, acidVolumeMl: number, baseConcentration: number, baseVolumeMl: number) {
  const acidMoles = acidConcentration * acidVolumeMl / 1000;
  const baseMoles = baseConcentration * baseVolumeMl / 1000;
  const totalVolumeLiters = Math.max((acidVolumeMl + baseVolumeMl) / 1000, 0.0001);
  const equivalenceVolumeMl = acidMoles / Math.max(baseConcentration, 0.0001) * 1000;
  const diff = acidMoles - baseMoles;
  const nearEquivalence = Math.abs(diff) < Math.max(acidMoles * 0.002, 1e-7);
  let ph = 7;
  let stage = '初始酸溶液';
  let detail = '调节加入的 NaOH 体积，观察 pH 变化。';

  if (acid.strength === 'strong') {
    if (nearEquivalence) {
      ph = 7;
      stage = '等量点';
      detail = '强酸强碱完全中和，等量点近似 pH = 7。';
    } else if (diff > 0) {
      const h = diff / totalVolumeLiters;
      ph = -Math.log10(Math.max(h, 1e-14));
      stage = baseMoles === 0 ? '强酸初始区' : '酸过量';
      detail = 'H⁺ 仍有剩余，溶液保持酸性。';
    } else {
      const oh = -diff / totalVolumeLiters;
      ph = 14 + Math.log10(Math.max(oh, 1e-14));
      stage = '碱过量';
      detail = 'NaOH 过量，pH 由剩余 OH⁻ 决定。';
    }
  } else {
    const ka = acid.ka ?? 1.8e-5;
    const pka = -Math.log10(ka);
    if (baseMoles <= 0) {
      const formalConcentration = acidMoles / totalVolumeLiters;
      const h = Math.sqrt(ka * Math.max(formalConcentration, 1e-12));
      ph = -Math.log10(Math.max(h, 1e-14));
      stage = '弱酸初始区';
      detail = '弱酸只部分电离，初始 pH 高于同浓度强酸。';
    } else if (baseMoles < acidMoles && !nearEquivalence) {
      const acidLeft = acidMoles - baseMoles;
      const conjugateBase = baseMoles;
      ph = pka + Math.log10(Math.max(conjugateBase, 1e-12) / Math.max(acidLeft, 1e-12));
      const halfVolume = equivalenceVolumeMl / 2;
      const nearHalf = Math.abs(baseVolumeMl - halfVolume) < Math.max(equivalenceVolumeMl * 0.025, 0.5);
      stage = nearHalf ? '半等量点' : '缓冲区';
      detail = nearHalf ? '弱酸滴定半等量点满足 pH = pKa。' : '弱酸和共轭碱同时存在，可用 Henderson-Hasselbalch 近似。';
    } else if (nearEquivalence) {
      const acetateConcentration = acidMoles / totalVolumeLiters;
      const kb = 1e-14 / ka;
      const oh = Math.sqrt(kb * Math.max(acetateConcentration, 1e-12));
      ph = 14 + Math.log10(Math.max(oh, 1e-14));
      stage = '等量点';
      detail = '弱酸强碱等量点生成弱酸盐，阴离子水解使 pH > 7。';
    } else {
      const oh = (baseMoles - acidMoles) / totalVolumeLiters;
      ph = 14 + Math.log10(Math.max(oh, 1e-14));
      stage = '碱过量';
      detail = '等量点之后，pH 主要由过量 OH⁻ 决定。';
    }
  }

  const safePh = clampNumber(ph, 0, 14);
  const hConcentration = Math.pow(10, -safePh);
  const ohConcentration = 1e-14 / Math.max(hConcentration, 1e-14);
  return {
    ph: safePh,
    poh: 14 - safePh,
    hConcentration,
    ohConcentration,
    equivalenceVolumeMl,
    stage,
    detail,
    acidMoles,
    baseMoles
  };
}

function titrationPhCurvePath(acid: TitrationAcidOption, acidConcentration: number, acidVolumeMl: number, baseConcentration: number) {
  const chart = { width: 620, height: 300, left: 48, right: 590, top: 24, bottom: 252, maxVolume: 100 };
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;
  const path = Array.from({ length: 120 }, (_, index) => {
    const volume = (index / 119) * chart.maxVolume;
    const state = getTitrationState(acid, acidConcentration, acidVolumeMl, baseConcentration, volume);
    const x = chart.left + (volume / chart.maxVolume) * plotWidth;
    const y = chart.bottom - (state.ph / 14) * plotHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${clampNumber(y, chart.top, chart.bottom).toFixed(2)}`;
  }).join(' ');
  return {
    ...chart,
    path,
    xForVolume: (volume: number) => chart.left + (volume / chart.maxVolume) * plotWidth,
    yForPh: (ph: number) => chart.bottom - (ph / 14) * plotHeight
  };
}

type AtomicTrend = 'radius' | 'electronegativity' | 'ionization';

type AtomicElement = {
  z: number;
  symbol: string;
  name: string;
  period: number;
  group: number;
  mass: number;
  radius: number;
  electronegativity: number | null;
  ionization: number;
  shells: number[];
};

const ATOMIC_TRENDS: Record<AtomicTrend, { label: string; unit: string; min: number; max: number; note: string }> = {
  radius: { label: '原子半径', unit: 'pm', min: 31, max: 243, note: '同周期从左到右半径总体减小；同族从上到下半径增大。' },
  electronegativity: { label: '电负性', unit: '', min: 0.82, max: 3.98, note: '电负性总体向右上方增强，稀有气体通常不参与比较。' },
  ionization: { label: '第一电离能', unit: 'kJ/mol', min: 419, max: 2372, note: '第一电离能总体向右上方增大，但受半满、全满亚层稳定性影响会有小波动。' }
};

const ATOMIC_ELEMENTS: AtomicElement[] = [
  { z: 1, symbol: 'H', name: '氢', period: 1, group: 1, mass: 1.008, radius: 53, electronegativity: 2.20, ionization: 1312, shells: [1] },
  { z: 2, symbol: 'He', name: '氦', period: 1, group: 18, mass: 4.003, radius: 31, electronegativity: null, ionization: 2372, shells: [2] },
  { z: 3, symbol: 'Li', name: '锂', period: 2, group: 1, mass: 6.94, radius: 167, electronegativity: 0.98, ionization: 520, shells: [2, 1] },
  { z: 4, symbol: 'Be', name: '铍', period: 2, group: 2, mass: 9.012, radius: 112, electronegativity: 1.57, ionization: 900, shells: [2, 2] },
  { z: 5, symbol: 'B', name: '硼', period: 2, group: 13, mass: 10.81, radius: 87, electronegativity: 2.04, ionization: 801, shells: [2, 3] },
  { z: 6, symbol: 'C', name: '碳', period: 2, group: 14, mass: 12.011, radius: 67, electronegativity: 2.55, ionization: 1086, shells: [2, 4] },
  { z: 7, symbol: 'N', name: '氮', period: 2, group: 15, mass: 14.007, radius: 56, electronegativity: 3.04, ionization: 1402, shells: [2, 5] },
  { z: 8, symbol: 'O', name: '氧', period: 2, group: 16, mass: 15.999, radius: 48, electronegativity: 3.44, ionization: 1314, shells: [2, 6] },
  { z: 9, symbol: 'F', name: '氟', period: 2, group: 17, mass: 18.998, radius: 42, electronegativity: 3.98, ionization: 1681, shells: [2, 7] },
  { z: 10, symbol: 'Ne', name: '氖', period: 2, group: 18, mass: 20.180, radius: 38, electronegativity: null, ionization: 2081, shells: [2, 8] },
  { z: 11, symbol: 'Na', name: '钠', period: 3, group: 1, mass: 22.990, radius: 190, electronegativity: 0.93, ionization: 496, shells: [2, 8, 1] },
  { z: 12, symbol: 'Mg', name: '镁', period: 3, group: 2, mass: 24.305, radius: 145, electronegativity: 1.31, ionization: 738, shells: [2, 8, 2] },
  { z: 13, symbol: 'Al', name: '铝', period: 3, group: 13, mass: 26.982, radius: 118, electronegativity: 1.61, ionization: 578, shells: [2, 8, 3] },
  { z: 14, symbol: 'Si', name: '硅', period: 3, group: 14, mass: 28.085, radius: 111, electronegativity: 1.90, ionization: 787, shells: [2, 8, 4] },
  { z: 15, symbol: 'P', name: '磷', period: 3, group: 15, mass: 30.974, radius: 98, electronegativity: 2.19, ionization: 1012, shells: [2, 8, 5] },
  { z: 16, symbol: 'S', name: '硫', period: 3, group: 16, mass: 32.06, radius: 88, electronegativity: 2.58, ionization: 1000, shells: [2, 8, 6] },
  { z: 17, symbol: 'Cl', name: '氯', period: 3, group: 17, mass: 35.45, radius: 79, electronegativity: 3.16, ionization: 1251, shells: [2, 8, 7] },
  { z: 18, symbol: 'Ar', name: '氩', period: 3, group: 18, mass: 39.948, radius: 71, electronegativity: null, ionization: 1521, shells: [2, 8, 8] },
  { z: 19, symbol: 'K', name: '钾', period: 4, group: 1, mass: 39.098, radius: 243, electronegativity: 0.82, ionization: 419, shells: [2, 8, 8, 1] },
  { z: 20, symbol: 'Ca', name: '钙', period: 4, group: 2, mass: 40.078, radius: 194, electronegativity: 1.00, ionization: 590, shells: [2, 8, 8, 2] },
  { z: 21, symbol: 'Sc', name: '钪', period: 4, group: 3, mass: 44.956, radius: 184, electronegativity: 1.36, ionization: 633, shells: [2, 8, 9, 2] },
  { z: 22, symbol: 'Ti', name: '钛', period: 4, group: 4, mass: 47.867, radius: 176, electronegativity: 1.54, ionization: 659, shells: [2, 8, 10, 2] },
  { z: 23, symbol: 'V', name: '钒', period: 4, group: 5, mass: 50.942, radius: 171, electronegativity: 1.63, ionization: 651, shells: [2, 8, 11, 2] },
  { z: 24, symbol: 'Cr', name: '铬', period: 4, group: 6, mass: 51.996, radius: 166, electronegativity: 1.66, ionization: 653, shells: [2, 8, 13, 1] },
  { z: 25, symbol: 'Mn', name: '锰', period: 4, group: 7, mass: 54.938, radius: 161, electronegativity: 1.55, ionization: 717, shells: [2, 8, 13, 2] },
  { z: 26, symbol: 'Fe', name: '铁', period: 4, group: 8, mass: 55.845, radius: 156, electronegativity: 1.83, ionization: 763, shells: [2, 8, 14, 2] },
  { z: 27, symbol: 'Co', name: '钴', period: 4, group: 9, mass: 58.933, radius: 152, electronegativity: 1.88, ionization: 760, shells: [2, 8, 15, 2] },
  { z: 28, symbol: 'Ni', name: '镍', period: 4, group: 10, mass: 58.693, radius: 149, electronegativity: 1.91, ionization: 737, shells: [2, 8, 16, 2] },
  { z: 29, symbol: 'Cu', name: '铜', period: 4, group: 11, mass: 63.546, radius: 145, electronegativity: 1.90, ionization: 746, shells: [2, 8, 18, 1] },
  { z: 30, symbol: 'Zn', name: '锌', period: 4, group: 12, mass: 65.38, radius: 142, electronegativity: 1.65, ionization: 906, shells: [2, 8, 18, 2] },
  { z: 31, symbol: 'Ga', name: '镓', period: 4, group: 13, mass: 69.723, radius: 136, electronegativity: 1.81, ionization: 579, shells: [2, 8, 18, 3] },
  { z: 32, symbol: 'Ge', name: '锗', period: 4, group: 14, mass: 72.630, radius: 125, electronegativity: 2.01, ionization: 762, shells: [2, 8, 18, 4] },
  { z: 33, symbol: 'As', name: '砷', period: 4, group: 15, mass: 74.922, radius: 114, electronegativity: 2.18, ionization: 947, shells: [2, 8, 18, 5] },
  { z: 34, symbol: 'Se', name: '硒', period: 4, group: 16, mass: 78.971, radius: 103, electronegativity: 2.55, ionization: 941, shells: [2, 8, 18, 6] },
  { z: 35, symbol: 'Br', name: '溴', period: 4, group: 17, mass: 79.904, radius: 94, electronegativity: 2.96, ionization: 1140, shells: [2, 8, 18, 7] },
  { z: 36, symbol: 'Kr', name: '氪', period: 4, group: 18, mass: 83.798, radius: 88, electronegativity: 3.00, ionization: 1351, shells: [2, 8, 18, 8] }
];

const ATOMIC_ELEMENT_NAMES: LocalizedMap<Record<string, string>> = {
  'zh-CN': Object.fromEntries(ATOMIC_ELEMENTS.map((element) => [element.symbol, element.name])),
  en: {
    H: 'Hydrogen', He: 'Helium', Li: 'Lithium', Be: 'Beryllium', B: 'Boron', C: 'Carbon', N: 'Nitrogen', O: 'Oxygen', F: 'Fluorine', Ne: 'Neon',
    Na: 'Sodium', Mg: 'Magnesium', Al: 'Aluminum', Si: 'Silicon', P: 'Phosphorus', S: 'Sulfur', Cl: 'Chlorine', Ar: 'Argon',
    K: 'Potassium', Ca: 'Calcium', Sc: 'Scandium', Ti: 'Titanium', V: 'Vanadium', Cr: 'Chromium', Mn: 'Manganese', Fe: 'Iron', Co: 'Cobalt', Ni: 'Nickel', Cu: 'Copper', Zn: 'Zinc',
    Ga: 'Gallium', Ge: 'Germanium', As: 'Arsenic', Se: 'Selenium', Br: 'Bromine', Kr: 'Krypton'
  }
};
(ATOMIC_ELEMENT_NAMES as any).vi = {
  ...ATOMIC_ELEMENT_NAMES.en!,
  H: 'Hydro', He: 'Heli', Li: 'Liti', Be: 'Beri', B: 'Bo', C: 'Cacbon', N: 'Nito', O: 'Oxy', F: 'Flo', Ne: 'Neon',
  Na: 'Natri', Mg: 'Magie', Al: 'Nhom', Si: 'Silic', P: 'Photpho', S: 'Luu huynh', Cl: 'Clo', Ar: 'Argon',
  K: 'Kali', Ca: 'Canxi', Fe: 'Sat', Cu: 'Dong', Zn: 'Kem', Br: 'Brom'
};


const ATOMIC_TREND_META: LocalizedMap<Record<AtomicTrend, { label: string; note: string }>> = {
  'zh-CN': {
    radius: { label: ATOMIC_TRENDS.radius.label, note: ATOMIC_TRENDS.radius.note },
    electronegativity: { label: ATOMIC_TRENDS.electronegativity.label, note: ATOMIC_TRENDS.electronegativity.note },
    ionization: { label: ATOMIC_TRENDS.ionization.label, note: ATOMIC_TRENDS.ionization.note }
  },
  en: {
    radius: { label: 'Atomic Radius', note: 'Across a period, radius generally decreases from left to right; down a group, radius increases.' },
    electronegativity: { label: 'Electronegativity', note: 'Electronegativity generally increases toward the upper right; noble gases are usually excluded in basic comparisons.' },
    ionization: { label: 'First Ionization Energy', note: 'First ionization energy generally increases toward the upper right, with small exceptions from half-filled and filled subshell stability.' }
  }
};
(ATOMIC_TREND_META as any).vi = {
  radius: { label: 'Ban kinh nguyen tu', note: 'Trong mot chu ky, ban kinh thuong giam tu trai sang phai; di xuong mot nhom thi tang.' },
  electronegativity: { label: 'Do am dien', note: 'Do am dien thuong tang ve phia tren ben phai; khi hiem thuong khong xet trong so sanh co ban.' },
  ionization: { label: 'Nang luong ion hoa thu nhat', note: 'Nang luong ion hoa thu nhat thuong tang ve phia tren ben phai, voi vai ngoai le do do ben phan lop ban day hoac day.' }
};


const ORBITAL_ORDER = [
  { label: '1s', capacity: 2 },
  { label: '2s', capacity: 2 },
  { label: '2p', capacity: 6 },
  { label: '3s', capacity: 2 },
  { label: '3p', capacity: 6 },
  { label: '4s', capacity: 2 },
  { label: '3d', capacity: 10 },
  { label: '4p', capacity: 6 }
];

function getElectronConfiguration(z: number) {
  if (z === 24) return '1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ 3d⁵';
  if (z === 29) return '1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ 3d¹⁰';
  let remaining = z;
  return ORBITAL_ORDER.map((orbital) => {
    const count = Math.min(remaining, orbital.capacity);
    remaining -= count;
    if (count <= 0) return '';
    return `${orbital.label}${toSuperscript(count)}`;
  }).filter(Boolean).join(' ');
}

function getOrbitalFill(z: number) {
  const overrides = z === 24
    ? { '4s': 1, '3d': 5 }
    : z === 29
      ? { '4s': 1, '3d': 10 }
      : null;
  if (overrides) {
    let remaining = z - Object.values(overrides).reduce((sum, value) => sum + value, 0);
    return ORBITAL_ORDER.map((orbital) => {
      const fixed = overrides[orbital.label as keyof typeof overrides];
      if (fixed !== undefined) return { ...orbital, electrons: fixed };
      const count = Math.min(remaining, orbital.capacity);
      remaining -= count;
      return { ...orbital, electrons: Math.max(count, 0) };
    });
  }
  let remaining = z;
  return ORBITAL_ORDER.map((orbital) => {
    const count = Math.min(remaining, orbital.capacity);
    remaining -= count;
    return { ...orbital, electrons: Math.max(count, 0) };
  });
}

function toSuperscript(value: number) {
  const digits: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(value).split('').map((digit) => digits[digit] ?? digit).join('');
}

function trendValue(element: AtomicElement, trend: AtomicTrend) {
  if (trend === 'radius') return element.radius;
  if (trend === 'electronegativity') return element.electronegativity;
  return element.ionization;
}

function trendColor(element: AtomicElement, trend: AtomicTrend) {
  const value = trendValue(element, trend);
  if (value === null) return 'rgba(148, 163, 184, .22)';
  const scale = ATOMIC_TRENDS[trend];
  const ratio = clampNumber((value - scale.min) / (scale.max - scale.min), 0, 1);
  const lightness = 88 - ratio * 34;
  const saturation = 58 + ratio * 20;
  return `hsl(${trend === 'radius' ? 28 : trend === 'electronegativity' ? 178 : 214} ${saturation}% ${lightness}%)`;
}

function trendInsight(element: AtomicElement, trend: AtomicTrend) {
  const samePeriod = ATOMIC_ELEMENTS.filter((item) => item.period === element.period);
  const left = samePeriod.find((item) => item.group === element.group - 1);
  const right = samePeriod.find((item) => item.group === element.group + 1);
  if (trend === 'radius') {
    return `${element.symbol} 位于第 ${element.period} 周期。有效核电荷增强时，同周期半径通常向右减小；${left ? `${left.symbol} 一般比它更大，` : ''}${right ? `${right.symbol} 一般比它更小。` : '到右端元素半径更小。'}`;
  }
  if (trend === 'electronegativity') {
    return element.electronegativity === null
      ? `${element.symbol} 是稀有气体，电负性在基础比较中通常不列入。`
      : `${element.symbol} 的电负性为 ${element.electronegativity.toFixed(2)}，同周期总体向右增强，同族向上增强。`;
  }
  return `${element.symbol} 的第一电离能约 ${element.ionization} kJ/mol。电子越难移走，电离能越高；全满或半满亚层会额外稳定。`;
}

function elementName(element: AtomicElement, locale: Locale) {
  return chemValue(locale, ATOMIC_ELEMENT_NAMES)[element.symbol] ?? element.name;
}

function trendLabel(trend: AtomicTrend, locale: Locale) {
  return chemValue(locale, ATOMIC_TREND_META)[trend].label;
}

function trendNote(trend: AtomicTrend, locale: Locale) {
  return chemValue(locale, ATOMIC_TREND_META)[trend].note;
}

function atomicTrendInsight(element: AtomicElement, trend: AtomicTrend, locale: Locale) {
  const samePeriod = ATOMIC_ELEMENTS.filter((item) => item.period === element.period);
  const left = samePeriod.find((item) => item.group === element.group - 1);
  const right = samePeriod.find((item) => item.group === element.group + 1);
  const englishInsight = () => {
    if (trend === 'radius') {
      return `${element.symbol} is in period ${element.period}. As effective nuclear charge increases, atomic radius usually decreases across a period; ${left ? `${left.symbol} is generally larger, ` : ''}${right ? `${right.symbol} is generally smaller.` : 'elements farther right are generally smaller.'}`;
    }
    if (trend === 'electronegativity') {
      return element.electronegativity === null
        ? `${element.symbol} is a noble gas, so electronegativity is usually omitted in basic comparisons.`
        : `${element.symbol} has electronegativity ${element.electronegativity.toFixed(2)}; it generally increases across a period and upward in a group.`;
    }
    return `${element.symbol} has first ionization energy about ${element.ionization} kJ/mol. The harder an electron is to remove, the higher the ionization energy; filled or half-filled subshells add stability.`;
  };
  if (trend === 'radius') {
    return chemText(locale, englishInsight(), trendInsight(element, trend));
  }
  if (trend === 'electronegativity') {
    return chemText(locale, englishInsight(), trendInsight(element, trend));
  }
  return chemText(locale, englishInsight(), trendInsight(element, trend));
}

type BondingKind = 'nonpolar-covalent' | 'polar-covalent' | 'ionic';
type BondOrder = 1 | 2 | 3;

type BondingMolecule = {
  id: string;
  formula: string;
  name: string;
  atoms: Array<{ id: string; label: string; x: number; y: number; en: number; charge?: string; tone: string }>;
  bonds: Array<{ from: string; to: string; order: BondOrder }>;
  lonePairs: Array<{ x: number; y: number; label?: string }>;
  dipoles: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  central: string;
  shape: string;
  electronGeometry: string;
  bondPairs: number;
  lonePairCount: number;
  kind: BondingKind;
  polarity: '非极性' | '极性' | '离子晶体';
  summary: string;
};

const BONDING_KIND_META: Record<BondingKind, { label: string; range: string; tone: string }> = {
  'nonpolar-covalent': { label: '非极性共价键', range: 'ΔEN < 0.4', tone: 'green' },
  'polar-covalent': { label: '极性共价键', range: '0.4 ≤ ΔEN ≤ 1.7', tone: 'blue' },
  ionic: { label: '离子键', range: 'ΔEN > 1.7', tone: 'orange' }
};

const BONDING_KIND_LABELS: LocalizedMap<Record<BondingKind, string>> = {
  'zh-CN': {
    'nonpolar-covalent': BONDING_KIND_META['nonpolar-covalent'].label,
    'polar-covalent': BONDING_KIND_META['polar-covalent'].label,
    ionic: BONDING_KIND_META.ionic.label
  },
  en: {
    'nonpolar-covalent': 'Nonpolar Covalent Bond',
    'polar-covalent': 'Polar Covalent Bond',
    ionic: 'Ionic Bond'
  }
};
(BONDING_KIND_LABELS as any).vi = {
  'nonpolar-covalent': 'Lien ket cong hoa tri khong phan cuc',
  'polar-covalent': 'Lien ket cong hoa tri phan cuc',
  ionic: 'Lien ket ion'
};


const BONDING_MOLECULE_COPY: LocalizedMap<Record<string, { name: string; shape: string; electronGeometry: string; polarity: string; summary: string }>> = {
  'zh-CN': {},
  en: {
    h2: { name: 'Hydrogen', shape: 'Linear', electronGeometry: 'Diatomic molecule', polarity: 'Nonpolar', summary: 'The two H atoms have the same electronegativity, so the shared electron pair is evenly distributed and the molecule is nonpolar.' },
    hcl: { name: 'Hydrogen chloride', shape: 'Linear', electronGeometry: 'Diatomic molecule', polarity: 'Polar', summary: 'Cl is more electronegative, so the shared electron pair shifts toward Cl, forming a polar covalent bond and a polar molecule.' },
    h2o: { name: 'Water', shape: 'Bent', electronGeometry: 'Tetrahedral electron domains', polarity: 'Polar', summary: 'O-H bonds are polar, and the bent shape prevents the bond dipoles from canceling.' },
    co2: { name: 'Carbon dioxide', shape: 'Linear', electronGeometry: 'Linear', polarity: 'Nonpolar', summary: 'C=O bonds are polar, but linear CO2 is symmetric, so the two bond dipoles cancel.' },
    nh3: { name: 'Ammonia', shape: 'Trigonal pyramidal', electronGeometry: 'Tetrahedral electron domains', polarity: 'Polar', summary: 'N has one lone pair, giving a trigonal pyramidal shape and a nonzero net dipole.' },
    ch4: { name: 'Methane', shape: 'Tetrahedral', electronGeometry: 'Tetrahedral', polarity: 'Nonpolar', summary: 'The C-H electronegativity difference is small, and the symmetric structure makes CH4 effectively nonpolar.' },
    nacl: { name: 'Sodium chloride', shape: 'Ionic lattice fragment', electronGeometry: 'Electron transfer', polarity: 'Ionic crystal', summary: 'Na and Cl have a large electronegativity difference; Na loses an electron and Cl gains one, producing electrostatic attraction between Na+ and Cl-.' },
    mgo: { name: 'Magnesium oxide', shape: 'Ionic lattice fragment', electronGeometry: 'Electron transfer', polarity: 'Ionic crystal', summary: 'Mg typically loses two electrons and O gains two electrons, forming a strong ionic bond.' }
  }
};
(BONDING_MOLECULE_COPY as any).vi = {
  ...BONDING_MOLECULE_COPY.en!,
  h2: { name: 'Hydro', shape: 'Thang', electronGeometry: 'Phan tu hai nguyen tu', polarity: 'Khong phan cuc', summary: 'Hai nguyen tu H co cung do am dien, nen cap electron dung chung phan bo deu va phan tu khong phan cuc.' },
  hcl: { name: 'Hydro clorua', shape: 'Thang', electronGeometry: 'Phan tu hai nguyen tu', polarity: 'Phan cuc', summary: 'Cl co do am dien lon hon, nen cap electron dung chung lech ve phia Cl, tao lien ket cong hoa tri phan cuc va phan tu phan cuc.' },
  h2o: { name: 'Nuoc', shape: 'Gap khuc', electronGeometry: 'Mien electron tu dien', polarity: 'Phan cuc', summary: 'Lien ket O-H phan cuc, va dang gap khuc lam cac luong cuc lien ket khong triet tieu.' },
  co2: { name: 'Cacbon dioxit', shape: 'Thang', electronGeometry: 'Thang', polarity: 'Khong phan cuc', summary: 'Lien ket C=O phan cuc, nhung CO2 thang va doi xung nen hai luong cuc lien ket triet tieu.' },
  nh3: { name: 'Amoniac', shape: 'Chop tam giac', electronGeometry: 'Mien electron tu dien', polarity: 'Phan cuc', summary: 'N co mot cap electron tu do, tao dang chop tam giac va momen luong cuc tong khac 0.' },
  ch4: { name: 'Metan', shape: 'Tu dien', electronGeometry: 'Tu dien', polarity: 'Khong phan cuc', summary: 'Do chenh am dien C-H nho, va cau truc doi xung lam CH4 gan nhu khong phan cuc.' },
  nacl: { name: 'Natri clorua', shape: 'Manh mang ion', electronGeometry: 'Chuyen electron', polarity: 'Tinh the ion', summary: 'Na va Cl co chenh lech do am dien lon; Na mat electron, Cl nhan electron, tao luc hut tinh dien giua Na+ va Cl-.' },
  mgo: { name: 'Magie oxit', shape: 'Manh mang ion', electronGeometry: 'Chuyen electron', polarity: 'Tinh the ion', summary: 'Mg thuong mat hai electron va O nhan hai electron, tao lien ket ion manh.' }
};


function bondingKindLabel(kind: BondingKind, locale: Locale) {
  return chemValue(locale, BONDING_KIND_LABELS)[kind];
}

function moleculeName(molecule: BondingMolecule, locale: Locale) {
  return chemValue(locale, BONDING_MOLECULE_COPY)[molecule.id]?.name ?? molecule.name;
}

function moleculeShape(molecule: BondingMolecule, locale: Locale) {
  return chemValue(locale, BONDING_MOLECULE_COPY)[molecule.id]?.shape ?? molecule.shape;
}

function moleculeElectronGeometry(molecule: BondingMolecule, locale: Locale) {
  return chemValue(locale, BONDING_MOLECULE_COPY)[molecule.id]?.electronGeometry ?? molecule.electronGeometry;
}

function moleculePolarity(molecule: BondingMolecule, locale: Locale) {
  return chemValue(locale, BONDING_MOLECULE_COPY)[molecule.id]?.polarity ?? molecule.polarity;
}

function moleculeSummary(molecule: BondingMolecule, locale: Locale) {
  return chemValue(locale, BONDING_MOLECULE_COPY)[molecule.id]?.summary ?? molecule.summary;
}

const BONDING_MOLECULES: BondingMolecule[] = [
  {
    id: 'h2',
    formula: 'H₂',
    name: '氢气',
    atoms: [
      { id: 'h1', label: 'H', x: 210, y: 180, en: 2.20, tone: 'light' },
      { id: 'h2', label: 'H', x: 330, y: 180, en: 2.20, tone: 'light' }
    ],
    bonds: [{ from: 'h1', to: 'h2', order: 1 }],
    lonePairs: [],
    dipoles: [],
    central: '无中心原子',
    shape: '线形',
    electronGeometry: '双原子分子',
    bondPairs: 1,
    lonePairCount: 0,
    kind: 'nonpolar-covalent',
    polarity: '非极性',
    summary: '两个 H 原子电负性相同，共用电子对平均分布，分子非极性。'
  },
  {
    id: 'hcl',
    formula: 'HCl',
    name: '氯化氢',
    atoms: [
      { id: 'h', label: 'H', x: 205, y: 180, en: 2.20, charge: 'δ+', tone: 'light' },
      { id: 'cl', label: 'Cl', x: 340, y: 180, en: 3.16, charge: 'δ-', tone: 'green' }
    ],
    bonds: [{ from: 'h', to: 'cl', order: 1 }],
    lonePairs: [{ x: 355, y: 120 }, { x: 388, y: 168 }, { x: 355, y: 238 }],
    dipoles: [{ x1: 236, y1: 152, x2: 310, y2: 152 }],
    central: '无中心原子',
    shape: '线形',
    electronGeometry: '双原子分子',
    bondPairs: 1,
    lonePairCount: 3,
    kind: 'polar-covalent',
    polarity: '极性',
    summary: 'Cl 电负性更强，共用电子对偏向 Cl，形成极性共价键和极性分子。'
  },
  {
    id: 'h2o',
    formula: 'H₂O',
    name: '水',
    atoms: [
      { id: 'o', label: 'O', x: 270, y: 160, en: 3.44, charge: 'δ-', tone: 'red' },
      { id: 'h1', label: 'H', x: 190, y: 235, en: 2.20, charge: 'δ+', tone: 'light' },
      { id: 'h2', label: 'H', x: 350, y: 235, en: 2.20, charge: 'δ+', tone: 'light' }
    ],
    bonds: [{ from: 'o', to: 'h1', order: 1 }, { from: 'o', to: 'h2', order: 1 }],
    lonePairs: [{ x: 235, y: 105 }, { x: 305, y: 105 }],
    dipoles: [{ x1: 214, y1: 216, x2: 250, y2: 181 }, { x1: 326, y1: 216, x2: 290, y2: 181 }],
    central: 'O',
    shape: '弯曲形',
    electronGeometry: '四面体电子域',
    bondPairs: 2,
    lonePairCount: 2,
    kind: 'polar-covalent',
    polarity: '极性',
    summary: 'O-H 键有极性，且分子为弯曲形，两个键偶极不能抵消。'
  },
  {
    id: 'co2',
    formula: 'CO₂',
    name: '二氧化碳',
    atoms: [
      { id: 'o1', label: 'O', x: 150, y: 180, en: 3.44, charge: 'δ-', tone: 'red' },
      { id: 'c', label: 'C', x: 270, y: 180, en: 2.55, charge: 'δ+', tone: 'dark' },
      { id: 'o2', label: 'O', x: 390, y: 180, en: 3.44, charge: 'δ-', tone: 'red' }
    ],
    bonds: [{ from: 'o1', to: 'c', order: 2 }, { from: 'c', to: 'o2', order: 2 }],
    lonePairs: [{ x: 110, y: 145 }, { x: 110, y: 215 }, { x: 430, y: 145 }, { x: 430, y: 215 }],
    dipoles: [{ x1: 242, y1: 146, x2: 174, y2: 146 }, { x1: 298, y1: 146, x2: 366, y2: 146 }],
    central: 'C',
    shape: '线形',
    electronGeometry: '线形',
    bondPairs: 2,
    lonePairCount: 0,
    kind: 'polar-covalent',
    polarity: '非极性',
    summary: 'C=O 键有极性，但 CO₂ 线形对称，两个键偶极方向相反而抵消。'
  },
  {
    id: 'nh3',
    formula: 'NH₃',
    name: '氨气',
    atoms: [
      { id: 'n', label: 'N', x: 270, y: 155, en: 3.04, charge: 'δ-', tone: 'blue' },
      { id: 'h1', label: 'H', x: 185, y: 230, en: 2.20, charge: 'δ+', tone: 'light' },
      { id: 'h2', label: 'H', x: 270, y: 260, en: 2.20, charge: 'δ+', tone: 'light' },
      { id: 'h3', label: 'H', x: 355, y: 230, en: 2.20, charge: 'δ+', tone: 'light' }
    ],
    bonds: [{ from: 'n', to: 'h1', order: 1 }, { from: 'n', to: 'h2', order: 1 }, { from: 'n', to: 'h3', order: 1 }],
    lonePairs: [{ x: 270, y: 95 }],
    dipoles: [{ x1: 205, y1: 214, x2: 248, y2: 177 }, { x1: 270, y1: 235, x2: 270, y2: 187 }, { x1: 335, y1: 214, x2: 292, y2: 177 }],
    central: 'N',
    shape: '三角锥形',
    electronGeometry: '四面体电子域',
    bondPairs: 3,
    lonePairCount: 1,
    kind: 'polar-covalent',
    polarity: '极性',
    summary: 'N 上有一对孤对电子，分子呈三角锥形，键偶极合成后不为零。'
  },
  {
    id: 'ch4',
    formula: 'CH₄',
    name: '甲烷',
    atoms: [
      { id: 'c', label: 'C', x: 270, y: 180, en: 2.55, tone: 'dark' },
      { id: 'h1', label: 'H', x: 270, y: 80, en: 2.20, tone: 'light' },
      { id: 'h2', label: 'H', x: 175, y: 190, en: 2.20, tone: 'light' },
      { id: 'h3', label: 'H', x: 365, y: 190, en: 2.20, tone: 'light' },
      { id: 'h4', label: 'H', x: 270, y: 280, en: 2.20, tone: 'light' }
    ],
    bonds: [{ from: 'c', to: 'h1', order: 1 }, { from: 'c', to: 'h2', order: 1 }, { from: 'c', to: 'h3', order: 1 }, { from: 'c', to: 'h4', order: 1 }],
    lonePairs: [],
    dipoles: [],
    central: 'C',
    shape: '正四面体',
    electronGeometry: '四面体',
    bondPairs: 4,
    lonePairCount: 0,
    kind: 'nonpolar-covalent',
    polarity: '非极性',
    summary: 'C-H 电负性差很小，且结构对称，CH₄ 可视为非极性分子。'
  },
  {
    id: 'nacl',
    formula: 'NaCl',
    name: '氯化钠',
    atoms: [
      { id: 'na', label: 'Na', x: 205, y: 180, en: 0.93, charge: '+', tone: 'orange' },
      { id: 'cl', label: 'Cl', x: 340, y: 180, en: 3.16, charge: '-', tone: 'green' }
    ],
    bonds: [{ from: 'na', to: 'cl', order: 1 }],
    lonePairs: [{ x: 355, y: 116 }, { x: 392, y: 180 }, { x: 355, y: 244 }],
    dipoles: [{ x1: 235, y1: 140, x2: 310, y2: 140 }],
    central: '离子对',
    shape: '离子晶体片段',
    electronGeometry: '电子转移',
    bondPairs: 0,
    lonePairCount: 4,
    kind: 'ionic',
    polarity: '离子晶体',
    summary: 'Na 与 Cl 电负性差很大，Na 易失电子、Cl 易得电子，形成 Na⁺ 和 Cl⁻ 的静电吸引。'
  },
  {
    id: 'mgo',
    formula: 'MgO',
    name: '氧化镁',
    atoms: [
      { id: 'mg', label: 'Mg', x: 205, y: 180, en: 1.31, charge: '2+', tone: 'orange' },
      { id: 'o', label: 'O', x: 340, y: 180, en: 3.44, charge: '2-', tone: 'red' }
    ],
    bonds: [{ from: 'mg', to: 'o', order: 1 }],
    lonePairs: [{ x: 340, y: 112 }, { x: 398, y: 180 }, { x: 340, y: 248 }, { x: 282, y: 180 }],
    dipoles: [{ x1: 235, y1: 140, x2: 310, y2: 140 }],
    central: '离子对',
    shape: '离子晶体片段',
    electronGeometry: '电子转移',
    bondPairs: 0,
    lonePairCount: 4,
    kind: 'ionic',
    polarity: '离子晶体',
    summary: 'Mg 通常失去 2 个电子，O 得到 2 个电子，形成强离子键。'
  }
];

function getBondingDelta(molecule: BondingMolecule) {
  const firstBond = molecule.bonds[0];
  const atomA = molecule.atoms.find((atom) => atom.id === firstBond.from) ?? molecule.atoms[0];
  const atomB = molecule.atoms.find((atom) => atom.id === firstBond.to) ?? molecule.atoms[1] ?? molecule.atoms[0];
  return {
    atomA,
    atomB,
    delta: Math.abs(atomA.en - atomB.en)
  };
}

function bondCategoryFromDelta(delta: number): BondingKind {
  if (delta < 0.4) return 'nonpolar-covalent';
  if (delta <= 1.7) return 'polar-covalent';
  return 'ionic';
}

function atomById(molecule: BondingMolecule, id: string) {
  return molecule.atoms.find((atom) => atom.id === id) ?? molecule.atoms[0];
}

type IonEquationMode = 'molecular' | 'complete' | 'net';
type IonParticleRole = 'reactive' | 'spectator' | 'product' | 'gas' | 'water';

type IonReaction = {
  id: string;
  label: string;
  molecular: string;
  complete: string;
  net: string;
  spectatorIons: string[];
  productLabel: string;
  productKind: '沉淀' | '气体' | '水';
  principle: string;
  reactants: [string, string];
  products: string[];
  particles: Array<{ id: string; label: string; x: number; y: number; role: IonParticleRole; charge?: string }>;
};

const ION_REACTIONS: IonReaction[] = [
  {
    id: 'agcl',
    label: 'AgCl 白色沉淀',
    molecular: 'NaCl + AgNO₃ → AgCl↓ + NaNO₃',
    complete: 'Na⁺ + Cl⁻ + Ag⁺ + NO₃⁻ → AgCl↓ + Na⁺ + NO₃⁻',
    net: 'Ag⁺ + Cl⁻ → AgCl↓',
    spectatorIons: ['Na⁺', 'NO₃⁻'],
    productLabel: 'AgCl↓',
    productKind: '沉淀',
    principle: 'AgCl 难溶，Ag⁺ 与 Cl⁻ 结合生成沉淀；Na⁺ 和 NO₃⁻ 反应前后不变。',
    reactants: ['NaCl', 'AgNO₃'],
    products: ['AgCl↓', 'NaNO₃'],
    particles: [
      { id: 'na', label: 'Na⁺', x: 18, y: 34, role: 'spectator', charge: '+' },
      { id: 'cl', label: 'Cl⁻', x: 36, y: 58, role: 'reactive', charge: '-' },
      { id: 'ag', label: 'Ag⁺', x: 68, y: 40, role: 'reactive', charge: '+' },
      { id: 'no3', label: 'NO₃⁻', x: 82, y: 66, role: 'spectator', charge: '-' }
    ]
  },
  {
    id: 'baso4',
    label: 'BaSO₄ 白色沉淀',
    molecular: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',
    complete: 'Ba²⁺ + 2Cl⁻ + 2Na⁺ + SO₄²⁻ → BaSO₄↓ + 2Na⁺ + 2Cl⁻',
    net: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
    spectatorIons: ['Na⁺', 'Cl⁻'],
    productLabel: 'BaSO₄↓',
    productKind: '沉淀',
    principle: 'BaSO₄ 难溶，Ba²⁺ 和 SO₄²⁻ 是真正反应粒子；Na⁺、Cl⁻ 是旁观离子。',
    reactants: ['BaCl₂', 'Na₂SO₄'],
    products: ['BaSO₄↓', 'NaCl'],
    particles: [
      { id: 'ba', label: 'Ba²⁺', x: 31, y: 42, role: 'reactive', charge: '2+' },
      { id: 'cl', label: 'Cl⁻', x: 19, y: 68, role: 'spectator', charge: '-' },
      { id: 'na', label: 'Na⁺', x: 76, y: 33, role: 'spectator', charge: '+' },
      { id: 'so4', label: 'SO₄²⁻', x: 63, y: 62, role: 'reactive', charge: '2-' }
    ]
  },
  {
    id: 'carbonate-acid',
    label: '碳酸盐遇酸放气',
    molecular: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',
    complete: '2Na⁺ + CO₃²⁻ + 2H⁺ + 2Cl⁻ → 2Na⁺ + 2Cl⁻ + H₂O + CO₂↑',
    net: 'CO₃²⁻ + 2H⁺ → H₂O + CO₂↑',
    spectatorIons: ['Na⁺', 'Cl⁻'],
    productLabel: 'CO₂↑ + H₂O',
    productKind: '气体',
    principle: '碳酸根与 H⁺ 反应生成 H₂CO₃，随后分解为 H₂O 和 CO₂ 气体。',
    reactants: ['Na₂CO₃', 'HCl'],
    products: ['NaCl', 'H₂O', 'CO₂↑'],
    particles: [
      { id: 'na', label: 'Na⁺', x: 20, y: 34, role: 'spectator', charge: '+' },
      { id: 'co3', label: 'CO₃²⁻', x: 35, y: 62, role: 'reactive', charge: '2-' },
      { id: 'h', label: 'H⁺', x: 68, y: 38, role: 'reactive', charge: '+' },
      { id: 'cl', label: 'Cl⁻', x: 82, y: 66, role: 'spectator', charge: '-' }
    ]
  },
  {
    id: 'neutralization',
    label: '强酸强碱中和',
    molecular: 'HCl + NaOH → NaCl + H₂O',
    complete: 'H⁺ + Cl⁻ + Na⁺ + OH⁻ → Na⁺ + Cl⁻ + H₂O',
    net: 'H⁺ + OH⁻ → H₂O',
    spectatorIons: ['Na⁺', 'Cl⁻'],
    productLabel: 'H₂O',
    productKind: '水',
    principle: '强酸强碱中和的本质是 H⁺ 与 OH⁻ 结合生成水。',
    reactants: ['HCl', 'NaOH'],
    products: ['NaCl', 'H₂O'],
    particles: [
      { id: 'h', label: 'H⁺', x: 34, y: 42, role: 'reactive', charge: '+' },
      { id: 'cl', label: 'Cl⁻', x: 18, y: 68, role: 'spectator', charge: '-' },
      { id: 'na', label: 'Na⁺', x: 78, y: 36, role: 'spectator', charge: '+' },
      { id: 'oh', label: 'OH⁻', x: 63, y: 64, role: 'reactive', charge: '-' }
    ]
  },
  {
    id: 'cuoh2',
    label: 'Cu(OH)₂ 蓝色沉淀',
    molecular: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
    complete: 'Cu²⁺ + SO₄²⁻ + 2Na⁺ + 2OH⁻ → Cu(OH)₂↓ + 2Na⁺ + SO₄²⁻',
    net: 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓',
    spectatorIons: ['Na⁺', 'SO₄²⁻'],
    productLabel: 'Cu(OH)₂↓',
    productKind: '沉淀',
    principle: 'Cu(OH)₂ 难溶，Cu²⁺ 与 OH⁻ 结合成蓝色沉淀。',
    reactants: ['CuSO₄', 'NaOH'],
    products: ['Cu(OH)₂↓', 'Na₂SO₄'],
    particles: [
      { id: 'cu', label: 'Cu²⁺', x: 31, y: 45, role: 'reactive', charge: '2+' },
      { id: 'so4', label: 'SO₄²⁻', x: 18, y: 70, role: 'spectator', charge: '2-' },
      { id: 'na', label: 'Na⁺', x: 78, y: 34, role: 'spectator', charge: '+' },
      { id: 'oh', label: 'OH⁻', x: 63, y: 66, role: 'reactive', charge: '-' }
    ]
  }
];

const ION_SOLUBILITY_RULES = [
  { ion: 'Na⁺、K⁺、NH₄⁺、NO₃⁻', rule: '均可溶', tone: 'green' },
  { ion: 'Cl⁻', rule: '多数可溶，AgCl、PbCl₂ 例外', tone: 'green' },
  { ion: 'SO₄²⁻', rule: '多数可溶，BaSO₄、PbSO₄ 例外', tone: 'green' },
  { ion: 'CO₃²⁻、OH⁻、S²⁻', rule: '多数不溶，Na⁺、K⁺、NH₄⁺ 盐例外', tone: 'red' }
];

const ION_REACTION_COPY: LocalizedMap<Record<string, { label: string; productKind: string; principle: string }>> = {
  'zh-CN': {},
  en: {
    agcl: { label: 'AgCl White Precipitate', productKind: 'Precipitate', principle: 'AgCl is poorly soluble, so Ag+ and Cl- combine to form a precipitate; Na+ and NO3- remain unchanged.' },
    baso4: { label: 'BaSO4 White Precipitate', productKind: 'Precipitate', principle: 'BaSO4 is poorly soluble, so Ba2+ and SO4^2- are the reacting ions; Na+ and Cl- are spectator ions.' },
    'carbonate-acid': { label: 'Carbonate Releases Gas with Acid', productKind: 'Gas', principle: 'Carbonate reacts with H+ to form H2CO3, which then decomposes into H2O and CO2 gas.' },
    neutralization: { label: 'Strong Acid-Base Neutralization', productKind: 'Water', principle: 'The essence of strong acid-strong base neutralization is H+ combining with OH- to form water.' },
    cuoh2: { label: 'Cu(OH)2 Blue Precipitate', productKind: 'Precipitate', principle: 'Cu(OH)2 is poorly soluble, so Cu2+ combines with OH- to form a blue precipitate.' }
  }
};
(ION_REACTION_COPY as any).vi = {
  agcl: { label: 'Ket tua trang AgCl', productKind: 'Ket tua', principle: 'AgCl it tan, nen Ag+ va Cl- ket hop tao ket tua; Na+ va NO3- khong doi.' },
  baso4: { label: 'Ket tua trang BaSO4', productKind: 'Ket tua', principle: 'BaSO4 it tan, nen Ba2+ va SO4^2- la cac ion thuc su phan ung; Na+ va Cl- la ion khan.' },
  'carbonate-acid': { label: 'Cacbonat gap axit giai phong khi', productKind: 'Khi', principle: 'Cacbonat phan ung voi H+ tao H2CO3, roi phan huy thanh H2O va CO2.' },
  neutralization: { label: 'Trung hoa axit manh-bazo manh', productKind: 'Nuoc', principle: 'Ban chat cua trung hoa axit manh-bazo manh la H+ ket hop voi OH- tao nuoc.' },
  cuoh2: { label: 'Ket tua xanh Cu(OH)2', productKind: 'Ket tua', principle: 'Cu(OH)2 it tan, nen Cu2+ ket hop voi OH- tao ket tua xanh.' }
};


const ION_SOLUBILITY_RULE_COPY: LocalizedMap<typeof ION_SOLUBILITY_RULES> = {
  'zh-CN': ION_SOLUBILITY_RULES,
  en: [
    { ion: 'Na+, K+, NH4+, NO3-', rule: 'Soluble', tone: 'green' },
    { ion: 'Cl-', rule: 'Mostly soluble; AgCl and PbCl2 are exceptions', tone: 'green' },
    { ion: 'SO4^2-', rule: 'Mostly soluble; BaSO4 and PbSO4 are exceptions', tone: 'green' },
    { ion: 'CO3^2-, OH-, S^2-', rule: 'Mostly insoluble; Na+, K+, and NH4+ salts are exceptions', tone: 'red' }
  ]
};
(ION_SOLUBILITY_RULE_COPY as any).vi = [
  { ion: 'Na+, K+, NH4+, NO3-', rule: 'Tan', tone: 'green' },
  { ion: 'Cl-', rule: 'Phan lon tan; AgCl va PbCl2 la ngoai le', tone: 'green' },
  { ion: 'SO4^2-', rule: 'Phan lon tan; BaSO4 va PbSO4 la ngoai le', tone: 'green' },
  { ion: 'CO3^2-, OH-, S^2-', rule: 'Phan lon khong tan; muoi Na+, K+ va NH4+ la ngoai le', tone: 'red' }
];


function ionReactionLabel(reaction: IonReaction, locale: Locale) {
  return chemValue(locale, ION_REACTION_COPY)[reaction.id]?.label ?? reaction.label;
}

function ionReactionProductKind(reaction: IonReaction, locale: Locale) {
  return chemValue(locale, ION_REACTION_COPY)[reaction.id]?.productKind ?? reaction.productKind;
}

function ionReactionPrinciple(reaction: IonReaction, locale: Locale) {
  return chemValue(locale, ION_REACTION_COPY)[reaction.id]?.principle ?? reaction.principle;
}

function splitIonLabels(values: string[]) {
  return Array.from(new Set(values));
}

type HydrocarbonFamily = 'alkane' | 'alkene' | 'alkyne';
type OrganicCategory = HydrocarbonFamily | 'functional';

const HYDROCARBON_FAMILY_META: Record<HydrocarbonFamily, {
  label: string;
  formula: string;
  minCarbon: number;
  saturation: string;
  bondLabel: string;
  mainReaction: string;
  note: string;
}> = {
  alkane: {
    label: '烷烃',
    formula: 'CₙH₂ₙ₊₂',
    minCarbon: 1,
    saturation: '饱和',
    bondLabel: 'C-C 单键',
    mainReaction: '取代、燃烧、裂化',
    note: '只含 C-C 单键，氢原子数达到开链烃最大值。'
  },
  alkene: {
    label: '烯烃',
    formula: 'CₙH₂ₙ',
    minCarbon: 2,
    saturation: '不饱和',
    bondLabel: 'C=C 双键',
    mainReaction: '加成、氧化、燃烧',
    note: '含一个 C=C 双键，比同碳数烷烃少 2 个 H。'
  },
  alkyne: {
    label: '炔烃',
    formula: 'CₙH₂ₙ₋₂',
    minCarbon: 2,
    saturation: '不饱和',
    bondLabel: 'C≡C 三键',
    mainReaction: '加成、氧化、燃烧',
    note: '含一个 C≡C 三键，不饱和度比烯烃更高。'
  }
};

const ORGANIC_CATEGORY_META: Record<OrganicCategory, { label: string; formula: string }> = {
  alkane: { label: '烷烃', formula: 'CₙH₂ₙ₊₂' },
  alkene: { label: '烯烃', formula: 'CₙH₂ₙ' },
  alkyne: { label: '炔烃', formula: 'CₙH₂ₙ₋₂' },
  functional: { label: '官能团', formula: 'R-X / R-COOH' }
};

const ORGANIC_CATEGORY_LABELS: LocalizedMap<Record<OrganicCategory, string>> = {
  'zh-CN': {
    alkane: ORGANIC_CATEGORY_META.alkane.label,
    alkene: ORGANIC_CATEGORY_META.alkene.label,
    alkyne: ORGANIC_CATEGORY_META.alkyne.label,
    functional: ORGANIC_CATEGORY_META.functional.label
  },
  en: {
    alkane: 'Alkanes',
    alkene: 'Alkenes',
    alkyne: 'Alkynes',
    functional: 'Functional Groups'
  }
};
(ORGANIC_CATEGORY_LABELS as any).vi = {
  alkane: 'Ankan',
  alkene: 'Anken',
  alkyne: 'Ankin',
  functional: 'Nhom chuc'
};


const HYDROCARBON_FAMILY_COPY: LocalizedMap<Record<HydrocarbonFamily, { label: string; saturation: string; bondLabel: string; mainReaction: string; note: string }>> = {
  'zh-CN': HYDROCARBON_FAMILY_META,
  en: {
    alkane: { label: 'Alkanes', saturation: 'Saturated', bondLabel: 'C-C single bond', mainReaction: 'Substitution, combustion, cracking', note: 'Only C-C single bonds are present, so open-chain hydrocarbons have the maximum hydrogen count.' },
    alkene: { label: 'Alkenes', saturation: 'Unsaturated', bondLabel: 'C=C double bond', mainReaction: 'Addition, oxidation, combustion', note: 'One C=C double bond gives two fewer H atoms than the alkane with the same carbon count.' },
    alkyne: { label: 'Alkynes', saturation: 'Unsaturated', bondLabel: 'C≡C triple bond', mainReaction: 'Addition, oxidation, combustion', note: 'One C≡C triple bond gives higher unsaturation than an alkene.' }
  }
};
(HYDROCARBON_FAMILY_COPY as any).vi = {
  alkane: { label: 'Ankan', saturation: 'Bao hoa', bondLabel: 'Lien ket don C-C', mainReaction: 'The, chay, cracking', note: 'Chi co lien ket don C-C, nen hydrocacbon mach ho co so H toi da.' },
  alkene: { label: 'Anken', saturation: 'Khong bao hoa', bondLabel: 'Lien ket doi C=C', mainReaction: 'Cong, oxi hoa, chay', note: 'Mot lien ket doi C=C lam so H it hon ankan cung so C la 2.' },
  alkyne: { label: 'Ankin', saturation: 'Khong bao hoa', bondLabel: 'Lien ket ba C?C', mainReaction: 'Cong, oxi hoa, chay', note: 'Mot lien ket ba C?C tao do bat bao hoa cao hon anken.' }
};


type FunctionalOrganicExample = {
  id: string;
  name: string;
  formula: string;
  condensed: string;
  group: string;
  groupFormula: string;
  family: string;
  molarMass: number;
  reaction: string;
  note: string;
  atoms: Array<{ label: string; x: number; y: number; tone: 'carbon' | 'hydrogen' | 'oxygen' | 'nitrogen' }>;
  bonds: Array<{ from: number; to: number; order?: 1 | 2 }>;
};

const FUNCTIONAL_ORGANIC_EXAMPLES: FunctionalOrganicExample[] = [
  {
    id: 'ethanol',
    name: '乙醇',
    formula: 'C₂H₆O',
    condensed: 'CH₃-CH₂-OH',
    group: '羟基',
    groupFormula: '-OH',
    family: '醇',
    molarMass: 46,
    reaction: '乙醇 + O₂ → CO₂ + H₂O；也可被氧化为乙醛/乙酸',
    note: '羟基使分子能形成氢键，低级醇易溶于水。',
    atoms: [
      { label: 'C', x: 180, y: 178, tone: 'carbon' },
      { label: 'C', x: 250, y: 178, tone: 'carbon' },
      { label: 'O', x: 320, y: 178, tone: 'oxygen' },
      { label: 'H', x: 376, y: 178, tone: 'hydrogen' }
    ],
    bonds: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]
  },
  {
    id: 'acetic-acid',
    name: '乙酸',
    formula: 'C₂H₄O₂',
    condensed: 'CH₃-COOH',
    group: '羧基',
    groupFormula: '-COOH',
    family: '羧酸',
    molarMass: 60,
    reaction: '乙酸 + 乙醇 ⇌ 乙酸乙酯 + 水（酯化）',
    note: '羧基具有酸性，可与碱、活泼金属、碳酸盐反应。',
    atoms: [
      { label: 'C', x: 185, y: 184, tone: 'carbon' },
      { label: 'C', x: 260, y: 184, tone: 'carbon' },
      { label: 'O', x: 260, y: 116, tone: 'oxygen' },
      { label: 'O', x: 334, y: 184, tone: 'oxygen' },
      { label: 'H', x: 390, y: 184, tone: 'hydrogen' }
    ],
    bonds: [{ from: 0, to: 1 }, { from: 1, to: 2, order: 2 }, { from: 1, to: 3 }, { from: 3, to: 4 }]
  },
  {
    id: 'acetaldehyde',
    name: '乙醛',
    formula: 'C₂H₄O',
    condensed: 'CH₃-CHO',
    group: '醛基',
    groupFormula: '-CHO',
    family: '醛',
    molarMass: 44,
    reaction: '乙醛可被氧化为乙酸，也可发生银镜反应',
    note: '醛基含有 C=O 和与羰基碳相连的 H，具有还原性。',
    atoms: [
      { label: 'C', x: 188, y: 184, tone: 'carbon' },
      { label: 'C', x: 264, y: 184, tone: 'carbon' },
      { label: 'O', x: 264, y: 116, tone: 'oxygen' },
      { label: 'H', x: 336, y: 184, tone: 'hydrogen' }
    ],
    bonds: [{ from: 0, to: 1 }, { from: 1, to: 2, order: 2 }, { from: 1, to: 3 }]
  },
  {
    id: 'ethyl-acetate',
    name: '乙酸乙酯',
    formula: 'C₄H₈O₂',
    condensed: 'CH₃-COO-CH₂-CH₃',
    group: '酯基',
    groupFormula: '-COO-',
    family: '酯',
    molarMass: 88,
    reaction: '酯在酸或碱条件下可水解生成酸和醇',
    note: '酯基常带有香味，是羧酸和醇发生酯化反应的产物。',
    atoms: [
      { label: 'C', x: 132, y: 184, tone: 'carbon' },
      { label: 'C', x: 205, y: 184, tone: 'carbon' },
      { label: 'O', x: 205, y: 116, tone: 'oxygen' },
      { label: 'O', x: 278, y: 184, tone: 'oxygen' },
      { label: 'C', x: 350, y: 184, tone: 'carbon' },
      { label: 'C', x: 420, y: 184, tone: 'carbon' }
    ],
    bonds: [{ from: 0, to: 1 }, { from: 1, to: 2, order: 2 }, { from: 1, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 5 }]
  },
  {
    id: 'ethylamine',
    name: '乙胺',
    formula: 'C₂H₇N',
    condensed: 'CH₃-CH₂-NH₂',
    group: '氨基',
    groupFormula: '-NH₂',
    family: '胺',
    molarMass: 45,
    reaction: '胺显弱碱性，可与酸反应生成铵盐',
    note: '氨基含 N 原子和孤对电子，常表现出碱性。',
    atoms: [
      { label: 'C', x: 180, y: 178, tone: 'carbon' },
      { label: 'C', x: 252, y: 178, tone: 'carbon' },
      { label: 'N', x: 324, y: 178, tone: 'nitrogen' },
      { label: 'H', x: 372, y: 140, tone: 'hydrogen' },
      { label: 'H', x: 372, y: 216, tone: 'hydrogen' }
    ],
    bonds: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 2, to: 4 }]
  }
];

const FUNCTIONAL_ORGANIC_COPY: LocalizedMap<Record<string, { name: string; group: string; family: string; reaction: string; note: string }>> = {
  'zh-CN': {},
  en: {
    ethanol: { name: 'Ethanol', group: 'Hydroxyl', family: 'Alcohol', reaction: 'Ethanol + O2 -> CO2 + H2O; it can also be oxidized to acetaldehyde/acetic acid', note: 'The hydroxyl group allows hydrogen bonding, so lower alcohols dissolve easily in water.' },
    'acetic-acid': { name: 'Acetic acid', group: 'Carboxyl', family: 'Carboxylic acid', reaction: 'Acetic acid + ethanol <-> ethyl acetate + water (esterification)', note: 'The carboxyl group is acidic and reacts with bases, active metals, and carbonates.' },
    acetaldehyde: { name: 'Acetaldehyde', group: 'Aldehyde', family: 'Aldehyde', reaction: 'Acetaldehyde can be oxidized to acetic acid and can give a silver mirror reaction', note: 'The aldehyde group contains C=O and H attached to the carbonyl carbon, giving reducing behavior.' },
    'ethyl-acetate': { name: 'Ethyl acetate', group: 'Ester', family: 'Ester', reaction: 'Esters hydrolyze under acidic or basic conditions to form an acid and an alcohol', note: 'Ester groups often have pleasant odors and are products of esterification between carboxylic acids and alcohols.' },
    ethylamine: { name: 'Ethylamine', group: 'Amino', family: 'Amine', reaction: 'Amines are weak bases and react with acids to form ammonium salts', note: 'The amino group contains nitrogen and a lone pair, so it often behaves as a base.' }
  }
};
(FUNCTIONAL_ORGANIC_COPY as any).vi = {
  ethanol: { name: 'Etanol', group: 'Hydroxyl', family: 'Ancol', reaction: 'Etanol + O2 -> CO2 + H2O; cung co the bi oxi hoa thanh axetandehit/axit axetic', note: 'Nhom hydroxyl cho phep tao lien ket hydro, nen ancol thap de tan trong nuoc.' },
  'acetic-acid': { name: 'Axit axetic', group: 'Carboxyl', family: 'Axit cacboxylic', reaction: 'Axit axetic + etanol <-> etyl axetat + nuoc (este hoa)', note: 'Nhom carboxyl co tinh axit va phan ung voi bazo, kim loai hoat dong va cacbonat.' },
  acetaldehyde: { name: 'Axetandehit', group: 'Aldehyde', family: 'Aldehyde', reaction: 'Axetandehit co the bi oxi hoa thanh axit axetic va cho phan ung trang bac', note: 'Nhom aldehyde chua C=O va H gan voi carbonyl carbon, nen co tinh khu.' },
  'ethyl-acetate': { name: 'Etyl axetat', group: 'Ester', family: 'Ester', reaction: 'Ester thuy phan trong moi truong axit hoac bazo tao axit va ancol', note: 'Nhom ester thuong co mui de chiu va la san pham este hoa giua axit cacboxylic va ancol.' },
  ethylamine: { name: 'Etylamin', group: 'Amino', family: 'Amin', reaction: 'Amin la bazo yeu va phan ung voi axit tao muoi amoni', note: 'Nhom amino chua nito va mot cap electron tu do, nen thuong the hien tinh bazo.' }
};


const HYDROCARBON_NAMES_BY_LOCALE: LocalizedMap<Record<HydrocarbonFamily, string[]>> = {
  'zh-CN': {
    alkane: ['甲烷', '乙烷', '丙烷', '丁烷', '戊烷', '己烷', '庚烷', '辛烷'],
    alkene: ['', '乙烯', '丙烯', '丁烯', '戊烯', '己烯', '庚烯', '辛烯'],
    alkyne: ['', '乙炔', '丙炔', '丁炔', '戊炔', '己炔', '庚炔', '辛炔']
  },
  en: {
    alkane: ['methane', 'ethane', 'propane', 'butane', 'pentane', 'hexane', 'heptane', 'octane'],
    alkene: ['', 'ethene', 'propene', 'butene', 'pentene', 'hexene', 'heptene', 'octene'],
    alkyne: ['', 'ethyne', 'propyne', 'butyne', 'pentyne', 'hexyne', 'heptyne', 'octyne']
  }
};
(HYDROCARBON_NAMES_BY_LOCALE as any).vi = {
  alkane: ['metan', 'etan', 'propan', 'butan', 'pentan', 'hexan', 'heptan', 'octan'],
  alkene: ['', 'eten', 'propen', 'buten', 'penten', 'hexen', 'hepten', 'octen'],
  alkyne: ['', 'etin', 'propin', 'butin', 'pentin', 'hexin', 'heptin', 'octin']
};


const HYDROCARBON_NAMES: Record<HydrocarbonFamily, string[]> = {
  alkane: ['甲烷', '乙烷', '丙烷', '丁烷', '戊烷', '己烷', '庚烷', '辛烷'],
  alkene: ['', '乙烯', '丙烯', '丁烯', '戊烯', '己烯', '庚烯', '辛烯'],
  alkyne: ['', '乙炔', '丙炔', '丁炔', '戊炔', '己炔', '庚炔', '辛炔']
};

const ALKANE_ISOMER_COUNTS: Record<number, { count: number; examples: string[] }> = {
  1: { count: 1, examples: ['CH₄'] },
  2: { count: 1, examples: ['CH₃-CH₃'] },
  3: { count: 1, examples: ['CH₃-CH₂-CH₃'] },
  4: { count: 2, examples: ['正丁烷：CH₃-CH₂-CH₂-CH₃', '异丁烷：(CH₃)₃CH'] },
  5: { count: 3, examples: ['正戊烷', '异戊烷', '新戊烷'] },
  6: { count: 5, examples: ['正己烷', '2-甲基戊烷', '2,2-二甲基丁烷'] },
  7: { count: 9, examples: ['正庚烷', '2-甲基己烷', '3-乙基戊烷'] },
  8: { count: 18, examples: ['正辛烷', '2-甲基庚烷', '2,2,4-三甲基戊烷'] }
};

const HYDROCARBON_ISOMER_INFO: LocalizedMap<Record<number, { count: number; examples: string[] }>> = {
  'zh-CN': ALKANE_ISOMER_COUNTS,
  en: {
    1: { count: 1, examples: ['CH4'] },
    2: { count: 1, examples: ['CH3-CH3'] },
    3: { count: 1, examples: ['CH3-CH2-CH3'] },
    4: { count: 2, examples: ['n-butane: CH3-CH2-CH2-CH3', 'isobutane: (CH3)3CH'] },
    5: { count: 3, examples: ['n-pentane', 'isopentane', 'neopentane'] },
    6: { count: 5, examples: ['n-hexane', '2-methylpentane', '2,2-dimethylbutane'] },
    7: { count: 9, examples: ['n-heptane', '2-methylhexane', '3-ethylpentane'] },
    8: { count: 18, examples: ['n-octane', '2-methylheptane', '2,2,4-trimethylpentane'] }
  }
};
(HYDROCARBON_ISOMER_INFO as any).vi = {
  1: { count: 1, examples: ['CH4'] },
  2: { count: 1, examples: ['CH3-CH3'] },
  3: { count: 1, examples: ['CH3-CH2-CH3'] },
  4: { count: 2, examples: ['n-butan: CH3-CH2-CH2-CH3', 'isobutan: (CH3)3CH'] },
  5: { count: 3, examples: ['n-pentan', 'isopentan', 'neopentan'] },
  6: { count: 5, examples: ['n-hexan', '2-metylpentan', '2,2-dimetylbutan'] },
  7: { count: 9, examples: ['n-heptan', '2-metylhexan', '3-etylpentan'] },
  8: { count: 18, examples: ['n-octan', '2-metylheptan', '2,2,4-trimetylpentan'] }
};


function hydrocarbonHydrogenCount(family: HydrocarbonFamily, carbonCount: number) {
  if (family === 'alkane') return carbonCount * 2 + 2;
  if (family === 'alkene') return carbonCount * 2;
  return carbonCount * 2 - 2;
}

function hydrocarbonFormula(family: HydrocarbonFamily, carbonCount: number) {
  const hydrogen = hydrocarbonHydrogenCount(family, carbonCount);
  return `C${toSubscript(carbonCount)}H${toSubscript(hydrogen)}`;
}

function toSubscript(value: number) {
  const digits: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(value).split('').map((digit) => digits[digit] ?? digit).join('');
}

function hydrocarbonCondensedFormula(family: HydrocarbonFamily, carbonCount: number, bondPosition: number) {
  if (carbonCount === 1) return 'CH₄';
  if (family === 'alkane') {
    if (carbonCount === 2) return 'CH₃-CH₃';
    return `CH₃-${carbonCount > 3 ? `(CH₂)${toSubscript(carbonCount - 2)}-` : 'CH₂-'}CH₃`;
  }
  if (family === 'alkene') {
    if (carbonCount === 2) return 'CH₂=CH₂';
    if (bondPosition === 1) return `CH₂=CH-${carbonCount > 3 ? `(CH₂)${toSubscript(carbonCount - 3)}-` : ''}CH₃`;
    return `CH₃-${bondPosition > 2 ? `(CH₂)${toSubscript(bondPosition - 2)}-` : ''}CH=CH-${carbonCount - bondPosition - 1 > 0 ? `(CH₂)${toSubscript(carbonCount - bondPosition - 1)}-` : ''}CH₃`;
  }
  if (carbonCount === 2) return 'HC≡CH';
  if (bondPosition === 1) return `HC≡C-${carbonCount > 3 ? `(CH₂)${toSubscript(carbonCount - 3)}-` : ''}CH₃`;
  return `CH₃-${bondPosition > 2 ? `(CH₂)${toSubscript(bondPosition - 2)}-` : ''}C≡C-${carbonCount - bondPosition - 1 > 0 ? `(CH₂)${toSubscript(carbonCount - bondPosition - 1)}-` : ''}CH₃`;
}

function hydrocarbonName(family: HydrocarbonFamily, carbonCount: number, bondPosition: number) {
  const base = HYDROCARBON_NAMES[family][carbonCount - 1] ?? `${carbonCount}碳${HYDROCARBON_FAMILY_META[family].label}`;
  if (family === 'alkane' || carbonCount <= 3) return base;
  return `${bondPosition}-${base}`;
}

function hydrocarbonNameForLocale(family: HydrocarbonFamily, carbonCount: number, bondPosition: number, locale: Locale) {
  const names = chemValue(locale, HYDROCARBON_NAMES_BY_LOCALE);
  const familyCopy = chemValue(locale, HYDROCARBON_FAMILY_COPY)[family];
  const base = names[family][carbonCount - 1] ?? chemText(locale, `${carbonCount}-carbon ${familyCopy.label.toLowerCase()}`, `${carbonCount}碳${familyCopy.label}`);
  if (family === 'alkane' || carbonCount <= 3) return base;
  return `${bondPosition}-${base}`;
}

function hydrocarbonMetaLabel(family: HydrocarbonFamily, locale: Locale) {
  return chemValue(locale, HYDROCARBON_FAMILY_COPY)[family].label;
}

function hydrocarbonSaturation(family: HydrocarbonFamily, locale: Locale) {
  return chemValue(locale, HYDROCARBON_FAMILY_COPY)[family].saturation;
}

function hydrocarbonBondLabel(family: HydrocarbonFamily, locale: Locale) {
  return chemValue(locale, HYDROCARBON_FAMILY_COPY)[family].bondLabel;
}

function hydrocarbonNote(family: HydrocarbonFamily, locale: Locale) {
  return chemValue(locale, HYDROCARBON_FAMILY_COPY)[family].note;
}

function organicCategoryLabel(category: OrganicCategory, locale: Locale) {
  return chemValue(locale, ORGANIC_CATEGORY_LABELS)[category];
}

function functionalName(example: FunctionalOrganicExample, locale: Locale) {
  return chemValue(locale, FUNCTIONAL_ORGANIC_COPY)[example.id]?.name ?? example.name;
}

function functionalGroup(example: FunctionalOrganicExample, locale: Locale) {
  return chemValue(locale, FUNCTIONAL_ORGANIC_COPY)[example.id]?.group ?? example.group;
}

function functionalFamily(example: FunctionalOrganicExample, locale: Locale) {
  return chemValue(locale, FUNCTIONAL_ORGANIC_COPY)[example.id]?.family ?? example.family;
}

function functionalReaction(example: FunctionalOrganicExample, locale: Locale) {
  return chemValue(locale, FUNCTIONAL_ORGANIC_COPY)[example.id]?.reaction ?? example.reaction;
}

function functionalNote(example: FunctionalOrganicExample, locale: Locale) {
  return chemValue(locale, FUNCTIONAL_ORGANIC_COPY)[example.id]?.note ?? example.note;
}

function maxMultipleBondPosition(carbonCount: number) {
  return Math.max(1, Math.floor(carbonCount / 2));
}

function hydrocarbonIsomerInfo(family: HydrocarbonFamily, carbonCount: number) {
  if (family === 'alkane') return ALKANE_ISOMER_COUNTS[carbonCount] ?? { count: 1, examples: ['直链结构'] };
  const positionCount = maxMultipleBondPosition(carbonCount);
  return {
    count: carbonCount >= 4 ? positionCount + (family === 'alkene' ? 1 : 0) : positionCount,
    examples: family === 'alkene' && carbonCount >= 4
      ? [`1-${HYDROCARBON_NAMES[family][carbonCount - 1]}`, `2-${HYDROCARBON_NAMES[family][carbonCount - 1]}`, '还可能有顺反异构']
      : Array.from({ length: positionCount }, (_, index) => `${index + 1}-${HYDROCARBON_NAMES[family][carbonCount - 1]}`)
  };
}

function hydrocarbonIsomerInfoForLocale(family: HydrocarbonFamily, carbonCount: number, locale: Locale) {
  const localizedCounts = chemValue(locale, HYDROCARBON_ISOMER_INFO);
  if (family === 'alkane') return localizedCounts[carbonCount] ?? chemText(locale, { count: 1, examples: ['straight-chain structure'] }, { count: 1, examples: ['直链结构'] });
  const positionCount = maxMultipleBondPosition(carbonCount);
  const name = chemValue(locale, HYDROCARBON_NAMES_BY_LOCALE)[family][carbonCount - 1];
  return {
    count: carbonCount >= 4 ? positionCount + (family === 'alkene' ? 1 : 0) : positionCount,
    examples: chemText(locale,
      family === 'alkene' && carbonCount >= 4
      ? [`1-${name}`, `2-${name}`, 'cis-trans isomerism may also occur']
      : Array.from({ length: positionCount }, (_, index) => `${index + 1}-${name}`),
      family === 'alkene' && carbonCount >= 4
        ? [`1-${name}`, `2-${name}`, '还可能有顺反异构']
        : Array.from({ length: positionCount }, (_, index) => `${index + 1}-${name}`)
    )
  };
}

function hydrocarbonReactionEquation(family: HydrocarbonFamily, carbonCount: number) {
  const formula = hydrocarbonFormula(family, carbonCount);
  if (family === 'alkane') return `${formula} + Cl₂ → 氯代烃 + HCl（光照取代）`;
  if (family === 'alkene') return `${formula} + Br₂ → 二溴代烃（加成）`;
  return `${formula} + 2H₂ → C${toSubscript(carbonCount)}H${toSubscript(carbonCount * 2 + 2)}（加成）`;
}

function hydrocarbonReactionEquationForLocale(family: HydrocarbonFamily, carbonCount: number, locale: Locale) {
  const formula = hydrocarbonFormula(family, carbonCount);
  if (family === 'alkane') return chemText(locale, `${formula} + Cl2 -> chloroalkane + HCl (light substitution)`, hydrocarbonReactionEquation(family, carbonCount));
  if (family === 'alkene') return chemText(locale, `${formula} + Br2 -> dibromoalkane (addition)`, hydrocarbonReactionEquation(family, carbonCount));
  return chemText(locale, `${formula} + 2H2 -> C${toSubscript(carbonCount)}H${toSubscript(carbonCount * 2 + 2)} (addition)`, hydrocarbonReactionEquation(family, carbonCount));
}

function getNeutralizationState(acidMoles: number, baseMoles: number) {
  const safeAcid = Math.max(acidMoles, 0.001);
  const safeBase = Math.max(baseMoles, 0);
  const ratio = clampNumber(safeBase / safeAcid, 0, 2);
  const diff = acidMoles - safeBase;
  const acidVolumeLiters = safeAcid / CHEM_ELECTROLYTE_CONCENTRATION;
  const baseVolumeLiters = safeBase / CHEM_ELECTROLYTE_CONCENTRATION;
  const totalVolumeLiters = Math.max(acidVolumeLiters + baseVolumeLiters, 0.001);
  let ph = 7;
  if (Math.abs(diff) < 0.0005) {
    ph = 7;
  } else if (diff > 0) {
    const hConcentration = diff / totalVolumeLiters;
    ph = -Math.log10(Math.max(hConcentration, 1e-14));
  } else {
    const ohConcentration = -diff / totalVolumeLiters;
    ph = 14 + Math.log10(Math.max(ohConcentration, 1e-14));
  }
  const safePh = clampNumber(ph, 0, 14);
  const excessLabel = Math.abs(diff) < 0.0005 ? 'H⁺ 与 OH⁻ 等量' : diff > 0 ? 'HCl 过量' : 'NaOH 过量';
  const reactionProgress = clampNumber(Math.min(safeBase, safeAcid) / safeAcid, 0, 1);
  return {
    ph: safePh,
    ratio,
    excessLabel,
    reactionProgress,
    label: safePh < 6.5 ? '酸性溶液' : safePh > 7.5 ? '碱性溶液' : '接近中性',
    solutionTone: safePh < 6.5 ? 'acidic' : safePh > 7.5 ? 'basic' : 'neutral'
  };
}

function titrationPath(width: number, height: number, acidMoles: number, state: ReturnType<typeof getNeutralizationState>) {
  const left = 44;
  const right = width - 20;
  const top = 24;
  const bottom = height - 42;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const yForPh = (ph: number) => bottom - (ph / 14) * plotHeight;
  const points = Array.from({ length: 120 }, (_, index) => {
    const ratio = (index / 119) * 2;
    const ph = getNeutralizationState(acidMoles, ratio * acidMoles).ph;
    const x = left + (ratio / 2) * plotWidth;
    const y = yForPh(ph);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const currentX = left + (state.ratio / 2) * plotWidth;
  const currentY = yForPh(state.ph);
  const equivalenceX = left + 0.5 * plotWidth;
  return { left, right, top, bottom, path: points, currentX, currentY, equivalenceX, yForPh };
}

function chemistryIonList(ratio: number): ChemIonType[] {
  const acidShare = clampNumber(1 - ratio, 0, 1);
  const baseShare = clampNumber(ratio - 1, 0, 1);
  const sodiumShare = clampNumber(ratio, 0, 2) / 2;
  const chlorideShare = 0.82;
  const counts: Record<ChemIonType, number> = {
    'Cl-': Math.round(16 * chlorideShare),
    'Na+': Math.round(16 * sodiumShare),
    'H+': Math.round(14 * acidShare),
    'OH-': Math.round(14 * baseShare)
  };
  const ionOrder: ChemIonType[] = ['H+', 'Cl-', 'Na+', 'Cl-', 'H+', 'Na+', 'OH-', 'Cl-'];
  const ions: ChemIonType[] = [];
  let guard = 0;
  while (ions.length < CHEM_ION_POSITIONS.length && Object.values(counts).some((count) => count > 0) && guard < 120) {
    const ion = ionOrder[guard % ionOrder.length];
    if (counts[ion] > 0) {
      ions.push(ion);
      counts[ion] -= 1;
    }
    guard += 1;
  }
  return ions.slice(0, CHEM_ION_POSITIONS.length);
}

export function AcidBaseNeutralizationVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [acidMoles, setAcidMoles] = useState(CHEM_DEFAULT_ACID_MOLES);
  const [baseMoles, setBaseMoles] = useState(0);
  const [showIons, setShowIons] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const maxBase = useMemo(() => Math.max(CHEM_MIN_ACID_MOLES * 2, acidMoles * 2), [acidMoles]);
  const state = useMemo(() => getNeutralizationState(acidMoles, baseMoles), [acidMoles, baseMoles]);
  const ions = useMemo(() => chemistryIonList(state.ratio), [state.ratio]);
  const chart = useMemo(() => titrationPath(520, 330, acidMoles, state), [acidMoles, state]);
  const phPercent = (state.ph / 14) * 100;
  const phLabelPercent = clampNumber(phPercent, 5, 95);
  const titrationPercent = (state.ratio / 2) * 100;

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setBaseMoles((current) => {
        const next = clampNumber(current + 0.02, 0, maxBase);
        if (next >= maxBase) {
          window.clearInterval(timer);
          setIsPlaying(false);
        }
        return next;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    setBaseMoles((current) => clampNumber(current, 0, maxBase));
  }, [acidMoles, maxBase]);

  const reset = () => {
    setBaseMoles(0);
    setAcidMoles(CHEM_DEFAULT_ACID_MOLES);
    setIsPlaying(false);
  };

  const ionClass = (ion: ChemIonType) => ion.replace('+', 'pos').replace('-', 'neg').toLowerCase();
  const neutralizationStatus = chemText(locale, state.ratio < 0.98 ? 'Acid in excess' : state.ratio > 1.02 ? 'Base in excess' : 'Equivalence point', state.excessLabel);
  const neutralizationLabel = chemText(locale, state.ph < 6.5 ? 'Acidic solution' : state.ph > 7.5 ? 'Basic solution' : 'Near neutral', state.label);
  const neutralizationTags = chemText(locale, ['Neutralization', 'pH', 'Hydrochloric acid', 'Sodium hydroxide', 'CSCA Chemistry'], ['酸碱中和', 'pH 值', '盐酸', '氢氧化钠', 'CSCA 化学']);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page chem-neutralization-page">
      <section className="special-visualizer-hero chem-neutralization-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Formulas', '← 返回化学公式')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Acid-Base Neutralization Visualizer', '首页 / 化学 / 公式 / 酸碱中和反应可视化')}</p>
          <h1>{chemText(locale, 'Acid-Base Neutralization Visualizer', '酸碱中和反应可视化')}</h1>
          <p className="page-body">{chemText(locale, 'Adjust added NaOH and watch pH, ion distribution, and the titration curve change together as hydrochloric acid is neutralized.', '调节 NaOH 加入量，观察盐酸被中和时 pH、离子分布和滴定曲线如何同步变化。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Acid-base neutralization simulation details', '酸碱中和模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
        </div>
      </section>

      <section className="special-visualizer-card chem-neutralization-card">
        <div className="chem-neutralization-stage">
          <div className="chem-beaker-panel">
            <div className="chem-panel-title">
              <strong>{chemText(locale, 'HCl + NaOH Solution', 'HCl + NaOH 溶液')}</strong>
              <span>{neutralizationStatus}</span>
            </div>
            <div className="chem-beaker">
              <div className={`chem-solution ${state.solutionTone}`} style={{ height: `${70 + Math.min(baseMoles / maxBase, 1) * 8}%` }}>
                {showIons && ions.map((ion, index) => {
                  const [x, y] = CHEM_ION_POSITIONS[index % CHEM_ION_POSITIONS.length];
                  return (
                    <span
                      key={`${ion}-${index}`}
                      className={`chem-ion ${ionClass(ion)}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {ion}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="chem-ph-strip" aria-label={chemText(locale, `Current pH ${state.ph.toFixed(1)}`, `当前 pH ${state.ph.toFixed(1)}`)}>
              <span>pH</span>
              <div className="chem-ph-bar">
                <i style={{ left: `${phPercent}%` }} />
                <b style={{ left: `${phLabelPercent}%` }}>{state.ph.toFixed(1)}</b>
                <small className="ph-min">0</small>
                <small className="ph-mid">7</small>
                <small className="ph-max">14</small>
              </div>
            </div>
            <div className="chem-state-summary">
              <span>{neutralizationLabel}</span>
              <strong>{state.ratio.toFixed(2)} × {chemText(locale, 'equivalence', '等量点')}</strong>
              <em>{chemText(locale, `${(state.reactionProgress * 100).toFixed(0)}% neutralized`, `已中和 ${(state.reactionProgress * 100).toFixed(0)}%`)}</em>
            </div>
          </div>

          <div className="chem-chart-panel">
            <svg className="chem-titration-chart" viewBox="0 0 520 330" role="img" aria-label={chemText(locale, 'Acid-base titration curve', '酸碱滴定曲线')}>
              <line x1={chart.left} y1={chart.bottom} x2={chart.right} y2={chart.bottom} className="axis" />
              <line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.bottom} className="axis" />
              <line x1={chart.left} y1={chart.yForPh(7)} x2={chart.right} y2={chart.yForPh(7)} className="grid" />
              <line x1={chart.equivalenceX} y1={chart.top + 8} x2={chart.equivalenceX} y2={chart.bottom} className="equivalence" />
              <text x={chart.equivalenceX - (chemText(locale, 32, 16))} y={chart.top + 2} className="equivalence-label">{chemText(locale, 'Equivalence', '等量点')}</text>
              <path d={chart.path} className="curve" />
              <circle cx={chart.currentX} cy={chart.currentY} r="6" className="current-dot" />
              <text x={chart.left - 28} y={chart.top + 6} className="axis-label">14</text>
              <text x={chart.left - 20} y={chart.bottom + 4} className="axis-label">0</text>
              <text x={chart.left - 24} y={chart.yForPh(7) + 4} className="axis-label">7</text>
              <text x={chart.left - 36} y={(chart.top + chart.bottom) / 2} className="axis-label rotate">pH</text>
              <text x={(chart.left + chart.right) / 2 - 45} y={chart.bottom + 26} className="axis-label">{chemText(locale, 'NaOH / HCl ratio', 'NaOH / HCl 摩尔比')}</text>
              {[0, 0.5, 1, 1.5, 2].map((tick) => (
                <g key={tick}>
                  <line x1={chart.left + (tick / 2) * (chart.right - chart.left)} y1={chart.bottom} x2={chart.left + (tick / 2) * (chart.right - chart.left)} y2={chart.bottom + 5} className="tick" />
                  <text x={chart.left + (tick / 2) * (chart.right - chart.left) - 4} y={chart.bottom + 20} className="axis-label">{tick}</text>
                </g>
              ))}
              <text x={chart.left + 238} y={chart.top - 8} className="chart-title">{chemText(locale, 'Titration Curve', '滴定曲线')}</text>
            </svg>
            <div className="chem-chart-legend">
              <span><i className="hpos" />H<sup>+</sup></span>
              <span><i className="ohneg" />OH<sup>-</sup></span>
              <span><i className="napos" />Na<sup>+</sup></span>
              <span><i className="clneg" />Cl<sup>-</sup></span>
            </div>
          </div>
        </div>

        <div className="chem-neutralization-controls">
          <div className="chem-ratio-meter" aria-label={chemText(locale, `Current NaOH to HCl mole ratio ${state.ratio.toFixed(2)}`, `当前 NaOH 与 HCl 摩尔比 ${state.ratio.toFixed(2)}`)}>
            <div className="chem-ratio-meter-head">
              <span>{chemText(locale, 'Titration Progress', '滴定进度')}</span>
              <strong>{state.ratio.toFixed(2)} × {chemText(locale, 'equivalence', '等量点')}</strong>
            </div>
            <div className="chem-ratio-track" style={{ '--ratio-fill': `${titrationPercent}%` } as CSSProperties}>
              <i className="equivalence" />
              <b style={{ left: `${titrationPercent}%` }} />
            </div>
            <div className="chem-ratio-scale" aria-hidden="true">
              <span>0</span>
              <span>{chemText(locale, 'Equivalence', '等量点')}</span>
              <span>2×</span>
            </div>
          </div>
          <label>
            <span>{chemText(locale, 'Added NaOH', 'NaOH 加入量')}</span>
            <strong>{baseMoles.toFixed(2)} mol</strong>
            <input
              aria-label={chemText(locale, 'Added NaOH', 'NaOH 加入量')}
              type="range"
              min="0"
              max={maxBase}
              step="0.01"
              value={baseMoles}
              onChange={(event) => {
                setIsPlaying(false);
                setBaseMoles(Number(event.target.value));
              }}
            />
            <div className="chem-range-scale" aria-hidden="true">
              <span>0</span>
              <span>{chemText(locale, 'Equivalence', '等量点')} {acidMoles.toFixed(2)} mol</span>
              <span>{maxBase.toFixed(2)} mol</span>
            </div>
          </label>
          <label>
            <span>{chemText(locale, 'Initial HCl', 'HCl 初始量')}</span>
            <strong>{acidMoles.toFixed(2)} mol</strong>
            <input
              aria-label={chemText(locale, 'Initial HCl', 'HCl 初始量')}
              type="range"
              min={CHEM_MIN_ACID_MOLES}
              max={CHEM_MAX_ACID_MOLES}
              step="0.01"
              value={acidMoles}
              onChange={(event) => setAcidMoles(Number(event.target.value))}
            />
          </label>
          <label className="chem-toggle">
            <input type="checkbox" checked={showIons} onChange={(event) => setShowIons(event.target.checked)} />
            <span>{chemText(locale, 'Show Ions', '显示离子')}</span>
          </label>
          <div className="chem-control-actions">
            <button type="button" onClick={() => setIsPlaying((current) => !current)}>
              <Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />
              {chemText(locale, (isPlaying ? 'Pause' : 'Play'), (isPlaying ? '暂停' : '播放'))}
            </button>
            <GhostButton onClick={reset}>
              <Icon name="lucide:rotate-ccw" />
              {chemText(locale, 'Reset', '重置')}
            </GhostButton>
          </div>
          <p className="chem-model-note">{chemText(locale, 'Model assumption: HCl and NaOH are treated as 1 mol/L strong electrolytes with complete ionization. pH is estimated from remaining H+/OH- after reaction and mixed volume; equivalence is set at pH = 7.', '模型假设：HCl 与 NaOH 均按 1 mol/L 强电解质处理，完全电离；pH 按反应后剩余 H⁺/OH⁻ 与混合体积估算，等量点按 pH = 7。')}</p>
        </div>
      </section>

      <section className="special-visualizer-support chem-neutralization-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$HCl+NaOH\\rightarrow NaCl+H_2O$'} /></p>
          <p><MathContent text={'$pH=-\\log[H^+]$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(subjectPath('chemistry'))}>
            {chemText(locale, 'Ion Reactions and Tests', '离子反应与检验')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Formulas', '查看公式')}
          </GhostButton>
        </article>
      </section>
      <div className="chem-neutralization-tags" aria-label={chemText(locale, 'Related tags', '相关标签')}>
        {neutralizationTags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </div>
  );
}

export function ChemistryReactionRateSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [initialConcentration, setInitialConcentration] = useState(1);
  const [temperature, setTemperature] = useState(300);
  const [activationEnergy, setActivationEnergy] = useState(50);
  const [catalyst, setCatalyst] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [observation, setObservation] = useState<string | null>(null);

  const state = useMemo(
    () => reactionRateState(initialConcentration, temperature, activationEnergy, catalyst, time),
    [initialConcentration, temperature, activationEnergy, catalyst, time]
  );
  const uncatalyzed = useMemo(
    () => reactionRateState(initialConcentration, temperature, activationEnergy, false, 0),
    [initialConcentration, temperature, activationEnergy]
  );
  const catalysisBoost = catalyst ? state.k / Math.max(uncatalyzed.k, 0.0001) : 1;
  const aFraction = clampNumber(state.concentrationA / Math.max(initialConcentration, 0.001), 0, 1);
  const aCount = Math.round(REACTION_RATE_PARTICLES.length * aFraction);
  const particleDuration = clampNumber(7 - (temperature - 260) / 30, 2.2, 7);
  const aPath = useMemo(() => reactionRateCurvePath(initialConcentration, state.k, false), [initialConcentration, state.k]);
  const bPath = useMemo(() => reactionRateCurvePath(initialConcentration, state.k, true), [initialConcentration, state.k]);
  const chart = REACTION_RATE_CHART;
  const currentX = chart.left + (clampNumber(time, 0, chart.duration) / chart.duration) * (chart.right - chart.left);
  const currentAY = chart.bottom - (state.concentrationA / 1.6) * (chart.bottom - chart.top);
  const currentBY = chart.bottom - (state.concentrationB / 1.6) * (chart.bottom - chart.top);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setTime((value) => {
        const next = value + 0.08;
        return next > chart.duration ? 0 : next;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [isPlaying, chart.duration]);

  const reset = () => {
    setTime(0);
    setIsPlaying(false);
    setObservation(null);
  };

  const setSlider = (setter: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(Number(event.target.value));
    setTime(0);
    setObservation(null);
  };

  const observationChecks = [
    {
      id: 'temperature',
      label: chemText(locale, 'Raising temperature increases k, so the curve drops faster.', '升高温度会增大 k，曲线下降更快。'),
      correct: temperature > 300,
      feedback: chemText(locale, temperature > 300 ? 'Correct. Higher temperature increases the effective collision ratio, so k becomes larger.' : 'Raise the temperature above 300 K and observe again; the curve becomes noticeably steeper.', temperature > 300 ? '正确。温度升高后有效碰撞比例增大，k 变大。' : '把温度调高到 300 K 以上再观察，曲线会明显变陡。')
    },
    {
      id: 'concentration',
      label: chemText(locale, 'For a first-order reaction, increasing [A]0 does not change half-life.', '一级反应中，[A]₀ 增大不会改变半衰期。'),
      correct: true,
      feedback: chemText(locale, 'Correct. For a first-order reaction, t1/2 = ln2/k, so it depends on k rather than initial concentration.', '正确。一级反应 t₁/₂=ln2/k，只由 k 决定，不由初始浓度决定。')
    },
    {
      id: 'catalyst',
      label: chemText(locale, 'A catalyst mainly increases k by lowering Ea.', '催化剂主要通过降低 Ea 增大 k。'),
      correct: catalyst,
      feedback: chemText(locale, catalyst ? `Correct. Effective Ea is now ${state.effectiveEa.toFixed(0)} kJ/mol, and k is about ${catalysisBoost.toFixed(1)} times larger.` : 'Turn on the catalyst and compare k and half-life again for a clearer contrast.', catalyst ? `正确。当前有效 Ea 降到 ${state.effectiveEa.toFixed(0)} kJ/mol，k 约增大 ${catalysisBoost.toFixed(1)} 倍。` : '打开催化剂开关后再比较 k 和半衰期，会更直观。')
    }
  ];

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page reaction-rate-page">
      <section className="special-visualizer-hero reaction-rate-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Reaction Rate Simulator', '首页 / 化学 / 公式 / 化学反应速率交互模拟')}</p>
          <h1>{chemText(locale, 'Chemical Reaction Rate Simulator', '化学反应速率交互模拟')}</h1>
          <p className="page-body">{chemText(locale, 'Adjust concentration, temperature, activation energy, and catalyst to observe particle changes, concentration curves, and rate metrics for the first-order reaction A → B.', '调节浓度、温度、活化能和催化剂，观察一级反应 A → B 的粒子变化、浓度曲线和速率指标。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Reaction rate simulation details', '反应速率模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{state.k.toFixed(2)}</b> s⁻¹</span>
        </div>
      </section>

      <section className="special-visualizer-card reaction-rate-card">
        <aside className="reaction-rate-controls">
          <div className="reaction-rate-conclusion">
            <span>{chemText(locale, 'Current Finding', '当前结论')}</span>
            <strong>{chemText(locale, (catalyst ? 'The catalyst lowers Ea, so the reaction speeds up noticeably.' : temperature > 320 ? 'Higher temperature increases k, so A is consumed faster.' : 'Adjust the conditions and observe how the curve slope changes.'), (catalyst ? '催化剂降低 Ea，反应明显加快。' : temperature > 320 ? '升温后 k 增大，A 消耗更快。' : '调节条件，观察曲线斜率变化。'))}</strong>
          </div>
          <label>
            <span>{chemText(locale, 'Initial Concentration [A]0', '初始浓度 [A]₀')}</span>
            <strong>{initialConcentration.toFixed(2)} mol/L</strong>
            <input type="range" min="0.3" max="1.5" step="0.05" value={initialConcentration} onChange={setSlider(setInitialConcentration)} />
          </label>
          <label>
            <span>{chemText(locale, 'Temperature T', '温度 T')}</span>
            <strong>{temperature.toFixed(0)} K</strong>
            <input type="range" min="260" max="380" step="5" value={temperature} onChange={setSlider(setTemperature)} />
          </label>
          <label>
            <span>{chemText(locale, 'Activation Energy Ea', '活化能 Ea')}</span>
            <strong>{activationEnergy.toFixed(0)} kJ/mol</strong>
            <input type="range" min="25" max="85" step="1" value={activationEnergy} onChange={setSlider(setActivationEnergy)} />
          </label>
          <label className="reaction-rate-toggle">
            <input type="checkbox" checked={catalyst} onChange={(event) => {
              setCatalyst(event.target.checked);
              setTime(0);
              setObservation(null);
            }} />
            <span>{chemText(locale, 'Add Catalyst', '加入催化剂')}</span>
            <strong>Ea -20 kJ/mol</strong>
          </label>
          <div className="reaction-rate-actions">
            <button type="button" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{chemText(locale, (isPlaying ? 'Pause' : 'Play'), (isPlaying ? '暂停' : '播放'))}</button>
            <GhostButton onClick={reset}><Icon name="lucide:rotate-ccw" />{chemText(locale, 'Reset', '重置')}</GhostButton>
          </div>
        </aside>

        <div className="reaction-rate-stage">
          <div className="reaction-particle-panel" aria-label={chemText(locale, 'Particle reaction animation', '粒子反应动画')}>
            <div className="reaction-equation-chip">A → B</div>
            {REACTION_RATE_PARTICLES.map((particle, index) => {
              const isA = index < aCount;
              return (
                <span
                  key={particle.id}
                  className={`reaction-particle ${isA ? 'reactant' : 'product'}`}
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    animationDuration: `${particleDuration}s`,
                    animationDelay: `${particle.delay}s`
                  }}
                >
                  {isA ? 'A' : 'B'}
                </span>
              );
            })}
          </div>
          <svg className="reaction-rate-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={chemText(locale, 'Concentration over time chart', '浓度随时间变化曲线')}>
            <line x1={chart.left} y1={chart.bottom} x2={chart.right} y2={chart.bottom} className="axis" />
            <line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.bottom} className="axis" />
            {[0.4, 0.8, 1.2, 1.6].map((value) => {
              const y = chart.bottom - (value / 1.6) * (chart.bottom - chart.top);
              return <line key={value} x1={chart.left} x2={chart.right} y1={y} y2={y} className="grid" />;
            })}
            <path d={aPath} className="curve reactant" />
            <path d={bPath} className="curve product" />
            <line x1={currentX} x2={currentX} y1={chart.top} y2={chart.bottom} className="time-marker" />
            <circle cx={currentX} cy={clampNumber(currentAY, chart.top, chart.bottom)} r="5" className="dot reactant" />
            <circle cx={currentX} cy={clampNumber(currentBY, chart.top, chart.bottom)} r="5" className="dot product" />
            <text x={chart.left - 30} y={chart.top + 5} className="axis-label">1.6</text>
            <text x={chart.left - 24} y={chart.bottom + 4} className="axis-label">0</text>
            <text x={(chart.left + chart.right) / 2 - 24} y={chart.bottom + 32} className="axis-label">{chemText(locale, 'Time / s', '时间 / s')}</text>
            <text x={chart.left - 38} y={(chart.top + chart.bottom) / 2} className="axis-label rotate">{chemText(locale, 'Concentration', '浓度')}</text>
            <text x={chart.right - 78} y={chart.top + 12} className="legend reactant">[A]</text>
            <text x={chart.right - 38} y={chart.top + 12} className="legend product">[B]</text>
          </svg>
        </div>

        <aside className="reaction-rate-metrics">
          <article><span>{chemText(locale, 'Rate Constant k', '速率常数 k')}</span><strong>{state.k.toFixed(3)} s⁻¹</strong></article>
          <article><span>{chemText(locale, 'Initial Rate v0', '初始速率 v₀')}</span><strong>{state.initialRate.toFixed(3)} mol/(L·s)</strong></article>
          <article><span>{chemText(locale, 'Half-Life t1/2', '半衰期 t₁/₂')}</span><strong>{state.halfLife.toFixed(2)} s</strong></article>
          <article><span>{chemText(locale, 'Current [A]', '当前 [A]')}</span><strong>{state.concentrationA.toFixed(3)} mol/L</strong></article>
          <article><span>{chemText(locale, 'Current [B]', '当前 [B]')}</span><strong>{state.concentrationB.toFixed(3)} mol/L</strong></article>
          <article><span>{chemText(locale, 'Instantaneous Rate v', '瞬时速率 v')}</span><strong>{state.rate.toFixed(3)} mol/(L·s)</strong></article>
        </aside>
      </section>

      <section className="reaction-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Change one variable, then decide whether the statement is true.', '调一个变量，再判断结论是否成立。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observationChecks.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observationChecks.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support reaction-rate-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$v=k[A]$'} /></p>
          <p><MathContent text={'$[A](t)=[A]_0e^{-kt}$'} /></p>
          <p><MathContent text={'$t_{1/2}=\\frac{\\ln2}{k}$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Model Notes', '模型说明')}</h2>
          <p>{chemText(locale, 'This page uses an approximate first-order reaction model for A → B. Temperature and activation energy affect k with an Arrhenius-style relationship; the catalyst only lowers Ea and does not change the final amount of product.', '本页使用一级反应 A → B 近似模型。温度和活化能用 Arrhenius 风格关系影响 k，催化剂只降低 Ea，不改变最终产物总量。')}</p>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryRedoxCellSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [cellId, setCellId] = useState(REDOX_CELL_OPTIONS[0].id);
  const [showLabels, setShowLabels] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(3);
  const [observation, setObservation] = useState<string | null>(null);

  const cell = REDOX_CELL_OPTIONS.find((item) => item.id === cellId) ?? REDOX_CELL_OPTIONS[0];
  const voltage = cell.cathode.potential - cell.anode.potential;
  const electronDuration = `${clampNumber(6 - speed, 1.4, 5)}s`;
  const electronStyle = {
    '--electron-duration': electronDuration,
    animationPlayState: isPlaying ? 'running' : 'paused'
  } as CSSProperties;

  const chooseCell = (nextId: string) => {
    setCellId(nextId);
    setObservation(null);
  };

  const observations = [
    {
      id: 'anode',
      label: chemText(locale, 'Which electrode loses electrons?', `哪一极失电子？`),
      feedback: chemText(locale, `${cell.anode.metal} is oxidized at the anode: ${cell.anodeHalf}.`, `${cell.anode.metal} 电极发生氧化反应，是阳极：${cell.anodeHalf}。`)
    },
    {
      id: 'flow',
      label: chemText(locale, 'Which direction do electrons flow?', '电子从哪边流向哪边？'),
      feedback: chemText(locale, `Electrons flow through the external circuit from the ${cell.anode.metal} anode to the ${cell.cathode.metal} cathode.`, `电子沿外电路从阳极 ${cell.anode.metal} 流向阴极 ${cell.cathode.metal}。`)
    },
    {
      id: 'potential',
      label: chemText(locale, 'What happens at the electrode with higher potential?', '电势更大的电极发生什么？'),
      feedback: chemText(locale, `${cell.cathode.metal} has the higher standard reduction potential, so reduction occurs: ${cell.cathodeHalf}.`, `${cell.cathode.metal} 电极标准还原电势更大，发生还原反应：${cell.cathodeHalf}。`)
    }
  ];

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page redox-cell-page">
      <section className="special-visualizer-hero redox-cell-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Redox Cell Simulator', '首页 / 化学 / 公式 / 氧化还原反应与原电池模拟')}</p>
          <h1>{chemText(locale, 'Redox Reaction and Galvanic Cell Simulator', '氧化还原反应与原电池模拟')}</h1>
          <p className="page-body">{chemText(locale, 'Choose electrode pairs and connect anode oxidation, cathode reduction, electron flow, and standard cell potential.', '选择电极组合，观察阳极氧化、阴极还原、电子流向和标准电池电动势如何对应。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Galvanic cell simulation details', '原电池模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{voltage.toFixed(2)}</b> V</span>
        </div>
      </section>

      <section className="special-visualizer-card redox-cell-card">
        <aside className="redox-cell-controls">
          <div className="redox-cell-conclusion">
            <span>{chemText(locale, 'Current Finding', '当前结论')}</span>
            <strong>{chemText(locale, `${cell.anode.metal} is oxidized at the anode; ${cell.cathode.ion} is reduced, and electrons flow toward ${cell.cathode.metal}.`, `${cell.anode.metal} 被氧化，是阳极；${cell.cathode.ion} 被还原，电子流向 ${cell.cathode.metal}。`)}</strong>
          </div>
          <div className="redox-cell-picker" aria-label={chemText(locale, 'Cell type', '电池类型')}>
            {REDOX_CELL_OPTIONS.map((option) => {
              const optionVoltage = option.cathode.potential - option.anode.potential;
              return (
                <button type="button" key={option.id} className={option.id === cell.id ? 'active' : ''} onClick={() => chooseCell(option.id)}>
                  <span>{option.label}</span>
                  <strong>{optionVoltage.toFixed(2)} V</strong>
                </button>
              );
            })}
          </div>
          <label className="redox-toggle">
            <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            <span>{chemText(locale, 'Show Labels', '显示标签')}</span>
          </label>
          <label className="redox-speed-control">
            <span>{chemText(locale, 'Animation Speed', '动画速度')}</span>
            <strong>{speed}</strong>
            <input type="range" min="1" max="5" step="1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
          <div className="redox-actions">
            <button type="button" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{chemText(locale, (isPlaying ? 'Pause' : 'Play'), (isPlaying ? '暂停' : '播放'))}</button>
            <GhostButton onClick={() => {
              setCellId(REDOX_CELL_OPTIONS[0].id);
              setSpeed(3);
              setShowLabels(true);
              setObservation(null);
            }}><Icon name="lucide:rotate-ccw" />{chemText(locale, 'Reset', '重置')}</GhostButton>
          </div>
        </aside>

        <div className="redox-cell-stage">
          <svg className="redox-cell-svg" viewBox="0 0 760 480" role="img" aria-label={chemText(locale, `${cell.label} galvanic cell diagram`, `${cell.label} 原电池示意图`)}>
            <defs>
              <linearGradient id="redox-solution" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#dbeafe" />
                <stop offset="100%" stopColor="#bfdbfe" />
              </linearGradient>
            </defs>
            <path d="M176 160 H584" className="wire" />
            <path d="M176 160 V245" className="wire" />
            <path d="M584 160 V245" className="wire" />
            <circle cx="380" cy="140" r="42" className="voltmeter" />
            <text x="380" y="132" className="meter-v">V</text>
            <text x="380" y="153" className="meter-value">{voltage.toFixed(2)} V</text>
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <circle key={dot} r="5" className="electron" style={electronStyle}>
                <animateMotion dur={electronDuration} repeatCount="indefinite" begin={`${dot * 0.28}s`} path="M176 160 H584" />
              </circle>
            ))}
            <text x="362" y="178" className="electron-label">e⁻</text>
            <path d="M310 315 V230 Q310 212 328 212 H432 Q450 212 450 230 V315" className="salt-bridge" />
            {showLabels && <text x="380" y="205" className="salt-label">{chemText(locale, 'Salt bridge', '盐桥')}</text>}
            {[330, 368, 406, 442].map((x, index) => (
              <circle key={x} cx={x} cy={216 + (index % 2) * 8} r="4" className={index % 2 ? 'salt-ion neg' : 'salt-ion pos'} />
            ))}

            <g className="beaker left">
              <path d="M88 286 H292 V390 Q292 404 278 404 H102 Q88 404 88 390 Z" className="beaker-glass" />
              <path d="M90 300 H290 V390 Q290 402 278 402 H102 Q90 402 90 390 Z" className="solution" />
              <rect x="162" y="218" width="28" height="146" rx="7" fill={cell.anode.color} className="electrode" />
              <text x="176" y="380" className="solution-label">{cell.anode.solution}</text>
              <text x="176" y="382" className="metal-label">{cell.anode.metal}</text>
              {showLabels && <text x="176" y="210" className="anode-label">{chemText(locale, 'Anode (-) oxidation', '阳极 (-) 氧化')}</text>}
              {[0, 1, 2, 3, 4, 5].map((point) => <circle key={point} cx={132 + point * 9} cy={306 + (point % 3) * 8} r="5" className="oxidation-bubble" />)}
              {[0, 1, 2, 3, 4].map((point) => <circle key={point} cx={118 + point * 42} cy={342 + (point % 2) * 24} r="4" className="solution-ion blue" />)}
            </g>

            <g className="beaker right">
              <path d="M468 286 H672 V390 Q672 404 658 404 H482 Q468 404 468 390 Z" className="beaker-glass" />
              <path d="M470 300 H670 V390 Q670 402 658 402 H482 Q470 402 470 390 Z" className="solution" />
              <rect x="570" y="218" width="28" height="146" rx="7" fill={cell.cathode.color} className="electrode" />
              <text x="584" y="380" className="solution-label">{cell.cathode.solution}</text>
              <text x="584" y="382" className="metal-label">{cell.cathode.metal}</text>
              {showLabels && <text x="584" y="210" className="cathode-label">{chemText(locale, 'Cathode (+) reduction', '阴极 (+) 还原')}</text>}
              {[0, 1, 2, 3, 4, 5].map((point) => <circle key={point} cx={532 + point * 11} cy={334 + (point % 3) * 10} r="5" className="reduction-bubble" />)}
              {[0, 1, 2, 3, 4].map((point) => <circle key={point} cx={496 + point * 38} cy={330 + (point % 2) * 28} r="4" className="solution-ion blue" />)}
            </g>
          </svg>
        </div>

        <aside className="redox-cell-analysis">
          <article className="redox-voltage-card">
            <span>{chemText(locale, 'Standard Cell Potential', '标准电池电动势')}</span>
            <strong>{voltage.toFixed(2)} V</strong>
            <p>E°cell = {cell.cathode.potential.toFixed(2)} - ({cell.anode.potential.toFixed(2)})</p>
          </article>
          <article>
            <span>{chemText(locale, 'Anode: Oxidation', '阳极：氧化')}</span>
            <strong>{cell.anodeHalf}</strong>
          </article>
          <article>
            <span>{chemText(locale, 'Cathode: Reduction', '阴极：还原')}</span>
            <strong>{cell.cathodeHalf}</strong>
          </article>
          <article>
            <span>{chemText(locale, 'Overall Reaction', '总反应')}</span>
            <strong>{cell.totalReaction}</strong>
          </article>
          <article>
            <span>{chemText(locale, 'Cell Notation', '电池符号')}</span>
            <strong>{cell.cellNotation}</strong>
          </article>
          <article className="redox-oxidation-card">
            <span>{chemText(locale, 'Oxidation Number Changes', '氧化数变化')}</span>
            <div><b>{cell.oxidationChange}</b><b>{cell.reductionChange}</b></div>
          </article>
        </aside>
      </section>

      <section className="reaction-observation-panel redox-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Connect the cell diagram with redox reasoning.', '把原电池图和氧化还原判断对应起来。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support redox-cell-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formula', '核心公式')}</h2>
          <p><MathContent text={'$E^\\circ_{cell}=E^\\circ_{cathode}-E^\\circ_{anode}$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/chemistry-redox`)}>
            {chemText(locale, 'Redox Reactions', '氧化还原反应')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryPhTitrationSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [acidId, setAcidId] = useState<TitrationAcidId>('hcl');
  const [acidConcentration, setAcidConcentration] = useState(0.1);
  const [acidVolume, setAcidVolume] = useState(50);
  const [baseConcentration, setBaseConcentration] = useState(0.1);
  const [baseVolume, setBaseVolume] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [observation, setObservation] = useState<string | null>(null);

  const acid = TITRATION_ACIDS.find((item) => item.id === acidId) ?? TITRATION_ACIDS[0];
  const state = useMemo(
    () => getTitrationState(acid, acidConcentration, acidVolume, baseConcentration, baseVolume),
    [acid, acidConcentration, acidVolume, baseConcentration, baseVolume]
  );
  const curve = useMemo(
    () => titrationPhCurvePath(acid, acidConcentration, acidVolume, baseConcentration),
    [acid, acidConcentration, acidVolume, baseConcentration]
  );
  const currentX = curve.xForVolume(baseVolume);
  const currentY = curve.yForPh(state.ph);
  const equivalenceX = curve.xForVolume(clampNumber(state.equivalenceVolumeMl, 0, curve.maxVolume));
  const solutionTone = state.ph < 6.5 ? 'acidic' : state.ph > 7.5 ? 'basic' : 'neutral';
  const phPercent = (state.ph / 14) * 100;

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setBaseVolume((value) => {
        const next = value + 0.8;
        if (next >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const reset = () => {
    setBaseVolume(0);
    setIsPlaying(false);
    setObservation(null);
  };

  const updateNumber = (setter: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(Number(event.target.value));
    setBaseVolume(0);
    setIsPlaying(false);
    setObservation(null);
  };
  const acidStrength = chemText(locale, (acid.strength === 'strong' ? 'Strong acid' : 'Weak acid'), (acid.strength === 'strong' ? '强酸' : '弱酸'));
  const phTone = chemText(locale, (state.ph < 6.5 ? 'Acidic' : state.ph > 7.5 ? 'Basic' : 'Neutral'), (state.ph < 6.5 ? '酸性' : state.ph > 7.5 ? '碱性' : '中性'));
  const titrationStage = chemText(locale, baseVolume <= 0 ? (acid.strength === 'strong' ? 'Initial strong acid region' : 'Initial weak acid region')
      : Math.abs(state.baseMoles - state.acidMoles) < Math.max(state.acidMoles * 0.002, 1e-7) ? 'Equivalence point'
      : state.baseMoles > state.acidMoles ? 'Base in excess'
      : acid.strength === 'weak' && Math.abs(baseVolume - state.equivalenceVolumeMl / 2) < Math.max(state.equivalenceVolumeMl * 0.025, 0.5) ? 'Half-equivalence point'
      : acid.strength === 'weak' ? 'Buffer region'
      : 'Acid in excess', state.stage);
  const titrationDetail = chemText(locale, acid.strength === 'strong'
      ? state.baseMoles >= state.acidMoles ? 'Near or beyond equivalence, pH is controlled by neutralization and any excess OH-.' : 'H+ remains in excess, so the solution stays acidic.'
      : state.baseMoles <= 0 ? 'A weak acid only partially ionizes, so its initial pH is higher than a strong acid at the same concentration.'
      : state.baseMoles < state.acidMoles ? 'Weak acid and conjugate base coexist, so the Henderson-Hasselbalch approximation applies.'
      : 'After equivalence, pH is mainly determined by excess OH-.', state.detail);

  const observations = [
    {
      id: 'equivalence',
      label: chemText(locale, 'Is the strong acid-strong base equivalence point pH equal to 7?', '强酸强碱等量点 pH 是否等于 7？'),
      feedback: chemText(locale, acid.id === 'hcl' ? 'Yes. HCl and NaOH fully neutralize, so the equivalence point is approximately pH = 7.' : 'That conclusion only applies to strong acid-strong base titrations. A weak acid-strong base equivalence point is usually above pH 7.', acid.id === 'hcl' ? '是。HCl 与 NaOH 完全中和，等量点近似 pH = 7。' : '这个结论只适用于强酸强碱。弱酸强碱等量点通常 pH > 7。')
    },
    {
      id: 'half',
      label: chemText(locale, 'What is special about the half-equivalence point of a weak acid?', '弱酸半等量点有什么特征？'),
      feedback: chemText(locale, acid.id === 'acetic' ? 'At half-equivalence, [A-] = [HA], so pH = pKa.' : 'Switch to CH3COOH to observe that the half-equivalence point has pH = pKa.', acid.id === 'acetic' ? '半等量点时 [A⁻]=[HA]，所以 pH = pKa。' : '切换到 CH₃COOH 可以观察半等量点 pH = pKa。')
    },
    {
      id: 'jump',
      label: chemText(locale, 'Where does pH change most sharply?', '哪里 pH 变化最剧烈？'),
      feedback: chemText(locale, `The pH jump is most obvious near the equivalence point; the current equivalence volume is about ${state.equivalenceVolumeMl.toFixed(1)} mL.`, `等量点附近 pH 跳变最明显；当前等量点约为 ${state.equivalenceVolumeMl.toFixed(1)} mL。`)
    }
  ];

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page ph-titration-page">
      <section className="special-visualizer-hero ph-titration-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Solution and pH Simulator', '首页 / 化学 / 公式 / 溶液与 pH 交互模拟')}</p>
          <h1>{chemText(locale, 'Solution and pH Titration Simulator', '溶液与 pH 交互模拟')}</h1>
          <p className="page-body">{chemText(locale, 'Compare pH curves for strong and weak acids titrated with NaOH, and observe half-equivalence, equivalence, and base-excess regions.', '比较强酸和弱酸被 NaOH 滴定时的 pH 曲线，观察半等量点、等量点和碱过量阶段。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'pH titration simulation details', 'pH 滴定模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{state.ph.toFixed(2)}</b> pH</span>
        </div>
      </section>

      <section className="special-visualizer-card ph-titration-card">
        <aside className="ph-titration-controls">
          <div className="ph-stage-card">
            <span>{chemText(locale, 'Current Stage', '当前阶段')}</span>
            <strong>{titrationStage}</strong>
            <p>{titrationDetail}</p>
          </div>
          <div className="ph-acid-picker" aria-label={chemText(locale, 'Acid type', '酸类型')}>
            {TITRATION_ACIDS.map((item) => (
              <button type="button" key={item.id} className={item.id === acid.id ? 'active' : ''} onClick={() => {
                setAcidId(item.id);
                reset();
              }}>
                <span>{item.formula}</span>
                <strong>{chemText(locale, (item.id === 'hcl' ? 'Hydrochloric acid' : 'Acetic acid'), item.label)}</strong>
                <small>{chemText(locale, (item.strength === 'strong' ? 'Strong acid' : 'Weak acid'), (item.strength === 'strong' ? '强酸' : '弱酸'))}</small>
              </button>
            ))}
          </div>
          <label>
            <span>{chemText(locale, 'Acid Concentration', '酸浓度')}</span>
            <strong>{acidConcentration.toFixed(2)} mol/L</strong>
            <input type="range" min="0.05" max="0.3" step="0.01" value={acidConcentration} onChange={updateNumber(setAcidConcentration)} />
          </label>
          <label>
            <span>{chemText(locale, 'Acid Volume', '酸体积')}</span>
            <strong>{acidVolume.toFixed(0)} mL</strong>
            <input type="range" min="20" max="80" step="5" value={acidVolume} onChange={updateNumber(setAcidVolume)} />
          </label>
          <label>
            <span>{chemText(locale, 'NaOH Concentration', 'NaOH 浓度')}</span>
            <strong>{baseConcentration.toFixed(2)} mol/L</strong>
            <input type="range" min="0.05" max="0.3" step="0.01" value={baseConcentration} onChange={updateNumber(setBaseConcentration)} />
          </label>
          <label>
            <span>{chemText(locale, 'Added NaOH', '加入 NaOH')}</span>
            <strong>{baseVolume.toFixed(1)} mL</strong>
            <input type="range" min="0" max="100" step="0.5" value={baseVolume} onChange={(event) => {
              setBaseVolume(Number(event.target.value));
              setIsPlaying(false);
              setObservation(null);
            }} />
          </label>
          <div className="ph-titration-actions">
            <button type="button" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{chemText(locale, (isPlaying ? 'Pause' : 'Auto Titrate'), (isPlaying ? '暂停' : '自动滴定'))}</button>
            <GhostButton onClick={reset}><Icon name="lucide:rotate-ccw" />{chemText(locale, 'Reset', '重置')}</GhostButton>
          </div>
        </aside>

        <div className="ph-titration-stage">
          <div className="ph-lab-panel">
            <div className="ph-burette"><span>NaOH</span></div>
            <div className={`ph-beaker ${solutionTone}`}>
              <div className="ph-solution" style={{ height: `${58 + (baseVolume / 100) * 12}%` }} />
              <span>{acid.formula} + NaOH</span>
            </div>
            <div className="ph-meter">
              <span>{chemText(locale, 'pH Meter', 'pH 计')}</span>
              <strong>{state.ph.toFixed(2)}</strong>
              <div className="ph-mini-scale"><i style={{ left: `${phPercent}%` }} /></div>
              <b>{phTone}</b>
            </div>
          </div>
          <svg className="ph-titration-chart" viewBox={`0 0 ${curve.width} ${curve.height}`} role="img" aria-label={chemText(locale, 'pH titration curve', 'pH 滴定曲线')}>
            <line x1={curve.left} y1={curve.bottom} x2={curve.right} y2={curve.bottom} className="axis" />
            <line x1={curve.left} y1={curve.top} x2={curve.left} y2={curve.bottom} className="axis" />
            {[2, 4, 7, 10, 12, 14].map((ph) => <line key={ph} x1={curve.left} x2={curve.right} y1={curve.yForPh(ph)} y2={curve.yForPh(ph)} className={ph === 7 ? 'neutral grid' : 'grid'} />)}
            <line x1={equivalenceX} x2={equivalenceX} y1={curve.top} y2={curve.bottom} className="equivalence" />
            {acid.id === 'acetic' && <line x1={curve.xForVolume(state.equivalenceVolumeMl / 2)} x2={curve.xForVolume(state.equivalenceVolumeMl / 2)} y1={curve.top} y2={curve.bottom} className="half-equivalence" />}
            <path d={curve.path} className="curve" />
            <line x1={currentX} x2={currentX} y1={curve.top} y2={curve.bottom} className="time-marker" />
            <circle cx={currentX} cy={currentY} r="6" className="current-dot" />
            <text x={curve.left - 25} y={curve.top + 4} className="axis-label">14</text>
            <text x={curve.left - 18} y={curve.yForPh(7) + 4} className="axis-label">7</text>
            <text x={curve.left - 18} y={curve.bottom + 4} className="axis-label">0</text>
            <text x={(curve.left + curve.right) / 2 - 36} y={curve.bottom + 32} className="axis-label">NaOH / mL</text>
            <text x={curve.left - 34} y={(curve.top + curve.bottom) / 2} className="axis-label rotate">pH</text>
            <text x={equivalenceX - (chemText(locale, 32, 18))} y={curve.top - 7} className="equivalence-label">{chemText(locale, 'Equivalence', '等量点')}</text>
          </svg>
        </div>

        <aside className="ph-titration-metrics">
          <article><span>{chemText(locale, 'Current pH', '当前 pH')}</span><strong>{state.ph.toFixed(2)}</strong></article>
          <article><span>pOH</span><strong>{state.poh.toFixed(2)}</strong></article>
          <article><span>[H⁺]</span><strong>{state.hConcentration.toExponential(2)} mol/L</strong></article>
          <article><span>[OH⁻]</span><strong>{state.ohConcentration.toExponential(2)} mol/L</strong></article>
          <article><span>{chemText(locale, 'Equivalence Volume', '等量点体积')}</span><strong>{state.equivalenceVolumeMl.toFixed(1)} mL</strong></article>
          <article><span>{chemText(locale, 'Acid Type', '酸类型')}</span><strong>{acid.strength === 'strong' ? acidStrength : `${acidStrength} pKa ${(-Math.log10(acid.ka ?? 1.8e-5)).toFixed(2)}`}</strong></article>
        </aside>
      </section>

      <section className="reaction-observation-panel ph-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Switch between strong and weak acids to compare key curve points.', '切换强酸/弱酸，比较曲线关键点。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support ph-titration-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$pH=-\\log[H^+]$'} /></p>
          <p><MathContent text={'$K_w=[H^+][OH^-]=10^{-14}$'} /></p>
          <p><MathContent text={'$pH=pK_a+\\log\\frac{[A^-]}{[HA]}$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/chemistry-concentration-ph`)}>
            {chemText(locale, 'Solution Concentration and pH', '溶液浓度与 pH')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryAtomicPeriodicSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [selectedZ, setSelectedZ] = useState(11);
  const [trend, setTrend] = useState<AtomicTrend>('radius');
  const [showShells, setShowShells] = useState(true);
  const [animateElectrons, setAnimateElectrons] = useState(true);
  const [observation, setObservation] = useState<string | null>(null);
  const element = ATOMIC_ELEMENTS.find((item) => item.z === selectedZ) ?? ATOMIC_ELEMENTS[0];
  const trendMeta = ATOMIC_TRENDS[trend];
  const configuration = getElectronConfiguration(element.z);
  const orbitalFill = getOrbitalFill(element.z);
  const valenceElectrons = element.shells[element.shells.length - 1] ?? 0;
  const metricValue = trendValue(element, trend);
  const shellRadii = [52, 86, 120, 154];
  const shellNames = ['K', 'L', 'M', 'N'];
  const observations = [
    {
      id: 'shell',
      label: chemText(locale, 'Why does Na have only one outer-shell electron?', '为什么 Na 的最外层只有 1 个电子？'),
      feedback: chemText(locale, element.symbol === 'Na'
          ? 'Na has shell distribution 2,8,1, so the third shell has one valence electron and Na easily loses one electron to form Na+.'
          : `${element.symbol} has shell distribution ${element.shells.join(',')}, with ${valenceElectrons} valence electron${valenceElectrons === 1 ? '' : 's'}.`, element.symbol === 'Na'
          ? 'Na 的电子排布为 2,8,1，第三层只有 1 个价电子，所以容易失去 1 个电子形成 Na⁺。'
          : `当前 ${element.symbol} 的层排布是 ${element.shells.join(',')}，最外层有 ${valenceElectrons} 个电子。`)
    },
    {
      id: 'radius',
      label: chemText(locale, 'Why does radius decrease across a period?', '同周期半径为什么向右减小？'),
      feedback: chemText(locale, 'Elements in the same period have the same number of shells, but increasing nuclear charge attracts outer electrons more strongly, so atomic radius generally decreases.', '同一周期电子层数相同，但核电荷数增加，对外层电子吸引更强，所以原子半径总体减小。')
    },
    {
      id: 'noble',
      label: chemText(locale, 'Why are noble gases stable?', '稀有气体为什么稳定？'),
      feedback: chemText(locale, element.group === 18
          ? `${element.symbol} has a stable outer-shell structure, so its chemical reactivity is very low.`
          : 'Noble gases usually have filled outer shells; main-group elements often gain, lose, or share electrons to approach that stable structure.', element.group === 18
          ? `${element.symbol} 的最外层达到稳定结构，化学反应活性很低。`
          : '稀有气体最外层通常已填满；主族元素常通过得失或共用电子接近这种稳定结构。')
    }
  ];

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page atomic-periodic-page">
      <section className="special-visualizer-hero atomic-periodic-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Atomic Structure and Periodic Trends', '首页 / 化学 / 公式 / 原子结构与元素周期律')}</p>
          <h1>{chemText(locale, 'Atomic Structure and Periodic Trends', '原子结构与元素周期律交互演示')}</h1>
          <p className="page-body">{chemText(locale, 'Choose an element and watch shell distribution, electron configuration, and periodic trends update together.', '选择元素，观察电子层排布、电子构型和周期趋势如何同时变化。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Atomic structure simulation details', '原子结构模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{element.symbol}</b> Z={element.z}</span>
        </div>
      </section>

      <section className="special-visualizer-card atomic-periodic-card">
        <aside className="atomic-info-panel">
          <article className="atomic-element-card">
            <span className="atomic-number">{element.z}</span>
            <strong>{element.symbol}</strong>
            <b>{elementName(element, locale)}</b>
            <small>Z = {element.z}</small>
          </article>
          <div className="atomic-facts-grid">
            <span><small>{chemText(locale, 'Period', '周期')}</small><strong>{element.period}</strong></span>
            <span><small>{chemText(locale, 'Group', '族')}</small><strong>{element.group}</strong></span>
            <span><small>{chemText(locale, 'Radius', '半径')}</small><strong>{element.radius} pm</strong></span>
            <span><small>{chemText(locale, 'Mass', '质量')}</small><strong>{element.mass.toFixed(3)}</strong></span>
          </div>
          <article className="atomic-config-card">
            <h2><Icon name="lucide:settings" />{chemText(locale, 'Electron Configuration', '电子构型')}</h2>
            <code>{configuration}</code>
            {(element.symbol === 'Cr' || element.symbol === 'Cu') && <p>{chemText(locale, `${element.symbol} is a common exception: a half-filled or filled 3d subshell is more stable.`, `${element.symbol} 是常见例外：半满或全满 3d 亚层更稳定。`)}</p>}
          </article>
          <article className="atomic-principle-card">
            <h2><Icon name="lucide:search" />{chemText(locale, 'Key Principles', '重点原理')}</h2>
            <p>{chemText(locale, 'Aufbau principle: electrons fill lower-energy orbitals first.', '构造原理：电子优先填充能量较低的轨道。')}</p>
            <p>{chemText(locale, 'Pauli exclusion principle: each orbital holds at most two electrons.', '泡利不相容原理：每个轨道最多容纳 2 个电子。')}</p>
            <p>{chemText(locale, 'Hund rule: equal-energy orbitals fill singly before pairing.', '洪特规则：等能轨道先单独填充，再成对填充。')}</p>
          </article>
        </aside>

        <div className="atomic-main-panel">
          <div className="atomic-model-card">
            <div className="atomic-model-header">
              <div>
                <h2>{element.symbol} (Z={element.z})</h2>
                <p>{chemText(locale, `${elementName(element, locale)} · Period ${element.period} · Group ${element.group}`, `${element.name} · 第 ${element.period} 周期 · ${element.group} 族`)}</p>
              </div>
              <span>{element.shells.join(' / ')}</span>
            </div>
            <svg className="atomic-bohr-svg" viewBox="0 0 520 360" role="img" aria-label={chemText(locale, `${elementName(element, locale)} Bohr model`, `${element.name} 的玻尔模型`)}>
              <circle cx="260" cy="176" r="32" className="atomic-nucleus" />
              <text x="260" y="172" textAnchor="middle" className="atomic-nucleus-text">{element.z}p⁺</text>
              <text x="260" y="192" textAnchor="middle" className="atomic-nucleus-sub">{Math.round(element.mass - element.z)}n⁰</text>
              {showShells && element.shells.map((count, shellIndex) => (
                <g key={shellNames[shellIndex]}>
                  <circle cx="260" cy="176" r={shellRadii[shellIndex]} className="atomic-shell" />
                  <text x={268 + shellRadii[shellIndex] * 0.72} y={170 - shellRadii[shellIndex] * 0.72} className="atomic-shell-label">
                    n={shellIndex + 1} ({shellNames[shellIndex]})
                  </text>
                  {Array.from({ length: count }, (_, electronIndex) => {
                    const angle = (electronIndex / count) * Math.PI * 2 - Math.PI / 2 + shellIndex * 0.22;
                    const x = 260 + Math.cos(angle) * shellRadii[shellIndex];
                    const y = 176 + Math.sin(angle) * shellRadii[shellIndex];
                    return (
                      <circle
                        key={`${shellIndex}-${electronIndex}`}
                        cx={x}
                        cy={y}
                        r="6"
                        className={animateElectrons ? 'atomic-electron animated' : 'atomic-electron'}
                        style={{ animationDelay: `${-(electronIndex * 0.18 + shellIndex * 0.3)}s` } as CSSProperties}
                      />
                    );
                  })}
                </g>
              ))}
              <text x="260" y="338" textAnchor="middle" className="atomic-config-label">{configuration}</text>
            </svg>
          </div>

          <div className="atomic-periodic-panel">
            <div className="atomic-periodic-title">
              <h2>{chemText(locale, `${trendLabel(trend, locale)} Trend`, `${trendMeta.label}趋势图`)}</h2>
              <span>{trendNote(trend, locale)}</span>
            </div>
            <div className="atomic-periodic-table" aria-label={chemText(locale, 'Periodic table', '元素周期表')}>
              {ATOMIC_ELEMENTS.map((item) => (
                <button
                  type="button"
                  key={item.z}
                  className={item.z === element.z ? 'active' : ''}
                  style={{ gridColumn: item.group, gridRow: item.period, background: trendColor(item, trend) }}
                  onClick={() => {
                    setSelectedZ(item.z);
                    setObservation(null);
                  }}
                  aria-label={`${elementName(item, locale)} ${item.symbol}`}
                >
                  <small>{item.z}</small>
                  <strong>{item.symbol}</strong>
                  <span>{trendValue(item, trend) === null ? '-' : trendValue(item, trend)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="atomic-control-panel">
          <article className="atomic-trend-card">
            <span>{chemText(locale, 'Current Trend', '当前趋势')}</span>
            <strong>{trendLabel(trend, locale)}</strong>
            <p>{metricValue === null ? (chemText(locale, 'Usually not compared', '通常不比较')) : `${metricValue} ${trendMeta.unit}`}</p>
          </article>
          <label>
            <span>{chemText(locale, 'Select Element', '选择元素')}</span>
            <strong>{element.symbol} ({element.z})</strong>
            <input type="range" min="1" max="36" step="1" value={selectedZ} onChange={(event) => {
              setSelectedZ(Number(event.target.value));
              setObservation(null);
            }} />
          </label>
          <label>
            <span>{chemText(locale, 'Periodic Trend', '周期性趋势')}</span>
            <select value={trend} onChange={(event) => setTrend(event.target.value as AtomicTrend)}>
              <option value="radius">{chemText(locale, 'Atomic Radius', '原子半径')}</option>
              <option value="electronegativity">{chemText(locale, 'Electronegativity', '电负性')}</option>
              <option value="ionization">{chemText(locale, 'First Ionization Energy', '第一电离能')}</option>
            </select>
          </label>
          <label className="atomic-toggle">
            <input type="checkbox" checked={showShells} onChange={(event) => setShowShells(event.target.checked)} />
            <span>{chemText(locale, 'Show Shells', '显示电子层')}</span>
          </label>
          <label className="atomic-toggle">
            <input type="checkbox" checked={animateElectrons} onChange={(event) => setAnimateElectrons(event.target.checked)} />
            <span>{chemText(locale, 'Animate Electrons', '电子动画')}</span>
          </label>
          <article className="atomic-insight-card">
            <span>{chemText(locale, 'Trend Hint', '规律提示')}</span>
            <p>{atomicTrendInsight(element, trend, locale)}</p>
          </article>
          <article className="atomic-orbital-card">
            <h2>{chemText(locale, 'Orbital Filling', '轨道填充')}</h2>
            {orbitalFill.map((orbital) => (
              <div key={orbital.label}>
                <span>{orbital.label}</span>
                <i><b style={{ width: `${(orbital.electrons / orbital.capacity) * 100}%` }} /></i>
                <strong>{orbital.electrons}/{orbital.capacity}</strong>
              </div>
            ))}
          </article>
        </aside>
      </section>

      <section className="reaction-observation-panel atomic-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Use the current element to explain structure and periodic trends.', '用当前元素解释结构与周期律。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support atomic-periodic-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$E_n=-13.6\\frac{Z^2}{n^2}\\ \\mathrm{eV}$'} /></p>
          <p><MathContent text={chemText(locale, '$Z=\\text{proton number}=\\text{atomic number}$', '$Z=\\text{质子数}=\\text{原子序数}$')} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/chemistry-atom-periodic`)}>
            {chemText(locale, 'Atomic Structure and Periodic Trends', '原子结构与元素周期律')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Formulas', '查看公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryBondingStructureSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [moleculeId, setMoleculeId] = useState('h2o');
  const [showElectrons, setShowElectrons] = useState(true);
  const [showDipoles, setShowDipoles] = useState(true);
  const [observation, setObservation] = useState<string | null>(null);
  const molecule = BONDING_MOLECULES.find((item) => item.id === moleculeId) ?? BONDING_MOLECULES[0];
  const { atomA, atomB, delta } = getBondingDelta(molecule);
  const calculatedKind = bondCategoryFromDelta(delta);
  const kindMeta = BONDING_KIND_META[calculatedKind];
  const observations = [
    {
      id: 'delta',
      label: chemText(locale, `What determines the bond type in ${molecule.formula}?`, `${molecule.formula} 的键类型由什么决定？`),
      feedback: chemText(locale, `Compare electronegativity first: ${atomA.label}=${atomA.en.toFixed(2)}, ${atomB.label}=${atomB.en.toFixed(2)}, ΔEN=${delta.toFixed(2)}, so this is classified as a ${bondingKindLabel(calculatedKind, locale).toLowerCase()}.`, `先比较电负性：${atomA.label}=${atomA.en.toFixed(2)}，${atomB.label}=${atomB.en.toFixed(2)}，ΔEN=${delta.toFixed(2)}，所以判断为${kindMeta.label}。`)
    },
    {
      id: 'polarity',
      label: chemText(locale, 'Does a polar bond always make a polar molecule?', '有极性键就一定是极性分子吗？'),
      feedback: chemText(locale, molecule.id === 'co2'
          ? 'Not always. CO2 has polar C=O bonds, but its symmetric linear structure makes the two bond dipoles cancel, so the molecule is nonpolar.'
          : `${molecule.formula} is ${moleculePolarity(molecule, locale).toLowerCase()}: ${moleculeSummary(molecule, locale)}`, molecule.id === 'co2'
          ? '不一定。CO₂ 的 C=O 键有极性，但线形结构对称，两个键偶极相互抵消，所以分子非极性。'
          : `${molecule.formula} 的分子极性结论是${molecule.polarity}：${molecule.summary}`)
    },
    {
      id: 'vsepr',
      label: chemText(locale, 'How do lone pairs affect shape?', '孤对电子如何影响形状？'),
      feedback: chemText(locale, molecule.lonePairCount > 0
          ? `${molecule.formula} has ${molecule.lonePairCount} lone-pair domain${molecule.lonePairCount === 1 ? '' : 's'} near the central atom, which compresses bonding pairs and gives a ${moleculeShape(molecule, locale).toLowerCase()} shape.`
          : `${molecule.formula} has no lone pair on the central atom; its shape is mainly determined by ${molecule.bondPairs} bonding electron domain${molecule.bondPairs === 1 ? '' : 's'}.`, molecule.lonePairCount > 0
          ? `${molecule.formula} 中中心原子附近有 ${molecule.lonePairCount} 组孤对电子，会挤压成键电子对，使形状呈${molecule.shape}。`
          : `${molecule.formula} 中中心原子没有孤对电子，形状主要由 ${molecule.bondPairs} 组键合电子域决定。`)
    }
  ];

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page bonding-structure-page">
      <section className="special-visualizer-hero bonding-structure-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Chemical Bonding and Molecular Structure', '首页 / 化学 / 公式 / 化学键与分子结构')}</p>
          <h1>{chemText(locale, 'Chemical Bonding and Molecular Structure', '化学键与分子结构交互演示')}</h1>
          <p className="page-body">{chemText(locale, 'Use electronegativity difference to classify bonds, then use Lewis structures and VSEPR to reason about shape and polarity.', '从电负性差判断键类型，再用 Lewis 结构和 VSEPR 判断分子形状与极性。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Chemical bonding simulation details', '化学键模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{delta.toFixed(2)}</b> ΔEN</span>
        </div>
      </section>

      <section className="special-visualizer-card bonding-structure-card">
        <aside className="bonding-control-panel">
          <article className={`bonding-kind-card ${kindMeta.tone}`}>
            <span>{chemText(locale, 'Bond Type', '键类型')}</span>
            <strong>{bondingKindLabel(calculatedKind, locale)}</strong>
            <p>{kindMeta.range}</p>
          </article>
          <label>
            <span>{chemText(locale, 'Select Molecule / Compound', '选择分子 / 化合物')}</span>
            <select value={molecule.id} onChange={(event) => {
              setMoleculeId(event.target.value);
              setObservation(null);
            }}>
              {BONDING_MOLECULES.map((item) => <option key={item.id} value={item.id}>{chemText(locale, `${item.formula} (${moleculeName(item, locale)})`, `${item.formula}（${item.name}）`)}</option>)}
            </select>
          </label>
          <div className="bonding-molecule-picker">
            {BONDING_MOLECULES.map((item) => (
              <button type="button" key={item.id} className={item.id === molecule.id ? 'active' : ''} onClick={() => {
                setMoleculeId(item.id);
                setObservation(null);
              }}>
                <strong>{item.formula}</strong>
                <span>{bondingKindLabel(item.kind, locale)}</span>
              </button>
            ))}
          </div>
          <label className="bonding-toggle">
            <input type="checkbox" checked={showElectrons} onChange={(event) => setShowElectrons(event.target.checked)} />
            <span>{chemText(locale, 'Show Electron Dots', '显示电子点')}</span>
          </label>
          <label className="bonding-toggle">
            <input type="checkbox" checked={showDipoles} onChange={(event) => setShowDipoles(event.target.checked)} />
            <span>{chemText(locale, 'Show Electronegativity / Dipoles', '显示电负性 / 偶极')}</span>
          </label>
          <article className="bonding-rule-card">
            <h2><Icon name="lucide:sigma" />{chemText(locale, 'Classification Rules', '分类规则')}</h2>
            <p><MathContent text={'$\\Delta EN=|EN_A-EN_B|$'} /></p>
            <span>{chemText(locale, 'ΔEN < 0.4: nonpolar covalent bond', 'ΔEN < 0.4：非极性共价键')}</span>
            <span>{chemText(locale, '0.4 - 1.7: polar covalent bond', '0.4 - 1.7：极性共价键')}</span>
            <span>{chemText(locale, 'ΔEN > 1.7: ionic bond', 'ΔEN > 1.7：离子键')}</span>
          </article>
        </aside>

        <div className="bonding-stage-panel">
          <div className="bonding-stage-header">
            <div>
              <h2>{molecule.formula} · {moleculeName(molecule, locale)}</h2>
              <p>{moleculeSummary(molecule, locale)}</p>
            </div>
            <span>{moleculeShape(molecule, locale)}</span>
          </div>
          <svg className="bonding-molecule-svg" viewBox="0 0 540 360" role="img" aria-label={chemText(locale, `${molecule.formula} molecular structure`, `${molecule.formula} 分子结构`)}>
            <defs>
              <marker id="bonding-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#315dff" />
              </marker>
            </defs>
            {molecule.bonds.map((bond, index) => {
              const from = atomById(molecule, bond.from);
              const to = atomById(molecule, bond.to);
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const length = Math.max(Math.hypot(dx, dy), 1);
              const offsetX = (-dy / length) * 5;
              const offsetY = (dx / length) * 5;
              const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-1, 1] : [-1.6, 0, 1.6];
              return (
                <g key={`${bond.from}-${bond.to}`}>
                  {offsets.map((offset) => (
                    <line
                      key={offset}
                      x1={from.x + offsetX * offset}
                      y1={from.y + offsetY * offset}
                      x2={to.x + offsetX * offset}
                      y2={to.y + offsetY * offset}
                      className={molecule.kind === 'ionic' ? 'bond ionic' : 'bond'}
                    />
                  ))}
                  {showElectrons && molecule.kind !== 'ionic' && (
                    <g className="bond-electron-pair">
                      <circle cx={(from.x + to.x) / 2 - offsetX * 1.2} cy={(from.y + to.y) / 2 - offsetY * 1.2} r="4" />
                      <circle cx={(from.x + to.x) / 2 + offsetX * 1.2} cy={(from.y + to.y) / 2 + offsetY * 1.2} r="4" />
                    </g>
                  )}
                  {molecule.kind === 'ionic' && <text x={(from.x + to.x) / 2 - 34} y={(from.y + to.y) / 2 + 48} className="bonding-transfer-label">{chemText(locale, 'Electron transfer / electrostatic attraction', '电子转移 / 静电吸引')}</text>}
                  {index === 0 && molecule.kind !== 'ionic' && <text x={(from.x + to.x) / 2 - 28} y={(from.y + to.y) / 2 + 44} className="bonding-transfer-label">{chemText(locale, 'Shared electron pair', '共用电子对')}</text>}
                </g>
              );
            })}
            {showDipoles && molecule.dipoles.map((dipole, index) => (
              <line key={index} x1={dipole.x1} y1={dipole.y1} x2={dipole.x2} y2={dipole.y2} className="bonding-dipole" markerEnd="url(#bonding-arrow)" />
            ))}
            {showElectrons && molecule.lonePairs.map((pair, index) => (
              <g key={index} className="bonding-lone-pair">
                <circle cx={pair.x - 5} cy={pair.y} r="4" />
                <circle cx={pair.x + 5} cy={pair.y} r="4" />
                {pair.label && <text x={pair.x + 12} y={pair.y + 4}>{pair.label}</text>}
              </g>
            ))}
            {molecule.atoms.map((atom) => (
              <g key={atom.id} className={`bonding-atom ${atom.tone}`}>
                <circle cx={atom.x} cy={atom.y} r={atom.label.length > 1 ? 34 : 30} />
                <text x={atom.x} y={atom.y + 7} textAnchor="middle">{atom.label}</text>
                {showDipoles && atom.charge && <text x={atom.x + 24} y={atom.y - 24} className="bonding-charge">{atom.charge}</text>}
                {showDipoles && <text x={atom.x - 27} y={atom.y + 48} className="bonding-en">EN {atom.en.toFixed(2)}</text>}
              </g>
            ))}
            {molecule.id === 'co2' && <text x="205" y="78" className="bonding-cancel-label">{chemText(locale, 'Opposite dipoles cancel', '偶极相反，互相抵消')}</text>}
          </svg>
        </div>

        <aside className="bonding-analysis-panel">
          <article>
            <span>{chemText(locale, 'Electronegativity Difference ΔEN', '电负性差 ΔEN')}</span>
            <strong>{delta.toFixed(2)}</strong>
            <p>{atomA.label} {atomA.en.toFixed(2)} vs {atomB.label} {atomB.en.toFixed(2)}</p>
          </article>
          <article>
            <span>{chemText(locale, 'Molecular Polarity', '分子极性')}</span>
            <strong>{moleculePolarity(molecule, locale)}</strong>
            <p>{chemText(locale, (molecule.polarity === '非极性' ? 'The charge distribution is overall symmetric, or the bonds are nearly nonpolar.' : molecule.polarity === '极性' ? 'The bond dipoles combine to produce a net dipole moment.' : 'The crystal forms through electrostatic attraction between cations and anions.'), (molecule.polarity === '非极性' ? '电荷分布整体对称或键几乎无极性。' : molecule.polarity === '极性' ? '键偶极合成后存在净偶极矩。' : '由阴阳离子静电作用形成晶体。'))}</p>
          </article>
          <article>
            <span>Lewis / VSEPR</span>
            <strong>{moleculeShape(molecule, locale)}</strong>
            <p>{chemText(locale, `Center: ${molecule.central === '无中心原子' ? 'none' : molecule.central === '离子对' ? 'ion pair' : molecule.central}; bonding domains ${molecule.bondPairs}, lone-pair domains ${molecule.lonePairCount}.`, `中心：${molecule.central}；键合电子域 ${molecule.bondPairs}，孤对电子域 ${molecule.lonePairCount}。`)}</p>
          </article>
          <article>
            <span>{chemText(locale, 'Electron-Domain Geometry', '电子域构型')}</span>
            <strong>{moleculeElectronGeometry(molecule, locale)}</strong>
            <p>{chemText(locale, 'Shape is determined by repulsion between electron domains around the central atom.', '形状由中心原子附近电子域之间的排斥决定。')}</p>
          </article>
        </aside>
      </section>

      <section className="reaction-observation-panel bonding-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Classify the bond first, then decide whether the whole molecule is polar.', '先判断键，再判断整个分子是否有极性。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support bonding-structure-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$\\Delta EN=|EN_A-EN_B|$'} /></p>
          <p><MathContent text={chemText(locale, '$\\text{molecular polarity}=\\text{bond polarity}+\\text{geometry}$', '$\\text{分子极性}=\\text{键极性}+\\text{空间构型}$')} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/visualize/atomic-periodic`)}>
            {chemText(locale, 'Atomic Structure and Periodic Trends', '原子结构与元素周期律')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryIonReactionSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [reactionId, setReactionId] = useState('agcl');
  const [mode, setMode] = useState<IonEquationMode>('molecular');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSpectators, setSelectedSpectators] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [observation, setObservation] = useState<string | null>(null);
  const reaction = ION_REACTIONS.find((item) => item.id === reactionId) ?? ION_REACTIONS[0];
  const spectatorChoices = splitIonLabels([
    ...reaction.spectatorIons,
    ...reaction.particles.filter((item) => item.role === 'reactive').map((item) => item.label)
  ]);
  const equation = mode === 'molecular' ? reaction.molecular : mode === 'complete' ? reaction.complete : reaction.net;
  const correctSpectators = selectedSpectators.length === reaction.spectatorIons.length
    && reaction.spectatorIons.every((ion) => selectedSpectators.includes(ion));
  const observations = [
    {
      id: 'split',
      label: chemText(locale, 'Which substances should split into ions?', '哪些物质要拆成离子？'),
      feedback: chemText(locale, 'Soluble strong electrolytes split into ions; precipitates, gases, water, and weak electrolytes do not.', '可溶的强电解质拆成离子；沉淀、气体、水、弱电解质不拆。')
    },
    {
      id: 'spectator',
      label: chemText(locale, 'How do you identify spectator ions?', '旁观离子怎么判断？'),
      feedback: chemText(locale, `In ${reaction.molecular}, ${reaction.spectatorIons.join(', ')} remain unchanged before and after the reaction, so they are spectator ions.`, `${reaction.molecular} 中，${reaction.spectatorIons.join('、')} 在反应前后不变，所以是旁观离子。`)
    },
    {
      id: 'net',
      label: chemText(locale, 'What remains in the net ionic equation?', '净离子方程式保留什么？'),
      feedback: chemText(locale, `Keep only the particles that actually react: ${reaction.net}.`, `只保留真正反应的粒子：${reaction.net}。`)
    }
  ];

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setTimeout(() => setIsPlaying(false), 1800);
    return () => window.clearTimeout(timer);
  }, [isPlaying, reaction.id]);

  const changeReaction = (id: string) => {
    setReactionId(id);
    setMode('molecular');
    setIsPlaying(false);
    setSelectedSpectators([]);
    setFeedback(null);
    setObservation(null);
  };

  const toggleSpectator = (ion: string) => {
    setSelectedSpectators((current) => current.includes(ion) ? current.filter((item) => item !== ion) : [...current, ion]);
    setFeedback(null);
  };

  const checkSpectators = () => {
    if (correctSpectators) {
      setFeedback(chemText(locale, `Correct. After removing ${reaction.spectatorIons.join(', ')}, you get: ${reaction.net}`, `正确。删去 ${reaction.spectatorIons.join('、')} 后，得到：${reaction.net}`));
      setMode('net');
      return;
    }
    const wrong = selectedSpectators.filter((ion) => !reaction.spectatorIons.includes(ion));
    const missing = reaction.spectatorIons.filter((ion) => !selectedSpectators.includes(ion));
    setFeedback(chemText(locale, `${wrong.length ? `${wrong.join(', ')} ${wrong.length === 1 ? 'is not a spectator ion. ' : 'are not spectator ions. '}` : ''}${missing.length ? `You still need to select ${missing.join(', ')}.` : ''}`, `${wrong.length ? `${wrong.join('、')} 不是旁观离子。` : ''}${missing.length ? `还需要选出 ${missing.join('、')}。` : ''}`));
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page ion-reaction-page">
      <section className="special-visualizer-hero ion-reaction-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Ionic Reactions', '首页 / 化学 / 公式 / 离子反应')}</p>
          <h1>{chemText(locale, 'Ionic Reaction Explorer', '离子反应交互演示')}</h1>
          <p className="page-body">{chemText(locale, 'Move from a molecular equation to a complete ionic equation, remove spectator ions, and reach the net ionic equation.', '从分子方程式拆到全离子方程式，点击删去旁观离子，得到净离子方程式。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Ionic reaction simulation details', '离子反应模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{reaction.spectatorIons.length}</b> {chemText(locale, 'spectator ions', '个旁观离子')}</span>
        </div>
      </section>

      <section className="special-visualizer-card ion-reaction-card">
        <aside className="ion-reaction-guide">
          <article className="ion-equation-card">
            <h2><Icon name="lucide:list-tree" />{chemText(locale, 'Three-Step Derivation', '三步推导')}</h2>
            {[
              ['molecular', chemText(locale, 'Molecular Equation', '化学方程式'), reaction.molecular],
              ['complete', chemText(locale, 'Complete Ionic Equation', '全离子方程式'), reaction.complete],
              ['net', chemText(locale, 'Net Ionic Equation', '净离子方程式'), reaction.net]
            ].map(([key, label, text]) => (
              <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key as IonEquationMode)}>
                <span>{label}</span>
                <strong>{text}</strong>
              </button>
            ))}
            <div className="ion-spectator-note">
              <span>{chemText(locale, 'Spectator Ions', '旁观离子')}</span>
              <strong>{reaction.spectatorIons.join('、')}</strong>
            </div>
          </article>
          <article className="ion-principle-card">
            <h2><Icon name="lucide:book-open" />{chemText(locale, 'Reaction Principle', '反应原理')}</h2>
            <p>{ionReactionPrinciple(reaction, locale)}</p>
          </article>
          <article className="ion-solubility-card">
            <h2><Icon name="lucide:search" />{chemText(locale, 'Solubility Rules', '溶解性规则')}</h2>
            {chemValue(locale, ION_SOLUBILITY_RULE_COPY).map((item) => (
              <div key={item.ion}>
                <span>{item.ion}</span>
                <strong className={item.tone}>{item.rule}</strong>
              </div>
            ))}
          </article>
        </aside>

        <div className="ion-reaction-stage">
          <div className="ion-stage-header">
            <div>
              <h2>{ionReactionLabel(reaction, locale)}</h2>
              <p>{equation}</p>
            </div>
            <span>{ionReactionProductKind(reaction, locale)}</span>
          </div>
          <svg className={isPlaying ? 'ion-reaction-svg playing' : 'ion-reaction-svg'} viewBox="0 0 680 420" role="img" aria-label={chemText(locale, `${ionReactionLabel(reaction, locale)} particle reaction diagram`, `${reaction.label} 粒子反应示意图`)}>
            <rect x="34" y="72" width="270" height="250" rx="22" className="ion-beaker left" />
            <rect x="376" y="72" width="270" height="250" rx="22" className="ion-beaker right" />
            <path d="M315 210 L365 210" className="ion-mix-arrow" />
            <text x="170" y="54" textAnchor="middle" className="ion-solution-label">{reaction.reactants[0]} {chemText(locale, 'solution', '溶液')}</text>
            <text x="510" y="54" textAnchor="middle" className="ion-solution-label">{reaction.reactants[1]} {chemText(locale, 'solution', '溶液')}</text>
            {reaction.particles.map((particle, index) => {
              const sideOffset = index < 2 ? 0 : 340;
              const cx = sideOffset + 30 + particle.x * 2.6;
              const cy = 76 + particle.y * 2.4;
              return (
                <g key={particle.id} className={`ion-particle ${particle.role} ${isPlaying && particle.role === 'reactive' ? 'reacting' : ''}`}>
                  <circle cx={cx} cy={cy} r="22" />
                  <text x={cx} y={cy + 5} textAnchor="middle">{particle.label}</text>
                </g>
              );
            })}
            <g className={isPlaying ? 'ion-product active' : 'ion-product'}>
              {reaction.productKind === '气体' ? (
                <>
                  <circle cx="342" cy="122" r="18" />
                  <circle cx="372" cy="88" r="12" />
                  <circle cx="392" cy="55" r="8" />
                </>
              ) : reaction.productKind === '水' ? (
                <path d="M316 258 C335 232 367 232 386 258 C367 284 335 284 316 258 Z" />
              ) : (
                <path d="M286 282 C318 250 374 250 406 282 L390 318 L302 318 Z" />
              )}
              <text x="346" y="348" textAnchor="middle">{reaction.productLabel}</text>
            </g>
            <text x="340" y="390" textAnchor="middle" className="ion-stage-caption">{chemText(locale, (isPlaying ? 'Reacting particles combine; spectator ions remain free in solution' : 'Play to observe the particles that actually react'), (isPlaying ? '反应粒子结合，旁观离子仍在溶液中游离' : '点击播放，观察真正反应的粒子'))}</text>
          </svg>
        </div>

        <aside className="ion-reaction-practice">
          <article className="ion-current-equation">
            <span>{chemText(locale, 'Current Equation', '当前方程式')}</span>
            <strong>{chemText(locale, (mode === 'molecular' ? 'Molecular Equation' : mode === 'complete' ? 'Complete Ionic Equation' : 'Net Ionic Equation'), (mode === 'molecular' ? '化学方程式' : mode === 'complete' ? '全离子方程式' : '净离子方程式'))}</strong>
            <p>{equation}</p>
          </article>
          <article className="ion-spectator-picker">
            <span>{chemText(locale, 'Select Spectator Ions to Remove', '选择要删去的旁观离子')}</span>
            <div>
              {spectatorChoices.map((ion) => (
                <button type="button" key={ion} className={selectedSpectators.includes(ion) ? 'active' : ''} onClick={() => toggleSpectator(ion)}>
                  {ion}
                </button>
              ))}
            </div>
            <button type="button" className="primary" onClick={checkSpectators}><Icon name="lucide:check" />{chemText(locale, 'Check Net Ionic', '检查净离子')}</button>
            {feedback && <p className={correctSpectators ? 'correct' : 'needs-work'}>{feedback}</p>}
          </article>
          <article className="ion-reaction-select">
            <span>{chemText(locale, 'Select Reaction', '选择反应')}</span>
            <select value={reaction.id} onChange={(event) => changeReaction(event.target.value)}>
              {ION_REACTIONS.map((item) => <option key={item.id} value={item.id}>{item.molecular}</option>)}
            </select>
          </article>
          <div className="ion-mode-tabs" aria-label={chemText(locale, 'Equation mode', '方程式模式')}>
            {[
              ['molecular', chemText(locale, 'Molecular', '化学式')],
              ['complete', chemText(locale, 'Complete Ionic', '全离子')],
              ['net', chemText(locale, 'Net Ionic', '净离子')]
            ].map(([key, label]) => (
              <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key as IonEquationMode)}>{label}</button>
            ))}
          </div>
          <button type="button" className="ion-play-button" onClick={() => setIsPlaying(true)}><Icon name="lucide:play" />{chemText(locale, 'Play Animation', '播放动画')}</button>
        </aside>
      </section>

      <section className="reaction-observation-panel ion-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Decide which particles actually change.', '判断哪些粒子真正发生变化。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support ion-reaction-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$Ag^+ + Cl^- \\rightarrow AgCl\\downarrow$'} /></p>
          <p><MathContent text={'$H^+ + OH^- \\rightarrow H_2O$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/visualize/ph-titration`)}>
            {chemText(locale, 'Solution and pH Simulator', '溶液与 pH 交互模拟')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

export function ChemistryOrganicHydrocarbonSimulatorView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const [family, setFamily] = useState<OrganicCategory>('alkane');
  const [functionalId, setFunctionalId] = useState('ethanol');
  const [carbonCount, setCarbonCount] = useState(3);
  const [bondPosition, setBondPosition] = useState(1);
  const [showStructure, setShowStructure] = useState(true);
  const [showReaction, setShowReaction] = useState(false);
  const [observation, setObservation] = useState<string | null>(null);
  const isFunctionalMode = family === 'functional';
  const hydrocarbonFamily = isFunctionalMode ? 'alkane' : family;
  const functionalExample = FUNCTIONAL_ORGANIC_EXAMPLES.find((item) => item.id === functionalId) ?? FUNCTIONAL_ORGANIC_EXAMPLES[0];
  const meta = HYDROCARBON_FAMILY_META[hydrocarbonFamily];
  const categoryMeta = ORGANIC_CATEGORY_META[family];
  const safeCarbonCount = Math.max(carbonCount, meta.minCarbon);
  const maxPosition = hydrocarbonFamily === 'alkane' ? 1 : maxMultipleBondPosition(safeCarbonCount);
  const safeBondPosition = Math.min(bondPosition, maxPosition);
  const hydrogenCount = hydrocarbonHydrogenCount(hydrocarbonFamily, safeCarbonCount);
  const formula = isFunctionalMode ? functionalExample.formula : hydrocarbonFormula(hydrocarbonFamily, safeCarbonCount);
  const condensed = isFunctionalMode ? functionalExample.condensed : hydrocarbonCondensedFormula(hydrocarbonFamily, safeCarbonCount, safeBondPosition);
  const compoundName = isFunctionalMode ? functionalName(functionalExample, locale) : hydrocarbonNameForLocale(hydrocarbonFamily, safeCarbonCount, safeBondPosition, locale);
  const molarMass = isFunctionalMode ? functionalExample.molarMass : safeCarbonCount * 12 + hydrogenCount;
  const hToC = isFunctionalMode ? (chemText(locale, 'Contains heteroatoms', '含杂原子')) : (hydrogenCount / safeCarbonCount).toFixed(2);
  const isomerInfo = isFunctionalMode
    ? { count: FUNCTIONAL_ORGANIC_EXAMPLES.length, examples: FUNCTIONAL_ORGANIC_EXAMPLES.map((item) => chemText(locale, `${functionalGroup(item, locale)}: ${functionalName(item, locale)}`, `${item.group}：${item.name}`)) }
    : hydrocarbonIsomerInfoForLocale(hydrocarbonFamily, safeCarbonCount, locale);
  const reactionEquation = isFunctionalMode ? functionalReaction(functionalExample, locale) : hydrocarbonReactionEquationForLocale(hydrocarbonFamily, safeCarbonCount, locale);
  const carbonSpacing = Math.min(70, 420 / Math.max(safeCarbonCount - 1, 1));
  const startX = 270 - ((safeCarbonCount - 1) * carbonSpacing) / 2;
  const carbonAtoms = Array.from({ length: safeCarbonCount }, (_, index) => ({
    x: startX + index * carbonSpacing,
    y: 178 + (showStructure && safeCarbonCount > 3 && index % 2 ? 16 : 0)
  }));
  const observations = [
    {
      id: 'hydrogen',
      label: isFunctionalMode
        ? (chemText(locale, `How does the ${functionalGroup(functionalExample, locale).toLowerCase()} group affect properties?`, `${functionalExample.group} 如何影响性质？`))
        : (chemText(locale, `Why does this ${hydrocarbonMetaLabel(hydrocarbonFamily, locale).toLowerCase()} have formula ${formula}?`, `${meta.label} 的氢数为什么是 ${formula}？`)),
      feedback: isFunctionalMode
        ? (chemText(locale, `${functionalName(functionalExample, locale)} contains the ${functionalGroup(functionalExample, locale).toLowerCase()} group (${functionalExample.groupFormula}). ${functionalNote(functionalExample, locale)}`, `${functionalExample.name} 含 ${functionalExample.group}（${functionalExample.groupFormula}）。${functionalExample.note}`))
        : chemText(locale, hydrocarbonFamily === 'alkane'
            ? 'In open-chain alkanes, all carbons use single bonds. Terminal carbons each carry 3 H atoms and internal carbons each carry 2 H atoms, giving CnH2n+2.'
            : hydrocarbonFamily === 'alkene'
              ? 'One C=C double bond means two fewer H atoms than the alkane with the same carbon count, giving CnH2n.'
              : 'One C≡C triple bond means four fewer H atoms than the alkane with the same carbon count, giving CnH2n-2.', hydrocarbonFamily === 'alkane'
            ? '开链烷烃所有碳都用单键连接，端位碳各带 3 个 H，中间碳各带 2 个 H，所以通式为 CₙH₂ₙ₊₂。'
            : hydrocarbonFamily === 'alkene'
              ? '一个 C=C 双键相当于比同碳数烷烃少 2 个 H，所以通式为 CₙH₂ₙ。'
              : '一个 C≡C 三键相当于比同碳数烷烃少 4 个 H，所以通式为 CₙH₂ₙ₋₂。')
    },
    {
      id: 'reaction',
      label: isFunctionalMode ? (chemText(locale, 'Which reactions are controlled by the functional group?', '官能团决定哪类反应？')) : (chemText(locale, 'Which hydrocarbons undergo addition more easily?', '哪类烃更容易发生加成？')),
      feedback: isFunctionalMode
        ? (chemText(locale, `Typical ${functionalFamily(functionalExample, locale).toLowerCase()} reaction: ${functionalReaction(functionalExample, locale)}.`, `${functionalExample.family} 的典型反应：${functionalExample.reaction}。`))
        : chemText(locale, hydrocarbonFamily === 'alkane'
            ? 'Alkanes are relatively stable; their typical reaction is light-driven substitution. Alkenes and alkynes contain multiple bonds, so they undergo addition more easily.'
            : `${hydrocarbonMetaLabel(hydrocarbonFamily, locale)} contain ${hydrocarbonBondLabel(hydrocarbonFamily, locale)}, and the pi bond opens relatively easily, so addition is typical.`, hydrocarbonFamily === 'alkane'
            ? '烷烃较稳定，典型反应是光照取代；烯烃和炔烃因含多重键，更容易发生加成。'
            : `${meta.label} 含 ${meta.bondLabel}，π 键较容易打开，因此典型反应是加成。`)
    },
    {
      id: 'isomer',
      label: chemText(locale, `How many common isomer ideas does ${formula} suggest?`, `${formula} 有多少种常见异构思路？`),
      feedback: chemText(locale, `${formula} currently has about ${isomerInfo.count} structural/position isomer idea${isomerInfo.count === 1 ? '' : 's'}. Examples: ${isomerInfo.examples.join('; ')}.`, `${formula} 当前估算结构异构体/位置异构体约 ${isomerInfo.count} 种。示例：${isomerInfo.examples.join('；')}。`)
    }
  ];

  useEffect(() => {
    if (family === 'functional') {
      setObservation(null);
      setShowReaction(false);
      return;
    }
    const min = HYDROCARBON_FAMILY_META[family].minCarbon;
    setCarbonCount((value) => Math.max(value, min));
    setBondPosition(1);
    setObservation(null);
    setShowReaction(false);
  }, [family]);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page organic-hydrocarbon-page">
      <section className="special-visualizer-hero organic-hydrocarbon-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectPath('chemistry'))}>{chemText(locale, '← Back to Chemistry Practice', '← 返回化学练习')}</GhostButton>
        <div>
          <p className="page-kicker">{chemText(locale, 'Home / Chemistry / Formulas / Organic Chemistry Basics', '首页 / 化学 / 公式 / 有机化学基础')}</p>
          <h1>{chemText(locale, 'Organic Chemistry Explorer', '有机化学交互演示')}</h1>
          <p className="page-body">{chemText(locale, 'Adjust hydrocarbon family and carbon count to connect general formulas, condensed structures, isomerism, and typical reactions.', '调节烃类和碳原子数，观察通式、结构简式、同分异构和典型反应如何联动变化。')}</p>
        </div>
        <div className="special-visualizer-metrics" aria-label={chemText(locale, 'Organic chemistry simulation details', '有机化学模拟信息')}>
          <span><Icon name="lucide:clock" />{chemText(locale, '5 min', '5 分钟')}</span>
          <span><Icon name="lucide:bar-chart-3" />{chemText(locale, 'Foundational', '基础')}</span>
          <span><b>{formula}</b></span>
        </div>
      </section>

      <section className="special-visualizer-card organic-hydrocarbon-card">
        <aside className="organic-info-panel">
          <article className="organic-formula-card">
            <h2><Icon name="lucide:sigma" />{chemText(locale, 'Molecular Formula', '分子式')}</h2>
            <strong>{isFunctionalMode ? functionalExample.groupFormula : categoryMeta.formula}</strong>
            <b>{formula}</b>
          </article>
          <article className="organic-property-card">
            <h2><Icon name="lucide:test-tube-2" />{chemText(locale, 'Properties', '性质')}</h2>
            <dl>
              <div><dt>{chemText(locale, 'Name', '名称')}</dt><dd>{compoundName}</dd></div>
              <div><dt>{chemText(locale, 'Formula', '分子式')}</dt><dd>{formula}</dd></div>
              <div><dt>{chemText(locale, 'Molar Mass', '摩尔质量')}</dt><dd>{molarMass} g/mol</dd></div>
              <div><dt>{chemText(locale, 'Category', '类别')}</dt><dd>{isFunctionalMode ? functionalFamily(functionalExample, locale) : hydrocarbonMetaLabel(hydrocarbonFamily, locale)}</dd></div>
              <div><dt>{isFunctionalMode ? (chemText(locale, 'Functional Group', '官能团')) : (chemText(locale, 'Saturation', '饱和度'))}</dt><dd>{isFunctionalMode ? `${functionalGroup(functionalExample, locale)} ${functionalExample.groupFormula}` : hydrocarbonSaturation(hydrocarbonFamily, locale)}</dd></div>
            </dl>
          </article>
          <article className="organic-reaction-card">
            <h2><Icon name="lucide:flame" />{chemText(locale, 'Key Reaction', '重要反应')}</h2>
            <p>{reactionEquation}</p>
            <span>{isFunctionalMode ? functionalNote(functionalExample, locale) : hydrocarbonNote(hydrocarbonFamily, locale)}</span>
          </article>
          <article className="organic-isomer-card">
            <h2><Icon name="lucide:shuffle" />{chemText(locale, 'Isomers', '同分异构体')}</h2>
            <strong>{isomerInfo.count}</strong>
            <p>{isomerInfo.examples.join(' / ')}</p>
          </article>
        </aside>

        <div className="organic-stage-panel">
          <div className="organic-stage-header">
            <div>
              <h2>{compoundName} · {formula}</h2>
              <p>{condensed}</p>
            </div>
            <span>{isFunctionalMode ? functionalGroup(functionalExample, locale) : hydrocarbonBondLabel(hydrocarbonFamily, locale)}</span>
          </div>
          <svg className={showReaction ? 'organic-molecule-svg reacting' : 'organic-molecule-svg'} viewBox="0 0 540 360" role="img" aria-label={chemText(locale, `${compoundName} molecular structure`, `${compoundName} 分子结构`)}>
            {isFunctionalMode ? functionalExample.bonds.flatMap((bond, index) => {
              const from = functionalExample.atoms[bond.from];
              const to = functionalExample.atoms[bond.to];
              const order = bond.order ?? 1;
              const offsets = order === 1 ? [0] : [-6, 6];
              return offsets.map((offset) => (
                <line key={`${index}-${offset}`} x1={from.x} y1={from.y + offset} x2={to.x} y2={to.y + offset} className={order === 2 ? 'organic-bond multiple' : 'organic-bond'} />
              ));
            }) : carbonAtoms.slice(0, -1).map((atom, index) => {
              const next = carbonAtoms[index + 1];
              const isMultiple = hydrocarbonFamily !== 'alkane' && index + 1 === safeBondPosition;
              const order = hydrocarbonFamily === 'alkyne' && isMultiple ? 3 : hydrocarbonFamily === 'alkene' && isMultiple ? 2 : 1;
              const offsets = order === 1 ? [0] : order === 2 ? [-6, 6] : [-9, 0, 9];
              return offsets.map((offset) => (
                <line key={`${index}-${offset}`} x1={atom.x} y1={atom.y + offset} x2={next.x} y2={next.y + offset} className={isMultiple ? 'organic-bond multiple' : 'organic-bond'} />
              ));
            })}
            {isFunctionalMode ? functionalExample.atoms.map((atom, index) => (
              <g key={index}>
                <circle cx={atom.x} cy={atom.y} r={atom.label === 'H' ? 14 : 24} className={`organic-${atom.tone}`} />
                <text x={atom.x} y={atom.y + 6} textAnchor="middle" className={atom.label === 'H' ? 'organic-h-label' : 'organic-atom-label'}>{atom.label}</text>
              </g>
            )) : carbonAtoms.map((atom, index) => {
              const leftOrder = index > 0 && hydrocarbonFamily !== 'alkane' && index === safeBondPosition ? (hydrocarbonFamily === 'alkyne' ? 3 : 2) : index > 0 ? 1 : 0;
              const rightOrder = index < safeCarbonCount - 1 && hydrocarbonFamily !== 'alkane' && index + 1 === safeBondPosition ? (hydrocarbonFamily === 'alkyne' ? 3 : 2) : index < safeCarbonCount - 1 ? 1 : 0;
              const hydrogenSlots = Math.max(4 - leftOrder - rightOrder, 0);
              const hydrogens = showStructure ? Array.from({ length: Math.min(hydrogenSlots, 3) }, (_, hIndex) => hIndex) : [];
              return (
                <g key={index}>
                  <circle cx={atom.x} cy={atom.y} r="24" className="organic-carbon" />
                  <text x={atom.x} y={atom.y + 6} textAnchor="middle" className="organic-atom-label">C</text>
                  {hydrogens.map((hIndex) => {
                    const angle = (-90 + hIndex * 120 + (index % 2 ? 28 : 0)) * Math.PI / 180;
                    const hx = atom.x + Math.cos(angle) * 48;
                    const hy = atom.y + Math.sin(angle) * 48;
                    return (
                      <g key={hIndex}>
                        <line x1={atom.x + Math.cos(angle) * 25} y1={atom.y + Math.sin(angle) * 25} x2={hx - Math.cos(angle) * 13} y2={hy - Math.sin(angle) * 13} className="organic-h-bond" />
                        <circle cx={hx} cy={hy} r="13" className="organic-hydrogen" />
                        <text x={hx} y={hy + 4} textAnchor="middle" className="organic-h-label">H</text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {showReaction && (
              <g className="organic-reaction-visual">
                <path d="M150 70 C230 35 310 35 390 70" />
                <text x="270" y="42" textAnchor="middle">{chemText(locale, (isFunctionalMode ? `${functionalGroup(functionalExample, locale)} controls reactions` : hydrocarbonFamily === 'alkane' ? 'Light substitution' : 'Pi bond opens, addition'), (isFunctionalMode ? `${functionalExample.group} 决定反应` : hydrocarbonFamily === 'alkane' ? '光照取代' : 'π 键打开，加成'))}</text>
              </g>
            )}
            <text x="270" y="326" textAnchor="middle" className="organic-condensed-label">{condensed}</text>
          </svg>
        </div>

        <aside className="organic-control-panel">
          <article className="organic-family-card">
            <span>{chemText(locale, 'Current Category', '当前类别')}</span>
            <strong>{isFunctionalMode ? organicCategoryLabel('functional', locale) : hydrocarbonMetaLabel(hydrocarbonFamily, locale)}</strong>
            <p>{isFunctionalMode ? `${functionalGroup(functionalExample, locale)} · ${functionalFamily(functionalExample, locale)}` : `${hydrocarbonSaturation(hydrocarbonFamily, locale)} · H/C = ${hToC}`}</p>
          </article>
          <div className="organic-family-picker">
            {(Object.keys(ORGANIC_CATEGORY_META) as OrganicCategory[]).map((key) => (
              <button type="button" key={key} className={family === key ? 'active' : ''} onClick={() => setFamily(key)}>
                <strong>{organicCategoryLabel(key, locale)}</strong>
                <span>{ORGANIC_CATEGORY_META[key].formula}</span>
              </button>
            ))}
          </div>
          {isFunctionalMode ? (
            <label>
              <span>{chemText(locale, 'Select Functional Group Example', '选择官能团示例')}</span>
              <select value={functionalExample.id} onChange={(event) => {
                setFunctionalId(event.target.value);
                setObservation(null);
                setShowReaction(false);
              }}>
                {FUNCTIONAL_ORGANIC_EXAMPLES.map((item) => <option key={item.id} value={item.id}>{chemText(locale, `${functionalName(item, locale)} (${functionalGroup(item, locale)})`, `${item.name}（${item.group}）`)}</option>)}
              </select>
            </label>
          ) : (
            <label>
              <span>{chemText(locale, 'Carbon Count n', '碳原子数 n')}</span>
              <strong>{safeCarbonCount}</strong>
              <input type="range" min={meta.minCarbon} max="8" step="1" value={safeCarbonCount} onChange={(event) => {
                setCarbonCount(Number(event.target.value));
                setBondPosition(1);
                setObservation(null);
              }} />
            </label>
          )}
          {!isFunctionalMode && hydrocarbonFamily !== 'alkane' && (
            <label>
              <span>{chemText(locale, 'Multiple Bond Position', '多重键位置')}</span>
              <strong>{safeBondPosition}</strong>
              <input type="range" min="1" max={maxPosition} step="1" value={safeBondPosition} onChange={(event) => {
                setBondPosition(Number(event.target.value));
                setObservation(null);
              }} />
            </label>
          )}
          <label className="organic-toggle">
            <input type="checkbox" checked={showStructure} onChange={(event) => setShowStructure(event.target.checked)} />
            <span>{chemText(locale, 'Show Hydrogen Atoms', '显示氢原子')}</span>
          </label>
          <button type="button" className="organic-reaction-button" onClick={() => setShowReaction((value) => !value)}>
            <Icon name={showReaction ? 'lucide:pause' : 'lucide:play'} />{chemText(locale, (showReaction ? 'Hide Reaction' : 'Show Reaction'), (showReaction ? '隐藏反应' : '演示反应'))}
          </button>
        </aside>
      </section>

      <section className="reaction-observation-panel organic-observation-panel">
        <div>
          <p className="page-kicker">{chemText(locale, 'Observation Tasks', '观察任务')}</p>
          <h2>{chemText(locale, 'Explain organic properties from formulas, bond types, and isomerism.', '从通式、键型和异构体解释有机性质。')}</h2>
        </div>
        <div className="reaction-observation-grid">
          {observations.map((item) => (
            <button type="button" key={item.id} className={observation === item.id ? 'active' : ''} onClick={() => setObservation(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {observation && <p className="reaction-observation-feedback">{observations.find((item) => item.id === observation)?.feedback}</p>}
      </section>

      <section className="special-visualizer-support organic-hydrocarbon-support">
        <article>
          <h2><Icon name="lucide:book-open" />{chemText(locale, 'Core Formulas', '核心公式')}</h2>
          <p><MathContent text={'$C_nH_{2n+2}$'} /></p>
          <p><MathContent text={'$C_nH_{2n}$'} /></p>
          <p><MathContent text={'$C_nH_{2n-2}$'} /></p>
        </article>
        <article>
          <h2><Icon name="lucide:flask-conical" />{chemText(locale, 'Related Practice', '相关练习')}</h2>
          <GhostButton onClick={() => onNavigate(`${routes.cscaSubjects}/chemistry/visualize/bonding-structure`)}>
            {chemText(locale, 'Chemical Bonding and Molecular Structure', '化学键与分子结构')}
          </GhostButton>
        </article>
        <article>
          <GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('chemistry'))}>
            <Icon name="lucide:book-open" />
            {chemText(locale, 'View Chemistry Formulas', '查看化学公式')}
          </GhostButton>
        </article>
      </section>
    </div>
  );
}

