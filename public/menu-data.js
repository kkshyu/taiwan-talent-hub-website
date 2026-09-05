/* SEED — 供 server migrate 寫入 site_content.menu（預設全部 published:true）。
   亦供後台／IG 在 DB 尚無 menu 時作 fallback 原料。
   來源：在咖啡飲品＝IG 貼文 DM7R4JMy54U（2025-08-04）；餐點＝260815_言文字_菜單產品_V1.xlsx；
   三點水酒精飲品＝同 IG 貼文 ALCOHOL 頁。單一售價，未填 emo 即不顯示會員價。image＝示意圖（Unsplash）。
   強制覆寫：啟動時設 FORCE_MENU_SEED=1（勿長期開啟）。 */
'use strict';
// ponytail: 示意圖暫用 Unsplash 熱鏈（Unsplash License 可商用）；實拍後由後台上傳取代
var U = function (id) { return 'https://images.unsplash.com/photo-' + id + '?w=480&h=480&fit=crop&q=70'; };
window.__MENU_SEED = [
  // ══ 在咖啡 ══
  // ── COFFEE ──
  { venue:'CAFE', cat:'COFFEE', zh:'拿鐵咖啡',   en:'LATTE',              price:180, image:U('1541167760496-1628856ab772') },
  { venue:'CAFE', cat:'COFFEE', zh:'卡布奇諾',   en:'CAPPUCCINO',         price:180, image:U('1502462041640-b3d7e50d0662') },
  { venue:'CAFE', cat:'COFFEE', zh:'美式咖啡',   en:'AMERICANO',          price:150, image:U('1551030173-122aabc4489c') },
  { venue:'CAFE', cat:'COFFEE', zh:'手沖咖啡',   en:'POUR OVER COFFEE',   price:200, image:U('1442512595331-e89e73853f31') },
  { venue:'CAFE', cat:'COFFEE', zh:'貝里斯拿鐵', en:'BELIZE LATTE',       price:200, note:'含酒精', alcohol:true, image:U('1461023058943-07fcbe16d735') },
  { venue:'CAFE', cat:'COFFEE', zh:'愛爾蘭咖啡', en:'IRISH COFFEE',       price:200, note:'含酒精', alcohol:true, image:U('1730190982117-4106871e1f47') },
  { venue:'CAFE', cat:'COFFEE', zh:'維也納咖啡', en:'VIENNESE COFFEE',    price:180, image:U('1551198297-0a648941bd7b') },
  { venue:'CAFE', cat:'COFFEE', zh:'西西里咖啡', en:'ESPRESSO ROMANO',    price:180, note:'冰飲', image:U('1610889556528-9a770e32642f') },
  { venue:'CAFE', cat:'COFFEE', zh:'黑糖拿鐵',   en:'BROWN SUGAR LATTE',  price:190, image:U('1653122025505-eb23942cf527') },
  { venue:'CAFE', cat:'COFFEE', zh:'焦糖拿鐵',   en:'CARAMEL LATTE',      price:190, image:U('1579888071069-c107a6f79d82') },
  // ── TEA ──
  { venue:'CAFE', cat:'TEA', zh:'果茶（壺）',   en:'FRUIT TEA',  price:220, note:'熱飲', image:U('1698302659204-ab2e13ac9e55') },
  { venue:'CAFE', cat:'TEA', zh:'草本茶（壺）', en:'HERBAL TEA', price:200, note:'熱飲', image:U('1675155337816-5002bb718d73') },
  { venue:'CAFE', cat:'TEA', zh:'布蕾紅茶（壺）', en:'BRULEE TEA', price:200, note:'熱飲', image:U('1579904380653-bca3242e4594') },
  // ── BEVERAGE ──
  { venue:'CAFE', cat:'BEVERAGE', zh:'極品可可拿鐵', en:'COCOA LATTE',         price:220, image:U('1542990253-0d0f5be5f0ed') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'玄米抹茶拿鐵', en:'GENMAICHA LATTE',     price:220, image:U('1717603545758-88cc454db69b') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'焦糖牛奶',     en:'CARAMEL MILK',        price:180, image:U('1546470427-0d4db154ceb7') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'黑糖牛奶',     en:'BROWN SUGAR MILK',    price:180, image:U('1553909489-ec2175ef3f52') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'芒果牛奶',     en:'MANGO MILK',          price:180, note:'冰飲', image:U('1623065422902-30a2d299bbe4') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'荔枝牛奶',     en:'LYCHEE MILK',         price:180, note:'冰飲', image:U('1664512298340-8df247f52488') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'莓果氣泡飲',   en:'BERRY SPARKLING',     price:180, note:'冰飲', image:U('1623227314867-33230da9b493') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'蜜桃氣泡飲',   en:'PEACH SPARKLING',     price:180, note:'冰飲', image:U('1634976245495-443328555f70') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'紅柚氣泡飲',   en:'GRAPEFRUIT SPARKLING', price:180, note:'冰飲', image:U('1605002619338-0ed11beb1485') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'鳳梨氣泡飲',   en:'PINEAPPLE SPARKLING', price:180, note:'冰飲', image:U('1626388877564-269967fb8ba7') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'芒果氣泡飲',   en:'MANGO SPARKLING',     price:180, note:'冰飲', image:U('1525385133512-2f3bdd039054') },
  { venue:'CAFE', cat:'BEVERAGE', zh:'荔枝氣泡飲',   en:'LYCHEE SPARKLING',    price:180, note:'冰飲', image:U('1637774139377-457198b5fecf') },
  // ── SALAD ──
  { venue:'CAFE', cat:'SALAD', zh:'生火腿酪梨希臘優格沙拉碗', en:'PROSCIUTTO AVOCADO GREEK YOGURT BOWL', price:220, note:'附蜂蜜柚子油醋生菜沙拉', image:U('1597776776723-0153bbc0d3ad') },
  // ── BREAD ──
  { venue:'CAFE', cat:'BREAD', zh:'燻鮭魚酪梨蒔蘿奶油起司開放三明治', en:'SMOKED SALMON AVOCADO OPEN SANDWICH', price:300, note:'附沙拉與優格', image:U('1768482303665-ed751d06af5f') },
  { venue:'CAFE', cat:'BREAD', zh:'奶油野菇蛋沙拉開放三明治',         en:'MUSHROOM EGG SALAD OPEN SANDWICH',    price:250, note:'蛋奶素・附沙拉與優格', image:U('1631637214648-2c6fd7f947ae') },
  { venue:'CAFE', cat:'BREAD', zh:'無花果核桃蜂蜜奶油起司貝果',       en:'FIG WALNUT HONEY CREAM CHEESE BAGEL', price:120, image:U('1707079408137-cc73e9ef71c2') },
  { venue:'CAFE', cat:'BREAD', zh:'原味貝果',                         en:'PLAIN BAGEL',                         price:80,  note:'奶油起司＋果醬加購 20', image:U('1726733947933-a9e406f84d9a') },
  { venue:'CAFE', cat:'BREAD', zh:'鹽麴烤雞柚子胡椒貝果',             en:'SHIO KOJI CHICKEN YUZU KOSHO BAGEL',  price:130, image:U('1726733860096-34a3fbae77c5') },
  { venue:'CAFE', cat:'BREAD', zh:'明太子美式炒蛋可頌',               en:'MENTAIKO SCRAMBLED EGG CROISSANT',    price:300, note:'附沙拉與優格', image:U('1771285119294-96a87cd118ab') },
  // ── JAPANESE ──
  { venue:'CAFE', cat:'JAPANESE', zh:'鹽漬鮭魚鬆昆布飯糰', en:'SALTED SALMON KOMBU ONIGIRI',  price:80,  note:'套餐 180（附沙拉與冷豆腐）', image:U('1696463469919-def9b2830857') },
  { venue:'CAFE', cat:'JAPANESE', zh:'海苔奶油雞肉飯糰',   en:'NORI BUTTER CHICKEN ONIGIRI',  price:80,  note:'套餐 180（附沙拉與冷豆腐）', image:U('1696463469925-77c6b7d9f0d6') },
  { venue:'CAFE', cat:'JAPANESE', zh:'鹽麴烤雞冷蕎麥麵',   en:'SHIO KOJI CHICKEN COLD SOBA',  price:250, note:'附柴魚醬油冷豆腐', image:U('1766634001888-5d632d62689a') },
  // ── DESSERT ──
  { venue:'CAFE', cat:'DESSERT', zh:'茶香海鹽焦糖法式吐司', en:'TEA & SALTED CARAMEL FRENCH TOAST', price:280, image:U('1639108094328-2b94a49b1c2e') },
  { venue:'CAFE', cat:'DESSERT', zh:'自製布丁・鹹鮮奶油',   en:'HOUSE PUDDING',                    price:80, image:U('1702728109878-c61a98d80491') },
  { venue:'CAFE', cat:'DESSERT', zh:'巴斯克蛋糕',           en:'BASQUE CHEESECAKE',                price:120, image:U('1638519651608-412009302a02') },
  { venue:'CAFE', cat:'DESSERT', zh:'可麗露',               en:'CANELÉ',                           price:80, image:U('1593353994452-97b4560c50c2') },
  { venue:'CAFE', cat:'DESSERT', zh:'戚風蛋糕・風味鮮奶油', en:'CHIFFON CAKE',                     price:180, image:U('1620483603410-adc93e737181') },

  // ══ 三點水 ══
  // ── ALCOHOL ──
  { venue:'BAR', cat:'ALCOHOL', zh:'是花生醬！', en:'DARK BEER',        price:220, image:U('1723623121806-7a31e9a7b28e') },
  { venue:'BAR', cat:'ALCOHOL', zh:'琴通寧',     en:'GIN TONIC',        price:250, image:U('1597960194480-fc6b5e3181fd') },
  { venue:'BAR', cat:'ALCOHOL', zh:'螺絲起子',   en:'SCREWDRIVER',      price:250, image:U('1555766720-1e727844cc8f') },
  { venue:'BAR', cat:'ALCOHOL', zh:'高球',       en:'HIGH BALL',        price:250, image:U('1609330579379-df0827b5f727') },
  { venue:'BAR', cat:'ALCOHOL', zh:'月黑風高',   en:"DARK 'N' STORMY",  price:250, image:U('1514362545857-3bc16c4c7d1b') },
  { venue:'BAR', cat:'ALCOHOL', zh:'馬丁尼',     en:'MARTINI',          price:300, image:U('1671713682257-359a1baf806e') },
  { venue:'BAR', cat:'ALCOHOL', zh:'內格羅尼',   en:'NEGRONI',          price:300, image:U('1626688445658-c948f32d68ba') },
  { venue:'BAR', cat:'ALCOHOL', zh:'瑪格麗特',   en:'MARGARITA',        price:300, image:U('1556855810-ac404aa91e85') },
  { venue:'BAR', cat:'ALCOHOL', zh:'長島冰茶',   en:'LONG ISLAND',      price:300, image:U('1643660090099-32943d698dfa') },
  { venue:'BAR', cat:'ALCOHOL', zh:'隨意',       en:'UP TO YOU',        price:350, image:U('1470337458703-46ad1756a187') },
  // ── COLD_APP ──
  { venue:'BAR', cat:'COLD_APP', zh:'青蘋果山葵鮭魚塔塔・海苔薄脆',       en:'SALMON TARTARE & NORI CRISPS',   price:290, image:U('1656106577512-0259bf5b9fd6') },
  { venue:'BAR', cat:'COLD_APP', zh:'焙茶漬番茄・豆乳乳酪醬・昆布橄欖油', en:'HOJICHA MARINATED TOMATO',       price:220, image:U('1592417817098-8fd3d9eb14a5') },
  { venue:'BAR', cat:'COLD_APP', zh:'胡麻冷豆腐・鹽昆布・青蔥辣油・天婦羅花', en:'SESAME COLD TOFU',           price:200, image:U('1596352670192-5a95e357df7b') },
  // ── HOT_APP ──
  { venue:'BAR', cat:'HOT_APP', zh:'白味噌優格炙燒花椰菜・七味青蔥油', en:'MISO YOGURT CHARRED CAULIFLOWER', price:240, image:U('1699435560767-ad4d6b7dbeb2') },
  { venue:'BAR', cat:'HOT_APP', zh:'柚子胡椒奶油蛤蜊・炙烤切片法棍',   en:'YUZU KOSHO BUTTER CLAMS',         price:320, image:U('1715249792920-bfe1a3b9d79e') },
  // ── FRIED ──
  { venue:'BAR', cat:'FRIED', zh:'紫蘇南蠻炸雞・煙燻蘿蔔塔塔醬',   en:'SHISO NANBAN KARAAGE',  price:320, image:U('1586793783658-261cddf883ef') },
  { venue:'BAR', cat:'FRIED', zh:'海苔帕瑪森薯條・辛子照燒美乃滋', en:'NORI PARMESAN FRIES',   price:220, image:U('1630431341771-1ceb084d6607') },
  { venue:'BAR', cat:'FRIED', zh:'炸舞菇・梅子柴魚蘿蔔泥天露',     en:'FRIED MAITAKE',         price:250, image:U('1734770395200-134b33ec8fb9') },
  // ── GRILL ──
  { venue:'BAR', cat:'GRILL', zh:'鹽麴炙烤豬梅花・燒蔥芥末醬',         en:'SHIO KOJI GRILLED PORK COLLAR',    price:390, image:U('1625477811233-044633d10dd1') },
  { venue:'BAR', cat:'GRILL', zh:'炙烤海大蝦・青蔥山椒醬',             en:'GRILLED KING PRAWNS',              price:450, image:U('1559742811-822873691df8') },
  { venue:'BAR', cat:'GRILL', zh:'黑蒜味噌烤櫛瓜與杏鮑菇・炸蕎麥',     en:'BLACK GARLIC MISO GRILLED VEGGIES', price:280, image:U('1742044609850-ed68d84c39ab') },
  // ── MAIN ──
  { venue:'BAR', cat:'MAIN', zh:'赤味噌牛豬肉醬烏龍麵・溫泉蛋',           en:'AKA MISO MEAT SAUCE UDON',        price:380, image:U('1707201124182-099f3d98bb90') },
  { venue:'BAR', cat:'MAIN', zh:'焦香野菇醬油奶油炒蕎麥麵・溫泉蛋',       en:'MUSHROOM SOY BUTTER YAKISOBA',    price:360, note:'蛋奶素', image:U('1674516585624-422828b423f1') },
  { venue:'BAR', cat:'MAIN', zh:'炙燒明太子烤飯糰出汁茶泡飯・紫蘇山葵',   en:'MENTAIKO YAKI ONIGIRI OCHAZUKE',  price:350, image:U('1516684808441-d7ca9141e63c') },
  { venue:'BAR', cat:'MAIN', zh:'日式番茄雞肉乾咖哩・半熟蛋',             en:'TOMATO CHICKEN DRY CURRY',        price:350, image:U('1679279727895-bd5c9fb9c1a0') },
  // ── SOUP ──
  { venue:'BAR', cat:'SOUP', zh:'青海苔蜆肉生薑清湯', en:'CLAM & GINGER CLEAR SOUP', price:190, image:U('1680137248903-7af5d51a3350') },
];
// 向後相容：舊程式碼可能仍讀 window.MENU_DATA；admin.html 會在讀到 DB 資料後覆寫此值。
window.MENU_DATA = window.__MENU_SEED;
