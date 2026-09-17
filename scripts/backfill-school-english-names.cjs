const { PrismaClient } = require('@prisma/client');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const SCHOOL_NAME_EN_OVERRIDES = {
  '安徽大学': 'Anhui University',
  '北京大学': 'Peking University',
  '北京大学医学部': 'Peking University Health Science Center',
  '北京航空航天大学': 'Beihang University',
  '北京科技大学': 'University of Science and Technology Beijing',
  '北京理工大学': 'Beijing Institute of Technology',
  '北京师范大学': 'Beijing Normal University',
  '北京体育大学': 'Beijing Sport University',
  '北京语言大学': 'Beijing Language and Culture University',
  '清华大学': 'Tsinghua University',
  '大连交通大学': 'Dalian Jiaotong University',
  '大连理工大学': 'Dalian University of Technology',
  '电子科技大学': 'University of Electronic Science and Technology of China',
  '东华大学': 'Donghua University',
  '东南大学': 'Southeast University',
  '对外经济贸易大学': 'University of International Business and Economics',
  '复旦大学': 'Fudan University',
  '甘肃中医药大学': 'Gansu University of Chinese Medicine',
  '广东外语外贸大学': 'Guangdong University of Foreign Studies',
  '广西医科大学': 'Guangxi Medical University',
  '贵州医科大学': 'Guizhou Medical University',
  '哈尔滨工程大学': 'Harbin Engineering University',
  '哈尔滨工业大学深圳': 'Harbin Institute of Technology Shenzhen',
  '哈尔滨理工大学': 'Harbin University of Science and Technology',
  '河北经贸大学': 'Hebei University of Economics and Business',
  '华东师范大学': 'East China Normal University',
  '华东政法大学': 'East China University of Political Science and Law',
  '华中科技大学': 'Huazhong University of Science and Technology',
  '华中师范大学': 'Central China Normal University',
  '吉林大学': 'Jilin University',
  '暨南大学': 'Jinan University',
  '兰州大学': 'Lanzhou University',
  '辽宁中医药大学': 'Liaoning University of Traditional Chinese Medicine',
  '南京航空航天大学': 'Nanjing University of Aeronautics and Astronautics',
  '南京大学': 'Nanjing University',
  '南京理工大学': 'Nanjing University of Science and Technology',
  '南开大学': 'Nankai University',
  '南方科技大学': 'Southern University of Science and Technology',
  '青岛大学': 'Qingdao University',
  '厦门大学': 'Xiamen University',
  '山东师范大学': 'Shandong Normal University',
  '山东大学': 'Shandong University',
  '上海交通大学': 'Shanghai Jiao Tong University',
  '上海交通大学医学院': 'Shanghai Jiao Tong University School of Medicine',
  '上海外国语大学': 'Shanghai International Studies University',
  '上海政法学院': 'Shanghai University of Political Science and Law',
  '四川外国语大学': 'Sichuan International Studies University',
  '天津财经大学': 'Tianjin University of Finance and Economics',
  '天津大学': 'Tianjin University',
  '天津外国语大学': 'Tianjin Foreign Studies University',
  '同济大学': 'Tongji University',
  '西安交通大学': "Xi'an Jiaotong University",
  '西北工业大学': 'Northwestern Polytechnical University',
  '西南政法大学': 'Southwest University of Political Science and Law',
  '湘潭大学': 'Xiangtan University',
  '燕山大学': 'Yanshan University',
  '云南财经大学': 'Yunnan University of Finance and Economics',
  '云南民族大学': 'Yunnan Minzu University',
  '长安大学': "Chang'an University",
  '浙江大学': 'Zhejiang University',
  '浙江工商大学': 'Zhejiang Gongshang University',
  '浙江工业大学': 'Zhejiang University of Technology',
  '郑州大学': 'Zhengzhou University',
  '中国农业大学': 'China Agricultural University',
  '中国海洋大学': 'Ocean University of China',
  '中国科学技术大学': 'University of Science and Technology of China',
  '中国人民大学': 'Renmin University of China',
  '中国医科大学': 'China Medical University',
  '中南大学': 'Central South University',
  '中山大学': 'Sun Yat-sen University',
  '中央财经大学': 'Central University of Finance and Economics',
  '重庆大学': 'Chongqing University',
  '哈尔滨工业大学': 'Harbin Institute of Technology',
  '华南理工大学': 'South China University of Technology',
  '武汉大学': 'Wuhan University'
};

const SCHOOL_LOCATION_OVERRIDES = {
  '安徽大学': 'Hefei, East China',
  '北京大学': 'Beijing, North China',
  '北京大学医学部': 'Beijing, North China',
  '北京航空航天大学': 'Beijing, North China',
  '北京科技大学': 'Beijing, North China',
  '北京理工大学': 'Beijing, North China',
  '北京师范大学': 'Beijing, North China',
  '北京体育大学': 'Beijing, North China',
  '北京语言大学': 'Beijing, North China',
  '清华大学': 'Beijing, North China',
  '大连交通大学': 'Dalian, Northeast China',
  '大连理工大学': 'Dalian, Northeast China',
  '电子科技大学': 'Chengdu, Southwest China',
  '东华大学': 'Shanghai, East China',
  '东南大学': 'Nanjing, East China',
  '对外经济贸易大学': 'Beijing, North China',
  '复旦大学': 'Shanghai, East China',
  '甘肃中医药大学': 'Lanzhou, Northwest China',
  '广东外语外贸大学': 'Guangzhou, South China',
  '广西医科大学': 'Nanning, South China',
  '贵州医科大学': 'Guiyang, Southwest China',
  '哈尔滨工程大学': 'Harbin, Northeast China',
  '哈尔滨工业大学深圳': 'Shenzhen, South China',
  '哈尔滨理工大学': 'Harbin, Northeast China',
  '河北经贸大学': 'Shijiazhuang, North China',
  '华东师范大学': 'Shanghai, East China',
  '华东政法大学': 'Shanghai, East China',
  '华中科技大学': 'Wuhan, Central China',
  '华中师范大学': 'Wuhan, Central China',
  '吉林大学': 'Changchun, Northeast China',
  '暨南大学': 'Guangzhou, South China',
  '兰州大学': 'Lanzhou, Northwest China',
  '辽宁中医药大学': 'Shenyang, Northeast China',
  '南京航空航天大学': 'Nanjing, East China',
  '南京大学': 'Nanjing, East China',
  '南京理工大学': 'Nanjing, East China',
  '南开大学': 'Tianjin, North China',
  '南方科技大学': 'Shenzhen, South China',
  '青岛大学': 'Qingdao, East China',
  '厦门大学': 'Xiamen, East China',
  '山东师范大学': 'Jinan, East China',
  '山东大学': 'Jinan, East China',
  '上海交通大学': 'Shanghai, East China',
  '上海交通大学医学院': 'Shanghai, East China',
  '上海外国语大学': 'Shanghai, East China',
  '上海政法学院': 'Shanghai, East China',
  '四川外国语大学': 'Chongqing, Southwest China',
  '天津财经大学': 'Tianjin, North China',
  '天津大学': 'Tianjin, North China',
  '天津外国语大学': 'Tianjin, North China',
  '同济大学': 'Shanghai, East China',
  '西安交通大学': "Xi'an, Northwest China",
  '西北工业大学': "Xi'an, Northwest China",
  '西南政法大学': 'Chongqing, Southwest China',
  '湘潭大学': 'Xiangtan, Central China',
  '燕山大学': 'Qinhuangdao, North China',
  '云南财经大学': 'Kunming, Southwest China',
  '云南民族大学': 'Kunming, Southwest China',
  '长安大学': "Xi'an, Northwest China",
  '浙江大学': 'Hangzhou, East China',
  '浙江工商大学': 'Hangzhou, East China',
  '浙江工业大学': 'Hangzhou, East China',
  '郑州大学': 'Zhengzhou, Central China',
  '中国农业大学': 'Beijing, North China',
  '中国海洋大学': 'Qingdao, East China',
  '中国科学技术大学': 'Hefei, East China',
  '中国人民大学': 'Beijing, North China',
  '中国医科大学': 'Shenyang, Northeast China',
  '中南大学': 'Changsha, Central China',
  '中山大学': 'Guangzhou, South China',
  '中央财经大学': 'Beijing, North China',
  '重庆大学': 'Chongqing, Southwest China',
  '哈尔滨工业大学': 'Harbin, Northeast China',
  '华南理工大学': 'Guangzhou, South China',
  '武汉大学': 'Wuhan, Central China'
};

const SCHOOL_WEBSITE_OVERRIDES = {
  '安徽大学': 'https://www.ahu.edu.cn/',
  '北京大学': 'https://www.pku.edu.cn/',
  '北京大学医学部': 'http://www.bjmu.edu.cn/',
  '北京航空航天大学': 'https://www.buaa.edu.cn/',
  '北京科技大学': 'https://www.ustb.edu.cn/',
  '北京理工大学': 'https://www.bit.edu.cn/',
  '北京师范大学': 'https://www.bnu.edu.cn/',
  '北京体育大学': 'https://www.bsu.edu.cn/',
  '北京语言大学': 'https://www.blcu.edu.cn/',
  '清华大学': 'https://www.tsinghua.edu.cn/',
  '大连交通大学': 'https://www.djtu.edu.cn/',
  '大连理工大学': 'https://www.dlut.edu.cn/',
  '电子科技大学': 'https://www.uestc.edu.cn/',
  '东华大学': 'https://www.dhu.edu.cn/',
  '对外经济贸易大学': 'https://www.uibe.edu.cn/',
  '复旦大学': 'https://www.fudan.edu.cn/',
  '甘肃中医药大学': 'https://www.gszy.edu.cn/',
  '广东外语外贸大学': 'https://www.gdufs.edu.cn/',
  '广西医科大学': 'https://www.gxmu.edu.cn/',
  '贵州医科大学': 'https://www.gmc.edu.cn/',
  '哈尔滨工程大学': 'https://www.hrbeu.edu.cn/',
  '哈尔滨工业大学深圳': 'https://www.hitsz.edu.cn/',
  '哈尔滨理工大学': 'https://www.hrbust.edu.cn/',
  '河北经贸大学': 'https://www.hueb.edu.cn/',
  '华东师范大学': 'https://www.ecnu.edu.cn/',
  '华东政法大学': 'https://www.ecupl.edu.cn/',
  '华中科技大学': 'https://www.hust.edu.cn/',
  '华中师范大学': 'https://www.ccnu.edu.cn/',
  '吉林大学': 'https://www.jlu.edu.cn/',
  '暨南大学': 'https://www.jnu.edu.cn/',
  '辽宁中医药大学': 'https://www.lnutcm.edu.cn/',
  '南京大学': 'https://www.nju.edu.cn/',
  '南开大学': 'https://www.nankai.edu.cn/',
  '青岛大学': 'https://www.qdu.edu.cn/',
  '厦门大学': 'https://www.xmu.edu.cn/',
  '山东师范大学': 'https://www.sdnu.edu.cn/',
  '上海交通大学': 'https://www.sjtu.edu.cn/',
  '上海交通大学医学院': 'https://www.shsmu.edu.cn/',
  '上海外国语大学': 'https://www.shisu.edu.cn/',
  '上海政法学院': 'https://www.shupl.edu.cn/',
  '四川外国语大学': 'https://www.sisu.edu.cn/',
  '天津财经大学': 'https://www.tjufe.edu.cn/',
  '天津大学': 'https://www.tju.edu.cn/',
  '天津外国语大学': 'https://www.tjfsu.edu.cn/',
  '同济大学': 'https://www.tongji.edu.cn/',
  '西安交通大学': 'https://www.xjtu.edu.cn/',
  '西北工业大学': 'https://www.nwpu.edu.cn/',
  '西南政法大学': 'https://www.swupl.edu.cn/',
  '湘潭大学': 'https://www.xtu.edu.cn/',
  '燕山大学': 'https://www.ysu.edu.cn/',
  '云南财经大学': 'https://www.ynufe.edu.cn/',
  '云南民族大学': 'https://www.ynni.edu.cn/',
  '长安大学': 'https://www.chd.edu.cn/',
  '浙江大学': 'https://www.zju.edu.cn/',
  '浙江工商大学': 'https://www.zjgsu.edu.cn/',
  '浙江工业大学': 'https://www.zjut.edu.cn/',
  '郑州大学': 'https://www.zzu.edu.cn/',
  '中国海洋大学': 'https://www.ouc.edu.cn/',
  '中国科学技术大学': 'https://www.ustc.edu.cn/',
  '中国人民大学': 'https://www.ruc.edu.cn/',
  '中国医科大学': 'https://www.cmu.edu.cn/',
  '中南大学': 'https://www.csu.edu.cn/',
  '中央财经大学': 'https://www.cufe.edu.cn/',
  '武汉大学': 'https://www.whu.edu.cn/'
};

async function main() {
  const prisma = new PrismaClient();
  try {
    let updatedNames = 0;
    let updatedLocations = 0;
    let updatedWebsites = 0;
    for (const [nameZh, nameEn] of Object.entries(SCHOOL_NAME_EN_OVERRIDES)) {
      const result = await prisma.school.updateMany({
        where: {
          nameZh,
          OR: [{ nameEn: null }, { nameEn: '' }]
        },
        data: { nameEn }
      });
      updatedNames += result.count;
    }
    for (const [nameZh, region] of Object.entries(SCHOOL_LOCATION_OVERRIDES)) {
      const result = await prisma.school.updateMany({
        where: {
          nameZh,
          OR: [{ region: null }, { region: '' }]
        },
        data: { region }
      });
      updatedLocations += result.count;
    }
    for (const [nameZh, officialWebsite] of Object.entries(SCHOOL_WEBSITE_OVERRIDES)) {
      const result = await prisma.school.updateMany({
        where: {
          nameZh,
          OR: [{ officialWebsite: null }, { officialWebsite: '' }]
        },
        data: { officialWebsite }
      });
      updatedWebsites += result.count;
    }
    console.log(`Backfilled ${updatedNames} school English names, ${updatedLocations} school locations, and ${updatedWebsites} school websites.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
