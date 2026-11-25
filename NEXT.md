# NEXT — user-persona-studio 交接文档

## 1. 当前目标与范围
- 项目目标：独立可公开发布的 SillyTavern / TauriTavern 扩展「客制化成长型 User 人设工坊」（`https://github.com/Mio-Ame/user-persona-studio`）。
- 当前状态：已完成 **`v1.3.0`（`dev` 分支）** 全面重构与提示词精炼打磨：
  1. **修复酒馆人设读取为空 + 全局醒目反馈**：修正 `SillyTavern.getContext().powerUserSettings` 字段对齐并补齐 `#persona_description` 实时 DOM 兜底；新增顶部浮动提示 `.ups-toast` 与语义着色底栏，顶栏「↻ 刷新」零变动亦有明确反馈。
  2. **三套精炼单职责预设 + 去反差/去极端模板化 + 防破折号增殖**：内置 `适合抢话党`、`适合不抢话党`、`旧人设改写与跨卡重构`（支持修改、`★` 置顶排序与一键「还原默认」）；消除跨条目车轱辘话重复与破折号（`——`），忠于人物本色落地（表里如一或分场合反差均自然成立，不硬套“外人面前维持体面”或“旁人必定全知/必定猜错”等极端模板），默认平实中文不强制行首可见度方括号。
  3. **代入党防套皮 + 防打卡疲劳 + 稳埋伏笔 + 防照抄示例 + 精炼自检草稿**：新增 `BACKSTORY_MODES`（轻底色不编身世 / 纯留白零编造 / 补全成长经历）与 `SPOTLIGHT_MODES`（日常自然融入 / 围绕设定展开 / 轻盈纯日常）；新增「例如/比如」复演风险检测与一键「+ 附上防照抄说明」、破折号过多检测与一键「清理破折号」；支持 `【草稿自检】...【/草稿自检】` 自动剥离查看及导出酒馆隐藏草稿正则。
  4. **原创人设专属避雷词包 + 省 Token 发送策略 + 固定高度防撑高**：4 类 45 条原创人设避雷词默认折叠可按类开关，支持 3 档 `bannedSendMode`（精简省 Token / 仅个人禁写 / 完整词包），个人词库限高 `210px` 内部滚动。
  5. **完整通过 `AGENTS.md` 十项 UI 与交互必检门禁**：升级「纸墨浅白」等 6 套四层实底区分度，锁定 `scrollbar-gutter: stable` 消除新建/改写切页宽度弹跳；8 向隐藏热区支持 `100dvh` 全高缩放且锁死 `top/left` 零回弹（无鸡肋小窗按钮与角标）；非阻塞可拖拽子浮窗；`@container` 响应式行按钮与展开态拖拽调序；捕获阶段点击宿主外部自动收起浮层 + 冒泡拦截保护 `.openDrawer`。

## 2. 已完成与改动文件
- `src/presets.js` / `src/core.js`：精炼重构 3 套内置预设、4 类原创避雷包、`BACKSTORY_MODES`、`SPOTLIGHT_MODES`、`bannedSendMode`、`hasReplayRiskExamples` / `appendAntiParrotClause`、`replaceEmDashes` 与 `buildDraftAuditInstruction`。
- `src/host.js` / `src/api.js`：修复 `powerUserSettings` 与实时 DOM 人设兜底读取写入，新增草稿自检 `minMaxTokens` 余量保护。
- `src/styles.js` / `src/ui.js`：四层高辨识度配色、精简双栏工作台、收口底栏、拖选自动展开偏好栏、8 向全高无回弹缩放、非阻塞子浮窗、正文优先可拖拽手风琴与防溢出样式。
- `index.js` / `manifest.json` / `package.json`：版本号升级至 `1.3.0`。
- `tests/core.test.js` / `tests/host-api.test.js` / `tests/ui-entry.test.js`：107 项单元测试全部通过，并通过 5 视口无头浏览器 CDP 实测与十项静态门禁扫描。
- `README.md` / `NEXT.md`：同步更新文档与交接说明。

## 3. 绝对不能碰的红线/已确认偏好
- 严禁因去标签或防全知而滑向另一种刻板模板（如强行给清冷/高冷/娇气加反差，或强行规定旁人必猜错喜好）；严禁跨条目车轱辘话重复；预设提示词禁用破折号（`——`）防模型模仿增殖。
- 100% 原创与脱敏：零第三方或兄弟插件/预设/作者名称；零 `backdrop-filter` / `blur()`；全输入框 `spellcheck="false"`；移动端零自动 `.focus()`。

## 4. 已知坑与未解决阻塞
- `v1.3.0` 已推送至 `https://github.com/Mio-Ame/user-persona-studio`（`dev` 分支），无未解决阻塞，待用户真机体验确认。

## 5. 下一步最小动作
1. 用户在酒馆扩展面板更新 `user-persona-studio`（`dev` 分支）验证新版双栏区分度、人设读取提取、经历留白/伏笔防打卡及精炼预设生成效果。
2. 确认满意后合入 `main` 正式分支。
