# 食堂夯榜

上海出版印刷高等专科学校食堂评价站。学生可以按一楼、二楼、三楼浏览饭评，上传食物照片，使用“夯 / 顶 / 还行 / 一般 / 拉”评价，并参与点赞和评论。

## 当前能力

- 手机优先的校园榜单风界面
- 楼层、等级筛选与最新、最热排序
- 图片压缩为 WebP，最长边 1600px，输入限制 5MB
- Supabase 匿名身份、私有图片存储、RLS 权限
- 评价和评论审核后公开
- 每位用户对每条评价最多一个点赞
- Hash 评价详情链接，兼容 GitHub Pages
- 未配置 Supabase 时自动进入演示模式

## 本地运行

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:4173`。

## 配置 Supabase

1. 在 [Supabase](https://supabase.com/) 创建项目。
2. 按文件名顺序执行 `supabase/migrations/` 下的全部 SQL 迁移。
4. 打开 `Authentication > Providers > Anonymous Sign-Ins`，启用匿名登录。
5. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 Publishable/Anon Key。
6. 绝对不要把 `service_role` 密钥放进 `.env`、GitHub 或浏览器代码。

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY
```

如果暂时不配置 Turnstile，开发环境仍可运行；公开上线前建议完成下一节。

## 配置防刷验证

1. 在 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) 新建站点。
2. 生产组件添加你的 `github.io` 域名；本地开发使用 Cloudflare 官方测试密钥。
3. 将 Site Key 写入 `VITE_TURNSTILE_SITE_KEY`。
4. 在 Supabase 打开：
   `Authentication > Bot and Abuse Protection > Enable CAPTCHA protection`
5. 选择 Cloudflare Turnstile，并填写 Secret Key。

Secret Key 只填写在 Supabase 控制台，不能写进前端项目。

## 审核内容

首版直接使用 Supabase 控制台：

1. 打开 `Table Editor > reviews`。
2. 检查 `pending` 投稿的文字和对应图片。
3. 将合格内容的 `status` 改为 `approved`，不合格改为 `rejected`。
4. 评论在 `Table Editor > comments` 中使用同样流程。

图片桶 `food-photos` 是私有桶，网站只为已通过审核的图片生成短期签名链接。

数据库同时限制每个匿名用户每小时最多提交5条饭评、15条评论，并阻止秒级连续发布。

详细操作见 [审核指南](docs/moderation-guide.md)。

## 部署到 GitHub Pages

1. 创建 GitHub 仓库并推送到 `main` 分支。
2. 在仓库 `Settings > Secrets and variables > Actions` 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TURNSTILE_SITE_KEY`
3. 在 `Settings > Pages > Source` 选择 `GitHub Actions`。
4. 推送后，`.github/workflows/deploy.yml` 会自动测试、构建和发布。

## 验证

```powershell
npm test
npm run build
```

第一轮试用建议邀请 10 位同学，记录：

- 是否能快速理解五档评分
- 是否愿意上传真实照片
- 最常用的楼层和排序
- 投稿和评论的失败原因
- 是否有人试图发布人脸、广告或攻击性内容

可以直接使用 [10人试运营清单](docs/pilot-checklist.md)。
