export default {
  async fetch(request, env, ctx) {
    // 使用 ASSETS binding 提供静态文件服务
    return env.ASSETS.fetch(request);
  }
}
