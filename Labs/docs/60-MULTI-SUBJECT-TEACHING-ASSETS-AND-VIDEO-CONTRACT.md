# PR12D：多学科教学资产与视频契约

## 1. 本阶段结论

TeachingAsset 不再等同于“函数平移组件”。V1 渲染注册表现在覆盖三个经过白名单校验的交互案例：

| 学科 | `stableKey` / `componentKey` | 知识点 | 学生操作 | 即时检查 |
| --- | --- | --- | --- | --- |
| 数学 | `math.function-horizontal-shift` | 函数水平平移 | 调节 `h`，观察顶点 | 根据 `h` 判断顶点 |
| 物理 | `physics.newton-second-law` | 牛顿第二定律 | 调节合力和质量，观察 `a=F/m` | 合力不变、质量加倍时判断加速度 |
| 化学 | `chemistry.acid-base-neutralization` | 酸碱中和 | 调节 H⁺、OH⁻ 份数，观察过量状态 | 等物质的量完全反应后判断酸碱性 |

三类资产共用同一发布、解析、交付、事件、A4 暴露和独立验证链路。资产 payload 不能携带可执行代码；服务端按 `componentKey + componentVersion + strict props schema` 验证，客户端仅渲染内置组件。

## 2. 不变的证据语义

- 打开、拖动、播放、看完、答对资产内 active prompt 均是教学过程事件，不是独立掌握证据；
- active prompt 的答案键和反馈键只保留在服务端，浏览器只收到题干与选项；
- 必须通过服务端 active prompt 判分才能完成资产；
- 完成后记录 A4 `explanation_seen`，`masteryChanged=false`；
- 系统随后调度至少 3 道未曝光、已审核的新题做 immediate verification；保持和迁移判断继续沿用既有验证链路。

## 3. 视频 TeachingAsset V1 冻结契约

视频沿用 `TeachingAsset / TeachingAssetVersion`，不另建孤立内容系统。首期合同如下：

```ts
type VideoTeachingAssetPayloadV1 = {
  schemaVersion: '1';
  title: string;
  summary: string;
  media: {
    objectKey: string;          // 受控对象存储键，不接受任意第三方 iframe
    mimeType: 'video/mp4' | 'application/x-mpegURL';
    checksumSha256: string;
    durationMs: number;
    width: number;
    height: number;
    posterObjectKey: string;
  };
  captions: Array<{
    language: 'zh-CN' | 'en' | 'vi';
    objectKey: string;
    format: 'webvtt';
    checksumSha256: string;
    isDefault: boolean;
  }>;
  transcript: {
    language: string;
    blocks: Array<{ startMs: number; endMs: number; text: string }>;
  };
  chapters: Array<{
    id: string;
    title: string;
    startMs: number;
    endMs: number;
    topicIds: number[];
  }>;
  activePrompts: Array<{
    id: string;
    atMs: number;
    prompt: string;
    options: Array<{ id: string; label: string }>;
    // correctAnswer 与反馈仍只保存在服务端私有 payload
  }>;
  completionPolicy: {
    minimumWatchedRatio: number;
    requiredPromptIds: string[];
    completionIsMasteryEvidence: false;
    independentVerificationRequired: true;
  };
};
```

正式数据仍必须包含知识点/前置知识映射、`sourceRefs`、审核状态、审核人和发布时间。媒体与字幕按 checksum 固定版本；修改内容必须发布新版本，不能原地替换已产生曝光记录的文件。

## 4. 播放事件与服务端可信边界

允许的事件类型：

- `video_started`
- `video_progress_milestone`（25/50/75/90%，去重）
- `video_chapter_viewed`
- `video_caption_toggled`
- `active_prompt_answered`
- `completed`

客户端不能仅上报 `currentTime=duration` 就获得完成状态。服务端必须建立短期播放会话，验证事件单调递增、合理墙钟时间、资产版本与用户归属、所需 active prompt，以及幂等请求键。跳播可以用于复习，但不能伪造已观看比例。播放事件只影响教学交付完成度和内容分析指标，不直接写掌握度。

## 5. 可访问性和降级

- 已发布视频必须至少有主语言字幕与文本稿；
- 播放器支持键盘操作、清晰焦点、暂停、倍速、字幕切换和 reduced-motion；
- 色彩、音效不能是传递知识的唯一方式；
- 视频或 CDN 不可用时，展示同版本 transcript、章节和海报；
- active prompt 必须可脱离视频控件独立操作；
- 没有字幕、来源、审核或独立验证配置的资产不得发布。

## 6. 安全、性能和内容治理门

- 媒体仅来自允许的对象存储/CDN，通过短时签名 URL 访问；
- 禁止任意 HTML、脚本、外部播放器 iframe 和 payload 内 URL；
- 上传时校验 MIME、文件头、大小、病毒扫描和转码结果；
- 首屏不预载完整视频，按网络状态选择码率；
- 内容下架后停止新交付，保留历史版本与曝光审计；
- 字幕和文本稿属于事实内容，必须与大纲、真题画像或已审核教学稿建立来源引用。

## 7. 验收

运行 `node scripts/agent-multisubject-teaching-assets-live.cjs`，对物理与化学分别验证：

1. 发布资产能按 stable key 解析到正确白名单组件；
2. 开始前隐藏内容，开始后仍不泄露答案键；
3. 未通过 active prompt 不得完成；
4. 服务端能区分错误和正确答案；
5. 完成只产生 A4 暴露且不改变掌握度；
6. 自动建立包含 3 道已审核新题的 immediate verification。

视频部分本阶段只冻结合同，不开放生产 renderer；完成媒体处理、播放器、服务端播放会话、可访问性和真实浏览器门后再灰度。
