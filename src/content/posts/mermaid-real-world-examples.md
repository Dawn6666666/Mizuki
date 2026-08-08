---
title: "Mermaid 真实文章示例汇总"
published: 2026-08-08
description: "从 MyBlog-Content 真实文章中提取的 Mermaid 图表，用于验证静态 SVG 渲染。"
tags: [Mermaid, Markdown, Testing]
category: Examples
draft: false
---

# Mermaid 真实文章示例汇总

本文集中展示从 `MyBlog-Content/posts` 中提取的 45 个真实 Mermaid 图表。图表源码保持不变，并按原文章分组，便于集中检查静态 SVG 的布局、字体、标签和主题效果。

## 博客国内外双节点部署与全链路架构解耦

来源：`blog-dual-region/index.md`

### 图 1

```mermaid
gantt
    title 博客双节点部署改造时间线 (2026-05-19)
    dateFormat  YYYY-MM-DD HH:mm
    axisFormat  %H:%M

    section 音乐子域解耦迁移
    R2 自定义域名绑定           :done, r2-1, 2026-05-19 13:45, 13m
    代码中音乐链接全量替换       :done, r2-2, 2026-05-19 13:59, 5m
    CORS 策略配置与验证          :done, r2-3, 2026-05-19 14:04, 2m

    section CI/CD 改造
    双端部署 Workflow 编写调试   :done, ci-3, 2026-05-19 14:05, 45m
    生成免密 SSH 密钥对          :done, ci-1, 2026-05-19 14:09, 35m
    GitHub Secrets 配置          :done, ci-2, 2026-05-19 14:44, 4m

    section 海外服务器
    Nginx 安装与站点配置         :done, os-1, 2026-05-19 14:25, 3m
    iptables + OCI 防火墙放行    :done, os-3, 2026-05-19 15:02, 53m
    Certbot SSL 证书签发         :done, os-2, 2026-05-19 15:49, 3m

    section DNS 迁移
    域名迁回阿里云 DNS           :done, dns-1, 2026-05-19 15:06, 9m
    分线路智能解析配置           :done, dns-2, 2026-05-19 15:15, 28m

    section 国内服务器优化
    Nginx 配置审计与整理         :done, cn-2, 2026-05-19 15:56, 15m
    TLSv1.1 协议移除             :done, cn-1, 2026-05-19 16:08, 2m

    section 验证与文档
    全链路连通性测试             :done, verify-1, 2026-05-19 14:50, 65m
    撰写部署文档与博客           :done, verify-2, 2026-05-19 16:13, 12m
```

### 图 2

```mermaid
flowchart TD
  %% 流量流向
  User[用户访问 dawn114514.site] --> DNS{Alibaba Cloud DNS <br>智能分流}

  %% 国内分流
  DNS -->|中国内地/默认| CN_Node[国内 ECS 服务器 <br>IP: xxx.xxx.xxx.xxx]
  CN_Node --> CN_Nginx[Nginx + SSL <br>主站目录: /www/wwwroot/MyBlog]
  CN_Nginx --> CN_Subs[子系统反代 <br>自建服务 A / 自建服务 B]

  %% 海外分流
  DNS -->|中国境外| OV_Node[海外 Oracle 服务器 <br>IP: yyy.yyy.yyy.yyy]
  OV_Node --> OV_Nginx[Nginx + SSL <br>主站目录: /www/wwwroot/MyBlog]

  %% 静态资源解耦（浏览器直连 R2，不经 Nginx 中转）
  Browser[浏览器] -.->|直接请求外链| R2_Music[music.xxx.online <br>Cloudflare R2 音乐源]
  Browser -.->|直接请求外链| R2_Img[img.xxx.online <br>Cloudflare R2 图床]
  CN_Nginx -.->|HTML 引用外链 URL| Browser
  OV_Nginx -.->|HTML 引用外链 URL| Browser

  %% 自动化持续集成管线（内容/代码双仓库解耦联动）
  Developer[开发者 git push] --> ContentRepo[内容仓库 MyBlog-Content]
  ContentRepo -->|push main 触发 trigger-build.yml| Dispatch[repository-dispatch 事件 content-updated]
  Dispatch -->|DISPATCH_TOKEN 鉴权分发| CodeRepo[代码仓库 MyBlog deploy.yml]
  CodeRepo -->|浅克隆内容仓库并复制目录 + pnpm build| Build[GitHub Actions 构建管线]
  Build -->|rsync 同步 后台并行 &| CN_Node
  Build -->|rsync 同步 后台并行 &| OV_Node
```

### 图 3

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant CR as 内容仓库 MyBlog-Content
    participant TR as trigger-build.yml
    participant DR as 代码仓库 deploy.yml
    participant CI as Actions Runner
    participant CN as 国内 ECS (Aliyun)
    participant OS as 海外 Oracle

    Dev->>CR: git push main (改动 posts/data 等)
    CR->>TR: 触发 trigger-build.yml
    TR->>DR: repository-dispatch 发送 content-updated 事件
    Note over TR,DR: 携带 DISPATCH_TOKEN 鉴权
    DR->>CI: 触发 deploy.yml 工作流
    CI->>CI: checkout + setup pnpm/node 22 + 恢复 Astro 缓存
    CI->>CI: pnpm install --frozen-lockfile
    CI->>CI: pnpm run sync-content (浅克隆内容仓库并复制目录, 失败即标红)
    CI->>CI: pnpm run build (注入 BILI_SESSDATA / UMAMI_SHARE_URL 等构建期密钥)
    Note over CI: 构建产物生成于 dist/ 目录

    par 后台并行部署到国内
        CI->>CI: 写入 DEPLOY_SSH_KEY_CN
        CI->>CN: ssh-keyscan 写入 known_hosts (每次扫描直接信任, 非核验指纹)
        CI->>CN: mkdir -p /www/wwwroot/MyBlog/dist
        CI->>CN: rsync -az --delete dist/
        CN-->>CI: 同步完成
    and 后台并行部署到海外
        CI->>CI: 写入 DEPLOY_SSH_KEY_OVERSEA
        CI->>OS: ssh-keyscan 写入 known_hosts (每次扫描直接信任, 非核验指纹)
        CI->>OS: mkdir -p /www/wwwroot/MyBlog/dist
        CI->>OS: rsync -az --delete dist/
        OS-->>CI: 同步完成
    end

    Note over CI: wait 聚合双端后台进程退出码
```

## 搭建“黎明の鸡窝”

来源：`komari-monitor/index.md`

### 图 1

```mermaid
gantt
    title Komari 监控部署时间线 (2026-05-23)
    dateFormat  YYYY-MM-DD HH:mm
    axisFormat  %H:%M

    section 面板准备
    服务器资源与端口检查         :done, p1, 2026-05-23 18:03, 8m
    Docker 与 Compose 安装       :done, p2, 2026-05-23 18:13, 4m
    Komari 容器部署              :done, p3, 2026-05-23 18:17, 3m

    section HTTPS 暴露
    子域名 DNS 解析              :done, n1, 2026-05-23 18:18, 1m
    Nginx 反代配置               :done, n2, 2026-05-23 18:19, 2m
    Certbot 证书签发             :done, n3, 2026-05-23 18:19, 2m

    section Agent 接入
    自动发现批量注册             :done, a1, 2026-05-23 18:27, 3m
    修复 AD Key JSON 格式         :done, a2, 2026-05-23 18:28, 2m
    固定 token 启动              :done, a3, 2026-05-23 18:35, 3m
    新增额外云服务器             :done, a4, 2026-05-23 18:40, 6m

    section 收尾
    清空自动发现 Key             :done, s1, 2026-05-23 18:44, 1m
    本地文档记录                 :done, s2, 2026-05-23 18:50, 8m
```

### 图 2

```mermaid
flowchart TD
  User[浏览器访问 monitor.example.com] --> DNS[DNS A 记录]
  DNS --> Nginx[Nginx 443 / HTTPS]
  Nginx --> Komari[Komari 容器<br>127.0.0.1:25774]
  Komari --> DB[(SQLite<br>/opt/komari/data)]

  NodeA[Node A Agent] -->|HTTPS + token| Nginx
  NodeB[Node B Agent] -->|HTTPS + token| Nginx
  NodeC[Node C Agent] -->|HTTPS + token| Nginx
  NodeD[Node D Agent] -->|HTTPS + token| Nginx
  NodeE[Node E Agent] -->|HTTPS + token| Nginx
```

## 用 Restic 备份本地却在疯狂吃磁盘？

来源：`restic-disk-cleanup/index.md`

### 图 1

```mermaid
flowchart TD
    subgraph S3_Cloud ["云端存储 (DigitalOcean Spaces)"]
        DO_Spaces["DO Spaces S3 仓库"]
    end

    subgraph Internal_Servers ["五台服务器"]
        S1["Server 1<br>qq-bot-core / qq-bot-api"]
        S2["Server 2<br>my-blog / status-monitor"]
        S3["Server 3<br>qq-bot"]
        S4["Server 4<br>api-hub / llm-api / cli-proxy"]
        S5["Server 5<br>阿里云博客国内节点"]
    end

    S1 <--> S3

    S1 & S2 & S5 --> DO_Spaces
    S3 -- "2.6G SQLite快照 (去重增量)" --> DO_Spaces
    S4 -- "pg_dumpall (增量)" --> DO_Spaces

    TG_Bot["Telegram 报警机器人"]
    S1 & S3 & S4 --> TG_Bot
    S2 -- "直连/代理中继通知" --> TG_Bot
    S5 -- "SSH 隧道中继" --> S2
```

## “如果今天服务器炸了怎么办？”

来源：`restic-spaces-backup/index.md`

### 图 1

```mermaid
flowchart TD
  subgraph Servers[五台服务器]
    S1[Server 1<br>qq-bot-core / qq-bot-api]
    S2[Server 2<br>my-blog / status-monitor 面板]
    S3[Server 3<br>qq-bot]
    S4[Server 4<br>api-hub / llm-api / qq-bot-api / cli-proxy]
    S5[Server 5<br>阿里云博客国内节点 / 宝塔 Nginx]
  end

  subgraph LocalJobs[本地备份任务]
    DUMP[数据库一致性快照<br>SQLite backup API / pg_dumpall]
    LIST[软件清单 / Docker 清单 / compose config]
    RESTIC[Restic backup<br>加密 / 切块 / 去重 / 增量]
    TIMER[systemd timer<br>daily + weekly]
  end

  subgraph DO[DigitalOcean Spaces]
    BKT[example-backups]
    R1[repo: Oracle-X86-1H1G-01]
    R2[repo: Oracle-X86-1H1G-02]
    R3[repo: Oracle-ARM-4H24G]
    R4[repo: DigitalOcean1H1G]
    R5[repo: 阿里云2H2G]
  end

  subgraph Notify[通知链路]
    TG[Telegram Bot]
    Relay[Server 2<br>Telegram SSH relay]
  end

  S1 --> DUMP
  S2 --> DUMP
  S3 --> DUMP
  S4 --> DUMP
  S5 --> LIST

  DUMP --> RESTIC
  LIST --> RESTIC
  TIMER --> RESTIC

  RESTIC --> BKT
  BKT --> R1
  BKT --> R2
  BKT --> R3
  BKT --> R4
  BKT --> R5

  S1 --> TG
  S2 --> TG
  S3 --> TG
  S4 --> TG
  S5 -->|relay-only| Relay
  Relay --> TG
```

### 图 2

```mermaid
gantt
    title 五台服务器备份体系实施时间线 (2026-05-23 至 2026-05-24)
    dateFormat  YYYY-MM-DD HH:mm
    axisFormat  %m-%d %H:%M

    section 方案确认与抢救 (05-23)
    意外排查与 Server 1 磁盘挂载离线抢救     :done, s1_rescue, 2026-05-23 15:19, 1h 10m
    备份范围梳理与 Spaces 规划           :done, plan, 2026-05-23 16:47, 27m
    status-monitor 面板部署与 5台 Agent 批量注册  :done, monitor, 2026-05-23 18:01, 46m

    section 第一轮备份实施 (05-23)
    Server 1 首备实验与 Telegram 通知定制 :done, s1_backup, 2026-05-23 20:46, 17m
    Server 2 部署、SQLite 快照及脚本备份  :done, s2_backup, 2026-05-23 21:03, 9m
    锁与 timer 机制运维验收验证           :done, lock_verify, 2026-05-23 21:12, 4m
    Server 3 (qq-bot 5.3G) 首备          :done, s3_first, 2026-05-23 21:16, 9m
    去重优化：切换为未压缩 SQLite 快照    :done, db_optimize, 2026-05-23 21:25, 25m

    section 域名迁移与架构重构 (05-24)
    站点域名迁移与旧证书清理 :done, migration, 2026-05-24 17:07, 25m
    5台机器全局备份脚本与 systemd 重构    :done, refactor_sys, 2026-05-24 17:59, 20m
    Telegram HTML 通知格式升级与变量转义  :done, tg_html, 2026-05-24 18:19, 20m
    阿里云 SSH 中继 (relay-only) 实施与验收:done, relay_opt, 2026-05-24 18:39, 20m
```

### 图 3

```mermaid
flowchart TD
  A[systemd timer 触发] --> B[读取 /etc/restic/env]
  B --> C[获取 flock 锁]
  C --> D[生成软件清单和 Docker 清单]
  D --> E[导出 docker compose config]
  E --> F{是否有数据库}
  F -->|SQLite| G[sqlite3 backup API<br>生成未压缩一致性快照]
  F -->|PostgreSQL| H[pg_dumpall 导出未压缩 SQL]
  F -->|无数据库| I[跳过 dump]
  G --> J[收集存在的核心路径]
  H --> J
  I --> J
  J --> K[restic backup]
  K --> L[restic forget<br>不 prune]
  L --> M[restic check --no-cache]
  M --> N[写 last-success / snapshots]
  N --> O[发送 Telegram HTML 通知]
```

### 图 4

```mermaid
sequenceDiagram
    participant Ali as 阿里云 Server 5
    participant S2 as Server 2 通知中继
    participant TG as Telegram Bot API

    Ali->>S2: SSH forced command 发送 HTML 通知文本
    S2->>TG: curl Telegram Bot API
    TG-->>S2: HTTP 200
```

## Restic 仓库迁移记

来源：`restic-spaces-to-r2/index.md`

### 图 1

```mermaid
flowchart LR
  A1["1. 预备副本<br/>建目录与拉取 ARM 镜像<br/>复制配置与证书"] --> A2["2. 准备切换<br/>TTL 降至 300s<br/>DNS 切到 Oracle IP"]
  A2 --> A3["3. 业务停写<br/>停止源容器防数据分叉<br/>短暂停止新容器"]
  A3 --> A4["4. 逻辑迁移<br/>最终源库导出与覆盖恢复<br/>启动新容器自动迁移表"]
  A4 --> A5["5. 运行验证<br/>公网 HTTPS 200 测试<br/>旧机保留以防回滚"]
```

### 图 2

```mermaid
flowchart LR
  B1["1. 瘦身准备<br/>剔除可重建缓存与静态副本<br/>prune 清理 Spaces 历史数据"] --> B2["2. 冻结迁移<br/>暂停定时任务<br/>rclone 复制仓库对象"]
  B2 --> B3["3. 配置切换<br/>桶级 rw 凭证授权<br/>修改环境变量配置"]
  B3 --> B4["4. 校验与验证<br/>restic check 校验一致性<br/>抽样恢复数据测试"]
  B4 --> B5["5. 解冻恢复<br/>重启定时任务<br/>确认新备份写入 R2"]
```

### 图 3

```mermaid
sequenceDiagram
    autonumber
    participant S as 四台服务器
    participant T as systemd timer
    participant R as Spaces 仓库
    participant B as R2 桶

    Note over S,T: 冻结备份
    S->>R: 运行最后一轮 Spaces 备份
    S->>T: 暂停定时任务
    activate T

    Note over S,B: 迁移与验证
    S->>B: 运行 rclone copy 原样复制仓库
    S->>B: 运行 rclone check 校验大小
    S->>S: 修改本机环境变量配置
    S->>B: 运行 restic 完整性校验

    Note over S,T: 解冻恢复
    S->>T: 恢复定时任务
    deactivate T
```

### 图 4

```mermaid
flowchart LR
  subgraph ActiveServers["现役服务器"]
    S1["Oracle AMD1<br/>GOMAXPROCS=1<br/>连接数=2"]
    S2["Oracle AMD2<br/>GOMAXPROCS=1<br/>连接数=2"]
    S3["Oracle ARM<br/>GOMAXPROCS=2<br/>连接数=3"]
    S4["Aliyun<br/>GOMAXPROCS=1<br/>连接数=2"]
  end

  subgraph R2Active["R2 活跃桶"]
    B1["restic-oracle-amd1"]
    B2["restic-oracle-amd2"]
    B3["restic-oracle-arm"]
    B4["restic-aliyun"]
  end

  S1 --> B1
  S2 --> B2
  S3 --> B3
  S4 --> B4
```

### 图 5

```mermaid
flowchart LR
  R2_Active["现役 R2 桶"] -->|每月只读拉取| L["本地保护机"]
  L -->|只增不删复制| CB["独立冷备桶"]
  CB -->|校验通过后| LOCK["启用 Bucket Lock"]
```

## 0-1 背包问题（动态规划、回溯法、分支限界法）

来源：`algorithm/01Knapsack/index.md`

### 图 1

```mermaid
graph TD
    classDef node fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;

    Root["开始"]:::node

    Y1["装物品1"]:::node
    N1["不装物品1"]:::node

    Y2_1["装物品2"]:::node
    N2_1["不装物品2"]:::node
    Y2_2["装物品2"]:::node
    N2_2["不装物品2"]:::node

    Y3_1["装物品3"]:::node
    N3_1["不装物品3"]:::node
    Y3_2["装物品3"]:::node
    N3_2["不装物品3"]:::node
    Y3_3["装物品3"]:::node
    N3_3["不装物品3"]:::node
    Y3_4["装物品3"]:::node
    N3_4["不装物品3"]:::node

    Root --> Y1
    Root --> N1
    Y1 --> Y2_1
    Y1 --> N2_1
    N1 --> Y2_2
    N1 --> N2_2
    Y2_1 --> Y3_1
    Y2_1 --> N3_1
    N2_1 --> Y3_2
    N2_1 --> N3_2
    Y2_2 --> Y3_3
    Y2_2 --> N3_3
    N2_2 --> Y3_4
    N2_2 --> N3_4
```

### 图 2

```mermaid
graph TD
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;
    classDef path fill:#eff6ff,stroke:#2563eb,stroke-width:2px,font-family:Inter;
    classDef best fill:#ecfdf5,stroke:#059669,stroke-width:3px,font-family:Inter;
    classDef overweight fill:#fef2f2,stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;

    R["根节点<br>UB=21.25"]:::root

    A["装1<br>cw=2, cv=6"]:::path
    B["装2<br>cw=7, cv=16"]:::path
    C["装3<br>cw=11 > 10"]:::overweight
    D["不装3<br>cw=7, cv=16"]:::path
    E["装4<br>cw=10, cv=19<br>best=19"]:::best

    R -->|先装1| A
    A -->|再装2| B
    B -->|尝试装3：超重| C
    B -->|改为不装3| D
    D -->|装4| E
```

### 图 3

```mermaid
graph TD
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;
    classDef done fill:#ecfdf5,stroke:#059669,stroke-width:2px,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef leaf fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,font-family:Inter;

    R["已找到 best=19"]:::done

    A["不装4<br>cv=16<br>叶子：不更新"]:::leaf
    B["不装2<br>UB=16"]:::bound
    C["不装1<br>UB=18"]:::bound

    R -->|回溯到物品4| A
    R -->|回溯到物品2| B
    R -->|回溯到物品1| C

    B -.->|UB < best，剪掉子树| B1["后续选择不再展开"]:::bound
    C -.->|UB < best，剪掉子树| C1["后续选择不再展开"]:::bound
```

### 图 4

```mermaid
graph TD
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;
    classDef path fill:#eff6ff,stroke:#2563eb,stroke-width:2px,font-family:Inter;
    classDef best fill:#ecfdf5,stroke:#059669,stroke-width:3px,font-family:Inter;
    classDef overweight fill:#fef2f2,stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef leaf fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,font-family:Inter;
    classDef skipped fill:#f3f4f6,stroke:#d1d5db,stroke-width:1px,color:#9ca3af,font-family:Inter;

    R["根<br>UB=21.25"]:::root

    A["装1<br>cw=2, cv=6"]:::path
    H["不装1<br>UB=18<br>剪枝"]:::bound

    B["装2<br>cw=7, cv=16"]:::path
    G["不装2<br>UB=16<br>剪枝"]:::bound

    C["装3<br>超重"]:::overweight
    D["不装3<br>cw=7, cv=16"]:::path

    E["装4<br>cv=19<br>best=19"]:::best
    F["不装4<br>cv=16<br>不更新"]:::leaf

    G1["装3"]:::skipped
    G2["不装3"]:::skipped
    G3["装4"]:::skipped
    G4["不装4"]:::skipped

    H1["装2"]:::skipped
    H2["不装2"]:::skipped
    H3["装3"]:::skipped
    H4["不装3"]:::skipped

    R -->|装1| A
    R -->|不装1| H

    A -->|装2| B
    A -->|不装2| G

    B -->|装3| C
    B -->|不装3| D

    D -->|装4| E
    D -->|不装4| F

    G -.->|未访问| G1
    G -.->|未访问| G2
    G2 -.->|未访问| G3
    G2 -.->|未访问| G4

    H -.->|未访问| H1
    H -.->|未访问| H2
    H2 -.->|未访问| H3
    H2 -.->|未访问| H4
```

### 图 5

```mermaid
graph TD
    classDef current fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef prev fill:#f8fafc,stroke:#cbd5e1,stroke-width:1.5px,font-family:Inter;
    classDef choose fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef result fill:#ecfdf5,stroke:#10b981,stroke-width:2px,font-family:Inter;

    A["当前格<br>f[2][7]"]:::current
    B["不装物品2<br>看 f[1][7] = 6"]:::prev
    C["装物品2<br>看 f[1][2] + 10 = 16"]:::choose
    D["取最大值<br>f[2][7] = 16"]:::result

    A --> B
    A --> C
    B --> D
    C --> D
```

### 图 6

```mermaid
flowchart RL
    classDef cell fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef warn fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;

    J10["dp[10]"]:::cell --> J9["dp[9]"]:::cell --> J8["dp[8]"]:::cell --> J7["..."]:::cell --> JW["dp[w]"]:::cell
    N["容量从大到小更新<br>保证 dp[j-w] 仍来自上一轮"]:::warn
    J10 -.-> N
```

### 图 7

```mermaid
graph TD
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef wait fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;

    R["根节点<br>UB=21.25"]:::root
    A["装1<br>UB=21.25<br>下一步扩展"]:::active
    B["不装1<br>UB=18.00<br>暂存队列"]:::wait

    R -->|装1| A
    R -->|不装1| B
```

### 图 8

```mermaid
graph TD
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef queue fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;

    R["root<br>UB=21.25<br>出队扩展"]:::active
    A["装1<br>UB=21.25<br>队首"]:::queue
    B["不装1<br>UB=18.00<br>等待"]:::queue

    R -->|装1| A
    R -->|不装1| B
```

### 图 9

```mermaid
graph TD
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef queue fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef wait fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,font-family:Inter;

    A["装1<br>UB=21.25<br>出队扩展"]:::active
    B["装2<br>UB=21.25<br>队首"]:::queue
    C["不装2<br>UB=16.00<br>不入队"]:::bound
    D["不装1<br>UB=18.00<br>等待"]:::wait

    A -->|装2| B
    A -->|不装2| C
    D -.->|仍在队列| B
```

### 图 10

```mermaid
graph TD
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef queue fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef overweight fill:#fef2f2,stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef wait fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,font-family:Inter;

    A["装1,2<br>UB=21.25<br>出队扩展"]:::active
    B["装3<br>cw=11>10<br>超重"]:::overweight
    C["不装3<br>UB=19.00<br>队首"]:::queue
    D["不装1<br>UB=18.00<br>等待"]:::wait

    A -->|装3| B
    A -->|不装3| C
    D -.->|仍在队列| C
```

### 图 11

```mermaid
graph TD
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef best fill:#ecfdf5,stroke:#10b981,stroke-width:3px,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef wait fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,font-family:Inter;

    A["装1,2,不装3<br>UB=19.00<br>出队扩展"]:::active
    B["装4<br>cv=19<br>best=19"]:::best
    C["不装4<br>UB=16.00<br>不入队"]:::bound
    D["不装1<br>UB=18.00<br>等待"]:::wait

    A -->|装4| B
    A -->|不装4| C
    D -.->|仍在队列| B
```

### 图 12

```mermaid
graph TD
    classDef best fill:#ecfdf5,stroke:#10b981,stroke-width:3px,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;

    A["当前 best=19"]:::best
    B["不装1<br>UB=18.00<br>剪枝"]:::bound

    A -->|UB <= best| B
```

### 图 13

```mermaid
graph TD
    classDef root fill:#f8fafc,stroke:#64748b,stroke-width:2px,font-family:Inter;
    classDef active fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,font-family:Inter;
    classDef queue fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,font-family:Inter;
    classDef best fill:#ecfdf5,stroke:#10b981,stroke-width:3px,font-family:Inter;
    classDef bound fill:#fff7ed,stroke:#f97316,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;
    classDef overweight fill:#fef2f2,stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 5,font-family:Inter;

    R["根<br>UB=21.25"]:::root

    A["装1<br>UB=21.25<br>第1个扩展"]:::active
    H["不装1<br>UB=18.00<br>先等待，后剪枝"]:::queue

    B["装2<br>UB=21.25<br>第2个扩展"]:::active
    G["不装2<br>UB=16.00<br>不入队"]:::bound

    C["装3<br>cw=11>10<br>超重"]:::overweight
    D["不装3<br>UB=19.00<br>第3个扩展"]:::active

    E["装4<br>cv=19<br>best=19"]:::best
    F["不装4<br>UB=16.00<br>不入队"]:::bound

    R -->|装1| A
    R -->|不装1| H

    A -->|装2| B
    A -->|不装2| G

    B -->|装3| C
    B -->|不装3| D

    D -->|装4| E
    D -->|不装4| F

    H -.->|最后出队<br>UB < best| Hx["剪枝"]:::bound
```

## 贪心算法：哈夫曼编码

来源：`algorithm/HuffmanCoding/index.md`

### 图 1

```mermaid
graph TD
    Root(( )) -->|0| A([A])
    Root(( )) -->|1| N1(( ))
    N1 -->|0| B([B])
    N1 -->|1| N2(( ))
    N2 -->|0| C([C])
    N2 -->|1| D([D])
```

### 图 2

```mermaid
graph TD
    Root((27)) -->|0| BCD((11))
    Root((27)) -->|1| AE((16))
    BCD -->|0| B([B:5])
    BCD -->|1| CD((6))
    CD -->|0| C([C:2])
    CD -->|1| D([D:4])
    AE -->|0| A([A:7])
    AE -->|1| E([E:9])
```

## 计算机系统概述

来源：`计组/计算机系统概述/index.md`

### 图 1

```mermaid
flowchart BT
    L1[第1层: 逻辑门层] --> L2[第2层: 微代码层]
    L2 --> L3[第3层: 指令集架构层]
    L3 --> L4[第4层: 操作系统层]
    L4 --> L5[第5层: 汇编语言层]
    L5 --> L6[第6层: 高级语言层]
```

## 数据信息的表示

来源：`计组/数据信息的表示/index.md`

### 图 1

```mermaid
flowchart TD
    Data[数据信息] --> Numeric[数值数据: 带有确定数值意义的数]
    Data --> NonNumeric[非数值数据: 文字、字符与多媒体]
    Numeric --> Unsigned[无符号数]
    Numeric --> Signed[有符号数]
    Signed --> Fixed[定点数]
    Signed --> Float[浮点数]
    NonNumeric --> Char[字符与文字]
    NonNumeric --> Media[多媒体数据: 图像、声音、视频]
```

### 图 2

```mermaid
gantt
    title IEEE 754 单精度浮点数 32 位布局
    dateFormat X
    axisFormat %s
    section 字段
    符号位 S (1位) : 0, 1
    阶码 E (8位)  : 1, 9
    尾数 M (23位) : 9, 32
```

## 运算方法与运算器

来源：`计组/运算方法与运算器/index.md`

### 图 1

```mermaid
flowchart BT
    subgraph 寄存器组
        R[通用寄存器]
        ACC[累加寄存器]
    end
    subgraph 数据输入
        MUX[多路选择器]
        TEMP[暂存器]
    end
    subgraph 核心算术逻辑
        ALU[算术逻辑单元]
    end
    subgraph 状态监测
        PSW[状态字寄存器]
    end

    R --> MUX
    ACC --> MUX
    MUX --> TEMP
    TEMP --> ALU
    ALU --> ACC
    ALU --> PSW
```

## 存储系统

来源：`计组/存储系统/index.md`

### 图 1

```mermaid
flowchart BT
    L4[外存: 磁盘、SSD、Flash] --> L3[主存: DRAM]
    L3 --> L2[高速缓存: SRAM]
    L2 --> L1[寄存器: CPU内部]
```

## 指令系统

来源：`计组/指令系统/index.md`

### 图 1

```mermaid
flowchart BT
    Hardware[底层硬件: 译码电路、数据通路、执行控制] --> ISA[接口层: 指令系统]
```

## 中央处理器

来源：`计组/中央处理器/index.md`

### 图 1

```mermaid
flowchart BT
    DataPath[数据通路: 寄存器组、ALU、移位器] --> Ctrl[操作控制信号驱动]
    CtrlGen[控制器: 译码电路、时序逻辑] --> Ctrl
    PSW[状态标志反馈] --> CtrlGen
```

### 图 2

```mermaid
flowchart BT
    CM[控制存储器 CM] --> uIR[微指令寄存器 uIR]
    uIR -->|顺序控制字段| uMAR[微地址寄存器 uMAR]
    IR[指令寄存器操作码] -->|微地址形成部件| uMAR
    uMAR --> CM
    uIR -->|操作控制字段| Ctrl[控制信号输出]
```

## 指令流水线

来源：`计组/指令流水线/index.md`

### 图 1

```mermaid
gantt
    title 4段流水线时空图 (6条指令)
    dateFormat X
    axisFormat %s

    section 取指(IF)
    I1 :0, 1
    I2 :1, 2
    I3 :2, 3
    I4 :3, 4
    I5 :4, 5
    I6 :5, 6

    section 译码(ID)
    I1 :1, 2
    I2 :2, 3
    I3 :3, 4
    I4 :4, 5
    I5 :5, 6
    I6 :6, 7

    section 执行(EX)
    I1 :2, 3
    I2 :3, 4
    I3 :4, 5
    I4 :5, 6
    I5 :6, 7
    I6 :7, 8

    section 写回(WB)
    I1 :3, 4
    I2 :4, 5
    I3 :5, 6
    I4 :6, 7
    I5 :7, 8
    I6 :8, 9
```

### 图 2

```mermaid
gantt
    title 5段流水线执行4条指令时空图
    dateFormat X
    axisFormat %s

    section IF
    I1 :0, 1
    I2 :1, 2
    I3 :2, 3
    I4 :3, 4

    section ID
    I1 :1, 2
    I2 :2, 3
    I3 :3, 4
    I4 :4, 5

    section EX
    I1 :2, 3
    I2 :3, 4
    I3 :4, 5
    I4 :5, 6

    section MEM
    I1 :3, 4
    I2 :4, 5
    I3 :5, 6
    I4 :6, 7

    section WB
    I1 :4, 5
    I2 :5, 6
    I3 :6, 7
    I4 :7, 8
```

## 总线系统

来源：`计组/总线系统/index.md`

### 图 1

```mermaid
graph LR
    A[申请与仲裁] --> B[寻址阶段]
    B --> C[传输阶段]
    C --> D[结束阶段]

    style A fill:#e1f5fe,stroke:#0288d1,stroke-width:2px
    style B fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style C fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style D fill:#fce4ec,stroke:#c2185b,stroke-width:2px
```

### 图 2

```mermaid
graph TD
    subgraph 链式查询
        A1[仲裁器] -->|BG 串行| B1[设备0]
        B1 -->|BG 串行| C1[设备1]
        C1 -->|BG 串行| D1[设备n]
        B1 -.BR 汇线.- A1
        C1 -.BR 汇线.- A1
        D1 -.BR 汇线.- A1
    end
    subgraph 独立请求
        A2[仲裁器] <-->|BG0 / BR0| B2[设备0]
        A2 <-->|BG1 / BR1| C2[设备1]
        A2 <-->|BGn / BRn| D2[设备n]
    end
```

## 输入输出系统

来源：`计组/输入输出系统/index.md`

### 图 1

```mermaid
graph TD
    A[CPU 启动 I/O 设备] --> B{读取状态寄存器<br>设备已就绪?}
    B -- 否 --> B
    B -- 是 --> C[进行数据传输]
    C --> D[传输完毕, 继续执行后续程序]

    style B fill:#ffe0b2,stroke:#f57c00
```

### 图 2

```mermaid
graph TD
    A[原程序执行] --> B[当前指令结束]
    B --> C{有未屏蔽的中断请求?}
    C -- 否 --> A
    C -- 是 --> D(中断隐指令: 硬件自动完成)

    subgraph 中断隐指令
    D --> D1[1. 关中断]
    D1 --> D2[2. 保存断点 PC]
    D2 --> D3[3. 获中断服务程序入口]
    end

    D3 --> E(中断服务程序: 软件执行)

    subgraph 中断服务程序
    E --> E1[4. 保护现场]
    E1 --> E2[5. 可选: 开中断允许嵌套]
    E2 --> E3[6. 执行实际 I/O 传输]
    E3 --> E4[7. 可选: 关中断]
    E4 --> E5[8. 恢复现场]
    E5 --> E6[9. 开中断]
    E6 --> E7[10. 中断返回 IRET]
    end

    E7 --> A
```

## 常见概率分布

来源：`概率论/常见分布/index.md`

### 图 1

```mermaid
graph TD
    Bernoulli["两点分布"] -->|n次独立试验| Binomial["二项分布"]
    Binomial -->|n很大且p极小| Poisson["泊松分布"]
    Binomial -->|n很大且期望较大| Normal["正态分布"]
    Poisson -->|均值较大时| Normal
    Normal -->|标准化变换| StdNormal["标准正态分布"]
    StdNormal -->|独立变量平方和| ChiSquare["卡方分布"]
    StdNormal & ChiSquare -->|比值构成统计量| TDist["t 分布"]
    ChiSquare & ChiSquare -->|比值构成统计量| FDist["F 分布"]
    TDist -->|自由度趋于无穷| StdNormal
```
