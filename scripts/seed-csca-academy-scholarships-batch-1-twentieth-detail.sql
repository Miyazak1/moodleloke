INSERT INTO "scholarships" (
  "slug","title","type","funding_level","provider_name","provider_name_en","provider_location",
  "summary","coverage","applicable_degree","applicable_program","amount_text","requirement_text",
  "body_sections","benefit_items","eligibility_items","application_materials","application_steps",
  "contact_info","action_links","deadline_date","deadline_label","application_round",
  "target_countries","target_regions","benefits","source_url","source_label","last_verified_at",
  "sort_order","status","created_at","updated_at"
) VALUES (
  'northeast-normal-university-outstanding-self-funded-international-student-annual-scholarship',
  '东北师范大学优秀自费来华留学生年度奖学金',
  'university',
  'partial',
  '东北师范大学',
  'Northeast Normal University',
  'Changchun, Northeast China',
  '东北师范大学优秀自费来华留学生年度奖学金用于鼓励留学生勤奋学习、积极向上，提高学校声誉，吸引更多优秀留学生到校学习，面向语言生及本科、硕士、博士研究生。',
  '该奖学金按年度发放不同等级奖金：语言生 2000 元/人/年；本科生一等奖 6000 元、二等奖 4000 元、三等奖 2000 元/人/年；硕士研究生一等奖 8000 元、二等奖 5000 元、三等奖 3000 元/人/年；博士研究生一等奖 10000 元、二等奖 6000 元/人/年。',
  'bachelor, master, doctoral',
  '东北师范大学语言生及学历生相关项目。',
  '语言生 2000 元/人/年；本科生一等奖 6000 元、二等奖 4000 元、三等奖 2000 元/人/年；硕士研究生一等奖 8000 元、二等奖 5000 元、三等奖 3000 元/人/年；博士研究生一等奖 10000 元、二等奖 6000 元/人/年。',
  '一、评审目的
鼓励留学生勤奋学习、积极向上，提高学校声誉，吸引更多留学生到校学习。

二、申请者资格
东北师范大学语言生及学历生（含本科生、硕士研究生、博士研究生）。申请者需遵守中华人民共和国法律法规和东北师范大学规章制度，成绩优秀、积极向上、品行端正、尊敬师长，积极参与学校举办的各类活动，综合表现良好。

三、评审标准
语言生：在上一学年中每学期参加学院全部课程，无无故缺勤记录且成绩优异者。
学历生：在校生在上一学年中每学期至少选修三门以上课程，并且各门课程获得相应成绩；新生中，本科生为高中学习阶段所有成绩优秀者，硕士研究生为本科学习阶段所有成绩优秀者，博士研究生为硕士学习阶段所有成绩优秀者或在国际著名学术期刊发表文章者。

四、奖学金标准
1. 语言生奖学金：2000 元/人/年。
2. 本科生奖学金：一等奖 6000 元/人/年，二等奖 4000 元/人/年，三等奖 2000 元/人/年。
3. 硕士研究生奖学金：一等奖 8000 元/人/年，二等奖 5000 元/人/年，三等奖 3000 元/人/年。
4. 博士研究生奖学金：一等奖 10000 元/人/年，二等奖 6000 元/人/年。',
  $$[
    {"title":"评审目的","paragraphs":["鼓励留学生勤奋学习、积极向上，提高学校声誉，吸引更多留学生到校学习。"]},
    {"title":"申请者资格","items":["东北师范大学语言生及学历生（含本科生、硕士研究生、博士研究生）。","遵守中华人民共和国法律法规和东北师范大学规章制度。","成绩优秀、积极向上、品行端正、尊敬师长，积极参与学校举办的各类活动，综合表现良好。"]},
    {"title":"评审标准","items":["语言生：上一学年每学期参加学院全部课程，无无故缺勤记录且成绩优异。","学历生在校生：上一学年每学期至少选修三门以上课程，并取得相应成绩。","本科新生：高中学习阶段所有成绩优秀。","硕士研究生新生：本科学习阶段所有成绩优秀。","博士研究生新生：硕士学习阶段所有成绩优秀，或在国际著名学术期刊发表文章。"]},
    {"title":"奖学金标准","items":["语言生奖学金：2000 元/人/年。","本科生奖学金：一等奖 6000 元/人/年，二等奖 4000 元/人/年，三等奖 2000 元/人/年。","硕士研究生奖学金：一等奖 8000 元/人/年，二等奖 5000 元/人/年，三等奖 3000 元/人/年。","博士研究生奖学金：一等奖 10000 元/人/年，二等奖 6000 元/人/年。"]}
  ]$$::jsonb,
  $$[
    {"key":"tuition","label":"学费","included":false},
    {"key":"accommodation","label":"住宿费","included":false},
    {"key":"stipend","label":"生活费","included":false},
    {"key":"medical-insurance","label":"医疗保险","included":false},
    {"key":"flight","label":"机票","included":false},
    {"key":"visa","label":"签证费","included":false},
    {"key":"cash-award","label":"年度奖金","included":true,"note":"按语言生、本科、硕士、博士不同等级发放。"}
  ]$$::jsonb,
  $$[
    {"label":"学历层次","value":"bachelor, master, doctoral"},
    {"label":"适用对象","value":"语言生及学历生"},
    {"label":"评审方式","value":"年度评审"},
    {"label":"资助形式","value":"年度奖金"}
  ]$$::jsonb,
  $$[
    {"label":"成绩材料","value":"上一学年课程成绩或新生阶段成绩证明"},
    {"label":"在读/身份材料","value":"东北师范大学语言生或学历生身份材料"},
    {"label":"学术成果","value":"博士新生可提交国际著名学术期刊发表文章材料"}
  ]$$::jsonb,
  $$[
    {"label":"第 1 步","value":"按学院年度评审通知准备成绩、在读身份和相关证明材料"},
    {"label":"第 2 步","value":"提交至学校或学院留学生奖学金评审渠道"},
    {"label":"第 3 步","value":"学校按年度标准进行综合评审并确定等级"}
  ]$$::jsonb,
  $${
    "label":"联系方式",
    "email":"iso@nenu.edu.cn",
    "phone":"0431-85099754",
    "website":"http://iso.nenu.edu.cn/",
    "address":"中国吉林省长春市人民大街 5268 号东北师范大学国际合作与交流处留学生科",
    "note":"具体申请时间和材料以学校年度通知为准。"
  }$$::jsonb,
  $$[
    {"label":"查看大学详情","url":"http://iso.nenu.edu.cn/","kind":"secondary"},
    {"label":"查看官方来源","url":"http://iso.nenu.edu.cn/","kind":"source"}
  ]$$::jsonb,
  null,
  '以年度评审通知为准',
  '年度评审',
  '[]'::jsonb,
  '[]'::jsonb,
  '["年度奖金"]'::jsonb,
  'http://iso.nenu.edu.cn/',
  '东北师范大学国际合作与交流处',
  '2026-05-28 00:00:00+00',
  20,
  'published',
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

INSERT INTO "scholarship_schools" ("scholarship_id", "school_id", "sort_order", "created_at")
SELECT scholarship.id, school.id, 0, now()
FROM "scholarships" scholarship
JOIN "schools" school ON school."name_zh" = '东北师范大学'
WHERE scholarship.slug = 'northeast-normal-university-outstanding-self-funded-international-student-annual-scholarship'
ON CONFLICT ("scholarship_id", "school_id") DO NOTHING;
