import { routes } from './routes';

export type VocabularySubject = 'math' | 'physics' | 'chemistry';
export type VocabularyLevel = '基础' | '高频' | '易混' | '中等';

export type SubjectVocabularyItem = {
  term: string;
  translation: string;
  definition: string;
  pinyin?: string;
  module: string;
  tags: string[];
  level: VocabularyLevel;
  frequency: '高频' | '中频' | '低频';
  relatedPath: string;
};

export type SubjectVocabularyConfig = {
  subject: VocabularySubject;
  title: string;
  subtitle: string;
  guidance: string;
  items: SubjectVocabularyItem[];
};

const SUBJECT_NAMES: Record<VocabularySubject, string> = {
  math: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry'
};

function item(subject: VocabularySubject, value: Omit<SubjectVocabularyItem, 'relatedPath'>): SubjectVocabularyItem {
  return { ...value, relatedPath: `${routes.agent}?mode=free&subject=${subject}` };
}

export function vocabularyDefinitionText(
  value: Pick<SubjectVocabularyItem, 'term' | 'definition' | 'module'>,
  subject: VocabularySubject,
  language: 'zh' | 'en' | 'vi'
) {
  if (language === 'zh') return value.definition;
  if (language === 'vi') return `${value.term} là thuật ngữ ${SUBJECT_NAMES[subject]} quan trọng trong mô-đun này.`;
  return `${value.term} is a key ${SUBJECT_NAMES[subject]} term in this module.`;
}

export const subjectVocabularyConfig: Record<VocabularySubject, SubjectVocabularyConfig> = {
  math: {
    subject: 'math',
    title: '数学词汇',
    subtitle: '先掌握题干里的集合、函数和几何高频词。',
    guidance: '按术语定位薄弱模块，再回到数学练习中验证。',
    items: [
      item('math', { term: 'function', translation: '函数', definition: '输入和输出之间的确定对应关系。', module: '函数', tags: ['函数'], level: '基础', frequency: '高频' }),
      item('math', { term: 'inequality', translation: '不等式', definition: '用大于、小于等符号表示数量关系的式子。', module: '集合与不等式', tags: ['不等式'], level: '基础', frequency: '高频' })
    ]
  },
  physics: {
    subject: 'physics',
    title: '物理词汇',
    subtitle: '优先掌握单位、方向和基本模型词。',
    guidance: '先看懂题干中的方向和物理量，再回到物理练习。',
    items: [
      item('physics', { term: 'acceleration', translation: '加速度', definition: '速度随时间的变化率。', module: '力学', tags: ['运动'], level: '基础', frequency: '高频' }),
      item('physics', { term: 'momentum', translation: '动量', definition: '质量与速度的乘积，是有方向的物理量。', module: '力学', tags: ['动量'], level: '高频', frequency: '高频' })
    ]
  },
  chemistry: {
    subject: 'chemistry',
    title: '化学词汇',
    subtitle: '围绕结构、反应和溶液建立读题词库。',
    guidance: '把术语和反应类型一起复盘，再回到化学练习。',
    items: [
      item('chemistry', { term: 'electrolyte', translation: '电解质', definition: '在水溶液或熔融状态下能导电的化合物。', module: '溶液', tags: ['离子'], level: '基础', frequency: '高频' }),
      item('chemistry', { term: 'redox reaction', translation: '氧化还原反应', definition: '反应过程中发生电子转移或化合价变化的反应。', module: '反应原理', tags: ['氧化还原'], level: '中等', frequency: '高频' })
    ]
  }
};
