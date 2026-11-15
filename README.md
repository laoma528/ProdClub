# ProdClub 品牌官网

本分支 codex/prodclub-vip 独立维护静态品牌站，禁止整体合并至 main。

正式官网：[prodclub.vip](https://prodclub.vip/)。向本分支推送已检查的变更后，由 Cloudflare Pages 自动更新；`main` 继续维护原教程站。

本地预览：`python -m http.server 8766 --bind 127.0.0.1 --directory docs`

HTML、本地CSS、原生JavaScript；无构建依赖。品牌站使用 Cloudflare Pages 自动发布，生产分支为 `codex/prodclub-vip`，输出目录为 `docs/`。购买与交付入口：https://prodclub.ai/r/NJJU47?src=pcvip

新版首页排版参考[岩序演示站](https://qeilgbv8nuy6.site.creght.cn/)，以独立 HTML/CSS 实现左右首屏、优势卡、步骤导航、客户标识条、评价墙、三档套餐与折叠问答。UI 采用 ProdClub 的深绿墨色、绿色强调、灰白底、胶囊按钮与细边框微阴影。其他现有内容页面保留网址，同步共用品牌组件。旧模板已有 MIT 许可继续保留在 `docs/assets/template-license.txt`。

字体自托管：Inter Variable Latin 4.001 与基于 LXGW 真楷 GB v0.825 的中文标题子集。中文子集使用独立名称 ProdClub ZhenKai；两份 OFL 许可随字体保留于 `docs/assets/fonts/`。新增中文标题时需同步字体覆盖，不能只修改字体名称来替代实际文件。

首页保留 Plus、Pro100、Pro200，仅比较代充条件，不扩写官方套餐权益；取消周期切换。当前代充价格分别为 ¥149、¥709、¥1379，所有“立即充值”按钮采用品牌官网专用完整入口。客户 Logo 由维护者提供，已裁切、统一为品牌绿色并转为透明 WebP；评价文字与署名由维护者提供，头像为 [DiceBear Open Peeps](https://www.dicebear.com/styles/open-peeps/) 的 CC0 示意插画，不代表评价者本人。英文入口保留但尚未启用。本站不新增账号、付款或 Session 提交表单。

首屏和三步流程使用维护者提供、并确认已脱敏的充值站截图，按原内容精确裁切，不重新绘制或遮盖；截图画面中的金额不作为本站现价。四图支持点击放大，手机保持自然比例。可见文字统一称充值站。卡片轻抬、按钮扫色、文字渐入、缓动进度线、评价列交替滚动及首屏鼠标跟随在共享 `motion.css` 与 `site.js` 中实现，系统减少动态效果时保持静态内容可读。手机和平板的 Logo 与评价停止自动滚动，可左右滑动查看全部内容；桌面悬停或键盘聚焦时暂停滚动，不显示单独的暂停按钮。

套餐周期、续费及独立客服渠道以当次商品和订单说明为准。品牌站使用 GA4 免费版单独统计访问、来源和购买按钮点击，与原教程站区分；`service_click` 只是导流点击，不代表付款或订单。统计会使用第一方 Cookie 区分访客和会话，仅在 `prodclub.vip` 正式域启用，本地及部署预览不启用。

`docs/assets/analytics.js` 接收本地点击事件；发送规范页面地址前去掉查询参数与片段，不发送 Session、密码、邮箱或订单资料。相关说明见隐私页。

Cloudflare 构建命令为 `python scripts/check-public-files.py --revision HEAD && python scripts/check-referral-links.py`，检查失败时停止发布；非生产分支暂不自动部署。正式网址采用 Cloudflare 的无扩展名路径，本地预览仍可通过对应 `.html` 文件访问。

IndexNow 使用为品牌站新生成的独立公开验证密钥，不复用旧站密钥。先发布验证文件，确认其 URL 可直接访问，再校验和提交 sitemap 中的规范网址；以下是操作命令，不代表已经完成提交：

```powershell
python scripts/seo-geo/submit-indexnow.py --sitemap --dry-run
python scripts/seo-geo/submit-indexnow.py --sitemap
```

以后可将变更网址作为参数单独提交。新增或轮换密钥时，同步验证文件的文件名与内容、脚本中的 `KEY_FILE`、`.public-files` 和 `.gitignore` 的逐项规则；发布后再提交。IndexNow 返回 200 或 202 只表示请求已收到，不保证收录。

根路径 `llms.txt` 提供品牌与服务页面内容索引；它是辅助约定，不替代 robots、站点地图或实际索引验收。内容日期取自真实 Git 正文变更，继续用于 README 与站点地图；品牌官网页面不再显示末尾日期。当前总价、周期、续费与客服信息请通过原商品及订单页面查看。

<!-- content-updated:start -->
内容更新：2026年11月15日
<!-- content-updated:end -->
