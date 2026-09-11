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
      },
      {
        id: 'a1_colors',
        name: '俄语入门：颜色与形状',
        description: '认识常用颜色与基本形状词汇，学会描述事物的外观。',
        videos: [
          {
            id: 'a1_colors_01',
            title: '俄语第十三课：颜色与形状',
            description: '学习颜色、形状与描述外观的基础词汇。',
            thumbnail: 'https://picsum.photos/seed/ru_a1_colors/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a1_colors/1280/720',
            level: 'A1',
            duration: '4:50',
            words: 200,
            tags: ['基础', '颜色', '物品'],
            learners: 88,
            sentences: [
              { id: 1, russian: 'Кра́сный — мой люби́мый цвет.', chinese: '红色是我最喜欢的颜色。' },
              { id: 2, russian: 'У меня́ есть си́няя ру́чка.', chinese: '我有一支蓝色的钢笔。' },
              { id: 3, russian: 'Э́тот каранда́ш жёлтый.', chinese: '这支铅笔是黄色的。' },
              { id: 4, russian: 'Зелёная трава́ о́чень краси́вая.', chinese: '绿草很漂亮。' },
              { id: 5, russian: 'Мой автомоби́ль чёрный.', chinese: '我的汽车是黑色的。' },
              { id: 6, russian: 'Бе́лый снег лежи́т на земле́.', chinese: '白雪落在地上。' },
              { id: 7, russian: 'Ора́нжевый апельси́н вку́сный.', chinese: '橙色的橙子很好吃。' },
              { id: 8, russian: 'Э́та руба́шка ро́зовая.', chinese: '这件衬衫是粉色的。' },
              { id: 9, russian: 'Се́рая ко́шка спит.', chinese: '灰色的猫在睡觉。' },
              { id: 10, russian: 'Кори́чневый стол стои́т в ко́мнате.', chinese: '棕色的桌子在房间里。' },
              { id: 11, russian: 'Како́й цвет тебе́ нра́вится?', chinese: '你喜欢什么颜色？' },
              { id: 12, russian: 'Фиоле́товые цветы́ краси́вые.', chinese: '紫色的花很漂亮。' },
              { id: 13, russian: 'Э́тот круг — кра́сный.', chinese: '这个圆圈是红色的。' },
              { id: 14, russian: 'Квадра́т име́ет четы́ре стороны́.', chinese: '正方形有四条边。' },
              { id: 15, russian: 'Треуго́льник — э́то геометри́ческая фигу́ра.', chinese: '三角形是一个几何图形。' },
              { id: 16, russian: 'Прямоуго́льник дли́нный.', chinese: '长方形是长的。' },
              { id: 17, russian: 'Ова́л похо́ж на яйцо́.', chinese: '椭圆形像鸡蛋。' },
              { id: 18, russian: 'Како́й фо́рмы э́тот сто́лик?', chinese: '这张桌子是什么形状？' },
              { id: 19, russian: 'Звезда́ име́ет пять коне́ц.', chinese: '星星有五个角。' },
              { id: 20, russian: 'Си́ний цвет мне то́же нра́вится.', chinese: '蓝色我也喜欢。' }
            ]
          }
        ]
      },
      {
        id: 'a1_rooms',
        name: '俄语入门：房间与家具',
        description: '掌握房间、家具与居家物品词汇，学会描述自己的家。',
        videos: [
          {
            id: 'a1_rooms_01',
            title: '俄语第十四课：我的家',
            description: '学习房间、家具与居家布置的基础词汇。',
            thumbnail: 'https://picsum.photos/seed/ru_a1_rooms/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a1_rooms/1280/720',
            level: 'A1',
            duration: '5:00',
            words: 200,
            tags: ['基础', '家居', '房间'],
            learners: 90,
            sentences: [
              { id: 1, russian: 'Э́то моя́ ко́мната.', chinese: '这是我的房间。' },
              { id: 2, russian: 'В ко́мнате стои́т крова́ть.', chinese: '房间里有一张床。' },
              { id: 3, russian: 'Стол и стул в ку́хне.', chinese: '桌子和椅子在厨房里。' },
              { id: 4, russian: 'Дива́н стои́т в гости́ной.', chinese: '沙发在客厅里。' },
              { id: 5, russian: 'Холоди́льник в ку́хне.', chinese: '冰箱在厨房里。' },
              { id: 6, russian: 'На стене́ часы́.', chinese: '墙上有钟。' },
              { id: 7, russian: 'В шкафу́ лежа́т оде́жда.', chinese: '衣柜里放着衣服。' },
              { id: 8, russian: 'Зе́ркало в ва́нной ко́мнате.', chinese: '浴室里有镜子。' },
              { id: 9, russian: 'Окно́ большо́е и све́тлое.', chinese: '窗户又大又明亮。' },
              { id: 10, russian: 'Дверь закры́та.', chinese: '门关着。' },
              { id: 11, russian: 'Ковёр лежи́т на полу́.', chinese: '地毯铺在地板上。' },
              { id: 12, russian: 'Ла́мпа на сто́лике.', chinese: '台灯在桌子上。' },
              { id: 13, russian: 'Где ва́нная ко́мната?', chinese: '浴室在哪里？' },
              { id: 14, russian: 'Моя́ спа́льня о́чень ую́тная.', chinese: '我的卧室很温馨。' },
              { id: 15, russian: 'Телеви́зор в гости́ной.', chinese: '电视在客厅里。' },
              { id: 16, russian: 'У меня́ есть но́вый компью́тер.', chinese: '我有一台新电脑。' },
              { id: 17, russian: 'Кни́ги на по́лке.', chinese: '书在书架上。' },
              { id: 18, russian: 'В кварти́ре три ко́мнаты.', chinese: '公寓有三个房间。' },
              { id: 19, russian: 'Стол о́коло окна́.', chinese: '桌子在窗户旁边。' },
              { id: 20, russian: 'Э́то мой дом.', chinese: '这是我的房子。' }
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
      },
      {
        id: 'a2_shopping',
        name: '俄语进阶：购物与商场',
        description: '学会逛商场、试穿、比价与付款，掌握购物全流程的常用表达。',
        videos: [
          {
            id: 'a2_shopping_01',
            title: '购物与商场：买得明白',
            description: '在商场购物、试穿尺码、讨价还价与付款的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_shopping/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_shopping/1280/720',
            level: 'A2',
            duration: '6:30',
            words: 240,
            tags: ['购物', '进阶'],
            learners: 44,
            sentences: [
              { id: 1, russian: 'Где здесь ближа́йший магази́н?', chinese: '最近的商店在哪里？' },
              { id: 2, russian: 'Я хочу́ купи́ть но́вую ку́ртку.', chinese: '我想买一件新外套。' },
              { id: 3, russian: 'Э́то сли́шком до́рого.', chinese: '这个太贵了。' },
              { id: 4, russian: 'У вас есть разме́р по́больше?', chinese: '你们有大一点的尺码吗？' },
              { id: 5, russian: 'Мо́жно приме́рить?', chinese: '可以试穿吗？' },
              { id: 6, russian: 'Я беру́ э́то.', chinese: '我要这个了。' },
              { id: 7, russian: 'Ско́лько э́то сто́ит?', chinese: '这个多少钱？' },
              { id: 8, russian: 'Мо́жно оплати́ть ка́ртой?', chinese: '可以用卡支付吗？' },
              { id: 9, russian: 'Ски́дка — три́дцать проце́нтов.', chinese: '折扣是百分之三十。' },
              { id: 10, russian: 'Э́та руба́шка мне нра́вится.', chinese: '我喜欢这件衬衫。' },
              { id: 11, russian: 'Мне нужна́ по́мощь продавца́.', chinese: '我需要售货员帮忙。' },
              { id: 12, russian: 'Вы при́мете возвра́т?', chinese: '你们接受退货吗？' },
              { id: 13, russian: 'Э́ти ту́фли о́чень удо́бные.', chinese: '这双鞋很舒服。' },
              { id: 14, russian: 'Я ищу́ пода́рок для ма́мы.', chinese: '我在给妈妈找礼物。' },
              { id: 15, russian: 'Сего́дня в магази́не распрода́жа.', chinese: '今天商店有促销。' },
              { id: 16, russian: 'Чек, пожа́луйста.', chinese: '请给我小票。' },
              { id: 17, russian: 'Э́то пода́рок, упаку́йте, пожа́луйста.', chinese: '这是礼物，请包装一下。' },
              { id: 18, russian: 'Гаранти́я на то́вар — оди́н год.', chinese: '商品保修一年。' },
              { id: 19, russian: 'Мне ну́жен друго́й цвет.', chinese: '我需要另一种颜色。' },
              { id: 20, russian: 'Когда́ закро́ется магази́н?', chinese: '商店几点关门？' }
            ]
          }
        ]
      },
      {
        id: 'a2_food',
        name: '俄语进阶：饮食与餐厅',
        description: '从点菜、口味偏好到结账，掌握在餐厅用餐与在家做饭的常用表达。',
        videos: [
          {
            id: 'a2_food_01',
            title: '饮食与餐厅：美味俄语',
            description: '在餐厅点菜、表达口味偏好、预约餐位与结账的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_food/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_food/1280/720',
            level: 'A2',
            duration: '6:50',
            words: 240,
            tags: ['饮食', '餐厅'],
            learners: 46,
            sentences: [
              { id: 1, russian: 'Мы хоти́м заказа́ть столи́к на двои́х.', chinese: '我们想订两个人的桌子。' },
              { id: 2, russian: 'Что вы посове́туете?', chinese: '您推荐什么？' },
              { id: 3, russian: 'Я закажу́ сала́т и суп.', chinese: '我要点沙拉和汤。' },
              { id: 4, russian: 'Э́то блю́до о́чень вку́сное.', chinese: '这道菜很好吃。' },
              { id: 5, russian: 'Принеси́те, пожа́луйста, меню́.', chinese: '请拿菜单来。' },
              { id: 6, russian: 'У меня́ аллерги́я на оре́хи.', chinese: '我对坚果过敏。' },
              { id: 7, russian: 'Мо́жно без лу́ка, пожа́луйста?', chinese: '可以不要洋葱吗？' },
              { id: 8, russian: 'Гото́вьте, пожа́луйста, не о́чень о́стро.', chinese: '请不要做得太辣。' },
              { id: 9, russian: 'Счёт, пожа́луйста.', chinese: '请结账。' },
              { id: 10, russian: 'Мы оста́лись дово́льны обе́дом.', chinese: '我们对午餐很满意。' },
              { id: 11, russian: 'Э́тот рестора́н популя́рен в на́шем го́роде.', chinese: '这家餐厅在我们城市很受欢迎。' },
              { id: 12, russian: 'Я люблю́ гото́вить до́ма.', chinese: '我喜欢在家做饭。' },
              { id: 13, russian: 'Реце́пт э́того су́па о́чень просто́й.', chinese: '这个汤的做法很简单。' },
              { id: 14, russian: 'На за́втрак я ем ка́шу.', chinese: '早餐我吃粥。' },
              { id: 15, russian: 'В э́том кафе́ хоро́ший ко́фе.', chinese: '这家咖啡馆的咖啡很好。' },
              { id: 16, russian: 'Мы заказа́ли пи́ццу и сала́т.', chinese: '我们点了披萨和沙拉。' },
              { id: 17, russian: 'Официа́нт принёс счёт.', chinese: '服务员拿来了账单。' },
              { id: 18, russian: 'Я предпочита́ю чай, а не ко́фе.', chinese: '我更喜欢茶，而不是咖啡。' },
              { id: 19, russian: 'Сего́дня мы у́жинаем в рестора́не.', chinese: '今天我们出去吃晚饭。' },
              { id: 20, russian: 'Э́то о́чень популя́рное блю́до.', chinese: '这是一道很受欢迎的菜。' }
            ]
          }
        ]
      },
      {
        id: 'a2_transport',
        name: '俄语进阶：交通出行',
        description: '问路、买票、换乘与打车，掌握城市出行的必备表达。',
        videos: [
          {
            id: 'a2_transport_01',
            title: '交通出行：城市穿梭',
            description: '公交地铁出行、问路、买票与打车的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_transport/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_transport/1280/720',
            level: 'A2',
            duration: '6:10',
            words: 240,
            tags: ['交通', '出行'],
            learners: 42,
            sentences: [
              { id: 1, russian: 'Как дое́хать до це́нтра?', chinese: '怎么去市中心？' },
              { id: 2, russian: 'Где остано́вка авто́буса?', chinese: '公交车站在哪里？' },
              { id: 3, russian: 'Ско́лько сто́ит биле́т на метро́?', chinese: '地铁票多少钱？' },
              { id: 4, russian: 'Э́тот по́езд идёт до вокза́ла?', chinese: '这趟火车去火车站吗？' },
              { id: 5, russian: 'Мы пое́дем на такси́.', chinese: '我们坐出租车去。' },
              { id: 6, russian: 'Я до́лжен сде́лать переса́дку.', chinese: '我需要换乘。' },
              { id: 7, russian: 'Како́й авто́бус идёт до аэропо́рта?', chinese: '哪路公交车去机场？' },
              { id: 8, russian: 'Вы выхо́дите на сле́дующей?', chinese: '您下一站下车吗？' },
              { id: 9, russian: 'Тра́фик сего́дня о́чень плохо́й.', chinese: '今天交通很堵。' },
              { id: 10, russian: 'Лу́чше пое́хать на метро́.', chinese: '最好坐地铁去。' },
              { id: 11, russian: 'Биле́т в оди́н коне́ц, пожа́луйста.', chinese: '请给我一张单程票。' },
              { id: 12, russian: 'Где я могу́ купи́ть биле́т?', chinese: '我在哪里可以买票？' },
              { id: 13, russian: 'Авто́бус придёт че́рез пять мину́т.', chinese: '公交车五分钟后来。' },
              { id: 14, russian: 'Дорога́ заняла́ о́коло часа́.', chinese: '路程大约花了一个小时。' },
              { id: 15, russian: 'На у́лице про́бки.', chinese: '街上堵车。' },
              { id: 16, russian: 'Я потеря́л свою́ ка́рту.', chinese: '我丢了交通卡。' },
              { id: 17, russian: 'Пе́рвый по́езд отправля́ется в шесть.', chinese: '第一班火车六点出发。' },
              { id: 18, russian: 'Э́тот райо́н далеко́ от це́нтра.', chinese: '这个区离市中心很远。' },
              { id: 19, russian: 'Мы дое́хали без пробле́м.', chinese: '我们顺利到达了。' },
              { id: 20, russian: 'Расписа́ние меня́ется ка́ждый день.', chinese: '时刻表每天都在变。' }
            ]
          }
        ]
      },
      {
        id: 'a2_weather',
        name: '俄语进阶：天气与季节',
        description: '描述天气变化、讨论季节与出行计划，掌握天气话题的表达。',
        videos: [
          {
            id: 'a2_weather_01',
            title: '天气与季节：四季俄语',
            description: '谈论天气、季节变化与出行计划的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_weather/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_weather/1280/720',
            level: 'A2',
            duration: '5:50',
            words: 240,
            tags: ['天气', '季节'],
            learners: 40,
            sentences: [
              { id: 1, russian: 'Кака́я сего́дня пого́да?', chinese: '今天天气怎么样？' },
              { id: 2, russian: 'Вчера́ был дождь весь день.', chinese: '昨天下了一整天雨。' },
              { id: 3, russian: 'За́втра бу́дет тепло́ и со́лнечно.', chinese: '明天将温暖晴朗。' },
              { id: 4, russian: 'Зимо́й здесь о́чень хо́лодно.', chinese: '冬天这里很冷。' },
              { id: 5, russian: 'Ле́том мы е́здим на мо́ре.', chinese: '夏天我们去海边。' },
              { id: 6, russian: 'О́сенью ча́сто идёт дождь.', chinese: '秋天经常下雨。' },
              { id: 7, russian: 'Весно́й приро́да просыпа́ется.', chinese: '春天大自然苏醒。' },
              { id: 8, russian: 'Сего́дня ве́тер си́льный.', chinese: '今天风很大。' },
              { id: 9, russian: 'Температу́ра па́дает до мину́с десяти́.', chinese: '气温降到零下十度。' },
              { id: 10, russian: 'Не забу́дь зонт, пого́да перемени́тся.', chinese: '别忘带伞，天气会变。' },
              { id: 11, russian: 'Снег шёл всю ночь.', chinese: '雪下了一整夜。' },
              { id: 12, russian: 'Ле́том быва́ет о́чень жа́рко.', chinese: '夏天有时非常热。' },
              { id: 13, russian: 'Прошло́й зимо́й бы́ло ма́ло сне́га.', chinese: '去年冬天雪很少。' },
              { id: 14, russian: 'Сейча́с идеа́льная пого́да для прогу́лки.', chinese: '现在是散步的理想天气。' },
              { id: 15, russian: 'По прогно́зу бу́дет гроза́.', chinese: '天气预报说会有雷雨。' },
              { id: 16, russian: 'Не́бо сего́дня я́сное.', chinese: '今天天空晴朗。' },
              { id: 17, russian: 'У́тром был тума́н.', chinese: '早上有雾。' },
              { id: 18, russian: 'Мы наде́емся на хоро́шую пого́ду в выходны́е.', chinese: '我们希望周末有好天气。' },
              { id: 19, russian: 'В э́том году́ зима́ была́ тёплой.', chinese: '今年冬天很暖和。' },
              { id: 20, russian: 'Пого́да влия́ет на моё настрое́ние.', chinese: '天气影响我的心情。' }
            ]
          }
        ]
      },
      {
        id: 'a2_health',
        name: '俄语进阶：健康与身体',
        description: '描述病痛、看医生、买药与健康习惯，掌握健康话题的表达。',
        videos: [
          {
            id: 'a2_health_01',
            title: '健康与身体：照顾好自己',
            description: '看医生、买药、描述症状与健康生活建议的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_health/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_health/1280/720',
            level: 'A2',
            duration: '6:20',
            words: 240,
            tags: ['健康', '身体'],
            learners: 43,
            sentences: [
              { id: 1, russian: 'Я пло́хо себя́ чу́вствую.', chinese: '我感觉不舒服。' },
              { id: 2, russian: 'У меня́ боли́т голова́.', chinese: '我头痛。' },
              { id: 3, russian: 'Мне ну́жно к врачу́.', chinese: '我需要去看医生。' },
              { id: 4, russian: 'Како́й у вас симпто́м?', chinese: '您有什么症状？' },
              { id: 5, russian: 'Я простуди́лся на про́шлой неде́ле.', chinese: '我上周感冒了。' },
              { id: 6, russian: 'Принима́йте э́то лека́рство три ра́за в день.', chinese: '这个药一天吃三次。' },
              { id: 7, russian: 'У меня́ высо́кая температу́ра.', chinese: '我发高烧了。' },
              { id: 8, russian: 'Врач посове́товал мно́го отдыха́ть.', chinese: '医生建议多休息。' },
              { id: 9, russian: 'Где нахо́дится ближа́йшая апте́ка?', chinese: '最近的药店在哪里？' },
              { id: 10, russian: 'Я де́лаю заря́дку ка́ждое у́тро.', chinese: '我每天早上做操。' },
              { id: 11, russian: 'Здоро́вый о́браз жи́зни о́чень ва́жен.', chinese: '健康的生活方式非常重要。' },
              { id: 12, russian: 'Мы бе́гаем в па́рке по утра́м.', chinese: '我们早上在公园跑步。' },
              { id: 13, russian: 'У него́ аллерги́я на пыль.', chinese: '他对灰尘过敏。' },
              { id: 14, russian: 'Вы до́лжны пить бо́льше воды́.', chinese: '您应该多喝水。' },
              { id: 15, russian: 'Опера́ция прошла́ хорошо́.', chinese: '手术很顺利。' },
              { id: 16, russian: 'Мне сде́лали приви́вку.', chinese: '我打了疫苗。' },
              { id: 17, russian: 'Он ку́рит, и э́то вре́дно.', chinese: '他抽烟，这有害。' },
              { id: 18, russian: 'По́сле боле́зни я чу́вствую себя́ лу́чше.', chinese: '病后我感觉好多了。' },
              { id: 19, russian: 'Сон о́чень ва́жен для здоро́вья.', chinese: '睡眠对健康很重要。' },
              { id: 20, russian: 'Моя́ ба́бушка принима́ет лека́рства ка́ждый день.', chinese: '我奶奶每天吃药。' }
            ]
          }
        ]
      },
      {
        id: 'a2_home',
        name: '俄语进阶：家与居住',
        description: '描述房间、家具、租房与家务，掌握居住场景的常用表达。',
        videos: [
          {
            id: 'a2_home_01',
            title: '家与居住：温馨小窝',
            description: '谈论住所、房间布置、租房与家务的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_home/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_home/1280/720',
            level: 'A2',
            duration: '6:00',
            words: 240,
            tags: ['居住', '家庭'],
            learners: 41,
            sentences: [
              { id: 1, russian: 'Мы снима́ем кварти́ру в це́нтре.', chinese: '我们在市中心租了一套公寓。' },
              { id: 2, russian: 'В мое́й ко́мнате два окна́.', chinese: '我的房间有两扇窗户。' },
              { id: 3, russian: 'Кварти́ра состоя́ит из трёх ко́мнат.', chinese: '这套公寓有三个房间。' },
              { id: 4, russian: 'Я живу́ на пя́том этаже́.', chinese: '我住在五楼。' },
              { id: 5, russian: 'На ку́хне есть холоди́льник и плита́.', chinese: '厨房里有冰箱和炉灶。' },
              { id: 6, russian: 'Мы перее́хали в но́вый дом.', chinese: '我们搬进了新房子。' },
              { id: 7, russian: 'Аре́нда сто́ит до́рого.', chinese: '房租很贵。' },
              { id: 8, russian: 'В до́ме есть лифт и парко́вка.', chinese: '楼里有电梯和停车场。' },
              { id: 9, russian: 'Я убира́ю кварти́ру по суббо́там.', chinese: '我每周六打扫公寓。' },
              { id: 10, russian: 'На стене́ виси́т карти́на.', chinese: '墙上挂着一幅画。' },
              { id: 11, russian: 'В спа́льне стои́т больша́я крова́ть.', chinese: '卧室里有一张大床。' },
              { id: 12, russian: 'Со́седи о́чень шу́мные.', chinese: '邻居很吵。' },
              { id: 13, russian: 'Мы пла́тим за коммуна́льные услу́ги.', chinese: '我们支付水电费。' },
              { id: 14, russian: 'Дом нахо́дится ря́дом с па́рком.', chinese: '房子在公园旁边。' },
              { id: 15, russian: 'Мне нра́вится мой но́вый райо́н.', chinese: '我喜欢我的新小区。' },
              { id: 16, russian: 'В го́стиной стои́т дива́н и телеви́зор.', chinese: '客厅里有沙发和电视。' },
              { id: 17, russian: 'На ба́лконе мно́го цвето́в.', chinese: '阳台上有很多花。' },
              { id: 18, russian: 'Мы и́щем кварти́ру побли́же к рабо́те.', chinese: '我们在找离工作更近的公寓。' },
              { id: 19, russian: 'В ва́нной есть стира́льная маши́на.', chinese: '浴室里有洗衣机。' },
              { id: 20, russian: 'До́ма я чу́вствую себя́ споко́йно.', chinese: '在家里我感到安心。' }
            ]
          }
        ]
      },
      {
        id: 'a2_work',
        name: '俄语进阶：工作与职业',
        description: '谈论日常工作、会议、升职与休假，掌握职场常用表达。',
        videos: [
          {
            id: 'a2_work_01',
            title: '工作与职业：职场俄语',
            description: '日常工作、开会、汇报与职场交际的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_work/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_work/1280/720',
            level: 'A2',
            duration: '6:40',
            words: 240,
            tags: ['工作', '职业'],
            learners: 47,
            sentences: [
              { id: 1, russian: 'Я рабо́таю в иностра́нной компа́нии.', chinese: '我在一家外企工作。' },
              { id: 2, russian: 'Мой рабо́чий день начина́ется в де́вять.', chinese: '我的工作日九点开始。' },
              { id: 3, russian: 'Вчера́ я рабо́тал до по́зднего ве́чера.', chinese: '我昨天工作到很晚。' },
              { id: 4, russian: 'У меня́ сего́дня мно́го рабо́ты.', chinese: '我今天有很多工作。' },
              { id: 5, russian: 'Мы име́ем собра́ние ка́ждый понеде́льник.', chinese: '我们每周一开会。' },
              { id: 6, russian: 'Моя́ колле́га по́могла мне с прое́ктом.', chinese: '我的同事帮我做了项目。' },
              { id: 7, russian: 'Я получи́л повыше́ние в про́шлом году́.', chinese: '我去年升职了。' },
              { id: 8, russian: 'Она́ рабо́тает из до́ма два дня в неде́лю.', chinese: '她每周在家工作两天。' },
              { id: 9, russian: 'Зарпла́та у меня́ неплоха́я.', chinese: '我的工资不错。' },
              { id: 10, russian: 'Я отпра́вил отчёт нача́льнику.', chinese: '我把报告发给了领导。' },
              { id: 11, russian: 'Мы заключи́ли но́вый контра́кт.', chinese: '我们签了新合同。' },
              { id: 12, russian: 'Каки́е у вас обя́занности?', chinese: '您的职责是什么？' },
              { id: 13, russian: 'Мне ну́жен о́тпуск ле́том.', chinese: '我夏天需要休假。' },
              { id: 14, russian: 'Колле́ги о́чень дру́желю́бные.', chinese: '同事们很友好。' },
              { id: 15, russian: 'Я иска́л рабо́ту три ме́сяца.', chinese: '我找了三个月工作。' },
              { id: 16, russian: 'Компа́ния организу́ет ку́рсы.', chinese: '公司组织培训课程。' },
              { id: 17, russian: 'Он уво́лился и нашёл но́вую рабо́ту.', chinese: '他辞职并找到了新工作。' },
              { id: 18, russian: 'Мы рабо́таем в кома́нде.', chinese: '我们团队合作。' },
              { id: 19, russian: 'Обе́денный переры́в — оди́н час.', chinese: '午休一小时。' },
              { id: 20, russian: 'Рабо́та занима́ет мно́го вре́мени.', chinese: '工作占用很多时间。' }
            ]
          }
        ]
      },
      {
        id: 'a2_study',
        name: '俄语进阶：学习与学校',
        description: '谈论课程、考试、作业与成绩，掌握校园场景的表达。',
        videos: [
          {
            id: 'a2_study_01',
            title: '学习与学校：校园俄语',
            description: '上课、考试、作业与图书馆学习的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_study/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_study/1280/720',
            level: 'A2',
            duration: '6:25',
            words: 240,
            tags: ['学习', '校园'],
            learners: 45,
            sentences: [
              { id: 1, russian: 'Я учу́сь в университе́те на второ́м ку́рсе.', chinese: '我在大学读二年级。' },
              { id: 2, russian: 'Вчера́ мы сдава́ли экза́мен по ру́сскому.', chinese: '昨天我们考了俄语。' },
              { id: 3, russian: 'Мне ну́жно написа́ть ку́рсовую рабо́ту.', chinese: '我需要写课程论文。' },
              { id: 4, russian: 'Преподава́тель объясни́л тру́дную те́му.', chinese: '老师解释了难题。' },
              { id: 5, russian: 'Я гото́влюсь к те́сту сейча́с.', chinese: '我现在正在准备考试。' },
              { id: 6, russian: 'Мы изуча́ем исто́рию Росси́и.', chinese: '我们学习俄罗斯历史。' },
              { id: 7, russian: 'Студе́нты задаю́т мно́го вопро́сов.', chinese: '学生们问很多问题。' },
              { id: 8, russian: 'В библиоте́ке ти́хо и ую́тно.', chinese: '图书馆里安静舒适。' },
              { id: 9, russian: 'Моя́ успева́емость улучши́лась.', chinese: '我的成绩提高了。' },
              { id: 10, russian: 'На уро́ке мы чита́ли те́кст.', chinese: '课上我们读了课文。' },
              { id: 11, russian: 'До́ма я де́лаю дома́шнее зада́ние.', chinese: '我在家做作业。' },
              { id: 12, russian: 'Се́ссия начина́ется в январе́.', chinese: '考试季一月份开始。' },
              { id: 13, russian: 'Мой одногру́ппник помога́ет мне с ру́сским.', chinese: '我的同学帮我学俄语。' },
              { id: 14, russian: 'Мы слу́шаем а́удио на заня́тиях.', chinese: '课上我们听音频。' },
              { id: 15, russian: 'Экза́мен был не о́чень тру́дный.', chinese: '考试不太难。' },
              { id: 16, russian: 'Я получи́л хоро́шую оце́нку.', chinese: '我得了好成绩。' },
              { id: 17, russian: 'Стипе́ндия помога́ет студе́нтам.', chinese: '奖学金帮助学生。' },
              { id: 18, russian: 'Ле́кция длила́сь два часа́.', chinese: '讲座持续了两个小时。' },
              { id: 19, russian: 'Мы повторя́ем пройденный материа́л.', chinese: '我们复习学过的材料。' },
              { id: 20, russian: 'Учи́ться иностра́нному языку́ интере́сно.', chinese: '学外语很有趣。' }
            ]
          }
        ]
      },
      {
        id: 'a2_social',
        name: '俄语进阶：社交与邀约',
        description: '发出邀请、约定时间、接受或婉拒，掌握社交往来表达。',
        videos: [
          {
            id: 'a2_social_01',
            title: '社交与邀约：朋友往来',
            description: '邀请朋友、约定见面、接受与婉拒的实用对话。',
            thumbnail: 'https://picsum.photos/seed/ru_a2_social/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_a2_social/1280/720',
            level: 'A2',
            duration: '6:15',
            words: 240,
            tags: ['社交', '邀约'],
            learners: 48,
            sentences: [
              { id: 1, russian: 'Ты свобо́ден в субо́ту?', chinese: '你周六有空吗？' },
              { id: 2, russian: 'Дава́й встре́тимся в кафе́.', chinese: '我们在咖啡馆见吧。' },
              { id: 3, russian: 'Я приглаша́ю тебя́ на день рожде́ния.', chinese: '我邀请你来生日聚会。' },
              { id: 4, russian: 'Дава́й пойдём в кино́ в выходны́е.', chinese: '我们周末去看电影吧。' },
              { id: 5, russian: 'К сожале́нию, я за́нят ве́чером.', chinese: '很遗憾，我晚上有事。' },
              { id: 6, russian: 'В како́е вре́мя мы встре́тимся?', chinese: '我们几点见面？' },
              { id: 7, russian: 'Я согла́сен на твоё предложе́ние.', chinese: '我同意你的提议。' },
              { id: 8, russian: 'Мо́жет быть, в друго́й раз?', chinese: '也许改天吧？' },
              { id: 9, russian: 'Спаси́бо за приглаше́ние!', chinese: '谢谢你的邀请！' },
              { id: 10, russian: 'Мы хорошо́ провели́ вре́мя вме́сте.', chinese: '我们一起度过了愉快的时光。' },
              { id: 11, russian: 'Ты хо́чешь пойти́ на конце́рт?', chinese: '你想去听音乐会吗？' },
              { id: 12, russian: 'Дава́й созвони́мся за́втра.', chinese: '我们明天打电话联系吧。' },
              { id: 13, russian: 'Он пригласи́л меня́ в го́сти.', chinese: '他邀请我去做客。' },
              { id: 14, russian: 'Я бу́ду рад тебя́ ви́деть.', chinese: '我会很高兴见到你。' },
              { id: 15, russian: 'Соберёмся у меня́ до́ма.', chinese: '我们在我家聚一聚。' },
              { id: 16, russian: 'Извини́, я уже́ обеща́л друго́му.', chinese: '抱歉，我已经答应了别人。' },
              { id: 17, russian: 'Дава́й отме́тим э́то вме́сте!', chinese: '我们一起庆祝吧！' },
              { id: 18, russian: 'Когда́ тебе́ удо́бно?', chinese: '你什么时候方便？' },
              { id: 19, russian: 'Встре́ча была́ о́чень прия́тной.', chinese: '见面很愉快。' },
              { id: 20, russian: 'Приходи́ к нам в го́сти в воскресе́нье.', chinese: '星期天来我们家做客吧。' }
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
      },
      {
        id: 'b1_compare',
        name: '俄语中级：比较与选择',
        description: '学会比较事物、权衡利弊、表达选择与观点，使用比较级和从句。',
        videos: [
          {
            id: 'b1_compare_01',
            title: '比较与选择：权衡之道',
            description: '比较方案、讨论优缺点、做出选择并说明理由的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_compare/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_compare/1280/720',
            level: 'B1',
            duration: '7:10',
            words: 260,
            tags: ['比较', '选择'],
            learners: 38,
            sentences: [
              { id: 1, russian: 'Э́тот вариа́нт лу́чше, чем друго́й.', chinese: '这个方案比另一个好。' },
              { id: 2, russian: 'Я предпочита́ю рабо́тать в це́нтре го́рода.', chinese: '我更喜欢在市中心工作。' },
              { id: 3, russian: 'Сравни́ть э́ти две моде́ли не так просто́.', chinese: '比较这两个型号并不简单。' },
              { id: 4, russian: 'У ка́ждого спо́соба есть свои́ преиму́щества и недоста́тки.', chinese: '每种方式都有自己的优缺点。' },
              { id: 5, russian: 'Я выбира́ю ме́жду двух рабо́т.', chinese: '我在两份工作之间选择。' },
              { id: 6, russian: 'Э́то реше́ние оказа́лось бо́лее разу́мным.', chinese: '这个决定结果更明智。' },
              { id: 7, russian: 'Он выступа́ет за но́вый план.', chinese: '他支持新计划。' },
              { id: 8, russian: 'Мы обсуди́ли все за и про́тив.', chinese: '我们讨论了所有利弊。' },
              { id: 9, russian: 'В отли́чие от прошло́го го́да, сейча́с всё ина́че.', chinese: '与去年不同，现在一切都变了。' },
              { id: 10, russian: 'Како́й из э́тих вариа́нтов вам бо́льше подхо́дит?', chinese: '这些选项中哪个更适合您？' },
              { id: 11, russian: 'Я счита́ю, что ка́чество ва́жнее коли́чества.', chinese: '我认为质量比数量更重要。' },
              { id: 12, russian: 'О́пыт показа́л, что э́то рабо́тает.', chinese: '经验表明这是可行的。' },
              { id: 13, russian: 'Мы сравни́ли це́ны в не́скольких магази́нах.', chinese: '我们比较了几家商店的价格。' },
              { id: 14, russian: 'Э́та кни́га интере́снее, чем я ожида́л.', chinese: '这本书比我预期的更有趣。' },
              { id: 15, russian: 'На мой взгляд, э́то лу́чший вы́бор.', chinese: '在我看来，这是最好的选择。' },
              { id: 16, russian: 'Ра́зница ме́жду ни́ми очеви́дна.', chinese: '它们之间的差别很明显。' },
              { id: 17, russian: 'Я соглаша́юсь с его́ мне́нием.', chinese: '我同意他的观点。' },
              { id: 18, russian: 'Тру́дно реши́ть, что лу́чше.', chinese: '很难决定哪个更好。' },
              { id: 19, russian: 'Мы должны́ взве́сить все аргуме́нты.', chinese: '我们必须权衡所有论据。' },
              { id: 20, russian: 'Он вы́брал са́мый практи́чный вариа́нт.', chinese: '他选了最实用的方案。' }
            ]
          }
        ]
      },
      {
        id: 'b1_story',
        name: '俄语中级：讲述经历',
        description: '用过去时和叙事结构讲述完整经历，描述细节与感受。',
        videos: [
          {
            id: 'b1_story_01',
            title: '讲述经历：我的故事',
            description: '讲述旅行、冒险和难忘时刻的完整叙事对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_story/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_story/1280/720',
            level: 'B1',
            duration: '7:30',
            words: 260,
            tags: ['经历', '叙事'],
            learners: 36,
            sentences: [
              { id: 1, russian: 'Про́шлым ле́том я е́здил в Санкт-Петербу́рг.', chinese: '去年夏天我去了圣彼得堡。' },
              { id: 2, russian: 'Всё началось с того́, что мы потеря́ли биле́ты.', chinese: '一切始于我们丢了票。' },
              { id: 3, russian: 'Когда́ мы прие́хали, бы́ло уже́ темно́.', chinese: '我们到达时天已经黑了。' },
              { id: 4, russian: 'Я рассказа́л ему́ о своём приключе́нии.', chinese: '我给他讲了我的冒险经历。' },
              { id: 5, russian: 'Снача́ла всё шло хорошо́, но пото́м случи́лось непредви́денное.', chinese: '起初一切顺利，但后来发生了意外。' },
              { id: 6, russian: 'Мы провели́ там три дня.', chinese: '我们在那里待了三天。' },
              { id: 7, russian: 'Он описа́л свой о́пыт о́чень подро́бно.', chinese: '他非常详细地描述了自己的经历。' },
              { id: 8, russian: 'Э́то был са́мый незабыва́емый день.', chinese: '那是最难忘的一天。' },
              { id: 9, russian: 'Я вспомина́ю ту пое́здку с удово́льствием.', chinese: '我愉快地回忆起那次旅行。' },
              { id: 10, russian: 'К сча́стью, мы успе́ли на после́дний по́езд.', chinese: '幸运的是，我们赶上了最后一班火车。' },
              { id: 11, russian: 'Она́ расска́зывала, как учи́лась за грани́цей.', chinese: '她讲述了她在国外学习的经历。' },
              { id: 12, russian: 'Мы встре́тили интере́сных люде́й.', chinese: '我们遇到了有趣的人。' },
              { id: 13, russian: 'По́сле э́того я понял, что мир большо́й.', chinese: '之后我明白了世界很大。' },
              { id: 14, russian: 'Он потеря́лся, но нашёл доро́гу домо́й.', chinese: '他迷路了，但找到了回家的路。' },
              { id: 15, russian: 'Э́та исто́рия произвела́ на меня́ впечатле́ние.', chinese: '这个故事给我留下了深刻印象。' },
              { id: 16, russian: 'Мы реши́ли верну́ться ра́ньше.', chinese: '我们决定早点回来。' },
              { id: 17, russian: 'Доро́га была́ дли́нной, но интере́сной.', chinese: '路很长，但很有趣。' },
              { id: 18, russian: 'Я никогда́ не забу́ду э́тот о́пыт.', chinese: '我永远不会忘记这段经历。' },
              { id: 19, russian: 'Он рассказа́л нам всё в дета́лях.', chinese: '他把一切都详细告诉了我们。' },
              { id: 20, russian: 'В конце́ концо́в всё зако́нчилось хорошо́.', chinese: '最终一切都圆满结束。' }
            ]
          }
        ]
      },
      {
        id: 'b1_plan',
        name: '俄语中级：计划与决定',
        description: '表达未来计划、目标与决定，使用将来时和条件表达。',
        videos: [
          {
            id: 'b1_plan_01',
            title: '计划与决定：未来蓝图',
            description: '讨论未来计划、目标设定与重要决定的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_plan/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_plan/1280/720',
            level: 'B1',
            duration: '7:00',
            words: 260,
            tags: ['计划', '决定'],
            learners: 39,
            sentences: [
              { id: 1, russian: 'Я плани́рую нача́ть свой би́знес.', chinese: '我计划创业。' },
              { id: 2, russian: 'Мы реши́ли перее́хать в друго́й го́род.', chinese: '我们决定搬到另一个城市。' },
              { id: 3, russian: 'В сле́дующем году́ я хочу́ вы́учить ещё оди́н язы́к.', chinese: '明年我想再学一门语言。' },
              { id: 4, russian: 'Он собира́ется купи́ть маши́ну.', chinese: '他打算买车。' },
              { id: 5, russian: 'Мы обсуди́ли на́ши пла́ны на бу́дущее.', chinese: '我们讨论了未来的计划。' },
              { id: 6, russian: 'Я наде́юсь, что всё получи́тся.', chinese: '我希望一切顺利。' },
              { id: 7, russian: 'Она́ мечта́ет откры́ть свою́ шко́лу.', chinese: '她梦想开一所自己的学校。' },
              { id: 8, russian: 'На́до реши́ть, куда́ мы пое́дем ле́том.', chinese: '我们需要决定夏天去哪里。' },
              { id: 9, russian: 'Мой план состоя́л в том, что́бы нача́ть ра́ньше.', chinese: '我的计划是早点开始。' },
              { id: 10, russian: 'Мы гото́вимся к большо́му мероприя́тию.', chinese: '我们正在筹备大型活动。' },
              { id: 11, russian: 'Я сомнева́юсь в э́том реше́нии.', chinese: '我怀疑这个决定。' },
              { id: 12, russian: 'Он предложи́л но́вую иде́ю.', chinese: '他提出了一个新想法。' },
              { id: 13, russian: 'Мы договори́лись встре́титься в пять.', chinese: '我们约好五点见面。' },
              { id: 14, russian: 'Ва́жно ста́вить реа́льные це́ли.', chinese: '设定现实的目标很重要。' },
              { id: 15, russian: 'Я реши́л измени́ть свою́ профе́ссию.', chinese: '我决定转行。' },
              { id: 16, russian: 'Э́тот прое́кт тре́бует мно́го вре́мени.', chinese: '这个项目需要很多时间。' },
              { id: 17, russian: 'Мы наде́емся дости́чь результа́та к концу́ го́да.', chinese: '我们希望年底前取得成果。' },
              { id: 18, russian: 'У нас есть не́сколько вариа́нтов.', chinese: '我们有几个选项。' },
              { id: 19, russian: 'Я уве́рен, что э́то пра́вильный путь.', chinese: '我相信这是正确的道路。' },
              { id: 20, russian: 'В конце́ концо́в мы приняли́ реше́ние вме́сте.', chinese: '最终我们一起做了决定。' }
            ]
          }
        ]
      },
      {
        id: 'b1_education',
        name: '俄语中级：教育话题',
        description: '讨论教育体系、留学、考试与终身学习，表达观点和批评。',
        videos: [
          {
            id: 'b1_education_01',
            title: '教育话题：知识的力量',
            description: '讨论教育价值、留学经历与教育改革的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_education/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_education/1280/720',
            level: 'B1',
            duration: '7:20',
            words: 260,
            tags: ['教育', '观点'],
            learners: 37,
            sentences: [
              { id: 1, russian: 'Образова́ние игра́ет ва́жную роль в жи́зни.', chinese: '教育在生活中扮演重要角色。' },
              { id: 2, russian: 'Он поступи́л в прести́жный университе́т.', chinese: '他考入了名牌大学。' },
              { id: 3, russian: 'Учёба за грани́цей даёт мно́го возможносте́й.', chinese: '出国留学带来很多机会。' },
              { id: 4, russian: 'Мы обсужда́ем пробле́мы совреме́нного образова́ния.', chinese: '我们在讨论现代教育的问题。' },
              { id: 5, russian: 'Экза́мены создаю́т стресс для студе́нтов.', chinese: '考试给学生带来压力。' },
              { id: 6, russian: 'Учи́тель вдохнови́л меня́ на изуче́ние нау́ки.', chinese: '老师激励我学习科学。' },
              { id: 7, russian: 'Зна́ние языко́в расширя́ет кру́гозо́р.', chinese: '掌握语言能开阔视野。' },
              { id: 8, russian: 'Она́ защити́ла дипло́мную рабо́ту.', chinese: '她通过了毕业论文答辩。' },
              { id: 9, russian: 'Непреры́вное образова́ние ва́жно в совреме́нном ми́ре.', chinese: '在当今世界，终身学习很重要。' },
              { id: 10, russian: 'Мы критику́ем ста́рую систе́му обуче́ния.', chinese: '我们批评旧的教育制度。' },
              { id: 11, russian: 'Он интересу́ется педаго́гикой.', chinese: '他对教育学感兴趣。' },
              { id: 12, russian: 'Шко́ла должна́ развива́ть крити́ческое мышле́ние.', chinese: '学校应该培养批判性思维。' },
              { id: 13, russian: 'Моя́ сестра́ получи́ла стипе́ндию на учёбу за рубежо́м.', chinese: '我姐姐获得了出国留学的奖学金。' },
              { id: 14, russian: 'Образова́ние до́лжно быть досту́пным для всех.', chinese: '教育应该对所有人开放。' },
              { id: 15, russian: 'Мы анализи́руем результа́ты иссле́дования.', chinese: '我们分析研究结果。' },
              { id: 16, russian: 'Он посеща́ет дополни́тельные ку́рсы.', chinese: '他上额外的课程。' },
              { id: 17, russian: 'Вы́сшее образова́ние открыва́ет две́ри к ка́рьере.', chinese: '高等教育打开职业之门。' },
              { id: 18, russian: 'Тру́дно совмеща́ть рабо́ту и учёбу.', chinese: '很难兼顾工作和学习。' },
              { id: 19, russian: 'Мотива́ция — ключ к успе́ху в учёбе.', chinese: '动力是学习成功的关键。' },
              { id: 20, russian: 'Мы должны́ инвести́ровать в образова́ние.', chinese: '我们应该投资教育。' }
            ]
          }
        ]
      },
      {
        id: 'b1_career',
        name: '俄语中级：职业发展',
        description: '讨论职业规划、跳槽、面试与职场发展，表达职业目标。',
        videos: [
          {
            id: 'b1_career_01',
            title: '职业发展：职场进阶',
            description: '讨论职业选择、面试、晋升与工作满意度的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_career/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_career/1280/720',
            level: 'B1',
            duration: '7:40',
            words: 260,
            tags: ['职业', '发展'],
            learners: 40,
            sentences: [
              { id: 1, russian: 'Я ду́маю о сме́не профе́ссии.', chinese: '我在考虑换职业。' },
              { id: 2, russian: 'Ка́рьера тре́бует постоя́нного разви́тия.', chinese: '职业需要持续发展。' },
              { id: 3, russian: 'Он получи́л предложе́ние от кру́пной компа́нии.', chinese: '他收到了大公司的录用通知。' },
              { id: 4, russian: 'Мы обсужда́ем перспекти́вы ро́ста.', chinese: '我们在讨论发展前景。' },
              { id: 5, russian: 'Ва́жно найти́ рабо́ту по душе́.', chinese: '找到自己喜欢的工作很重要。' },
              { id: 6, russian: 'Она́ мечта́ет о повыше́нии.', chinese: '她梦想升职。' },
              { id: 7, russian: 'Я развива́ю свои́ профессиона́льные на́выки.', chinese: '我在发展专业技能。' },
              { id: 8, russian: 'Руково́дство це́нит его́ трудолю́бие.', chinese: '领导很看重他的勤奋。' },
              { id: 9, russian: 'Мы ста́лкиваемся с конкуре́нцией на ры́нке труда́.', chinese: '我们在劳动力市场面临竞争。' },
              { id: 10, russian: 'Он ушёл с рабо́ты, потому́ что хоте́л бо́льше свобо́ды.', chinese: '他辞职了，因为他想要更多自由。' },
              { id: 11, russian: 'У неё есть о́пыт рабо́ты в междунаро́дных прое́ктах.', chinese: '她有国际项目的工作经验。' },
              { id: 12, russian: 'Я пишу́ резюме́ для но́вой до́лжности.', chinese: '我正在为新的职位写简历。' },
              { id: 13, russian: 'Собесе́дование прошло́ успе́шно.', chinese: '面试很顺利。' },
              { id: 14, russian: 'Мы сотру́дничаем с зарубе́жными па́ртнёрами.', chinese: '我们与外国伙伴合作。' },
              { id: 15, russian: 'Он увлечён свое́й рабо́той.', chinese: '他热爱自己的工作。' },
              { id: 16, russian: 'Ка́рьерный рост зави́сит от результа́тов.', chinese: '职业晋升取决于业绩。' },
              { id: 17, russian: 'Я гото́в учи́ться но́вым на́выкам.', chinese: '我愿意学习新技能。' },
              { id: 18, russian: 'Компа́ния предлага́ет хоро́шие усло́вия труда́.', chinese: '公司提供良好的工作条件。' },
              { id: 19, russian: 'Мы и́щем специали́ста в о́бласти марке́тинга.', chinese: '我们在找市场营销方面的专家。' },
              { id: 20, russian: 'В бу́дущем я хочу́ стать руководи́телем.', chinese: '未来我想成为管理者。' }
            ]
          }
        ]
      },
      {
        id: 'b1_culture',
        name: '俄语中级：文化与艺术',
        description: '讨论文学、音乐、电影与艺术，表达审美和文化观点。',
        videos: [
          {
            id: 'b1_culture_01',
            title: '文化与艺术：美的对话',
            description: '谈论书籍、电影、音乐与艺术价值的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_culture/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_culture/1280/720',
            level: 'B1',
            duration: '7:15',
            words: 260,
            tags: ['文化', '艺术'],
            learners: 35,
            sentences: [
              { id: 1, russian: 'Культу́ра отража́ет исто́рию наро́да.', chinese: '文化反映民族的历史。' },
              { id: 2, russian: 'Мы посети́ли вы́ставку совреме́нного иску́сства.', chinese: '我们参观了当代艺术展。' },
              { id: 3, russian: 'Он чита́ет класси́ческую литерату́ру.', chinese: '他阅读经典文学。' },
              { id: 4, russian: 'Э́тот фильм получи́л мно́жество награ́д.', chinese: '这部电影获得了很多奖项。' },
              { id: 5, russian: 'Му́зыка помога́ет мне расслабля́ться.', chinese: '音乐帮助我放松。' },
              { id: 6, russian: 'Мы обсужда́ем значе́ние иску́сства в о́бществе.', chinese: '我们在讨论艺术在社会中的意义。' },
              { id: 7, russian: 'Она́ интересу́ется ру́сской культу́рой.', chinese: '她对俄罗斯文化感兴趣。' },
              { id: 8, russian: 'Теа́тр привлека́ет мно́го зри́телей.', chinese: '剧院吸引很多观众。' },
              { id: 9, russian: 'Худо́жник выража́ет свои́ чу́вства че́рез карти́ны.', chinese: '画家通过画作表达情感。' },
              { id: 10, russian: 'Мы чита́ем стихи́ Пу́шкина.', chinese: '我们读普希金的诗。' },
              { id: 11, russian: 'Тради́ции передаю́тся из поколе́ния в поколе́ние.', chinese: '传统代代相传。' },
              { id: 12, russian: 'Э́та кни́га ста́ла бестсе́ллером.', chinese: '这本书成了畅销书。' },
              { id: 13, russian: 'Я предпочита́ю смотре́ть фи́льмы в оригина́ле.', chinese: '我喜欢看原声电影。' },
              { id: 14, russian: 'Культу́рный обме́н сближа́ет наро́ды.', chinese: '文化交流拉近各民族。' },
              { id: 15, russian: 'Музе́й хра́нит у́никальные экспона́ты.', chinese: '博物馆收藏着独特的展品。' },
              { id: 16, russian: 'Мы танцева́ли под наро́дную му́зыку.', chinese: '我们随着民族音乐跳舞。' },
              { id: 17, russian: 'Он пи́шет реце́нзии на кни́ги.', chinese: '他写书评。' },
              { id: 18, russian: 'Совреме́нное иску́сство не всегда́ поня́тно.', chinese: '当代艺术并不总是容易理解。' },
              { id: 19, russian: 'Мы обсуди́ли роль СМИ в культу́ре.', chinese: '我们讨论了媒体在文化中的作用。' },
              { id: 20, russian: 'Культу́рное насле́дие ну́жно сохраня́ть.', chinese: '文化遗产需要保护。' }
            ]
          }
        ]
      },
      {
        id: 'b1_society',
        name: '俄语中级：社会话题',
        description: '讨论社会变化、年轻人价值观与社会责任，表达看法。',
        videos: [
          {
            id: 'b1_society_01',
            title: '社会话题：我们身边的世界',
            description: '讨论社会问题、志愿活动与公民责任的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_society/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_society/1280/720',
            level: 'B1',
            duration: '7:25',
            words: 260,
            tags: ['社会', '观点'],
            learners: 36,
            sentences: [
              { id: 1, russian: 'О́бщество меня́ется о́чень бы́стро.', chinese: '社会变化非常快。' },
              { id: 2, russian: 'Мы обсужда́ем пробле́му безрабо́тицы.', chinese: '我们在讨论失业问题。' },
              { id: 3, russian: 'Молодёжь име́ет други́е це́нности.', chinese: '年轻人有不同的价值观。' },
              { id: 4, russian: 'Горо́дска́я жизнь име́ет свои́ плю́сы и ми́нусы.', chinese: '城市生活有其优缺点。' },
              { id: 5, russian: 'Мы должны́ уважа́ть мне́ния други́х.', chinese: '我们应该尊重他人的意见。' },
              { id: 6, russian: 'Социа́льные се́ти влия́ют на на́шу жизнь.', chinese: '社交网络影响我们的生活。' },
              { id: 7, russian: 'Он волонтёр и помога́ет лю́дям.', chinese: '他是志愿者，帮助他人。' },
              { id: 8, russian: 'Населе́ние го́рода бы́стро растёт.', chinese: '城市人口快速增长。' },
              { id: 9, russian: 'Мы говори́м о пробле́мах пожилы́х люде́й.', chinese: '我们在谈论老年人的问题。' },
              { id: 10, russian: 'Доброво́льчество стано́вится популя́рным.', chinese: '志愿服务越来越受欢迎。' },
              { id: 11, russian: 'Она́ интересу́ется социа́льными пробле́мами.', chinese: '她关注社会问题。' },
              { id: 12, russian: 'Ка́ждый граждани́н име́ет права́ и обя́занности.', chinese: '每个公民都有权利和义务。' },
              { id: 13, russian: 'Мы должны́ помога́ть тем, кто в ну́жде.', chinese: '我们应该帮助有需要的人。' },
              { id: 14, russian: 'Образова́ние влия́ет на у́ровень жи́зни.', chinese: '教育影响生活水平。' },
              { id: 15, russian: 'Толера́нтность ва́жна в совреме́нном о́бществе.', chinese: '宽容在现代社会很重要。' },
              { id: 16, russian: 'Он критику́ет потре́бле́ние в о́бществе.', chinese: '他批评社会的消费主义。' },
              { id: 17, russian: 'Мы и́щем реше́ния для э́тих пробле́м.', chinese: '我们在为这些问题寻找解决方案。' },
              { id: 18, russian: 'Семьи́ ста́ли ме́ньше, чем ра́ньше.', chinese: '家庭比以前更小了。' },
              { id: 19, russian: 'У́ровень жи́зни повыша́ется.', chinese: '生活水平在提高。' },
              { id: 20, russian: 'Мы должны́ ду́мать о бу́дущем на́ших дете́й.', chinese: '我们应该考虑孩子们的未来。' }
            ]
          }
        ]
      },
      {
        id: 'b1_media',
        name: '俄语中级：媒体与信息',
        description: '讨论新闻、社交媒体与假新闻，表达媒体观点和批判性思考。',
        videos: [
          {
            id: 'b1_media_01',
            title: '媒体与信息：真相与噪音',
            description: '讨论新闻媒体、社交网络与信息真实性的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_media/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_media/1280/720',
            level: 'B1',
            duration: '7:05',
            words: 260,
            tags: ['媒体', '信息'],
            learners: 34,
            sentences: [
              { id: 1, russian: 'Сре́дства ма́ссовой информа́ции влия́ют на обще́ственное мне́ние.', chinese: '大众媒体影响舆论。' },
              { id: 2, russian: 'Мы получа́ем но́вости из интерне́та.', chinese: '我们从互联网获取新闻。' },
              { id: 3, russian: 'Э́та статья́ вызыва́ет мно́го спо́ров.', chinese: '这篇文章引起很多争议。' },
              { id: 4, russian: 'Он рабо́тает журнали́стом.', chinese: '他是记者。' },
              { id: 5, russian: 'Социа́льные се́ти даю́т мгнове́нную информа́цию.', chinese: '社交网络提供即时信息。' },
              { id: 6, russian: 'Мы должны́ прове́рять фа́кты.', chinese: '我们应该核实事实。' },
              { id: 7, russian: 'Репорта́ж был о́чень объе́ктивным.', chinese: '这篇报道非常客观。' },
              { id: 8, russian: 'Фе́йковые но́вости распространя́ются бы́стро.', chinese: '假新闻传播得很快。' },
              { id: 9, russian: 'Телеви́дение теря́ет популя́рность.', chinese: '电视正在失去人气。' },
              { id: 10, russian: 'Она́ ведёт свой блог о путеше́ствиях.', chinese: '她经营自己的旅行博客。' },
              { id: 11, russian: 'Мы обсуди́ли влия́ние рекла́мы.', chinese: '我们讨论了广告的影响。' },
              { id: 12, russian: 'Пре́сса защища́ет свобо́ду сло́ва.', chinese: '新闻界捍卫言论自由。' },
              { id: 13, russian: 'Интервью́ с изве́стным писа́телем вы́звало интере́с.', chinese: '对著名作家的采访引起了兴趣。' },
              { id: 14, russian: 'Ка́ждый день мы чита́ем мно́го но́востей.', chinese: '我们每天读很多新闻。' },
              { id: 15, russian: 'Он публику́ет статьи́ в журна́ле.', chinese: '他在杂志上发表文章。' },
              { id: 16, russian: 'Информа́ция до́лжна быть достове́рной.', chinese: '信息应该是可靠的。' },
              { id: 17, russian: 'Мы крити́чески относи́мся к рекла́ме.', chinese: '我们批判性地看待广告。' },
              { id: 18, russian: 'Ра́дио остаётся популя́рным среди води́телей.', chinese: '广播在司机中仍然流行。' },
              { id: 19, russian: 'Э́тот кана́л специализи́руется на нау́ке.', chinese: '这个频道专注于科学。' },
              { id: 20, russian: 'Но́вости влия́ют на на́ши эмо́ции.', chinese: '新闻影响我们的情绪。' }
            ]
          }
        ]
      },
      {
        id: 'b1_feelings',
        name: '俄语中级：情感与心理',
        description: '表达压力、情绪管理与心理状态，学会安慰与建议。',
        videos: [
          {
            id: 'b1_feelings_01',
            title: '情感与心理：内心世界',
            description: '谈论压力、情绪与心理健康的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b1_feelings/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b1_feelings/1280/720',
            level: 'B1',
            duration: '7:35',
            words: 260,
            tags: ['情感', '心理'],
            learners: 37,
            sentences: [
              { id: 1, russian: 'Я чу́вствую себя́ уве́ренно на э́той рабо́те.', chinese: '在这份工作中我感到自信。' },
              { id: 2, russian: 'Он испы́тывает стресс из-за экза́менов.', chinese: '他因考试而感到压力。' },
              { id: 3, russian: 'Мы должны́ уме́ть управля́ть свои́ми эмо́циями.', chinese: '我们应该学会管理情绪。' },
              { id: 4, russian: 'Она́ волну́ется пе́ред выступле́нием.', chinese: '她在演出前很紧张。' },
              { id: 5, russian: 'Подде́ржка друзе́й помога́ет мне.', chinese: '朋友的支持帮助我。' },
              { id: 6, russian: 'Я горжу́сь свои́ми достиже́ниями.', chinese: '我为自己的成就感到骄傲。' },
              { id: 7, russian: 'Он бои́тся публи́чных выступле́ний.', chinese: '他害怕公开演讲。' },
              { id: 8, russian: 'Мы де́лимся свои́ми пережива́ниями.', chinese: '我们分享彼此的感受。' },
              { id: 9, russian: 'Уста́лость влия́ет на настрое́ние.', chinese: '疲劳影响心情。' },
              { id: 10, russian: 'Она́ ра́дуется ка́ждому но́вому дню.', chinese: '她为每一天感到高兴。' },
              { id: 11, russian: 'Мне ну́жен о́тдых, что́бы восстанови́ть си́лы.', chinese: '我需要休息来恢复体力。' },
              { id: 12, russian: 'Он пережива́ет из-за пробле́м в семье́.', chinese: '他为家庭问题而烦恼。' },
              { id: 13, russian: 'Мы должны́ говори́ть о свои́х чу́вствах.', chinese: '我们应该谈论自己的感受。' },
              { id: 14, russian: 'Я благода́рен за по́мощь.', chinese: '我感谢帮助。' },
              { id: 15, russian: 'Позити́вное мышле́ние помога́ет в тру́дных ситуа́циях.', chinese: '积极思维在困难时刻有帮助。' },
              { id: 16, russian: 'Она́ разочарова́лась в э́том прое́кте.', chinese: '她对这个项目失望了。' },
              { id: 17, russian: 'Мы подде́рживаем друг дру́га в тру́дные вре́мена.', chinese: '我们在困难时期互相支持。' },
              { id: 18, russian: 'Он стара́ется не сдава́ться.', chinese: '他努力不放弃。' },
              { id: 19, russian: 'Чу́вство ю́мора помога́ет в обще́нии.', chinese: '幽默感有助于交流。' },
              { id: 20, russian: 'Я научи́лся справля́ться со стре́ссом.', chinese: '我学会了应对压力。' }
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
      },
      {
        id: 'b2_economy',
        name: '俄语高级：经济与就业',
        description: '讨论经济形势、市场趋势与就业问题，使用复杂句和抽象表达。',
        videos: [
          {
            id: 'b2_economy_01',
            title: '经济与就业：市场脉搏',
            description: '讨论经济变化、创业与就业市场的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_economy/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_economy/1280/720',
            level: 'B2',
            duration: '8:20',
            words: 280,
            tags: ['经济', '就业'],
            learners: 28,
            sentences: [
              { id: 1, russian: 'Экономи́ческая ситуа́ция в ми́ре меня́ется постоя́нно.', chinese: '世界经济形势不断变化。' },
              { id: 2, russian: 'Инфля́ция влия́ет на покупа́тельскую спосо́бность.', chinese: '通货膨胀影响购买力。' },
              { id: 3, russian: 'Мы обсужда́ем пробле́му безрабо́тицы среди молодёжи.', chinese: '我们在讨论年轻人失业问题。' },
              { id: 4, russian: 'Ма́лый би́знес игра́ет ва́жную роль в эконо́мике.', chinese: '小企业在经济中发挥重要作用。' },
              { id: 5, russian: 'Глобализа́ция меня́ет ры́нок труда́.', chinese: '全球化改变劳动力市场。' },
              { id: 6, russian: 'Инвести́ции в техноло́гии стимули́руют рост.', chinese: '科技投资刺激增长。' },
              { id: 7, russian: 'Мы должны́ ду́мать об усто́йчивом разви́тии эконо́мики.', chinese: '我们应该思考经济的可持续发展。' },
              { id: 8, russian: 'Экономи́ческий кри́зис затро́нул мно́гие стра́ны.', chinese: '经济危机影响了许多国家。' },
              { id: 9, russian: 'Ста́ртапы привлека́ют внима́ние инве́сторов.', chinese: '初创企业吸引投资者的关注。' },
              { id: 10, russian: 'Потре́бление растёт бы́стрыми те́мпами.', chinese: '消费快速增长。' },
              { id: 11, russian: 'Мы анализи́руем ры́ночные тенде́нции.', chinese: '我们分析市场趋势。' },
              { id: 12, russian: 'Финансовая гра́мотность необходима́ ка́ждому.', chinese: '金融素养对每个人都是必要的。' },
              { id: 13, russian: 'Она́ откры́ла со́бственное де́ло в про́шлом году́.', chinese: '她去年创办了自己的企业。' },
              { id: 14, russian: 'Госуда́рство регули́рует эконо́мику.', chinese: '国家调控经济。' },
              { id: 15, russian: 'Конкуре́нция стимули́рует иннова́ции.', chinese: '竞争激发创新。' },
              { id: 16, russian: 'Мы наблюда́ем рост цен на недви́жимость.', chinese: '我们观察到房价上涨。' },
              { id: 17, russian: 'Успе́х компа́нии зави́сит от страте́гии.', chinese: '公司成功取决于战略。' },
              { id: 18, russian: 'Э́ти ме́ры помогу́т стабилизи́ровать эконо́мику.', chinese: '这些措施将有助于稳定经济。' },
              { id: 19, russian: 'Междунаро́дная торго́вля расширя́ется.', chinese: '国际贸易在扩大。' },
              { id: 20, russian: 'Мы должны́ иска́ть но́вые исто́чники ро́ста.', chinese: '我们应该寻找新的增长来源。' }
            ]
          }
        ]
      },
      {
        id: 'b2_global',
        name: '俄语高级：全球化',
        description: '讨论全球化影响、文化交流与移民问题，表达复杂观点。',
        videos: [
          {
            id: 'b2_global_01',
            title: '全球化：相连的世界',
            description: '讨论全球化利弊、文化认同与国际合作的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_global/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_global/1280/720',
            level: 'B2',
            duration: '8:10',
            words: 280,
            tags: ['全球化', '文化'],
            learners: 26,
            sentences: [
              { id: 1, russian: 'Глобализа́ция име́ет как положи́тельные, так и отрица́тельные сто́роны.', chinese: '全球化既有积极也有消极的一面。' },
              { id: 2, russian: 'Культу́рный обме́н обогаща́ет на́шу жизнь.', chinese: '文化交流丰富我们的生活。' },
              { id: 3, russian: 'Мигра́ция населе́ния меня́ет демографи́ческую ситуа́цию.', chinese: '人口迁移改变人口结构。' },
              { id: 4, russian: 'Мы живём в взаимосвя́занном ми́ре.', chinese: '我们生活在一个相互联系的世界。' },
              { id: 5, russian: 'Междунаро́дное сотру́дничество необходи́мо для реше́ния глоба́льных пробле́м.', chinese: '国际合作对于解决全球问题至关重要。' },
              { id: 6, russian: 'Глоба́льные корпора́ции влия́ют на лока́льные ры́нки.', chinese: '跨国公司影响本地市场。' },
              { id: 7, russian: 'Тури́зм спосо́бствует культурному обме́ну.', chinese: '旅游业促进文化交流。' },
              { id: 8, russian: 'Мы должны́ сохраня́ть культу́рную иденти́чность в эпо́ху глобализа́ции.', chinese: '在全球化时代我们应该保持文化认同。' },
              { id: 9, russian: 'Междунаро́дные организа́ции реша́ют глоба́льные пробле́мы.', chinese: '国际组织解决全球问题。' },
              { id: 10, russian: 'Эмигра́ция молодёжи — серьёзная пробле́ма для мно́гих стран.', chinese: '青年移民是许多国家的严重问题。' },
              { id: 11, russian: 'Глоба́льная эконо́мика взаимозави́сима.', chinese: '全球经济相互依存。' },
              { id: 12, russian: 'Мы обсужда́ем влия́ние глобализа́ции на тради́ции.', chinese: '我们讨论全球化对传统的影响。' },
              { id: 13, russian: 'Мультикультурали́зм — реа́льность совреме́нного о́бщества.', chinese: '多元文化主义是现代社会的现实。' },
              { id: 14, russian: 'Междунаро́дное образова́ние стано́вится всё популя́рнее.', chinese: '国际教育越来越受欢迎。' },
              { id: 15, russian: 'Глобализа́ция создаёт как возмо́жности, так и ри́ски.', chinese: '全球化既创造机会也带来风险。' },
              { id: 16, russian: 'Мы должны́ защища́ть права́ мигра́нтов.', chinese: '我们应该保护移民的权利。' },
              { id: 17, russian: 'Культу́рное разнообра́зие — бога́тство челове́чества.', chinese: '文化多样性是人类财富。' },
              { id: 18, russian: 'Цифрова́я глобализа́ция измени́ла коммуника́цию.', chinese: '数字全球化改变了交流方式。' },
              { id: 19, russian: 'Ка́ждая страна́ и́щет свой путь в глоба́льном ми́ре.', chinese: '每个国家都在全球世界中寻找自己的道路。' },
              { id: 20, russian: 'Глоба́льное сотру́дничество в нау́ке прино́сит по́льзу всем.', chinese: '全球科学合作惠及所有人。' }
            ]
          }
        ]
      },
      {
        id: 'b2_ethics',
        name: '俄语高级：科技伦理',
        description: '讨论人工智能、隐私与技术的伦理问题，运用抽象思辨表达。',
        videos: [
          {
            id: 'b2_ethics_01',
            title: '科技伦理：进步与边界',
            description: '讨论人工智能、隐私与责任的技术伦理对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_ethics/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_ethics/1280/720',
            level: 'B2',
            duration: '8:30',
            words: 280,
            tags: ['科技', '伦理'],
            learners: 27,
            sentences: [
              { id: 1, russian: 'Иску́сственный интелле́кт ста́вит но́вые эти́ческие вопро́сы.', chinese: '人工智能提出新的伦理问题。' },
              { id: 2, russian: 'Мы должны́ регули́ровать испо́льзование персона́льных да́нных.', chinese: '我们应该规范个人数据的使用。' },
              { id: 3, russian: 'Техноло́гии меня́ют на́шу жизнь с невероя́тной ско́ростью.', chinese: '技术以难以置信的速度改变我们的生活。' },
              { id: 4, russian: 'Ча́стная жизнь стано́вится всё ме́нее защищённой.', chinese: '隐私变得越来越不受保护。' },
              { id: 5, russian: 'Автоматиза́ция мо́жет приве́сти к поте́ре рабо́чих мест.', chinese: '自动化可能导致失业。' },
              { id: 6, russian: 'Мы обсу́дим эти́ческие аспе́кты биотехноло́гий.', chinese: '我们将讨论生物技术的伦理问题。' },
              { id: 7, russian: 'Алгори́тмы влия́ют на на́ши реше́ния.', chinese: '算法影响我们的决策。' },
              { id: 8, russian: 'Цифрово́й разры́в увели́чивает нера́венство.', chinese: '数字鸿沟加剧不平等。' },
              { id: 9, russian: 'Мы должны́ ду́мать об отве́тственном испо́льзовании техноло́гий.', chinese: '我们应该思考负责任地使用技术。' },
              { id: 10, russian: 'Иску́сственный интелле́кт не до́лжен заменя́ть челове́ческие реше́ния.', chinese: '人工智能不应取代人类决策。' },
              { id: 11, russian: 'Кибербезопа́сность — актуа́льная пробле́ма.', chinese: '网络安全是一个现实问题。' },
              { id: 12, russian: 'Мы критику́ем неконтроли́руемое разви́тие техноло́гий.', chinese: '我们批评技术的不受控发展。' },
              { id: 13, russian: 'Эти́ческие нормы должны́ сопровожда́ть техноло́гический прогре́сс.', chinese: '道德规范应伴随技术进步。' },
              { id: 14, russian: 'Учёные несу́т отве́тственность за свои́ откры́тия.', chinese: '科学家对自己的发现负责。' },
              { id: 15, russian: 'Мы должны́ защища́ть права́ челове́ка в цифрову́ю эпо́ху.', chinese: '我们应该在数字时代保护人权。' },
              { id: 16, russian: 'Трансгумани́зм вызыва́ет спо́ры.', chinese: '超人类主义引发争议。' },
              { id: 17, russian: 'Ба́зы да́нных хра́нят о́громное коли́чество информа́ции о нас.', chinese: '数据库存储大量关于我们的信息。' },
              { id: 18, russian: 'Мы должны́ обеспе́чить прозра́чность алгоритмов.', chinese: '我们应该确保算法的透明性。' },
              { id: 19, russian: 'Гене́тика открыва́ет но́вые возмо́жности и ри́ски.', chinese: '遗传学打开新的可能性与风险。' },
              { id: 20, russian: 'Отве́тственное отноше́ние к техноло́гиям — вы́зов на́шего вре́мени.', chinese: '负责任地对待技术是我们时代的挑战。' }
            ]
          }
        ]
      },
      {
        id: 'b2_psychology',
        name: '俄语高级：心理与社会',
        description: '讨论心理健康、情绪与社会压力，运用心理学术语表达观点。',
        videos: [
          {
            id: 'b2_psychology_01',
            title: '心理与社会：内心与外界',
            description: '讨论心理健康、压力与自我认知的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_psychology/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_psychology/1280/720',
            level: 'B2',
            duration: '8:15',
            words: 280,
            tags: ['心理', '社会'],
            learners: 26,
            sentences: [
              { id: 1, russian: 'Психологи́ческое здоро́вье так же ва́жно, как и физи́ческое.', chinese: '心理健康和身体健康同样重要。' },
              { id: 2, russian: 'Мы должны́ преодолева́ть стереоти́пы о психоло́гии.', chinese: '我们应该克服对心理学的刻板印象。' },
              { id: 3, russian: 'Эмоциона́льный интелле́кт помога́ет в обще́нии.', chinese: '情商有助于交流。' },
              { id: 4, russian: 'Стресс стано́вится ча́стью совреме́нной жи́зни.', chinese: '压力成为现代生活的一部分。' },
              { id: 5, russian: 'Мы анализи́руем влия́ние социа́льных сете́й на психи́ку.', chinese: '我们分析社交网络对心理的影响。' },
              { id: 6, russian: 'Самооце́нка влия́ет на на́шу жизнь.', chinese: '自尊影响我们的生活。' },
              { id: 7, russian: 'Психоло́г помога́ет поня́ть себя́.', chinese: '心理学家帮助了解自己。' },
              { id: 8, russian: 'Мы должны́ учи́ться слу́шать друг дру́га.', chinese: '我们应该学会倾听彼此。' },
              { id: 9, russian: 'Депре́ссия — серьёзная пробле́ма совреме́нного о́бщества.', chinese: '抑郁症是现代社会的严重问题。' },
              { id: 10, russian: 'Медита́ция помога́ет сни́зить у́ровень трево́ги.', chinese: '冥想有助于降低焦虑水平。' },
              { id: 11, russian: 'Позити́вная психоло́гия изуча́ет сча́стье.', chinese: '积极心理学研究幸福。' },
              { id: 12, russian: 'Мы обсуди́ли влия́ние де́тства на ли́чность.', chinese: '我们讨论了童年对人格的影响。' },
              { id: 13, russian: 'Эмпа́тия ва́жна в межлично́стных отноше́ниях.', chinese: '同理心在人际关系中很重要。' },
              { id: 14, russian: 'Он прохо́дит психотерапи́ю.', chinese: '他正在接受心理治疗。' },
              { id: 15, russian: 'О́бщество до́лжно поддер́живать люде́й с психи́ческими расстро́йствами.', chinese: '社会应该支持有心理障碍的人。' },
              { id: 16, russian: 'Мы должны́ уме́ть вы́ражать свои́ эмо́ции.', chinese: '我们应该学会表达情绪。' },
              { id: 17, russian: 'Саморазви́тие стано́вится трендом.', chinese: '自我提升成为趋势。' },
              { id: 18, russian: 'Вну́тренний конфли́кт меша́ет разви́тию.', chinese: '内心冲突阻碍发展。' },
              { id: 19, russian: 'Уве́ренность в себе́ прихо́дит с о́пытом.', chinese: '自信来自经验。' },
              { id: 20, russian: 'Психологи́ческая подде́ржка необходима́ в кри́зисных ситуа́циях.', chinese: '在危机情况下心理支持是必要的。' }
            ]
          }
        ]
      },
      {
        id: 'b2_art',
        name: '俄语高级：艺术与哲学',
        description: '讨论艺术价值、哲学思辨与审美，表达抽象观点。',
        videos: [
          {
            id: 'b2_art_01',
            title: '艺术与哲学：思辨之美',
            description: '讨论美、艺术价值与哲学问题的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_art/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_art/1280/720',
            level: 'B2',
            duration: '8:25',
            words: 280,
            tags: ['艺术', '哲学'],
            learners: 24,
            sentences: [
              { id: 1, russian: 'Иску́сство отража́ет дух вре́мени.', chinese: '艺术反映时代精神。' },
              { id: 2, russian: 'Филосо́фия задаёт фундамента́льные вопро́сы.', chinese: '哲学提出根本问题。' },
              { id: 3, russian: 'Мы обсужда́ем смысл красоты́.', chinese: '我们在讨论美的意义。' },
              { id: 4, russian: 'Худо́жественное выраже́ние свобо́дно.', chinese: '艺术表达是自由的。' },
              { id: 5, russian: 'Экзистенциали́зм изуча́ет смысл жи́зни.', chinese: '存在主义研究生命的意义。' },
              { id: 6, russian: 'Совреме́нное иску́сство провоци́рует размышле́ния.', chinese: '当代艺术引发思考。' },
              { id: 7, russian: 'Культу́рная кри́тика помога́ет поня́ть о́бщество.', chinese: '文化批评帮助理解社会。' },
              { id: 8, russian: 'Мы сравнива́ем филосо́фию Восто́ка и За́пада.', chinese: '我们比较东西方哲学。' },
              { id: 9, russian: 'Иску́сство име́ет самосто́ятельную це́нность.', chinese: '艺术有独立的价值。' },
              { id: 10, russian: 'Худо́жник и́щет но́вые фо́рмы выраже́ния.', chinese: '艺术家寻找新的表达形式。' },
              { id: 11, russian: 'Мы обсужда́ем свобо́ду тво́рчества.', chinese: '我们讨论创作自由。' },
              { id: 12, russian: 'Эсте́тика изуча́ет приро́ду прекра́сного.', chinese: '美学研究美的本质。' },
              { id: 13, russian: 'Литерату́ра отража́ет сложность челове́ческой души́.', chinese: '文学反映人类灵魂的复杂性。' },
              { id: 14, russian: 'Филосо́фия нау́ки иссле́дует основа́ния зна́ния.', chinese: '科学哲学研究知识的基础。' },
              { id: 15, russian: 'Мы должны́ сохраня́ть культу́рное насле́дие.', chinese: '我们应该保护文化遗产。' },
              { id: 16, russian: 'Иску́сство мо́жет меня́ть обще́ственное созна́ние.', chinese: '艺术可以改变社会意识。' },
              { id: 17, russian: 'Она́ посвяти́ла жизнь изуче́нию филосо́фии.', chinese: '她一生致力于研究哲学。' },
              { id: 18, russian: 'Концептуа́льное иску́сство вызыва́ет дискуссию.', chinese: '观念艺术引发讨论。' },
              { id: 19, russian: 'Мы размышля́ем о це́нности тради́ций.', chinese: '我们思考传统的价值。' },
              { id: 20, russian: 'Тво́рчество — спо́соб самопозна́ния.', chinese: '创作是自我认知的方式。' }
            ]
          }
        ]
      },
      {
        id: 'b2_law',
        name: '俄语高级：法律与权利',
        description: '讨论法治、人权与司法制度，运用法律词汇表达观点。',
        videos: [
          {
            id: 'b2_law_01',
            title: '法律与权利：正义天平',
            description: '讨论法治、人权与司法改革的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_law/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_law/1280/720',
            level: 'B2',
            duration: '8:05',
            words: 280,
            tags: ['法律', '权利'],
            learners: 25,
            sentences: [
              { id: 1, russian: 'Верхове́нство зако́на — осно́ва правово́го госуда́рства.', chinese: '法治是法治国家的基础。' },
              { id: 2, russian: 'Мы должны́ защища́ть права́ челове́ка.', chinese: '我们应该保护人权。' },
              { id: 3, russian: 'Суде́бная систе́ма должна́ быть незави́симой.', chinese: '司法体系应该是独立的。' },
              { id: 4, russian: 'Ка́ждый име́ет пра́во на справедли́вый суд.', chinese: '每个人都有权获得公正审判。' },
              { id: 5, russian: 'Юри́ст проконсульти́ровал нас по э́тому вопро́су.', chinese: '律师就这个问题给了我们咨询。' },
              { id: 6, russian: 'Законода́тельство меня́ется вме́сте с о́бществом.', chinese: '立法随着社会而变化。' },
              { id: 7, russian: 'Мы обсужда́ем рефо́рму суде́бной систе́мы.', chinese: '我们讨论司法体系改革。' },
              { id: 8, russian: 'Гражда́не должны́ знать свои́ права́.', chinese: '公民应该了解自己的权利。' },
              { id: 9, russian: 'Наруше́ние зако́на влечёт отве́тственность.', chinese: '违法要承担责任。' },
              { id: 10, russian: 'Адвока́т защища́ет интере́сы клие́нта.', chinese: '律师维护当事人的利益。' },
              { id: 11, russian: 'Мы должны́ уважа́ть зако́н и поря́док.', chinese: '我们应该尊重法律和秩序。' },
              { id: 12, russian: 'Конститу́ция гаранти́рует основны́е права́.', chinese: '宪法保障基本权利。' },
              { id: 13, russian: 'Э́тот законопрое́кт вызыва́ет спо́ры.', chinese: '这项法案引起争议。' },
              { id: 14, russian: 'Пра́во на образова́ние — фундамента́льное пра́во.', chinese: '受教育权是一项基本权利。' },
              { id: 15, russian: 'Междунаро́дное пра́во регули́рует отноше́ния госуда́рств.', chinese: '国际法规范国家间关系。' },
              { id: 16, russian: 'Мы тре́буем справедли́вого реше́ния.', chinese: '我们要求公正的解决方案。' },
              { id: 17, russian: 'Свобо́да сло́ва ограни́чена зако́ном.', chinese: '言论自由受法律限制。' },
              { id: 18, russian: 'Суде́бный проце́сс был дли́тельным.', chinese: '诉讼过程很漫长。' },
              { id: 19, russian: 'Пра́во на ча́стную жизнь защищено́ зако́ном.', chinese: '隐私权受法律保护。' },
              { id: 20, russian: 'Мы должны́ боро́ться с корру́пцией.', chinese: '我们应该打击腐败。' }
            ]
          }
        ]
      },
      {
        id: 'b2_urban',
        name: '俄语高级：城市发展',
        description: '讨论城市化、住房与城市未来，运用社会议题表达。',
        videos: [
          {
            id: 'b2_urban_01',
            title: '城市发展：未来之城',
            description: '讨论城市化、住房与可持续城市发展的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_urban/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_urban/1280/720',
            level: 'B2',
            duration: '8:00',
            words: 280,
            tags: ['城市', '发展'],
            learners: 27,
            sentences: [
              { id: 1, russian: 'Урбаниза́ция меня́ет о́блик совреме́нных горо́дов.', chinese: '城市化改变现代城市的面貌。' },
              { id: 2, russian: 'Мы обсужда́ем пробле́мы жилья́ в кру́пных горо́дах.', chinese: '我们讨论大城市住房问题。' },
              { id: 3, russian: 'Усто́йчивое городско́е разви́тие — на́ша цель.', chinese: '可持续城市发展是我们的目标。' },
              { id: 4, russian: 'Тра́нспортная систе́ма нужда́ется в модерниза́ции.', chinese: '交通系统需要现代化。' },
              { id: 5, russian: 'Экологи́чески чи́стые райо́ны стано́вятся популя́рными.', chinese: '环保区域越来越受欢迎。' },
              { id: 6, russian: 'Мы должны́ реша́ть пробле́му про́бок.', chinese: '我们应该解决堵车问题。' },
              { id: 7, russian: 'Горо́дская инфраструкту́ра развива́ется бы́стро.', chinese: '城市基础设施发展迅速。' },
              { id: 8, russian: 'Обще́ственные простра́нства ва́жны для го́рожан.', chinese: '公共空间对市民很重要。' },
              { id: 9, russian: 'Мы анализи́руем влия́ние урбаниза́ции на о́браз жи́зни.', chinese: '我们分析城市化对生活方式的影响。' },
              { id: 10, russian: 'Но́вые райо́ны стро́ятся с учётом экологии.', chinese: '新区建设考虑环保。' },
              { id: 11, russian: 'Мигра́ция в горо́да продолжа́ется.', chinese: '向城市迁移仍在继续。' },
              { id: 12, russian: 'Горо́дские вла́сти реша́ют пробле́мы безопа́сности.', chinese: '市政部门解决安全问题。' },
              { id: 13, russian: 'Мы должны́ создава́ть комфо́ртную горо́дскую сре́ду.', chinese: '我们应该创造舒适的城市环境。' },
              { id: 14, russian: 'Культу́рные це́нтры оживля́ют го́род.', chinese: '文化中心让城市充满活力。' },
              { id: 15, russian: 'У́мные горо́да испо́льзуют совреме́нные техноло́гии.', chinese: '智慧城市使用现代技术。' },
              { id: 16, russian: 'Ка́чество жи́зни в го́роде зави́сит от мно́гих фа́кторов.', chinese: '城市生活质量取决于许多因素。' },
              { id: 17, russian: 'Мы предлага́ем но́вые реше́ния для тра́нспорта.', chinese: '我们为交通提出新的解决方案。' },
              { id: 18, russian: 'Зелёные зо́ны улу́чшают эколо́гию го́рода.', chinese: '绿地改善城市生态。' },
              { id: 19, russian: 'Пробле́ма аре́нды жилья́ волну́ет молодёжь.', chinese: '住房租金问题困扰着年轻人。' },
              { id: 20, russian: 'Го́род бу́дущего — э́то бала́нс приро́ды и техноло́гий.', chinese: '未来城市是自然与技术的平衡。' }
            ]
          }
        ]
      },
      {
        id: 'b2_future',
        name: '俄语高级：未来趋势',
        description: '讨论未来社会、科技趋势与全球挑战，表达预测与思辨。',
        videos: [
          {
            id: 'b2_future_01',
            title: '未来趋势：明天之后',
            description: '讨论未来世界、科技趋势与全球挑战的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_future/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_future/1280/720',
            level: 'B2',
            duration: '8:35',
            words: 280,
            tags: ['未来', '趋势'],
            learners: 26,
            sentences: [
              { id: 1, russian: 'Тру́дно предсказа́ть, как измени́тся мир че́рез пятьдеся́т лет.', chinese: '很难预测五十年后世界会如何变化。' },
              { id: 2, russian: 'Мы обсуди́ли сцена́рии бу́дущего.', chinese: '我们讨论了未来的情景。' },
              { id: 3, russian: 'Техноло́гии бу́дут продолжа́ть трансформи́ровать о́бщество.', chinese: '技术将继续改变社会。' },
              { id: 4, russian: 'Возраст населе́ния растёт во мно́гих стра́нах.', chinese: '许多国家人口老龄化加剧。' },
              { id: 5, russian: 'Мы должны́ гото́виться к вы́зовам бу́дущего.', chinese: '我们应该为未来的挑战做准备。' },
              { id: 6, russian: 'Иску́сственный интелле́кт измени́т мно́гие профе́ссии.', chinese: '人工智能将改变许多职业。' },
              { id: 7, russian: 'Энергети́ческий перехо́д — гла́вная зада́ча ве́ка.', chinese: '能源转型是本世纪的主要任务。' },
              { id: 8, russian: 'Бу́дущее образова́ния бу́дет цифровы́м.', chinese: '教育的未来将是数字化的。' },
              { id: 9, russian: 'Мы мечта́ем о ми́ре без конфли́ктов.', chinese: '我们梦想一个没有冲突的世界。' },
              { id: 10, russian: 'Нау́чные откры́тия меня́ют на́ше понима́ние реа́льности.', chinese: '科学发现改变我们对现实的理解。' },
              { id: 11, russian: 'Глоба́льные ри́ски тре́буют глоба́льных реше́ний.', chinese: '全球风险需要全球解决方案。' },
              { id: 12, russian: 'Мы должны́ предви́деть после́дствия на́ших де́йствий.', chinese: '我们应该预见自己行为的后果。' },
              { id: 13, russian: 'Усто́йчивое бу́дущее тре́бует коллекти́вных уси́лий.', chinese: '可持续的未来需要集体努力。' },
              { id: 14, russian: 'Каки́е профе́ссии бу́дут актуа́льны че́рез де́сять лет?', chinese: '十年后哪些职业会受欢迎？' },
              { id: 15, russian: 'Мы ве́рим в си́лу челове́ческого ра́зума.', chinese: '我们相信人类智慧的力量。' },
              { id: 16, russian: 'Цифровиза́ция меня́ет все сфе́ры жи́зни.', chinese: '数字化改变生活的各个领域。' },
              { id: 17, russian: 'Бу́дущее непредсказу́емо, но мы мо́жем его́ стро́ить.', chinese: '未来不可预测，但我们可以建设它。' },
              { id: 18, russian: 'На́ши де́ти бу́дут жить в друго́м ми́ре.', chinese: '我们的孩子将生活在不同的世界。' },
              { id: 19, russian: 'Мы должны́ инвести́ровать в нау́ку и образова́ние.', chinese: '我们应该投资科学与教育。' },
              { id: 20, russian: 'Оптими́зм и отве́тственность — ключ к бу́дущему.', chinese: '乐观与责任是未来的关键。' }
            ]
          }
        ]
      },
      {
        id: 'b2_academia',
        name: '俄语高级：高等教育与学术',
        description: '讨论学术研究、方法论与学术伦理，运用学术词汇表达。',
        videos: [
          {
            id: 'b2_academia_01',
            title: '高等教育与学术：求知之路',
            description: '讨论研究、论文与学术规范的对话。',
            thumbnail: 'https://picsum.photos/seed/ru_b2_academia/400/280',
            posterUrl: 'https://picsum.photos/seed/ru_b2_academia/1280/720',
            level: 'B2',
            duration: '8:45',
            words: 280,
            tags: ['学术', '教育'],
            learners: 24,
            sentences: [
              { id: 1, russian: 'Академи́ческие иссле́дования тре́буют стро́гой мето́дологии.', chinese: '学术研究需要严谨的方法论。' },
              { id: 2, russian: 'Мы анализи́руем нау́чные публика́ции.', chinese: '我们分析科学出版物。' },
              { id: 3, russian: 'Крити́ческое мышле́ние — осно́ва акаде́мической рабо́ты.', chinese: '批判性思维是学术工作的基础。' },
              { id: 4, russian: 'Она́ защити́ла кандида́тскую диссерта́цию.', chinese: '她通过了副博士论文答辩。' },
              { id: 5, russian: 'Университе́т поощря́ет междисциплина́рные иссле́дования.', chinese: '大学鼓励跨学科研究。' },
              { id: 6, russian: 'Мы прово́дим экспериме́нт и анализи́руем да́нные.', chinese: '我们进行实验并分析数据。' },
              { id: 7, russian: 'Нау́чная репута́ция стро́ится года́ми.', chinese: '学术声誉需要多年建立。' },
              { id: 8, russian: 'Конфере́нция собрала́ учёных со всего́ ми́ра.', chinese: '会议汇集了世界各地的学者。' },
              { id: 9, russian: 'Мы критику́ем сла́бые а́ргументы в статье́.', chinese: '我们批评文章中的薄弱论点。' },
              { id: 10, russian: 'Гипо́теза тре́бует прове́рки.', chinese: '假设需要验证。' },
              { id: 11, russian: 'Академи́ческая свобо́да ва́жна для нау́ки.', chinese: '学术自由对科学很重要。' },
              { id: 12, russian: 'Мы сравнили́ результа́ты на́ших иссле́дований.', chinese: '我们比较了我们的研究结果。' },
              { id: 13, russian: 'Публика́ция в веду́щем журна́ле — успе́х для учёного.', chinese: '在顶级期刊发表论文是学者的成功。' },
              { id: 14, russian: 'Мы должны́ избега́ть плагиа́та.', chinese: '我们应该避免抄袭。' },
              { id: 15, russian: 'Нау́чная диску́ссия помога́ет разви́тию зна́ния.', chinese: '科学讨论有助于知识发展。' },
              { id: 16, russian: 'Он посвяти́л себя́ фундамента́льной нау́ке.', chinese: '他献身于基础科学。' },
              { id: 17, russian: 'Мы анализи́руем си́льные и сла́бые сто́роны тео́рии.', chinese: '我们分析理论的优缺点。' },
              { id: 18, russian: 'Рецензи́рование — ва́жная часть нау́чного проце́сса.', chinese: '同行评审是科学过程的重要部分。' },
              { id: 19, russian: 'Мы стреми́мся к объекти́вности в иссле́дованиях.', chinese: '我们追求研究的客观性。' },
              { id: 20, russian: 'Академи́ческая среда́ тре́бует че́стности.', chinese: '学术环境需要诚实。' }
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
