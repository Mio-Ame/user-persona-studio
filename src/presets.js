// Pure ESM module: zero runtime/host/storage dependencies.

export const CORE_SECTION_HEADER = '【基础人设】';
export const SHELL_SECTION_HEADER = '【当前背景与关系】';
export const WORLDBOOK_DIVIDER = '【补充世界书条目】';
export const DRAFT_START_MARKER = '【草稿自检】';
export const DRAFT_END_MARKER = '【/草稿自检】';

export const VISIBILITY_MARKERS = Object.freeze([
  '[外表可见]',
  '[开场已知]',
  '[私密未公开]',
]);

export const VIBE_ANCHOR_EXAMPLES = Object.freeze([
  '沉稳可靠',
  '外冷内热',
  '松弛感',
  '痞帅散漫',
  '清冷克制',
  '嘴硬心软',
  '温和腹黑',
  '理智果断',
  '慢热寡言',
  '冷面护短',
  '阳光直球',
  '风趣犀利',
  '少年意气',
  '矜贵疏离',
  '反差感',
  '钝感力',
  '冷脸萌',
  '钓系',
  '傲娇',
  '直白率性',
]);

export const DEFAULT_MUST_HAVE_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'tpl_work_off',
    label: '私下不聊工作',
    content: '职业习惯仅在工作场合体现，私下休闲相处时不主动提本行话题',
  }),
  Object.freeze({
    id: 'tpl_secret_calm',
    label: '隐藏身份不露馅',
    content: '未公开的过往或特殊身份在日常中有合理表象，平时待人坦然无异样',
  }),
  Object.freeze({
    id: 'tpl_calm_action',
    label: '少说空话重行动',
    content: '平时不爱说场面话，遇到事情习惯直接动手解决或提前安排妥当',
  }),
  Object.freeze({
    id: 'tpl_clean_taste',
    label: '口味喜好简笔带过',
    content: '饮食与起居偏好仅一笔带过，不列长串清单',
  }),
]);

export const SPOTLIGHT_MODES = Object.freeze([
  {
    id: 'balanced',
    label: '自然融入（推荐）',
    description: '职业、特色属性与生活小喜好自然收放不刷屏打卡；暗线伏笔日常表象自洽，不被无端强行看穿。',
  },
  {
    id: 'featured',
    label: '突出设定暗线',
    description: '适合专门想玩职场日常、特殊体质拉扯或身份试探的局，提高职业习惯、特殊设定与伏笔线索的比重。',
  },
  {
    id: 'light_daily',
    label: '轻松纯日常',
    description: '适合轻松纯粹的日常或感情故事，不额外铺设复杂身世或沉重暗线，专注当下相处。',
  },
]);

export const BACKSTORY_MODES = Object.freeze([
  {
    id: 'light_vibe',
    label: '轻底色（推荐）',
    description: '写了经历就顺着展开；没提过往时只用宽泛生活氛围托底，不擅自编造具体父母亲属或童年创伤，防代入出戏。',
  },
  {
    id: 'blank_self',
    label: '纯留白（代入）',
    description: '严禁编造任何未提及的家庭出身、童年或过往事件，全靠当下的外貌气质、处事分寸与开场处境立住人物。',
  },
  {
    id: 'rich_arc',
    label: '补全经历（OC）',
    description: '结合人物性格与世界观，自然补全合理的成长环境、习惯成因与过往片段，让人物来处清晰、骨血丰满。',
  },
]);

export const ANTI_PARROT_CLAUSE =
  '（注：档案中的具体生活片段与“例如/比如”示例仅用于辅助理解人物的思维回路与性格倾向，并非固定必演桥段；日常互动随当下情境自然反应，不复刻原例中的对话与情节。）';

export const WORD_COUNT_PRESETS = Object.freeze([
  { id: '600', chars: 600, label: '约 600 字' },
  { id: '1000', chars: 1000, label: '约 1000 字' },
  { id: '1500', chars: 1500, label: '约 1500 字' },
  { id: '2000', chars: 2000, label: '约 2000 字' },
  { id: 'custom', chars: 0, label: '自定义字数' },
]);

export const LIKE_REASON_PRESETS = Object.freeze([
  { id: 'like_detail', label: '喜欢这句细节', reason: '偏爱这类自然具体的细节描写' },
  { id: 'like_life', label: '喜欢这种生活感', reason: '偏爱这种日常烟火气与真实感' },
  { id: 'like_pace', label: '喜欢这种分寸感', reason: '偏爱这种克制不端着的相处分寸' },
]);

export const DISLIKE_REASON_PRESETS = Object.freeze([
  { id: 'dislike_general', label: '不喜欢', reason: '个人不喜欢这类表达方式' },
  { id: 'too_ai', label: '表述太 AI', reason: '表述太像 AI 套话，缺乏真人自然感' },
  { id: 'too_oily', label: '太油腻 / 端着', reason: '腔调油腻做作，不够平实自然' },
  { id: 'too_label', label: '贴标签 / 太笼统', reason: '直接贴性格标签或空泛概括，缺少具体成因与表现' },
  { id: 'overstep_user', label: '替我抢话 / 写心理', reason: '越界预设了玩家的台词、心理活动或固定动作' },
  { id: 'easy_checkin', label: '易导致剧情反复打卡', reason: '写成了过于琐碎固定的小剧本或口头禅，容易导致正文每轮机械重复' },
  { id: 'out_of_vibe', label: '不贴合人设', reason: '与当前想塑造的人物气质不符' },
]);

export const BUILTIN_USAGE_GUIDE = [
  '【User 人设工坊 — 酒馆原生预设使用说明】',
  '1. 本预设用于生成或改写 SillyTavern 的 {{user}} 人设档案，不含任何接口地址或密钥。',
  '2. 新建人设：在聊天框直接发送一两句灵感或想要的设定（需要结合当前角色卡时保持角色描述条目开启），即可生成干净自然的人设；日常恋爱、暗线伏笔或长篇世界观均可自然适配。',
  '3. 改写旧人设：粘贴旧人设文本并附一句要求（如“整理排版并去掉套话”“保留原设定扩写细节”或“保留外貌性格、只改当前卡里的身份关系”）。',
  '4. 若开启了草稿自检，可导入配套正则脚本在聊天界面自动隐藏【草稿自检】块；把最终人设正文复制保存到酒馆「用户人设（Persona）」面板即可使用。本说明条目默认关闭，不占用上下文。',
].join('\n');

// 100% original, Persona-Profile-Specific anti-cliché packs (strictly for persona sheets, zero prose-narration filler)
export const BUILTIN_BANNED_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'persona_marysue',
    name: '人设悬浮自夸与赋魅腔',
    description: '空洞吹捧气场或美貌的套话，写进人设极易导致正文中所有角色无脑倒贴赞美',
    scope: 'all',
    rules: Object.freeze([
      '不写“人群中一眼认出”“生人勿近的气场”等主观吹捧，改为客观五官穿搭与平时待人的真实态度',
    ]),
    phrases: Object.freeze([
      '在人群中总能一眼被认出',
      '拥有令人过目难忘的独特气质',
      '周身散发着生人勿近的气场',
      '宛如一朵带刺的玫瑰',
      '不食人间烟火',
      '迷人的危险',
      '勾人而不自知',
      '自带高贵疏离感',
      '骨子里透着矜贵',
      '天生自带焦点感',
      '让人忍不住想要靠近又不敢亵渎',
      '举手投足皆是风情',
    ]),
  }),
  Object.freeze({
    id: 'persona_resume_ai',
    name: 'AI 简历式空洞对立与伪哲理',
    description: '像星座解析或求职简历一样的假大空对仗句，占字数却不提供有效性格信息',
    scope: 'all',
    rules: Object.freeze([
      '不用“看似A实则B”“并非…而是…”“既理性又感性”做笼统总结，直接写遇到具体事情时的选择与分寸',
      '不滥用“某种难以言喻的”“恰到好处地”等模糊修饰词充数',
    ]),
    phrases: Object.freeze([
      '看似冷漠实则内心炽热',
      '表面云淡风轻实则暗潮汹涌',
      '既理性克制又偶尔流露感性脆弱',
      '某种难以言喻的',
      '一种近乎偏执的',
      '恰到好处地',
      '凡事讲究绝对的掌控感',
      '天生对虚情假意有着敏锐直觉',
      '习惯用微笑掩饰所有的疲惫',
      '骨子里透着一股倔强',
      '灵魂深处的共鸣',
      '带着一丝不易察觉的',
      '对在意的人有着偏执的占有欲',
    ]),
  }),
  Object.freeze({
    id: 'persona_tic_lock',
    name: '易引发每轮打卡的固定微动作套话',
    description: '写死在人设里的单一五官抽动或随身道具打卡，会导致强遵循模型每轮对话机械复读',
    scope: 'all',
    rules: Object.freeze([
      '不规定“每次紧张必摸某物/每次说话必推眼镜”式打卡小动作，改写为通用的情绪反应倾向',
    ]),
    phrases: Object.freeze([
      '嘴角勾起一抹意味深长的弧度',
      '眼底闪过一丝不易察觉的暗芒',
      '瞳孔骤然紧缩',
      '指节因用力而微微泛白',
      '嘴抿成一条直线',
      '习惯性推一下眼镜掩饰情绪',
      '紧张时总会摩挲衣角',
      '说话前总是先垂下眼帘',
      '永远随身带着同一件小物件',
      '眉眼间自带疏离感',
    ]),
  }),
  Object.freeze({
    id: 'persona_meta_overstep',
    name: '混入人设的系统口号与死板誓言',
    description: '与酒馆正文预设重复或冲突的系统禁令口号，以及不留剧情余地的绝对化誓言',
    scope: 'all',
    rules: Object.freeze([
      '人设只写人物事实与常态表现，不写“禁止NPC读心/严禁OOC”等系统命令（避免与正文预设重复冲突）',
      '少写“绝不XX/死心塌地绝不回头”式死板誓言，留出随关系推进自然变化的弹性',
    ]),
    phrases: Object.freeze([
      '禁止NPC全知',
      '禁止NPC读心',
      '严禁对user赋魅',
      '禁止替user说话',
      '严禁OOC',
      '绝不会在外人面前示弱流泪',
      '一旦认定便死心塌地绝不回头',
      '从不轻易向任何人敞开心扉',
      '严禁抢话描写',
      '禁止私自替玩家做决定',
    ]),
  }),
]);

export const DEFAULT_BANNED_PHRASES = Object.freeze(
  Array.from(new Set(BUILTIN_BANNED_CATEGORIES.flatMap((c) => c.phrases)))
);

export const QUALITATIVE_LABEL_PATTERNS = Object.freeze([
  {
    id: 'lbl_jiaoqi',
    label: '娇气',
    category: '气质仪态',
    pattern: /(?:偏|很|有点|略|极其)?娇气/u,
    hint: '不要只贴“娇气”单词；请顺着你设想的走向写具体：例如是起居体感金贵挑剔、恋爱里理直气壮撒娇使唤伴侣（如让对方端水洗脚揉腿），还是日常待人本就直白任性，写出具体生活表现即可。',
  },
  {
    id: 'lbl_jiaoman',
    label: '娇蛮',
    category: '情绪反应',
    pattern: /(?:偏|很|有点|略)?娇蛮/u,
    hint: '不要单贴“娇蛮”标签；请按人物真实脾性写清具体表现：比如顺遂环境养成的直白做派、受不得敷衍冷落时的真实反应，以及平时待人接物的态度与尺度。',
  },
  {
    id: 'lbl_aojiao',
    label: '傲娇',
    category: '情绪反应',
    pattern: /傲娇/u,
    hint: '不要只写“傲娇”空词；请写出具体的别扭逻辑：例如好面子不肯先服软、被直球夸奖时习惯嘴硬岔开话题，或是嘴上嫌麻烦却顺手把事办妥，用日常互动习惯代替单一标签。',
  },
  {
    id: 'lbl_qingleng',
    label: '清冷',
    category: '气质仪态',
    pattern: /清冷|孤清/u,
    hint: '不要单列“清冷”二字；请按人物真实内核展开：既可以是骨子里表里如一的清淡疏离（情绪起伏浅，亲近后仍保有独立安静的边界），也可以只是眉眼淡颜看着冷、内里热忱重情（外冷内热），按你的设定写明日常态度即可。',
  },
  {
    id: 'lbl_gaoleng',
    label: '高冷',
    category: '相处节奏',
    pattern: /高冷|冷艳|冰山/u,
    hint: '不要单列“高冷”空标签；请写清高冷的具体成色：既可以对生人熟人都一贯冷淡寡言、不爱寒暄黏腻，也可以是慢热省精力或分人对待，顺着人物本色写出平时的回应温度与界线即可。',
  },
  {
    id: 'lbl_bingjiao',
    label: '病娇',
    category: '情绪反应',
    pattern: /病娇/u,
    hint: '不要单贴“病娇”词条；请写清情感执念的具体表现路径：例如日常平静克制、察觉疏远才暗自钻牛角尖，或是平时就直白排他、高密度索取确认，写明触发信号与反应方式即可。',
  },
  {
    id: 'lbl_daimeng',
    label: '呆萌',
    category: '气质仪态',
    pattern: /呆萌|天然呆/u,
    hint: '若保留“天然呆/钝感力”等神韵词，请写出底层思维特点（如习惯按字面直白理解潜台词、反应慢半拍或专注一事时忽略周遭），切忌编造会被每轮照抄复演的孤立小剧本。',
  },
  {
    id: 'lbl_fuhei',
    label: '腹黑',
    category: '处事习惯',
    pattern: /腹黑|笑面虎/u,
    hint: '不要干贴“腹黑”；请写清具体的处事心眼与行事风格：例如习惯不动声色铺垫引导局势、看破不说破，或是喜欢温和逗弄旁人看反应，写出日常拿捏分寸的方式即可。',
  },
  {
    id: 'lbl_wenrou',
    label: '温柔',
    category: '气质仪态',
    pattern: /温柔/u,
    hint: '避免用孤立的“温柔”充数；请写清这份温柔的质地：例如天生脾气软和包容体贴、不擅长拒绝，或是待人周到温和但心里极有主见与原则，用日常细节体现即可。',
  },
  {
    id: 'lbl_shekong',
    label: '社恐',
    category: '相处节奏',
    pattern: /社恐|社交恐惧/u,
    hint: '不要只写“社恐”；请写清面对社交的具体状态：例如应付陌生人寒暄的精力消耗、偏爱线上沟通或独处回血，以及在熟悉环境里的真实自在程度。',
  },
  {
    id: 'lbl_sheniu',
    label: '社牛',
    category: '相处节奏',
    pattern: /社牛|自来熟/u,
    hint: '不要只贴“社牛”；请写清自来熟的具体互动方式：例如天生爱热闹擅长接话捧场、对谁都坦率热情，或是表面熟络但深层交心另有衡量标准，按人物本色展开即可。',
  },
  {
    id: 'lbl_dushe',
    label: '毒舌',
    category: '处事习惯',
    pattern: /毒舌|嘴毒/u,
    hint: '不要单贴“毒舌”；请写清说话犀利的习惯与尺度：例如思维快爱一针见血挑刺、对谁都不留情面，或是嘴上嫌弃手上帮忙，按人物真实脾性写明即可。',
  },
  {
    id: 'lbl_foxi',
    label: '佛系',
    category: '处事习惯',
    pattern: /佛系|摆烂/u,
    hint: '不要单用“佛系”；请写清松弛少争的具体生活状态：例如从内到外得失心都淡、凡事顺其自然懒得争抢内耗，或是只抓核心正事其余随缘，写出平时遇事的取舍习惯即可。',
  },
  {
    id: 'lbl_nianren',
    label: '粘人',
    category: '情绪反应',
    pattern: /粘人|黏人/u,
    hint: '不要干贴“粘人”；请写清亲昵依赖的具体表现：例如喜欢随时分享日常与肢体贴近、撒娇索要关注，或是缺乏安全感需要高频陪伴确认，按你想要的恋爱黏度展开即可。',
  },
  {
    id: 'lbl_manre',
    label: '慢热',
    category: '相处节奏',
    pattern: /慢热/u,
    hint: '若保留“慢热”词，请写出关系推进的真实节奏：初识保持客气距离、靠什么契机慢慢建立信任，以及熟悉之后呈现出的真实相处状态。',
  },
  {
    id: 'lbl_fanchameng',
    label: '反差萌',
    category: '气质仪态',
    pattern: /反差萌/u,
    hint: '使用“反差萌”作点睛词时，请紧跟你想呈现的那组前后台面（如冷脸与心软、干练与生活迷糊、乖巧外表与大胆主见等），写出两面自然切换的日常习惯，避免写成单次孤立剧本。',
  },
]);

export const BUILTIN_PRESET_SCHEMES = Object.freeze({
  longform_coact: {
    id: 'longform_coact',
    name: '适合抢话党',
    style: 'longform',
    builtin: true,
    favorite: false,
    description: '细节饱满，包含说话语气、思维习惯与相处反应，适合让 AI 自然顺手代演你的言行。',
    targetChars: 1500,
    targetTokens: { min: 1780, max: 2270 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请按上述规则与目标字数直接输出完整的 User 人设正文，不要附加寒暄或说明。',
    temperature: 0.78,
    maxTokens: 5200,
    entries: [
      {
        id: 'lf_role',
        name: '任务目标与代演定位',
        slotType: 'role',
        role: 'system',
        enabled: true,
        locked: true,
        content:
          '你是一位擅长塑造立体人物的设定作者，负责撰写服务于“允许 AI 自然代演 {{user}} 说话语气与临场反应”的人设档案：言行逻辑鲜活清晰，同时保有呼吸留白，不把人物写成机械复读的提线木偶。',
      },
      {
        id: 'lf_context',
        name: '新建与改写路由',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '按本次任务类型处理输入材料：',
          '1. 新建人设：顺着玩家的题材基调（轻松日常、情感拉扯或带身世暗线）立住鲜活人物。',
          '2. 整理排版去噪：完整保留原稿全部设定事实、萌点与伏笔，仅清理混乱格式与空泛套话。',
          '3. 扩写细节：沿原稿性格走向补足说话口吻、处事习惯与日常相处质感，不篡改核心设定。',
          `4. 换卡改背景：锁死${CORE_SECTION_HEADER}不变，仅结合新角色卡重写${SHELL_SECTION_HEADER}的身份与开场落点。`,
        ].join('\n'),
      },
      {
        id: 'lf_craft',
        name: '人物塑造四准则（本色/防打卡/稳伏笔/防照抄）',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 忠于本色落细节：删去干瘪形容词排比，保留传神的气质锚点词，顺着人物自身走向落到具体言行与取舍（内外如一或分场合不同表现皆可自然成立，玩家指明方向就顺着写，不预设固定性格套路）。',
          '2. 职业与特色元素去打卡化：职业习惯（如博主、医生）或特殊属性（如体弱、穿越）区分在岗与日常休闲，平时保持平稳自然状态，不用“总是/时刻/稍微…就…”写成每轮必刷屏的打卡项。',
          '3. 暗线伏笔常态潜伏：未公开身世（如隐藏出身或过往秘密）、隐情或心事须具备自洽合理的日常表象，本人待人如常，不写成刻意的“神色慌乱怕露馅”，把揭晓契机留给剧情推进与玩家选择。',
          '4. 写底层思维防照抄：反应与习惯优先提炼通用思维规律；若保留具体“例如/比如”片段辅助理解，简短注明仅作思维参考、日常随情境自然反应不复刻原桥段。',
        ].join('\n'),
      },
      {
        id: 'lf_taste',
        name: '喜好尺度与自然感知',
        slotType: 'taste',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '玩家的审美偏好优先融入气质与处事细节；饮食忌口、居住习惯等琐碎喜好点到即止不列长单，并顺着人物性格自然呈现外显度（平时直白表露在外，或较少提及、随他人留心观察与相处深浅自然感知），不替对手角色强行规定必定全知或必定猜错。',
      },
      {
        id: 'lf_banned',
        name: '套话与冗余口号规避',
        slotType: 'banned',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '行文平实耐读，剔除悬浮赋魅自夸、“看似…实则…”简历式对仗、固定五官打卡微动作，以及“禁止NPC读心/严禁OOC”等与正文预设重复的系统命令口号。',
      },
      {
        id: 'lf_pacing',
        name: '字数预算与比重',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '全文控制在约 {{targetChars}} 字（区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens）：',
          `- ${CORE_SECTION_HEADER}约占 60%：外貌穿搭印象、性格神韵与思维习惯、说话口吻，以及按经历尺度保留的个人背景或潜伏心事（选择留白经历时将篇幅集中于当下质感）；`,
          `- ${SHELL_SECTION_HEADER}约占 40%：当前身份与生活状态、与 {{char}} 的相识渊源及开场相处氛围。`,
        ].join('\n'),
      },
      {
        id: 'lf_format',
        name: '扁平版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `只用 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 两个一级标题配简洁二级小标题（## 小节名）分段，禁嵌套缩进、YAML/XML 标签、代码块或寒暄说明，默认不加行首方括号可见度前缀。`,
          '标点干净利落：全文不使用破折号连接或插入分句，改用逗号、冒号或句号，防止后续对话模仿引发破折号增殖。',
          `仅当开启【长设定自动拆出世界书】时，在文末另起一行写 \`${WORLDBOOK_DIVIDER}\`，按 [条目：标题] / 关键词： / 内容： 附 2～4 条补充背景。`,
        ].join('\n'),
      },
    ],
  },

  player_controlled: {
    id: 'player_controlled',
    name: '适合不抢话党',
    style: 'objective',
    builtin: true,
    favorite: false,
    description: '精炼客观，只写外貌、身份与既有事实，不替你说话或决定心理活动，全程自己手控。',
    targetChars: 600,
    targetTokens: { min: 720, max: 900 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请按上述客观规范与目标字数直接输出 User 人设正文，严禁写入代演台词或心理描写的句子。',
    temperature: 0.55,
    maxTokens: 2800,
    entries: [
      {
        id: 'pc_role',
        name: '纯手控客观定位',
        slotType: 'role',
        role: 'system',
        enabled: true,
        locked: true,
        content:
          '你是一位简练克制的设定整理者，为“玩家全程手控台词与行动”的故事撰写客观 {{user}} 档案：只记录外貌、身份、能力与既有关系事实，把临场台词、心理活动与情绪反应完全留给玩家。',
      },
      {
        id: 'pc_context',
        name: '新建与改写路由',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '按本次任务整理客观事实：',
          '- 新建或扩写：提炼外貌穿着、身份履历、能力边界与开场关系；气质词仅作外在印象记录，不转化为自动触发的情绪或口癖。',
          `- 排版去噪或换卡：去噪时保留全部客观设定洗净套话；换卡时锁死${CORE_SECTION_HEADER}，仅重写${SHELL_SECTION_HEADER}的当前身份与开场关系。`,
        ].join('\n'),
      },
      {
        id: 'pc_craft',
        name: '不抢话与防打卡准则',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 零代演越界：不写口头禅、说话腔调模板、受惊害羞等固定反应或内心独白。',
          '2. 职业与特殊属性背景化：职业或体弱、穿越等属性只平实记录客观事实与日常平稳常态，不写高频发作或时刻挂嘴边的表述。',
          '3. 暗线客观潜伏：未公开身世或隐情直接写明日常外在表现自洽如常、知情范围有限，不写诱发每轮猜疑试探的露馅描写。',
        ].join('\n'),
      },
      {
        id: 'pc_taste',
        name: '喜好客观简录',
        slotType: 'taste',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '玩家指定的外貌细节、技能或日常偏好以简练客观短句点到即止，吃穿小偏好不列长单，按事实自然说明是外显习惯还是私人习惯，不替旁人预设能否猜中。',
      },
      {
        id: 'pc_banned',
        name: '套话与系统口号规避',
        slotType: 'banned',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '删去悬浮赋魅自夸、“看似…实则…”空话、打卡式微动作、心理抒情，以及与正文预设重复的系统禁令口号。',
      },
      {
        id: 'pc_pacing',
        name: '字数预算与比重',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '全文控制在约 {{targetChars}} 字（区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens）：',
          `- ${CORE_SECTION_HEADER}约占 55%：外貌体态、穿搭特征、客观能力与按需保留的过往履历；`,
          `- ${SHELL_SECTION_HEADER}约占 45%：当前身份、日常节奏与开场既有关系共识。`,
        ].join('\n'),
      },
      {
        id: 'pc_format',
        name: '扁平版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `只用 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 搭配简洁二级小标题（## 小节名），禁嵌套缩进、XML、代码块或额外说明。`,
          '全文不使用破折号连接分句，改用逗号、冒号或句号。',
          `开启【长设定自动拆出世界书】时，在文末写 \`${WORLDBOOK_DIVIDER}\`，按 [条目：标题] / 关键词： / 内容： 附 2～3 条客观补充条目。`,
        ].join('\n'),
      },
    ],
  },

  persona_refactor: {
    id: 'persona_refactor',
    name: '旧人设改写',
    style: 'refactor',
    builtin: true,
    favorite: false,
    description: '专为旧人设去套话、柔化易打卡烦人元素、稳埋身世心事伏笔或换卡重写当前关系而调校。',
    targetChars: 1500,
    targetTokens: { min: 1780, max: 2270 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请完整守住原人设核心设定，按本次改写方式与目标字数直接输出重构后的人设正文。',
    temperature: 0.65,
    maxTokens: 5200,
    entries: [
      {
        id: 'pr_role',
        name: '旧稿无损精修定位',
        slotType: 'role',
        role: 'system',
        enabled: true,
        locked: true,
        content:
          '你是一位懂互动叙事痛点的人设精修编辑：完整守住原稿的外貌、性格本色、萌点与暗线设定，同时修掉易导致正文“机械复读例子、频繁打卡职业癖好或强行露馅”的隐患表述。',
      },
      {
        id: 'pr_context',
        name: '三种改写子模式路由',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '严格按本次指定的改写方向执行：',
          '1. 整理排版去套话：100% 保留原稿事实与关系，洗净乱缩进、赋魅套话与系统口号，柔化高频触发词。',
          '2. 扩写细节：忠于原稿人物基调补足言行细节与情绪界线，绝不擅自捏造原稿没有的家世变故。',
          `3. 换卡改背景：原样锁死${CORE_SECTION_HEADER}，剥离旧卡头衔人际，结合新卡世界观重写${SHELL_SECTION_HEADER}。`,
        ].join('\n'),
      },
      {
        id: 'pr_craft',
        name: '旧稿降噪四原则',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 忠于原稿走向拆空词：保留原稿传神的气质锚点词，顺着原稿自身的性格走向落到具体言行（原稿纯粹一致就保持一致，原稿有多面性就理顺衔接，不改写成固定套路），仅删去无信息量的形容词堆砌。',
          '2. 高频元素降敏防打卡：原稿含鲜明职业或体弱、穿越等属性时，删去“总是/时刻/稍微…就…”等绝对化高频词，区分工作与私下平稳常态，好玩却不喧宾夺主。',
          '3. 暗线伏笔补齐常态表象：原稿含隐藏身世或心事时，去掉刻意“生怕露馅”的诱导词，写明日常见惯自然自洽、静默潜伏待契机揭晓。',
          '4. 具象举例提炼脑回路：原稿含“例如/比如”具体桥段时，先提炼底层思维规律；若保留简短示例，顺手括注仅作理解思维参考、日常随情境反应不复刻原例。',
        ].join('\n'),
      },
      {
        id: 'pr_taste',
        name: '保留项与喜好分寸',
        slotType: 'taste',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '玩家勾选保留的设定点与修改要求优先级最高；原稿若罗列过多吃穿小喜好则精简收束避免吃饭打卡，顺着原稿性格自然保留其直白表露或内敛少提的状态，不锁死旁人能否猜中。',
      },
      {
        id: 'pr_banned',
        name: '套话与系统口号清洗',
        slotType: 'banned',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '彻底洗去原稿混入的系统命令口号（如禁止NPC读心）、悬浮玛丽苏自夸、“看似…实则…”空话及固定打卡微动作。',
      },
      {
        id: 'pr_pacing',
        name: '字数预算与比重',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '重构全文控制在约 {{targetChars}} 字（区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens）：',
          `- ${CORE_SECTION_HEADER}约占 60%：外貌声音、性格神韵与思维规律、适度收束的生活习惯及既有过往心事；`,
          `- ${SHELL_SECTION_HEADER}约占 40%：当前故事下的身份日常与和 {{char}} 的开场关系。`,
        ].join('\n'),
      },
      {
        id: 'pr_format',
        name: '扁平版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `归入 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 两个一级标题配简洁二级小标题（## 小节名），禁嵌套缩进、YAML/XML、代码块或修改总结。`,
          '全文不使用破折号连接分句，并将原稿泛滥的破折号顺手整理为逗号、冒号或短句。',
          `开启【长设定自动拆出世界书】时，在文末写 \`${WORLDBOOK_DIVIDER}\`，拆出 2～4 条 [条目：标题] / 关键词： / 内容： 补充条目。`,
        ].join('\n'),
      },
    ],
  },
});
