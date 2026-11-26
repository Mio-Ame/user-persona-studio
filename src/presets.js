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

// 100% sanitized, general-purpose setting lexicon (7 categories, 98 terms)
export const COMMON_PERSONA_LEXICON_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'animal_archetype',
    label: '动物系',
    terms: Object.freeze(['猫系', '犬系', '狐系', '狼系', '兔系', '鹿系', '小羊系', '豹系', '天鹅系', '企鹅系']),
  }),
  Object.freeze({
    id: 'vibe_aura',
    label: '气质氛围',
    terms: Object.freeze([
      '沉稳可靠', '外冷内热', '松弛感', '清冷克制', '矜贵疏离', '少年意气',
      '慵懒散漫', '温柔知性', '冷脸萌', '明艳张扬', '温润如玉', '低调内敛',
      '反差感', '神秘难测',
    ]),
  }),
  Object.freeze({
    id: 'personality',
    label: '性格特质',
    terms: Object.freeze([
      '嘴硬心软', '理智果断', '慢热寡言', '阳光直球', '风趣犀利', '温和腹黑',
      '天然呆', '钝感力', '单纯不蠢', '重行动少空话', '傲娇', '白切黑',
      '直白率性', '古灵精怪', '倔强护短', '嘴毒心软',
    ]),
  }),
  Object.freeze({
    id: 'interaction_style',
    label: '相处模式',
    terms: Object.freeze([
      '慢热稳重', '克制守礼', '依恋粘人', '口嫌体正直', '爱吐槽接梗', '社交伪装',
      '熟人话多生人冷', '护短偏心', '直球坦荡', '边界感清晰', '外柔内刚', '回避依恋',
      '嘴甜会哄人', '细心照顾人',
    ]),
  }),
  Object.freeze({
    id: 'role_archetype',
    label: '人设定位',
    terms: Object.freeze([
      '普通上班族', '自由职业/画师', '在校学生', '世家出身', '隐退高手', '行业新人',
      '独立手艺人', '科研/技术从业者', '医护/救援从业者', '文艺创作者', '旅行者', '带伤隐忍',
      '隐瞒身份', '跨界穿越',
    ]),
  }),
  Object.freeze({
    id: 'appearance',
    label: '外貌特征',
    terms: Object.freeze([
      '黑长直', '短发利落', '长卷发', '淡颜清秀', '浓颜明艳', '冷白皮',
      '暖调肤色', '上挑眼尾', '温和下垂眼', '浅色瞳', '眼角泪痣', '身形高挑',
      '娇小纤细', '声线清润', '低沉磁性嗓音', '偏爱极简通勤', '偏爱舒适休闲', '偏爱新中式',
    ]),
  }),
  Object.freeze({
    id: 'habits_details',
    label: '习惯与细节',
    terms: Object.freeze([
      '低精力宅家', '规律养生', '爱吃辣', '嗜甜', '咖啡/茶饮不离手', '轻度洁癖',
      '熬夜夜猫子', '动手能力强', '专注时忽略周遭', '记仇但好哄', '情绪稳定少内耗', '习惯留后手',
    ]),
  }),
]);

export const COMPANION_FREQUENCY_TIERS = Object.freeze([
  Object.freeze({
    id: 'background',
    label: '仅作背景底色',
    description: '平时不主动介入，仅在提及相关经历或话题时自然浮现',
    worldbookOrder: 60,
    promptRule: '该角色仅作 {{user}} 的背景关系底色存在，不主动介入主线日常，仅当剧情提及相关人际或话题时自然呼应。',
  }),
  Object.freeze({
    id: 'occasional',
    label: '偶尔自然联络',
    description: '按生活节点偶尔联络或照面，不抢主角色戏份',
    worldbookOrder: 80,
    promptRule: '该角色保持低干扰客串频率，仅在生活节点或剧情需要时偶尔联络或被提及，不抢占 {{char}} 主线。',
  }),
  Object.freeze({
    id: 'active_circle',
    label: '同圈常驻互动',
    description: '处于同一生活或工作圈层，随场景自然同框但仍以主角色为中心',
    worldbookOrder: 100,
    promptRule: '该角色与 {{user}} 或 {{char}} 处于同一生活或社交圈层，在对应场景自然互动，始终作为配角客串推进氛围。',
  }),
]);

export const COMPANION_CARRY_MODES = Object.freeze([
  Object.freeze({ id: 'inline', label: '直接写进人设简介（简短够用）' }),
  Object.freeze({ id: 'persona_book', label: '存进该人设专属世界书（推荐·换人设自动切）' }),
  Object.freeze({ id: 'target_book', label: '并入已有的世界书' }),
]);

export const WORLDBOOK_LIGHT_MODES = Object.freeze([
  Object.freeze({
    id: 'green_selective',
    label: '绿灯：提到关键词时触发（推荐）',
    shortLabel: '绿灯触发',
    description: '条目平时不占空间，对话中提到相关关键词时自动触发注入',
  }),
  Object.freeze({
    id: 'blue_constant',
    label: '蓝灯：全程常驻生效',
    shortLabel: '蓝灯常驻',
    description: '条目全程常驻在上下文中，适合必须时刻记住的核心背景或重要关系',
  }),
  Object.freeze({
    id: 'smart_mix',
    label: '蓝绿灯自动分流（按重要度分配）',
    shortLabel: '自动蓝绿灯',
    description: '由 AI 自动将核心关系标为蓝灯常驻、次要往事与细节标为绿灯关键词触发',
  }),
]);

export const COMPANION_RELATION_PRESETS = Object.freeze([
  '哥哥', '姐姐', '弟弟', '妹妹', '父亲', '母亲',
  '挚友', '青梅竹马', '前任', '师长', '搭档', '同门', '室友', '监护人',
]);

export const MODULE_RATIO_KEYS = Object.freeze([
  'appearance',
  'personality',
  'backstory',
  'relationship',
  'private',
]);

export const MODULE_RATIO_DEFAULTS = Object.freeze({
  appearance: 25,
  personality: 35,
  backstory: 20,
  relationship: 20,
  private: 0,
});

export const GENERATION_LAYOUT_STYLES = Object.freeze([
  Object.freeze({
    id: 'structured',
    label: '清单版',
    description: '浅层中文分栏与平实白话，条目直观好检索',
  }),
  Object.freeze({
    id: 'natural',
    label: '分段版',
    description: '按小节分段叙述，语感连贯自然',
  }),
]);

export const GENERATION_SECTION_GROUPS = Object.freeze([
  Object.freeze({
    id: 'core',
    label: '核心板块',
    defaultExpanded: true,
    items: Object.freeze([
      Object.freeze({
        id: 'basic_identity',
        label: '基本身份',
        group: 'core',
        defaultEnabled: true,
        guidance: '交代姓名、常用称呼或小名、年龄、性别、身高及当前身份定位；用平实白话直写，贴合世界观时代背景自适应子项，不留空壳占位格。',
      }),
      Object.freeze({
        id: 'appearance_outfit',
        label: '外貌与穿搭',
        group: 'core',
        defaultEnabled: true,
        guidance: '写清发色发型、眉眼五官、肤色气质、体态比例与辨识特征，以及贴合当下题材的日常或特定场合穿搭；不用空泛吹捧套话。',
      }),
      Object.freeze({
        id: 'personality_logic',
        label: '性格与行为逻辑',
        group: 'core',
        defaultEnabled: true,
        guidance: '用大白话写清核心性情、感情与亲密态度、高兴/生气/动摇时的情绪表现、行事原则、个人目标与短板弱点，不堆砌比喻句。',
      }),
      Object.freeze({
        id: 'habits_tastes',
        label: '生活与做事习惯',
        group: 'core',
        defaultEnabled: true,
        guidance: '写出日常起居作息、工作或学业习惯、擅长技能与盲区、喜好与雷点；琐碎偏好点到即止，并按人物性格自然呈现外显度。',
      }),
      Object.freeze({
        id: 'backstory_growth',
        label: '成长经历与现状',
        group: 'core',
        defaultEnabled: true,
        guidance: '让家庭氛围、过往履历或与主角色的交集顺着当前世界观与时间线自然生长，长出真实血肉，不编造悬浮狗血创伤。',
      }),
      Object.freeze({
        id: 'career_finance',
        label: '职业与经济状况',
        group: 'core',
        defaultEnabled: true,
        guidance: '写清职业或学业分工、经济来源、消费观与社会处境；古风或架空题材自动采用对应时代定位，不硬套现代商务词汇。',
      }),
      Object.freeze({
        id: 'relation_to_char',
        label: '与当前角色的关系',
        group: 'core',
        defaultEnabled: true,
        guidance: '写明与主角色的相识渊源、相识时间线、当前关系阶段与相处张力；仅在双人互动容易产生指代歧义时点一次 {{user}} 或角色真名。',
      }),
    ]),
  }),
  Object.freeze({
    id: 'npc_network',
    label: '关系网与亲友',
    defaultExpanded: false,
    items: Object.freeze([
      Object.freeze({
        id: 'parents_family',
        label: '父母/家人',
        group: 'npc_network',
        defaultEnabled: false,
        guidance: '简明交代父母或核心家人的身份现状、家庭氛围与对 {{user}} 性格或处境的影响；不无端编造狗血创伤。',
      }),
      Object.freeze({
        id: 'siblings',
        label: '兄弟姐妹',
        group: 'npc_network',
        defaultEnabled: false,
        guidance: '交代兄弟姐妹的排行与平日来往状态，保持简述而不偏离主线。',
      }),
      Object.freeze({
        id: 'friends_circle',
        label: '朋友/社交圈',
        group: 'npc_network',
        defaultEnabled: false,
        guidance: '写清交友广度与常联系的圈层或少数真实好友定位，保持配角分寸不抢主线。',
      }),
      Object.freeze({
        id: 'ex_partner',
        label: '前任',
        group: 'npc_network',
        defaultEnabled: false,
        guidance: '如有前任设定，交代曾处的阶段、分开原因以及当前是否仍有交集与态度边界。',
      }),
      Object.freeze({
        id: 'key_npc_pet',
        label: '重要伙伴/宠物',
        group: 'npc_network',
        defaultEnabled: false,
        guidance: '写明除主角色外的关键师友、熟人或饲养宠物及日常相处细节。',
      }),
    ]),
  }),
  Object.freeze({
    id: 'body_traits',
    label: '身体特征',
    defaultExpanded: false,
    items: Object.freeze([
      Object.freeze({
        id: 'height_build',
        label: '身高体型与比例',
        group: 'body_traits',
        defaultEnabled: false,
        guidance: '用客观平实的尺度描述身高、肩颈腰腿比例、体态轮廓与力量感或纤细度。',
      }),
      Object.freeze({
        id: 'voice_scent_marks',
        label: '声音/气味与特殊印记',
        group: 'body_traits',
        defaultEnabled: false,
        guidance: '写明说话声线音色、日常习惯使用的淡香或干净体味，以及疤痕、胎记、泪痣等具体位置印记。',
      }),
      Object.freeze({
        id: 'constitution_ability',
        label: '体质或特殊能力/限制',
        group: 'body_traits',
        defaultEnabled: false,
        guidance: '客观交代体能耐受、易疲劳或怕冷热等体质特点，或特定世界观下的能力代价与使用限制。',
      }),
    ]),
  }),
  Object.freeze({
    id: 'intimate',
    label: '亲密设定',
    defaultExpanded: false,
    items: Object.freeze([
      Object.freeze({
        id: 'intimate_dynamic',
        label: '亲密关系倾向',
        group: 'intimate',
        defaultEnabled: false,
        guidance: '用平实克制的语言写明在亲密互动中的经验深浅、情感取向与主导或被动位阶倾向。',
      }),
      Object.freeze({
        id: 'intimate_preference',
        label: '偏好与氛围节奏',
        group: 'intimate',
        defaultEnabled: false,
        guidance: '简明写清喜欢的亲密氛围、互动节奏与核心偏好，不堆砌低俗空洞的感官词。',
      }),
      Object.freeze({
        id: 'intimate_sensitivity',
        label: '身体敏感与反应',
        group: 'intimate',
        defaultEnabled: false,
        guidance: '平实描述亲密接触时的敏感部位、自然生理反应与情绪微表现。',
      }),
      Object.freeze({
        id: 'intimate_boundary',
        label: '边界与事后相处',
        group: 'intimate',
        defaultEnabled: false,
        guidance: '明确不可触碰的底线禁区，以及亲密结束后的相处习惯与安抚需求。',
      }),
    ]),
  }),
]);

export const GENERATION_SECTION_PRESETS = Object.freeze({
  minimal: Object.freeze({
    id: 'minimal',
    label: '极简核心',
    enabledIds: Object.freeze([
      'basic_identity',
      'appearance_outfit',
      'personality_logic',
      'relation_to_char',
    ]),
  }),
  standard: Object.freeze({
    id: 'standard',
    label: '标准日常',
    enabledIds: Object.freeze([
      'basic_identity',
      'appearance_outfit',
      'personality_logic',
      'habits_tastes',
      'backstory_growth',
      'career_finance',
      'relation_to_char',
    ]),
  }),
  full: Object.freeze({
    id: 'full',
    label: '完整故事',
    enabledIds: Object.freeze([
      'basic_identity',
      'appearance_outfit',
      'personality_logic',
      'habits_tastes',
      'backstory_growth',
      'career_finance',
      'relation_to_char',
      'parents_family',
      'siblings',
      'friends_circle',
      'ex_partner',
      'key_npc_pet',
      'height_build',
      'voice_scent_marks',
      'constitution_ability',
    ]),
  }),
});

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
    description: '职业、特色属性与生活小喜好自然收放，不反复硬塞；若有未公开背景或心事，平时表象自然自洽，不被无端强行看穿。',
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
    description: '写了经历就顺着当前世界观与角色关系自然展开；没提过往时只用宽泛生活氛围托底，不凭空硬编狗血变故。',
  },
  {
    id: 'blank_self',
    label: '纯留白（不写过往）',
    description: '严禁编造任何未提及的家庭出身、童年或过往事件，全靠当下的外貌气质、处事分寸与开场处境立住人物。',
  },
  {
    id: 'rich_arc',
    label: '完整经历（融入世界与角色）',
    description: '结合人物性格、当前世界观及与角色的交集脉络，自然补全合理的成长环境、习惯成因与过往片段，让人物长出真实血肉。',
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
  {
    id: 'sentence_pattern',
    label: '句式问题（禁同类句式）',
    reason: '反感这类句式结构（如转折对仗、排比造句），请连同背后这一类句式模板一并规避，而非仅避开原词句',
  },
  {
    id: 'explanatory_prose',
    label: '解释性语言过多',
    reason: '反感在行为或事实后附加解释原因、总结心理动机的说明性旁白，只写具体表现即可',
  },
  { id: 'too_ai', label: '表述太 AI', reason: '表述太像 AI 惯用修辞套话，缺乏真人平实自然感，请连同类腔调一并避开' },
  { id: 'too_oily', label: '太油腻 / 端着', reason: '腔调油腻做作，不够平实自然' },
  { id: 'too_label', label: '贴标签 / 太笼统', reason: '直接贴性格标签或空泛概括，缺少具体成因与日常表现' },
  { id: 'overstep_user', label: '替我抢话 / 写心理', reason: '越界预设了玩家的台词、心理活动或固定动作' },
  { id: 'easy_checkin', label: '易导致剧情机械重复', reason: '写成了过于琐碎固定的小剧本或口头禅，容易导致正文每轮机械重复' },
  { id: 'dislike_general', label: '不喜欢这类写法', reason: '个人不喜欢这类表达倾向，请避开同类写法' },
]);

export const BUILTIN_USAGE_GUIDE = [
  '【User 人设工坊 — 酒馆原生预设使用说明】',
  '1. 本预设用于生成或改写 SillyTavern 的 {{user}} 人设档案，不含任何接口地址或密钥。',
  '2. 新建人设：在聊天框直接发送一两句灵感或想要的设定（需要结合当前角色卡时保持角色描述条目开启），即可生成干净自然的人设；日常恋爱、暗线伏笔或长篇世界观均可自然适配。',
  '3. 改写旧人设：粘贴旧人设文本并附一句要求（如“整理排版并去掉套话”“保留原设定扩写细节”或“保留外貌性格、只改当前卡里的身份关系”）。',
  '4. 需要隐藏自检块时，可导入配套正则脚本在聊天界面过滤【草稿自检】块；将成稿复制到酒馆「用户人设（Persona）」面板保存。本说明条目默认关闭。',
].join('\n');

// 100% original, Persona-Profile-Specific anti-cliché packs (strictly for persona sheets, zero prose-narration filler)
export const BUILTIN_BANNED_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'persona_marysue',
    name: '人设悬浮自夸与赋魅腔',
    description: '空洞吹捧气场或美貌的套话',
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
    description: '用笼统的对仗或模糊修饰代替具体性格',
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
    name: '固定重复的小动作',
    description: '每逢特定情绪都做同一个小动作，或每轮都提同一件道具',
    scope: 'all',
    rules: Object.freeze([
      '不规定“每次紧张必摸某物/每次说话必推眼镜”式固定小动作，改写为通用的情绪反应倾向',
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
    description: '写进人设里的系统命令或绝对化誓言',
    scope: 'all',
    rules: Object.freeze([
      '人设只写人物事实与常态表现，不写“禁止NPC读心/严禁OOC”等系统命令',
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

export const BUILTIN_PRESET_SCHEMA_VERSION = 3;

export const BUILTIN_PRESET_SCHEMES = Object.freeze({
  longform_coact: {
    id: 'longform_coact',
    presetVersion: BUILTIN_PRESET_SCHEMA_VERSION,
    name: '适合抢话党',
    style: 'longform',
    builtin: true,
    favorite: false,
    description: '细节饱满，包含说话语气、思维习惯与相处反应，适合让 AI 自然顺手代演你的言行。',
    targetChars: 1500,
    targetTokens: { min: 1780, max: 2270 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请严格按上述规则与目标字数直接输出完整的 User 人设正文，不要附加寒暄或说明。',
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
          '你是一位擅长塑造立体人物的设定作者，负责撰写服务于“允许 AI 自然代演 {{user}} 说话语气与临场反应”的人设档案：用平实直白的大白话写出具体事实、生活习惯与真实情绪表现，不堆砌比喻句，也不把人物写成机械复读的提线木偶。',
      },
      {
        id: 'lf_context',
        name: '人物来处与层次结构',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          `顺着题材基调立住鲜活立体的人物，核对年龄与关系时间线前后自洽：将基本身份、外貌穿搭、性格行为逻辑、生活习惯与成长来处归入${CORE_SECTION_HEADER}；将当下时间点的社会处境、开场关系与相处氛围归入${SHELL_SECTION_HEADER}。`,
      },
      {
        id: 'lf_craft',
        name: '人物塑造四准则',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 忠于本色写大白话：删去空泛形容词排比与抒情比喻，顺着人物自身走向落到具体事实、行事逻辑、目标短板与高兴/生气/动摇时的真实情绪表现；各特征短句默认省略主语，不逐句重复写 {{user}}，仅在双人互动容易产生指代歧义处点一次 {{user}} 或角色名消歧。',
          '2. 职业与特色元素自然收放：职业习惯（如医生、画师）或特殊属性（如体弱、穿越）区分在岗与日常休闲，平时保持平稳自然状态，不用“总是/时刻/稍微…就…”写成每轮必提的固定习惯。',
          '3. 心事与边界自洽如常：日常设定保持坦荡自然，不凭空编造未提及的秘密；涉及隐瞒、暗自打算或感情暗流时，清晰区分平时如常的外在表现与未说出口的真实想法，不写成刻意的慌乱怕露馅，把揭晓契机留给剧情推进。',
          '4. 写底层思维防照抄：反应与习惯优先提炼通用思维规律；具体生活片段仅辅助理解人物思维方式，日常随情境自然反应不复刻原桥段。',
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
          '玩家的审美偏好优先融入气质与处事细节；饮食忌口、居住习惯等琐碎喜好点到即止不列长单，并按人物性格自然体现外显度（平时直白表露在外，或较少提及、随他人留心观察与相处深浅自然感知），不替对手角色强行规定必定全知或必定猜错。',
      },
      {
        id: 'lf_banned',
        name: '套话与冗余口号规避',
        slotType: 'banned',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '行文平实耐读，剔除悬浮赋魅自夸、“看似…实则…”简历式对仗、固定五官重复微动作，以及“禁止NPC读心/严禁OOC”等系统命令。',
      },
      {
        id: 'lf_pacing',
        name: '字数预算与重心分配',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '全文目标约 {{targetChars}} 字（硬性区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens），必须达到 {{targetCharsMin}} 字下限且不超出 {{targetCharsMax}} 字上限：',
          `- ${CORE_SECTION_HEADER}：扎实展开基本身份、外貌穿搭、性格行为逻辑、生活做事习惯与成长脉络；`,
          `- ${SHELL_SECTION_HEADER}：写清当前职业处境、与 {{char}} 的现阶段关系与开场相处氛围。`,
        ].join('\n'),
      },
      {
        id: 'lf_format',
        name: '清爽版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `使用 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 两个一级标题，下方按指定板块输出简洁二级小标题（## 板块名），只写有实质内容的有效字段不留空壳；严禁深层缩进、XML 标签、代码块或寒暄说明，默认不加行首方括号可见度前缀。`,
          '全文不使用破折号连接或插入分句，改用逗号、冒号或句号。',
        ].join('\n'),
      },
      {
        id: 'synced_worldbook',
        name: '补充世界书拆分规范',
        slotType: 'worldbook',
        role: 'system',
        enabled: false,
        locked: false,
        content: [
          '【补充世界书拆分规范】',
          `请将主档案正文精简至约 650～950 字并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在下方生成 2～4 条补充背景条目，严格按 [条目：条目标题] / 触发方式： / 关键词： / 内容： 格式输出。`,
        ].join('\n'),
      },
      {
        id: 'draft_audit_entry',
        name: '成稿前草稿自检',
        slotType: 'draft_audit',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '【成稿前草稿自检】',
          `输出正文前，先在顶部用唯一一个 \`${DRAFT_START_MARKER}\` 与 \`${DRAFT_END_MARKER}\` 包裹简短核对（控制在 120 字内）：核对经历尺度与故事语境、职业与小喜好收放自然无机械重复隐患、清零赋魅套话与破折号。`,
          `闭合 \`${DRAFT_END_MARKER}\` 后换一行直接从 \`${CORE_SECTION_HEADER}\` 输出干净正文。`,
        ].join('\n'),
      },
    ],
  },

  player_controlled: {
    id: 'player_controlled',
    presetVersion: BUILTIN_PRESET_SCHEMA_VERSION,
    name: '适合不抢话党',
    style: 'objective',
    builtin: true,
    favorite: false,
    description: '精炼客观，只写外貌、身份与既有事实，不替你说话或决定心理活动，全程不抢话。',
    targetChars: 600,
    targetTokens: { min: 720, max: 900 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请严格按上述客观规范与目标字数直接输出 User 人设正文，严禁写入代演台词或心理描写的句子。',
    temperature: 0.55,
    maxTokens: 2800,
    entries: [
      {
        id: 'pc_role',
        name: '不抢话客观定位',
        slotType: 'role',
        role: 'system',
        enabled: true,
        locked: true,
        content:
          '你是一位简练克制的设定整理者，为“玩家自主掌控台词与行动（不抢话）”的故事撰写客观 {{user}} 档案：只用平实白话记录外貌、身份、能力、客观习惯与既有关系事实，各特征短句默认省略主语不重复刷 {{user}}（仅在双人关系消歧处点明），把临场台词、心理活动与情绪反应完全留给玩家。',
      },
      {
        id: 'pc_context',
        name: '客观履历与层次结构',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          `提炼客观可靠的人物事实：气质词仅作外在印象记录，不转化为自动触发的情绪或口癖；将基本身份、外貌体态、能力边界与过往履历归入${CORE_SECTION_HEADER}，当下处境与开场关系共识归入${SHELL_SECTION_HEADER}。`,
      },
      {
        id: 'pc_craft',
        name: '不抢话与日常分寸准则',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 零代演越界：不写口头禅、说话腔调模板、受惊害羞等固定反应或内心独白。',
          '2. 职业与特殊属性背景化：职业或体弱、穿越等属性只平实记录客观事实与日常平稳常态，不写高频发作或时刻挂嘴边的表述。',
          '3. 知情边界客观清晰：日常设定保持平实自然；涉及隐瞒或未公开事实时，直接写明日常外在表现自洽如常、知情范围有限，不写诱发每轮猜疑试探的露馅描写。',
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
          '删去悬浮赋魅自夸、“看似…实则…”空话、固定重复微动作、心理抒情，以及系统命令。',
      },
      {
        id: 'pc_pacing',
        name: '字数预算与重心分配',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '全文目标约 {{targetChars}} 字（硬性区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens），必须达到 {{targetCharsMin}} 字下限且不超出 {{targetCharsMax}} 字上限：',
          `- ${CORE_SECTION_HEADER}：客观记录基本身份、外貌体态、穿搭特征、能力边界与过往事实；`,
          `- ${SHELL_SECTION_HEADER}：简明写清当前身份、日常节奏与开场既有关系共识。`,
        ].join('\n'),
      },
      {
        id: 'pc_format',
        name: '清爽版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `只用 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 搭配简洁二级小标题（## 板块名），不留空壳字段，禁嵌套缩进、XML、代码块或额外说明。`,
          '全文不使用破折号连接分句，改用逗号、冒号或句号。',
        ].join('\n'),
      },
      {
        id: 'synced_worldbook',
        name: '补充世界书拆分规范',
        slotType: 'worldbook',
        role: 'system',
        enabled: false,
        locked: false,
        content: [
          '【补充世界书拆分规范】',
          `请将主档案正文精简至约 350～550 字并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在下方生成 2～3 条客观补充条目，严格按 [条目：条目标题] / 触发方式： / 关键词： / 内容： 格式输出。`,
        ].join('\n'),
      },
      {
        id: 'draft_audit_entry',
        name: '成稿前草稿自检',
        slotType: 'draft_audit',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '【成稿前草稿自检】',
          `输出正文前，先在顶部用唯一一个 \`${DRAFT_START_MARKER}\` 与 \`${DRAFT_END_MARKER}\` 包裹简短核对（控制在 120 字内）：核对不抢话零代演边界、客观经历尺度与无套话破折号。`,
          `闭合 \`${DRAFT_END_MARKER}\` 后换一行直接从 \`${CORE_SECTION_HEADER}\` 输出干净正文。`,
        ].join('\n'),
      },
    ],
  },

  persona_refactor: {
    id: 'persona_refactor',
    presetVersion: BUILTIN_PRESET_SCHEMA_VERSION,
    name: '旧人设改写',
    style: 'refactor',
    builtin: true,
    favorite: false,
    description: '适合为旧人设整理排版、去掉套话，或结合新角色卡重塑经历与当前关系。',
    targetChars: 1500,
    targetTokens: { min: 1780, max: 2270 },
    tailMode: 'auto',
    prefillText: `${CORE_SECTION_HEADER}\n`,
    triggerText: '请完整守住原人设核心神韵，严格按本次改写方式与目标字数直接输出重构后的人设正文。',
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
          '你是一位细腻克制的人设精修编辑：完整守住原稿的外貌、性格本色、特点与已有暗线设定，将空洞比喻或套话改写为平实大白话，各特征短句默认省略主语（去掉每行开头机械重复的 {{user}}，仅在双人关系消歧处保留），同时修掉易导致正文“机械复读例子、反复刷职业存在感或强行露馅”的隐患表述。',
      },
      {
        id: 'pr_context',
        name: '原稿神韵保留与结构重整',
        slotType: 'context',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          `忠于原稿人物底色与关键设定，核对年龄与关系时间线前后自洽，绝不擅自捏造原稿没有的家世变故；将人物本体特征与成长脉络归入${CORE_SECTION_HEADER}，当下处境与现阶段关系归入${SHELL_SECTION_HEADER}。`,
      },
      {
        id: 'pr_craft',
        name: '旧稿降噪四原则',
        slotType: 'craft',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '1. 忠于原稿走向拆空词：保留原稿传神的气质锚点词，顺着原稿自身的性格走向落到具体言行，仅删去无信息量的形容词堆砌与比喻套话。',
          '2. 高频元素自然收放：删去职业或特殊体质中的“总是/时刻/稍微…就…”等绝对化高频词，区分工作与私下平稳常态，生动却不喧宾夺主。',
          '3. 暗线与日常表象自洽：去掉刻意“生怕露馅”的诱导词，保持日常表象自然自洽；原稿无暗线时不凭空塞入秘密。',
          '4. 具象举例提炼脑回路：先提炼底层思维规律；保留简短示例时括注仅作理解思维参考、日常随情境反应不复刻原例。',
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
          '玩家指定的保留设定与修改要求优先级最高；精简琐碎的吃穿喜好，不把细节写成每轮必提，顺着人物性格自然保留直白表露或内敛少提的状态，不锁死旁人能否猜中。',
      },
      {
        id: 'pr_banned',
        name: '套话与系统口号清洗',
        slotType: 'banned',
        role: 'system',
        enabled: true,
        locked: false,
        content:
          '彻底洗去原稿混入的系统命令口号（如禁止NPC读心）、悬浮玛丽苏自夸、“看似…实则…”空话及固定重复微动作。',
      },
      {
        id: 'pr_pacing',
        name: '字数预算与重心分配',
        slotType: 'pacing',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '重构全文目标约 {{targetChars}} 字（硬性区间 {{targetCharsMin}}～{{targetCharsMax}} 汉字，约 {{targetMin}}～{{targetMax}} tokens），必须达到 {{targetCharsMin}} 字下限且不超出 {{targetCharsMax}} 字上限：',
          `- ${CORE_SECTION_HEADER}：保留外貌声音、性格神韵与思维规律、适度收束的生活习惯及成长经历；`,
          `- ${SHELL_SECTION_HEADER}：聚焦当前故事下的身份日常、与 {{char}} 的现阶段关系与开场氛围。`,
        ].join('\n'),
      },
      {
        id: 'pr_format',
        name: '清爽版式与标点规范',
        slotType: 'format',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          `归入 ${CORE_SECTION_HEADER} 与 ${SHELL_SECTION_HEADER} 两个一级标题配简洁二级小标题（## 板块名），只写有效字段不留空壳，禁嵌套缩进、XML、代码块或修改总结。`,
          '全文不使用破折号连接分句，并将原稿泛滥的破折号顺手整理为逗号、冒号或短句。',
        ].join('\n'),
      },
      {
        id: 'synced_worldbook',
        name: '补充世界书拆分规范',
        slotType: 'worldbook',
        role: 'system',
        enabled: false,
        locked: false,
        content: [
          '【补充世界书拆分规范】',
          `请将主档案正文精简至约 650～950 字并放在上半部分；随后另起一行输出分隔标题 \`${WORLDBOOK_DIVIDER}\`，在下方拆出 2～4 条补充背景条目，严格按 [条目：条目标题] / 触发方式： / 关键词： / 内容： 格式输出。`,
        ].join('\n'),
      },
      {
        id: 'draft_audit_entry',
        name: '成稿前草稿自检',
        slotType: 'draft_audit',
        role: 'system',
        enabled: true,
        locked: false,
        content: [
          '【成稿前草稿自检】',
          `输出正文前，先在顶部用唯一一个 \`${DRAFT_START_MARKER}\` 与 \`${DRAFT_END_MARKER}\` 包裹简短核对（控制在 120 字内）：核对原稿保留项、当前故事语境融合与无套话破折号。`,
          `闭合 \`${DRAFT_END_MARKER}\` 后换一行直接从 \`${CORE_SECTION_HEADER}\` 输出干净正文。`,
        ].join('\n'),
      },
    ],
  },
});
