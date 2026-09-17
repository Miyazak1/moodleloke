ALTER TABLE "schools" ADD COLUMN "city_slug" VARCHAR(120);
ALTER TABLE "schools" ADD COLUMN "city_zh" VARCHAR(120);

UPDATE "schools"
SET
  "city_slug" = CASE
    WHEN lower(coalesce("region", '')) LIKE '%beijing%' OR coalesce("region", '') LIKE '%北京%' THEN 'beijing'
    WHEN lower(coalesce("region", '')) LIKE '%shanghai%' OR coalesce("region", '') LIKE '%上海%' THEN 'shanghai'
    WHEN lower(coalesce("region", '')) LIKE '%tianjin%' OR coalesce("region", '') LIKE '%天津%' THEN 'tianjin'
    WHEN lower(coalesce("region", '')) LIKE '%qingdao%' OR coalesce("region", '') LIKE '%青岛%' THEN 'qingdao'
    WHEN lower(coalesce("region", '')) LIKE '%nanjing%' OR coalesce("region", '') LIKE '%南京%' THEN 'nanjing'
    WHEN lower(coalesce("region", '')) LIKE '%hangzhou%' OR coalesce("region", '') LIKE '%杭州%' THEN 'hangzhou'
    WHEN lower(coalesce("region", '')) LIKE '%guangzhou%' OR coalesce("region", '') LIKE '%广州%' THEN 'guangzhou'
    WHEN lower(coalesce("region", '')) LIKE '%shenzhen%' OR coalesce("region", '') LIKE '%深圳%' THEN 'shenzhen'
    WHEN lower(coalesce("region", '')) LIKE '%wuhan%' OR coalesce("region", '') LIKE '%武汉%' THEN 'wuhan'
    WHEN lower(coalesce("region", '')) LIKE '%chengdu%' OR coalesce("region", '') LIKE '%成都%' THEN 'chengdu'
    WHEN lower(coalesce("region", '')) LIKE '%xian%' OR lower(coalesce("region", '')) LIKE '%xi''an%' OR coalesce("region", '') LIKE '%西安%' THEN 'xian'
    WHEN lower(coalesce("region", '')) LIKE '%harbin%' OR coalesce("region", '') LIKE '%哈尔滨%' THEN 'harbin'
    WHEN lower(coalesce("region", '')) LIKE '%dalian%' OR coalesce("region", '') LIKE '%大连%' THEN 'dalian'
    WHEN lower(coalesce("region", '')) LIKE '%shenyang%' OR coalesce("region", '') LIKE '%沈阳%' THEN 'shenyang'
    WHEN lower(coalesce("region", '')) LIKE '%jinan%' OR coalesce("region", '') LIKE '%济南%' THEN 'jinan'
    ELSE NULL
  END,
  "city_zh" = CASE
    WHEN lower(coalesce("region", '')) LIKE '%beijing%' OR coalesce("region", '') LIKE '%北京%' THEN '北京'
    WHEN lower(coalesce("region", '')) LIKE '%shanghai%' OR coalesce("region", '') LIKE '%上海%' THEN '上海'
    WHEN lower(coalesce("region", '')) LIKE '%tianjin%' OR coalesce("region", '') LIKE '%天津%' THEN '天津'
    WHEN lower(coalesce("region", '')) LIKE '%qingdao%' OR coalesce("region", '') LIKE '%青岛%' THEN '青岛'
    WHEN lower(coalesce("region", '')) LIKE '%nanjing%' OR coalesce("region", '') LIKE '%南京%' THEN '南京'
    WHEN lower(coalesce("region", '')) LIKE '%hangzhou%' OR coalesce("region", '') LIKE '%杭州%' THEN '杭州'
    WHEN lower(coalesce("region", '')) LIKE '%guangzhou%' OR coalesce("region", '') LIKE '%广州%' THEN '广州'
    WHEN lower(coalesce("region", '')) LIKE '%shenzhen%' OR coalesce("region", '') LIKE '%深圳%' THEN '深圳'
    WHEN lower(coalesce("region", '')) LIKE '%wuhan%' OR coalesce("region", '') LIKE '%武汉%' THEN '武汉'
    WHEN lower(coalesce("region", '')) LIKE '%chengdu%' OR coalesce("region", '') LIKE '%成都%' THEN '成都'
    WHEN lower(coalesce("region", '')) LIKE '%xian%' OR lower(coalesce("region", '')) LIKE '%xi''an%' OR coalesce("region", '') LIKE '%西安%' THEN '西安'
    WHEN lower(coalesce("region", '')) LIKE '%harbin%' OR coalesce("region", '') LIKE '%哈尔滨%' THEN '哈尔滨'
    WHEN lower(coalesce("region", '')) LIKE '%dalian%' OR coalesce("region", '') LIKE '%大连%' THEN '大连'
    WHEN lower(coalesce("region", '')) LIKE '%shenyang%' OR coalesce("region", '') LIKE '%沈阳%' THEN '沈阳'
    WHEN lower(coalesce("region", '')) LIKE '%jinan%' OR coalesce("region", '') LIKE '%济南%' THEN '济南'
    ELSE NULL
  END
WHERE "city_slug" IS NULL;

CREATE INDEX "idx_schools_status_city_rank" ON "schools"("status", "city_slug", "rank");
