/* SEED — 供 server migrate 寫入 site_content.menu（預設全部 published:true）。
   亦供後台／IG 在 DB 尚無 menu 時作 fallback 原料。
   來源：在咖啡飲品＝IG 貼文 DM7R4JMy54U（2025-08-04）；餐點＝260815_言文字_菜單產品_V1.xlsx；
   三點水酒精飲品＝同 IG 貼文 ALCOHOL 頁。單一售價，未填 emo 即不顯示會員價。
   強制覆寫：啟動時設 FORCE_MENU_SEED=1（勿長期開啟）。 */
'use strict';
window.__MENU_SEED = [
  // ══ 在咖啡 ══
  // ── COFFEE ──
  { venue:'CAFE', cat:'COFFEE', zh:'拿鐵咖啡',   en:'LATTE',              price:180 },
  { venue:'CAFE', cat:'COFFEE', zh:'卡布奇諾',   en:'CAPPUCCINO',         price:180 },
  { venue:'CAFE', cat:'COFFEE', zh:'美式咖啡',   en:'AMERICANO',          price:150 },
  { venue:'CAFE', cat:'COFFEE', zh:'手沖咖啡',   en:'POUR OVER COFFEE',   price:200 },
  { venue:'CAFE', cat:'COFFEE', zh:'貝里斯拿鐵', en:'BELIZE LATTE',       price:200, note:'含酒精', alcohol:true },
  { venue:'CAFE', cat:'COFFEE', zh:'愛爾蘭咖啡', en:'IRISH COFFEE',       price:200, note:'含酒精', alcohol:true },
  { venue:'CAFE', cat:'COFFEE', zh:'維也納咖啡', en:'VIENNESE COFFEE',    price:180 },
  { venue:'CAFE', cat:'COFFEE', zh:'西西里咖啡', en:'ESPRESSO ROMANO',    price:180, note:'冰飲' },
  { venue:'CAFE', cat:'COFFEE', zh:'黑糖拿鐵',   en:'BROWN SUGAR LATTE',  price:190 },
  { venue:'CAFE', cat:'COFFEE', zh:'焦糖拿鐵',   en:'CARAMEL LATTE',      price:190 },
  // ── TEA ──
  { venue:'CAFE', cat:'TEA', zh:'果茶（壺）',   en:'FRUIT TEA',  price:220, note:'熱飲' },
  { venue:'CAFE', cat:'TEA', zh:'草本茶（壺）', en:'HERBAL TEA', price:200, note:'熱飲' },
  { venue:'CAFE', cat:'TEA', zh:'布蕾紅茶（壺）', en:'BRULEE TEA', price:200, note:'熱飲' },
  // ── BEVERAGE ──
  { venue:'CAFE', cat:'BEVERAGE', zh:'極品可可拿鐵', en:'COCOA LATTE',         price:220 },
  { venue:'CAFE', cat:'BEVERAGE', zh:'玄米抹茶拿鐵', en:'GENMAICHA LATTE',     price:220 },
  { venue:'CAFE', cat:'BEVERAGE', zh:'焦糖牛奶',     en:'CARAMEL MILK',        price:180 },
  { venue:'CAFE', cat:'BEVERAGE', zh:'黑糖牛奶',     en:'BROWN SUGAR MILK',    price:180 },
  { venue:'CAFE', cat:'BEVERAGE', zh:'芒果牛奶',     en:'MANGO MILK',          price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'荔枝牛奶',     en:'LYCHEE MILK',         price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'莓果氣泡飲',   en:'BERRY SPARKLING',     price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'蜜桃氣泡飲',   en:'PEACH SPARKLING',     price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'紅柚氣泡飲',   en:'GRAPEFRUIT SPARKLING', price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'鳳梨氣泡飲',   en:'PINEAPPLE SPARKLING', price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'芒果氣泡飲',   en:'MANGO SPARKLING',     price:180, note:'冰飲' },
  { venue:'CAFE', cat:'BEVERAGE', zh:'荔枝氣泡飲',   en:'LYCHEE SPARKLING',    price:180, note:'冰飲' },
  // ── SALAD ──
  { venue:'CAFE', cat:'SALAD', zh:'生火腿酪梨希臘優格沙拉碗', en:'PROSCIUTTO AVOCADO GREEK YOGURT BOWL', price:220, note:'附蜂蜜柚子油醋生菜沙拉' },
  // ── BREAD ──
  { venue:'CAFE', cat:'BREAD', zh:'燻鮭魚酪梨蒔蘿奶油起司開放三明治', en:'SMOKED SALMON AVOCADO OPEN SANDWICH', price:300, note:'附沙拉與優格' },
  { venue:'CAFE', cat:'BREAD', zh:'奶油野菇蛋沙拉開放三明治',         en:'MUSHROOM EGG SALAD OPEN SANDWICH',    price:250, note:'蛋奶素・附沙拉與優格' },
  { venue:'CAFE', cat:'BREAD', zh:'無花果核桃蜂蜜奶油起司貝果',       en:'FIG WALNUT HONEY CREAM CHEESE BAGEL', price:120 },
  { venue:'CAFE', cat:'BREAD', zh:'原味貝果',                         en:'PLAIN BAGEL',                         price:80,  note:'奶油起司＋果醬加購 20' },
  { venue:'CAFE', cat:'BREAD', zh:'鹽麴烤雞柚子胡椒貝果',             en:'SHIO KOJI CHICKEN YUZU KOSHO BAGEL',  price:130 },
  { venue:'CAFE', cat:'BREAD', zh:'明太子美式炒蛋可頌',               en:'MENTAIKO SCRAMBLED EGG CROISSANT',    price:300, note:'附沙拉與優格' },
  // ── JAPANESE ──
  { venue:'CAFE', cat:'JAPANESE', zh:'鹽漬鮭魚鬆昆布飯糰', en:'SALTED SALMON KOMBU ONIGIRI',  price:80,  note:'套餐 180（附沙拉與冷豆腐）' },
  { venue:'CAFE', cat:'JAPANESE', zh:'海苔奶油雞肉飯糰',   en:'NORI BUTTER CHICKEN ONIGIRI',  price:80,  note:'套餐 180（附沙拉與冷豆腐）' },
  { venue:'CAFE', cat:'JAPANESE', zh:'鹽麴烤雞冷蕎麥麵',   en:'SHIO KOJI CHICKEN COLD SOBA',  price:250, note:'附柴魚醬油冷豆腐' },
  // ── DESSERT ──
  { venue:'CAFE', cat:'DESSERT', zh:'茶香海鹽焦糖法式吐司', en:'TEA & SALTED CARAMEL FRENCH TOAST', price:280 },
  { venue:'CAFE', cat:'DESSERT', zh:'自製布丁・鹹鮮奶油',   en:'HOUSE PUDDING',                    price:80 },
  { venue:'CAFE', cat:'DESSERT', zh:'巴斯克蛋糕',           en:'BASQUE CHEESECAKE',                price:120 },
  { venue:'CAFE', cat:'DESSERT', zh:'可麗露',               en:'CANELÉ',                           price:80 },
  { venue:'CAFE', cat:'DESSERT', zh:'戚風蛋糕・風味鮮奶油', en:'CHIFFON CAKE',                     price:180 },

  // ══ 三點水 ══
  // ── ALCOHOL ──
  { venue:'BAR', cat:'ALCOHOL', zh:'是花生醬！', en:'DARK BEER',        price:220 },
  { venue:'BAR', cat:'ALCOHOL', zh:'琴通寧',     en:'GIN TONIC',        price:250 },
  { venue:'BAR', cat:'ALCOHOL', zh:'螺絲起子',   en:'SCREWDRIVER',      price:250 },
  { venue:'BAR', cat:'ALCOHOL', zh:'高球',       en:'HIGH BALL',        price:250 },
  { venue:'BAR', cat:'ALCOHOL', zh:'月黑風高',   en:"DARK 'N' STORMY",  price:250 },
  { venue:'BAR', cat:'ALCOHOL', zh:'馬丁尼',     en:'MARTINI',          price:300 },
  { venue:'BAR', cat:'ALCOHOL', zh:'內格羅尼',   en:'NEGRONI',          price:300 },
  { venue:'BAR', cat:'ALCOHOL', zh:'瑪格麗特',   en:'MARGARITA',        price:300 },
  { venue:'BAR', cat:'ALCOHOL', zh:'長島冰茶',   en:'LONG ISLAND',      price:300 },
  { venue:'BAR', cat:'ALCOHOL', zh:'隨意',       en:'UP TO YOU',        price:350 },
  // ── COLD_APP ──
  { venue:'BAR', cat:'COLD_APP', zh:'青蘋果山葵鮭魚塔塔・海苔薄脆',       en:'SALMON TARTARE & NORI CRISPS',   price:290 },
  { venue:'BAR', cat:'COLD_APP', zh:'焙茶漬番茄・豆乳乳酪醬・昆布橄欖油', en:'HOJICHA MARINATED TOMATO',       price:220 },
  { venue:'BAR', cat:'COLD_APP', zh:'胡麻冷豆腐・鹽昆布・青蔥辣油・天婦羅花', en:'SESAME COLD TOFU',           price:200 },
  // ── HOT_APP ──
  { venue:'BAR', cat:'HOT_APP', zh:'白味噌優格炙燒花椰菜・七味青蔥油', en:'MISO YOGURT CHARRED CAULIFLOWER', price:240 },
  { venue:'BAR', cat:'HOT_APP', zh:'柚子胡椒奶油蛤蜊・炙烤切片法棍',   en:'YUZU KOSHO BUTTER CLAMS',         price:320 },
  // ── FRIED ──
  { venue:'BAR', cat:'FRIED', zh:'紫蘇南蠻炸雞・煙燻蘿蔔塔塔醬',   en:'SHISO NANBAN KARAAGE',  price:320 },
  { venue:'BAR', cat:'FRIED', zh:'海苔帕瑪森薯條・辛子照燒美乃滋', en:'NORI PARMESAN FRIES',   price:220 },
  { venue:'BAR', cat:'FRIED', zh:'炸舞菇・梅子柴魚蘿蔔泥天露',     en:'FRIED MAITAKE',         price:250 },
  // ── GRILL ──
  { venue:'BAR', cat:'GRILL', zh:'鹽麴炙烤豬梅花・燒蔥芥末醬',         en:'SHIO KOJI GRILLED PORK COLLAR',    price:390 },
  { venue:'BAR', cat:'GRILL', zh:'炙烤海大蝦・青蔥山椒醬',             en:'GRILLED KING PRAWNS',              price:450 },
  { venue:'BAR', cat:'GRILL', zh:'黑蒜味噌烤櫛瓜與杏鮑菇・炸蕎麥',     en:'BLACK GARLIC MISO GRILLED VEGGIES', price:280 },
  // ── MAIN ──
  { venue:'BAR', cat:'MAIN', zh:'赤味噌牛豬肉醬烏龍麵・溫泉蛋',           en:'AKA MISO MEAT SAUCE UDON',        price:380 },
  { venue:'BAR', cat:'MAIN', zh:'焦香野菇醬油奶油炒蕎麥麵・溫泉蛋',       en:'MUSHROOM SOY BUTTER YAKISOBA',    price:360, note:'蛋奶素' },
  { venue:'BAR', cat:'MAIN', zh:'炙燒明太子烤飯糰出汁茶泡飯・紫蘇山葵',   en:'MENTAIKO YAKI ONIGIRI OCHAZUKE',  price:350 },
  { venue:'BAR', cat:'MAIN', zh:'日式番茄雞肉乾咖哩・半熟蛋',             en:'TOMATO CHICKEN DRY CURRY',        price:350 },
  // ── SOUP ──
  { venue:'BAR', cat:'SOUP', zh:'青海苔蜆肉生薑清湯', en:'CLAM & GINGER CLEAR SOUP', price:190 },
];
// 向後相容：舊程式碼可能仍讀 window.MENU_DATA；admin.html 會在讀到 DB 資料後覆寫此值。
window.MENU_DATA = window.__MENU_SEED;
