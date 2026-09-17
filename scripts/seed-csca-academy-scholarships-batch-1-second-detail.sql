INSERT INTO "scholarships" (
  "slug",
  "title",
  "type",
  "funding_level",
  "provider_name",
  "provider_name_en",
  "provider_location",
  "summary",
  "coverage",
  "applicable_degree",
  "applicable_program",
  "amount_text",
  "requirement_text",
  "body_sections",
  "benefit_items",
  "eligibility_items",
  "application_materials",
  "application_steps",
  "contact_info",
  "action_links",
  "deadline_date",
  "deadline_label",
  "application_round",
  "target_countries",
  "target_regions",
  "benefits",
  "source_url",
  "source_label",
  "last_verified_at",
  "sort_order",
  "status",
  "created_at",
  "updated_at"
) VALUES (
  'three-gorges-university-full-scholarship-for-myanmar-students',
  '三峡大学全额奖学金（缅甸籍学生）',
  'university',
  'full',
  '三峡大学',
  'China Three Gorges University',
  'Yichang, Hubei, China',
  '该奖学金由三峡大学校友、云南云能电力工程公司董事长王俊昌捐赠，用于资助优秀的缅甸籍学生来校学习，旨在推动缅甸项目在相关领域的人才培养，提升三峡大学国际影响力。',
  '奖学金为全额资助，资助项目包括学费、住宿费、保险费、注册费，以及每月 2500 元生活费。',
  'bachelor',
  '水利水电工程、土木工程、电气工程及其自动化、自动化、计算机科学与技术、工商管理',
  '学费、住宿费、保险费、注册费，以及每月 2500 元生活费。奖学金名额：10 名。',
  '申请人资格：
1. 18-25 岁的缅甸籍公民。
2. 对华友好，身心健康，学习努力及成绩优异。
3. 高中毕业。
4. 具备良好的英语听说读写能力。
5. 具有一定汉语基础者优先考虑。

申请材料：
1. 在线打印三峡大学外国留学生入学申请表后本人签字。
2. 护照复印件（有效期内的普通护照）。
3. 如申请人在中国，需提交签证和居留证件复印件。
4. 高中毕业证；中英文以外文本须附经公证的英文或中文翻译件。
5. 成绩单；中英文以外文本须附经公证的英文或中文翻译件。
6. 外国人体格检查表。
7. 银行存款证明或经济担保函。
8. 5 分钟英文个人介绍视频。
9. 王俊昌校友的推荐信。',
  $$[
    {"title":"奖学金介绍","paragraphs":["该奖学金由三峡大学校友、云南云能电力工程公司董事长王俊昌捐赠，用于资助优秀的缅甸籍学生来校学习，旨在推动缅甸项目在相关领域的人才培养，提升三峡大学国际影响力。"]},
    {"title":"奖学金资助项目","items":["学费","住宿费","保险费","注册费","每月 2500 元生活费"]},
    {"title":"2018-2019 学年奖学金专业目录（本科）","items":["水利水电工程","土木工程","电气工程及其自动化","自动化","计算机科学与技术","工商管理"]},
    {"title":"奖学金名额","paragraphs":["10 名。"]},
    {"title":"申请人资格","items":["18-25 岁的缅甸籍公民。","对华友好，身心健康，学习努力及成绩优异。","高中毕业。","具备良好的英语听说读写能力。","具有一定汉语基础者优先考虑。"]},
    {"title":"申请材料","items":["在线打印三峡大学外国留学生入学申请表后本人签字。","护照复印件（有效期内的普通护照）。","如申请人在中国，需提交签证和居留证件复印件。","高中毕业证；中英文以外文本须附经公证的英文或中文翻译件。","成绩单；中英文以外文本须附经公证的英文或中文翻译件。","外国人体格检查表。","银行存款证明或经济担保函。","5 分钟英文个人介绍视频。","王俊昌校友的推荐信。"]},
    {"title":"网上申请与截止日期","paragraphs":["网上申请链接：http://lsx.ctgu.edu.cn/。","申请截止日期：2018 年 7 月 15 日。"]}
  ]$$::jsonb,
  $$[
    {"key":"tuition","label":"学费","included":true},
    {"key":"accommodation","label":"住宿费","included":true},
    {"key":"stipend","label":"生活费","included":true,"note":"每月 2500 元。"},
    {"key":"medical-insurance","label":"保险费","included":true},
    {"key":"registration","label":"注册费","included":true},
    {"key":"flight","label":"机票","included":false},
    {"key":"visa","label":"签证费","included":false}
  ]$$::jsonb,
  $$[
    {"label":"学历层次","value":"bachelor"},
    {"label":"年龄限制","value":"18-25 岁"},
    {"label":"目标国家/地区","value":"Myanmar"},
    {"label":"学历要求","value":"高中毕业"},
    {"label":"语言能力","value":"具备良好的英语听说读写能力；有汉语基础者优先"}
  ]$$::jsonb,
  $$[
    {"label":"申请表","value":"在线打印三峡大学外国留学生入学申请表后本人签字"},
    {"label":"护照","value":"有效期内普通护照复印件"},
    {"label":"在华材料","value":"如申请人在中国，需提交签证和居留证件复印件"},
    {"label":"毕业证","value":"高中毕业证；中英文以外文本须附经公证的英文或中文翻译件"},
    {"label":"成绩单","value":"中英文以外文本须附经公证的英文或中文翻译件"},
    {"label":"体检表","value":"外国人体格检查表"},
    {"label":"经济证明","value":"银行存款证明或经济担保函"},
    {"label":"视频","value":"5 分钟英文个人介绍视频"},
    {"label":"推荐信","value":"王俊昌校友的推荐信"}
  ]$$::jsonb,
  $$[
    {"label":"第 1 步","value":"访问三峡大学国际学生网上申请系统并填写申请信息"},
    {"label":"第 2 步","value":"上传申请表、护照、学历证明、成绩单、体检表等材料"},
    {"label":"第 3 步","value":"提交英文个人介绍视频及推荐信"},
    {"label":"第 4 步","value":"按学校通知完成审核、录取及报到手续"}
  ]$$::jsonb,
  $${
    "label":"联系方式",
    "name":"王艳 / 肖平",
    "email":"hxlameila@163.com；xiong1212@ctgu.edu.cn",
    "phone":"+86 13987637390；+86 717 6394999",
    "website":"http://eng.ctgu.edu.cn/",
    "note":"传真：+86 717 6393309。具体联系方式以学校官方页面为准。"
  }$$::jsonb,
  $$[
    {"label":"前往申请","url":"http://lsx.ctgu.edu.cn/","kind":"primary"},
    {"label":"查看大学详情","url":"http://eng.ctgu.edu.cn/","kind":"secondary"},
    {"label":"查看官方来源","url":"http://eng.ctgu.edu.cn/","kind":"source"}
  ]$$::jsonb,
  '2018-07-15 00:00:00+00',
  '2018 年 7 月 15 日',
  '2018-2019 学年',
  '["Myanmar"]'::jsonb,
  '["Southeast Asia"]'::jsonb,
  '["学费","住宿费","生活费","保险费","注册费"]'::jsonb,
  'http://eng.ctgu.edu.cn/',
  '三峡大学国际学生招生页面',
  '2026-05-28 00:00:00+00',
  2,
  'archived',
  now(),
  now()
) ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "type" = EXCLUDED."type",
  "funding_level" = EXCLUDED."funding_level",
  "provider_name" = EXCLUDED."provider_name",
  "provider_name_en" = EXCLUDED."provider_name_en",
  "provider_location" = EXCLUDED."provider_location",
  "summary" = EXCLUDED."summary",
  "coverage" = EXCLUDED."coverage",
  "applicable_degree" = EXCLUDED."applicable_degree",
  "applicable_program" = EXCLUDED."applicable_program",
  "amount_text" = EXCLUDED."amount_text",
  "requirement_text" = EXCLUDED."requirement_text",
  "body_sections" = EXCLUDED."body_sections",
  "benefit_items" = EXCLUDED."benefit_items",
  "eligibility_items" = EXCLUDED."eligibility_items",
  "application_materials" = EXCLUDED."application_materials",
  "application_steps" = EXCLUDED."application_steps",
  "contact_info" = EXCLUDED."contact_info",
  "action_links" = EXCLUDED."action_links",
  "deadline_date" = EXCLUDED."deadline_date",
  "deadline_label" = EXCLUDED."deadline_label",
  "application_round" = EXCLUDED."application_round",
  "target_countries" = EXCLUDED."target_countries",
  "target_regions" = EXCLUDED."target_regions",
  "benefits" = EXCLUDED."benefits",
  "source_url" = EXCLUDED."source_url",
  "source_label" = EXCLUDED."source_label",
  "last_verified_at" = EXCLUDED."last_verified_at",
  "sort_order" = EXCLUDED."sort_order",
  "status" = EXCLUDED."status",
  "updated_at" = now();
