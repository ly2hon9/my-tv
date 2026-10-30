# 拾光影视 AURORA 3.20.2 · 优化稳定版

本包在你上传的 **3.20.1 模块化版**上做了小范围优化。保留原有外观、直播横向分类、直播页内频道搜索、影视聚合搜索、播放器、选集、收藏、历史、账号权限、D1 推荐与定时同步。

## 本次改动

1. **静态缓存可控**：`index.html` 采用重新验证缓存；CSS/JS 采用 7 天浏览器缓存，并由页面引用的内容指纹版本号保证修改后获取新文件（针对 Safari 旧样式/旧脚本残留）。版本号跟随文件内容计算，不是固定写死的时间戳。
2. **按需加载 HLS.js**：iPhone/iPad Safari 能原生播放 HLS 时，不再预先下载额外的 HLS.js。非原生 HLS 浏览器首次播放时异步加载，后续播放复用；若 CDN 失败会提示，仍可改用外部播放器。
3. **D1 批量读取加固**：沿用 3.20.1 的合并请求，新增无效键拦截、去重和单次最多 48 个键的上限，保留原有账号权限过滤。
4. **模块与备份一致**：`index.standalone.html` 从同一份 CSS/JS 自动生成；不额外维护分叉代码。
5. **检查更全面**：Node.js 语法检查覆盖独立 JS 和后端模块，并新增 D1 批量读取边界测试。

## 部署（推荐：模块化版）

将压缩包解压后**所有项目文件与文件夹**按原目录结构上传至 GitHub `my-tv` 仓库根目录。至少需要一起更新：

- `index.html`
- `css/aurora.css`
- `js/app.js`
- `_headers`
- `functions/api/data.js`

原有的 `functions/api/auth.js`、`functions/api/recommendations.js`、`schema.sql`、定时同步 Worker 配置和 D1 数据无需更改。`tests/`、`README.md` 等可以随包保留，它们不会作为网页主动执行。

**不要只上传模块化的 `index.html`**，否则样式和业务脚本可能引用不到。**不要把 `index.standalone.html` 改名为 `index.html` 后又同时保留模块化入口作为生产主页**，二选一即可。

### 备用：单 HTML 方式

如果暂时坚持使用一个 HTML 文件：把 `index.standalone.html` 改名为 `index.html` 上传，同时更新 `functions/api/data.js`；此方式不会享有拆分后的 CSS/JS 独立缓存。

## 运行检查

项目根目录执行：

```bash
npm test
```

首次上线建议核对：登录 → 首页推荐 → 影视搜索/选集 → 直播横向分类 → 直播页搜索湖南卫视 → 选线路播放 → 离开栏目断流 → 收藏/历史 → 设置 → 手机 Safari 播放。

## 回退

先备份原来的 3.20.1 ZIP。发现异常时，按同样目录结构恢复旧的 `index.html`、`css/`、`js/`、`_headers`、`functions/api/data.js`。本次不涉及 D1 表结构升级或数据迁移。

## 真实性说明

优化能减少 Safari 首次访问时不必要的 HLS 脚本下载，并改善静态资源二次加载；实际首屏提速幅度取决于网络、Cloudflare 缓存、海报图片和用户设备，**不保证固定的 50%～70% 提速**。本地测试不是 iPhone 真机与线上视频源的替代。
