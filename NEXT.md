# NEXT — user-persona-studio 交接文档

## 1. 当前目标与范围
- 项目目标：独立可发布的 SillyTavern / TauriTavern 扩展「客制化成长型 User 人设工坊」，提供新建直出与旧人设重构双引擎、模块化预设条目栈、末尾消息角色/预填充策略、个人审美成长库、酒馆原生预设导出、自定义多方案 API 以及四态自适应非阻塞悬浮工作窗。
- 当前状态：核心引擎、宿主与传输适配层、Shadow DOM 四态交互界面、96 项单元测试、157 项 Tiers 1–4 E2E、Chrome/Edge 四态浏览器 CDP 实测、Tier 5 对抗加固及静态原创性/安全审计均已全部通过；独立 Git 仓库已初始化于 `dev` 分支并完成首次提交，进入真机冒烟验收阶段。

## 2. 已完成与改动文件
- `manifest.json` / `package.json` / `.gitignore`：插件元数据、`node --test` 运行配置与仓库忽略规则。
- `src/presets.js` / `src/core.js`：原创内置流派方案、20 条初始套话禁词、16 类定性标签检测、Mode A/B 组装、末尾角色策略、原生 ST 预设导出、双层拆分、Diff 与局部重生成、审美库去重、自定义 API 校验与 SSE 解析。
- `src/host.js` / `src/api.js`：SillyTavern / TauriTavern 原生人设读写与头像上传、世界书写入与绑定、`ups:persona-saved` 事件派发、宿主生成与自定义 API 请求转发、密钥脱敏。
- `style.css` / `src/styles.js` / `src/ui.js` / `index.js`：宿主入口样式、6 套不透明配色、Shadow DOM 四态响应式工作窗（`pointer-events: none` 外层、冒泡拦截防误关抽屉、拖动缩放、挂起胶囊、小窗对照、4 页签全流程绑定）、斜杠命令 `/ups` 与生命周期清理。
- `tests/core.test.js` / `tests/host-api.test.js` / `tests/ui-entry.test.js`：`node --test` 单元测试 96/96 全部通过；Tiers 1–4 E2E 157/157、Chrome/Edge 四态浏览器 CDP 与 Tier 5 对抗加固全部通过；静态原创性与安全审计 0 违规。
- `README.md` / `NEXT.md`：用户说明文档与交接文档。

## 3. 绝对不能碰的红线/已确认偏好
- 100% 原创与脱敏：严禁引入任何第三方插件、预设、主题、作者名或真实角色卡内容；严禁出现本地文件系统路径或示例密钥；严禁提供外部预设导入或转换功能。
- 严格 XSS 防护：`.js` 文件禁止使用非空 `.innerHTML`、`.outerHTML`、`.insertAdjacentHTML`、`document.write`、`eval`、`new Function` 或内联事件属性。
- 体验底线：保持顶栏、页签栏与底栏常驻固定（切页/搜索/展开不跳动）；不透明实底配色；外层容器不阻塞底层聊天滚动与点击；冒泡阻断防止误关未钉住抽屉；全部输入框禁用 `spellcheck`；移动端打开禁止自动聚焦弹软键盘。
- 宿主兼容：SillyTavern `eventSource` 仅提供 `removeListener`，清理监听器时优先调用 `removeListener` 再回退 `off`。

## 4. 已知坑与未解决阻塞
- 独立 Git 仓库已关联公开远程仓库 `https://github.com/Mio-Ame/user-persona-studio` 并推送 `dev` 分支，临时验证产物已清理。
- 真实 SillyTavern / TauriTavern 宿主环境（含 iOS WKWebView）下的在线生成、原生预设导出导入及真机排版表现，尚待通过 `dev` 分支完成真机冒烟实测确认。

## 5. 下一步最小动作
1. 在真实 SillyTavern / TauriTavern（覆盖桌面端与 iOS WKWebView）通过 `https://github.com/Mio-Ame/user-persona-studio`（`dev` 分支）拉取安装，完成 Mode A/B 生成、旧人设重构、双层世界书绑定、原生预设导出、自定义 API 连通与 `ups:persona-saved` 事件联动冒烟实测。
2. 真机实测确认无误后，将 `dev` 分支合并推送至 `main` 正式版。
