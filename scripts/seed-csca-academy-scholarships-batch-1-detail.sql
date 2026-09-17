UPDATE "scholarships"
SET
  "body_sections" = $$[
    {
      "title": "奖学金介绍",
      "paragraphs": [
        "为增进中国工会同各国工会组织的友好关系，增进中国工人阶级同各国工人阶级的友谊，为世界和平、发展、合作、工人权益和社会进步贡献力量，中华全国总工会设立面向“一带一路”沿线国家工会干部的汉语研修奖学金项目。",
        "项目培养形式为全日制汉语研修，学习期限为一学年（12个月），授课语言为汉语，项目院校为北京语言大学。奖学金名额、受理时间和年度安排以官方通知为准。"
      ]
    },
    {
      "title": "注意事项",
      "items": [
        "奖学金生须按时来华注册，注册后由学校按月发放生活费。",
        "未按时报到、非因健康原因请假、休学或退学等情形，可能影响奖学金资格。",
        "申请人应确保申请材料真实、完整、有效，材料不完整或不符合要求可能不予受理。",
        "已获得中国政府其他奖学金资助者，原则上不可同时享受本项目资助。"
      ]
    },
    {
      "title": "申请方式",
      "paragraphs": [
        "申请人须通过中国政府奖学金来华留学管理信息系统完成网上申请，并根据项目要求提交申请表和相关材料。",
        "具体受理、审核、录取、签证和来华手续以官方通知及项目院校要求为准。"
      ]
    },
    {
      "title": "来华签证",
      "paragraphs": [
        "已获得录取和奖学金资格的申请人，应按录取材料要求办理来华学习签证。",
        "入境后注册、体检复查、居留许可等手续以学校和当地管理部门要求为准。"
      ]
    },
    {
      "title": "报到注册、健康认证及居留许可",
      "paragraphs": [
        "奖学金生须按照录取通知书规定时间到校报到注册。来华后应按学校要求完成健康认证、保险确认和居留许可办理。",
        "未能按期完成相关手续的，可能影响注册、奖学金发放或后续学习安排。"
      ]
    }
  ]$$::jsonb,
  "benefit_items" = $$[
    { "key": "tuition", "label": "学费", "included": true },
    { "key": "accommodation", "label": "住宿费", "included": true },
    { "key": "stipend", "label": "生活费", "included": true, "note": "由学校按月发放，具体标准以官方通知为准。" },
    { "key": "medical-insurance", "label": "综合医疗保险", "included": true },
    { "key": "flight", "label": "一次性往返国际旅费", "included": true, "note": "用于购买首次来华和学成回国的国际机票（经济舱）。" },
    { "key": "other", "label": "其他费用", "included": false, "note": "未列明费用以官方页面及录取文件为准。" }
  ]$$::jsonb,
  "eligibility_items" = $$[
    { "label": "学历层次", "value": "language" },
    { "label": "年龄限制", "value": "≤45 岁" },
    { "label": "目标国家/地区", "value": "“一带一路”沿线国家优先" },
    { "label": "身份要求", "value": "非中国籍公民，身心健康" },
    { "label": "工作经历", "value": "须具备一定工会工作经验；已有对华交流经历者优先" },
    { "label": "奖学金限制", "value": "未同时获得中国政府其他奖学金" }
  ]$$::jsonb,
  "application_materials" = $$[
    { "label": "申请表", "value": "《中国政府奖学金申请表》（中文或英文）" },
    { "label": "学历证明", "value": "经过公证的最高学历证明；非中文材料需附中文或英文译文" },
    { "label": "成绩单", "value": "学习成绩单；非中文材料需附中文或英文译文" },
    { "label": "学习计划", "value": "来华学习或研究计划，不少于500字，用中文或英文书写" },
    { "label": "监护材料", "value": "年龄不满18周岁的申请人须提交在华法定监护人相关法律文件" },
    { "label": "体检表", "value": "来华学习时间超过6个月者须提交《外国人体格检查表》扫描件" },
    { "label": "个人简历", "value": "须体现申请人参与工会工作的经历；在校生和在职人员须提交相关证明" }
  ]$$::jsonb,
  "application_steps" = $$[
    { "label": "第 1 步", "value": "登录中国政府奖学金来华留学管理信息系统完成网上申请" },
    { "label": "第 2 步", "value": "填写申请信息，选择对应项目类别并上传申请材料" },
    { "label": "第 3 步", "value": "下载并提交申请表，按官方通知完成后续受理和审核" },
    { "label": "第 4 步", "value": "获得录取后按学校要求办理签证、报到注册及入学手续" }
  ]$$::jsonb,
  "contact_info" = $${
    "label": "联系方式",
    "website": "http://www.csc.edu.cn/studychina",
    "note": "具体联系方式以官方奖学金页面及年度通知为准。"
  }$$::jsonb,
  "action_links" = $$[
    { "label": "前往申请", "url": "http://www.csc.edu.cn/studychina", "kind": "primary" },
    { "label": "查看官方来源", "url": "http://www.csc.edu.cn/studychina", "kind": "source" }
  ]$$::jsonb,
  "updated_at" = now()
WHERE "slug" = 'belt-and-road-trade-union-cadres-chinese-language-training-scholarship';
