const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // 处理预检请求（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ========== 1. 视频相关接口 ==========
      
      // 获取所有视频
      if (path === '/api/videos' && request.method === 'GET') {
        return await handleGetVideos(env);
      }
      
      // 添加新视频
      if (path === '/api/videos' && request.method === 'POST') {
        return await handleAddVideo(request, env);
      }
      
      // 更新视频进度
      if (path === '/api/videos/progress' && request.method === 'POST') {
        return await handleUpdateProgress(request, env);
      }
      
      // 删除单个视频
      if (path.startsWith('/api/videos/') && request.method === 'DELETE') {
        const videoId = path.split('/').pop();
        return await handleDeleteVideo(env, videoId);
      }
      
      // 清空所有视频
      if (path === '/api/videos/clear' && request.method === 'POST') {
        return await handleClearVideos(env);
      }

      // ========== 2. 网址提交相关接口 ==========
      
      // 获取所有提交的网址
      if (path === '/api/submissions' && request.method === 'GET') {
        return await handleGetSubmissions(env);
      }
      
      // 提交新网址
      if (path === '/api/submissions' && request.method === 'POST') {
        return await handleAddSubmission(request, env);
      }

      // ========== 3. 404 处理 ==========
      
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });

    } catch (error) {
      // 统一错误处理
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  }
};

// ========== 视频相关函数 ==========

// 获取所有视频
async function handleGetVideos(env) {
  // 获取视频列表
  const videos = await env.WEBTOOL_KV.get('videos', 'json') || [];
  
  // 为每个视频加载进度
  for (let video of videos) {
    const progress = await env.WEBTOOL_KV.get(`video:${video.id}:progress`, 'json');
    if (progress) {
      video.progress = progress;
    }
  }
  
  return new Response(JSON.stringify(videos), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 添加新视频
async function handleAddVideo(request, env) {
  const videoData = await request.json();
  
  // 生成唯一ID
  videoData.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  videoData.addedAt = new Date().toISOString();
  
  // 获取现有视频列表
  const videos = await env.WEBTOOL_KV.get('videos', 'json') || [];
  
  // 添加到列表开头
  videos.unshift(videoData);
  
  // 只保留最近50个视频
  if (videos.length > 50) {
    videos.pop();
  }
  
  // 保存回 KV
  await env.WEBTOOL_KV.put('videos', JSON.stringify(videos));
  
  return new Response(JSON.stringify(videoData), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 更新视频进度
async function handleUpdateProgress(request, env) {
  const { videoId, currentTime, duration } = await request.json();
  
  const progress = {
    currentTime,
    duration,
    updatedAt: new Date().toISOString()
  };
  
  await env.WEBTOOL_KV.put(`video:${videoId}:progress`, JSON.stringify(progress));
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 删除单个视频
async function handleDeleteVideo(env, videoId) {
  // 获取视频列表
  const videos = await env.WEBTOOL_KV.get('videos', 'json') || [];
  
  // 过滤掉要删除的视频
  const updated = videos.filter(v => v.id !== videoId);
  
  // 保存新列表
  await env.WEBTOOL_KV.put('videos', JSON.stringify(updated));
  
  // 删除进度记录
  await env.WEBTOOL_KV.delete(`video:${videoId}:progress`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 清空所有视频
async function handleClearVideos(env) {
  const videos = await env.WEBTOOL_KV.get('videos', 'json') || [];
  
  // 删除所有视频的进度记录
  for (let video of videos) {
    await env.WEBTOOL_KV.delete(`video:${video.id}:progress`);
  }
  
  // 清空视频列表
  await env.WEBTOOL_KV.delete('videos');
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// ========== 网址提交相关函数 ==========

// 获取所有提交的网址
async function handleGetSubmissions(env) {
  const submissions = await env.WEBTOOL_KV.get('submissions', 'json') || [];
  
  return new Response(JSON.stringify(submissions), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// 提交新网址
async function handleAddSubmission(request, env) {
  const { url, title } = await request.json();
  
  // 验证URL
  if (!url || !url.match(/^https?:\/\/.+/)) {
    return new Response(JSON.stringify({ error: '无效的URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
  
  // 获取现有提交
  const submissions = await env.WEBTOOL_KV.get('submissions', 'json') || [];
  
  // 获取客户端信息
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  // 创建新提交
  const newSubmission = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    url,
    title: title || new URL(url).hostname,
    created_at: new Date().toISOString(),
    ip_address: clientIP,
    user_agent: userAgent
  };
  
  // 添加到列表开头
  submissions.unshift(newSubmission);
  
  // 只保留最近100条
  if (submissions.length > 100) {
    submissions.pop();
  }
  
  // 保存回 KV
  await env.WEBTOOL_KV.put('submissions', JSON.stringify(submissions));
  
  return new Response(JSON.stringify(newSubmission), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}
