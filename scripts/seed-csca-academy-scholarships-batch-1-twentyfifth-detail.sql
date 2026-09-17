INSERT INTO "scholarships" (
  "slug","title","type","funding_level","provider_name","provider_name_en","provider_location",
  "summary","coverage","applicable_degree","applicable_program","amount_text","requirement_text",
  "body_sections","benefit_items","eligibility_items","application_materials","application_steps",
  "contact_info","action_links","deadline_date","deadline_label","application_round",
  "target_countries","target_regions","benefits","source_url","source_label","last_verified_at",
  "sort_order","status","created_at","updated_at"
) VALUES (
  'southeast-university-president-scholarship',
  '东南大学校长奖学金',
  'university',
  'full',
  '东南大学',
  'Southeast University',
  'Nanjing, East China',
  '东南大学留学生奖学金分为两类：第一类参照留学基金委标准，免报名费、学费、书本费、住宿费、医疗保险费，并每年提供生活津贴不少于两万元；第二类免报名费、学费、医疗保险费，无生活津贴和住宿费补贴。',
  '第一类：免报名费、学费、书本费、住宿费、医疗保险费，并提供每年不少于两万元生活津贴；第二类：免报名费、学费、医疗保险费，无生活津贴和住宿费补贴。',
  'bachelor, master, doctoral',
  '以东南大学开放招生专业为准。',
  '第一类：免报名费、学费、书本费、住宿费、医疗保险费，并每年提供生活津贴不少于两万元；第二类：免报名费、学费、医疗保险费，无生活津贴、无住宿费补贴。',
  '一、奖学金内容和标准
东南大学留学生奖学金分为以下两类：
第一类：参照留学基金委的标准，报名费、学费、书本费、住宿费、医疗保险费全免，每年生活津贴不少于两万元。该类奖学金仅提供给博士研究生申请人和非常优秀的硕士研究生申请人。
第二类：免报名费、学费、医疗保险费，无生活津贴，无住宿费补贴。该类奖学金所有研究生申请人都可以申请。

二、申请人资格
16 周岁以上，本科以上学历，身体健康，外国公民。

三、申请日期
12 月 1 日至 5 月 30 日。

四、申请流程/途径
请将申请材料在规定时间内寄送 2 份至东南大学海外教育学院招生办公室，地址为江苏南京四牌楼 2 号，邮编 210096；并发送至邮箱 admission@seu.edu.cn。

五、申请所需材料
护照复印件；体检表；最高学位证书；成绩单；推荐信 2 封；研究生期间研究计划（不少于 800 字）；东南大学留学生申请表格。

六、受理部门
东南大学海外教育学院招生办公室。

七、联系方式
中国东南大学海外教育学院招生办公室；地址：中国南京四牌楼 2 号；邮编：210096；电话：0086-25-83793022 / 83792797；传真：0086-25-83792737；E-mail：admission@seu.edu.cn；网址：http://cis.seu.edu.cn。',
  $$[
    {"title":"奖学金内容和标准","items":["第一类：参照留学基金委标准，免报名费、学费、书本费、住宿费、医疗保险费，并每年提供生活津贴不少于两万元；仅提供给博士研究生申请人和非常优秀的硕士研究生申请人。","第二类：免报名费、学费、医疗保险费，无生活津贴，无住宿费补贴；所有研究生申请人都可以申请。"]},
    {"title":"申请人资格","items":["16 周岁以上。","本科以上学历。","身体健康。","外国公民。"]},
    {"title":"申请日期","paragraphs":["12 月 1 日至 5 月 30 日。"]},
    {"title":"申请流程/途径","paragraphs":["请将申请材料在规定时间内寄送 2 份至东南大学海外教育学院招生办公室，地址为江苏南京四牌楼 2 号，邮编 210096，并发送至邮箱 admission@seu.edu.cn。"]},
    {"title":"申请所需材料","items":["护照复印件。","体检表。","最高学位证书。","成绩单。","推荐信 2 封。","研究生期间研究计划，不少于 800 字。","东南大学留学生申请表格。"]},
    {"title":"受理部门","paragraphs":["东南大学海外教育学院招生办公室。"]},
    {"title":"联系方式","paragraphs":["中国东南大学海外教育学院招生办公室；地址：中国南京四牌楼 2 号；邮编：210096；电话：0086-25-83793022 / 83792797；传真：0086-25-83792737；E-mail：admission@seu.edu.cn；网址：http://cis.seu.edu.cn。"]}
  ]$$::jsonb,
  $$[
    {"key":"tuition","label":"学费","included":true},
    {"key":"accommodation","label":"住宿费","included":true,"note":"第一类包含住宿费，第二类不含。"},
    {"key":"stipend","label":"生活费","included":false,"note":"第一类每年生活津贴不少于两万元，第二类无生活津贴。"},
    {"key":"medical-insurance","label":"医疗保险","included":true},
    {"key":"flight","label":"机票","included":false},
    {"key":"visa","label":"签证费","included":false},
    {"key":"application-fee","label":"报名费","included":true},
    {"key":"books","label":"书本费","included":true,"note":"第一类包含书本费。"}
  ]$$::jsonb,
  $$[
    {"label":"学历层次","value":"bachelor, master, doctoral"},
    {"label":"年龄限制","value":"16 周岁以上"},
    {"label":"申请时间","value":"12月1日至5月30日"},
    {"label":"重点对象","value":"博士研究生申请人和优秀硕士研究生申请人"}
  ]$$::jsonb,
  $$[
    {"label":"护照","value":"护照复印件"},
    {"label":"体检表","value":"体检表"},
    {"label":"学历证明","value":"最高学位证书"},
    {"label":"成绩单","value":"成绩单"},
    {"label":"推荐信","value":"推荐信 2 封"},
    {"label":"研究计划","value":"研究生期间研究计划，不少于 800 字"},
    {"label":"申请表","value":"东南大学留学生申请表格"}
  ]$$::jsonb,
  $$[
    {"label":"第 1 步","value":"准备申请材料一式两份"},
    {"label":"第 2 步","value":"按规定时间寄送至东南大学海外教育学院招生办公室"},
    {"label":"第 3 步","value":"将电子版发送至 admission@seu.edu.cn"}
  ]$$::jsonb,
  $${
    "label":"联系方式",
    "email":"admission@seu.edu.cn",
    "phone":"0086-25-83793022",
    "website":"http://cis.seu.edu.cn",
    "address":"中国南京四牌楼 2 号，东南大学海外教育学院招生办公室",
    "note":"备用电话：83792797；传真：0086-25-83792737；邮编：210096。"
  }$$::jsonb,
  $$[
    {"label":"前往申请","url":"http://cis.seu.edu.cn","kind":"primary"},
    {"label":"查看大学详情","url":"http://cis.seu.edu.cn","kind":"secondary"},
    {"label":"查看官方来源","url":"http://cis.seu.edu.cn","kind":"source"}
  ]$$::jsonb,
  '2026-05-30 00:00:00+00',
  '5月30日',
  '2026 年度申请',
  '[]'::jsonb,
  '[]'::jsonb,
  '["报名费","学费","书本费","住宿费","医疗保险"]'::jsonb,
  'http://cis.seu.edu.cn',
  '东南大学海外教育学院',
  '2026-05-28 00:00:00+00',
  25,
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
JOIN "schools" school ON school."name_zh" = '东南大学'
WHERE scholarship.slug = 'southeast-university-president-scholarship'
ON CONFLICT ("scholarship_id", "school_id") DO NOTHING;
