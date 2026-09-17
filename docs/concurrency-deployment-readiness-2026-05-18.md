# 并发与部署上线复盘 - 2026-05-18

本文记录本轮围绕并发安全、Redis 共享限流、Docker 部署和上线门禁的交付状态。目标是让上线前的检查有明确依据，避免只凭记忆判断是否已经覆盖关键风险。

## 本轮已完成

### 共享限流与 Redis

- 登录、注册、刷新令牌、管理员创建用户等认证入口已改为异步限流。
- 默认仍支持单实例内存限流。
- 当 `RATE_LIMIT_STORE=redis` 时，限流状态写入 Redis，适用于多实例部署。
- Redis 限流使用原子脚本完成计数和过期时间设置，避免并发请求绕过阈值。
- Redis 不可用时，认证限流路径返回 503，避免限流静默失效。
- `/api/v1/ops/ready` 已暴露限流 readiness，能够看到当前限流是否为共享 Redis 模式。

### 并发写入保护

- 购物车、下单幂等、Mock/Special 会话、管理员编辑版本检查等已有并发保护继续保留。
- 管理员用户状态变更增加事务级 advisory lock，防止并发禁用最后一个可用管理员。
- 学校对比列表增加按用户维度的 advisory lock，防止并发添加突破最多 4 个学校的限制。
- 管理后台内容、院校、奖学金等资源继续通过版本号处理过期编辑。

### Docker 与部署

- 本地 `docker-compose.yml` 已加入 Redis 服务，便于本地按真实 Redis 限流路径测试。
- 生产 compose `deploy/docker-compose.prod.yml` 已加入 Redis 服务，并将 backend 默认配置为 Redis 共享限流。
- backend 启动依赖 Redis 健康检查，降低应用先于 Redis 就绪导致启动异常的概率。
- 生产 Nginx 配置已改为使用 Docker DNS 动态解析 backend，避免容器重建后缓存旧 IP 导致 502。

### 发布门禁

- 已新增 `npm run verify:release-concurrency`，聚合并发相关烟测。
- `npm run verify:release-candidate` 已接入并发门禁，发布候选检查会覆盖并发烟测。
- 运行手册和发布清单已补充 Redis、Docker、并发门禁和 readiness 检查要求。

## 已通过验证

本轮已验证通过以下命令或场景：

- `npm run backend:build`
- `npm --prefix backend run test:security`
- Redis 协议 stub 限流烟测
- 本地 Docker Redis `redis-cli ping`，结果为 `PONG`
- 使用真实 Redis 的限流烟测
- `docker compose config`
- `docker compose -f deploy/docker-compose.prod.yml config`
- `DOCKER_STAGING_BUILD=true npm run verify:docker:staging-local`
- `npm run verify:concurrency`
- `npm run verify:admin-concurrency`
- `npm run verify:release-concurrency`
- `npm run verify:ops`

本地 staging compose 验证中，`/api/v1/ops/ready` 已确认返回 Redis 共享限流状态：

```json
{
  "store": "redis",
  "shared": true,
  "configured": true
}
```

## 剩余上线前门禁

以下项目还需要在正式发版前跑完或确认：

- 完整执行 `npm run verify:release-candidate`。
- 如有真实 staging 环境，执行 `npm run verify:staging:full`，并确认 staging URL、健康检查和认证路径正常。
- 确认数据库迁移 `0018` 到 `0021` 已在目标环境按顺序执行。
- 确认生产环境 `RATE_LIMIT_STORE=redis`，且 `RATE_LIMIT_REDIS_URL` 指向容器网络或生产 Redis 地址，不要误用本机 `localhost`。
- 确认生产 `/api/v1/ops/ready` 中 `rateLimit.shared=true`。
- 确认发布证据归档，包括构建日志、Docker 验证日志、迁移日志、staging smoke 结果和回滚预案。

## 风险评估

### Redis 是否必须

单实例部署时，内存限流可以工作，但它只保护当前进程。多实例部署时必须使用 Redis 或同等级共享存储，否则攻击者可以通过负载均衡分散请求，绕过单实例限流阈值。

本轮方案将 Redis 作为生产 compose 的默认限流存储，判断是合理的。它不保存业务状态，只保存短期限流计数，因此 bundled compose 中关闭持久化是可接受的。

### Redis 故障影响

当启用 Redis 限流后，Redis 不可用会导致认证限流路径返回 503。这个选择偏保守：相比 Redis 故障时放开登录、注册、刷新令牌等高风险入口，短暂拒绝认证请求更安全。

上线前需要确认监控能覆盖：

- Redis 健康状态。
- backend readiness 的 `rateLimit` 字段。
- 认证接口 503 增长。

### Docker 网络风险

本轮已修复 Nginx 对 backend 容器旧 IP 的缓存问题。若生产环境使用自定义 Nginx 配置，需要同步 `resolver 127.0.0.11` 和变量式 `proxy_pass` 的写法，否则容器重建后仍可能出现 502。

### 并发锁风险

新增 advisory lock 的范围较小：

- 管理员状态变更按固定命名空间加锁，只覆盖最后管理员保护场景。
- 学校对比列表按用户维度加锁，只串行化同一用户的对比列表写入。

这两个锁不会把全站写入串行化，性能风险较低。主要风险是后续新增相似写入路径时忘记复用相同约束和测试，因此需要在评审中关注同类资源是否有并发上限或最后可用实体保护。

## 当前本地环境状态

- 本地 compose Redis 已启动，可用于继续测试。
- `verify:docker:staging-local` 会保留 `cscalite-verify` staging 栈，便于继续检查容器状态。
- 如需停止本地 Redis，可运行 `docker compose stop redis`。
- 如需停止本地 staging 栈，可运行 `docker compose -p cscalite-verify -f deploy/docker-compose.prod.yml down`。

## 发布建议

当前方案可以继续进入发布候选验证阶段。建议下一步直接跑完整发布候选门禁：

```powershell
npm run verify:release-candidate
```

如果该门禁通过，再进入 staging 验证和上线前证据归档；如果失败，优先修复失败项，不要绕过并发、Docker 或 Redis readiness 检查。
