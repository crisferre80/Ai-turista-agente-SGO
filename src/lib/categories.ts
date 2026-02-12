export type CategoryType = 'attraction' | 'business';

export interface CategoryItem {
  name: string;
  icon: string;
  type: CategoryType;
}

const DEFAULT_ATTRACTION_CATEGORIES: CategoryItem[] = [
  { name: 'histórico', icon: '🏛️', type: 'attraction' },
  { name: 'naturaleza', icon: '🌿', type: 'attraction' },
  { name: 'compras', icon: '🛍️', type: 'attraction' },
  { name: 'cultura', icon: '🎭', type: 'attraction' },
  { name: 'arquitectura', icon: '🏗️', type: 'attraction' },
  { name: 'monumentos', icon: '🗿', type: 'attraction' },
  { name: 'reservas naturales', icon: '🏞️', type: 'attraction' },
  { name: 'gastronomía', icon: '🍽️', type: 'attraction' },
  { name: 'artesanía', icon: '🎨', type: 'attraction' }
];

const DEFAULT_BUSINESS_CATEGORIES: CategoryItem[] = [
  { name: 'restaurante', icon: '🍽️', type: 'business' },
  { name: 'hotel', icon: '🏨', type: 'business' },
  { name: 'artesanía', icon: '🎨', type: 'business' },
  { name: 'compras', icon: '🛍️', type: 'business' },
  { name: 'cultura', icon: '🎭', type: 'business' },
  { name: 'servicios', icon: '🛠️', type: 'business' }
];

const CATEGORY_ALIASES: Record<string, string> = {
  historico: 'histórico',
  historicos: 'histórico',
  gastronomia: 'gastronomía',
  artesania: 'artesanía',
  restaurantes: 'restaurante',
  arquitectonico: 'arquitectura',
  arquitectonica: 'arquitectura',
  natural: 'naturaleza',
  shopping: 'compras',
  cultural: 'cultura',
  monument: 'monumentos',
  'reserva natural': 'reservas naturales'
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getDefaultsByType = (type?: CategoryType): CategoryItem[] => {
  if (type === 'attraction') return DEFAULT_ATTRACTION_CATEGORIES;
  if (type === 'business') return DEFAULT_BUSINESS_CATEGORIES;
  return [...DEFAULT_ATTRACTION_CATEGORIES, ...DEFAULT_BUSINESS_CATEGORIES];
};

export function normalizeCategoryName(rawValue: string, type?: CategoryType): string {
  const normalizedRaw = normalizeText(rawValue || '');
  if (!normalizedRaw) return '';

  let aliased = CATEGORY_ALIASES[normalizedRaw] || normalizedRaw;
  if (type === 'attraction' && aliased === 'restaurante') {
    aliased = 'gastronomía';
  }
  const defaults = getDefaultsByType(type);
  const exactDefault = defaults.find((cat) => normalizeText(cat.name) === aliased);

  return exactDefault?.name || aliased;
}

export function getDefaultCategories(type?: CategoryType): CategoryItem[] {
  return [...getDefaultsByType(type)];
}

export function mergeWithDefaultCategories(rawCategories: Array<Partial<CategoryItem>> = []): CategoryItem[] {
  const merged = new Map<string, CategoryItem>();

  for (const fallbackCategory of getDefaultsByType()) {
    merged.set(`${fallbackCategory.type}:${fallbackCategory.name}`, fallbackCategory);
  }

  for (const category of rawCategories) {
    if (!category.name || (category.type !== 'attraction' && category.type !== 'business')) {
      continue;
    }

    const canonicalName = normalizeCategoryName(category.name, category.type);
    if (!canonicalName) continue;

    const fallback = getDefaultsByType(category.type).find((item) => item.name === canonicalName);
    const mergedCategory: CategoryItem = {
      name: canonicalName,
      icon: category.icon?.trim() || fallback?.icon || '📍',
      type: category.type
    };

    merged.set(`${mergedCategory.type}:${mergedCategory.name}`, mergedCategory);
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name, 'es');
    }
    return a.type.localeCompare(b.type, 'es');
  });
}