# 改进说明

2026-3-6

1. 网页功能丰富，项目介绍网页，开屏介绍项目产品信息，仿真结果展示
2. 模型展示界面，将控制数据都放在界面上展示，用户可以通过界面上的控制数据来控制模型的展示，数据展示可以用图表丰富一下，3. 功能拓展，历史数据分析？

# 3D-present

This template should help get you started developing with Vue 3 in Vite.

## Project Setup

前端

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

部署阶段

```sh
pnpm build
```

后端

```sh
pip install -r requirements.txt
```

### Run the FastAPI server

```sh
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

将后端服务启动在本机的8000端口，并启用自动重载功能以便开发时使用。局域网下所有设备皆可访问
