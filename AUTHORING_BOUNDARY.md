# Authoring 控制面边界

## 独立入口

- 学生端：`/index.html` 或本地化 Agent 路径；
- 内容生产端：`/authoring.html`；
- 两个入口由 Vite 分别构建，学生入口不导入 AuthoringApp。

## 第一阶段工作区

- 题目生产、审核与发布；
- 教学资产创建、预览、审核、发布与效果观察。

用户、机构、商城、支付、公开内容和旧训练后台不属于 Authoring 第一阶段。

## 权限

- 前端只向 `role=admin` 展示工作区；
- 未登录用户在 Authoring 入口内完成登录；
- 非管理员只能看到拒绝页，不能加载工作区；
- 服务端题目与教学资产接口继续使用 `RequiredAdminGuard`，前端权限不作为安全边界。

## 导航与发布

- Authoring 使用独立精简导航，不恢复 CSCALite 通用后台路由；
- 两个工作区按需加载；
- 生产环境可将 `authoring.html` 放在独立域名或受 VPN/Zero Trust 保护的路径，API 权限规则保持不变。
