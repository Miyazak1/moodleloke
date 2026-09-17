import { ApiError } from './request';

export const ADAPTIVE_PRACTICE_POOL_EXHAUSTED = 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED';

export function isAdaptivePracticePoolExhaustedError(error: unknown) {
  return error instanceof ApiError && error.code === ADAPTIVE_PRACTICE_POOL_EXHAUSTED;
}

export function adaptivePracticePoolExhaustedCopy(locale: string) {
  if (locale === 'en') {
    return {
      title: 'You have finished this practice set for now.',
      body: 'We are preparing more adaptive questions. Check back later for more.',
      reportBody: 'We are preparing more adaptive questions. Check back later for more, or return to the subject page and choose another topic or mock exam.',
      actionLabel: 'Questions are being prepared'
    };
  }
  if (locale === 'vi') {
    return {
      title: 'Bạn đã hoàn thành nhóm câu luyện hiện có.',
      body: 'Chúng tôi đang bổ sung thêm câu phù hợp. Hãy quay lại sau nhé.',
      reportBody: 'Chúng tôi đang bổ sung thêm câu phù hợp. Hãy quay lại sau, hoặc về trang môn học để chọn chủ đề khác hay làm đề thi thử.',
      actionLabel: 'Đang bổ sung câu hỏi'
    };
  }
  return {
    title: '这组练习你已经刷完啦。',
    body: '我们正在努力补充新的适配题，稍后再来会有更多题目。',
    reportBody: '我们正在努力补充新的适配题，稍后再来会有更多题目。你可以先回科目页换一个知识点，或去做一套模考。',
    actionLabel: '题库补货中'
  };
}
