INSERT INTO "scholarships" (
  "slug","title","type","funding_level","provider_name","provider_name_en","provider_location",
  "summary","coverage","applicable_degree","applicable_program","amount_text","requirement_text",
  "body_sections","benefit_items","eligibility_items","application_materials","application_steps",
  "contact_info","action_links","deadline_date","deadline_label","application_round",
  "target_countries","target_regions","benefits","source_url","source_label","last_verified_at",
  "sort_order","status","created_at","updated_at"
) VALUES (
  'dongbei-university-of-finance-and-economics-freshman-scholarship',
  '东北财经大学新生奖学金',
  'university',
  'partial',
  '东北财经大学',
  'Dongbei University of Finance and Economics',
  'Dalian, Northeast China',
  '东北财经大学为吸引更多优秀留学生，特别设立新生奖学金项目，面向申请本科、硕士及博士学位课程的非中国籍新生开放，奖学金内容为减免全额或部分学费。',
  '奖学金内容为减免全额或部分学费。',
  'bachelor, master, doctoral',
  '东北财经大学所有中、英文授课专业的学历生均可申请。',
  '减免全额或部分学费。',
  '1. 奖学金内容和标准
东北财经大学为吸引更多优秀的留学生，特别设立了新生奖学金项目，以吸引具备优秀语言能力和专业背景的留学生来校攻读本科、硕士及博士学位课程。奖学金内容为减免全额或部分学费。

2. 开放专业
东北财经大学的所有中、英文授课专业的学历生均可申请。

3. 申请人资格
非中国籍公民，身体健康，年龄不超过 35 周岁。

4. 申请日期
每年 3 月 1 日至 5 月 30 日。

5. 申请流程/途径
登录东北财经大学在线申请系统 http://study.dufe.edu.cn。

6. 申请所需材料
《东北财经大学留学申请表》（在线填写信息后自动生成）；最高学历证明，如申请人为在校学生，须另外提交本人就读学校出具的在学证明；学习成绩单；来华学习或研究计划（只针对硕士或博士学位课程申请者）；两封教授或副教授的推荐信（只针对硕士或博士学位课程申请者）。

7. 受理部门
东北财经大学国际教育学院招生与国际项目部。

8. 联系方式
中国辽宁省大连市沙河口区尖山街 217 号，东北财经大学国际教育学院招生与国际项目部；邮编：116025；电话：86-411-84712106 / 84710885；邮箱：scholarship@dufe.edu.cn。',
  $$[
    {"title":"奖学金内容和标准","paragraphs":["东北财经大学为吸引更多优秀留学生，特别设立新生奖学金项目，以吸引具备优秀语言能力和专业背景的留学生来校攻读本科、硕士及博士学位课程。奖学金内容为减免全额或部分学费。"]},
    {"title":"开放专业","paragraphs":["东北财经大学所有中、英文授课专业的学历生均可申请。"]},
    {"title":"申请人资格","items":["非中国籍公民。","身体健康。","年龄不超过 35 周岁。"]},
    {"title":"申请日期","paragraphs":["每年 3 月 1 日至 5 月 30 日。"]},
    {"title":"申请流程/途径","paragraphs":["登录东北财经大学在线申请系统 http://study.dufe.edu.cn。"]},
    {"title":"申请所需材料","items":["《东北财经大学留学申请表》（在线填写信息后自动生成）。","最高学历证明；在校学生须另提交就读学校出具的在学证明。","学习成绩单。","来华学习或研究计划（仅硕士或博士学位课程申请者）。","两封教授或副教授推荐信（仅硕士或博士学位课程申请者）。"]},
    {"title":"受理部门","paragraphs":["东北财经大学国际教育学院招生与国际项目部。"]},
    {"title":"联系方式","paragraphs":["中国辽宁省大连市沙河口区尖山街 217 号，东北财经大学国际教育学院招生与国际项目部；邮编：116025；电话：86-411-84712106 / 84710885；邮箱：scholarship@dufe.edu.cn。"]}
  ]$$::jsonb,
  $$[
    {"key":"tuition","label":"学费","included":true,"note":"减免全额或部分学费。"},
    {"key":"accommodation","label":"住宿费","included":false},
    {"key":"stipend","label":"生活费","included":false},
    {"key":"medical-insurance","label":"医疗保险","included":false},
    {"key":"flight","label":"机票","included":false},
    {"key":"visa","label":"签证费","included":false}
  ]$$::jsonb,
  $$[
    {"label":"学历层次","value":"bachelor, master, doctoral"},
    {"label":"年龄限制","value":"≤35 岁"},
    {"label":"开放专业","value":"所有中、英文授课专业"},
    {"label":"申请时间","value":"每年 3 月 1 日至 5 月 30 日"}
  ]$$::jsonb,
  $$[
    {"label":"申请表","value":"《东北财经大学留学申请表》"},
    {"label":"学历证明","value":"最高学历证明；在校生需在学证明"},
    {"label":"成绩单","value":"学习成绩单"},
    {"label":"学习计划","value":"硕士或博士申请者需提交来华学习或研究计划"},
    {"label":"推荐信","value":"硕士或博士申请者需提交两封教授或副教授推荐信"}
  ]$$::jsonb,
  $$[
    {"label":"第 1 步","value":"登录 http://study.dufe.edu.cn 在线申请"},
    {"label":"第 2 步","value":"填写信息并生成申请表"},
    {"label":"第 3 步","value":"按学历层次提交成绩单、学历证明、学习计划和推荐信等材料"}
  ]$$::jsonb,
  $${
    "label":"联系方式",
    "email":"scholarship@dufe.edu.cn",
    "phone":"86-411-84712106",
    "website":"http://study.dufe.edu.cn",
    "address":"中国辽宁省大连市沙河口区尖山街 217 号，东北财经大学国际教育学院招生与国际项目部",
    "note":"备用电话：84710885；邮编：116025。"
  }$$::jsonb,
  $$[
    {"label":"前往申请","url":"http://study.dufe.edu.cn","kind":"primary"},
    {"label":"查看大学详情","url":"http://study.dufe.edu.cn","kind":"secondary"},
    {"label":"查看官方来源","url":"http://study.dufe.edu.cn","kind":"source"}
  ]$$::jsonb,
  '2026-05-30 00:00:00+00',
  '5月30日',
  '2026 年度申请',
  '[]'::jsonb,
  '[]'::jsonb,
  '["学费"]'::jsonb,
  'http://study.dufe.edu.cn',
  '东北财经大学国际教育学院',
  '2026-05-28 00:00:00+00',
  23,
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
JOIN "schools" school ON school."name_zh" = '东北财经大学'
WHERE scholarship.slug = 'dongbei-university-of-finance-and-economics-freshman-scholarship'
ON CONFLICT ("scholarship_id", "school_id") DO NOTHING;
