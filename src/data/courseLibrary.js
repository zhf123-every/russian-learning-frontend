export const LEVELS = ['A1', 'A2', 'B1', 'B2']

export const courseLibrary = {
  A1: {
    collections: [
      {
        id: 'a1_greetings',
        name: '俄语入门：日常问候',
        description: '从最基础的问候语开始，涵盖见面、告别、感谢、道歉等日常场景。',
        videos: [
          {
            id: 'a1_greet_01',
            title: '俄语第一课：问候与自我介绍',
            description: '学习最基础的俄语问候语、自我介绍句型，零基础入门。',
            thumbnail: 'https://picsum.photos/seed/ru_greet_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_greet_01/1280/720',
            level: 'A1',
            duration: '5:00',
            words: 140,
            tags: ['慢速', '基础', '口语'],
            learners: 128,
            sentences: [
              { id: 1, russian: 'Здра́вствуйте!', chinese: '您好！' },
              { id: 2, russian: 'Приве́т!', chinese: '你好！（非正式）' },
              { id: 3, russian: 'До́брое у́тро!', chinese: '早上好！' },
              { id: 4, russian: 'До́брый день!', chinese: '你好！（白天）' },
              { id: 5, russian: 'До́брый ве́чер!', chinese: '晚上好！' },
              { id: 6, russian: 'Как у вас дела́?', chinese: '您最近怎么样？' },
              { id: 7, russian: 'Хорошо́, спаси́бо.', chinese: '很好，谢谢。' },
              { id: 8, russian: 'Меня́ зову́т А́нна.', chinese: '我叫安娜。' },
              { id: 9, russian: 'Как вас зову́т?', chinese: '您叫什么名字？' },
              { id: 10, russian: 'О́чень прия́тно!', chinese: '很高兴认识您！' },
              { id: 11, russian: 'До свида́ния!', chinese: '再见！' },
              { id: 12, russian: 'Пока́!', chinese: '拜拜！（非正式）' },
              { id: 13, russian: 'Спаси́бо большо́е!', chinese: '非常感谢！' },
              { id: 14, russian: 'Пожа́луйста.', chinese: '不客气。／请。' },
              { id: 15, russian: 'Извини́те, пожа́луйста.', chinese: '对不起，打扰一下。' },
              { id: 16, russian: 'Спаси́бо за по́мощь.', chinese: '谢谢你的帮助。' },
              { id: 17, russian: 'Не за что.', chinese: '不客气。' },
              { id: 18, russian: 'Прости́те, пожа́луйста.', chinese: '请原谅。' },
              { id: 19, russian: 'Ничего́, всё хорошо́.', chinese: '没关系，一切都好。' },
              { id: 20, russian: 'Хороше́го дня!', chinese: '祝你今天愉快！' }
            ]
          }
        ]
      },
      {
        id: 'a1_intro',
        name: '俄语基础：自我介绍与数字',
        description: '学会介绍自己、家人朋友，表达年龄、职业和基本喜好。',
        videos: [
          {
            id: 'a1_intro_01',
            title: '俄语第二课：我的自我介绍',
            description: '学习自我介绍、职业、年龄与家庭关系的常用表达。',
            thumbnail: 'https://picsum.photos/seed/ru_intro_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_intro_01/1280/720',
            level: 'A1',
            duration: '5:40',
            words: 150,
            tags: ['基础', '口语', '自我介绍'],
            learners: 96,
            sentences: [
              { id: 1, russian: 'Я студе́нт.', chinese: '我是学生。' },
              { id: 2, russian: 'Я из Кита́я.', chinese: '我来自中国。' },
              { id: 3, russian: 'Я говорю́ по-ру́сски немно́го.', chinese: '我会说一点俄语。' },
              { id: 4, russian: 'Мне два́дцать лет.', chinese: '我二十岁。' },
              { id: 5, russian: 'Э́то мой друг.', chinese: '这是我的朋友。' },
              { id: 6, russian: 'Он у́чится в университе́те.', chinese: '他在大学学习。' },
              { id: 7, russian: 'Она́ рабо́тает в шко́ле.', chinese: '她在学校工作。' },
              { id: 8, russian: 'Мы живём в Москве́.', chinese: '我们住在莫斯科。' },
              { id: 9, russian: 'У меня́ есть сестра́.', chinese: '我有一个姐妹。' },
              { id: 10, russian: 'У меня́ нет бра́та.', chinese: '我没有兄弟。' },
              { id: 11, russian: 'Э́то о́чень интере́сно.', chinese: '这很有趣。' },
              { id: 12, russian: 'Я люблю́ чита́ть.', chinese: '我喜欢阅读。' },
              { id: 13, russian: 'Я учу́ ру́сский язы́к.', chinese: '我在学俄语。' },
              { id: 14, russian: 'Повтори́те, пожа́луйста.', chinese: '请再说一遍。' },
              { id: 15, russian: 'Я не понима́ю.', chinese: '我不明白。' },
              { id: 16, russian: 'Я живу́ в Москве́.', chinese: '我住在莫斯科。' },
              { id: 17, russian: 'Мой друг — инжене́р.', chinese: '我的朋友是工程师。' },
              { id: 18, russian: 'Я люблю́ му́зыку.', chinese: '我喜欢音乐。' },
              { id: 19, russian: 'Где вы живёте?', chinese: '您住在哪里？' },
              { id: 20, russian: 'Я рабо́таю в ба́нке.', chinese: '我在银行工作。' }
            ]
          }
        ]
      },
      {
        id: 'a1_basics',
        name: '俄语基础：数字、颜色与物品',
        description: '掌握数字、颜色和常见物品的表达，学会询问价格与描述事物。',
        videos: [
          {
            id: 'a1_basics_01',
            title: '俄语第三课：数字与颜色',
            description: '学习数字、颜色、常见物品与购物中的基本表达。',
            thumbnail: 'https://picsum.photos/seed/ru_basics_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_basics_01/1280/720',
            level: 'A1',
            duration: '5:20',
            words: 145,
            tags: ['基础', '数字', '物品'],
            learners: 88,
            sentences: [
              { id: 1, russian: 'Оди́н, два, три.', chinese: '一，二，三。' },
              { id: 2, russian: 'Мне ну́жно пять я́блок.', chinese: '我需要五个苹果。' },
              { id: 3, russian: 'Э́то кра́сный цвет.', chinese: '这是红色。' },
              { id: 4, russian: 'У меня́ есть си́няя ру́чка.', chinese: '我有一支蓝色的笔。' },
              { id: 5, russian: 'Ско́лько э́то сто́ит?', chinese: '这个多少钱？' },
              { id: 6, russian: 'Э́то сто́ит сто рубле́й.', chinese: '这个一百卢布。' },
              { id: 7, russian: 'Я ви́жу большо́й дом.', chinese: '我看见一栋大房子。' },
              { id: 8, russian: 'Э́то моя́ кни́га.', chinese: '这是我的书。' },
              { id: 9, russian: 'У тебя́ есть каранда́ш?', chinese: '你有铅笔吗？' },
              { id: 10, russian: 'Дай мне, пожа́луйста, стака́н воды́.', chinese: '请给我一杯水。' },
              { id: 11, russian: 'Э́тот стол деревя́нный.', chinese: '这张桌子是木头的。' },
              { id: 12, russian: 'Мне нра́вится зелёный цвет.', chinese: '我喜欢绿色。' },
              { id: 13, russian: 'У нас три́дцать уче́ников.', chinese: '我们有三十名学生。' },
              { id: 14, russian: 'Э́то о́чень до́рого.', chinese: '这太贵了。' },
              { id: 15, russian: 'Я хочу́ купи́ть но́вый телефо́н.', chinese: '我想买一部新手机。' },
              { id: 16, russian: 'У меня́ есть два карандаша́.', chinese: '我有两支铅笔。' },
              { id: 17, russian: 'Э́та кни́га интере́сная.', chinese: '这本书很有趣。' },
              { id: 18, russian: 'Како́й ваш люби́мый цвет?', chinese: '你最喜欢什么颜色？' },
              { id: 19, russian: 'Дайте мне, пожа́луйста, хлеб.', chinese: '请给我面包。' },
              { id: 20, russian: 'У вас есть мело́чь?', chinese: '您有零钱吗？' }
            ]
          }
        ]
      },
      {
        id: 'a1_family',
        name: '俄语入门：家庭与朋友',
        description: '谈论家庭成员、亲属关系和朋友，学习描述家人职业与性格的基础表达。',
        videos: [
          {
            id: 'a1_family_01',
            title: '我的家庭和朋友',
            description: '学习用俄语介绍家人、描述亲属关系和谈论朋友。',
            thumbnail: 'https://picsum.photos/seed/ru_family_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_family_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 160,
            tags: ['基础', '家庭', '口语'],
            learners: 82,
            sentences: [
              { id: 1, russian: 'У меня́ большо́й семья́.', chinese: '我有一个大家庭。' },
              { id: 2, russian: 'У меня́ есть отец и мать.', chinese: '我有父亲和母亲。' },
              { id: 3, russian: 'Мой отец рабо́тает врачо́м.', chinese: '我父亲是医生。' },
              { id: 4, russian: 'Моя́ мать — учи́тельница.', chinese: '我母亲是老师。' },
              { id: 5, russian: 'У меня́ есть оди́н брат.', chinese: '我有一个兄弟。' },
              { id: 6, russian: 'Мое́й сестре́ пятна́дцать лет.', chinese: '我妹妹十五岁。' },
              { id: 7, russian: 'Мой деду́шка на пе́нсии.', chinese: '我祖父退休了。' },
              { id: 8, russian: 'Бабу́шка гото́вит о́чень вку́сно.', chinese: '奶奶做饭很好吃。' },
              { id: 9, russian: 'Мы живём вме́сте.', chinese: '我们住在一起。' },
              { id: 10, russian: 'Я люблю́ свою́ семью́.', chinese: '我爱我的家人。' },
              { id: 11, russian: 'У меня́ мно́го друзе́й.', chinese: '我有很多朋友。' },
              { id: 12, russian: 'Мой лу́чший друг — Андре́й.', chinese: '我最好的朋友是安德烈。' },
              { id: 13, russian: 'Мы у́чимся в одно́й гру́ппе.', chinese: '我们在同一个班学习。' },
              { id: 14, russian: 'Он о́чень добрый.', chinese: '他很善良。' },
              { id: 15, russian: 'Она́ помога́ет мне с ру́сским.', chinese: '她帮我学俄语。' },
              { id: 16, russian: 'Мы ча́сто встреча́емся.', chinese: '我们经常见面。' },
              { id: 17, russian: 'Вчера́ мы ходи́ли в кино́.', chinese: '昨天我们去看电影了。' },
              { id: 18, russian: 'Мой друг лю́бит спорт.', chinese: '我的朋友喜欢运动。' },
              { id: 19, russian: 'Мы игра́ем в футбо́л по выхо́дным.', chinese: '我们周末踢足球。' },
              { id: 20, russian: 'Я рад, что у меня́ есть друзья́.', chinese: '我很高兴有朋友。' },
              { id: 21, russian: 'У моего́ брата есть сын.', chinese: '我哥哥有一个儿子。' },
              { id: 22, russian: 'Моя́ племя́нница о́чень ми́лая.', chinese: '我的侄女很可爱。' },
              { id: 23, russian: 'Мы созвани́ваемся ка́ждый день.', chinese: '我们每天通电话。' },
              { id: 24, russian: 'Семья́ — э́то са́мое ва́жное.', chinese: '家庭是最重要的。' },
              { id: 25, russian: 'Я скуча́ю по свое́й семье́.', chinese: '我想念我的家人。' }
            ]
          }
        ]
      },
      {
        id: 'a1_daily_routine',
        name: '俄语入门：日常活动',
        description: '描述一天的作息安排，从起床到睡觉，学习常用的日常动词和时间表达。',
        videos: [
          {
            id: 'a1_routine_01',
            title: '我的一天：从起床到睡觉',
            description: '学习用俄语描述日常作息、上下班和晚间活动。',
            thumbnail: 'https://picsum.photos/seed/ru_routine_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_routine_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 165,
            tags: ['基础', '日常', '动词'],
            learners: 76,
            sentences: [
              { id: 1, russian: 'Я встаю́ в семь утра́.', chinese: '我早上七点起床。' },
              { id: 2, russian: 'Снача́ла я умыва́юсь.', chinese: '我先洗脸。' },
              { id: 3, russian: 'Потом я одева́юсь.', chinese: '然后我穿衣服。' },
              { id: 4, russian: 'Я за́втракаю в семь три́дцать.', chinese: '我七点半吃早饭。' },
              { id: 5, russian: 'На за́втрак я ем ка́шу.', chinese: '早饭我喝粥。' },
              { id: 6, russian: 'Я пью чай с са́харом.', chinese: '我喝加糖的茶。' },
              { id: 7, russian: 'В восемь я иду́ на рабо́ту.', chinese: '我八点去上班。' },
              { id: 8, russian: 'Я е́ду на рабо́ту на метро́.', chinese: '我坐地铁去上班。' },
              { id: 9, russian: 'Доро́га занима́ет со́рок мину́т.', chinese: '路上花四十分钟。' },
              { id: 10, russian: 'Я начина́ю рабо́ту в девять.', chinese: '我九点开始工作。' },
              { id: 11, russian: 'Я обе́даю в двена́дцать.', chinese: '我十二点吃午饭。' },
              { id: 12, russian: 'Я обе́даю в столо́вой.', chinese: '我在食堂吃午饭。' },
              { id: 13, russian: 'В пять я заканчива́ю рабо́ту.', chinese: '我五点下班。' },
              { id: 14, russian: 'Я возвраща́юсь домо́й в шесть.', chinese: '我六点回家。' },
              { id: 15, russian: 'Дома́ я отдыха́ю.', chinese: '在家我休息。' },
              { id: 16, russian: 'В семь я у́жинаю.', chinese: '我七点吃晚饭。' },
              { id: 17, russian: 'По́сле у́жина я чита́ю кни́гу.', chinese: '晚饭后我读书。' },
              { id: 18, russian: 'Ино́гда я смотрю́ телеви́зор.', chinese: '有时我看电视。' },
              { id: 19, russian: 'Я гуля́ю ве́чером.', chinese: '我晚上散步。' },
              { id: 20, russian: 'В оди́ннадцать я ложу́сь спать.', chinese: '我十一点睡觉。' },
              { id: 21, russian: 'Я хорошо́ высыпа́юсь.', chinese: '我睡得很好。' },
              { id: 22, russian: 'Утром я дела́ю заря́дку.', chinese: '早上我做操。' },
              { id: 23, russian: 'Я принима́ю душ.', chinese: '我洗澡。' },
              { id: 24, russian: 'Мой день о́чень насы́щенный.', chinese: '我的一天很充实。' },
              { id: 25, russian: 'Я люблю́ свой распоря́док.', chinese: '我喜欢我的作息。' }
            ]
          }
        ]
      },
      {
        id: 'a1_food',
        name: '俄语入门：餐饮与点餐',
        description: '在咖啡馆和餐厅点餐、询问菜品、结账，学习餐饮场景的核心表达。',
        videos: [
          {
            id: 'a1_food_01',
            title: '在餐厅：点餐与结账',
            description: '学习用俄语在餐厅点餐、询问价格和结账。',
            thumbnail: 'https://picsum.photos/seed/ru_food_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_food_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 155,
            tags: ['基础', '餐饮', '口语'],
            learners: 90,
            sentences: [
              { id: 1, russian: 'Я хочу́ поесть.', chinese: '我想吃东西。' },
              { id: 2, russian: 'Я го́лоден.', chinese: '我饿了。' },
              { id: 3, russian: 'Дава́йте пойдём в кафе́.', chinese: '我们去咖啡馆吧。' },
              { id: 4, russian: 'Я хочу́ ча́шку ко́фе.', chinese: '我想要一杯咖啡。' },
              { id: 5, russian: 'Мне ну́жен стака́н воды́.', chinese: '我需要一杯水。' },
              { id: 6, russian: 'Я люблю́ ру́сскую кухню.', chinese: '我喜欢俄罗斯菜。' },
              { id: 7, russian: 'Что вы сове́туете?', chinese: '您推荐什么？' },
              { id: 8, russian: 'Я хочу́ борщ.', chinese: '我想要红菜汤。' },
              { id: 9, russian: 'Это о́чень вку́сно.', chinese: '这很好吃。' },
              { id: 10, russian: 'Ско́лько сто́ит э́тот обе́д?', chinese: '这顿午饭多少钱？' },
              { id: 11, russian: 'Это сто́ит три́дцать рубле́й.', chinese: '这三十卢布。' },
              { id: 12, russian: 'Это не до́рого.', chinese: '这不贵。' },
              { id: 13, russian: 'У вас есть вегетариа́нское блю́до?', chinese: '你们有素食吗？' },
              { id: 14, russian: 'Я не ем мя́со.', chinese: '我不吃肉。' },
              { id: 15, russian: 'Принеси́те, пожа́луйста, меню́.', chinese: '请拿菜单来。' },
              { id: 16, russian: 'Я бу́ду суп и сала́т.', chinese: '我要汤和沙拉。' },
              { id: 17, russian: 'Как вам ко́фе — с молоко́м?', chinese: '您的咖啡要加奶吗？' },
              { id: 18, russian: 'Да, пожа́луйста, с молоко́м.', chinese: '是的，请加奶。' },
              { id: 19, russian: 'Счёт, пожа́луйста.', chinese: '请结账。' },
              { id: 20, russian: 'Здесь мо́жно заплати́ть кар́той?', chinese: '这里可以刷卡吗？' },
              { id: 21, russian: 'Я люблю́ чай с лимо́ном.', chinese: '我喜欢加柠檬的茶。' },
              { id: 22, russian: 'На за́втрак я ем я́блоко.', chinese: '早饭我吃一个苹果。' },
              { id: 23, russian: 'Я пью молоко́ ка́ждое у́тро.', chinese: '我每天早上喝牛奶。' },
              { id: 24, russian: 'Э́тот хлеб све́жий.', chinese: '这面包很新鲜。' },
              { id: 25, russian: 'Спаси́бо, я уже́ сыт.', chinese: '谢谢，我已经饱了。' }
            ]
          }
        ]
      },
      {
        id: 'a1_shopping',
        name: '俄语入门：购物与价格',
        description: '在商店和超市购物、询问价格、试穿衣服、付款结账，学习购物场景表达。',
        videos: [
          {
            id: 'a1_shop_01',
            title: '在商店：购物与付款',
            description: '学习用俄语询问价格、挑选商品、试穿和付款。',
            thumbnail: 'https://picsum.photos/seed/ru_shop_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_shop_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 160,
            tags: ['基础', '购物', '口语'],
            learners: 85,
            sentences: [
              { id: 1, russian: 'Я хочу́ купи́ть хлеб.', chinese: '我想买面包。' },
              { id: 2, russian: 'Где находи́тся магази́н?', chinese: '商店在哪里？' },
              { id: 3, russian: 'Я иду́ в суперма́ркет.', chinese: '我去超市。' },
              { id: 4, russian: 'Ско́лько сто́ит молоко́?', chinese: '牛奶多少钱？' },
              { id: 5, russian: 'Это сто́ит пятьдеся́т рубле́й.', chinese: '这五十卢布。' },
              { id: 6, russian: 'Это о́чень до́рого.', chinese: '这太贵了。' },
              { id: 7, russian: 'А э́то дёшево.', chinese: '这个便宜。' },
              { id: 8, russian: 'У вас есть я́блоки?', chinese: '你们有苹果吗？' },
              { id: 9, russian: 'Да, они́ там.', chinese: '有，在那边。' },
              { id: 10, russian: 'Дайте мне два килогра́мма.', chinese: '给我两公斤。' },
              { id: 11, russian: 'Како́й разме́р вам ну́жен?', chinese: '您需要多大码？' },
              { id: 12, russian: 'Мне ну́жен разме́р M.', chinese: '我需要M码。' },
              { id: 13, russian: 'Мо́жно приме́рить?', chinese: '可以试穿吗？' },
              { id: 14, russian: 'Где приме́рочная?', chinese: '试衣间在哪里？' },
              { id: 15, russian: 'Это мне подхо́дит.', chinese: '这个适合我。' },
              { id: 16, russian: 'Я беру́ э́ту вещь.', chinese: '我买这件。' },
              { id: 17, russian: 'Где касса́?', chinese: '收银台在哪里？' },
              { id: 18, russian: 'Заплачу́ нали́чными.', chinese: '我付现金。' },
              { id: 19, russian: 'У вас есть ски́дка?', chinese: '有折扣吗？' },
              { id: 20, russian: 'Сейча́с распро́дажа.', chinese: '现在在打折。' },
              { id: 21, russian: 'Это после́дний разме́р.', chinese: '这是最后一个码了。' },
              { id: 22, russian: 'Мне ну́жен паке́т.', chinese: '我需要一个袋子。' },
              { id: 23, russian: 'Спаси́бо за покупку!', chinese: '谢谢惠顾！' },
              { id: 24, russian: 'До свида́ния, прихо́дите ещё.', chinese: '再见，欢迎再来。' },
              { id: 25, russian: 'Я купи́л всё, что ну́жно.', chinese: '我买了所有需要的东西。' }
            ]
          }
        ]
      },
      {
        id: 'a1_transport',
        name: '俄语入门：交通与出行',
        description: '乘坐公共交通、问路、打车、前往机场火车站，学习出行场景的核心表达。',
        videos: [
          {
            id: 'a1_transport_01',
            title: '出行：坐地铁、公交和打车',
            description: '学习用俄语问路、乘坐公共交通和叫出租车。',
            thumbnail: 'https://picsum.photos/seed/ru_transport_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_transport_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 165,
            tags: ['基础', '交通', '问路'],
            learners: 78,
            sentences: [
              { id: 1, russian: 'Как пройти́ к метро́?', chinese: '怎么去地铁站？' },
              { id: 2, russian: 'Иди́те прямо́.', chinese: '直走。' },
              { id: 3, russian: 'Потом поверни́те нале́во.', chinese: '然后左转。' },
              { id: 4, russian: 'Метро́ там, за угло́м.', chinese: '地铁在那边，拐角处。' },
              { id: 5, russian: 'Я е́ду на авто́бусе.', chinese: '我坐公交车。' },
              { id: 6, russian: 'Како́й авто́бус идёт к це́нтру?', chinese: '哪路公交车去市中心？' },
              { id: 7, russian: 'Мне ну́жен трамва́й номер пять.', chinese: '我需要5路有轨电车。' },
              { id: 8, russian: 'Где остано́вка?', chinese: '车站在哪里？' },
              { id: 9, russian: 'Ско́лько сто́ит биле́т?', chinese: '车票多少钱？' },
              { id: 10, russian: 'Биле́т сто́ит пятьдеся́т рубле́й.', chinese: '车票五十卢布。' },
              { id: 11, russian: 'Где я могу́ купи́ть биле́т?', chinese: '我在哪里可以买票？' },
              { id: 12, russian: 'В кассе́ или в автома́те.', chinese: '在售票窗口或自动售票机。' },
              { id: 13, russian: 'Когда́ прихо́дит по́езд?', chinese: '火车什么时候到？' },
              { id: 14, russian: 'По́езд прихо́дит в три часа́.', chinese: '火车三点到。' },
              { id: 15, russian: 'Я опаз́дываю на рабо́ту.', chinese: '我上班要迟到了。' },
              { id: 16, russian: 'В маши́не пробка́.', chinese: '路上堵车了。' },
              { id: 17, russian: 'Я вы́зову такси́.', chinese: '我叫辆出租车。' },
              { id: 18, russian: 'Такси́ прие́дет че́рез пять мину́т.', chinese: '出租车五分钟后到。' },
              { id: 19, russian: 'Мне ну́жно в аэропо́рт.', chinese: '我要去机场。' },
              { id: 20, russian: 'Ско́лько вре́мени е́хать?', chinese: '要走多长时间？' },
              { id: 21, russian: 'Е́хать со́рок мину́т.', chinese: '要走四十分钟。' },
              { id: 22, russian: 'Где вокза́л?', chinese: '火车站在哪里？' },
              { id: 23, russian: 'Я лечу́ в Москву́.', chinese: '我飞往莫斯科。' },
              { id: 24, russian: 'Мой рейс номер де́сять.', chinese: '我的航班是10号。' },
              { id: 25, russian: 'Спаси́бо за по́мощь!', chinese: '谢谢你的帮助！' }
            ]
          }
        ]
      },
      {
        id: 'a1_time_date',
        name: '俄语入门：时间与日期',
        description: '询问时间、谈论星期、日期和月份，学习时间表达和约会安排。',
        videos: [
          {
            id: 'a1_time_01',
            title: '时间与日期：今天几号星期几',
            description: '学习用俄语询问时间、谈论日期和安排约会。',
            thumbnail: 'https://picsum.photos/seed/ru_time_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_time_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 150,
            tags: ['基础', '时间', '日期'],
            learners: 72,
            sentences: [
              { id: 1, russian: 'Кото́рый час?', chinese: '几点了？' },
              { id: 2, russian: 'Сейчас три часа́.', chinese: '现在三点。' },
              { id: 3, russian: 'Уже́ почти́ полдень.', chinese: '已经快中午了。' },
              { id: 4, russian: 'Встре́тимся в пять часо́в.', chinese: '我们五点见面。' },
              { id: 5, russian: 'Во ско́лько вы встаёте?', chinese: '您几点起床？' },
              { id: 6, russian: 'Я встаю́ в семь утра́.', chinese: '我早上七点起床。' },
              { id: 7, russian: 'Како́й сего́дня день?', chinese: '今天星期几？' },
              { id: 8, russian: 'Сегодня́ понеде́льник.', chinese: '今天星期一。' },
              { id: 9, russian: 'За́втра бу́дет вторни́к.', chinese: '明天是星期二。' },
              { id: 10, russian: 'Вчера́ было воскресе́нье.', chinese: '昨天是星期日。' },
              { id: 11, russian: 'Како́е сего́дня число́?', chinese: '今天几号？' },
              { id: 12, russian: 'Сегодня́ перво́е сентябри́.', chinese: '今天九月一日。' },
              { id: 13, russian: 'Мой день рожде́ния пятна́дцатого.', chinese: '我的生日是15号。' },
              { id: 14, russian: 'В како́м ме́сяце вы родили́сь?', chinese: '您出生在哪个月？' },
              { id: 15, russian: 'Я роди́лся в ма́рте.', chinese: '我出生在三月。' },
              { id: 16, russian: 'Сейча́с о́сень.', chinese: '现在是秋天。' },
              { id: 17, russian: 'Скоро́ зима́.', chinese: '冬天快到了。' },
              { id: 18, russian: 'У нас бу́дут кани́кулы.', chinese: '我们要放假了。' },
              { id: 19, russian: 'Кани́кулы начну́тся в декабре́.', chinese: '假期十二月开始。' },
              { id: 20, russian: 'Я рабо́таю с понеде́льника по пятни́цу.', chinese: '我周一到周五工作。' },
              { id: 21, russian: 'По выхо́дным я отдыха́ю.', chinese: '周末我休息。' },
              { id: 22, russian: 'У нас уро́к в два часа́.', chinese: '我们两点上课。' },
              { id: 23, russian: 'Уро́к дли́тся час.', chinese: '课上一个小时。' },
              { id: 24, russian: 'Уже́ поздно, мне пора́.', chinese: '已经晚了，我该走了。' },
              { id: 25, russian: 'До встре́чи в сле́дующий раз!', chinese: '下次见！' }
            ]
          }
        ]
      },
      {
        id: 'a1_weather',
        name: '俄语入门：天气与季节',
        description: '谈论天气状况、四季变化、穿着建议和天气预报，学习自然现象的基础表达。',
        videos: [
          {
            id: 'a1_weather_01',
            title: '天气与季节：今天冷还是热',
            description: '学习用俄语谈论天气、四季和穿着建议。',
            thumbnail: 'https://picsum.photos/seed/ru_weather_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_weather_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 155,
            tags: ['基础', '天气', '季节'],
            learners: 68,
            sentences: [
              { id: 1, russian: 'Кака́я сего́дня пого́да?', chinese: '今天天气怎么样？' },
              { id: 2, russian: 'Сегодня́ холо́дно.', chinese: '今天很冷。' },
              { id: 3, russian: 'На у́лице минус пять.', chinese: '外面零下五度。' },
              { id: 4, russian: 'Идёт снег.', chinese: '在下雪。' },
              { id: 5, russian: 'Не́бо серое, обла́чно.', chinese: '天空灰蒙蒙的，多云。' },
              { id: 6, russian: 'А вчера́ бы́ло тепло́.', chinese: '昨天很暖和。' },
              { id: 7, russian: 'Бы́ло со́лнечно и я́сно.', chinese: '阳光明媚，天气晴朗。' },
              { id: 8, russian: 'Я люблю́ ле́то.', chinese: '我喜欢夏天。' },
              { id: 9, russian: 'Летом жа́рко и светло́.', chinese: '夏天又热又亮。' },
              { id: 10, russian: 'Мо́жно купа́ться в реке́.', chinese: '可以在河里游泳。' },
              { id: 11, russian: 'Весна́ — моё люби́мое вре́мя го́да.', chinese: '春天是我最喜欢的季节。' },
              { id: 12, russian: 'Весно́й цвету́т дере́вья.', chinese: '春天树木开花。' },
              { id: 13, russian: 'Осенью ча́сто идёт дождь.', chinese: '秋天经常下雨。' },
              { id: 14, russian: 'Мне нра́вится о́сень.', chinese: '我喜欢秋天。' },
              { id: 15, russian: 'Зимо́й мы хо́дим на конька́х.', chinese: '冬天我们滑冰。' },
              { id: 16, russian: 'Я одева́юсь теп́ло.', chinese: '我穿得很暖和。' },
              { id: 17, russian: 'На́до надеть ша́пку.', chinese: '需要戴帽子。' },
              { id: 18, russian: 'Ве́тер си́льный сего́дня.', chinese: '今天风很大。' },
              { id: 19, russian: 'Будет ли за́втра дождь?', chinese: '明天会下雨吗？' },
              { id: 20, russian: 'По прогно́зу, бу́дет со́лнечно.', chinese: '预报说会是晴天。' },
              { id: 21, russian: 'Я беру́ с собо́й зонт.', chinese: '我带把伞。' },
              { id: 22, russian: 'На у́лице сы́ро и холодно.', chinese: '外面又湿又冷。' },
              { id: 23, russian: 'Я люблю́, когда́ светит со́лнце.', chinese: '我喜欢阳光照耀的时候。' },
              { id: 24, russian: 'Пого́да испо́ртилась.', chinese: '天气变坏了。' },
              { id: 25, russian: 'Завтра́ обеща́ют потепле́ние.', chinese: '预报说明天会回暖。' }
            ]
          }
        ]
      },
      {
        id: 'a1_health',
        name: '俄语入门：身体与健康',
        description: '描述身体不适、看医生、买药和表达健康状况，学习就医场景的基础表达。',
        videos: [
          {
            id: 'a1_health_01',
            title: '健康与就医：我不舒服',
            description: '学习用俄语描述症状、看医生和买药。',
            thumbnail: 'https://picsum.photos/seed/ru_health_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_health_01/1280/720',
            level: 'A1',
            duration: '4:10',
            words: 155,
            tags: ['基础', '健康', '就医'],
            learners: 65,
            sentences: [
              { id: 1, russian: 'Как вы себя́ чу́вствуете?', chinese: '您感觉怎么样？' },
              { id: 2, russian: 'Я чу́вствую себя́ хорошо́.', chinese: '我感觉很好。' },
              { id: 3, russian: 'Я пло́хо себя́ чу́вствую.', chinese: '我感觉不舒服。' },
              { id: 4, russian: 'У меня́ головна́я боль.', chinese: '我头疼。' },
              { id: 5, russian: 'У меня́ температу́ра.', chinese: '我发烧了。' },
              { id: 6, russian: 'Мне хо́лодно.', chinese: '我觉得冷。' },
              { id: 7, russian: 'Я ка́шляю.', chinese: '我咳嗽。' },
              { id: 8, russian: 'У меня́ болит горло́.', chinese: '我嗓子疼。' },
              { id: 9, russian: 'У меня́ насмо́рк.', chinese: '我流鼻涕。' },
              { id: 10, russian: 'Я заболе́л.', chinese: '我生病了。' },
              { id: 11, russian: 'Мне ну́жно вызва́ть врача́.', chinese: '我需要叫医生。' },
              { id: 12, russian: 'Вызови́те, пожа́луйста, ско́рую по́мощь.', chinese: '请叫救护车。' },
              { id: 13, russian: 'Где больни́ца?', chinese: '医院在哪里？' },
              { id: 14, russian: 'Я пойду́ к врачу́.', chinese: '我去看医生。' },
              { id: 15, russian: 'Врач меня́ посмотри́т.', chinese: '医生会给我检查。' },
              { id: 16, russian: 'Мне выпи́шут лека́рство.', chinese: '会给我开药。' },
              { id: 17, russian: 'Где апте́ка?', chinese: '药店在哪里？' },
              { id: 18, russian: 'Мне ну́жны табле́тки.', chinese: '我需要药片。' },
              { id: 19, russian: 'Принима́йте лека́рство три ра́за в день.', chinese: '每天吃三次药。' },
              { id: 20, russian: 'Вам ну́жен посте́льный режи́м.', chinese: '您需要卧床休息。' },
              { id: 21, russian: 'Пейте бо́льше жидкости.', chinese: '多喝水。' },
              { id: 22, russian: 'Выздоравли́вайте!', chinese: '祝您早日康复！' },
              { id: 23, russian: 'Я уже́ лу́чше.', chinese: '我已经好多了。' },
              { id: 24, russian: 'Я хочу́ быть здоро́вым.', chinese: '我想健康。' },
              { id: 25, russian: 'Здоро́вье — са́мое гла́вное.', chinese: '健康是最重要的。' }
            ]
          }
        ]
      }
    ]
  },
  A2: {
    collections: [
      {
        id: 'a2_past',
        name: '俄语进阶：过去时与生活',
        description: '用过去时描述日常生活、经历和天气，练习动词过去时态。',
        videos: [
          {
            id: 'a2_past_01',
            title: '日常生活：昨天我做了什么',
            description: '学习俄语过去时，描述昨天和过去的日常活动。',
            thumbnail: 'https://picsum.photos/seed/ru_past_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_past_01/1280/720',
            level: 'A2',
            duration: '6:00',
            words: 160,
            tags: ['过去时', '生活', '语法'],
            learners: 74,
            sentences: [
              { id: 1, russian: 'Вчера́ я ходи́л в кино́.', chinese: '昨天我去看电影了。' },
              { id: 2, russian: 'У́тром я встал в семь часо́в.', chinese: '早上我七点起床。' },
              { id: 3, russian: 'Мы гуля́ли в па́рке.', chinese: '我们在公园散步。' },
              { id: 4, russian: 'Она́ гото́вила у́жин.', chinese: '她做了晚饭。' },
              { id: 5, russian: 'Я чита́л кни́гу весь ве́чер.', chinese: '我整个晚上都在读书。' },
              { id: 6, russian: 'Он рабо́тал це́лый день.', chinese: '他工作了一整天。' },
              { id: 7, russian: 'Мы смотре́ли телеви́зор.', chinese: '我们看电视了。' },
              { id: 8, russian: 'Я купи́л хлеб и молоко́.', chinese: '我买了面包和牛奶。' },
              { id: 9, russian: 'Она́ позвони́ла подру́ге.', chinese: '她给朋友打了电话。' },
              { id: 10, russian: 'Мы отдыха́ли на мо́ре.', chinese: '我们在海边休息。' },
              { id: 11, russian: 'Я был о́чень за́нят.', chinese: '我当时很忙。' },
              { id: 12, russian: 'Пого́да была́ хоро́шая.', chinese: '天气很好。' },
              { id: 13, russian: 'Мы хорошо́ провели́ вре́мя.', chinese: '我们度过了愉快的时光。' },
              { id: 14, russian: 'Я забы́л свои́ ключи́.', chinese: '我忘了我的钥匙。' },
              { id: 15, russian: 'Он рассказа́л интере́сную исто́рию.', chinese: '他讲了一个有趣的故事。' }
            ]
          }
        ]
      },
      {
        id: 'a2_future',
        name: '俄语进阶：未来计划与愿望',
        description: '用将来时描述计划、打算和愿望，练习未完成体和完成体将来时。',
        videos: [
          {
            id: 'a2_future_01',
            title: '未来计划：明天我要做什么',
            description: '学习俄语将来时，描述计划、梦想和未来的打算。',
            thumbnail: 'https://picsum.photos/seed/ru_future_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_future_01/1280/720',
            level: 'A2',
            duration: '6:10',
            words: 150,
            tags: ['将来时', '计划', '生活'],
            learners: 69,
            sentences: [
              { id: 1, russian: 'За́втра я пое́ду в го́род.', chinese: '明天我要去城里。' },
              { id: 2, russian: 'Ле́том мы пое́дем на мо́ре.', chinese: '夏天我们要去海边。' },
              { id: 3, russian: 'Я бу́ду учи́ть ру́сский язы́к.', chinese: '我要学俄语。' },
              { id: 4, russian: 'Она́ хо́чет стать врачо́м.', chinese: '她想当医生。' },
              { id: 5, russian: 'Мы бу́дем жить в Москве́.', chinese: '我们将住在莫斯科。' },
              { id: 6, russian: 'Я плани́рую пое́хать за грани́цу.', chinese: '我计划出国。' },
              { id: 7, russian: 'В бу́дущем году́ я найду́ но́вую рабо́ту.', chinese: '明年我会找新工作。' },
              { id: 8, russian: 'Он собира́ется жени́ться.', chinese: '他打算结婚。' },
              { id: 9, russian: 'Я мечта́ю путеше́ствовать по ми́ру.', chinese: '我梦想环游世界。' },
              { id: 10, russian: 'Мы встре́тимся за́втра ве́чером.', chinese: '我们明晚见面。' },
              { id: 11, russian: 'Ско́ро начну́тся кани́кулы.', chinese: '假期快到了。' },
              { id: 12, russian: 'Я хочу́ вы́учить но́вый язы́к.', chinese: '我想学一门新语言。' },
              { id: 13, russian: 'Она́ бу́дет рабо́тать за грани́цей.', chinese: '她将在国外工作。' },
              { id: 14, russian: 'Мы реши́ли перее́хать в друго́й го́род.', chinese: '我们决定搬到另一个城市。' },
              { id: 15, russian: 'Я наде́юсь, что всё полу́чится.', chinese: '我希望一切顺利。' }
            ]
          }
        ]
      },
      {
        id: 'a2_hobbies',
        name: '俄语进阶：兴趣与爱好',
        description: '谈论兴趣爱好、业余活动，练习表达喜好与能力。',
        videos: [
          {
            id: 'a2_hobbies_01',
            title: '兴趣爱好：我周末喜欢做什么',
            description: '学习用俄语谈论爱好、特长和空闲时间安排。',
            thumbnail: 'https://picsum.photos/seed/ru_hobbies_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_hobbies_01/1280/720',
            level: 'A2',
            duration: '5:30',
            words: 140,
            tags: ['爱好', '生活', '口语'],
            learners: 62,
            sentences: [
              { id: 1, russian: 'Моё хо́бби — фотогра́фия.', chinese: '我的爱好是摄影。' },
              { id: 2, russian: 'Я увлека́юсь му́зыкой.', chinese: '我热爱音乐。' },
              { id: 3, russian: 'В свобо́дное вре́мя я рису́ю.', chinese: '空闲时我画画。' },
              { id: 4, russian: 'Он игра́ет на гита́ре.', chinese: '他弹吉他。' },
              { id: 5, russian: 'Я люблю́ чита́ть кни́ги.', chinese: '我喜欢读书。' },
              { id: 6, russian: 'Мы ча́сто хо́дим в теа́тр.', chinese: '我们经常去剧院。' },
              { id: 7, russian: 'Она́ занима́ется пла́ванием.', chinese: '她游泳。' },
              { id: 8, russian: 'Мне нра́вится смотре́ть фи́льмы.', chinese: '我喜欢看电影。' },
              { id: 9, russian: 'По выходны́м я гуля́ю в па́рке.', chinese: '周末我在公园散步。' },
              { id: 10, russian: 'Я собира́ю ма́рки.', chinese: '我集邮。' },
              { id: 11, russian: 'Он увлека́ется футбо́лом.', chinese: '他喜欢足球。' },
              { id: 12, russian: 'Мы лю́бим гото́вить вме́сте.', chinese: '我们喜欢一起做饭。' },
              { id: 13, russian: 'Она́ хорошо́ танцу́ет.', chinese: '她跳舞很好。' },
              { id: 14, russian: 'Я хочу́ научи́ться игра́ть на пиани́но.', chinese: '我想学弹钢琴。' },
              { id: 15, russian: 'Э́то моё люби́мое заня́тие.', chinese: '这是我最喜欢的事。' }
            ]
          }
        ]
      }
    ]
  },
  B1: {
    collections: [
      {
        id: 'b1_opinion',
        name: '俄语中级：观点与论证',
        description: '学习表达观点、同意与反驳、权衡利弊，提升逻辑表达能力。',
        videos: [
          {
            id: 'b1_opinion_01',
            title: '表达观点：我同意还是反对',
            description: '学习用俄语表达个人观点、权衡利弊和进行讨论。',
            thumbnail: 'https://picsum.photos/seed/ru_opinion_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_opinion_01/1280/720',
            level: 'B1',
            duration: '7:20',
            words: 200,
            tags: ['观点', '讨论', '中级'],
            learners: 51,
            sentences: [
              { id: 1, russian: 'По-мо́ему, э́то пра́вильное реше́ние.', chinese: '在我看来，这是正确的决定。' },
              { id: 2, russian: 'Я счита́ю, что на́до бо́льше занима́ться.', chinese: '我认为需要多练习。' },
              { id: 3, russian: 'С одно́й стороны́, э́то поле́зно.', chinese: '一方面，这很有用。' },
              { id: 4, russian: 'С друго́й стороны́, э́то до́рого.', chinese: '另一方面，这很贵。' },
              { id: 5, russian: 'Мне ка́жется, он прав.', chinese: '我觉得他是对的。' },
              { id: 6, russian: 'Я не согла́сен с э́тим мне́нием.', chinese: '我不同意这个观点。' },
              { id: 7, russian: 'Э́то зави́сит от мно́гих фа́кторов.', chinese: '这取决于许多因素。' },
              { id: 8, russian: 'Ва́жно понима́ть причи́ны.', chinese: '理解原因很重要。' },
              { id: 9, russian: 'Я ду́маю, что э́то возмо́жно.', chinese: '我认为这是可能的。' },
              { id: 10, russian: 'На мой взгляд, э́то сли́шком сло́жно.', chinese: '在我看来，这太复杂了。' },
              { id: 11, russian: 'На́до учи́тывать все обстоя́тельства.', chinese: '需要考虑所有情况。' },
              { id: 12, russian: 'Я убеждён, что э́то пра́вильно.', chinese: '我确信这是正确的。' },
              { id: 13, russian: 'К сожале́нию, э́то невозмо́жно.', chinese: '很遗憾，这是不可能的。' },
              { id: 14, russian: 'Мне интере́сно узна́ть ва́ше мне́ние.', chinese: '我很想知道你的看法。' },
              { id: 15, russian: 'Дава́йте обсу́дим э́ту пробле́му.', chinese: '让我们讨论一下这个问题。' }
            ]
          }
        ]
      },
      {
        id: 'b1_travel',
        name: '俄语中级：旅行与经历',
        description: '讲述旅行经历、旅途见闻，练习过去时叙述与细节描写。',
        videos: [
          {
            id: 'b1_travel_01',
            title: '旅行见闻：我去过的地方',
            description: '用俄语讲述旅行经历、文化见闻与难忘的瞬间。',
            thumbnail: 'https://picsum.photos/seed/ru_travel_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_travel_01/1280/720',
            level: 'B1',
            duration: '7:00',
            words: 190,
            tags: ['旅行', '经历', '过去时'],
            learners: 47,
            sentences: [
              { id: 1, russian: 'В про́шлом году́ я был в Санкт-Петербу́рге.', chinese: '去年我去过圣彼得堡。' },
              { id: 2, russian: 'Путеше́ствия расширя́ют кругозо́р.', chinese: '旅行开阔眼界。' },
              { id: 3, russian: 'Я люблю́ узнава́ть но́вые культу́ры.', chinese: '我喜欢了解新文化。' },
              { id: 4, russian: 'Мы заброни́ровали оте́ль в це́нтре го́рода.', chinese: '我们预订了市中心的酒店。' },
              { id: 5, russian: 'Доро́га заняла́ о́коло пяти́ часо́в.', chinese: '路上花了大约五个小时。' },
              { id: 6, russian: 'Мне понра́вилась ме́стная ку́хня.', chinese: '我喜欢当地的美食。' },
              { id: 7, russian: 'Мы посети́ли мно́го музе́ев.', chinese: '我们参观了许多博物馆。' },
              { id: 8, russian: 'Я сде́лал мно́го краси́вых фотогра́фий.', chinese: '我拍了许多漂亮的照片。' },
              { id: 9, russian: 'Путеше́ствовать самому́ интере́снее.', chinese: '独自旅行更有趣。' },
              { id: 10, russian: 'Э́та пое́здка была́ незабыва́емой.', chinese: '这次旅行令人难忘。' },
              { id: 11, russian: 'Мы познако́мились с ме́стными жи́телями.', chinese: '我们认识了当地人。' },
              { id: 12, russian: 'Я предпочита́ю путеше́ствовать по́ездом.', chinese: '我更喜欢坐火车旅行。' },
              { id: 13, russian: 'В сле́дующий раз я пое́ду в Каза́нь.', chinese: '下次我要去喀山。' },
              { id: 14, russian: 'Э́тот го́род произвёл на меня́ большо́е впечатле́ние.', chinese: '这座城市给我留下了深刻印象。' },
              { id: 15, russian: 'Я сове́тую вам посети́ть э́то ме́сто.', chinese: '我建议您去这个地方。' }
            ]
          }
        ]
      },
      {
        id: 'b1_health',
        name: '俄语中级：健康与习惯',
        description: '谈论健康、生活习惯与养生，学习表达建议与原因。',
        videos: [
          {
            id: 'b1_health_01',
            title: '健康生活：我的日常习惯',
            description: '用俄语谈论健康、作息、运动与饮食等生活习惯。',
            thumbnail: 'https://picsum.photos/seed/ru_health_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_health_01/1280/720',
            level: 'B1',
            duration: '6:40',
            words: 180,
            tags: ['健康', '习惯', '生活'],
            learners: 44,
            sentences: [
              { id: 1, russian: 'Здоро́вье — са́мое гла́вное.', chinese: '健康是最重要的。' },
              { id: 2, russian: 'Я стара́юсь вести́ здоро́вый о́браз жи́зни.', chinese: '我努力保持健康的生活方式。' },
              { id: 3, russian: 'По утра́м я де́лаю заря́дку.', chinese: '我早上做操。' },
              { id: 4, russian: 'Врач посове́товал мне бо́льше отдыха́ть.', chinese: '医生建议我多休息。' },
              { id: 5, russian: 'Я бро́сил кури́ть год наза́д.', chinese: '我一年前戒烟了。' },
              { id: 6, russian: 'Ну́жно пить бо́льше воды́.', chinese: '需要多喝水。' },
              { id: 7, russian: 'Регуля́рные заня́тия спо́ртом поле́зны.', chinese: '经常运动有益。' },
              { id: 8, russian: 'Я пло́хо сплю́ в после́днее вре́мя.', chinese: '我最近睡眠不好。' },
              { id: 9, russian: 'Мне ну́жно сбро́сить не́сколько килогра́ммов.', chinese: '我需要减几公斤。' },
              { id: 10, russian: 'Пита́ние до́лжно быть сбаланси́рованным.', chinese: '饮食应该均衡。' },
              { id: 11, russian: 'Стресс отрица́тельно влия́ет на здоро́вье.', chinese: '压力对健康有负面影响。' },
              { id: 12, russian: 'Я хожу́ в спортза́л три ра́за в неде́лю.', chinese: '我每周去三次健身房。' },
              { id: 13, russian: 'Она́ соблюда́ет дие́ту.', chinese: '她在节食。' },
              { id: 14, russian: 'Све́жий во́здух о́чень ва́жен.', chinese: '新鲜空气很重要。' },
              { id: 15, russian: 'Я чу́вствую себя́ гора́здо лу́чше.', chinese: '我感觉好多了。' }
            ]
          }
        ]
      }
    ]
  },
  B2: {
    collections: [
      {
        id: 'b2_society',
        name: '俄语高级：社会议题',
        description: '讨论社会、科技、文化等抽象议题，掌握复杂句式和书面表达。',
        videos: [
          {
            id: 'b2_society_01',
            title: '社会议题：科技改变生活',
            description: '用俄语讨论技术进步、文化保护与社会发展等抽象议题。',
            thumbnail: 'https://picsum.photos/seed/ru_society_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_society_01/1280/720',
            level: 'B2',
            duration: '8:40',
            words: 240,
            tags: ['社会', '科技', '高级'],
            learners: 32,
            sentences: [
              { id: 1, russian: 'Совреме́нное о́бщество ста́лкивается с мно́гими пробле́мами.', chinese: '现代社会面临许多问题。' },
              { id: 2, russian: 'Технологи́ческий прогре́сс меня́ет наш о́браз жи́зни.', chinese: '技术进步改变着我们的生活方式。' },
              { id: 3, russian: 'Ва́жно сохраня́ть культу́рное насле́дие.', chinese: '保护文化遗产很重要。' },
              { id: 4, russian: 'Э́та пробле́ма тре́бует серьёзного подхо́да.', chinese: '这个问题需要认真的态度。' },
              { id: 5, russian: 'Мне́ния по э́тому вопро́су раздели́лись.', chinese: '在这个问题上的意见出现了分歧。' },
              { id: 6, russian: 'Необходи́мо найти́ компроми́сс.', chinese: '必须找到折中方案。' },
              { id: 7, russian: 'Э́то явле́ние име́ет глубо́кие ко́рни.', chinese: '这种现象有深刻的根源。' },
              { id: 8, russian: 'Сле́дует обрати́ть внима́ние на э́ти фа́кты.', chinese: '应当注意这些事实。' },
              { id: 9, russian: 'Пра́вительство приня́ло но́вые ме́ры.', chinese: '政府采取了新措施。' },
              { id: 10, russian: 'Учёные провели́ обши́рное иссле́дование.', chinese: '科学家进行了广泛的研究。' },
              { id: 11, russian: 'Результа́ты иссле́дования впечатля́ют.', chinese: '研究结果令人印象深刻。' },
              { id: 12, russian: 'Э́то спосо́бствует разви́тию о́бщества.', chinese: '这有助于社会的发展。' },
              { id: 13, russian: 'Мы до́лжны бере́жно относи́ться к приро́де.', chinese: '我们应该爱护自然。' },
              { id: 14, russian: 'Э́та те́ма вызыва́ет мно́го спо́ров.', chinese: '这个话题引发许多争论。' },
              { id: 15, russian: 'Бу́дущее зави́сит от на́ших реше́ний.', chinese: '未来取决于我们的决定。' }
            ]
          }
        ]
      },
      {
        id: 'b2_tech',
        name: '俄语高级：科技与创新',
        description: '讨论科技发展、人工智能与数字化，掌握抽象论述与书面表达。',
        videos: [
          {
            id: 'b2_tech_01',
            title: '科技前沿：人工智能改变生活',
            description: '用俄语讨论技术进步、创新与社会影响等抽象议题。',
            thumbnail: 'https://picsum.photos/seed/ru_tech_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_tech_01/1280/720',
            level: 'B2',
            duration: '8:20',
            words: 230,
            tags: ['科技', '创新', '高级'],
            learners: 35,
            sentences: [
              { id: 1, russian: 'Техноло́гии развива́ются стреми́тельно.', chinese: '技术发展迅速。' },
              { id: 2, russian: 'Иску́сственный интелле́кт меня́ет мир.', chinese: '人工智能正在改变世界。' },
              { id: 3, russian: 'Смартфо́ны ста́ли ча́стью на́шей жи́зни.', chinese: '智能手机已成为我们生活的一部分。' },
              { id: 4, russian: 'Интерне́т откры́л но́вые возмо́жности для образова́ния.', chinese: '互联网为教育开辟了新可能。' },
              { id: 5, russian: 'Э́то откры́тие име́ет огро́мное значе́ние.', chinese: '这项发现意义重大。' },
              { id: 6, russian: 'Учёные разрабо́тали но́вый материа́л.', chinese: '科学家研发了一种新材料。' },
              { id: 7, russian: 'Цифровиза́ция затра́гивает все сфе́ры.', chinese: '数字化影响所有领域。' },
              { id: 8, russian: 'Мы должны́ защища́ть ли́чные да́нные.', chinese: '我们必须保护个人数据。' },
              { id: 9, russian: 'Робо́ты постепе́нно заменя́ют люде́й на произво́дстве.', chinese: '机器人正在生产中逐步取代人类。' },
              { id: 10, russian: 'Иннова́ции спосо́бствуют экономи́ческому ро́сту.', chinese: '创新促进经济增长。' },
              { id: 11, russian: 'Э́та техноло́гия ещё несоверше́нна.', chinese: '这项技术还不完善。' },
              { id: 12, russian: 'Онла́йн-образова́ние ста́ло популя́рным.', chinese: '在线教育已经流行。' },
              { id: 13, russian: 'Ну́жно осторо́жно относи́ться к но́вым те́хнологиям.', chinese: '需要谨慎对待新技术。' },
              { id: 14, russian: 'Бу́дущее невозмо́жно предста́вить без те́хнологий.', chinese: '未来无法想象没有技术。' },
              { id: 15, russian: 'Мне́ния о влия́нии те́хнологий раздели́лись.', chinese: '关于技术影响的意见存在分歧。' }
            ]
          }
        ]
      },
      {
        id: 'b2_environment',
        name: '俄语高级：环境与自然',
        description: '讨论环境保护、气候变化与可持续发展，练习复杂从句与论述。',
        videos: [
          {
            id: 'b2_environment_01',
            title: '环境保护：我们的共同责任',
            description: '用俄语讨论气候变化、污染治理与生态保护等议题。',
            thumbnail: 'https://picsum.photos/seed/ru_env_01/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_env_01/1280/720',
            level: 'B2',
            duration: '8:40',
            words: 240,
            tags: ['环境', '自然', '高级'],
            learners: 30,
            sentences: [
              { id: 1, russian: 'Защи́та окружа́ющей среды́ — на́ша о́бщая зада́ча.', chinese: '保护环境是我们共同的任务。' },
              { id: 2, russian: 'Глоба́льное потепле́ние вызыва́ет серьёзные опасе́ния.', chinese: '全球变暖引起严重担忧。' },
              { id: 3, russian: 'Мы до́лжны сокраща́ть вы́бросы углеки́слого га́за.', chinese: '我们必须减少二氧化碳排放。' },
              { id: 4, russian: 'Перерабо́тка отхо́дов помога́ет сохраня́ть приро́ду.', chinese: '回收垃圾有助于保护自然。' },
              { id: 5, russian: 'Возобновля́емая эне́ргия стано́вится всё популя́рнее.', chinese: '可再生能源越来越受欢迎。' },
              { id: 6, russian: 'Мно́гие ви́ды живо́тных нахо́дятся под угро́зой исчезнове́ния.', chinese: '许多动物物种濒临灭绝。' },
              { id: 7, russian: 'Загрязне́ние во́здуха вре́дно для здоро́вья.', chinese: '空气污染有害健康。' },
              { id: 8, russian: 'Мы должны́ бере́чь приро́дные ресу́рсы.', chinese: '我们应该珍惜自然资源。' },
              { id: 9, russian: 'Ка́ждый мо́жет внести́ свой вклад.', chinese: '每个人都能做出贡献。' },
              { id: 10, russian: 'Э́та пробле́ма тре́бует междунаро́дного сотру́дничества.', chinese: '这个问题需要国际合作。' },
              { id: 11, russian: 'Сохране́ние лесо́в име́ет ключево́е значе́ние.', chinese: '保护森林至关重要。' },
              { id: 12, russian: 'Мы испо́льзуем сли́шком мно́го пла́стика.', chinese: '我们使用太多塑料。' },
              { id: 13, russian: 'Кли́мат меня́ется бы́стрее, чем ожида́лось.', chinese: '气候变化比预期的更快。' },
              { id: 14, russian: 'Э́ти ме́ры помогу́т улучши́ть ситуа́цию.', chinese: '这些措施将有助于改善情况。' },
              { id: 15, russian: 'Бу́дущее плане́ты в на́ших рука́х.', chinese: '地球的未来在我们手中。' }
            ]
          }
        ]
      }
    ]
  }
}

export function findVideo(videoId) {
  for (const level of LEVELS) {
    for (const collection of courseLibrary[level].collections) {
      const video = collection.videos.find(v => v.id === videoId)
      if (video) return { video, collection, level }
    }
  }
  return null
}

export function getLevelVideos(level) {
  const out = []
  for (const collection of (courseLibrary[level] || {}).collections || []) {
    for (const video of collection.videos) out.push({ video, collection })
  }
  return out
}

export function flatVideoList() {
  const out = []
  for (const level of LEVELS) {
    for (const collection of courseLibrary[level].collections) {
      for (const video of collection.videos) out.push({ video, collection, level })
    }
  }
  return out
}
