import * as path from 'node:path';
import * as fs from 'node:fs';

export type StudentQuestionFigure = { schemaVersion: 'student-question-figure-v1'; kind: string; phase: 'question' | 'review'; caption: string; alt: string; mime: string; data: string };
type FigureQuestion = { prompt?: string; version?: number; sourceType?: string | null; sourceQuestionId?: number | null; generationMetadata?: unknown };
type Result = { state: 'ready' | 'hold' | 'original_only'; display?: StudentQuestionFigure; reason?: string };
let runtime: { present(q: FigureQuestion, phase: string, language: string): Result; isReadyForPractice(q: FigureQuestion): boolean } | undefined;
function load() {
  if (runtime) return runtime;
  let root = __dirname;
  while (true) {
    const file = path.join(root, 'question-engine/figures/presentation.cjs');
    if (fs.existsSync(file)) { runtime = require(file); return runtime!; }
    const parent = path.dirname(root); if (parent === root) throw Error('question_figure_runtime_missing'); root = parent;
  }
}
export function questionFigure(q: FigureQuestion, phase: 'question' | 'review' = 'question', language = 'zh'): Result {
  try { return load().present(q, phase, language === 'en' ? 'en' : 'zh'); }
  catch { return { state: 'hold', reason: 'question_figure_runtime_unavailable' }; }
}
export function isFigureReadyForPractice(q: FigureQuestion) { try { return load().isReadyForPractice(q); } catch { return false; } }
