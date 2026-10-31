    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isSafeUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const t = url.trim().toLowerCase();
      return t.startsWith('http://') || t.startsWith('https://');
    }

    async function hashPassword(str) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function parseQualityTag(remarks) {
      if (!remarks) return { text: '正片', cls: 'q-normal' };
      const r = remarks.toUpperCase();
      if (r.includes('4K') || r.includes('2160')) return { text: '4K', cls: 'q-4k' };
      if (r.includes('1080') || r.includes('BD') || r.includes('蓝光') || r.includes('FHD')) return { text: '1080p', cls: 'q-1080' };
      if (r.includes('720') || r.includes('HD')) return { text: '720p', cls: 'q-720' };
      if (r.includes('TC') || r.includes('抢先')) return { text: 'TC', cls: 'q-normal' };
      return { text: remarks.length <= 6 ? remarks : '正片', cls: 'q-normal' };
    }

    function detectCensorshipTag(vod, siteName) {
      if (!vod) return '';
      const name = (vod.vod_name || '').toLowerCase();
      const type = (vod.type_name || '').toLowerCase();
      const remarks = (vod.vod_remarks || '').toLowerCase();
      const sub = (vod.vod_sub || '').toLowerCase();
      const sName = (siteName || '').toLowerCase();
      const fullStr = `${name} ${type} ${remarks} ${sub} ${sName}`;

      const uncensoredRegex = /(无码|步兵|uncensored|无遮|无马|破解去码|流出无码|去码|无修正|未修正|一本道|加勒比|caribbean|1pondo|10musume|pacopacomama|heyzo|tokyo[-_ ]?hot|东京热|天然素人|c0930|h0930|h4610|mywife|muramura|gachinco|s-cute|\bfc2\b)/i;
      if (uncensoredRegex.test(fullStr)) {
        return '🔞 无码';
      }

      const censoredRegex = /(有码|骑兵|censored|薄码|带码|有马|日韩有码|日本有码|亚洲有码)/i;
      if (censoredRegex.test(fullStr)) {
        return '🔞 有码';
      }

      const isAdultContext = isNSFWSource(siteName) ||
        /(自拍|伦理|成人|福利|三级|情色|色情|偷拍|无码|有码|av|女优|同人|cosplay|写真)/i.test(type) ||
        /(av|女优|jav)/i.test(name);

      if (isAdultContext) {
        const javCensoredCodeRegex = /\b(ssni|ipx|midv|jul|stars|mide|miaa|snis|abp|ipz|adn|ebod|pppd|sdde|tek|jufe|fsdss|dldss|cae|pred|cesd|wanz|das|hbad|mifd|sod|moodyz|ideapocket|prestige|attackers|kmhr|bibi|soe|star|ssis|meyd|dand|hunt|rebd|gun)[-_ ]?\d{2,5}\b/i;
        if (javCensoredCodeRegex.test(name) || javCensoredCodeRegex.test(remarks) || javCensoredCodeRegex.test(sub)) {
          return '🔞 有码';
        }
      }

      return '';
    }

    function cleanSiteName(name) {
      return (name || '').replace(/^(?:🎬|📺|[\s:-])+/g, '').trim() || '默认源';
    }

    function normalizeCleanKey(str) {
      if (!str) return '';
      return String(str).toLowerCase()
        .replace(/^(?:🎬|📺|\s)+/g, '')
        .replace(/[-:：\s_·/\\|，,。.+*★☆]+/g, '')
        .replace(/[（(【\[［\{].*?[)）】\]］\}]/g, '')
        .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
    }

    function parseTitleAndVersion(rawName) {
      if (!rawName) return { canonical: "未知影视", version: "" };
      let str = String(rawName).trim();
      let versionList = [];

      const bracketRegex = /[\[\(\（\【\［\{]([^\]\)\）\】\］\}]+)[\]\)\）\】\］\}]/g;
      let m;
      while ((m = bracketRegex.exec(str)) !== null) {
        if (m[1] && m[1].trim()) versionList.push(m[1].trim());
      }
      let cleaned = str.replace(bracketRegex, ' ').trim();

      const endPatterns = [
        /\s*(19\d{2}|20\d{2})\s*$/i,
        /\s*(国语|粤语|英语|韩语|日语|俄语|法语|双语|双字|中字|中英|中英双字|中英双语|国粤|国粤双语|中文字幕|英文字幕|原声|内嵌中字|内嵌字幕)\s*$/i,
        /\s*(4K|2160P|1080P|720P|HD|BD|TC|TS|DVD|蓝光|超清|高清|标清|修复版|4K修复|蓝光重制|重置版|重制版)\s*$/i,
        /\s*(抢先版|完整版|未删减版|未删减|加长版|公映版|院线版|电影版|剧场版|TV版|原版|正片|纯净版|解说版|解说)\s*$/i
      ];

      let changed = true;
      while (changed) {
        changed = false;
        cleaned = cleaned.replace(/[\s\:\：\-\_\·\/\|\\]+$/, '').trim();
        for (const pattern of endPatterns) {
          const match = cleaned.match(pattern);
          if (match) {
            const matchedTag = match[0].trim();
            if (matchedTag && !versionList.includes(matchedTag)) {
              versionList.push(matchedTag);
            }
            cleaned = cleaned.replace(pattern, '').trim();
            changed = true;
          }
        }
      }

      cleaned = cleaned.replace(/^(经典|最新|高清|电影|精选)[\:\：\-\_\s]+/, '').trim();
      cleaned = cleaned.replace(/[\s\:\：\-\_\·\/\|\\]+$/, '').trim();

      return { 
        canonical: cleaned || rawName.trim(), 
        version: versionList.join(' ').trim() 
      };
    }

    async function getD1Data(key, defaultVal = '') {
      try {
        // 关键：增加时间戳 _t 与 cache: 'no-store'，彻底杜绝 Safari 命中旧缓存
        const res = await fetch(`/api/data?key=${encodeURIComponent(key)}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.value !== null && data.value !== undefined) {
            localStorage.setItem(key, data.value);
            return data.value;
          }
        }
      } catch (_) {}
      return localStorage.getItem(key) || defaultVal;
    }

    async function getD1BatchData(keys) {
      try {
        const res = await fetch(`/api/data?action=batch&keys=${encodeURIComponent(keys.join(','))}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            for (const [k, v] of Object.entries(data)) {
              if (v !== null && v !== undefined) {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
              }
            }
            return data;
          }
        }
      } catch (_) {}
      const fallback = {};
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v !== null) fallback[k] = v;
      }
      return fallback;
    }


    async function setD1Data(key, value) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (key !== KEY_ADMIN_INFO && key !== KEY_USERS_LIST) localStorage.setItem(key, valStr);
      try {
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: valStr })
        });
        if (!response.ok) throw new Error('保存失败：' + response.status);
      } catch (_) {}
    }

    async function purgeD1Key(key) {
      localStorage.removeItem(key);
      try {
        await fetch(`/api/data?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      } catch (_) {}
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: '[]' })
        });
      } catch (_) {}
    }

    const KEY_M3U = "custom_tv_m3u_url";
    const KEY_TV_CHANNELS = "cached_tv_channels_v2"; // 实时持久化储存已解析的电视频道列表
    const KEY_SUB = "custom_vod_sub_url";
    const KEY_SITES = "cached_parsed_sites";
    const KEY_DISABLED_SITES = "disabled_sites_list";
    const KEY_SOURCE_FAILURES = "sys_source_failure_stats_v2";
    const KEY_FAIL_THRESHOLD = "sys_source_fail_threshold_v1";
    const KEY_HISTORY = "history_list_v2";
    const KEY_FAVS = "favorites_list_v2";
    const KEY_LAST_SYNC = "last_subscription_sync_time";
    const KEY_SYNC_INTERVAL = "subscription_sync_interval";

    const KEY_ADMIN_INFO = "sys_admin_credentials_v2";
    const KEY_AUTH_CONFIG = "sys_auth_config_v2";
    const KEY_USERS_LIST = "sys_users_list_v2";
    const KEY_SOURCE_GROUPS = "sys_source_groups_v3";
    const KEY_THEME_PREF = "sys_theme_appearance_v1";
    const KEY_CURRENT_USER = "local_current_session_user";
    const KEY_SAVED_CREDS = "local_saved_remember_creds";
    const KEY_SESSION_VOD_STATE = "session_active_vod_state_v3";
    const KEY_SESSION_PAGE_STATE = 'sg_page_restore_v1';
    const SG_RESTORE_TTL_MS = 6 * 60 * 60 * 1000; // Same tab, six-hour expiry.
    let sgUiRestoring = false;
    let sgPendingHomeYear = null;
    /* ===================================================================
       核心 DOM 节点句柄与全局状态变量初始化（彻底消除 ReferenceError）
       =================================================================== */
    const wrap = document.getElementById('player-wrap');
    const video = document.getElementById('video');
    video.addEventListener('playing', () => document.getElementById('player-wrap')?.classList.add('has-active-video'));
    video.addEventListener('loadeddata', () => document.getElementById('player-wrap')?.classList.add('has-active-video'));
    const currentTitle = document.getElementById('current-title');
    const routeBadge = document.getElementById('current-route-badge');
    const favToggleBtn = document.getElementById('btn-fav-toggle');
    const statusLayer = document.getElementById('status-layer');
    const statusText = document.getElementById('status-text');
    const gestureTip = document.getElementById('gesture-tip');
    const progressContainer = document.getElementById('progress-container');
    const progressTrack = document.getElementById('progress-track');
    const progressBar = document.getElementById('progress-bar');
    const streamTimeEl = document.getElementById('stream-time');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const volSlider = document.getElementById('vol-slider');

    // 核心账户与权限状态
    let currentUser = null;
    let adminAccount = null;
    let userList = [];
    let sourceGroups = [{ id: 'def', name: '默认分组', sites: ['*'], isDefault: true }];
    let authConfig = { requireLogin: false };
    let parsedSites = [];
    let disabledSites = [];
    let sourceFailures = {};
    let failThreshold = 5;
    // Frosted Cinema theme defaults to dark; explicitly saved light/auto settings stay respected.
    let currentThemeSetting = 'dark';
    let gateAuthMode = 'login';
    let currentEditingGroupId = null;
    let userAssigningIdx = -1;

    // 播放与界面视图状态
    let currentMode = 'vod';
    let currentView = 'normal';
    let isLiveMode = false;
    let currentStreamUrl = '';
    let currentVodUniqueKey = '';
    let currentPlayingMeta = null;
    let currentActiveEp = 0;
    let isEpisodeReversed = false;
    let isDraggingProgress = false;
    let dragTargetTime = 0;
    let hls = null;
    let playbackGeneration = 0;
    let playWatchdogTimer = null;
    // Only active media-session listeners and timers may affect playback.
    let sgPlaybackMonitorCleanup = null;
    let gestureTipTimer = null;
    let controlsTimer = null;
    var sgCastState = {
      active: false,
      directModeActive: false,
      smoothModeActive: false,
      preferAvc: true,
      lastRawUrl: '',
      resolvedUrl: '',
      streamInfo: null,
      castSdkPromise: null,
      switchingSource: false
    };
    var sgCastManifestCache = new Map();

    // 电视直播数据
    let groups = {};
    let sgLiveSelectedTab = '央视'; // User's current live-TV tab, never affects VOD.
    let totalChannelsCount = 0;
    let totalStreamsCount = 0;

    // 影视剧场检索与渲染状态
    let groupedVodList = [];
    let currentSearchingWord = '';
    let activeGroupTitle = '';
    let activeSubItemId = '';
    let currentVodSortType = 'score';
    let currentCategoryFilter = 'auto';
    let isSearchingActive = false;
    let isSpeedTesting = false;
    let currentSearchAbortController = null;
    let renderFrameTimer = null;
    let domNodeCache = new Map();
    let activeDisplayCardList = [];
    let currentlyRenderedCount = 0;
    const CHUNK_PAGE_SIZE = 30;

    /* ===================================================================
       基础支撑工具函数（提示、状态层、时间格式化、缓存与播放控制）
       =================================================================== */
    function formatTime(sec) {
      if (!sec || isNaN(sec) || sec < 0) return "00:00";
      const s = Math.floor(sec);
      const m = Math.floor(s / 60);
      const ss = s % 60;
      const h = Math.floor(m / 60);
      const mm = m % 60;
      if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      }
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    function setStatus(msg, persistent = false) {
      if (!statusLayer || !statusText) return;
      if (!msg) {
        statusLayer.style.display = 'none';
        return;
      }
      statusText.innerHTML = msg;
      statusLayer.style.display = 'block';
    }

    function showGestureTip(msg) {
      if (!gestureTip) return;
      gestureTip.textContent = msg;
      gestureTip.style.opacity = '1';
      if (gestureTipTimer) clearTimeout(gestureTipTimer);
      gestureTipTimer = setTimeout(() => {
        gestureTip.style.opacity = '0';
      }, 1600);
    }

    function showControls() {
      if (!wrap) return;
      wrap.classList.remove('controls-hidden');
      if (controlsTimer) clearTimeout(controlsTimer);
      controlsTimer = setTimeout(() => {
        if (!video.paused && !isDraggingProgress) {
          wrap.classList.add('controls-hidden');
        }
      }, 3500);
    }

    let lastTapTime = 0;
    let lastTapZone = '';
    let singleTapTimer = null;
    let seekStreakDir = 0;
    let seekStreakSec = 0;
    let seekStreakResetTimer = null;
    let seekBaseTime = 0;

    function triggerCumulativeSeek(dir) {
      if (isLiveMode || !video.duration || !isFinite(video.duration)) {
        showGestureTip("📺 直播模式不支持快进/后退");
        return;
      }

      if (seekStreakDir === dir && seekStreakResetTimer) {
        seekStreakSec += 10;
      } else {
        seekStreakDir = dir;
        seekStreakSec = 10;
        seekBaseTime = video.currentTime;
      }

      const dur = video.duration;
      const targetTime = Math.max(0, Math.min(dur, seekBaseTime + dir * seekStreakSec));
      video.currentTime = targetTime;

      streamTimeEl.textContent = `${formatTime(targetTime)} / ${formatTime(dur)}`;
      progressBar.style.width = `${(targetTime / dur) * 100}%`;

      showGestureTip(dir > 0 ? `⏩ 快进 ${seekStreakSec} 秒` : `⏪ 后退 ${seekStreakSec} 秒`);

      if (seekStreakResetTimer) clearTimeout(seekStreakResetTimer);
      seekStreakResetTimer = setTimeout(() => {
        seekStreakDir = 0;
        seekStreakSec = 0;
        seekStreakResetTimer = null;
      }, 1200);
    }

    // Process taps regardless of whether the floating toolbar is visible.
    // Pointer gestures are handled on a separate transparent layer so that
    // mobile Safari never needs to forward native <video> click events.
    function handlePlayerStageTap(clientX) {
      const rect = wrap.getBoundingClientRect();
      const ratio = (clientX - rect.left) / (rect.width || 1);
      const zone = ratio < 0.35 ? 'left' : (ratio > 0.65 ? 'right' : 'center');
      const now = performance.now();
      if (lastTapTime > 0 && now - lastTapTime < 330 && lastTapZone === zone) {
        if (singleTapTimer) { clearTimeout(singleTapTimer); singleTapTimer = null; }
        lastTapTime = 0;
        if (zone === 'left') triggerCumulativeSeek(-1);
        else if (zone === 'right') triggerCumulativeSeek(1);
        else {
          const wasPaused = video.paused;
          togglePlay();
          if (currentStreamUrl) showGestureTip(wasPaused ? '▶ 继续播放' : '⏸ 已暂停');
        }
      } else {
        lastTapTime = now;
        lastTapZone = zone;
        if (singleTapTimer) clearTimeout(singleTapTimer);
        singleTapTimer = setTimeout(() => {
          singleTapTimer = null;
          lastTapTime = 0;
          if (wrap.classList.contains('controls-hidden')) showControls();
          else {
            wrap.classList.add('controls-hidden');
            if (controlsTimer) clearTimeout(controlsTimer);
          }
        }, 350);
      }
    }

    if (wrap) {
      wrap.style.touchAction = 'manipulation';
      wrap.style.userSelect = 'none';
      wrap.style.webkitUserSelect = 'none';
      wrap.addEventListener('mousemove', () => {
        // Mobile Safari may synthesize mousemove after a finger tap. Do not
        // reveal the toolbar during an otherwise valid double-tap gesture.
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) showControls();
      });
      const stage = document.getElementById('player-gesture-surface');
      if (stage) {
        let pointerDown = null;
        stage.addEventListener('pointerdown', e => {
          if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
          pointerDown = { id:e.pointerId, x:e.clientX, y:e.clientY };
        }, {passive:true});
        stage.addEventListener('pointerup', e => {
          if (!pointerDown || pointerDown.id !== e.pointerId) return;
          const distance = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
          pointerDown = null;
          if (distance > 18) return; // don't steal scrolls or swipes
          handlePlayerStageTap(e.clientX);
        }, {passive:true});
        stage.addEventListener('pointercancel', () => { pointerDown=null; }, {passive:true});
        // Prevent the pointer's synthesized click from also reaching wrap.
        stage.addEventListener('click', e => { e.stopPropagation(); }, false);
      }
      // Fallback for direct wrap clicks; controls and badges are excluded.
      wrap.addEventListener('click', e => {
        if (e.target.closest('#player-gesture-surface,#custom-controls,#top-bar,#status-layer')) return;
        handlePlayerStageTap(e.clientX);
      });
    }

    const PLAYBACK_RATES = [1.0, 1.25, 1.5, 2.0, 0.75];
    let currentRateIdx = 0;
    function cyclePlaybackRate() {
      currentRateIdx = (currentRateIdx + 1) % PLAYBACK_RATES.length;
      const rate = PLAYBACK_RATES[currentRateIdx];
      video.playbackRate = rate;
      const btn = document.getElementById('speed-btn');
      if (btn) btn.textContent = `${rate}倍`;
      showGestureTip(`倍速: ${rate}x`);
    }

    const ASPECT_RATIOS = [
      { label: '适应', cls: '' },
      { label: '拉伸', cls: 'fit-fill' },
      { label: '覆盖', cls: 'fit-cover' }
    ];
    let currentRatioIdx = 0;
    function cycleAspectRatio() {
      currentRatioIdx = (currentRatioIdx + 1) % ASPECT_RATIOS.length;
      const r = ASPECT_RATIOS[currentRatioIdx];
      video.className = r.cls;
      const btn = document.getElementById('ratio-btn');
      if (btn) btn.textContent = r.label;
      showGestureTip(`画幅: ${r.label}`);
    }

    function changeVolume(val) {
      const v = parseFloat(val);
      video.volume = isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
      video.muted = (video.volume === 0);
      const icon = document.getElementById('volume-icon');
      if (icon) icon.setAttribute('stroke', video.muted ? '#ff6b6b' : '#fff');
    }

    function togglePiP() {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (document.pictureInPictureEnabled && video !== document.pictureInPictureElement) {
        video.requestPictureInPicture().catch(() => {});
      }
    }

    function exitPictureInPictureMode() {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    }

    function decodeBase58(str) {
      const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      const bytes = [0];
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        const val = ALPHABET.indexOf(c);
        if (val === -1) continue;
        for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
        bytes[0] += val;
        let carry = 0;
        for (let j = 0; j < bytes.length; j++) {
          bytes[j] += carry;
          carry = bytes[j] >> 8;
          bytes[j] &= 0xff;
        }
        while (carry > 0) {
          bytes.push(carry & 0xff);
          carry >>= 8;
        }
      }
      for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
      return new TextDecoder().decode(new Uint8Array(bytes.reverse()));
    }

    const VodSearchCache = {
      get(kw, gid) {
        try {
          const raw = sessionStorage.getItem(`vod_cache_${gid}_${kw}`);
          return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
      },
      set(kw, gid, data) {
        try {
          sessionStorage.setItem(`vod_cache_${gid}_${kw}`, JSON.stringify(data.map(slimGroupForStorage)));
        } catch (_) {}
      }
    };

    function getCurrentFavKey() {
      return currentUser ? `favs_u_${currentUser.username}` : KEY_FAVS;
    }
    function getCurrentHistoryKey() {
      return currentUser ? `history_u_${currentUser.username}` : KEY_HISTORY;
    }

    function getLocalFavorites() {
      const raw = localStorage.getItem(getCurrentFavKey());
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    }

    async function getFavoritesList(forceCloud = false) {
      if (forceCloud) {
        const data = await getD1Data(getCurrentFavKey(), '[]');
        try { return Array.isArray(JSON.parse(data)) ? JSON.parse(data) : []; } catch (_) { return []; }
      }
      const local = getLocalFavorites();
      getD1Data(getCurrentFavKey(), '[]').catch(() => {});
      if (local && local.length > 0) return local;
      const data = await getD1Data(getCurrentFavKey(), '[]');
      try { return Array.isArray(JSON.parse(data)) ? JSON.parse(data) : []; } catch (_) { return []; }
    }

    function getLocalHistory() {
      const raw = localStorage.getItem(getCurrentHistoryKey());
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    }

    async function getHistoryList(forceCloud = false) {
      if (forceCloud) {
        const data = await getD1Data(getCurrentHistoryKey(), '[]');
        try { return Array.isArray(JSON.parse(data)) ? JSON.parse(data) : []; } catch (_) { return []; }
      }
      const local = getLocalHistory();
      getD1Data(getCurrentHistoryKey(), '[]').catch(() => {});
      if (local && local.length > 0) return local;
      const data = await getD1Data(getCurrentHistoryKey(), '[]');
      try { return Array.isArray(JSON.parse(data)) ? JSON.parse(data) : []; } catch (_) { return []; }
    }

    function getCanonicalFavTitleKey(rawTitle) {
      if (!rawTitle) return '';
      return normalizeCleanKey(parseTitleAndVersion(rawTitle).canonical) || normalizeCleanKey(rawTitle);
    }

    /* === 实时更新收藏图标高亮状态（本地瞬时判定，0ms延迟） === */
    function updateFavIconState(favsList) {
      if (!currentPlayingMeta) {
        favToggleBtn.classList.remove('active');
        return;
      }
      const favs = favsList || getLocalFavorites();
      let isFav = false;
      const curTitle = getCanonicalFavTitleKey(currentPlayingMeta.title);
      const curSite = normalizeCleanKey(currentPlayingMeta.siteName);
      const rawTvUrl = window.currentRawStreamUrl || currentStreamUrl;
      if (isLiveMode) {
        isFav = favs.some(f => f.type === 'tv' && (f.url === rawTvUrl || f.url === currentStreamUrl || normalizeCleanKey(f.title) === normalizeCleanKey(currentPlayingMeta.title)));
      } else {
        isFav = favs.some(f => f.type !== 'tv' && getCanonicalFavTitleKey(f.title) === curTitle && normalizeCleanKey(f.siteName) === curSite);
      }
      favToggleBtn.classList.toggle('active', isFav);
    }

    /* === 点击收藏：瞬时本地响应 + 后台静默写云端 === */
    function toggleCurrentFavorite() {
      if (!currentPlayingMeta) { alert("请先选择播放项目！"); return; }
      let favs = getLocalFavorites();
      const currentEpName = currentPlayingMeta.epName || '正片';
      const curTitle = getCanonicalFavTitleKey(currentPlayingMeta.title);
      const curSite = normalizeCleanKey(currentPlayingMeta.siteName);
      
      if (isLiveMode) {
        const rawTvUrl = window.currentRawStreamUrl || currentStreamUrl;
        const normTvTitle = normalizeCleanKey(currentPlayingMeta.title);
        const idx = favs.findIndex(f => f.type === 'tv' && (f.url === rawTvUrl || f.url === currentStreamUrl || normalizeCleanKey(f.title) === normTvTitle));
        if (idx >= 0) {
          if (favs[idx].url !== rawTvUrl && favs[idx].siteName !== currentPlayingMeta.siteName) {
            favs[idx].url = rawTvUrl;
            favs[idx].siteName = currentPlayingMeta.siteName || '直播';
            favs[idx].savedAt = new Date().toLocaleDateString();
            setStatus(`⭐ 已更新收藏线路为【${escapeHtml(favs[idx].siteName)}】`, true);
          } else {
            favs.splice(idx, 1);
            setStatus("已取消收藏电视频道", true);
          }
        } else {
          favs.unshift({
            title: currentPlayingMeta.title,
            epName: '直播',
            url: rawTvUrl,
            type: 'tv',
            siteName: currentPlayingMeta.siteName || '直播',
            savedAt: new Date().toLocaleDateString()
          });
          setStatus("⭐ 已加入电视收藏", true);
        }
      } else {
        const canonicalTitle = parseTitleAndVersion(currentPlayingMeta.title).canonical || currentPlayingMeta.title;
        const idx = favs.findIndex(f => f.type !== 'tv' && getCanonicalFavTitleKey(f.title) === curTitle && normalizeCleanKey(f.siteName) === curSite);
        if (idx >= 0) {
          if (favs[idx].epName !== currentEpName) {
            favs[idx].epName = currentEpName;
            favs[idx].epIdx = (currentPlayingMeta.epIdx !== undefined) ? currentPlayingMeta.epIdx : currentActiveEp;
            favs[idx].url = currentStreamUrl;
            favs[idx].savedAt = new Date().toLocaleDateString();
            setStatus(`⭐ 已更新【${escapeHtml(currentPlayingMeta.siteName)}】锁定至【${escapeHtml(currentEpName)}】`, true);
          } else {
            favs.splice(idx, 1);
            setStatus(`已取消收藏【${escapeHtml(currentPlayingMeta.siteName)}】`, true);
          }
        } else {
          favs.unshift({
            title: canonicalTitle,
            siteName: cleanSiteName(currentPlayingMeta.siteName),
            epName: currentEpName,
            epIdx: (currentPlayingMeta.epIdx !== undefined) ? currentPlayingMeta.epIdx : currentActiveEp,
            url: currentStreamUrl,
            type: 'vod',
            thumb: currentPlayingMeta.thumb || '',
            censorTag: currentPlayingMeta.censorTag || '',
            vod: currentPlayingMeta.vod || null,
            savedAt: new Date().toLocaleDateString()
          });
          setStatus(`⭐ 已收藏【${escapeHtml(currentPlayingMeta.siteName)} · ${escapeHtml(currentEpName)}】`, true);
        }
      }

      // 1. 本地与 UI 瞬时 0ms 更新高亮
      localStorage.setItem(getCurrentFavKey(), JSON.stringify(favs));
      updateFavIconState(favs);
      setTimeout(() => setStatus("", false), 1500);
      if (currentView === 'fav') {
        renderFavoritesView();
      } else {
        // 同步点亮当前正在展开的片源卡片按钮
        document.querySelectorAll('.source-sub-card').forEach(subCard => {
          const btn = subCard.querySelector('button[id^="fav-btn-"]');
          if (!btn) return;
          const siteTag = subCard.querySelector('.card-sitename-tag')?.textContent || '';
          const normSubSite = normalizeCleanKey(parseTitleAndVersion(siteTag).canonical || siteTag);
          const isFavorited = favs.some(f => f.type !== 'tv' && getCanonicalFavTitleKey(f.title) === curTitle && normalizeCleanKey(f.siteName) === normSubSite);
          if (isFavorited) {
            btn.textContent = `★ 已收藏 (${currentEpName})`;
            btn.style.color = '#facc15';
            btn.style.borderColor = '#facc15';
            btn.style.background = 'rgba(250, 204, 21, 0.12)';
          } else {
            btn.textContent = '☆ 收藏';
            btn.style.color = 'var(--text-sub)';
            btn.style.borderColor = 'var(--border-light)';
            btn.style.background = 'transparent';
          }
        });
      }

      // 2. 后台静默同步至 D1 云数据库
      setD1Data(getCurrentFavKey(), favs);
    }

    let lastSavedTime = 0;
    async function savePlaybackProgress() {
      if (isLiveMode || !currentPlayingMeta || !video.duration || video.currentTime < 2) return;
      const nowSec = Math.floor(video.currentTime);
      if (Math.abs(nowSec - lastSavedTime) < 15) return;
      lastSavedTime = nowSec;

      let history = await getHistoryList();
      const existingIdx = history.findIndex(h => h.key === currentVodUniqueKey);
      const item = {
        key: currentVodUniqueKey,
        title: currentPlayingMeta.title,
        epName: currentPlayingMeta.epName || '正片',
        epIdx: (currentPlayingMeta.epIdx !== undefined) ? currentPlayingMeta.epIdx : currentActiveEp,
        url: currentStreamUrl,
        time: nowSec,
        duration: Math.floor(video.duration),
        siteName: currentPlayingMeta.siteName || '',
        thumb: currentPlayingMeta.thumb || '',
        censorTag: currentPlayingMeta.censorTag || '',
        vod: currentPlayingMeta.vod || null,
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (existingIdx >= 0) history.splice(existingIdx, 1);
      history.unshift(item);
      if (history.length > 50) history.pop();
      setD1Data(getCurrentHistoryKey(), history);
    }

    async function restorePlaybackProgress(expectedGeneration = playbackGeneration) {
      if (isLiveMode || !currentVodUniqueKey) return;
      const expectedVodKey = currentVodUniqueKey;
      const history = await getHistoryList();
      // A slow D1 history read must never seek a newer episode or source.
      if (expectedGeneration !== playbackGeneration || expectedVodKey !== currentVodUniqueKey || isLiveMode) return;
      const record = history.find(h => h.key === expectedVodKey);
      if (record && record.time > 5 && (!video.duration || record.time < video.duration - 15)) {
        video.currentTime = record.time;
        showGestureTip(`⏱ 已自动续播至 ${formatTime(record.time)}`);
      }
    }

    function switchSidebarView(view) {
      if (view !== currentView || view !== 'normal') stopSitePlaybackOnNavigation();
      openAuroraWorkspace();
      currentView = view;
      if (typeof syncCastUiState === 'function') syncCastUiState();
      document.getElementById('btn-show-fav').classList.toggle('active', view === 'fav');
      document.getElementById('btn-show-history').classList.toggle('active', view === 'history');

      if (view === 'fav') renderFavoritesView();
      else if (view === 'history') renderHistoryView();
      else {
        if (currentMode === 'tv') renderList(groups, false);
        else scheduleRenderVodSources();
      }
    }

    /* === 收藏项直接秒播驱动（直接拉起源，免去二次检索） === */
    function playFavoriteVodItem(fav) {
      isLiveMode = false;
      const playItem = {
        id: 'fav_' + (fav.siteName || '') + '_' + Date.now(),
        siteName: fav.siteName || '收藏源',
        versionTag: '',
        vod: fav.vod || {
          vod_name: fav.title,
          vod_play_url: fav.url ? `${fav.epName || '正片'}$${fav.url}` : '',
          vod_pic: fav.thumb || '',
          vod_remarks: fav.epName || ''
        }
      };
      playCurrentVodSource(playItem, (fav.epIdx !== undefined && fav.epIdx >= 0) ? fav.epIdx : (fav.epName || 0), false);
    }

    /* === 我的收藏：多源聚合折叠 + 调取完整选集列表 + 切源自适应 === */
    /* === 我的收藏：同名聚合 + 调取完整选集网格 (图2形态) + 自动补齐剧集元数据 === */
    /* === 我的收藏：同名聚合 + 调取完整选集网格 (图2形态) + 自动补齐剧集元数据 === */
    /* === 我的收藏：同名聚合 + 调取完整选集网格 (图2形态) + 自动补齐剧集元数据 === */
    async function renderFavoritesView() {
    const container = document.getElementById('channel-list');
    container.classList.remove('sg-results-grid');
    // 打开“我的收藏”界面时，强制从云端 D1 获取全网最新同步列表
    const favs = await getFavoritesList(true);

      if (favs.length === 0) {
        container.innerHTML = `<div class="top-unified-bar sg-personal-titlebar"><span class="sources-header-title">⭐ 我的收藏 (0)</span></div><div style="padding:40px 16px;text-align:center;color:var(--text-sub);font-size:13px;">暂无收藏项目<br><span style="font-size:11px;color:var(--text-mute);">播放视频时轻触顶部的 ★ 即可收藏当前源与集数</span></div>`;
        return;
      }

      const frag = document.createDocumentFragment();
      const headerBar = document.createElement('div');
      headerBar.className = 'top-unified-bar sg-personal-titlebar';
      headerBar.innerHTML = `<span class="sources-header-title">⭐ 我的收藏 (${favs.length})</span>`;
      frag.appendChild(headerBar);

      const tvFavs = favs.filter(f => f.type === 'tv');
      const vodFavs = favs.filter(f => f.type !== 'tv');

      // 1. 电视直播收藏
      tvFavs.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <div class="history-info">
            <div class="history-title">📺 ${escapeHtml(item.title)}</div>
            <div class="history-meta">
              <span>直播线路</span>
              <span>${escapeHtml(item.siteName || '电视')}</span>
              <span>${escapeHtml(item.savedAt || '')}</span>
            </div>
          </div>
          <button type="button" class="btn-del-item" title="取消收藏">✕</button>
        `;
        const delBtn = card.querySelector('.btn-del-item');
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            removeFavoriteItem(item.url || item.title, card);
          };
        }
        card.onclick = () => {
          isLiveMode = true;
          currentStreamUrl = item.url;
          currentTitle.textContent = item.title;
          routeBadge.style.display = 'none';
          routeBadge.textContent = '';
          currentPlayingMeta = { title: item.title, epName: '直播', siteName: item.siteName || '直播' };
          updateFavIconState();
          manualPlayOnly(item.url);
        };
        frag.appendChild(card);
      });

      // 2. 影视剧集：按归一化片名强行合并（彻底消除图1分成两张卡片的问题）
      const groupMap = new Map();
      vodFavs.forEach(f => {
        const normKey = normalizeCleanKey(f.title) || (f.title || '未知影视').trim().toLowerCase();
        if (!groupMap.has(normKey)) {
          groupMap.set(normKey, {
            title: f.title.trim(),
            poster: f.thumb,
            items: []
          });
        }
        const entry = groupMap.get(normKey);
        if (!entry.poster && f.thumb) entry.poster = f.thumb;
        entry.items.push(f);
      });

      groupMap.forEach((entry, normKey) => {
        // 同源去重，自动保留最新观看的集数，并清洗掉名称里的图标
        const uniqueSourcesMap = new Map();
        entry.items.forEach(item => {
          const cleanName = (item.siteName || '').replace(/^[🎬\s\:\-]+/, '').trim() || '默认源';
          if (!uniqueSourcesMap.has(cleanName)) {
            uniqueSourcesMap.set(cleanName, item);
          } else {
            const existing = uniqueSourcesMap.get(cleanName);
            if ((item.epIdx ?? 0) >= (existing.epIdx ?? 0)) {
              uniqueSourcesMap.set(cleanName, item);
            }
          }
        });
        const uniqueFavItems = Array.from(uniqueSourcesMap.values());
        const firstFav = uniqueFavItems[0];
        const title = entry.title;
        const posterSrc = entry.poster ? escapeHtml(entry.poster) : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="60"%3E%3Crect width="44" height="60" fill="%23222"/%3E%3C/svg%3E';

        // 构造标准可播放的源对象列表
        const sourceItemList = uniqueFavItems.map((fav, sIdx) => {
          const pureSiteName = (fav.siteName || '收藏源').replace(/^[🎬\s\:\-]+/, '').trim();
          return {
            id: `fav_src_${sIdx}_${Date.now()}`,
            siteName: pureSiteName,
            versionTag: '',
            vod: fav.vod || {
              vod_name: fav.title,
              vod_play_url: fav.url ? `${fav.epName || '正片'}$${fav.url}` : '',
              vod_pic: fav.thumb || '',
              vod_remarks: fav.epName || ''
            },
            savedFavRef: fav
          };
        });

        let activeSourceItem = sourceItemList[0];

        const groupCard = document.createElement('div');
        groupCard.className = 'title-group-box expanded'; // 默认展开展示

        groupCard.innerHTML = `
          <div class="title-group-header">
            <div class="group-header-left">
              <img class="group-poster" src="${posterSrc}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2260%22%3E%3Crect width=%2244%22 height=%2260%22 fill=%22%23222%22/%3E%3C/svg%3E'" />
              <div class="group-info-wrap">
                <div class="group-main-title">${escapeHtml(title)}</div>
                <div class="group-meta-tag">
                  <span class="group-badge-count">${uniqueFavItems.length} 个收藏源</span>
                  <span class="fav-meta-track" id="fav-meta-track-${normKey}" style="color:var(--accent);font-weight:600;">看到: ${escapeHtml(firstFav.epName || '第1集')}</span>
                  <span>${escapeHtml(firstFav.savedAt || '')}</span>
                </div>
              </div>
            </div>
            <div class="group-arrow" style="transform: rotate(180deg);">▼</div>
          </div>
          <div class="group-body-panel" style="display: block;"></div>
        `;

        const headerEl = groupCard.querySelector('.title-group-header');
        const bodyEl = groupCard.querySelector('.group-body-panel');
        const arrowEl = groupCard.querySelector('.group-arrow');

        headerEl.onclick = () => {
          const isExp = groupCard.classList.contains('expanded');
          groupCard.classList.toggle('expanded', !isExp);
          bodyEl.style.display = isExp ? 'none' : 'block';
          arrowEl.style.transform = isExp ? 'rotate(0deg)' : 'rotate(180deg)';
        };

        // 局部刷新函数：锁定当前选中的源，倒序绝对不跳源，并自动滚动到当前集数
        function refreshFavEpisodesBox(curSource) {
          const oldBox = bodyEl.querySelector('.episodes-collapse-box');
          if (oldBox) oldBox.remove();

          const episodes = getEpisodesList(curSource);
          const isCurrentlyPlayingThis = (
            currentPlayingMeta?.title &&
            getCanonicalFavTitleKey(currentPlayingMeta.title) === normKey &&
            normalizeCleanKey(currentPlayingMeta?.siteName) === normalizeCleanKey(curSource.siteName)
          );
          const activeIdx = isCurrentlyPlayingThis
            ? currentActiveEp
            : findMatchingEpisodeIndex(episodes, curSource.savedFavRef?.epName, curSource.savedFavRef?.epIdx ?? 0);

          const collapseBox = document.createElement('div');
          collapseBox.className = 'episodes-collapse-box';
          const epStatusText = formatCurrentEpStatus(episodes, activeIdx);
          const orderBtnLabel = isEpisodeReversed ? '倒序 ⇵' : '正序 ⇵';

          collapseBox.innerHTML =
            '<div class="episodes-header">' +
              '<span>📺 选集 (' + getDisplayEpisodesCount(episodes) + ' 集) - ' + epStatusText + '</span>' +
              '<div class="episodes-actions">' +
                '<button class="btn-ep-order" type="button">' + orderBtnLabel + '</button>' +
                '<span id="ep-arrow" style="font-size:11px;color:var(--text-sub);cursor:pointer;">▼ 折叠/展开</span>' +
              '</div>' +
            '</div>' +
            '<div class="episodes-grid" id="episodes-grid-list-' + normKey + '"></div>';

          // 核心：点击正倒序只改变当前源的选集排列，牢牢锁定当前源，绝不跳回第一个源！
          const orderBtn = collapseBox.querySelector('.btn-ep-order');
          orderBtn.onclick = (e) => {
            e.stopPropagation();
            isEpisodeReversed = !isEpisodeReversed;
            refreshFavEpisodesBox(curSource);
            showGestureTip(isEpisodeReversed ? "选集已切换为：倒序" : "选集已切换为：正序");
          };

          const epGrid = collapseBox.querySelector('.episodes-grid');
          const displayEps = isEpisodeReversed ? episodes.slice().reverse() : episodes;

          displayEps.forEach((ep) => {
            const epIdx = ep.originalIdx;
            const btn = document.createElement('button');
            btn.className = 'ep-item ' + (epIdx === activeIdx ? 'active' : '');
            btn.setAttribute('data-ep-idx', String(epIdx));
            btn.textContent = ep.name;
            btn.onclick = (e) => {
              e.stopPropagation();
              epGrid.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
              btn.classList.add('active');

              // 播放所选集数，并立即同步写回 D1 收藏夹与下方源卡片绿标
              playCurrentVodSource(curSource, epIdx, false);
              curSource.savedFavRef.epName = ep.name;
              curSource.savedFavRef.epIdx = epIdx;
              curSource.savedFavRef.url = ep.url;
              setD1Data(getCurrentFavKey(), favs);

              const trackLabel = groupCard.querySelector('.fav-meta-track');
              if (trackLabel) trackLabel.textContent = '看到: ' + ep.name;
              const activeSubQual = bodyEl.querySelector('.source-sub-card.active-sub .card-quality');
              if (activeSubQual) activeSubQual.textContent = '看到: ' + ep.name;
              refreshFavEpisodesBox(curSource);
            };
            epGrid.appendChild(btn);
          });

          collapseBox.querySelector('.episodes-header').onclick = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            e.stopPropagation();
            const isHide = epGrid.style.display === 'none';
            epGrid.style.display = isHide ? 'grid' : 'none';
            collapseBox.querySelector('#ep-arrow').textContent = isHide ? '▼ 收起' : '▶ 展开选集';
          };

          bodyEl.insertBefore(collapseBox, bodyEl.firstChild);

          // 自动平滑滚动到当前选中的集数，避免手动滑动
          setTimeout(() => {
            const activeBtn = epGrid.querySelector('.ep-item.active');
            if (activeBtn && epGrid.scrollHeight > epGrid.clientHeight) {
              epGrid.scrollTop = Math.max(0, activeBtn.offsetTop - (epGrid.clientHeight / 2) + (activeBtn.clientHeight / 2));
            }
          }, 30);
        }

        // 核心：对收藏的所有线路自动联网同步更新最新集数（让第二个、第三个源也能同步到最新215集）
        function syncSourceEpisodesFromCloud(sItem, onDone) {
          const cleanNormSite = normalizeCleanKey(sItem.siteName);
          const site = parsedSites.find(s => normalizeCleanKey(s.name) === cleanNormSite || s.name === sItem.siteName);
          if (!site || !site.api) { if (onDone) onDone(); return; }

          const queryApi = (searchTerm) => {
            const urlWd = site.api + (site.api.includes('?') ? '&' : '?') + 'ac=videolist&wd=' + encodeURIComponent(searchTerm) + '&out=json&pg=1';
            return fetchWithSmartProxy(urlWd, 4000).then(res => JSON.parse(res)).catch(() => null);
          };

          queryApi(title).then(json => {
            if (json && Array.isArray(json.list) && json.list.length > 0) return json;
            if (title.includes(' ')) return queryApi(title.replace(/\s+/g, ''));
            return null;
          }).then(json => {
            if (json && Array.isArray(json.list) && json.list.length > 0) {
              const matchedVod = json.list.find(v => normalizeCleanKey(v.vod_name) === normKey) || json.list[0];
              if (matchedVod && getEpisodesList({ vod: matchedVod }).length > 0) {
                sItem.vod = matchedVod;
                sItem.savedFavRef.vod = matchedVod;
                setD1Data(getCurrentFavKey(), favs);
              }
            }
            if (onDone) onDone();
          }).catch(() => { if (onDone) onDone(); });
        }

        // 优先尝试从本地/当前内存检索缓存直接补齐整套选集
        const inMemGroup = groupedVodList.find(g => normalizeCleanKey(g.title) === normKey);
        if (inMemGroup) {
          sourceItemList.forEach(sItem => {
            const matchIt = inMemGroup.items.find(it => normalizeCleanKey(it.siteName) === normalizeCleanKey(sItem.siteName));
            if (matchIt && matchIt.vod && getEpisodesList(matchIt).length > getEpisodesList(sItem).length) {
              sItem.vod = matchIt.vod;
              sItem.savedFavRef.vod = matchIt.vod;
            }
          });
          setD1Data(getCurrentFavKey(), favs);
        }

        refreshFavEpisodesBox(activeSourceItem);
        // 后台静默为该剧收藏的所有源（第1、第2、第3个源全部）同步全网最新连载集数
        sourceItemList.forEach((sItem) => {
          syncSourceEpisodesFromCloud(sItem, () => {
            if (activeSourceItem === sItem) {
              refreshFavEpisodesBox(sItem);
            }
          });
        });

        // 渲染收藏的源线路子卡片
        sourceItemList.forEach((sItem, idx) => {
          const favRef = sItem.savedFavRef;
          const subCard = document.createElement('div');
          subCard.className = 'source-sub-card ' + (idx === 0 ? 'active-sub' : '');
          const cTag = favRef.censorTag || '';
          const censorHtml = cTag ? ('<span class="card-censor ' + (cTag.includes('无码') ? 'c-wuma' : 'c-youma') + '">' + escapeHtml(cTag) + '</span>') : '';

          subCard.innerHTML =
            '<div class="source-sub-left">' +
              '<span class="card-sitename-tag">🎬 ' + escapeHtml(sItem.siteName) + '</span>' +
              '<span class="card-quality q-1080">看到: ' + escapeHtml(favRef.epName || '正片') + '</span>' +
              censorHtml +
            '</div>' +
            '<div class="card-status-bar">' +
              '<button class="btn-del-item" title="取消该源收藏">✕</button>' +
            '</div>';

          // 安全绑定删除事件，绝不因为英文单引号或特殊字符报错
          const delBtn = subCard.querySelector('.btn-del-item');
          if (delBtn) {
            delBtn.onclick = (e) => {
              e.stopPropagation();
              removeSingleFavSource(favRef.title, favRef.siteName);
            };
          }

          // 点击切换源：起播并自适应重绘当前源的完整选集网格
          subCard.onclick = (e) => {
            e.stopPropagation();
            bodyEl.querySelectorAll('.source-sub-card').forEach(el => el.classList.remove('active-sub'));
            subCard.classList.add('active-sub');
            activeSourceItem = sItem;

            playCurrentVodSource(sItem, favRef.epName || favRef.epIdx || 0, false);
            refreshFavEpisodesBox(sItem);
            syncSourceEpisodesFromCloud(sItem, () => {
              if (activeSourceItem === sItem) {
                refreshFavEpisodesBox(sItem);
              }
            });
          };

          bodyEl.appendChild(subCard);
        });

        frag.appendChild(groupCard);
      });

      container.replaceChildren(frag);
    }

    /* === 独立移除某一线路收藏并刷新 === */
    async function removeSingleFavSource(title, siteName) {
      let favs = await getFavoritesList();
      const normTarget = normalizeCleanKey(title);
      const cleanSite = (siteName || '').replace(/^[🎬\s\:\-]+/, '').trim().toLowerCase();
      favs = favs.filter(f => {
        const isSameTitle = normalizeCleanKey(f.title) === normTarget;
        const isSameSite = (f.siteName || '').replace(/^[🎬\s\:\-]+/, '').trim().toLowerCase() === cleanSite;
        return !(isSameTitle && isSameSite);
      });
      await setD1Data(getCurrentFavKey(), favs);
      updateFavIconState();
      renderFavoritesView();
    }

    async function removeFavoriteItem(matchKey, cardEl) {
      if (cardEl) cardEl.remove();
      let favs = await getFavoritesList();
      favs = favs.filter(f => (f.url || f.title) !== matchKey);
      await setD1Data(getCurrentFavKey(), favs);
      updateFavIconState();
      if (favs.length === 0) renderFavoritesView();
    }

    async function renderHistoryView() {
      const container = document.getElementById('channel-list');
      container.classList.remove('sg-results-grid');
      const history = await getHistoryList();

      if (history.length === 0) {
        container.innerHTML = `<div class="top-unified-bar sg-personal-titlebar"><span class="sources-header-title">🕒 观看历史 (0)</span><button type="button" class="sg-personal-clear" onclick="clearAllHistory()">清空</button></div><div style="padding:40px 16px;text-align:center;color:var(--text-sub);font-size:13px;">暂无播放历史记录<br><span style="font-size:11px;color:var(--text-mute);">播放视频时将自动在此记录进度</span></div>`;
        return;
      }

      const frag = document.createDocumentFragment();
      const headerBar = document.createElement('div');
      headerBar.className = 'top-unified-bar sg-personal-titlebar';
      headerBar.innerHTML = `
        <span class="sources-header-title">🕒 观看历史 (${history.length})</span>
        <button type="button" class="sg-personal-clear" onclick="clearAllHistory()">清空</button>
      `;
      frag.appendChild(headerBar);

      history.forEach((item) => {
        const tag = item.censorTag || (isNSFWSource(item.siteName) ? detectCensorshipTag({ vod_name: item.title }, item.siteName) : '');
        const censorHtml = tag ? `<span class="card-censor ${tag.includes('无码') ? 'c-wuma' : 'c-youma'}">${escapeHtml(tag)}</span>` : '';
        const uniqueKey = item.key || item.url || `${item.title}_${item.epName}`;

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <div class="history-info">
            <div class="history-title">
              <span>${escapeHtml(item.title)}</span>
              <span style="font-size:12px;color:var(--accent);">(${escapeHtml(item.epName)})</span>
              ${censorHtml}
            </div>
            <div class="history-meta">
              <span>看到：${formatTime(item.time)} / ${formatTime(item.duration)}</span>
              <span>${escapeHtml(item.siteName)}</span>
              <span>${escapeHtml(item.updatedAt || '')}</span>
            </div>
          </div>
          <button type="button" class="btn-del-item" title="删除">✕</button>
        `;

        const delBtn = card.querySelector('.btn-del-item');
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            removeHistoryItem(uniqueKey, card);
          };
        }

        card.onclick = () => {
          if (item.vod) {
            playCurrentVodSource({
              id: 'hist_' + Date.now(),
              siteName: item.siteName || '历史源',
              versionTag: '',
              vod: item.vod
            }, (item.epIdx !== undefined && item.epIdx >= 0) ? item.epIdx : (item.epName || 0), false);
          } else {
            isLiveMode = false;
            currentStreamUrl = item.url;
            currentVodUniqueKey = item.key;
            currentActiveEp = item.epIdx || 0;
            currentTitle.textContent = `${item.title} - ${item.epName}`;
            routeBadge.style.display = 'inline-block';
            routeBadge.textContent = item.siteName;
            currentPlayingMeta = {
              title: item.title,
              epName: item.epName,
              epIdx: item.epIdx || 0,
              siteName: item.siteName,
              thumb: item.thumb || '',
              censorTag: tag,
              url: item.url
            };
            updateFavIconState();
            manualPlayOnly(item.url);
          }
        };
        frag.appendChild(card);
      });

      container.replaceChildren(frag);
    }

    async function removeHistoryItem(key, cardEl) {
      if (cardEl) {
        cardEl.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        cardEl.style.opacity = '0';
        cardEl.style.maxHeight = '0';
        cardEl.style.paddingTop = '0';
        cardEl.style.paddingBottom = '0';
        cardEl.style.overflow = 'hidden';
        setTimeout(() => {
          cardEl.remove();
          const container = document.getElementById('channel-list');
          const cards = container.querySelectorAll('.history-card');
          const titleEl = container.querySelector('.sources-header-title');
          if (titleEl) titleEl.textContent = `🕒 播放历史 (${cards.length})`;
          if (cards.length === 0) {
            container.innerHTML = `<div style="padding:40px 16px;text-align:center;color:var(--text-sub);font-size:13px;">暂无播放历史记录<br><span style="font-size:11px;color:var(--text-mute);">播放视频时将自动在此记录进度</span></div>`;
          }
        }, 200);
      }
      let history = await getHistoryList();
      history = history.filter(h => (h.key || h.url || `${h.title}_${h.epName}`) !== key);
      await setD1Data(getCurrentHistoryKey(), history);
    }

    async function clearAllHistory() {
      if (!confirm("确定清空全部历史记录吗？")) return;
      await setD1Data(getCurrentHistoryKey(), []);
      renderHistoryView();
    }

    video.addEventListener('timeupdate', () => {
      savePlaybackProgress();
      if (isDraggingProgress) return;

      if (isLiveMode || !video.duration || !isFinite(video.duration)) {
        streamTimeEl.textContent = "直播";
        progressBar.style.width = "100%";
        return;
      }
      const cur = video.currentTime;
      const dur = video.duration;
      streamTimeEl.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      progressBar.style.width = `${(cur / dur) * 100}%`;
    });

    function calcProgressRatio(clientX) {
      const rect = progressTrack.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    function onPointerDown(e) {
      if (isLiveMode || !video.duration || !isFinite(video.duration)) return;
      isDraggingProgress = true;
      showControls();
      progressContainer.classList.add('dragging');
      progressContainer.setPointerCapture(e.pointerId);

      const ratio = calcProgressRatio(e.clientX);
      progressBar.style.width = `${ratio * 100}%`;
      dragTargetTime = ratio * video.duration;
      streamTimeEl.textContent = `${formatTime(dragTargetTime)} / ${formatTime(video.duration)}`;
    }

    function onPointerMove(e) {
      if (!isDraggingProgress) return;
      showControls();
      const ratio = calcProgressRatio(e.clientX);
      progressBar.style.width = `${ratio * 100}%`;
      dragTargetTime = ratio * video.duration;
      streamTimeEl.textContent = `${formatTime(dragTargetTime)} / ${formatTime(video.duration)}`;
    }

    function onPointerUp(e) {
      if (!isDraggingProgress) return;
      isDraggingProgress = false;
      progressContainer.classList.remove('dragging');
      try { progressContainer.releasePointerCapture(e.pointerId); } catch (_) {}
      video.currentTime = dragTargetTime;
      showControls();
    }

    progressContainer.addEventListener('pointerdown', onPointerDown);
    progressContainer.addEventListener('pointermove', onPointerMove);
    progressContainer.addEventListener('pointerup', onPointerUp);
    progressContainer.addEventListener('pointercancel', onPointerUp);

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': case 'KeyJ': e.preventDefault(); if (!isLiveMode) { video.currentTime = Math.max(0, video.currentTime - 10); showControls(); } break;
        case 'ArrowRight': case 'KeyL': e.preventDefault(); if (!isLiveMode) { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showControls(); } break;
        case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(1, video.volume + 0.1)); volSlider.value = video.volume; showControls(); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, video.volume - 0.1)); volSlider.value = video.volume; showControls(); break;
        case 'KeyM': e.preventDefault(); toggleMute(); break;
        case 'KeyF': e.preventDefault(); toggleFullScreen(); break;
      }
    });

    function togglePlay() {
      if (!currentStreamUrl) return;
      if (video.paused) video.play().then(() => { updatePlayBtn(true); showControls(); }).catch(() => {});
      else { video.pause(); updatePlayBtn(false); showControls(); }
    }

    function updatePlayBtn(isPlaying) {
      playIcon.style.display = isPlaying ? 'none' : 'block';
      pauseIcon.style.display = isPlaying ? 'block' : 'none';
    }

    function toggleMute() {
      video.muted = !video.muted;
      document.getElementById('volume-icon').setAttribute('stroke', video.muted ? '#ff6b6b' : '#fff');
      volSlider.value = video.muted ? 0 : video.volume;
    }

    function toggleFullScreen() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS && video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return; }
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => enterPseudoFullscreen());
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else enterPseudoFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    }

    function enterPseudoFullscreen() { wrap.classList.toggle('pseudo-fullscreen'); }

    function openPlayer(type) {
      const targetUrl = (isLiveMode && window.currentRawStreamUrl) ? window.currentRawStreamUrl : currentStreamUrl;
      if (!isSafeUrl(targetUrl)) { alert("当前链接无效！"); return; }
      const rawUrl = targetUrl.trim();
      let s = "";
      switch (type) {
        case 'vlc': s = navigator.userAgent.match(/(iPhone|iPad|iPod)/i) ? `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(rawUrl)}` : `vlc://${rawUrl}`; break;
        case 'potplayer': s = `potplayer://${rawUrl.replace(/^https?:\/\//i, '')}`; break;
        case 'iina': s = `iina://weblink?url=${encodeURIComponent(rawUrl)}`; break;
        case 'nplayer': s = `nplayer-${rawUrl}`; break;
        case 'aptv': s = `aptv://install?url=${encodeURIComponent(rawUrl)}`; break;
      }
      if (s) window.location.href = s;
    }

    function copyCurrentUrl() {
      if (!isSafeUrl(currentStreamUrl)) { alert("请先选择有效播放线路！"); return; }
      navigator.clipboard.writeText(currentStreamUrl).then(() => alert("已复制直链：\n" + currentStreamUrl))
        .catch(() => prompt("请手动复制链接：", currentStreamUrl));
    }

    function toggleClearBtn(val) { document.getElementById('clear-kw').style.display = val.trim() ? 'block' : 'none'; }
    function clearSearchInput() {
      const input = document.getElementById('filter');
      input.value = '';
      toggleClearBtn('');
      try { sessionStorage.removeItem(KEY_SESSION_VOD_STATE); } catch (_) {}
      groupedVodList = [];
      currentSearchingWord = '';
      activeGroupTitle = '';
      activeSubItemId = '';
      document.getElementById('channel-list').innerHTML = `<div style="padding: 30px 16px; color: var(--text-sub); text-align: center; font-size: 13px;">在上方输入关键词搜索 🔍</div>`;
      input.focus();
    }

    const SVG_EYE_OPEN = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const SVG_EYE_SLASH = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    function renderGateEyeIcon(isVisible) {
      const btn = document.getElementById('gate-eye-toggle');
      if (btn) btn.innerHTML = isVisible ? SVG_EYE_OPEN : SVG_EYE_SLASH;
    }

    function toggleGatePasswordVisibility() {
      const pwd = document.getElementById('gate-password');
      const isVisible = (pwd.type === 'text');
      pwd.type = isVisible ? 'password' : 'text';
      renderGateEyeIcon(!isVisible);
    }

    const SVG_SUN = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="12" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const SVG_MOON = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    function applyGlobalTheme(themeMode) {
      currentThemeSetting = themeMode;
      let isDark = false;

      if (themeMode === 'light') {
        isDark = false;
      } else if (themeMode === 'dark') {
        isDark = true;
      } else {
        const hour = new Date().getHours();
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        isDark = prefersDark || (hour >= 19 || hour < 6);
      }

      const bgHex = isDark ? '#061326' : '#eaf2fd';
      const syncSafariViewportTint = (flushModalLayer = false) => {
        document.documentElement.classList.toggle('theme-light', !isDark);
        document.documentElement.style.backgroundColor = bgHex;
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        document.body.classList.toggle('theme-light', !isDark);
        document.body.style.backgroundColor = bgHex;

        // Re-mount <meta name="theme-color"> in <head> so WebKit immediately fires themeColorChanged()
        const oldMeta = document.getElementById('sg-theme-color-meta') || document.querySelector('meta[name="theme-color"]');
        if (oldMeta) {
          oldMeta.setAttribute('content', bgHex);
          if (flushModalLayer && oldMeta.parentNode) {
            const freshMeta = oldMeta.cloneNode(true);
            freshMeta.setAttribute('content', bgHex);
            oldMeta.parentNode.replaceChild(freshMeta, oldMeta);
          }
        }

        // If the settings modal (#modal-mask) is currently open, flush its fixed backdrop-filter
        // compositing layer so iOS Safari re-samples the top and bottom bars without waiting for "保存配置"
        if (flushModalLayer) {
          const openMask = document.getElementById('modal-mask');
          if (openMask && openMask.style.display === 'flex') {
            openMask.style.animation = 'none';
            openMask.style.backgroundColor = bgHex;
            openMask.style.display = 'none';
            void openMask.offsetHeight;
            openMask.style.display = 'flex';
          }
          window.scrollBy(0, 0);
        }
      };

      syncSafariViewportTint(true);
      setTimeout(() => syncSafariViewportTint(true), 80);
      setTimeout(() => syncSafariViewportTint(true), 260);

      const gateScreen = document.getElementById('auth-gate-screen');
      if (gateScreen) gateScreen.classList.toggle('dark-theme', isDark);

      const gateThemeBtn = document.getElementById('gate-theme-toggle');
      if (gateThemeBtn) gateThemeBtn.innerHTML = isDark ? SVG_MOON : SVG_SUN;

      const mainThemeBtn = document.getElementById('main-quick-theme-btn');
      if (mainThemeBtn) mainThemeBtn.innerHTML = isDark ? SVG_MOON : SVG_SUN;

      const sel = document.getElementById('sys-theme-select');
      if (sel) sel.value = themeMode;
    }

    function toggleGlobalThemeClick() {
      const isCurrentlyDark = !document.body.classList.contains('theme-light');
      const newMode = isCurrentlyDark ? 'light' : 'dark';
      applyGlobalTheme(newMode);
      localStorage.setItem(KEY_THEME_PREF, newMode);
      setD1Data(KEY_THEME_PREF, newMode);
      showGestureTip(newMode === 'light' ? "☀️ 已切至白天白色主题" : "🌙 已切至夜间黑色主题");
    }

    function changeSystemTheme(val) {
      const sel = document.getElementById('sys-theme-select');
      if (sel && typeof sel.blur === 'function') {
        try { sel.blur(); } catch (_) {}
      }
      applyGlobalTheme(val);
      localStorage.setItem(KEY_THEME_PREF, val);
      setD1Data(KEY_THEME_PREF, val);
      showGestureTip("✓ 主题外观已更新");
    }

    function showGateError(msg) {
      const err = document.getElementById('gate-error-msg');
      err.textContent = msg;
      err.style.display = 'block';
    }

    function checkGateInputsReady() {
      const u = (document.getElementById('gate-username').value || '').trim();
      const p = (document.getElementById('gate-password').value || '').trim();
      const btn = document.getElementById('gate-submit-btn');
      if (u && p) btn.classList.add('btn-ready');
      else btn.classList.remove('btn-ready');
    }

    function switchGateAuthMode() {
      if (gateAuthMode === 'init_admin') return;
      const isLogin = gateAuthMode === 'login';
      gateAuthMode = isLogin ? 'register' : 'login';
      document.getElementById('gate-submit-btn').textContent = isLogin ? '注 册' : '登 录';
      document.getElementById('gate-switch-link').textContent = isLogin ? '返回账号登录' : '注册新账号';
      document.getElementById('gate-error-msg').style.display = 'none';
      checkGateInputsReady();
    }

    async function submitGateAuth() {
      const u = document.getElementById('gate-username').value.trim();
      const p = document.getElementById('gate-password').value;
      if (!u || !p) { showGateError('请输入账号和密码'); return; }
      const btn = document.getElementById('gate-submit-btn');
      btn.disabled = true;
      try {
        const action = gateAuthMode === 'init_admin' ? 'bootstrap' : gateAuthMode;
        const response = await fetch('/api/auth', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,username:u,password:p})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '登录失败');
        localStorage.removeItem(KEY_SAVED_CREDS);
        localStorage.removeItem(KEY_CURRENT_USER);
        document.getElementById('gate-password').value = '';
        location.reload();
      } catch (e) { showGateError(e.message || '请求失败'); }
      finally { btn.disabled = false; }
    }

    async function logoutCurrentUser() {
      try { await fetch('/api/auth', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}); } catch (_) {}
      stopRemoteTvTranscode();
      destroyHlsInstance();
      updatePlayBtn(false);
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (_) {}
      currentStreamUrl = '';
      currentPlayingMeta = null;

      currentUser = null;
      try { sessionStorage.removeItem(KEY_SESSION_PAGE_STATE); sessionStorage.removeItem(KEY_SESSION_VOD_STATE); } catch (_) {}
      localStorage.removeItem(KEY_CURRENT_USER);
      localStorage.removeItem(KEY_SAVED_CREDS);
      updateMainRoleButton();
      closeSourceModal();
      closeSitesModal();
      closeAccountsModal();
      closeUserAccountModal();
      document.getElementById('gate-username').value = '';
      document.getElementById('gate-password').value = '';
      checkGateInputsReady();
      
      if (true) {
        document.getElementById('auth-gate-screen').style.display = 'flex';
      } else {
        document.getElementById('auth-gate-screen').style.display = 'none';
        showGestureTip("✓ 已退出登录");
      }
    }

    function updateMainRoleButton() {
      const btn = document.getElementById('btn-open-settings');
      if (currentUser && currentUser.role === 'user') {
        btn.textContent = "👤 个人账户";
        btn.style.color = "#54a56a";
      } else {
        btn.textContent = "⚙ 设置";
        btn.style.color = "var(--text-main)";
      }
    }

    function handleMainSettingsButtonClick() {
      stopSitePlaybackOnNavigation();
      if (currentUser && currentUser.role === 'user') {
        openUserAccountModal();
      } else {
        openSourceModal();
      }
    }

    function openUserAccountModal() {
      if (!currentUser) return;
      document.getElementById('ua-username-display').textContent = currentUser.username;
      document.getElementById('user-account-modal-mask').style.display = 'flex';
    }

    function closeUserAccountModal() {
      document.getElementById('user-account-modal-mask').style.display = 'none';
    }

    function logoutCurrentUserFromAccountModal() {
      logoutCurrentUser();
    }

    function openSitesModal() {
      if (!currentUser || currentUser.role !== 'admin') {
        alert("仅主管理员有权访问此设置！");
        return;
      }
      renderSitesManagerList();
      document.getElementById('sites-modal-mask').style.display = 'flex';
    }
    function closeSitesModal() {
      document.getElementById('sites-modal-mask').style.display = 'none';
    }

    function openAccountsModal() {
      if (!currentUser || currentUser.role !== 'admin') {
        alert("仅主管理员有权访问此设置！");
        return;
      }
      renderUsersManagerList();
      document.getElementById('accounts-modal-mask').style.display = 'flex';
    }
    function closeAccountsModal() {
      document.getElementById('accounts-modal-mask').style.display = 'none';
    }

    function renderSourceGroupsList() {
      const container = document.getElementById('source-groups-list-container');
      if (!container) return;

      container.innerHTML = sourceGroups.map(group => {
        const countText = (!group.sites || group.sites[0] === '*') ? '全部可用源' : `${group.sites.length} 个勾选源`;
        return `
          <div class="group-card-item">
            <div>
              <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(group.name)}</span>
              ${group.isDefault ? `<span style="background:#238636;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:4px;">默认</span>` : ''}
              <span style="color:var(--accent); font-size:11px; margin-left:6px;">(${countText})</span>
            </div>
            <div>
              <button type="button" class="btn-small-perm" onclick="openGroupSitesConfigModal('${group.id}')">⚙ 选源</button>
              ${!group.isDefault ? `<button type="button" class="btn-small-perm" style="background:#283e2e;color:#4ade80;border-color:#2ea043;margin-left:4px;" onclick="setDefaultSourceGroup('${group.id}')">设为默认</button>` : ''}
              ${(!group.isDefault && sourceGroups.length > 1) ? `<button type="button" class="btn-small-del" title="删除分组" onclick="deleteSourceGroup('${group.id}')">🗑</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderUsersManagerList() {
      const container = document.getElementById('users-items-container');
      const badge = document.getElementById('user-count-badge');
      const badgeSub = document.getElementById('user-count-badge-sub');
      if (badge) badge.textContent = userList.length;
      if (badgeSub) badgeSub.textContent = userList.length;

      renderSourceGroupsList();

      if (!userList || userList.length === 0) {
        container.innerHTML = '<div style="padding:8px 0; text-align:center; color:var(--text-sub); font-size:12px;">暂无注册成员账号</div>';
        return;
      }

      container.innerHTML = userList.map((user, idx) => {
        const group = sourceGroups.find(g => g.id === user.groupId) || { name: user.groupName || '默认分组' };
        return `
          <div class="site-toggle-row">
            <div>
              <span style="color:var(--text-main); font-weight:500;">👤 ${escapeHtml(user.username)}</span>
              <span style="font-size:10px; color:#54a56a; margin-left:6px;">[分组: ${escapeHtml(group.name)}]</span>
            </div>
            <div>
              <button type="button" class="btn-small-perm" onclick="openUserGroupAssignModal(${idx})">🔑 分配分组</button>
              <button type="button" class="btn-small-del" title="删除账号并物理清除其云端数据" onclick="deleteUserAccount(${idx})">🗑 删除</button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function promptAddSourceGroup() {
      const name = prompt("请输入新视频源分组的名称（例如: VIP极速组、精选动漫组）：");
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      if (sourceGroups.some(g => g.name === cleanName)) {
        alert("已存在同名分组！");
        return;
      }
      const newGroup = {
        id: 'g_' + Date.now(),
        name: cleanName,
        sites: ['*'],
        isDefault: false
      };
      sourceGroups.push(newGroup);
      setD1Data(KEY_SOURCE_GROUPS, sourceGroups);
      renderUsersManagerList();
      showGestureTip(`✓ 分组【${cleanName}】已创建`);
    }

    async function setDefaultSourceGroup(groupId) {
      sourceGroups.forEach(g => {
        g.isDefault = (g.id === groupId);
      });
      setD1Data(KEY_SOURCE_GROUPS, sourceGroups);
      renderUsersManagerList();
      showGestureTip("✓ 已更新默认分组");
    }

    async function deleteSourceGroup(groupId) {
      const g = sourceGroups.find(item => item.id === groupId);
      if (!confirm(`确定删除分组【${g.name}】吗？属于该组的成员将自动重置到默认组。`)) return;
      sourceGroups = sourceGroups.filter(item => item.id !== groupId);
      const defaultGroup = sourceGroups.find(item => item.isDefault) || sourceGroups[0];
      
      userList.forEach(u => {
        if (u.groupId === groupId) {
          u.groupId = defaultGroup.id;
          u.groupName = defaultGroup.name;
        }
      });
      clearVodSearchSessionCache();
      setD1Data(KEY_SOURCE_GROUPS, sourceGroups);
      setD1Data(KEY_USERS_LIST, userList);
      renderUsersManagerList();
    }

    function openGroupSitesConfigModal(groupId) {
      currentEditingGroupId = groupId;
      const group = sourceGroups.find(g => g.id === groupId);
      document.getElementById('perm-user-title').textContent = `🔑 配置【${group.name}】的视频源`;

      const grid = document.getElementById('perm-sites-grid');
      const isAll = !group.sites || group.sites[0] === '*';
      const allowed = group.sites || [];

      grid.innerHTML = parsedSites.map(site => {
        const checked = isAll || allowed.includes(site.name);
        return `
          <label class="perm-site-chip">
            <input type="checkbox" class="site-perm-checkbox" data-sitename="${escapeHtml(site.name)}" ${checked ? 'checked' : ''}>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(site.name)}</span>
          </label>
        `;
      }).join('');

      document.getElementById('user-perm-modal-mask').style.display = 'flex';
    }

    function closeUserPermModal() {
      document.getElementById('user-perm-modal-mask').style.display = 'none';
      currentEditingGroupId = null;
    }

    function checkAllPermSites(checked) {
      document.querySelectorAll('.site-perm-checkbox').forEach(cb => cb.checked = checked);
    }

    async function saveGroupPermChanges() {
      if (!currentEditingGroupId) return;
      const group = sourceGroups.find(g => g.id === currentEditingGroupId);
      const checkboxes = document.querySelectorAll('.site-perm-checkbox');
      const selected = [];
      checkboxes.forEach(cb => {
        if (cb.checked) selected.push(cb.getAttribute('data-sitename'));
      });
      group.sites = (selected.length === checkboxes.length) ? ['*'] : selected;

      clearVodSearchSessionCache();
      setD1Data(KEY_SOURCE_GROUPS, sourceGroups);
      renderUsersManagerList();
      closeUserPermModal();
      showGestureTip("✓ 源列表已保存");
    }

    function openUserGroupAssignModal(idx) {
      userAssigningIdx = idx;
      const user = userList[idx];
      document.getElementById('assign-group-modal-title').textContent = `👤 为【${user.username}】分配源分组`;

      const listContainer = document.getElementById('assign-groups-list');
      listContainer.innerHTML = sourceGroups.map(g => {
        const isCurrent = (user.groupId === g.id || (!user.groupId && g.isDefault));
        return `
          <button type="button" class="btn-action" style="text-align:left; background:${isCurrent ? 'var(--accent-soft)' : 'var(--bg-card)'}; border:1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-light)'}; color:var(--text-main); padding:10px;" onclick="selectGroupForUser('${g.id}')">
            <div style="font-weight:600;">${escapeHtml(g.name)} ${g.isDefault ? '<span style="color:#4ade80;font-size:11px;">[默认]</span>' : ''}</div>
            <div style="font-size:11px; color:var(--text-sub); margin-top:2px;">${(!g.sites || g.sites[0] === '*') ? '包含所有可用源' : '包含 ' + g.sites.length + ' 个专属源'}</div>
          </button>
        `;
      }).join('');

      document.getElementById('user-group-assign-modal-mask').style.display = 'flex';
    }

    function closeUserGroupAssignModal() {
      document.getElementById('user-group-assign-modal-mask').style.display = 'none';
      userAssigningIdx = -1;
    }

    async function selectGroupForUser(groupId) {
      if (userAssigningIdx < 0) return;
      const user = userList[userAssigningIdx];
      const g = sourceGroups.find(item => item.id === groupId);
      user.groupId = g.id;
      user.groupName = g.name;

      setD1Data(KEY_USERS_LIST, userList);
      renderUsersManagerList();
      closeUserGroupAssignModal();
      showGestureTip(`✓ 已分配到【${g.name}】`);
    }

    async function adminAddNewUser() {
      const u = (document.getElementById('new-user-name').value || '').trim();
      const p = (document.getElementById('new-user-pass').value || '').trim();
      if (!u || !p) { alert("账号或密码错误"); return; }
      if ((adminAccount && u === adminAccount.username) || userList.some(item => item.username === u)) {
        alert("账号已存在");
        return;
      }
      const passHash = await hashPassword(p);
      const defaultGroup = sourceGroups.find(g => g.isDefault) || sourceGroups[0];
      userList.push({ username: u, passHash: passHash, groupId: defaultGroup.id, groupName: defaultGroup.name });
      setD1Data(KEY_USERS_LIST, userList);
      document.getElementById('new-user-name').value = '';
      document.getElementById('new-user-pass').value = '';
      renderUsersManagerList();
      showGestureTip("✓ 添加成功");
    }

    async function deleteUserAccount(idx) {
      const target = userList[idx];
      if (!confirm(`确定彻底删除账号【${target.username}】吗？\n警告：删除后该用户的云端所有收藏与历史记录将被彻底销毁，即使日后再次注册同名账号也绝不会恢复！`)) return;
      
      const uName = target.username;
      userList.splice(idx, 1);

      const favKey = `favs_u_${uName}`;
      const histKey = `history_u_${uName}`;
      
      purgeD1Key(favKey);
      purgeD1Key(histKey);
      setD1Data(KEY_USERS_LIST, userList);

      renderUsersManagerList();
      showGestureTip("✓ 账号及全部数据已彻底销毁");
    }

    function toggleRequireLoginSwitch(checked) {
      authConfig.requireLogin = checked;
      localStorage.setItem(KEY_AUTH_CONFIG, JSON.stringify(authConfig));
      setD1Data(KEY_AUTH_CONFIG, authConfig);
      showGestureTip(checked ? "✓ 门禁已开启" : "✓ 门禁已关闭");
    }

    async function promptCustomFailureThreshold() {
      if (!currentUser || currentUser.role !== 'admin') {
        alert("仅主管理员有权修改此设置！");
        return;
      }
      const val = prompt("请输入失效自动禁用阈值次数（达到该次数后自动禁用并沉底）：", failThreshold);
      if (val === null) return;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        alert("请输入大于 0 的有效整数！");
        return;
      }
      failThreshold = num;
      localStorage.setItem(KEY_FAIL_THRESHOLD, String(failThreshold));
      setD1Data(KEY_FAIL_THRESHOLD, String(failThreshold));

      for (const siteName in sourceFailures) {
        const count = sourceFailures[siteName]?.count || 0;
        if (count >= failThreshold && !disabledSites.includes(siteName)) {
          disabledSites.push(siteName);
        }
      }
      clearVodSearchSessionCache();
      await setD1Data(KEY_DISABLED_SITES, disabledSites);
      renderSitesManagerList();
      showGestureTip(`✓ 禁用阈值已同步设置为 ${failThreshold} 次`);
    }

    async function recordSourceFailure(siteName, videoKey) {
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!siteName) return;

      const vKey = videoKey || currentVodUniqueKey || currentPlayingMeta?.title || '未知影片';
      if (!sourceFailures[siteName]) {
        sourceFailures[siteName] = { count: 0, failedVideos: [] };
      }
      const rec = sourceFailures[siteName];
      if (!rec.failedVideos) rec.failedVideos = [];

      if (!rec.failedVideos.includes(vKey)) {
        rec.failedVideos.push(vKey);
        rec.count = rec.failedVideos.length;

        if (rec.count >= failThreshold && !disabledSites.includes(siteName)) {
          disabledSites.push(siteName);
          await setD1Data(KEY_DISABLED_SITES, disabledSites);
          showGestureTip(`⚠️ 源【${siteName}】失效达到 ${failThreshold} 次，已自动禁用并沉底`);
        }
        await setD1Data(KEY_SOURCE_FAILURES, sourceFailures);

        if (document.getElementById('sites-modal-mask').style.display === 'flex') {
          renderSitesManagerList();
        }
      }
    }

    async function resetAllFailedSites() {
      if (!currentUser || currentUser.role !== 'admin') {
        alert("仅主管理员有权执行此操作！");
        return;
      }
      if (!confirm("确定重置所有源的失效统计并恢复启用吗？")) return;
      sourceFailures = {};
      disabledSites = [];
      clearVodSearchSessionCache();
      await setD1Data(KEY_SOURCE_FAILURES, sourceFailures);
      await setD1Data(KEY_DISABLED_SITES, disabledSites);
      renderSitesManagerList();
      showGestureTip("✓ 已重置全部失效统计并恢复");
    }

    function clearVodSearchSessionCache() {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('vod_cache_')) sessionStorage.removeItem(k);
        }
      } catch (_) {}
    }

    function renderSitesManagerList() {
      const container = document.getElementById('sites-items-container');
      const badge = document.getElementById('sites-count-badge');
      const badgeSub = document.getElementById('sites-count-badge-sub');
      if (badge) badge.textContent = parsedSites.length;
      if (badgeSub) badgeSub.textContent = parsedSites.length;
      const thBadge = document.getElementById('custom-threshold-badge');
      if (thBadge) thBadge.textContent = failThreshold;

      if (!parsedSites || parsedSites.length === 0) {
        container.innerHTML = '<div style="padding:10px;text-align:center;color:var(--text-sub);font-size:12px;">暂无解析到的视频源，请先同步订阅或手动添加</div>';
        return;
      }

      const sortedSites = parsedSites.slice().sort((a, b) => {
        const isDisA = disabledSites.includes(a.name) ? 1 : 0;
        const isDisB = disabledSites.includes(b.name) ? 1 : 0;
        if (isDisA !== isDisB) return isDisA - isDisB;
        const failA = sourceFailures[a.name]?.count || 0;
        const failB = sourceFailures[b.name]?.count || 0;
        return failB - failA;
      });

      container.innerHTML = '';
      sortedSites.forEach((site) => {
        const isDis = disabledSites.includes(site.name);
        const failCount = sourceFailures[site.name]?.count || 0;

        const row = document.createElement('div');
        row.className = 'site-toggle-row';
        if (isDis) row.style.cssText = 'opacity:0.65;background:rgba(0,0,0,0.1);';

        row.innerHTML = `
          <div style="flex:1.2; min-width:0; display:flex; align-items:center;">
            <span style="color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🎬 ${escapeHtml(site.name)}</span>
          </div>
          <div style="flex:1.5; display:flex; align-items:center; justify-content:center; gap:8px;">
            <span style="width:40px; text-align:center; font-family:monospace; font-size:12px; font-weight:600; color:${failCount > 0 ? (failCount >= failThreshold ? '#ef4444' : '#facc15') : 'var(--text-mute)'};">${failCount}</span>
            <span style="width:64px; text-align:center; font-family:monospace; font-size:12px; color:var(--text-sub);">${failThreshold}</span>
          </div>
          <div style="flex:1; display:flex; align-items:center; justify-content:flex-end; gap:6px;">
            <button type="button" class="btn-site-toggle ${isDis ? 'disabled' : 'enabled'}">${isDis ? '已禁用' : '已启用'}</button>
            <button type="button" class="btn-danger-del" title="删除该源">✕</button>
          </div>
        `;

        row.querySelector('.btn-site-toggle').onclick = () => toggleSiteStatus(site.name);
        row.querySelector('.btn-danger-del').onclick = () => deleteSite(site.name);
        container.appendChild(row);
      });
    }

    async function toggleSiteStatus(siteName) {
      if (!currentUser || currentUser.role !== 'admin') return;
      const idx = disabledSites.indexOf(siteName);
      if (idx >= 0) {
        disabledSites.splice(idx, 1);
        if (sourceFailures[siteName]) {
          delete sourceFailures[siteName];
          await setD1Data(KEY_SOURCE_FAILURES, sourceFailures);
        }
      } else {
        disabledSites.push(siteName);
      }

      clearVodSearchSessionCache();
      await setD1Data(KEY_DISABLED_SITES, disabledSites);
      renderSitesManagerList();
    }

    async function addNewCustomSite() {
      if (!currentUser || currentUser.role !== 'admin') return;
      const nameInput = document.getElementById('new-site-name');
      const apiInput = document.getElementById('new-site-api');
      const name = (nameInput.value || '').trim();
      const api = (apiInput.value || '').trim();

      if (!name || !api) { alert('请完整填写源站名称和接口地址！'); return; }
      if (!isSafeUrl(api)) { alert('接口地址不正确！'); return; }
      if (parsedSites.some(s => s.name === name)) { alert('已存在同名源站！'); return; }

      parsedSites.unshift({ name, api });
      clearVodSearchSessionCache();
      setD1Data(KEY_SITES, parsedSites);
      nameInput.value = '';
      apiInput.value = '';
      renderSitesManagerList();
      showGestureTip(`✓ 源站【${name}】已添加`);
    }

    async function deleteSite(siteName) {
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!confirm(`确定要移除采集源【${siteName}】吗？`)) return;
      parsedSites = parsedSites.filter(s => s.name !== siteName);
      disabledSites = disabledSites.filter(n => n !== siteName);
      if (sourceFailures[siteName]) delete sourceFailures[siteName];
      clearVodSearchSessionCache();
      setD1Data(KEY_SITES, parsedSites);
      setD1Data(KEY_DISABLED_SITES, disabledSites);
      setD1Data(KEY_SOURCE_FAILURES, sourceFailures);
      renderSitesManagerList();
    }

    async function openSourceModal() {
      if (currentUser && currentUser.role !== 'admin') {
        openUserAccountModal();
        return;
      }
      
      if (!currentUser || currentUser.role !== 'admin') {
        document.getElementById('auth-gate-screen').style.display = 'flex';
        return;
      }

      document.getElementById('settings-username-label').textContent = currentUser.username;
      document.getElementById('sub-url-input').value = localStorage.getItem(KEY_SUB) || '';
      document.getElementById('source-m3u-input').value = localStorage.getItem(KEY_M3U) || '';
      document.getElementById('auto-sync-interval').value = localStorage.getItem(KEY_SYNC_INTERVAL) || '0';
      document.getElementById('auth-require-toggle').checked = !!authConfig.requireLogin;
      document.getElementById('sys-theme-select').value = currentThemeSetting;

      getD1Data(KEY_SUB, '').then(val => {
        if (val) document.getElementById('sub-url-input').value = val;
      });
      getD1Data(KEY_M3U, '').then(val => {
        if (val) document.getElementById('source-m3u-input').value = val;
      });

      const lastTime = localStorage.getItem(KEY_LAST_SYNC) || '';
      document.getElementById('last-sync-time-label').textContent = lastTime ? `最后更新时间：${lastTime}` : '最后更新时间：从未更新';
      
      document.getElementById('sites-count-badge').textContent = parsedSites.length;
      document.getElementById('user-count-badge').textContent = userList.length;

      document.getElementById('modal-mask').style.display = 'flex';
    }

    function closeSourceModal() { document.getElementById('modal-mask').style.display = 'none'; }

    async function saveToD1() {
      if (!currentUser || currentUser.role !== 'admin') return;
      const subUrl = (document.getElementById('sub-url-input').value || '').trim();
      const m3uUrl = (document.getElementById('source-m3u-input').value || '').trim();
      const interval = document.getElementById('auto-sync-interval').value;

      closeSourceModal();
      showGestureTip("✓ 设置已保存");

      const tasks = [];
      if (subUrl) tasks.push(setD1Data(KEY_SUB, subUrl));
      if (m3uUrl) tasks.push(setD1Data(KEY_M3U, m3uUrl));
      tasks.push(setD1Data(KEY_SYNC_INTERVAL, interval));
      tasks.push(setD1Data(KEY_DISABLED_SITES, disabledSites));
      tasks.push(setD1Data(KEY_SOURCE_FAILURES, sourceFailures));
      tasks.push(setD1Data(KEY_FAIL_THRESHOLD, String(failThreshold)));
      tasks.push(setD1Data(KEY_SITES, parsedSites));
      tasks.push(setD1Data(KEY_AUTH_CONFIG, authConfig));
      tasks.push(setD1Data(KEY_USERS_LIST, userList));
      tasks.push(setD1Data(KEY_SOURCE_GROUPS, sourceGroups));
      tasks.push(setD1Data(KEY_THEME_PREF, currentThemeSetting));
      if (adminAccount) tasks.push(setD1Data(KEY_ADMIN_INFO, adminAccount));

      await Promise.allSettled(tasks);
    }

    async function manualSyncSubscription() {
      if (!currentUser || currentUser.role !== 'admin') return;
      const subUrl = (document.getElementById('sub-url-input').value || '').trim();
      const m3uUrl = (document.getElementById('source-m3u-input').value || '').trim();
      const interval = document.getElementById('auto-sync-interval').value;

      if (!subUrl && !m3uUrl) { alert("请先输入订阅或直播源地址！"); return; }
      const syncBtn = document.getElementById('btn-modal-sync');
      syncBtn.textContent = "⏳ 正在同步...";
      syncBtn.disabled = true;

      if (subUrl) setD1Data(KEY_SUB, subUrl);
      if (m3uUrl) setD1Data(KEY_M3U, m3uUrl);
      setD1Data(KEY_SYNC_INTERVAL, interval);

      let msg = [];
      if (subUrl) {
        try {
          let text = await fetchWithSmartProxy(subUrl, 5000);
          let sites = parseSubscriptionPayload(text);
          if (sites.length === 0 && subUrl.includes('format=2')) {
            text = await fetchWithSmartProxy(subUrl.replace('format=2', 'format=1'), 5000);
            sites = parseSubscriptionPayload(text);
          }
          if (sites.length > 0) {
            parsedSites = sites;
            setD1Data(KEY_SITES, parsedSites);
            msg.push(`影视源已更新: ${sites.length} 个`);
            renderSitesManagerList();
          } else msg.push(`影视源解析为空`);
        } catch (e) { msg.push(`影视源更新失败: ${e.message}`); }
      }

      if (m3uUrl) {
        try {
          const text = await fetchTvM3uContent(m3uUrl)
          if (text && text.includes('#EXTINF')) {
            parseM3U(text, true);
            msg.push(`电视直播源已更新: ${totalChannelsCount} 个频道 (共 ${totalStreamsCount} 个源)`);
            if (currentMode === 'tv' && currentView === 'normal') {
              renderList(groups, false);
            }
          } else {
            msg.push(`电视直播源内容解析为空`);
          }
        } catch (e) { msg.push(`电视源失败: ${e.message}`); }
      }

      const nowStr = new Date().toLocaleString();
      setD1Data(KEY_LAST_SYNC, nowStr);
      document.getElementById('last-sync-time-label').textContent = `最后更新时间：${nowStr}`;

      syncBtn.textContent = "🔄 同步更新源";
      syncBtn.disabled = false;
      closeSourceModal();
      alert("同步完成:\n" + msg.join('\n'));
    }

    async function checkAutoSyncSchedule() {
      const intervalHours = parseInt(await getD1Data(KEY_SYNC_INTERVAL, '0'), 10);
      if (intervalHours <= 0) return;

      const lastTimeStr = await getD1Data(KEY_LAST_SYNC, '');
      if (!lastTimeStr) {
        await triggerSilentSync();
        return;
      }
      const lastTime = new Date(lastTimeStr).getTime();
      const now = Date.now();
      const diffHours = (now - lastTime) / (1000 * 60 * 60);

      if (diffHours >= intervalHours) {
        await triggerSilentSync();
      }
    }

    async function triggerSilentSync() {
      const subUrl = await getD1Data(KEY_SUB, '');
      const m3uUrl = await getD1Data(KEY_M3U, '');
      let hasUpdated = false;

      if (subUrl) {
        try {
          let text = await fetchWithSmartProxy(subUrl, 5000);
          let sites = parseSubscriptionPayload(text);
          if (sites.length > 0) {
            parsedSites = sites;
            setD1Data(KEY_SITES, parsedSites);
            hasUpdated = true;
          }
        } catch (_) {}
      }

      if (m3uUrl) {
        try {
          const text = await fetchTvM3uContent(m3uUrl);
          if (text && text.includes('#EXTINF')) {
            parseM3U(text, true);
            hasUpdated = true;
          }
        } catch (_) {}
      }

      if (hasUpdated) {
        setD1Data(KEY_LAST_SYNC, new Date().toLocaleString());
      }
    }

    function extractSitesFromAnyJson(parsed) {
      const results = [];
      if (!parsed || typeof parsed !== 'object') return results;
      if (parsed.api_site && typeof parsed.api_site === 'object') {
        for (let key in parsed.api_site) {
          const item = parsed.api_site[key];
          if (item?.api && isSafeUrl(item.api)) results.push({ name: item.name || key, api: item.api.trim() });
        }
      }
      let list = Array.isArray(parsed) ? parsed : (parsed.video?.sites) || parsed.sites || [];
      for (const item of list) {
        const api = item.api || item.url;
        if (api && typeof api === 'string' && isSafeUrl(api)) results.push({ name: item.name || item.key || '影视源', api: api.trim() });
      }
      return results;
    }

    function parseSubscriptionPayload(text) {
      let raw = text.trim();
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (_) {
        try {
          const decoded = decodeBase58(raw);
          parsed = JSON.parse(decoded.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, ''));
        } catch (_) {}
      }
      return extractSitesFromAnyJson(parsed);
    }

    function getGroupUniqueKey(g) {
      if (!g) return '';
      return (isGroupNSFW(g) ? 'nsfw_' : 'norm_') + g.title;
    }

    function slimGroupForStorage(g) {
      return {
        title: g.title,
        poster: g.poster,
        type: g.type,
        actor: g.actor,
        isNsfw: Boolean(isGroupNSFW(g)),
        _latestTimestamp: g._latestTimestamp,
        _displayDate: g._displayDate,
        items: (g.items || []).map(item => ({
          id: item.id,
          rawKey: item.rawKey,
          siteName: item.siteName,
          versionTag: item.versionTag,
          ping: item.ping,
          vod: {
            vod_name: item.vod?.vod_name || '',
            vod_remarks: item.vod?.vod_remarks || '',
            vod_sub: item.vod?.vod_sub || '',
            type_name: item.vod?.type_name || '',
            vod_time: item.vod?.vod_time || '',
            vod_pubdate: item.vod?.vod_pubdate || '',
            vod_play_url: item.vod?.vod_play_url || '',
            vod_pic: item.vod?.vod_pic || ''
          }
        }))
      };
    }

    function saveVodSessionState() {
      if (currentMode !== 'vod') return;
      try {
        if (!groupedVodList || groupedVodList.length === 0) {
          sessionStorage.removeItem(KEY_SESSION_VOD_STATE);
          return;
        }
        const state = {
          keyword: currentSearchingWord || document.getElementById('filter')?.value || '',
          groupedVodList: groupedVodList.map(slimGroupForStorage),
          categoryFilter: currentCategoryFilter,
          sortType: currentVodSortType,
          activeGroupTitle: activeGroupTitle,
          activeSubItemId: activeSubItemId,
          currentActiveEp: currentActiveEp,
          // Only replay a saved search for the account that created it.
          account: String(currentUser?.username || '')
        };
        sessionStorage.setItem(KEY_SESSION_VOD_STATE, JSON.stringify(state));
      } catch (_) {}
    }

    function restoreVodSessionState() {
      try {
        const raw = sessionStorage.getItem(KEY_SESSION_VOD_STATE);
        if (!raw) return false;
        const state = JSON.parse(raw);
        if (state && Array.isArray(state.groupedVodList) && state.groupedVodList.length > 0 &&
            currentUser && state.account === String(currentUser.username || '')) {
          currentSearchingWord = state.keyword || '';
          const filterEl = document.getElementById('filter');
          if (filterEl) {
            filterEl.value = currentSearchingWord;
            toggleClearBtn(currentSearchingWord);
          }
          groupedVodList = state.groupedVodList;
          currentCategoryFilter = state.categoryFilter || 'auto';
          currentVodSortType = state.sortType || 'score';
          activeGroupTitle = state.activeGroupTitle || '';
          activeSubItemId = state.activeSubItemId || '';
          currentActiveEp = state.currentActiveEp || 0;
          return true;
        }
      } catch (_) {}
      return false;
    }

    // AURORA 3.17: Restore the view after a genuine browser refresh, not playback.
    // Do not persist credentials, stream URLs or media elements in this new state.
    function sgSavePageState() {
      if (!currentUser?.username) return;
      try {
        const home = document.body.classList.contains('aurora-home-view');
        const page = home ? 'home' : 'workspace';
        const state = {
          version: 1, account: String(currentUser.username), savedAt: Date.now(),
          page, category: home ? (auroraActiveCategory || '') : '',
          mode: currentMode === 'tv' ? 'tv' : 'vod',
          view: ['normal', 'fav', 'history'].includes(currentView) ? currentView : 'normal',
          keyword: String(document.getElementById('filter')?.value || '').slice(0, 120),
          topKeyword: String(document.getElementById('aurora-nav-search-input')?.value || '').slice(0, 120),
          year: document.getElementById('aurora-filter-year')?.value || '',
          rating: document.getElementById('aurora-filter-rating')?.value || '',
          sort: document.getElementById('aurora-filter-sort')?.value || '',
          homeScroll: Math.max(0, Math.round(document.getElementById('aurora-home')?.scrollTop || 0)),
          listScroll: Math.max(0, Math.round(document.getElementById('channel-list')?.scrollTop || 0))
        };
        sessionStorage.setItem(KEY_SESSION_PAGE_STATE, JSON.stringify(state));
      } catch (_) { /* Private browsing and storage quotas must never break playback. */ }
    }

    function sgLoadPageState() {
      if (!currentUser?.username) return null;
      try {
        const raw = sessionStorage.getItem(KEY_SESSION_PAGE_STATE);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (state?.version !== 1 || state.account !== String(currentUser.username)) return null;
        if (!Number.isFinite(state.savedAt) || Date.now() - state.savedAt > SG_RESTORE_TTL_MS || state.savedAt > Date.now() + 60000) return null;
        if (!['home','workspace'].includes(state.page)) return null;
        return state;
      } catch (_) { return null; }
    }

    function sgRestorePageScroll(state) {
      const selector = state.page === 'home' ? '#aurora-home' : '#channel-list';
      const desired = Math.max(0, Math.min(200000, Number(state.page === 'home' ? state.homeScroll : state.listScroll) || 0));
      if (desired < 2) return;
      const restore = () => {
        if (document.body.classList.contains('aurora-home-view') !== (state.page === 'home')) return;
        const el = document.querySelector(selector);
        if (!el) return;
        // Restore a deep search position even when the catalog initially renders in chunks.
        if (state.page === 'workspace' && currentMode === 'vod' && currentView === 'normal') {
          let safety = 0;
          while (typeof appendVodCardsChunk === 'function' &&
              currentlyRenderedCount < activeDisplayCardList.length &&
              el.scrollHeight - el.clientHeight < desired && safety++ < 12) {
            const before = currentlyRenderedCount;
            appendVodCardsChunk(activeDisplayCardList, currentlyRenderedCount, CHUNK_PAGE_SIZE);
            if (currentlyRenderedCount <= before) break;
          }
        }
        el.scrollTop = Math.min(desired, Math.max(0, el.scrollHeight - el.clientHeight));
      };
      requestAnimationFrame(() => requestAnimationFrame(restore));
      // Favorites/history and TMDB posters may arrive asynchronously; avoid
      // overriding the user's own scrolling once they have interacted.
      let interacted = false;
      const mark = () => { interacted = true; };
      window.addEventListener('wheel', mark, {once:true, passive:true});
      window.addEventListener('touchstart', mark, {once:true, passive:true});
      setTimeout(() => {
        if (!interacted) restore();
        window.removeEventListener('wheel', mark);
        window.removeEventListener('touchstart', mark);
      }, 450);
    }

    function sgRestorePageState(state, hasVodSearch) {
      if (!state) return false;
      sgUiRestoring = true;
      try {
        const navInput = document.getElementById('aurora-nav-search-input');
        if (navInput) navInput.value = state.topKeyword || '';
        if (state.page === 'home') {
          if (!auroraRecommendationItems.length) loadAuroraRecommendationLocalCache();
          const categories = ['电影','电视剧','综艺','动漫'];
          if (categories.includes(state.category)) openAuroraCategory(state.category);
          else showAuroraHome();
          const rating = document.getElementById('aurora-filter-rating');
          const sort = document.getElementById('aurora-filter-sort');
          if (rating && [...rating.options].some(x => x.value === state.rating)) rating.value = state.rating;
          if (sort && [...sort.options].some(x => x.value === state.sort)) sort.value = state.sort;
          sgPendingHomeYear = state.year || null;
          if (auroraRecommendationItems.length) renderAuroraRecommendations();
        } else {
          const mode = state.mode === 'tv' ? 'tv' : 'vod';
          switchMode(mode);
          const sidebarView = ['fav', 'history'].includes(state.view) ? state.view : 'normal';
          if (sidebarView !== 'normal') switchSidebarView(sidebarView);
          const keywordInput = document.getElementById('filter');
          if (keywordInput) {
            keywordInput.value = state.keyword || (mode === 'vod' && hasVodSearch ? currentSearchingWord : '');
            toggleClearBtn(keywordInput.value);
          }
          // Do NOT fetch a stream or auto-start a TV channel after a reload.
        }
        sgRestorePageScroll(state);
        return true;
      } finally { sgUiRestoring = false; }
    }

    window.addEventListener('beforeunload', () => {
      sgSavePageState();
      saveVodSessionState();
      stopRemoteTvTranscode();
    });
    window.addEventListener('pagehide', () => {
      sgSavePageState();
      saveVodSessionState();
      stopRemoteTvTranscode();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sgSavePageState();
    });

    // AURORA 2.2 首页：推荐数据只来自当前账号有权限访问的真实影视源。
    let auroraRecommendationItems = [];
    let auroraRecommendationLoading = false;
    let auroraActiveCategory = '';
    let auroraHeroIndex = 0;
    let auroraHeroTimer = null;
    // Category discovery uses the existing D1/cache list. Only capsule category/region
    // filters apply here; home-page year/rating/order selectors stay independent.
    const sgCategoryFilters = { sub:'all', region:'all', year:'' };
    const sgCategoryPillNames = {
      '电影':['全部','热门电影','最新电影','高分佳片','冷门佳片'],
      '电视剧':['全部','热播剧集','最新剧集','高分剧集','经典剧集'],
      '综艺':['全部','热门综艺','最新综艺','高分综艺','精选综艺'],
      '动漫':['全部','热门动漫','最新动漫','高分动漫','精选动漫']
    };
    const sgRegions = [{id:'all',label:'全部'},{id:'chinese',label:'华语'},{id:'western',label:'欧美'},{id:'korea',label:'韩国'},{id:'japan',label:'日本'}];
    // Lazy region shelves: load verified region/country results only when the
    // viewer presses a region pill. '全部' stays on the existing D1 shortlist.
    const sgRegionalCache = new Map();
    const sgRegionalPending = new Map();
    const sgRegionalErrors = new Map();
    function sgRegionalKey(category, region) { return `${category}:${region}`; }
    function sgEnsureRegionalData(category, region) {
      if (!category || !region || region === 'all') return;
      const key = sgRegionalKey(category, region);
      if (sgRegionalCache.has(key) || sgRegionalPending.has(key)) return;
      sgRegionalErrors.delete(key);
      const work = (async () => {
        const endpoint = `/api/recommendations?category=${encodeURIComponent(category)}&region=${encodeURIComponent(region)}`;
        const response = await fetch(endpoint, { credentials:'same-origin', headers:{ Accept:'application/json' } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(data.error || `地区查询失败 (${response.status})`));
        if (!Array.isArray(data.items)) throw new Error('地区数据格式不正确');
        sgRegionalCache.set(key, data.items.map(normalizeTrendingItem).filter(Boolean)
          .filter(item => classifyAuroraMedia(item) === category));
      })();
      sgRegionalPending.set(key, work);
      work.catch(error => {
        sgRegionalErrors.set(key, String(error?.message || '地区数据读取失败').slice(0,140));
      }).finally(() => {
        sgRegionalPending.delete(key);
        if (auroraActiveCategory === category && sgCategoryFilters.region === region) renderAuroraRecommendations();
      });
    }
    function sgRegionCode(item) {
      const raw = Array.isArray(item.originCountry) ? item.originCountry :
        Array.isArray(item.origin_country) ? item.origin_country : [];
      return raw.map(x => String(x).toUpperCase());
    }
    function sgMatchesRegion(item, region) {
      if (!region || region === 'all') return true;
      const codes = sgRegionCode(item);
      if (!codes.length) return false; // Unknown country is not silently mislabeled.
      const sets = {
        chinese:['CN','TW','HK','MO'],
        western:['US','GB','CA','FR','DE','IT','ES','AU','NZ','IE','BE','SE','NO','DK','NL','AT','CH'],
        korea:['KR'], japan:['JP']
      };
      return codes.some(code => (sets[region] || []).includes(code));
    }
    // Year options come exclusively from the cached titles of this category.
    // This is independent of the home page's year/rating/sort controls.
    function sgSyncCategoryYearSelect() {
      const select = document.getElementById('sg-filter-year');
      if (!select || !auroraActiveCategory) return;
      const years = [...new Set(auroraRecommendationItems
        .filter(auroraCategoryPredicate)
        .map(item => String(item.year || '').trim())
        .filter(value => /^\d{4}$/.test(value)))].sort((a,b) => Number(b) - Number(a));
      const key = years.join(',');
      if (select.dataset.yearsKey !== key) {
        select.replaceChildren(new Option('全部年份',''), ...years.map(y => new Option(`${y}年`,y)));
        select.dataset.yearsKey = key;
      }
      if (sgCategoryFilters.year && !years.includes(sgCategoryFilters.year)) sgCategoryFilters.year = '';
      select.value = sgCategoryFilters.year;
    }
    document.getElementById('sg-filter-year')?.addEventListener('change', event => {
      if (!auroraActiveCategory) return;
      sgCategoryFilters.year = event.target.value;
      renderAuroraRecommendations();
    });
    function sgPillSelect(kind, value) {
      if (!auroraActiveCategory) return;
      if (kind === 'sub') sgCategoryFilters.sub = value;
      if (kind === 'region') sgCategoryFilters.region = value;
      sgSyncCategoryPills();
      if (sgCategoryFilters.region !== 'all') sgEnsureRegionalData(auroraActiveCategory, sgCategoryFilters.region);
      renderAuroraRecommendations();
    }
    function sgSyncCategoryPills() {
      const wrapper = document.getElementById('sg-category-filters');
      if (!wrapper) return;
      wrapper.hidden = !auroraActiveCategory;
      // Legacy year/rating/order controls remain in the HOME heading only.
      // Category pages hide them in CSS; do not move them beneath the capsule filter.
      const originalFilters = document.querySelector('.aurora-discovery-filters');
      const heading = document.querySelector('.aurora-section-head');
      if (!auroraActiveCategory) {
        if (originalFilters && heading && originalFilters.parentElement !== heading) heading.appendChild(originalFilters);
        return;
      }
      const names = sgCategoryPillNames[auroraActiveCategory] || sgCategoryPillNames['电影'];
      const makePills = (items, kind, active) => items.map(({id,label}) =>
        `<button type="button" class="sg-filter-pill ${id === active ? 'active' : ''}" aria-pressed="${id === active}" data-sg-kind="${kind}" data-sg-value="${id}">${escapeHtml(label)}</button>`).join('');
      const sub = document.getElementById('sg-filter-categories');
      const region = document.getElementById('sg-filter-regions');
      if (sub) sub.innerHTML = makePills(names.map((label,i) => ({id:i===0?'all':String(i),label})), 'sub', sgCategoryFilters.sub);
      if (region) region.innerHTML = makePills(sgRegions, 'region', sgCategoryFilters.region);
    }
    // Event delegation, single listener regardless of category navigation.
    document.getElementById('sg-category-filters')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-sg-kind]');
      if (button) sgPillSelect(button.dataset.sgKind, button.dataset.sgValue);
    });
    function sgSubCategoryItems(items) {
      const sub = sgCategoryFilters.sub;
      if (sub === 'all') return items;
      const sorted = items.slice();
      if (sub === '1') return sorted.sort((a,b) => (b.popularity||0) - (a.popularity||0));
      if (sub === '2') return sorted.sort((a,b) => String(b.releaseDate||b.year||'').localeCompare(String(a.releaseDate||a.year||'')));
      if (sub === '3') return sorted.filter(x => Number(x.voteAverage||0) >= 7).sort((a,b) => (b.voteAverage||0)-(a.voteAverage||0));
      // Fourth preset is a curated low-popularity or high-score rail, without new APIs.
      if (auroraActiveCategory === '电影') {
        const cutoff = sorted.slice().sort((a,b)=>(a.popularity||0)-(b.popularity||0));
        return cutoff.filter(x => Number(x.voteAverage||0) >= 6).slice(0,Math.max(6,Math.ceil(sorted.length*.55)));
      }
      return sorted.filter(x => Number(x.voteAverage||0) >= 6.5).sort((a,b)=>(b.voteAverage||0)-(a.voteAverage||0));
    }
    function sgCategoryRails(items) {
      if (!auroraActiveCategory) return [];
      const names = ({
        '电影':['热门电影','最近上映','高分佳片','小众精选'],
        '电视剧':['正在热播','最新剧集','口碑剧集','值得重温'],
        '综艺':['人气综艺','最新上线','高分综艺','精选节目'],
        '动漫':['人气动漫','最新动漫','高分动漫','精选番剧']
      })[auroraActiveCategory] || ['热门推荐','最新作品','高分精选','更多作品'];
      const popular = items.slice().sort((a,b)=>(b.popularity||0)-(a.popularity||0));
      const newest = items.slice().sort((a,b)=>String(b.releaseDate||b.year||'').localeCompare(String(a.releaseDate||a.year||'')));
      const rated = items.filter(x=>Number(x.voteAverage||0)>=7).sort((a,b)=>(b.voteAverage||0)-(a.voteAverage||0));
      const special = items.slice().sort((a,b)=>(a.popularity||0)-(b.popularity||0));
      const options = [{name:names[0],items:popular},{name:names[1],items:newest},{name:names[2],items:rated},{name:names[3],items:special}];
      // Do not manufacture filler items for a category with sparse metadata.
      return options.filter((g,i)=>g.items.length && (i < 2 || g.items.length >= 2) && (i < 2 || items.length >= 5))
        .map(g => ({name:g.name,items:g.items.slice(0,30)}));
    }
    function submitAuroraTopSearch(event) {
      if (event) event.preventDefault();
      const input = document.getElementById('aurora-nav-search-input');
      const keyword = input ? input.value.trim() : '';
      // AURORA 3.20 L1: The existing top search is context-sensitive ONLY
      // inside the actual live-TV page. Other tabs retain original VOD search.
      if (currentMode === 'tv' && currentView === 'normal' &&
          !document.body.classList.contains('aurora-home-view')) {
        const liveInput = document.getElementById('filter');
        if (liveInput) {
          liveInput.value = keyword;
          toggleClearBtn(keyword);
        }
        handleSearchTv();
        return;
      }
      openAuroraSearch(keyword);
    }
    function auroraCurrentVisibleItems() {
      const regional = auroraActiveCategory && sgCategoryFilters.region !== 'all'
        ? sgRegionalCache.get(sgRegionalKey(auroraActiveCategory, sgCategoryFilters.region))
        : null;
      const visible = auroraActiveCategory
        ? (sgCategoryFilters.region !== 'all' ? (regional || []) : auroraRecommendationItems).filter(auroraCategoryPredicate)
        : auroraRecommendationItems.filter(item => ['电影', '电视剧'].includes(classifyAuroraMedia(item)));
      // Only the HOME view uses the year/rating/order selectors.
      // Hidden home filters must never restrict movie/series/variety/anime rails.
      const year = auroraActiveCategory ? sgCategoryFilters.year : (document.getElementById('aurora-filter-year')?.value || '');
      const minRating = auroraActiveCategory ? 0 : Number(document.getElementById('aurora-filter-rating')?.value || 0);
      const sort = auroraActiveCategory ? 'popular' : (document.getElementById('aurora-filter-sort')?.value || 'popular');
      const filtered = visible.filter(item =>
        (!year || String(item.year || '') === year) &&
        (!minRating || Number(item.voteAverage || 0) >= minRating)
      );
      // Region datasets were fetched with TMDB's country-of-origin filter;
      // do not reject movies again just because /discover/movie omits country fields.
      const regionFiltered = filtered;
      const presetFiltered = auroraActiveCategory ? sgSubCategoryItems(regionFiltered) : regionFiltered;
      return presetFiltered.sort((a, b) => {
        if (sort === 'rating' || (sort === 'popular' && auroraActiveCategory && sgCategoryFilters.sub === '3')) return Number(b.voteAverage || 0) - Number(a.voteAverage || 0) || Number(b.popularity || 0) - Number(a.popularity || 0);
        if (sort === 'newest' || (sort === 'popular' && auroraActiveCategory && sgCategoryFilters.sub === '2')) return String(b.releaseDate || b.year || '').localeCompare(String(a.releaseDate || a.year || '')) || Number(b.popularity || 0) - Number(a.popularity || 0);
        if (sort === 'popular' && auroraActiveCategory && sgCategoryFilters.sub === '4') return Number(a.popularity || 0) - Number(b.popularity || 0);
        if (auroraActiveCategory === '电视剧') {
          const aCN = /国产热门电视剧|中国大陆热门|中国地区热门/i.test(String(a.source || '')) ? 1 : 0;
          const bCN = /国产热门电视剧|中国大陆热门|中国地区热门/i.test(String(b.source || '')) ? 1 : 0;
          if (aCN !== bCN) return bCN - aCN;
        }
        return Number(b.popularity || 0) - Number(a.popularity || 0);
      });
    }
    function applyAuroraDiscoveryFilters() {
      auroraHeroIndex = 0;
      renderAuroraRecommendations();
    }
    function updateAuroraYearFilter() {
      const select = document.getElementById('aurora-filter-year');
      if (!select) return;
      const existing = sgPendingHomeYear || select.value;
      const years = [...new Set(auroraRecommendationItems.map(item => String(item.year || '')).filter(v => /^\d{4}$/.test(v)))].sort((a,b) => Number(b)-Number(a));
      select.replaceChildren(new Option('全部年份',''), ...years.map(year => new Option(year, year)));
      select.value = years.includes(existing) ? existing : '';
      if (years.length) sgPendingHomeYear = null;
    }
    function stepAuroraHero(delta) {
      const visible = auroraCurrentVisibleItems();
      if (!visible.length) return;
      auroraHeroIndex = (auroraHeroIndex + delta + visible.length) % visible.length;
      renderAuroraHero(visible[auroraHeroIndex]);
    }
    function selectAuroraHero(index) {
      const visible = auroraCurrentVisibleItems();
      if (!visible.length) return;
      auroraHeroIndex = Math.max(0, Math.min(Number(index) || 0, visible.length - 1));
      renderAuroraHero(visible[auroraHeroIndex]);
    }
    function auroraCategoryPredicate(item) {
      const type = classifyAuroraMedia(item);
      if (auroraActiveCategory === '电影') return type === '电影';
      if (auroraActiveCategory === '电视剧') return type === '电视剧';
      if (auroraActiveCategory === '综艺') return type === '综艺';
      if (auroraActiveCategory === '动漫') return type === '动漫';
      return true;
    }
    function renderAuroraHero(item) {
      if (!item) return;
      const heroTitle = document.getElementById('aurora-hero-title');
      const heroDesc = document.getElementById('aurora-hero-desc');
      const heroMeta = document.getElementById('aurora-hero-meta');
      const heroBackdrop = document.getElementById('aurora-hero-backdrop');
      if (heroTitle) { heroTitle.textContent = item.title; heroTitle.dataset.title = item.title; }
      if (heroDesc) heroDesc.textContent = item.remarks || item.type || '来自每日热门影视榜。点击后将检索你自己的影视源。';
      if (heroBackdrop) {
        const image = item.backdrop || item.poster || '';
        heroBackdrop.style.backgroundImage = image && isSafeUrl(image) ? `url("${image.replace(/"/g,'%22')}")` : 'none';
      }
      if (heroMeta) heroMeta.innerHTML = [item.type, item.year, item.voteAverage ? `评分 ${item.voteAverage.toFixed(1)}` : ''].filter(Boolean).slice(0,3).map(x => `<span>${escapeHtml(x)}</span>`).join('');
      const dots = document.getElementById('aurora-hero-dots');
      const visible = auroraCurrentVisibleItems();
      if (dots) {
        const groupSize = window.matchMedia('(max-width:480px)').matches ? 3 : 5;
        const start = Math.floor(auroraHeroIndex / groupSize) * groupSize;
        dots.innerHTML = visible.slice(start, start + groupSize).map((x,i)=>`<button type="button" class="aurora-hero-dot ${start+i===auroraHeroIndex?'active':''}" onclick="selectAuroraHero(${start+i})" aria-label="推荐 ${start+i+1}"></button>`).join('');
      }
    }
    function sgInitHeroSwipe() {
      const hero = document.getElementById('aurora-hero');
      if (!hero || hero.dataset.sgSwipeReady) return;
      hero.dataset.sgSwipeReady = '1';
      let drag = null;
      hero.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button,a,input,[role="button"]')) return;
        drag = {x:event.clientX,y:event.clientY,pointerId:event.pointerId,when:Date.now()};
        if (event.pointerType === 'mouse') { hero.classList.add('sg-hero-dragging'); hero.setPointerCapture?.(event.pointerId); }
      });
      hero.addEventListener('pointerup', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag = null;
        hero.classList.remove('sg-hero-dragging');
        if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy)*1.15) {
          stepAuroraHero(dx < 0 ? 1 : -1);
          startAuroraHeroRotation();
        }
      });
      hero.addEventListener('pointercancel', () => { drag=null; hero.classList.remove('sg-hero-dragging'); });
      hero.addEventListener('lostpointercapture', () => hero.classList.remove('sg-hero-dragging'));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',sgInitHeroSwipe,{once:true});
    else sgInitHeroSwipe();
    function startAuroraHeroRotation() {
      if (auroraHeroTimer) clearInterval(auroraHeroTimer);
      auroraHeroTimer = setInterval(() => {
        const visible = auroraCurrentVisibleItems();
        if (visible.length > 1) {
          auroraHeroIndex = (auroraHeroIndex + 1) % visible.length;
          renderAuroraHero(visible[auroraHeroIndex]);
        }
      }, 6500);
    }
    function openAuroraWorkspace() {
      document.body.classList.remove('aurora-home-view', 'sg-category-view');
      const home = document.getElementById('aurora-home');
      if (home) home.setAttribute('aria-hidden', 'true');
      if (!sgUiRestoring) window.scrollTo({top:0,behavior:'smooth'});
    }
    // AURORA 3.13: Leaving the LIVE section must release the actual media request.
    // A remote /stop message alone does not cancel native HLS or hls.js downloads.
    function stopLivePlaybackOnSiteNavigation() {
      if (!isLiveMode) return;
      ++playbackGeneration;              // Ignore late HLS/network callbacks.
      clearPlayWatchdog();
      stopRemoteTvTranscode();          // Release VPS stream/transcode as well.
      destroyHlsInstance();            // Abort hls.js playlist and segment loading.
      try {
        video.pause();
        video.removeAttribute('src');  // iOS Safari native HLS needs src released.
        video.load();
      } catch (_) {}
      video.onplaying = null;
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onerror = null;
      isLiveMode = false;
      if (typeof syncCastUiState === 'function') syncCastUiState();
      if (typeof sgResetCastSessionOnStop === 'function') sgResetCastSessionOnStop();
      currentStreamUrl = '';
      window.currentRawStreamUrl = '';
      currentVodUniqueKey = '';
      currentPlayingMeta = null;
      document.querySelectorAll('.channel-row.playing').forEach(el => el.classList.remove('playing'));
      document.getElementById('player-wrap')?.classList.remove('has-active-video');
      routeBadge.style.display = 'none';
      routeBadge.textContent = '';
      currentTitle.textContent = '';
      setStatus('', false);
      updatePlayBtn(false);
      updateFavIconState();
    }
    /* AURORA 3.20: navigating away from a playing VOD is a true media stop,
       not just hiding the player. Existing live-TV stop is retained. */
    function stopSitePlaybackOnNavigation() {
      if (isLiveMode) {
        stopLivePlaybackOnSiteNavigation();
        return;
      }
      // No active VOD: leave search result state and selected episode untouched.
      if (!currentStreamUrl && !video.getAttribute('src') && !hls) return;
      ++playbackGeneration;                // Cancel late async HLS callbacks.
      clearPlayWatchdog();
      destroyHlsInstance();               // Abort HLS playlist/segment requests.
      try {
        video.pause();
        video.removeAttribute('src');      // Required to release native Safari HLS.
        video.load();
      } catch (_) {}
      video.onplaying = null;
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onerror = null;
      currentStreamUrl = '';
      window.currentRawStreamUrl = '';
      currentVodUniqueKey = '';
      currentPlayingMeta = null;
      currentTitle.textContent = '';
      routeBadge.style.display = 'none';
      routeBadge.textContent = '';
      wrap.classList.remove('has-active-video', 'controls-hidden');
      setStatus('', false);
      updatePlayBtn(false);
      updateFavIconState();
      streamTimeEl.textContent = '00:00 / 00:00';
      progressBar.style.width = '0%';
    }
    function showAuroraHome() {
      stopSitePlaybackOnNavigation();
      auroraActiveCategory = '';
      auroraHeroIndex = 0;
      sgCategoryFilters.sub = 'all';
      sgCategoryFilters.region = 'all';
      sgCategoryFilters.year = '';
      document.body.classList.remove('sg-category-view');
      document.body.classList.add('aurora-home-view');
      sgSyncCategoryPills();
      const home = document.getElementById('aurora-home');
      if (home) home.setAttribute('aria-hidden', 'false');
      // Homepage uses the movie dock highlight; category buttons keep their original behavior.
      document.querySelectorAll('[data-aurora-nav]').forEach(b => b.classList.toggle('active', b.dataset.auroraNav === 'movie'));
      const heading = document.querySelector('.aurora-home-section .aurora-section-head h2');
      const overline = document.querySelector('.aurora-home-section .aurora-section-overline');
      const copy = document.querySelector('.aurora-home-section .aurora-section-head p');
      if (heading) heading.textContent = '实时热门电影与剧集';
      if (overline) overline.textContent = 'TRENDING · DAILY';
      if (copy) copy.textContent = '电影与电视剧每日同步，海报来自真实影视元数据；点击后检索你配置的可播放片源。';
      if (auroraRecommendationItems.length) renderAuroraRecommendations();
      if (!sgUiRestoring) window.scrollTo({top:0,behavior:'smooth'});
    }
    function openAuroraCategory(category) {
      stopSitePlaybackOnNavigation();
      // 不调用 showAuroraHome()：它会清空分类，导致所有分类都回到默认推荐。
      if (auroraActiveCategory !== category) {
        sgCategoryFilters.sub = 'all';
        sgCategoryFilters.region = 'all';
        sgCategoryFilters.year = '';
      }
      auroraActiveCategory = category || '';
      auroraHeroIndex = 0;
      document.body.classList.toggle('sg-category-view', !!auroraActiveCategory);
      document.body.classList.add('aurora-home-view');
      sgSyncCategoryPills();
      const home = document.getElementById('aurora-home');
      if (home) home.setAttribute('aria-hidden', 'false');
      const navKey = ({'电影':'movie','电视剧':'series','综艺':'variety','动漫':'anime'}[category] || '');
      document.querySelectorAll('[data-aurora-nav]').forEach(b => b.classList.toggle('active', !!navKey && b.dataset.auroraNav === navKey));
      const heading = document.querySelector('.aurora-home-section .aurora-section-head h2');
      const overline = document.querySelector('.aurora-home-section .aurora-section-overline');
      const copy = document.querySelector('.aurora-home-section .aurora-section-head p');
      if (heading) heading.textContent = category ? `当下热门${category === '电视剧' ? '电视剧' : category}` : '实时热门电影与剧集';
      if (overline) overline.textContent = category ? `TRENDING · ${category.toUpperCase()}` : 'TRENDING · DAILY';
      if (copy) copy.textContent = category ? `${category}热门榜来自 TMDB 热门元数据，每日同步缓存；点击海报后检索你配置的真实片源。` : '电影与电视剧每日同步，海报来自真实影视元数据；点击后检索你配置的可播放片源。';
      renderAuroraRecommendations();
      if (!auroraRecommendationItems.length || !auroraRecommendationItems.some(auroraCategoryPredicate)) refreshAuroraRecommendations();
      const section = document.querySelector('.aurora-home-section');
      if (section && !sgUiRestoring) {
        // With the old category heading hidden, offset the sticky header explicitly.
        // Also reset the homepage's inner scrolling when switching from a long poster rail.
        const homeScroller = document.getElementById('aurora-home');
        if (homeScroller) homeScroller.scrollTop = 0;
        const headerBottom = Math.max(0, document.getElementById('aurora-topnav')?.getBoundingClientRect().bottom || 0);
        const targetY = window.scrollY + section.getBoundingClientRect().top - headerBottom - 10;
        window.scrollTo({top:Math.max(0,targetY),behavior:'smooth'});
      }
    }
    function openAuroraSearch(keyword) {
      stopSitePlaybackOnNavigation();
      const term = String(keyword || '').trim();
      openAuroraWorkspace();
      switchMode('vod');
      const input = document.getElementById('filter');
      if (input && term) { input.value = term; triggerSearch(); }
      else if (input) input.focus();
      document.querySelectorAll('[data-aurora-nav]').forEach(b => b.classList.toggle('active', b.dataset.auroraNav === (term === '电影' ? 'movie' : term === '电视剧' ? 'series' : term === '综艺' ? 'variety' : term === '动漫' ? 'anime' : '')));
      window.scrollTo({top:0,behavior:'smooth'});
    }
    function auroraAllowedSites() {
      let sites = (parsedSites || []).filter(s => s && s.api && !disabledSites.includes(s.name));
      if (currentUser && currentUser.role !== 'admin') {
        const group = sourceGroups.find(g => g.id === currentUser.groupId) || sourceGroups.find(g => g.isDefault) || sourceGroups[0];
        if (group && group.sites && group.sites[0] !== '*') sites = sites.filter(s => group.sites.includes(s.name));
      }
      return sites;
    }
    /* AURORA 3.12: real category posters instead of invisible empty grid slots.
       Keep original poster dimensions and gently center incomplete filtered rows. */
    let sgPosterRowResizeRaf = 0;
    function sgBalancePosterRows() {
      const host = document.getElementById('aurora-recommendations');
      if (!host) return;
      host.querySelectorAll(':scope > .sg-poster-spacer').forEach(el => el.remove());
      host.querySelectorAll(':scope > .sg-poster-tail').forEach(tail => {
        while (tail.firstChild) host.insertBefore(tail.firstChild, tail);
        tail.remove();
      });
      const cards = Array.from(host.children).filter(el => el.classList.contains('aurora-poster-card'));
      cards.forEach(card => card.style.gridColumnStart = '');
      if (!cards.length) return;
      const tracks = getComputedStyle(host).gridTemplateColumns;
      const columns = tracks && !/repeat\(/i.test(tracks) ? tracks.trim().split(/\s+/).length : 0;
      if (!columns || columns < 2 || columns > 12) return;
      const tailCount = cards.length % columns;
      if (tailCount > 0) {
        const firstIndex = cards.length - tailCount;
        cards[firstIndex].style.gridColumnStart = String(Math.floor((columns - tailCount) / 2) + 1);
      }
    }
    window.addEventListener('resize', () => {
      if (sgPosterRowResizeRaf) cancelAnimationFrame(sgPosterRowResizeRaf);
      sgPosterRowResizeRaf = requestAnimationFrame(() => {
        sgPosterRowResizeRaf = 0;
        sgBalancePosterRows();
      });
    }, { passive:true });
    function renderAuroraRecommendations() {
      const host = document.getElementById('aurora-recommendations');
      const heroTitle = document.getElementById('aurora-hero-title');
      const heroDesc = document.getElementById('aurora-hero-desc');
      const heroMeta = document.getElementById('aurora-hero-meta');
      const heroBackdrop = document.getElementById('aurora-hero-backdrop');
      const count = document.getElementById('aurora-resource-count');
      if (!host) return;
      updateAuroraYearFilter();
      if (auroraActiveCategory) sgSyncCategoryYearSelect();
      const visibleItems = auroraCurrentVisibleItems();
      if (!visibleItems.length) {
        host._sgPosterRenderKey = null;
        const regionSelected = auroraActiveCategory && sgCategoryFilters.region !== 'all';
        const key = regionSelected ? sgRegionalKey(auroraActiveCategory, sgCategoryFilters.region) : '';
        const regionalError = key ? sgRegionalErrors.get(key) : '';
        const regionalLoading = regionSelected && !sgRegionalCache.has(key) && !regionalError;
        const title = regionSelected
          ? (regionalError ? '地区内容加载失败' : regionalLoading ? '正在读取地区影片…' : '该地区暂无匹配的影视作品')
          : (auroraActiveCategory ? '当前筛选暂无匹配内容' : '热门榜缓存尚未初始化');
        const explanation = regionSelected
          ? (regionalError ? regionalError : regionalLoading ? '首次选择该地区时读取 TMDB，后续优先使用缓存。' : '可以试试其他地区或分类，当前地区可能暂无符合条件的作品。')
          : (auroraActiveCategory ? '可以切换上方胶囊选项；榜单内容取决于 D1 已同步的影视资料。' : '请确认每日同步 Worker 已部署、TMDB_API_KEY 与 D1 绑定已配置。');
        host.innerHTML = `<div class="aurora-empty-state"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(explanation)}</small>${regionalLoading ? '' : regionSelected ? (regionalError ? '<button type="button" class="aurora-empty-action" id="sg-region-retry">重试读取地区影片</button>' : '') : '<button type="button" class="aurora-empty-action" onclick="refreshAuroraRecommendations()">重新读取推荐</button>'}</div>`;
        host.querySelector('#sg-region-retry')?.addEventListener('click', () => {
          sgRegionalErrors.delete(key);
          sgEnsureRegionalData(auroraActiveCategory, sgCategoryFilters.region);
          renderAuroraRecommendations();
        });
        if (heroTitle) { heroTitle.textContent = '你的私人影院'; heroTitle.dataset.title = ''; }
        if (heroDesc) heroDesc.textContent = '连接你自己的影视源后，这里会显示真实影片与海报。';
        if (heroMeta) heroMeta.innerHTML = '<span>个人影视源</span><span>不展示收藏和历史</span>';
        if (count) count.textContent = '0';
        return;
      }
      auroraHeroIndex = Math.max(0, Math.min(auroraHeroIndex, visibleItems.length - 1));
      const first = visibleItems[auroraHeroIndex] || visibleItems[0];
      if (!auroraActiveCategory) {
        renderAuroraHero(first);
        startAuroraHeroRotation();
      } else if (auroraHeroTimer) {
        clearInterval(auroraHeroTimer);
        auroraHeroTimer = null;
      }
      if (count) count.textContent = String(visibleItems.length);
      // AURORA 3.18: Preserve existing poster DOM when content is unchanged.
      // This avoids re-decoding/reloading many images after opening settings or returning home.
      const posterRenderKey = JSON.stringify([auroraActiveCategory, sgCategoryFilters.sub, sgCategoryFilters.region, sgCategoryFilters.year, visibleItems.map(item => [item.title, item.poster, item.type, item.remarks || item.source])]);
      if (host._sgPosterRenderKey !== posterRenderKey ||
          !host.querySelector('.aurora-poster-card')) {
        // UI-only grouping: keep the EXACT original poster buttons, lazy images,
        // click-to-search behavior and filtered data; lay out movie/TV rails.
        const sgPosterCard = (item, index) => {
          const art = item.poster && isSafeUrl(item.poster) ? `<img loading="lazy" src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
          // Keep captions inside their own painted footer. iOS Safari can
          // temporarily skip text painting when lazy poster images enter a
          // horizontally scrolling, overflow-clipped button on initial load.
          // The wrapper makes the caption independent of the image layer.
          return `<button type="button" class="aurora-poster-card" data-aurora-title="${escapeHtml(item.title)}" aria-label="查找${escapeHtml(item.title)}的真实片源"><span class="aurora-poster-art">${art}<span class="aurora-poster-placeholder" ${item.poster ? 'style="display:none"' : ''}><b>▶</b><small>${escapeHtml(item.title)}</small></span><span class="aurora-poster-tag">${escapeHtml(item.type || (index === 0 ? '热门' : '影视'))}</span></span><span class="sg-poster-info"><span class="aurora-poster-title">${escapeHtml(item.title)}</span><span class="aurora-poster-sub">${escapeHtml(item.remarks || item.type || item.source || '查看可用片源')}</span></span></button>`;
        };
        const groupsForDisplay = auroraActiveCategory
          ? sgCategoryRails(visibleItems)
          : [
              { name:'热门电影', items: visibleItems.filter(item => classifyAuroraMedia(item) === '电影') },
              { name:'热播剧集', items: visibleItems.filter(item => classifyAuroraMedia(item) !== '电影') }
            ];
        let posterIndex = 0;
        host.innerHTML = groupsForDisplay.filter(group => group.items.length).map(group => `
          <section class="sg-poster-section" aria-label="${escapeHtml(group.name)}">
            <div class="sg-poster-section-heading"><h3>${escapeHtml(group.name)}</h3><span>左右滑动查看更多</span></div>
            <div class="sg-poster-track">${group.items.map(item => sgPosterCard(item, posterIndex++)).join('')}</div>
          </section>
        `).join('');
        host.querySelectorAll('[data-aurora-title]').forEach(card => card.addEventListener('click', () => openAuroraSearch(card.getAttribute('data-aurora-title') || '')));
        host._sgPosterRenderKey = posterRenderKey;
        // A one-frame class transition asks Safari to paint newly inserted
        // poster captions independently of asynchronously loaded images.
        // Re-check the key so an older render cannot touch a newer page.
        host.classList.remove('sg-poster-captions-ready');
        requestAnimationFrame(() => {
          if (host.isConnected && host._sgPosterRenderKey === posterRenderKey) {
            host.classList.add('sg-poster-captions-ready');
          }
        });
        sgBalancePosterRows();
      }
    }
    const AURORA_TREND_CACHE_KEY = 'aurora_trending_cache_v1';
    const AURORA_SHORT_DRAMA_RE = /短剧|微短剧|竖屏剧|爽剧|付费短剧|小程序剧|mini\s*drama|vertical\s*drama/i;
    // TMDB television genres: 16=Animation, 10764=Reality, 10767=Talk.
    // Older D1/local caches sometimes labeled everything from /trending/tv as 电视剧.
    // Reclassify on read as well as at sync time; an explicit genre takes priority.
    const SG_TV_VARIETY_TITLES = /(?:你好，?星期六|明星大侦探|大侦探(?:第|·|\d)|奔跑吧|乘风(?:20\d\d|破浪|第|\s)|披荆斩棘|极限挑战|向往的生活|现在就出发|哈哈哈哈哈|喜人奇妙夜|密室大逃脱|种地吧|声生不息|再见爱人|令人心动的offer|歌手20\d\d|脱口秀大会|无限超越班|花儿与少年|非诚勿扰|快乐大本营|王牌对王牌)/i;
    const SG_TV_ANIME_TITLES = /(?:妖神记|仙逆|凡人修仙传|斗罗大陆|斗破苍穹|完美世界|吞噬星空|神印王座|猪猪侠|沧元图|灵笼|遮天(?:动画|年番)|一人之下|画江湖之不良人|狐妖小红娘|鬼灭之刃|海贼王|航海王|ONE\s*PIECE|海绵宝宝|SpongeBob|火影忍者|名侦探柯南|动漫|动画版|动画剧集|动画片)/i;
    function classifyAuroraMedia(item, fallback = '电影') {
      const rawType = String(item?.type || item?.media_type || fallback || '').trim();
      const ids = (Array.isArray(item?.genreIds) ? item.genreIds : Array.isArray(item?.genre_ids) ? item.genre_ids : Array.isArray(item?.genres) ? item.genres : [])
        .map(g => Number(typeof g === 'object' && g ? g.id : g)).filter(Number.isFinite);
      const title = String(item?.title || item?.name || '').trim();
      const source = String(item?.source || '');
      const genreText = String(item?.genreNames || item?.type_name || item?.category || '');
      const combined = rawType + ' ' + genreText + ' ' + source;
      if (ids.includes(16) || /动漫|动画|番剧|anime|animation/i.test(rawType + ' ' + genreText)) return '动漫';
      if (ids.includes(10764) || ids.includes(10767) || /综艺|真人秀|脱口秀|variety|reality|talk\s*show/i.test(rawType + ' ' + genreText)) return '综艺';
      if (SG_TV_VARIETY_TITLES.test(title) || SG_TV_ANIME_TITLES.test(title)) return SG_TV_ANIME_TITLES.test(title) ? '动漫' : '综艺';
      if (/电影|movie/i.test(rawType)) return '电影';
      if (/电视剧|连续剧|剧集|tv|series|国产剧|美剧|韩剧|日剧/i.test(rawType) || /国产热门电视剧/.test(source)) return '电视剧';
      return fallback === '电视剧' ? '电视剧' : '电影';
    }
    function normalizeTrendingItem(item) {
      const title = String(item?.title || item?.name || '').trim();
      if (!title || AURORA_SHORT_DRAMA_RE.test(title)) return null;
      const overview = String(item?.overview || item?.remarks || '').trim();
      if (AURORA_SHORT_DRAMA_RE.test(overview)) return null;
      const type = classifyAuroraMedia(item);
      const poster = String(item?.poster || item?.poster_url || item?.vod_pic || '');
      const backdrop = String(item?.backdrop || item?.backdrop_url || '');
      return {
        title,
        poster: poster && isSafeUrl(poster) ? poster : '',
        backdrop: backdrop && isSafeUrl(backdrop) ? backdrop : '',
        type,
        year: String(item?.year || item?.release_date || item?.first_air_date || '').slice(0,4),
        releaseDate: String(item?.releaseDate || item?.release_date || item?.first_air_date || item?.year || ''),
        remarks: overview || (item?.vote_average ? `热度评分 ${Number(item.vote_average).toFixed(1)}` : '实时热门'),
        source: String(item?.source || '实时热门榜'),
        genreIds: (Array.isArray(item?.genreIds) ? item.genreIds : item?.genre_ids || []).map(Number).filter(Number.isFinite),
        originCountry: item?.originCountry || item?.origin_country || [],
        popularity: Number(item?.popularity || 0),
        voteAverage: Number(item?.vote_average ?? item?.voteAverage ?? 0)
      };
    }
    const AURORA_RECOMMENDATIONS_LOCAL_KEY = 'shiguang_aurora_recommendations_v1';
    const AURORA_LAST_CHECK_KEY = 'sg_recommendations_checked_at_v1';

    function loadAuroraRecommendationLocalCache() {
      try {
        const saved = JSON.parse(localStorage.getItem(AURORA_RECOMMENDATIONS_LOCAL_KEY) || 'null');
        if (!saved || !Array.isArray(saved.items) || !saved.items.length) return false;
        const normalized = saved.items.map(normalizeTrendingItem).filter(Boolean);
        if (!normalized.length) return false;
        auroraRecommendationItems = normalized;
        const stamp = saved.updatedAt ? new Date(saved.updatedAt) : null;
        const stampText = stamp && !Number.isNaN(stamp.getTime())
          ? ` · 更新于 ${stamp.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`
          : '';
        const sectionCopy = document.querySelector('.aurora-home-section .aurora-section-head p');
        if (sectionCopy) sectionCopy.textContent = `已显示本机缓存的热门影视${stampText}，正在后台检查 D1 最新数据。`;
        return true;
      } catch (_) {
        return false;
      }
    }

    async function refreshAuroraRecommendations(force = false) {
      if (auroraRecommendationLoading) return;
      auroraRecommendationLoading = true;
      const host = document.getElementById('aurora-recommendations');
      const refreshButton = document.getElementById('aurora-refresh-recommendations');
      if (refreshButton) { refreshButton.disabled = true; refreshButton.textContent = force ? '↻ 正在更新…' : '↻ 正在读取…'; }

      // 先用本地缓存立即渲染，避免每次重新打开首页都等待网络和海报请求。
      if (!auroraRecommendationItems.length) loadAuroraRecommendationLocalCache();
      if (auroraRecommendationItems.length) renderAuroraRecommendations();
      else if (host) host.innerHTML = '<div class="aurora-empty-state"><span class="aurora-loading-orbit"></span><strong>正在读取每日热门榜</strong><small>优先读取 D1 缓存，首次读取后会保存本机快照</small></div>';

      try {
        // A fresh in-tab/local snapshot is enough for a quick reload. Keep the
        // regular D1 poll for later visits without delaying first paint.
        let recentlyChecked = false;
        try {
          const checked = Number(localStorage.getItem(AURORA_LAST_CHECK_KEY) || 0);
          recentlyChecked = !!auroraRecommendationItems.length && !force &&
            checked > 0 && Date.now() - checked >= 0 && Date.now() - checked < 120000;
        } catch (_) {}
        if (recentlyChecked) return;
        let payloadFromD1 = null;
        try {
          const endpoint = '/api/recommendations' + (force ? '?refresh=1&_t=' : '?_t=') + Date.now();
          const response = await fetch(endpoint, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/json', ...(force ? {'X-Refresh-Recommendations':'1'} : {}) }
          });
          if (response.ok) {
            const payload = await response.json();
            if (Array.isArray(payload.items) && payload.items.length) payloadFromD1 = payload;
          }
        } catch (_) {}

        if (payloadFromD1) {
          const normalized = payloadFromD1.items.map(normalizeTrendingItem).filter(Boolean);
          if (normalized.length) {
            auroraRecommendationItems = normalized;
            try {
              localStorage.setItem(AURORA_LAST_CHECK_KEY, String(Date.now()));
              localStorage.setItem(AURORA_RECOMMENDATIONS_LOCAL_KEY, JSON.stringify({
                source: payloadFromD1.source || 'TMDB',
                updatedAt: payloadFromD1.updatedAt || new Date().toISOString(),
                items: payloadFromD1.items
              }));
            } catch (_) {}
            const stamp = payloadFromD1.updatedAt ? new Date(payloadFromD1.updatedAt) : null;
            const stampText = stamp && !Number.isNaN(stamp.getTime())
              ? ` · 更新于 ${stamp.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`
              : '';
            const sectionCopy = document.querySelector('.aurora-home-section .aurora-section-head p');
            if (sectionCopy) sectionCopy.textContent = `热门榜已从 D1 缓存读取${stampText}；海报在本机缓存，点击后检索真实片源。`;
          }
        } else if (!auroraRecommendationItems.length) {
          // 首次部署或 D1 暂时无数据时，退回用户自己的影视源目录；不使用收藏/历史填充首页。
          const sites = auroraAllowedSites().slice(0, 8);
          const found = [];
          const seen = new Set();
          await asyncPool(4, sites, async site => {
            const url = site.api + (site.api.includes('?') ? '&' : '?') + 'ac=videolist&pg=1&out=json';
            try {
              const raw = await fetchWithSmartProxy(url, 3500);
              const data = JSON.parse(raw);
              const list = Array.isArray(data.list) ? data.list : (Array.isArray(data.data) ? data.data : []);
              list.forEach(v => {
                const title = String(v.vod_name || v.title || '').trim();
                const type = String(v.type_name || v.type || '').trim();
                const remarks = String(v.vod_remarks || v.vod_continu || '').trim();
                if (!title || AURORA_SHORT_DRAMA_RE.test(title + ' ' + remarks) || isNSFWSource(site.name)) return;
                const key = normalizeCleanKey(title);
                if (!key || seen.has(key)) return;
                seen.add(key);
                const posterRaw = v.vod_pic || v.pic || v.poster || '';
                found.push({
                  title,
                  poster: isSafeUrl(posterRaw) ? posterRaw : '',
                  type: classifyAuroraMedia({title, type, type_name:type}, /电视剧|连续剧|剧集|国产剧|美剧|韩剧|日剧/i.test(type) ? '电视剧' : '电影'),
                  year: String(v.vod_year || '').trim(),
                  remarks,
                  source: String(site.name || '').trim(),
                  stamp: String(v.vod_time || '')
                });
              });
            } catch (_) {}
          });
          found.sort((a,b) => (Date.parse(b.stamp) || 0) - (Date.parse(a.stamp) || 0));
          auroraRecommendationItems = found.slice(0,24);
          const sectionCopy = document.querySelector('.aurora-home-section .aurora-section-head p');
          if (sectionCopy) sectionCopy.textContent = 'D1 热门榜尚未初始化，暂时显示影视源目录；完成每日同步后将使用热门榜缓存。';
        }

        renderAuroraRecommendations();
      } finally {
        auroraRecommendationLoading = false;
        if (refreshButton) { refreshButton.disabled = false; refreshButton.textContent = '↻ 刷新推荐'; }
      }
    }

    /* 模式切换：彻底解决按钮失效，切换时清空上方输入框文字 */
    function switchMode(mode) {
      if (mode !== currentMode || (mode !== 'tv' && isLiveMode)) stopSitePlaybackOnNavigation();
      openAuroraWorkspace();
      currentMode = mode;
      currentView = 'normal';
      if (typeof syncCastUiState === 'function') syncCastUiState();
      // Bottom dock highlights the existing live button in TV mode.
      document.querySelectorAll('[data-aurora-nav]').forEach(b => b.classList.toggle('active', mode === 'tv' && b.dataset.auroraNav === 'live'));

      // 切换板块时彻底清空上方搜索框文字并重置清除按钮
      const filterInput = document.getElementById('filter');
      if (filterInput) {
        filterInput.value = '';
        toggleClearBtn('');
      }

      const btnFav = document.getElementById('btn-show-fav');
      const btnHist = document.getElementById('btn-show-history');
      if (btnFav) btnFav.classList.remove('active');
      if (btnHist) btnHist.classList.remove('active');

      const tabTv = document.getElementById('tab-tv');
      const tabVod = document.getElementById('tab-vod');
      if (tabTv) {
        tabTv.classList.toggle('active', mode === 'tv');
      }
      if (tabVod) {
        tabVod.classList.toggle('active', mode === 'vod');
      }

      const container = document.getElementById('channel-list');

      if (mode === 'tv') {
        if (filterInput) filterInput.placeholder = "搜索电视频道...";
        if (Object.keys(groups).length > 0) {
          renderList(groups, false);
        } else {
          container.innerHTML = `<div style="padding: 30px 16px; color: var(--accent); text-align: center; font-size: 13px;">正在加载电视频道... 📺</div>`;
          initTv(true).then(() => {
            // initTv itself renders loaded channels. Do not override a live
            // search that the user typed while the M3U request was in flight.
            if (currentMode === 'tv' && currentView === 'normal' &&
                !Object.keys(groups).length) {
              container.innerHTML = `<div style="padding: 30px 16px; color: var(--text-sub); text-align: center; font-size: 13px;">暂无电视直播数据，请在设置中配置直播源（M3U）地址 📺</div>`;
            }
          });
        }
      } else {
        if (filterInput) filterInput.placeholder = "搜索片名、视频、电视频道...";
        if (groupedVodList && groupedVodList.length > 0) {
          renderGroupedVodSources();
        } else {
          container.innerHTML = `<div style="padding: 30px 16px; color: var(--text-sub); text-align: center; font-size: 13px;">在上方输入关键词搜索 🔍</div>`;
        }
      }
    }

    function handleEnterSearch(e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') triggerSearch();
    }

    function triggerSearch() {
      const kw = document.getElementById('filter').value.trim();
      currentView = 'normal';
      document.getElementById('btn-show-fav').classList.remove('active');
      document.getElementById('btn-show-history').classList.remove('active');

      if (currentMode === 'vod') {
        if (!kw) return;
        fastStreamSearchVod(kw);
      } else {
        handleSearchTv();
      }
    }

    async function fetchWithSmartProxy(targetUrl, timeout = 2500, signal = null) {
      const fetchWithTimer = (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        if (signal) signal.addEventListener('abort', () => controller.abort());
        return fetch(url, { signal: controller.signal })
          .then(res => { clearTimeout(timer); if (!res.ok) throw new Error(); return res.text(); })
          .catch(e => { clearTimeout(timer); throw e; });
      };

      try { return await fetchWithTimer(targetUrl); } catch (_) {}
      try { return await fetchWithTimer(`/api/data?action=proxy&proxy_url=${encodeURIComponent(targetUrl)}`); } catch (_) {}
      throw new Error("网络超时");
    }

    async function asyncPool(poolLimit, array, iteratorFn) {
      const ret = [];
      const executing = [];
      for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);
        if (poolLimit <= array.length) {
          const e = p.then(() => executing.splice(executing.indexOf(e), 1));
          executing.push(e);
          if (executing.length >= poolLimit) await Promise.race(executing);
        }
      }
      return Promise.all(ret);
    }

    function getItemTestUrl(item) {
      if (!item) return '';
      const episodes = getEpisodesList(item);
      const targetEp = episodes[0];
      let testUrl = targetEp?.url || '';
      if (!isSafeUrl(testUrl)) return '';
      if (window.location.protocol === 'https:' && testUrl.startsWith('http://')) {
        testUrl = testUrl.replace(/^http:\/\//i, 'https://');
      }
      return testUrl;
    }

    async function probeStreamLatency(testUrl) {
      if (!isSafeUrl(testUrl)) return 9999;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const t0 = performance.now();
      try {
        await fetch(testUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-cache', signal: controller.signal });
        clearTimeout(timer);
        return Math.max(1, Math.round(performance.now() - t0));
      } catch (_) {
        clearTimeout(timer);
        return 9999;
      }
    }

    let lastRenderTimestamp = 0;
    function scheduleRenderVodSources() {
      if (renderFrameTimer) return;
      const now = performance.now();
      const waitTime = Math.max(0, 220 - (now - lastRenderTimestamp));
      renderFrameTimer = setTimeout(() => {
        requestAnimationFrame(() => {
          renderFrameTimer = null;
          lastRenderTimestamp = performance.now();
          if (currentView === 'normal' && currentMode === 'vod') {
            renderGroupedVodSources();
          }
        });
      }, waitTime);
    }

    const STAR_WORKS_MAP = {
      '成龙': ['警察故事', '醉拳', 'A计划', '神话', '十二生肖', '宝贝计划', '新警察故事', '尖峰时刻', '飞鹰计划', '快餐车', '红番区'],
      '周星驰': ['功夫', '大话西游', '少林足球', '喜剧之王', '唐伯虎点秋香', '九品芝麻官', '国产凌凌漆', '逃学威龙', '食神', '大内密探零零发'],
      '李连杰': ['黄飞鸿', '精武英雄', '方世玉', '太极张三丰', '中南海保镖', '霍元甲', '英雄', '龙门飞甲'],
      '刘德华': ['无间道', '天下无贼', '暗战', '拆弹专家', '投名状', '门徒', '天若有情', '赌侠'],
      '周润发': ['英雄本色', '赌神', '纵横四海', '监狱风云', '喋血双雄', '让子弹飞', '无双'],
      '甄子丹': ['叶问', '杀破狼', '导火线', '武侠', '追龙', '怒火·重案'],
      '林正英': ['僵尸先生', '一眉道人', '僵尸叔叔', '驱魔警察', '灵幻先生', '新僵尸先生']
    };

    // 准则 1：严格按源站标识判定。只有采集源自身带 🔞 或专属成人源站的，才属于专区源；普通正常源绝不误判进专区！
    function isNSFWSource(siteName) {
      if (!siteName) return false;
      const lower = String(siteName).toLowerCase();
      if (lower.includes('🔞')) return true;
      const nsfwSourceKeywords = [
        '麻豆', '老色逼', '黄色仓库', '大奶子', '奶香', '黑料', '桃花',
        'souav', 'souv', '黄色', '色情', 'jkun', '杏吧', '探花', '色猫'
      ];
      return nsfwSourceKeywords.some(kw => lower.includes(kw));
    }

    // 单片判断：仅依据是否来自专区源站
    function isItemNSFW(vod, siteName) {
      return isNSFWSource(siteName);
    }

    // 分组判断：凡内部包含 🔞 专区源的，一律归入“🌶️ 专区”；普通正常源聚合一律留在“🎬 聚合”或“⚡ 单源”
    function isGroupNSFW(group) {
      if (!group) return false;
      if (group.isNsfw !== undefined) return Boolean(group.isNsfw);
      if (group.items && group.items.length > 0) {
        return group.items.some(i => isNSFWSource(i.siteName));
      }
      return false;
    }

    // 准则 4：三个板块拥有各自独立的排序模式记录，互不干扰
    const categorySortState = {
      multi: 'score',
      single: 'score',
      nsfw: 'score'
    };

    function getCurrentSectionSortType() {
      const cat = currentCategoryFilter === 'auto' ? 'multi' : currentCategoryFilter;
      return categorySortState[cat] || 'score';
    }

    function setCurrentSectionSortType(sortType) {
      const cat = currentCategoryFilter === 'auto' ? 'multi' : currentCategoryFilter;
      categorySortState[cat] = sortType;
      currentVodSortType = sortType;
    }

    function getGroupBestPing(group) {
      if (!group.items || group.items.length === 0) return -1;
      let best = 99999;
      let tested = false;
      group.items.forEach(i => {
        if (i.ping !== undefined && i.ping >= 0) {
          tested = true;
          if (i.ping < best) best = i.ping;
        }
      });
      return tested ? best : -1;
    }

    function getGroupLatestTime(group) {
      // Search results can grow while responses arrive; recalculate the newest source date each time.
      let maxTime = 0;
      let maxTimeStr = '';
      (group.items || []).forEach(it => {
        const rawTime = it.vod?.vod_time || it.vod?.vod_pubdate || '';
        if (rawTime) {
          // Explicit date components avoid iOS Safari's locale-dependent Date.parse behavior.
          const m = String(rawTime).match(/((?:19|20)\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
          if (m) {
            const yyyy = Number(m[1]);
            const mm = Number(m[2]);
            const dd = Number(m[3]);
            const t = Date.UTC(yyyy, mm - 1, dd);
            const valid = mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 &&
              new Date(t).getUTCFullYear() === yyyy && new Date(t).getUTCMonth() === mm - 1 && new Date(t).getUTCDate() === dd;
            if (valid && t > maxTime) {
              maxTime = t;
              maxTimeStr = `${m[1]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
            }
          }
        }
      });
      group._latestTimestamp = maxTime;
      group._displayDate = maxTimeStr;
      return maxTime;
    }

    function calcGroupScore(group, kw, starClassics) {
      let score = 0;
      const aName = group.title.toLowerCase();
      const aActor = (group.actor || '').toLowerCase();
      const aType = (group.type || '').toLowerCase();

      if (starClassics.some(c => aName === c.toLowerCase())) score += 180;
      if (aActor.includes(kw)) score += 120;
      if (aType.includes('电影') || aType.includes('动作')) score += 40;
      if (aName === kw) score += 80;
      score += (group.items ? group.items.length : 0) * 2;
      return score;
    }

    // 准则 4 铁律闭环：无论按综合、按时间、还是按测速，多源折叠的小分组（items.length > 1）永远排在最前面，单源永远在后面！
    function sortGroupedVodList() {
      if (!groupedVodList || groupedVodList.length === 0) return;

      const kw = currentSearchingWord.toLowerCase().trim();
      let starClassics = [];
      for (const [star, works] of Object.entries(STAR_WORKS_MAP)) {
        if (kw === star.toLowerCase() || kw.includes(star.toLowerCase())) {
          starClassics = works;
          break;
        }
      }

      const activeSort = getCurrentSectionSortType();

      groupedVodList.sort((a, b) => {
        // 1. 专区与正常区隔离
        const nsfwA = isGroupNSFW(a) ? 1 : 0;
        const nsfwB = isGroupNSFW(b) ? 1 : 0;
        if (nsfwA !== nsfwB) return nsfwA - nsfwB;

        // 2. 核心铁律：多源折叠组（>1）永远优先置顶，单源（===1）永远垫后！
        const isMultiA = (a.items && a.items.length > 1) ? 1 : 0;
        const isMultiB = (b.items && b.items.length > 1) ? 1 : 0;
        if (isMultiA !== isMultiB) return isMultiB - isMultiA;

        // 3. 在各自组别内部，按当前板块所选模式独立排序
        if (activeSort === 'speed') {
          const pa = getGroupBestPing(a);
          const pb = getGroupBestPing(b);
          const va = pa < 0 ? 99999 : pa;
          const vb = pb < 0 ? 99999 : pb;
          if (va !== vb) return va - vb;
        } else if (activeSort === 'time_desc') {
          const timeA = getGroupLatestTime(a);
          const timeB = getGroupLatestTime(b);
          if (timeA !== timeB) {
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeB - timeA;
          }
        } else if (activeSort === 'time_asc') {
          const timeA = getGroupLatestTime(a);
          const timeB = getGroupLatestTime(b);
          if (timeA !== timeB) {
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeA - timeB;
          }
        }

        return calcGroupScore(b, kw, starClassics) - calcGroupScore(a, kw, starClassics);
      });
    }

    // 综合/最新/最早循环切换：只改变当前板块，不影响其他板块
    function cycleSortMode() {
      const cur = getCurrentSectionSortType();
      let nextMode = 'score';
      if (cur === 'score') {
        nextMode = 'time_desc';
        showGestureTip("已切换为：最新时间 (降序 ↓)");
      } else if (cur === 'time_desc') {
        nextMode = 'time_asc';
        showGestureTip("已切换为：早期时间 (升序 ↑)");
      } else {
        nextMode = 'score';
        showGestureTip("已切换为：智能综合排序");
      }
      setCurrentSectionSortType(nextMode);
      sortGroupedVodList();
      renderGroupedVodSources();
      saveVodSessionState();
    }

    async function setSortType(type) {
      if (type === 'speed') {
        if (isSpeedTesting) return;
        showGestureTip("⚡ 正在测速并按响应速度排序...");
        await startSpeedTest();
      } else {
        setCurrentSectionSortType(type);
        sortGroupedVodList();
        renderGroupedVodSources();
        saveVodSessionState();
      }
    }

    // 准则 2：顶部手动测速——只测当前板块卡片，测完立刻按从快到慢重排！
    async function startSpeedTest() {
      if (!groupedVodList?.length) return;
      if (isSpeedTesting) return;

      isSpeedTesting = true;
      setCurrentSectionSortType('speed');
      const speedNavBtn = document.getElementById('btn-sort-speed-nav');
      if (speedNavBtn) {
        speedNavBtn.textContent = "⚡ 测速中";
        speedNavBtn.classList.add('active-sort');
      }

      const targetGroups = [];
      if (currentCategoryFilter === 'multi') {
        groupedVodList.filter(g => !isGroupNSFW(g) && g.items.length > 1).forEach(g => targetGroups.push(g));
      } else if (currentCategoryFilter === 'single') {
        groupedVodList.filter(g => !isGroupNSFW(g) && g.items.length === 1).forEach(g => targetGroups.push(g));
      } else if (currentCategoryFilter === 'nsfw') {
        groupedVodList.filter(g => isGroupNSFW(g)).forEach(g => targetGroups.push(g));
      }

      const targetItemsToTest = [];
      targetGroups.forEach(group => {
        // 未展开的卡片只测首选前2条源以实现秒级排序；已展开的卡片测试全部子源
        const isExp = (getGroupUniqueKey(group) === activeGroupTitle);
        const listToTest = isExp ? group.items : group.items.slice(0, 2);
        listToTest.forEach(item => {
          targetItemsToTest.push({ group, item });
        });
      });

      targetItemsToTest.forEach(({ item }) => {
        const el = document.getElementById('ping-badge-' + item.id);
        if (el) {
          el.textContent = "测速中...";
          el.className = (el.classList.contains("sg-card-ping-indicator") ? "sg-single-ping sg-card-ping-indicator " : "") + "metric-ping-wait";
        }
      });

      let finishedCount = 0;
      await asyncPool(16, targetItemsToTest, async ({ item }) => {
        const testUrl = getItemTestUrl(item);
        item.ping = await probeStreamLatency(testUrl);

        const el = document.getElementById('ping-badge-' + item.id);
        if (el) {
          const isErr = item.ping >= 9999 || item.ping < 0;
          el.textContent = isErr ? "超时" : (item.ping + 'ms');
          el.className = (el.classList.contains("sg-card-ping-indicator") ? "sg-single-ping sg-card-ping-indicator " : "") + (isErr ? "metric-ping-err" : (item.ping < 500 ? "metric-ping-ok" : item.ping < 1200 ? "metric-ping-warn" : "metric-ping-err"));
        }

        finishedCount++;
        if (finishedCount % 12 === 0) {
          sortGroupedVodList();
          renderGroupedVodSources();
        }
      });

      isSpeedTesting = false;
      setCurrentSectionSortType('speed');
      sortGroupedVodList();
      renderGroupedVodSources();

      // 实时同步并重排当前正展开的卡片内部子线路，确保速度最快的子线路排在最上面
      const activeCard = document.querySelector('.title-group-box.expanded');
      if (activeCard) {
        const bodyPanel = activeCard.querySelector('.group-body-panel');
        const activeGroup = groupedVodList.find(g => getGroupUniqueKey(g) === activeGroupTitle);
        if (bodyPanel && activeGroup && activeGroup.items) {
          activeGroup.items.sort((a, b) => {
            const pa = (a.ping === undefined || a.ping < 0) ? 99999 : a.ping;
            const pb = (b.ping === undefined || b.ping < 0) ? 99999 : b.ping;
            return pa - pb;
          });
          const subCards = Array.from(bodyPanel.querySelectorAll('.source-sub-card'));
          activeGroup.items.forEach(it => {
            const matchedCard = subCards.find(c => c.querySelector('#ping-badge-' + it.id));
            if (matchedCard) bodyPanel.appendChild(matchedCard);
          });
        }
      }

      saveVodSessionState();
      showGestureTip("⚡ 测速完毕，已按响应速度从快到慢排序");
    }

    // 准则 4 & 5：不擅自屏蔽任何资源。严格按是否属于 🔞 源进行专区/正常区精准隔离
    function consolidateVodGroups() {
      if (!groupedVodList || groupedVodList.length === 0) return;
      const mergedMap = new Map();
      const result = [];

      groupedVodList.forEach(g => {
        if (!g.items || g.items.length === 0) return;
        const nsfwFlag = isGroupNSFW(g);
        g.isNsfw = nsfwFlag;

        // 命名空间隔离：正常源带 norm_ 前缀，🔞专区源带 nsfw_ 前缀，绝不可能合并进同一张卡片！
        const cleanKey = (nsfwFlag ? 'nsfw_' : 'norm_') + (normalizeCleanKey(g.title) || g.title);
        if (!mergedMap.has(cleanKey)) {
          mergedMap.set(cleanKey, g);
          result.push(g);
        } else {
          const target = mergedMap.get(cleanKey);
          if (!target.poster && g.poster) target.poster = g.poster;
          if (!target.actor && g.actor) target.actor = g.actor;
          g.items.forEach(it => {
            if (!target.items.some(ex => ex.rawKey === it.rawKey)) {
              target.items.push(it);
            }
          });
        }
      });

      groupedVodList = result;
    }

    async function fastStreamSearchVod(keyword) {
      if (currentSearchAbortController) currentSearchAbortController.abort();
      currentSearchAbortController = new AbortController();
      const currentSignal = currentSearchAbortController.signal;

      isSearchingActive = true;
      currentSearchingWord = keyword;
      currentCategoryFilter = 'auto';
      categorySortState.multi = 'score';
      categorySortState.single = 'score';
      categorySortState.nsfw = 'score';
      currentVodSortType = 'score';

      const container = document.getElementById('channel-list');

      const userGroupId = currentUser?.groupId || 'def';
      const cachedResults = VodSearchCache.get(keyword, userGroupId);
      if (cachedResults && cachedResults.length > 0) {
        groupedVodList = cachedResults;
        consolidateVodGroups();
        domNodeCache.clear();
        isSearchingActive = false;
        sortGroupedVodList();
        renderGroupedVodSources();
        saveVodSessionState();
        showGestureTip("⚡ 已从极速缓存秒开");
        return;
      }

      container.innerHTML = '<div style="padding: 28px 16px; color: var(--accent); text-align: center; font-size: 13px;">⚡ 正在智能检索《' + escapeHtml(keyword) + '》中，请稍候...</div>';
      
      groupedVodList = [];
      domNodeCache.clear();
      const kw = keyword.toLowerCase().trim();

      let availableSites = parsedSites.filter(s => !disabledSites.includes(s.name));
      if (currentUser && currentUser.role !== 'admin') {
        const userGroup = sourceGroups.find(g => g.id === currentUser.groupId) || sourceGroups.find(g => g.isDefault) || sourceGroups[0];
        if (userGroup && userGroup.sites && userGroup.sites[0] !== '*') {
          availableSites = availableSites.filter(s => userGroup.sites.includes(s.name));
        }
      }

      if (availableSites.length === 0) {
        isSearchingActive = false;
        container.innerHTML = '<div style="padding: 30px; color: var(--text-sub); text-align: center; font-size: 13px;">当前分组未开放可用的视频源，请联系主管理员</div>';
        return;
      }

      let starClassics = [];
      for (const [star, works] of Object.entries(STAR_WORKS_MAP)) {
        if (kw === star.toLowerCase() || kw.includes(star.toLowerCase())) {
          starClassics = works;
          break;
        }
      }

      const searchTasks = [];
      availableSites.forEach(site => {
        searchTasks.push({ site, term: keyword });
      });

      if (starClassics.length > 0) {
        starClassics.slice(0, 4).forEach(film => {
          availableSites.slice(0, 16).forEach(site => {
            searchTasks.push({ site, term: film });
          });
        });
      }

      const processList = (dataList, site) => {
        if (!Array.isArray(dataList)) return;
        dataList.forEach((item, itemIdx) => {
          const rawVodName = (item.vod_name || '').trim();
          const vodType = (item.type_name || '').trim();
          const vodActor = (item.vod_actor || '').trim();
          if (!rawVodName) return;

          const lowerName = rawVodName.toLowerCase();
          const lowerActor = vodActor.toLowerCase();

          const parsed = parseTitleAndVersion(rawVodName);
          const canonicalTitle = parsed.canonical;
          const versionTag = parsed.version;

          const isExactClassic = starClassics.some(c => {
            const cleanC = c.toLowerCase();
            const cleanCanonical = canonicalTitle.toLowerCase();
            return cleanCanonical === cleanC || cleanCanonical === (cleanC + '电影') || cleanCanonical === ('电影' + cleanC);
          });

          const isRelevant = lowerName.includes(kw) || lowerActor.includes(kw) || isExactClassic;
          if (!isRelevant) return;

          // 准则 1：严格按源站名是否带 🔞 划分。专区源的片源打上 isNsfw 标记
          const itemIsNsfw = isNSFWSource(site.name);
          const rawUniqueKey = site.name + '_' + (item.vod_id || itemIdx) + '_' + rawVodName;
          let hash = 0;
          for (let c = 0; c < rawUniqueKey.length; c++) {
            hash = ((hash << 5) - hash) + rawUniqueKey.charCodeAt(c);
            hash |= 0;
          }
          const safeId = 'src_' + Math.abs(hash).toString(36) + '_' + itemIdx;

          const itemResult = {
            id: safeId,
            rawKey: rawUniqueKey,
            siteName: site.name,
            versionTag: versionTag,
            vod: item,
            ping: -1,
            isNsfw: itemIsNsfw
          };

          const cleanKey = normalizeCleanKey(canonicalTitle);

          // 核心隔离：正常源绝对不与 🔞 源混在同一个卡片！
          let group = groupedVodList.find(g => {
            const gIsNsfw = g.isNsfw || (g.items && g.items.some(it => isNSFWSource(it.siteName)));
            return Boolean(gIsNsfw) === Boolean(itemIsNsfw) && (g.title === canonicalTitle || normalizeCleanKey(g.title) === cleanKey);
          });

          if (!group) {
            group = {
              title: canonicalTitle,
              poster: isSafeUrl(item.vod_pic) ? item.vod_pic : '',
              type: vodType,
              actor: vodActor,
              isNsfw: itemIsNsfw,
              items: []
            };
            groupedVodList.push(group);
          } else {
            if (!group.poster && isSafeUrl(item.vod_pic)) group.poster = item.vod_pic;
            if (!group.actor && vodActor) group.actor = vodActor;
          }

          if (!group.items.some(i => i.rawKey === rawUniqueKey)) {
            group.items.push(itemResult);
          }
        });
      };

      await asyncPool(16, searchTasks, async ({ site, term }) => {
        if (currentSignal.aborted) return;
        const urlWd = site.api + (site.api.includes('?') ? '&' : '?') + 'ac=videolist&wd=' + encodeURIComponent(term) + '&out=json&pg=1';
        try {
          const res = await fetchWithSmartProxy(urlWd, 2500, currentSignal);
          processList(JSON.parse(res).list, site);
          scheduleRenderVodSources();
        } catch (_) {}
      });

      if (currentSignal.aborted) return;
      isSearchingActive = false;
      consolidateVodGroups();

      if (groupedVodList.length === 0 && currentView === 'normal') {
        container.innerHTML = '<div style="padding: 30px; color: var(--text-sub); text-align: center; font-size: 13px;">未检索到与《' + escapeHtml(keyword) + '》相关的影视作品</div>';
        return;
      }

      sortGroupedVodList();
      VodSearchCache.set(keyword, userGroupId, groupedVodList);
      renderGroupedVodSources();
      saveVodSessionState();
    }

    // 准则 4：未展开时绝对不测速！只有在用户点击展开多源卡片时，才触发对组内线路自动测速并重排内部线路
    async function testGroupSources(group, panel) {
      if (!group || !group.items || group.items.length <= 1) return;

      group.items.forEach(item => {
        const el = document.getElementById('ping-badge-' + item.id);
        if (el) {
          el.textContent = "测速中...";
          el.className = "metric-ping-wait";
        }
      });

      await asyncPool(16, group.items, async (item) => {
        const testUrl = getItemTestUrl(item);
        item.ping = await probeStreamLatency(testUrl);
        const el = document.getElementById('ping-badge-' + item.id);
        if (el) {
          const isErr = item.ping >= 9999 || item.ping < 0;
          el.textContent = isErr ? "超时" : (item.ping + 'ms');
          el.className = isErr ? "metric-ping-err" : (item.ping < 500 ? "metric-ping-ok" : item.ping < 1200 ? "metric-ping-warn" : "metric-ping-err");
        }
      });

      // 组内子线路按响应速度从快到慢排序
      group.items.sort((a, b) => {
        const pa = (a.ping === undefined || a.ping < 0) ? 99999 : a.ping;
        const pb = (b.ping === undefined || b.ping < 0) ? 99999 : b.ping;
        return pa - pb;
      });

      const subCards = Array.from(panel.querySelectorAll('.source-sub-card'));
      if (subCards.length > 0) {
        group.items.forEach(item => {
          const card = subCards.find(c => c.querySelector('#ping-badge-' + item.id));
          if (card) panel.appendChild(card);
        });
      }

      saveVodSessionState();
    }

    function toggleEpisodesOrder() {
      isEpisodeReversed = !isEpisodeReversed;
      if (currentView === 'fav') {
        renderFavoritesView();
      } else {
        const activeCard = document.querySelector('.title-group-box.expanded');
        if (activeCard) {
          const bodyPanel = activeCard.querySelector('.group-body-panel');
          const group = groupedVodList.find(g => getGroupUniqueKey(g) === activeGroupTitle);
          if (group && bodyPanel) {
            const currentSubItem = group.items.find(r => r.id === activeSubItemId) || group.items[0];
            const oldBox = bodyPanel.querySelector('.episodes-collapse-box');
            if (oldBox) oldBox.remove();

            const episodes = getEpisodesList(currentSubItem);
            if (episodes.length > 1) {
              const collapseBox = document.createElement('div');
              collapseBox.className = 'episodes-collapse-box';
              const epStatusText = formatCurrentEpStatus(episodes, currentActiveEp);
              const orderBtnLabel = isEpisodeReversed ? '倒序 ⇵' : '正序 ⇵';
              const gridId = 'episodes-grid-list-' + normalizeCleanKey(group.title);

              collapseBox.innerHTML =
                '<div class="episodes-header">' +
                  '<span>📺 选集 (' + getDisplayEpisodesCount(episodes) + ' 集) - ' + epStatusText + '</span>' +
                  '<div class="episodes-actions">' +
                    '<button class="btn-ep-order" onclick="event.stopPropagation(); toggleEpisodesOrder()">' + orderBtnLabel + '</button>' +
                    '<span id="ep-arrow" style="font-size:11px;color:var(--text-sub);cursor:pointer;">▼ 折叠/展开</span>' +
                  '</div>' +
                '</div>' +
                '<div class="episodes-grid" id="' + gridId + '"></div>';

              const epGrid = collapseBox.querySelector('.episodes-grid');
              const displayEps = isEpisodeReversed ? episodes.slice().reverse() : episodes;

              displayEps.forEach((ep) => {
                const epIdx = ep.originalIdx;
                const btn = document.createElement('button');
                btn.className = 'ep-item ' + (epIdx === currentActiveEp ? 'active' : '');
                btn.setAttribute('data-ep-idx', String(epIdx));
                btn.textContent = ep.name;
                btn.onclick = (e) => {
                  e.stopPropagation();
                  bodyPanel.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
                  btn.classList.add('active');
                  playCurrentVodSource(currentSubItem, epIdx, false);
                  saveVodSessionState();
                };
                epGrid.appendChild(btn);
              });

              collapseBox.querySelector('.episodes-header').onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                e.stopPropagation();
                const isHide = epGrid.style.display === 'none';
                epGrid.style.display = isHide ? 'grid' : 'none';
                collapseBox.querySelector('#ep-arrow').textContent = isHide ? '▼ 收起' : '▶ 展开选集';
              };

              bodyPanel.insertBefore(collapseBox, bodyPanel.firstChild);
            }
          }
        }
      }
      showGestureTip(isEpisodeReversed ? "选集已切换为：倒序" : "选集已切换为：正序");
    }

    // 准则 4：切换板块时，自动恢复该板块上一次记录的独立排序状态，互不干扰！
    function setCategoryFilter(filterKey) {
      currentCategoryFilter = filterKey;
      currentVodSortType = getCurrentSectionSortType();
      sortGroupedVodList();
      renderGroupedVodSources();
      saveVodSessionState();
    }

    /* === 面板构建：切换线路时选集列表同步自适应重绘 === */
/* === 面板构建：切换线路选集自适应 + 片源小卡片独立收藏与集数锁定 === */
function buildGroupBodyPanel(group) {
  const bodyPanel = document.createElement('div');
  bodyPanel.className = 'group-body-panel';

  // 局部刷新函数：根据选中的源自适应更新选集网格
  function refreshEpisodesBox(sourceItem) {
    const oldBox = bodyPanel.querySelector('.episodes-collapse-box');
    if (oldBox) oldBox.remove();

    const episodes = getEpisodesList(sourceItem);
    if (episodes.length <= 1) return;

    const collapseBox = document.createElement('div');
    collapseBox.className = 'episodes-collapse-box';
    const epStatusText = formatCurrentEpStatus(episodes, currentActiveEp);

    const gridId = `episodes-grid-list-${normalizeCleanKey(group.title)}`;
    collapseBox.innerHTML = `
      <div class="episodes-header">
        <span>📺 选集 (${getDisplayEpisodesCount(episodes)} 集) - ${epStatusText}</span>
        <div class="episodes-actions">
          <button class="btn-ep-order" onclick="event.stopPropagation(); toggleEpisodesOrder()">${isEpisodeReversed ? '倒序 ⇵' : '正序 ⇵'}</button>
          <span id="ep-arrow" style="font-size:11px;color:var(--text-sub);cursor:pointer;">▼ 折叠/展开</span>
        </div>
      </div>
      <div class="episodes-grid" id="${gridId}"></div>
    `;

    const epGrid = collapseBox.querySelector('.episodes-grid');
    const displayEps = isEpisodeReversed ? episodes.slice().reverse() : episodes;

    displayEps.forEach((ep) => {
      const epIdx = ep.originalIdx;
      const btn = document.createElement('button');
      btn.className = 'ep-item ' + (epIdx === currentActiveEp ? 'active' : '');
      btn.setAttribute('data-ep-idx', String(epIdx));
      btn.textContent = ep.name;
      btn.onclick = (e) => {
        e.stopPropagation();
        bodyPanel.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        playCurrentVodSource(sourceItem, epIdx, false);
        saveVodSessionState();
        refreshSubCardsFavStatus();
      };
      epGrid.appendChild(btn);
    });

    collapseBox.querySelector('.episodes-header').onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.stopPropagation();
      const isHide = epGrid.style.display === 'none';
      epGrid.style.display = isHide ? 'grid' : 'none';
      collapseBox.querySelector('#ep-arrow').textContent = isHide ? '▼ 收起' : '▶ 展开选集';
    };

    bodyPanel.insertBefore(collapseBox, bodyPanel.firstChild);
  }

  // 实时刷新各个片源卡片上的收藏高亮与锁定的集数状态（瞬时本地匹配，0ms 响应）
  function refreshSubCardsFavStatus(favsList) {
    const favs = favsList || getLocalFavorites();
    const normGroupTitle = normalizeCleanKey(group.title);
    group.items.forEach(it => {
      const btn = bodyPanel.querySelector(`#fav-btn-${it.id}`);
      if (!btn) return;
      const normItSite = normalizeCleanKey(it.siteName);
      const favRecord = favs.find(f => f.type !== 'tv' && getCanonicalFavTitleKey(f.title) === normGroupTitle && normalizeCleanKey(f.siteName) === normItSite);
      if (favRecord) {
        btn.textContent = `★ 已收藏 (${favRecord.epName || '正片'})`;
        btn.style.color = '#facc15';
        btn.style.borderColor = '#facc15';
        btn.style.background = 'rgba(250, 204, 21, 0.12)';
      } else {
        btn.textContent = '☆ 收藏';
        btn.style.color = 'var(--text-sub)';
        btn.style.borderColor = 'var(--border-light)';
        btn.style.background = 'transparent';
      }
    });
  }

  const currentSubItem = group.items.find(r => r.id === activeSubItemId) || group.items[0];
  refreshEpisodesBox(currentSubItem);

  if (group.items.length > 1) {
    group.items.forEach((item) => {
      const isSubActive = (item.id === activeSubItemId);
      const subCard = document.createElement('div');
      subCard.className = 'source-sub-card ' + (isSubActive ? 'active-sub' : '');
      
      const q = parseQualityTag(item.vod.vod_remarks);
      const pureSite = cleanSiteName(item.siteName);
      const displayTag = item.versionTag ? `${pureSite} (${item.versionTag})` : pureSite;
      const isSpecial = isGroupNSFW(group);
      const subCensorTag = isSpecial ? detectCensorshipTag(item.vod, item.siteName) : '';
      const subCensorHtml = subCensorTag ? `<span class="card-censor ${subCensorTag.includes('无码') ? 'c-wuma' : 'c-youma'}">${subCensorTag}</span>` : '';

      let pingText = item.ping >= 0 ? (item.ping >= 9999 ? "超时" : `${item.ping}ms`) : "待测速";
      let pingClass = item.ping < 0 ? "metric-ping-wait" : (item.ping < 500 ? 'metric-ping-ok' : item.ping < 1200 ? 'metric-ping-warn' : 'metric-ping-err');

      subCard.innerHTML = `
        <div class="source-sub-left">
          <span class="card-sitename-tag">🎬 ${escapeHtml(displayTag)}</span>
          <span class="card-quality ${q.cls}">${escapeHtml(q.text)}</span>
          ${subCensorHtml}
        </div>
        <div class="card-status-bar" style="display:flex; align-items:center; gap:6px;">
          <span id="ping-badge-${item.id}" class="${pingClass}">${pingText}</span>
          <button type="button" id="fav-btn-${item.id}" style="font-size:11px; padding:2px 7px; border-radius:4px; border:1px solid var(--border-light); background:transparent; color:var(--text-sub); cursor:pointer; white-space:nowrap; outline:none; transition:all 0.15s ease;">☆ 收藏</button>
        </div>
      `;

      // 点击卡片本体：切换线路并起播
      subCard.onclick = (e) => {
        e.stopPropagation();
        activeSubItemId = item.id;
        bodyPanel.querySelectorAll('.source-sub-card').forEach(c => c.classList.remove('active-sub'));
        subCard.classList.add('active-sub');

        playCurrentVodSource(item, currentActiveEp, true);
        refreshEpisodesBox(item);
        saveVodSessionState();
        refreshSubCardsFavStatus();
      };

      // 点击小卡片收藏按钮：0ms 瞬时切换样式，后台静默上云
      const favBtn = subCard.querySelector(`#fav-btn-${item.id}`);
      favBtn.onclick = (e) => {
        e.stopPropagation();
        let favs = getLocalFavorites();
        const normGroupTitle = normalizeCleanKey(group.title);
        const normItemSite = normalizeCleanKey(item.siteName);
        const existingIdx = favs.findIndex(f => f.type !== 'tv' && getCanonicalFavTitleKey(f.title) === normGroupTitle && normalizeCleanKey(f.siteName) === normItemSite);

        const episodes = getEpisodesList(item);
        const lockEpIdx = (item.id === activeSubItemId && currentActiveEp >= 0) ? currentActiveEp : 0;
        const lockEp = episodes[lockEpIdx] || episodes[0] || { name: '正片', url: '' };

        if (existingIdx >= 0) {
          favs.splice(existingIdx, 1);
          setStatus(`已取消收藏【${escapeHtml(item.siteName)}】`, true);
        } else {
          favs.unshift({
            title: group.title,
            siteName: cleanSiteName(item.siteName),
            epName: lockEp.name,
            epIdx: lockEpIdx,
            url: lockEp.url,
            type: 'vod',
            thumb: group.poster || item.vod?.vod_pic || '',
            censorTag: subCensorTag || '',
            vod: item.vod || null,
            savedAt: new Date().toLocaleDateString()
          });
          setStatus(`⭐ 已收藏【${escapeHtml(item.siteName)} · ${escapeHtml(lockEp.name)}】`, true);
        }

        // 1. 本地存储立即写入，界面 0ms 瞬间点亮金色高亮
        localStorage.setItem(getCurrentFavKey(), JSON.stringify(favs));
        updateFavIconState(favs);
        refreshSubCardsFavStatus(favs);
        setTimeout(() => setStatus("", false), 1500);

        // 2. 后台静默写云端，不阻塞任何前端操作
        setD1Data(getCurrentFavKey(), favs);
      };

      bodyPanel.appendChild(subCard);
    });
  }

  refreshSubCardsFavStatus();
  return bodyPanel;
}

    function renderCardNode(group) {
      const groupUniqueKey = getGroupUniqueKey(group);
      let groupCard = domNodeCache.get(groupUniqueKey);

      const isSpecial = isGroupNSFW(group);
      let groupCensorTag = '';
      if (isSpecial) {
        for (const it of group.items) {
          const tag = detectCensorshipTag(it.vod, it.siteName);
          if (tag) { groupCensorTag = tag; break; }
        }
      }
      const groupCensorHtml = groupCensorTag ? `<span class="card-censor ${groupCensorTag.includes('无码') ? 'c-wuma' : 'c-youma'}">${groupCensorTag}</span>` : '';

      // Group metadata uses the latest source-provided vod_time; sorting mode must not affect visibility.
      getGroupLatestTime(group);
      const pubDate = group._displayDate || '';
      const compactDate = pubDate ? '更新：' + pubDate.slice(5) : '更新：未知';
      const pubDateHtml = `<span class="group-pub-time" data-short-date="${escapeHtml(compactDate)}" title="片源提供的最近更新时间：${escapeHtml(pubDate || '未知')}">更新：${escapeHtml(pubDate || '未知')}</span>`;

      const firstItem = group.items[0];
      const episodes = getEpisodesList(firstItem);
      const isSingleSourceSingleEp = (group.items.length === 1 && episodes.length <= 1);
      const isSingle = (group.items.length === 1);

      let sourceTagHtml = '';
      if (isSingle) {
        sourceTagHtml = `<span class="card-sitename-tag" style="background:var(--accent-soft);color:var(--accent);border:1px solid rgba(0,112,243,0.3);font-size:11px;padding:1px 6px;border-radius:4px;font-weight:600;">🎬 ${escapeHtml(cleanSiteName(firstItem.siteName))}</span>`;
      }

      const countBadgeHtml = isSingleSourceSingleEp 
        ? `<span class="group-badge-count" style="color:var(--text-sub);background:var(--bg-tag);">单集正片</span>`
        : (group.items.length === 1 
            ? `<span class="group-badge-count">${getDisplayEpisodesCount(episodes)} 集全</span>` 
            : `<span class="group-badge-count">${group.items.length} 个版本/源</span>`);

      const arrowIconHtml = isSingleSourceSingleEp
        ? `<div class="group-arrow" style="transform:none;color:var(--accent);">▶</div>`
        : `<div class="group-arrow">▼</div>`;

      // Restore original behavior: no automatic probing of single-source cards.
      // Show an existing result only after the user's normal/manual speed test.
      let singlePingHtml = '';
      if (isSingle && Number.isFinite(Number(firstItem.ping)) && Number(firstItem.ping) >= 0) {
        const isErr = Number(firstItem.ping) >= 9999;
        const pClass = isErr ? 'metric-ping-err' : Number(firstItem.ping) < 500 ? 'metric-ping-ok' : Number(firstItem.ping) < 1200 ? 'metric-ping-warn' : 'metric-ping-err';
        singlePingHtml = `<span id="ping-badge-${firstItem.id}" class="sg-single-ping sg-card-ping-indicator ${pClass}" aria-label="手动测速结果" title="已测速：${isErr ? '超时' : firstItem.ping + 'ms'}">${isErr ? '超时' : firstItem.ping + 'ms'}</span>`;
      }

      const actorHtml = group.actor
        ? '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px;">' + escapeHtml(group.actor) + '</span>'
        : '';

      if (!groupCard || !groupCard.classList.contains('title-group-box')) {
        const posterSrc = group.poster ? escapeHtml(group.poster) : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="60"%3E%3Crect width="44" height="60" fill="%23222"/%3E%3C/svg%3E';
        groupCard = document.createElement('div');
        groupCard.className = 'title-group-box';
        groupCard.innerHTML =
          '<div class="title-group-header">' +
            '<div class="group-header-left">' +
              '<img class="group-poster" src="' + posterSrc + '" loading="lazy" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2260%22%3E%3Crect width=%2244%22 height=%2260%22 fill=%22%23222%22/%3E%3C/svg%3E\'" />' +
              '<div class="group-info-wrap">' +
                '<div class="group-main-title">' + escapeHtml(group.title) + '</div>' +
                '<div class="group-meta-tag">' +
                  '<span>' + escapeHtml(group.type || '影视') + '</span>' +
                  groupCensorHtml +
                  sourceTagHtml +
                  pubDateHtml +
                  actorHtml +
                  countBadgeHtml +
                '</div>' +
              '</div>' +
            '</div>' +
            arrowIconHtml +
          '</div>';
        domNodeCache.set(groupUniqueKey, groupCard);
      } else {
        const posterImg = groupCard.querySelector('.group-poster');
        const expectedSrc = group.poster || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="60"%3E%3Crect width="44" height="60" fill="%23222"/%3E%3C/svg%3E';
        if (posterImg && posterImg.getAttribute('src') !== expectedSrc) {
          posterImg.setAttribute('src', expectedSrc);
        }
        const metaTag = groupCard.querySelector('.group-meta-tag');
        if (metaTag) {
          metaTag.innerHTML =
            '<span>' + escapeHtml(group.type || '影视') + '</span>' +
            groupCensorHtml +
            sourceTagHtml +
            pubDateHtml +
            actorHtml +
            countBadgeHtml;
        }
      }

      const isCurrentActiveGroup = (groupUniqueKey === activeGroupTitle);
      groupCard.className = 'title-group-box' + (isCurrentActiveGroup ? ' active-group expanded' : '');
      groupCard.classList.toggle('sg-has-manual-ping', !!singlePingHtml);

      // Keep manual source ping permanently visible in the compact card's
      // bottom-right corner. Do not run any new probe or change sort rules.
      const headerEl = groupCard.querySelector('.title-group-header');
      const priorPingBadge = headerEl.querySelector('.sg-card-ping-indicator');
      if (singlePingHtml) {
        if (priorPingBadge) priorPingBadge.outerHTML = singlePingHtml;
        else headerEl.insertAdjacentHTML('beforeend', singlePingHtml);
      } else if (priorPingBadge) {
        priorPingBadge.remove();
      }

      headerEl.onclick = () => {
        if (isSingleSourceSingleEp) {
          document.querySelectorAll('.title-group-box').forEach(el => el.classList.remove('active-group'));
          groupCard.classList.add('active-group');
          activeGroupTitle = groupUniqueKey;
          activeSubItemId = firstItem.id;
          currentActiveEp = 0;
          playCurrentVodSource(firstItem, 0);
          saveVodSessionState();
          return;
        }

        const isCurrentlyExpanded = groupCard.classList.contains('expanded');

        document.querySelectorAll('.title-group-box.expanded').forEach(otherCard => {
          if (otherCard !== groupCard) {
            otherCard.classList.remove('expanded');
            const p = otherCard.querySelector('.group-body-panel');
            if (p) p.remove();
          }
        });

        const oldPanel = groupCard.querySelector('.group-body-panel');
        if (oldPanel) oldPanel.remove();

        if (isCurrentlyExpanded) {
          groupCard.classList.remove('expanded');
          activeGroupTitle = '';
        } else {
          groupCard.classList.add('expanded');
          activeGroupTitle = groupUniqueKey;
          if (!activeSubItemId || !group.items.some(i => i.id === activeSubItemId)) {
            const playingMatch = (currentPlayingMeta && getCanonicalFavTitleKey(currentPlayingMeta.title) === normalizeCleanKey(group.title))
              ? group.items.find(i => normalizeCleanKey(i.siteName) === normalizeCleanKey(currentPlayingMeta.siteName))
              : null;
            activeSubItemId = (playingMatch || group.items[0])?.id || '';
            currentActiveEp = playingMatch ? (currentPlayingMeta.epIdx ?? 0) : 0;
          }
          const panel = buildGroupBodyPanel(group);
          groupCard.appendChild(panel);

          testGroupSources(group, panel);

          setTimeout(() => {
            groupCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 40);
        }
        saveVodSessionState();
      };

      const existingPanel = groupCard.querySelector('.group-body-panel');
      if (isCurrentActiveGroup && !isSingleSourceSingleEp) {
        if (!existingPanel) {
          groupCard.appendChild(buildGroupBodyPanel(group));
        } else {
          // 若当前卡片正处于展开状态，实时同步内部子线路卡片的测速文字与快慢排序顺序
          const subCards = Array.from(existingPanel.querySelectorAll('.source-sub-card'));
          if (subCards.length > 0) {
            group.items.forEach(item => {
              const badge = existingPanel.querySelector('#ping-badge-' + item.id);
              if (badge && item.ping !== undefined && item.ping >= 0) {
                const isErr = item.ping >= 9999;
                badge.textContent = isErr ? '超时' : (item.ping + 'ms');
                badge.className = isErr ? 'metric-ping-err' : (item.ping < 500 ? 'metric-ping-ok' : (item.ping < 1200 ? 'metric-ping-warn' : 'metric-ping-err'));
              }
              const card = subCards.find(c => c.querySelector('#ping-badge-' + item.id));
              if (card) existingPanel.appendChild(card);
            });
          }
        }
      } else if (existingPanel) {
        existingPanel.remove();
      }

      return groupCard;
    }

    function appendVodCardsChunk(targetList, startIdx, count) {
      const container = document.getElementById('channel-list');
      const frag = document.createDocumentFragment();
      const endIdx = Math.min(targetList.length, startIdx + count);

      for (let i = startIdx; i < endIdx; i++) {
        const group = targetList[i];
        frag.appendChild(renderCardNode(group));
      }

      currentlyRenderedCount = endIdx;

      const loader = document.getElementById('infinite-scroll-loader');
      if (loader) {
        container.insertBefore(frag, loader);
        if (currentlyRenderedCount >= targetList.length) {
          loader.style.display = 'none';
        } else {
          loader.style.display = 'block';
        }
      } else {
        container.appendChild(frag);
      }
    }

    function renderGroupedVodSources() {
      const container = document.getElementById('channel-list');
      container.classList.toggle('sg-results-grid', !!groupedVodList?.length);

      if (!groupedVodList?.length) {
        if (isSearchingActive) {
          container.innerHTML = '<div style="padding: 28px 16px; color: var(--accent); text-align: center; font-size: 13px;">⚡ 正在智能检索《' + escapeHtml(currentSearchingWord) + '》中，请稍候...</div>';
        } else {
          container.innerHTML = '<div style="padding: 30px 16px; color: var(--text-sub); text-align: center; font-size: 13px;">在上方输入关键词搜索 🔍</div>';
        }
        return;
      }

      const frag = document.createDocumentFragment();

      const normalGroups = groupedVodList.filter(g => !isGroupNSFW(g));
      const nsfwGroups = groupedVodList.filter(g => isGroupNSFW(g));

      let normalMulti = normalGroups.filter(g => g.items.length > 1);
      let normalSingle = normalGroups.filter(g => g.items.length === 1);

      const countMulti = normalMulti.length;
      const countSingle = normalSingle.length;
      const countNsfw = nsfwGroups.length;

      if (currentCategoryFilter === 'auto' ||
          (currentCategoryFilter === 'multi' && countMulti === 0) ||
          (currentCategoryFilter === 'single' && countSingle === 0) ||
          (currentCategoryFilter === 'nsfw' && countNsfw === 0)) {
        if (countMulti > 0) currentCategoryFilter = 'multi';
        else if (countSingle > 0) currentCategoryFilter = 'single';
        else if (countNsfw > 0) currentCategoryFilter = 'nsfw';
        else currentCategoryFilter = 'multi';
      }

      const sortLabel = currentVodSortType === 'time_desc' ? '🕒 最新' : (currentVodSortType === 'time_asc' ? '🕒 最早' : '⭐ 综合');
      const isCustomSortActive = (currentVodSortType !== 'speed');

      const unifiedBar = document.createElement('div');
      unifiedBar.className = 'top-unified-bar';
      unifiedBar.innerHTML =
        '<div class="bar-left-group">' +
          (countMulti > 0 ? '<button type="button" class="filter-pill-btn ' + (currentCategoryFilter === 'multi' ? 'active' : '') + '" onclick="setCategoryFilter(\'multi\')">🎬 聚合(' + countMulti + ')</button>' : '') +
          (countSingle > 0 ? '<button type="button" class="filter-pill-btn ' + (currentCategoryFilter === 'single' ? 'active' : '') + '" onclick="setCategoryFilter(\'single\')">⚡ 单源(' + countSingle + ')</button>' : '') +
          (countNsfw > 0 ? '<button type="button" class="filter-pill-btn ' + (currentCategoryFilter === 'nsfw' ? 'active' : '') + '" onclick="setCategoryFilter(\'nsfw\')">🌶️ 专区(' + countNsfw + ')</button>' : '') +
        '</div>' +
        '<div class="bar-right-group">' +
          '<button type="button" class="btn-sort-action ' + (isCustomSortActive ? 'active-sort' : '') + '" onclick="cycleSortMode()" title="点击切换：综合 / 最新 / 最早">' +
            '<span>' + sortLabel + '</span>' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>' +
          '</button>' +
          '<button type="button" id="btn-sort-speed-nav" class="btn-sort-action ' + (currentVodSortType === 'speed' ? 'active-sort' : '') + '" onclick="setSortType(\'speed\')">' + (isSpeedTesting ? '⚡ 测速中' : '⚡ 测速') + '</button>' +
        '</div>';
      frag.appendChild(unifiedBar);

      activeDisplayCardList = [];
      if (currentCategoryFilter === 'multi') {
        normalMulti.forEach(g => activeDisplayCardList.push(g));
      } else if (currentCategoryFilter === 'single') {
        normalSingle.forEach(g => activeDisplayCardList.push(g));
      } else if (currentCategoryFilter === 'nsfw') {
        nsfwGroups.forEach(g => activeDisplayCardList.push(g));
      }

      // 保持缓存卡片的内部展开状态与节点顺序一致
      domNodeCache.forEach((cardEl) => {
        if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
      });

      currentlyRenderedCount = 0;
      const initialChunkSize = Math.min(activeDisplayCardList.length, CHUNK_PAGE_SIZE);

      for (let i = 0; i < initialChunkSize; i++) {
        const group = activeDisplayCardList[i];
        frag.appendChild(renderCardNode(group));
      }
      currentlyRenderedCount = initialChunkSize;

      const loaderEl = document.createElement('div');
      loaderEl.id = 'infinite-scroll-loader';
      loaderEl.className = 'scroll-loading-indicator';
      loaderEl.textContent = '滚动加载更多...';
      loaderEl.style.display = (currentlyRenderedCount < activeDisplayCardList.length) ? 'block' : 'none';
      frag.appendChild(loaderEl);

      container.replaceChildren(frag);
    }

    const channelListEl = document.getElementById('channel-list');
    channelListEl.addEventListener('scroll', () => {
      if (currentView !== 'normal' || currentMode !== 'vod') return;
      if (currentlyRenderedCount >= activeDisplayCardList.length) return;

      if (channelListEl.scrollTop + channelListEl.clientHeight >= channelListEl.scrollHeight - 160) {
        appendVodCardsChunk(activeDisplayCardList, currentlyRenderedCount, CHUNK_PAGE_SIZE);
      }
    }, { passive: true });

    // 智能多播放组解析：优先取 .m3u8 播放组，若为空则自动遍历其他组提取有效直链，救回“假0集”片源
    function getEpisodesList(item) {
      if (!item?.vod) return [];
      const playUrlStr = (item.vod.vod_play_url || '').trim();
      if (!playUrlStr) return [];

      const playGroups = playUrlStr.split('\x24\x24\x24').map(s => s.trim()).filter(Boolean);
      const sortedGroups = playGroups.slice().sort((a, b) => {
        const hasM3u8A = a.toLowerCase().includes('.m3u8') ? 0 : 1;
        const hasM3u8B = b.toLowerCase().includes('.m3u8') ? 0 : 1;
        return hasM3u8A - hasM3u8B;
      });

      for (const grp of sortedGroups) {
        const rawEps = grp.split('#').map(s => s.trim()).filter(Boolean);
        const validEps = [];
        const seenKeyToIndex = new Map();

        rawEps.forEach((ep, idx) => {
          const parts = ep.split('\x24');
          const urlCandidate = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
          if (!isSafeUrl(urlCandidate)) return;

          const rawName = (parts.length > 1 ? parts[0] : ('第' + (idx + 1) + '集')).trim() || ('第' + (idx + 1) + '集');
          const pureNumMatch = rawName.match(/^(?:第\s*)?0*(\d+)\s*(?:集|话|期)?(?![\s\S])/i);
          const dedupKey = pureNumMatch ? ('ep_num_' + pureNumMatch[1]) : ('ep_str_' + rawName.toLowerCase());

          if (seenKeyToIndex.has(dedupKey)) {
            const existIdx = seenKeyToIndex.get(dedupKey);
            validEps[existIdx].url = urlCandidate;
            validEps[existIdx].name = rawName;
          } else {
            seenKeyToIndex.set(dedupKey, validEps.length);
            validEps.push({
              originalIdx: validEps.length,
              name: rawName,
              url: urlCandidate
            });
          }
        });

        if (validEps.length > 0) return validEps;
      }

      return [];
    }

    // 智能获取展示总集数：若最后一集明确为“第215集”，则以实际最新集数215为准，消除特别篇/预告造成的数量虚高
    function getDisplayEpisodesCount(episodes) {
      if (!episodes || episodes.length === 0) return 0;
      const lastEpName = String(episodes[episodes.length - 1]?.name || '').trim();
      const lastNum = parseEpisodeNumber(lastEpName);
      if (lastNum && lastNum > 0 && /(?:第|ep|e)\s*\d+\s*(?:集|话|期)/i.test(lastEpName)) {
        return lastNum;
      }
      return episodes.length;
    }

    // 智能格式化当前集数文字：直接读取按钮真实集数（如“第215集” -> “当前第 215 集”），绝不盲目用数组下标+1
    function formatCurrentEpStatus(episodes, activeIdx) {
      if (activeIdx < 0 || !episodes || !episodes[activeIdx]) {
        return '<span style="color:#ef4444;font-weight:bold;">未更新当前集</span>';
      }
      const epName = String(episodes[activeIdx].name || '').trim();
      const epNum = parseEpisodeNumber(epName);
      if (epNum !== null && /(?:第|ep|e)\s*\d+\s*(?:集|话|期)?|^\d+(?![\s\S])/i.test(epName)) {
        return '当前第 ' + epNum + ' 集';
      }
      return epName ? ('当前: ' + escapeHtml(epName)) : ('当前第 ' + (activeIdx + 1) + ' 集');
    }

    /* === 集数编号与语义提取辅助函数 === */
    function parseEpisodeNumber(name) {
      if (!name) return null;
      const str = String(name).trim();
      const mExplicit = str.match(/(?:第|ep|e)\s*(\d+)\s*(?:集|话|期)?/i);
      if (mExplicit) return parseInt(mExplicit[1], 10);
      const mPure = str.match(/^\s*(\d+)\s*(?![\s\S])/);
      if (mPure) return parseInt(mPure[1], 10);
      const mNum = str.match(/(?:^|[^\d])(\d+)(?:[^\d]|(?![\s\S]))/);
      if (mNum) return parseInt(mNum[1], 10);
      return null;
    }

function findMatchingEpisodeIndex(targetEpisodes, currentEpName, fallbackIndex = 0) {
  if (!targetEpisodes || targetEpisodes.length === 0) return -1;

  if (currentEpName) {
    const cleanCur = currentEpName.trim().toLowerCase();
    const exactIdx = targetEpisodes.findIndex(ep => ep.name.trim().toLowerCase() === cleanCur);
    if (exactIdx >= 0) return exactIdx;

    const curNum = parseEpisodeNumber(currentEpName);
    if (curNum !== null) {
      const numIdx = targetEpisodes.findIndex(ep => parseEpisodeNumber(ep.name) === curNum);
      if (numIdx >= 0) return numIdx;
      return -1;
    }
  }

  if (fallbackIndex >= 0 && fallbackIndex < targetEpisodes.length) {
    return fallbackIndex;
  }
  return -1;
}

/* === 播放驱动：精准集数匹配 + 越界自适应兜底 + 看到哪自动实时同步回收藏夹与界面 === */
function playCurrentVodSource(item, targetEpParam = 0, isSourceSwitch = false) {
  if (!item?.vod) return;
  isLiveMode = false;
  if (typeof syncCastUiState === 'function') syncCastUiState();

  const episodes = getEpisodesList(item);
  let targetEpIdx = -1;
  const prevEpIdx = currentActiveEp;

  const isSameWork = currentPlayingMeta?.title &&
    normalizeCleanKey(parseTitleAndVersion(currentPlayingMeta.title).canonical) ===
    normalizeCleanKey(parseTitleAndVersion(item.vod.vod_name).canonical);

  if (isSourceSwitch) {
    if (isSameWork && currentPlayingMeta?.epName) {
      targetEpIdx = findMatchingEpisodeIndex(episodes, currentPlayingMeta.epName, prevEpIdx);
    } else {
      targetEpIdx = (typeof targetEpParam === 'number' && targetEpParam >= 0 && targetEpParam < episodes.length) ? targetEpParam : 0;
    }
  } else if (typeof targetEpParam === 'number') {
    if (targetEpParam >= 0 && targetEpParam < episodes.length) {
      targetEpIdx = targetEpParam;
    } else if (isSameWork && currentPlayingMeta?.epName) {
      targetEpIdx = findMatchingEpisodeIndex(episodes, currentPlayingMeta.epName, 0);
    } else if (item.vod?.vod_remarks) {
      targetEpIdx = findMatchingEpisodeIndex(episodes, item.vod.vod_remarks, 0);
    } else {
      targetEpIdx = 0;
    }
  } else if (typeof targetEpParam === 'string') {
    targetEpIdx = findMatchingEpisodeIndex(episodes, targetEpParam, 0);
  } else {
    targetEpIdx = 0;
  }

  if (targetEpIdx < 0 || !episodes[targetEpIdx]?.url) {
    const missingEpText = (isSameWork && currentPlayingMeta?.epName) || (prevEpIdx >= 0 ? `第${prevEpIdx + 1}集` : '当前集数');
    currentActiveEp = -1;
    currentStreamUrl = "";
    ++playbackGeneration; // No stale success/error from the previous episode.
    destroyHlsInstance();
    video.onplaying = video.onloadeddata = video.onloadedmetadata = video.oncanplay = video.onerror = null;
    updatePlayBtn(false);
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (_) {}

    currentTitle.textContent = `${item.vod.vod_name} - 该线路暂未更新`;
    routeBadge.style.display = 'none';
    routeBadge.textContent = '';

    setStatus(`⚠️ 该线路暂未更新【${escapeHtml(missingEpText)}】<br><span style="color:var(--text-sub);font-size:12px;">该源共 ${getDisplayEpisodesCount(episodes)} 集，请选择其他源播放</span>`, true);
    return;
  }

  currentActiveEp = targetEpIdx;
  const targetEp = episodes[targetEpIdx];
  let rawUrl = targetEp.url;
  if (window.location.protocol === 'https:' && rawUrl.startsWith('http://')) {
    rawUrl = rawUrl.replace('http://', 'https://');
  }

  currentVodUniqueKey = `${item.vod.vod_name}_${targetEp.name}`;
  currentTitle.textContent = `${item.vod.vod_name} - ${targetEp.name}`;
  routeBadge.style.display = 'none';
  routeBadge.textContent = '';
  currentStreamUrl = rawUrl;

  const isSpecial = isNSFWSource(item.siteName) || isGroupNSFW({ items: [item], type: item.vod?.type_name, title: item.vod?.vod_name });
  const cTag = isSpecial ? detectCensorshipTag(item.vod, item.siteName) : '';

  currentPlayingMeta = {
    title: item.vod.vod_name,
    epName: targetEp.name,
    siteName: item.siteName,
    thumb: item.vod.vod_pic || '',
    censorTag: cTag,
    vod: item.vod,
    epIdx: targetEpIdx,
    url: rawUrl
  };

  const cleanCurrentTitle = normalizeCleanKey(parseTitleAndVersion(item.vod.vod_name).canonical) || normalizeCleanKey(item.vod.vod_name);
  const cleanCurrentSite = normalizeCleanKey(item.siteName);

  getFavoritesList().then(favs => {
    let updated = false;
    favs.forEach(f => {
      const fCleanTitle = normalizeCleanKey(parseTitleAndVersion(f.title).canonical) || normalizeCleanKey(f.title);
      if (f.type !== 'tv' && fCleanTitle === cleanCurrentTitle && normalizeCleanKey(f.siteName) === cleanCurrentSite) {
        f.epName = targetEp.name;
        f.epIdx = targetEpIdx;
        f.url = rawUrl;
        if (!f.vod || getEpisodesList({ vod: item.vod }).length >= getEpisodesList({ vod: f.vod }).length) f.vod = item.vod;
        updated = true;
      }
    });

    if (updated) {
      setD1Data(getCurrentFavKey(), favs);
      if (currentView === 'fav') {
        const trackLabel = document.getElementById(`fav-meta-track-${cleanCurrentTitle}`);
        if (trackLabel) trackLabel.textContent = `看到: ${targetEp.name}`;
        const grid = document.getElementById(`episodes-grid-list-${cleanCurrentTitle}`);
        if (grid) {
          grid.querySelectorAll('.ep-item').forEach(b => {
            const bIdx = parseInt(b.getAttribute('data-ep-idx'), 10);
            b.classList.toggle('active', bIdx === targetEpIdx);
          });
          const favHeaderSpan = grid.parentElement?.querySelector('.episodes-header > span');
          if (favHeaderSpan) {
            favHeaderSpan.innerHTML = `📺 选集 (${getDisplayEpisodesCount(episodes)} 集) - ${formatCurrentEpStatus(episodes, targetEpIdx)}`;
          }
        }
      }
    }
  });

  // 主搜索视窗选集网格与集数标题联动高亮
  const mainEpGrid = document.getElementById(`episodes-grid-list-${cleanCurrentTitle}`);
  if (mainEpGrid) {
    mainEpGrid.querySelectorAll('.ep-item').forEach(b => {
      const bIdx = parseInt(b.getAttribute('data-ep-idx'), 10);
      b.classList.toggle('active', bIdx === targetEpIdx);
    });
    const epHeaderSpan = mainEpGrid.parentElement?.querySelector('.episodes-header > span');
    if (epHeaderSpan) {
      epHeaderSpan.innerHTML = `📺 选集 (${getDisplayEpisodesCount(episodes)} 集) - ${formatCurrentEpStatus(episodes, targetEpIdx)}`;
    }
  }

  updateFavIconState();
  manualPlayOnly(rawUrl);
}

    function destroyHlsInstance() {
      clearPlayWatchdog();
      // Switching pages, sources, or channels must cancel pending buffer recovery.
      if (sgPlaybackMonitorCleanup) {
        const cleanup = sgPlaybackMonitorCleanup;
        sgPlaybackMonitorCleanup = null;
        cleanup();
      }
      exitPictureInPictureMode();
      if (hls) {
        hls.stopLoad();
        hls.detachMedia();
        hls.destroy();
        hls = null;
      }
    }

    function clearPlayWatchdog() {
      if (playWatchdogTimer) {
        clearTimeout(playWatchdogTimer);
        playWatchdogTimer = null;
      }
    }

    // V4: 被动线路健康统计。仅用于记录，不改变选线、重试、UI 或 D1 行为。
    const V4_HEALTH_KEY = 'mytv_v4_line_health';
    function recordV4LineHealth(url, success, elapsedMs) {
      try {
        if (!url || typeof localStorage === 'undefined') return;
        // 不存储完整播放地址（可能包含私有令牌），仅保存不可逆的短哈希。
        let hash = 2166136261;
        for (let i = 0; i < url.length; i++) {
          hash ^= url.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        const key = (hash >>> 0).toString(16);
        const old = JSON.parse(localStorage.getItem(V4_HEALTH_KEY) || '{}');
        const data = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
        const item = data[key] || { ok: 0, fail: 0, avgMs: 0, updated: 0 };
        if (success) {
          item.ok = Math.min(100000, (item.ok || 0) + 1);
          if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
            item.avgMs = item.avgMs ? Math.round(item.avgMs * 0.75 + elapsedMs * 0.25) : Math.round(elapsedMs);
          }
        } else {
          item.fail = Math.min(100000, (item.fail || 0) + 1);
        }
        item.updated = Date.now();
        data[key] = item;
        const entries = Object.entries(data);
        if (entries.length > 80) {
          entries.sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0));
          for (const [staleKey] of entries.slice(80)) delete data[staleKey];
        }
        localStorage.setItem(V4_HEALTH_KEY, JSON.stringify(data));
      } catch (_) { /* 存储被禁用、空间不足等情况不能影响播放 */ }
    }

    // V4.2: 只读线路健康推荐数据。不自动选线、不修改 UI 或播放规则。
    // 在浏览器控制台执行 mytvLineHealthReport() 可查看匿名线路评分。
    function getV42LineHealthReport() {
      try {
        const parsed = JSON.parse(localStorage.getItem(V4_HEALTH_KEY) || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
        const now = Date.now();
        return Object.entries(parsed).filter(([key, item]) =>
          /^[0-9a-f]{1,8}$/.test(key) && item && typeof item === 'object'
        ).map(([key, item]) => {
          const ok = Math.max(0, Number(item.ok) || 0);
          const fail = Math.max(0, Number(item.fail) || 0);
          const samples = ok + fail;
          const avgMs = Math.max(0, Number(item.avgMs) || 0);
          const ageDays = Math.max(0, (now - (Number(item.updated) || 0)) / 86400000);
          // 少量样本使用平滑成功率；旧记录降低可信度，不改变播放顺序。
          const successRate = (ok + 1) / (samples + 2);
          const confidence = Math.min(1, samples / 8) * Math.exp(-ageDays / 30);
          const speedFactor = avgMs > 0 ? 1 / (1 + avgMs / 10000) : 0.5;
          const score = Math.round(100 * confidence * (successRate * 0.8 + speedFactor * 0.2));
          return { lineId: key, successes: ok, failures: fail, avgLoadMs: avgMs,
            samples, score, lastSeen: Number(item.updated) || 0 };
        }).sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen);
      } catch (_) { return []; }
    }
    // 只读诊断入口：不暴露播放 URL，不写数据库或本地存储。
    window.mytvLineHealthReport = getV42LineHealthReport;

    function showFailTip(msg) {
      clearPlayWatchdog();
      playbackGeneration++; // 使旧线路的异步回调失效
      destroyHlsInstance();
      updatePlayBtn(false);
      try { video.pause(); } catch(_) {}
      const tipText = msg || "当前线路受限<br><span style='color:var(--text-sub);font-size:12px;'>源站拒绝连接或防盗链拦截，请在下方选择其他源或调用外部播放器</span>";
      setStatus(tipText, true);

      if (!isLiveMode && currentPlayingMeta?.siteName) {
        if (tipText.includes("编码格式不支持") || tipText.includes("响应超时") || tipText.includes("网络连接失败")) {
          recordSourceFailure(currentPlayingMeta.siteName, currentVodUniqueKey);
        }
      }
    }

    const VPS_TV_BASE = 'https://jp.luyizhong.eu.org/tv';
    let hasActiveRemoteTv = false;

    function stopRemoteTvTranscode() {
      if (!hasActiveRemoteTv) return;
      hasActiveRemoteTv = false;
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${VPS_TV_BASE}/stop?_t=${Date.now()}`);
        } else {
          fetch(`${VPS_TV_BASE}/stop?_t=${Date.now()}`, { mode: 'no-cors', keepalive: true }).catch(() => {});
        }
      } catch (_) {}
    }

    // AURORA 3.20.2: HLS.js is unnecessary on iPhone Safari (native HLS).
    // Only request it when playback actually needs the JavaScript decoder.
    const SG_HLS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
    let sgHlsLoadPromise = null;
    function sgEnsureHlsJs() {
      if (window.Hls && window.Hls.isSupported && window.Hls.isSupported()) return Promise.resolve(true);
      if (sgHlsLoadPromise) return sgHlsLoadPromise;
      sgHlsLoadPromise = new Promise(resolve => {
        let done = false;
        const script = document.createElement('script');
        let watchdog;
        const finish = ok => {
          if (done) return;
          done = true;
          clearTimeout(watchdog);
          script.onload = null;
          script.onerror = null;
          if (!ok) script.remove();
          resolve(ok);
        };
        script.async = true;
        script.src = SG_HLS_SCRIPT_URL;
        script.onload = () => finish(!!window.Hls?.isSupported?.());
        script.onerror = () => finish(false);
        watchdog = setTimeout(() => finish(false), 12000);
        document.head.appendChild(script);
      }).then(ok => {
        // The CDN may temporarily fail: do not permanently poison playback.
        if (!ok) sgHlsLoadPromise = null;
        return ok;
      });
      return sgHlsLoadPromise;
    }

    // AURORA Playback Stability: identify direct video files before selecting
    // the HLS engine. Unknown extensionless URLs retain the old HLS path.
    function sgPlaybackMediaKind(url, live) {
      if (live) return 'hls'; // VPS /live.m3u8 is always an HLS manifest.
      if (/^(?:blob:|data:(?:video|audio)\/)/i.test(url)) return 'direct';
      let parsed;
      try { parsed = new URL(url, window.location.href); }
      catch (_) { return 'unknown'; }
      const path = parsed.pathname.toLowerCase();
      if (/\.(?:m3u8|m3u)$/.test(path)) return 'hls';
      if (/\.(?:mp4|m4v|mov|webm|ogv|ogg|mp3|m4a)$/.test(path)) return 'direct';
      const hintedType = String(parsed.searchParams.get('type') ||
        parsed.searchParams.get('format') || parsed.searchParams.get('ext') || '').toLowerCase();
      if (/^(?:m3u8?|hls)$/.test(hintedType)) return 'hls';
      if (/^(?:mp4|m4v|mov|webm|ogv|ogg|mp3|m4a)$/.test(hintedType)) return 'direct';
      // Some providers proxy the stream through ?url=<encoded media URL>.
      for (const key of ['url', 'play', 'src']) {
        const inner = parsed.searchParams.get(key) || '';
        if (/\.m3u8?(?:[?#]|$)/i.test(inner)) return 'hls';
        if (/\.(?:mp4|m4v|mov|webm|ogv|ogg)(?:[?#]|$)/i.test(inner)) return 'direct';
      }
      return 'unknown';
    }

    async function manualPlayOnly(url) {
      if (!url) return;
      if (typeof syncCastUiState === 'function') syncCastUiState();
      let playUrl = url;

      if (isLiveMode) {
        // Keep original VPS transcoding behavior and raw URL for external apps.
        let rawTarget = url;
        if (url.startsWith(`${VPS_TV_BASE}/live.m3u8?url=`)) {
          try { rawTarget = decodeURIComponent(url.split('url=')[1].split('&')[0]); } catch (_) {}
        }
        playUrl = `${VPS_TV_BASE}/live.m3u8?url=${encodeURIComponent(rawTarget)}`;
        currentStreamUrl = playUrl;
        window.currentRawStreamUrl = rawTarget;
        hasActiveRemoteTv = true;
      } else {
        stopRemoteTvTranscode();
        currentStreamUrl = url;
      }
      url = playUrl;

      const generation = ++playbackGeneration;
      const liveSession = isLiveMode;
      const kind = sgPlaybackMediaKind(url, liveSession);
      const startedAt = Date.now();
      let outcomeRecorded = false;
      let hasStarted = false;
      let manualStartNeeded = false;
      let recoveryAttempts = 0;
      let networkRecoveryAttempts = 0;
      let mediaRecoveryAttempts = 0;
      let lastNetworkErrorAt = 0;
      let lastMediaErrorAt = 0;
      let hasBufferStatus = false;
      let bufferNoticeTimer = null;
      let bufferRecoveryTimer = null;
      let bufferFinalTimer = null;
      let networkRecoveryTimer = null;
      let lastPlaybackTime = 0;
      const isCurrent = () => generation === playbackGeneration;
      const recordOutcome = success => {
        if (outcomeRecorded || !isCurrent()) return;
        outcomeRecorded = true;
        recordV4LineHealth(url, success, Date.now() - startedAt);
      };
      const fail = message => {
        if (!isCurrent()) return;
        recordOutcome(false);
        showFailTip(message);
      };
      const clearBufferTimers = () => {
        clearTimeout(bufferNoticeTimer); bufferNoticeTimer = null;
        clearTimeout(bufferRecoveryTimer); bufferRecoveryTimer = null;
        clearTimeout(bufferFinalTimer); bufferFinalTimer = null;
      };
      const stopSessionTimers = () => {
        clearBufferTimers();
        clearTimeout(networkRecoveryTimer); networkRecoveryTimer = null;
      };
      // The current playback session owns all its buffer event listeners.
      const onWaiting = () => {
        if (!isCurrent() || !hasStarted || manualStartNeeded ||
            video.paused || video.seeking || document.hidden || bufferRecoveryTimer) return;
        bufferNoticeTimer = setTimeout(() => {
          if (isCurrent() && !video.paused && !video.seeking && !document.hidden) {
            hasBufferStatus = true;
            setStatus('正在缓冲…');
          }
        }, 2500);
        bufferRecoveryTimer = setTimeout(() => {
          if (!isCurrent() || video.paused || video.seeking || document.hidden) return;
          if (recoveryAttempts >= 1) return;
          recoveryAttempts++;
          hasBufferStatus = true;
          const recoveryPosition = Number(video.currentTime) || 0;
          setStatus('网络不稳定，正在尝试恢复…');
          if (hls && typeof hls.startLoad === 'function') {
            try { hls.startLoad(); } catch (_) {}
          } else if (liveSession) {
            // Only reload native live HLS: reloading VOD would lose its position.
            try { video.load(); } catch (_) {}
            attemptPlay();
          } else {
            attemptPlay();
          }
          bufferFinalTimer = setTimeout(() => {
            if (isCurrent() && !video.paused && !video.seeking && !document.hidden &&
                Math.abs((Number(video.currentTime) || 0) - recoveryPosition) < 0.2) {
              fail('当前线路持续缓冲，请切换线路或使用外部播放器');
            }
          }, 14000);
        }, 16000);
      };
      const onProgressTime = () => {
        if (!isCurrent()) return;
        const now = Number(video.currentTime) || 0;
        if (Math.abs(now - lastPlaybackTime) > 0.1) {
          lastPlaybackTime = now;
          clearBufferTimers();
          if (hasBufferStatus) {
            hasBufferStatus = false;
            setStatus('', false);
          }
        }
      };
      const onPause = () => { if (isCurrent()) clearBufferTimers(); };
      const onSeeked = () => { if (isCurrent()) clearBufferTimers(); };
      const onVisible = () => { if (document.hidden) clearBufferTimers(); };
      // In addition to source cancellation, remove all listeners when leaving.
      clearPlayWatchdog();
      destroyHlsInstance();
      // Release the old media BEFORE attaching the new error handlers.
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {}
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('stalled', onWaiting);
      video.addEventListener('timeupdate', onProgressTime);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);
      document.addEventListener('visibilitychange', onVisible);
      sgPlaybackMonitorCleanup = () => {
        stopSessionTimers();
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('stalled', onWaiting);
        video.removeEventListener('timeupdate', onProgressTime);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        document.removeEventListener('visibilitychange', onVisible);
      };
      setStatus(liveSession ? '正在加载…' : '正在建立连接，请稍候...');
      updatePlayBtn(false);

      const markPlaying = () => {
        if (!isCurrent()) return;
        recordOutcome(true);
        clearBufferTimers();
        manualStartNeeded = false;
        recoveryAttempts = 0;
        if (hasStarted) return;
        hasStarted = true;
        clearPlayWatchdog();
        setStatus('', false);
        updatePlayBtn(true);
        restorePlaybackProgress(generation);
        showControls();
      };
      const attemptPlay = () => {
        if (!isCurrent()) return;
        let promise;
        try { promise = video.play(); }
        catch (err) { promise = Promise.reject(err); }
        if (promise && typeof promise.catch === 'function') {
          promise.catch(err => {
            if (!isCurrent()) return;
            if (err?.name === 'AbortError') return; // Old source was stopped.
            if (err?.name === 'NotAllowedError') {
              // Safari: do NOT mute the stream without the user's permission.
              manualStartNeeded = true;
              clearPlayWatchdog();
              clearBufferTimers();
              updatePlayBtn(false);
              setStatus('浏览器已暂停自动播放，请点击播放器的播放按钮');
            } else if (err?.name === 'NotSupportedError') {
              fail('当前视频格式或编码不受浏览器支持，请切换线路或使用外部播放器');
            } else {
              // A transient play() rejection can coincide with HLS attaching;
              // leave the startup watchdog to distinguish it from a real outage.
            }
          });
        }
      };

      // The first frame/metadata is not proof of actual playback.
      video.onplaying = () => {
        if (typeof sgEnsureVideoAndAudioTracks === 'function') sgEnsureVideoAndAudioTracks(video);
        markPlaying();
      };
      video.onloadeddata = () => {
        if (!isCurrent()) return;
        if (typeof sgEnsureVideoAndAudioTracks === 'function') sgEnsureVideoAndAudioTracks(video);
      };
      video.onloadedmetadata = () => {
        if (!isCurrent()) return;
        if (typeof sgEnsureVideoAndAudioTracks === 'function') sgEnsureVideoAndAudioTracks(video);
      };
      video.oncanplay = () => { if (!isCurrent()) return; };
      video.onerror = () => {
        if (!isCurrent()) return;
        // HLS.js may handle media errors internally and attempt bounded recovery.
        if (hls) return;
        const code = video.error?.code;
        if (code === 2) {
          fail('当前视频网络连接失败，请切换线路或稍后重试');
        } else if (code === 3 || code === 4) {
          fail('当前视频格式或编码不受浏览器支持，请切换线路或使用外部播放器');
        } else {
          fail('当前线路播放失败，请检查网络或切换线路');
        }
      };
      // Late metadata or canplay never cancels this startup watchdog.
      playWatchdogTimer = setTimeout(() => {
        if (isCurrent() && !hasStarted && !manualStartNeeded && !document.hidden) {
          fail('当前线路响应超时，请切换线路或使用外部播放器');
        }
      }, liveSession ? 25000 : 20000);

      // Direct files must not be passed to Hls.js (e.g. MP4 on desktop Chrome).
      if (kind === 'direct') {
        video.src = url;
        try { video.load(); } catch (_) {}
        attemptPlay();
        return;
      }

      // Sync active Google Cast session if connected when switching episodes
      if (!liveSession && typeof sgSyncGoogleCastOnEpisodeChange === 'function') {
        sgSyncGoogleCastOnEpisodeChange(url);
      }

      // Native Safari/iPadOS HLS; do not download an unnecessary decoder.
      // Keep native video.src untouched so AirPlay retains full Adaptive Bitrate (ABR) and pre-buffered segments without lag.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        try { video.load(); } catch (_) {}
        attemptPlay();
        return;
      }

      // Extensionless provider URLs retain the original HLS-compatible route.
      if (!(window.Hls?.isSupported?.())) {
        setStatus('正在准备兼容播放器，请稍候...');
        const supported = await sgEnsureHlsJs();
        if (!isCurrent()) return;
        if (!supported) {
          fail('播放器组件加载失败，请检查网络或使用外部播放器');
          return;
        }
      }
      if (!window.Hls?.isSupported?.()) {
        fail('当前浏览器不支持此视频格式，请尝试外部播放器');
        return;
      }
      const HlsEngine = window.Hls;
      const player = new HlsEngine({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 20000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 3,
        xhrSetup: xhr => { xhr.withCredentials = false; }
      });
      if (!isCurrent()) { player.destroy(); return; }
      hls = player;
      player.loadSource(url);
      player.attachMedia(video);
      player.on(HlsEngine.Events.MANIFEST_PARSED, () => {
        if (isCurrent() && player === hls) {
          if (!liveSession && typeof sgSelectBestAvHlsLevel === 'function') {
            sgSelectBestAvHlsLevel(player, sgCastState.smoothModeActive);
          }
          attemptPlay();
        }
      });
      player.on(HlsEngine.Events.ERROR, (_, data) => {
        if (!isCurrent() || player !== hls || !data?.fatal) return;
        switch (data.type) {
          case HlsEngine.ErrorTypes.NETWORK_ERROR:
            // Give long-running live channels a fresh retry budget after a
            // quiet period, but never enter an unbounded immediate retry loop.
            if (Date.now() - lastNetworkErrorAt > 90000) networkRecoveryAttempts = 0;
            lastNetworkErrorAt = Date.now();
            if (networkRecoveryAttempts < 2) {
              networkRecoveryAttempts++;
              hasBufferStatus = true;
              setStatus(`网络中断，正在重试（${networkRecoveryAttempts}/2）…`);
              clearTimeout(networkRecoveryTimer);
              networkRecoveryTimer = setTimeout(() => {
                if (isCurrent() && player === hls) {
                  try { player.startLoad(); }
                  catch (_) { fail('当前线路网络连接失败，请切换其他视频源'); }
                }
              }, networkRecoveryAttempts === 1 ? 1200 : 2500);
            } else {
              fail('当前线路网络连续失败，请切换其他视频源或使用外部播放器');
            }
            break;
          case HlsEngine.ErrorTypes.MEDIA_ERROR:
            if (Date.now() - lastMediaErrorAt > 90000) mediaRecoveryAttempts = 0;
            lastMediaErrorAt = Date.now();
            if (mediaRecoveryAttempts < 2) {
              mediaRecoveryAttempts++;
              hasBufferStatus = true;
              setStatus('视频解码异常，正在尝试恢复…');
              try { player.recoverMediaError(); }
              catch (_) { fail('当前线路解码失败，请切换其他视频源'); }
            } else {
              fail('当前线路媒体解码连续失败，请切换其他视频源');
            }
            break;
          default:
            fail('当前线路播放失败或格式不受支持，请切换线路或使用外部播放器');
        }
      });
    }

    /* === 电视直播模块：持久化拉取、EPG 电子节目单与 VPS 测速排序逻辑 === */
    const KEY_TV_EPG_URL = "custom_tv_epg_url_v1";
    let tvEpgSourceUrl = localStorage.getItem(KEY_TV_EPG_URL) || "";
    const tvPingCache = new Map(); // 记录直播源 VPS 测速结果: url -> ping(ms)
    const tvEpgCache = new Map();  // 记录频道 EPG 节目预告缓存: chName -> { data, ts }

    async function fetchTvM3uContent(m3uUrl) {
      try {
        const res = await fetch(`${VPS_TV_BASE}/m3u?url=${encodeURIComponent(m3uUrl)}&_t=${Date.now()}`);
        if (res.ok) {
          const txt = await res.text();
          if (txt && txt.includes('#EXTINF')) return txt;
        }
      } catch (_) {}
      return await fetchWithSmartProxy(m3uUrl, 5000);
    }

    async function initTv(force = false) {
      if (!force && Object.keys(groups).length > 0) {
        if (currentMode === 'tv' && currentView === 'normal') renderList(groups, false);
        return;
      }
      const targetUrl = await getD1Data(KEY_M3U, '');
      if (!targetUrl) return;
      try {
        const text = await fetchTvM3uContent(targetUrl);
        if (text && text.includes('#EXTINF')) {
          parseM3U(text, true);
          if (currentMode === 'tv' && currentView === 'normal') {
            const kw = document.getElementById('filter')?.value.trim() || '';
            if (kw) handleSearchTv();
            else renderList(groups, false);
          }
        }
      } catch (_) {}
    }

    function parseM3U(content, saveToStorage = true) {
      groups = {};
      totalChannelsCount = 0;
      totalStreamsCount = 0;
      const lines = content.split('\n');
      // 临时集合加速线路去重，保持原有输出顺序。
      const seenUrls = Object.create(null);
      let temp = null;
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#EXTM3U')) {
          const epgMatch = line.match(/(?:x-tvg-url|url-tvg|tvg-url)="([^"]+)"/i);
          if (epgMatch && epgMatch[1]) {
            tvEpgSourceUrl = epgMatch[1].trim();
            localStorage.setItem(KEY_TV_EPG_URL, tvEpgSourceUrl);
          }
        } else if (line.startsWith('#EXTINF:')) {
          const rawName = (line.split(',')[1] || '').trim();
          const tvgMatch = line.match(/tvg-name="([^"]+)"/);
          const name = tvgMatch ? tvgMatch[1] : (rawName || '未命名频道');
          const groupMatch = line.match(/group-title="([^"]+)"/);
          const group = (groupMatch ? groupMatch[1] : '常规频道').trim();
          temp = { name, group };
        } else if (line && !line.startsWith('#') && temp) {
          if (isSafeUrl(line)) {
            if (!groups[temp.group]) groups[temp.group] = {};
            if (!groups[temp.group][temp.name]) {
              groups[temp.group][temp.name] = [];
              totalChannelsCount++;
            }
            if (!seenUrls[temp.group]) seenUrls[temp.group] = Object.create(null);
            if (!seenUrls[temp.group][temp.name]) seenUrls[temp.group][temp.name] = new Set();
            if (!seenUrls[temp.group][temp.name].has(line)) {
              seenUrls[temp.group][temp.name].add(line);
              groups[temp.group][temp.name].push(line);
              totalStreamsCount++;
            }
          }
          temp = null;
        }
      }
      if (saveToStorage && totalChannelsCount > 0) {
        const payload = { groups, totalChannelsCount, totalStreamsCount, tvEpgSourceUrl };
        setD1Data(KEY_TV_CHANNELS, payload);
      }
    }

    // 向解码 VPS 请求频道 EPG 电子节目预告
    async function loadTvChannelEpg(chName, epgContainer, inlineTagEl, forceRefresh = false) {
      if (!epgContainer) return;
      const cached = tvEpgCache.get(chName);
      if (!forceRefresh && cached && (Date.now() - cached.ts < 180000)) {
        renderTvEpgBox(chName, cached.data, epgContainer, inlineTagEl);
        return;
      }

      try {
        const queryUrl = `${VPS_TV_BASE}/epg?ch=${encodeURIComponent(chName)}&epg_url=${encodeURIComponent(tvEpgSourceUrl || '')}&_t=${Date.now()}`;
        const res = await fetch(queryUrl);
        if (!res.ok) throw new Error();
        const data = await res.json();
        tvEpgCache.set(chName, { data, ts: Date.now() });
        renderTvEpgBox(chName, data, epgContainer, inlineTagEl);
      } catch (_) {
        const bodyEl = epgContainer.querySelector('.tv-epg-body');
        if (bodyEl) bodyEl.innerHTML = `<div style="color:var(--text-mute);font-size:11px;padding:2px 0;">暂无该频道的电子节目单数据</div>`;
      }
    }

    function renderTvEpgBox(chName, data, epgContainer, inlineTagEl) {
      const bodyEl = epgContainer.querySelector('.tv-epg-body');
      const scheduleEl = epgContainer.querySelector('.tv-epg-schedule');
      const toggleScheduleBtn = epgContainer.querySelector('.btn-toggle-schedule');
      if (!bodyEl) return;

      if (!data || !data.ok || (!data.now && (!data.list || data.list.length === 0))) {
        bodyEl.innerHTML = `<div style="color:var(--text-mute);font-size:11px;padding:2px 0;">暂无该频道今日节目预告</div>`;
        if (toggleScheduleBtn) toggleScheduleBtn.style.display = 'none';
        return;
      }

      const nowProg = data.now;
      const nextProg = data.next;

      if (nowProg && inlineTagEl) {
        inlineTagEl.textContent = `· ${nowProg.title}`;
      }

      let html = '';
      if (nowProg) {
        html += `
          <div class="tv-epg-row">
            <span class="tv-epg-badge live">正在播出</span>
            <span class="tv-epg-time">${escapeHtml(nowProg.start)}-${escapeHtml(nowProg.end)}</span>
            <span class="tv-epg-title" title="${escapeHtml(nowProg.title)}">${escapeHtml(nowProg.title)}</span>
          </div>
          <div class="tv-epg-progress"><div class="tv-epg-progress-bar" style="width:${nowProg.progress || 20}%"></div></div>
        `;
      }
      if (nextProg) {
        html += `
          <div class="tv-epg-row">
            <span class="tv-epg-badge next">即将播出</span>
            <span class="tv-epg-time">${escapeHtml(nextProg.start)}-${escapeHtml(nextProg.end)}</span>
            <span class="tv-epg-title" style="color:var(--text-sub);font-weight:normal;" title="${escapeHtml(nextProg.title)}">${escapeHtml(nextProg.title)}</span>
          </div>
        `;
      }
      bodyEl.innerHTML = html;

      if (scheduleEl && Array.isArray(data.list) && data.list.length > 0) {
        if (toggleScheduleBtn) toggleScheduleBtn.style.display = 'inline-block';
        scheduleEl.innerHTML = data.list.map(item => `
          <div class="tv-epg-schedule-item ${item.status === 'live' ? 'is-live' : ''}">
            <span style="font-family:monospace;flex-shrink:0;">${escapeHtml(item.start)} - ${escapeHtml(item.end)}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(item.title)}</span>
            ${item.status === 'live' ? '<span style="font-size:10px;flex-shrink:0;">● 直播中</span>' : ''}
          </div>
        `).join('');
      }
    }

    // 通过解码 VPS 对当前频道下的所有直播源并发测速并按速度自动排序
    async function testAndSortTvSources(chName, panelEl, rowEl, autoPlayFastest = false) {
      const items = Array.from(panelEl.querySelectorAll('.source-item'));
      if (items.length === 0) return;

      let hasTriggeredAutoPlay = false;

      // 若只有一个源，直接起播并后台测速显示延迟
      if (autoPlayFastest && items.length === 1) {
        hasTriggeredAutoPlay = true;
        items[0].click();
      }

      items.forEach(el => {
        const badge = el.querySelector('.tv-ping-badge');
        if (badge) {
          badge.textContent = 'VPS测速中...';
          badge.className = 'tv-ping-badge metric-ping-wait';
        }
        const fastTag = el.querySelector('.tv-fast-badge');
        if (fastTag) fastTag.remove();
      });

      // 若该频道下已有正在播放的线路，则仅测速排序，不重复触发起播断流
      if (panelEl.querySelector('.source-item.active-source')) {
        hasTriggeredAutoPlay = true;
      }

      // 预设兜底定时器：若自动起播模式下 1.2 秒内还未选出最快源，先起播排第一的源防等待
      let fallbackPlayTimer = null;
      if (autoPlayFastest && !hasTriggeredAutoPlay) {
        fallbackPlayTimer = setTimeout(() => {
          if (!hasTriggeredAutoPlay && !panelEl.querySelector('.source-item.active-source') && rowEl.classList.contains('expanded')) {
            hasTriggeredAutoPlay = true;
            const currentFirst = panelEl.querySelector('.source-item');
            if (currentFirst) currentFirst.click();
          }
        }, 1200);
      }

      await Promise.all(items.map(async (itemEl) => {
        const rawUrl = itemEl.getAttribute('data-raw-url') || '';
        const badge = itemEl.querySelector('.tv-ping-badge');
        let ping = 9999;

        try {
          const res = await fetch(`${VPS_TV_BASE}/ping?url=${encodeURIComponent(rawUrl)}&_t=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok && data.ping > 0) ping = data.ping;
          }
        } catch (_) {}

        tvPingCache.set(rawUrl, ping);
        itemEl.setAttribute('data-ping', String(ping));

        if (badge) {
          const isErr = ping >= 9999;
          badge.textContent = isErr ? '超时' : `${ping}ms`;
          badge.className = 'tv-ping-badge ' + (isErr ? 'metric-ping-err' : (ping < 500 ? 'metric-ping-ok' : (ping < 1200 ? 'metric-ping-warn' : 'metric-ping-err')));
        }

        // 一旦首个有效高速源测出结果，在自动起播模式下立即抢先起播
        if (autoPlayFastest && !hasTriggeredAutoPlay && !panelEl.querySelector('.source-item.active-source') && ping < 9999 && rowEl.classList.contains('expanded')) {
          hasTriggeredAutoPlay = true;
          if (fallbackPlayTimer) clearTimeout(fallbackPlayTimer);
          itemEl.click();
        }
      }));

      if (fallbackPlayTimer) clearTimeout(fallbackPlayTimer);

      // 按 VPS 测速延迟从快到慢实时重排 DOM 顺序
      const sortedItems = Array.from(panelEl.querySelectorAll('.source-item')).sort((a, b) => {
        const pa = parseInt(a.getAttribute('data-ping') || '9999', 10);
        const pb = parseInt(b.getAttribute('data-ping') || '9999', 10);
        return pa - pb;
      });

      // 仅当测速结果改变了顺序时才移动节点，避免重复触发布局更新。
      // 保留原有测速、自动起播、标签与排序规则。
      const currentItems = Array.from(panelEl.querySelectorAll('.source-item'));
      const orderChanged = sortedItems.some((el, index) => el !== currentItems[index]);
      if (orderChanged) {
        const sortedFragment = document.createDocumentFragment();
        sortedItems.forEach(el => sortedFragment.appendChild(el));
        panelEl.appendChild(sortedFragment);
      }
      sortedItems.forEach((el, index) => {
        const nameWrap = el.querySelector('.source-name-wrap');
        if (nameWrap && index === 0 && parseInt(el.getAttribute('data-ping') || '9999', 10) < 9999 && sortedItems.length > 1) {
          const fastTag = document.createElement('span');
          fastTag.className = 'tv-fast-badge';
          fastTag.textContent = '⚡ 最快';
          nameWrap.appendChild(fastTag);
        }
      });

      if (autoPlayFastest && !hasTriggeredAutoPlay && sortedItems[0] && rowEl.classList.contains('expanded')) {
        hasTriggeredAutoPlay = true;
        sortedItems[0].click();
      }
    }

    function renderList(targetGroups, isSearchMode = false, autoSelectMatchingTab = true) {
      const container = document.getElementById('channel-list');
      container.classList.remove('sg-results-grid');
      container.innerHTML = '';
      // Three horizontal live-TV tabs. Do not modify M3U groups or line URLs.
      // Unfamiliar channel groups still remain available in the '其他' tab.
      const liveBuckets = { '央视': [], '卫视': [], '其他': [] };
      for (const [groupName, channels] of Object.entries(targetGroups || {})) {
        for (const [chName, urls] of Object.entries(channels || {})) {
          const channel = String(chName || '');
          const group = String(groupName || '');
          let bucket;
          if (/^(?:CCTV[\s-]*\d|CGTN\b|央视|中央电视台|中央\d)/i.test(channel)) bucket = '央视';
          else if (/卫视/.test(channel)) bucket = '卫视';
          else if (/央视|中央|CCTV|CGTN/i.test(group)) bucket = '央视';
          else if (/卫视/.test(group)) bucket = '卫视';
          else bucket = '其他';
          liveBuckets[bucket].push({ chName, urls });
        }
      }
      const tabNames = ['央视', '卫视', '其他'];
      if ((!isSearchMode || autoSelectMatchingTab) && !liveBuckets[sgLiveSelectedTab]?.length) {
        // On first entry prefer a populated section; for a new search, prefer
        // the section actually containing the matching channel.
        sgLiveSelectedTab = tabNames.find(tab => liveBuckets[tab].length) || sgLiveSelectedTab;
      }
      if (!tabNames.includes(sgLiveSelectedTab)) sgLiveSelectedTab = '央视';
      const tabsEl = document.createElement('div');
      tabsEl.className = 'sg-live-tabs';
      tabsEl.setAttribute('role', 'tablist');
      tabsEl.setAttribute('aria-label', '直播频道分类');
      for (const name of tabNames) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sg-live-tab' + (name === sgLiveSelectedTab ? ' active' : '');
        btn.textContent = name === '央视' ? '央视频道' : name === '卫视' ? '卫视频道' : '其他频道';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(name === sgLiveSelectedTab));
        btn.setAttribute('aria-controls', 'sg-live-channel-panel');
        btn.onclick = () => {
          if (sgLiveSelectedTab === name) return;
          sgLiveSelectedTab = name;
          renderList(targetGroups, isSearchMode, false); // User chose this tab: keep it selected even if the filtered result is empty.
        };
        tabsEl.appendChild(btn);
      }
      container.appendChild(tabsEl);
      const subList = document.createElement('div');
      subList.id = 'sg-live-channel-panel';
      subList.className = 'group-channels sg-live-channel-panel';
      subList.setAttribute('role', 'tabpanel');
      subList.style.display = 'block';
      const searchWord = isSearchMode ? String(document.getElementById('filter')?.value || '').trim().toLowerCase() : '';
      for (const { chName, urls } of liveBuckets[sgLiveSelectedTab]) {
          const rowEl = document.createElement('div');
          rowEl.className = 'channel-row';
          const panelEl = document.createElement('div');
          panelEl.className = 'sources-panel';

          // 1. 构建顶部 EPG 电子节目预告面板
          const epgBox = document.createElement('div');
          epgBox.className = 'tv-epg-box';
          epgBox.innerHTML = `
            <div class="tv-epg-header">
              <span style="font-weight:600;color:var(--text-main);">📅 电子节目预告 (EPG)</span>
              <div class="tv-epg-actions">
                <button type="button" class="tv-epg-btn btn-retest-speed">⚡ VPS测速排序</button>
                <button type="button" class="tv-epg-btn btn-toggle-schedule" style="display:none;">全天节目单 ▼</button>
              </div>
            </div>
            <div class="tv-epg-body">
              <div style="color:var(--text-sub);font-size:11px;padding:2px 0;">⏳ 正在同步节目预告...</div>
            </div>
            <div class="tv-epg-schedule"></div>
          `;

          const scheduleEl = epgBox.querySelector('.tv-epg-schedule');
          const toggleScheduleBtn = epgBox.querySelector('.btn-toggle-schedule');
          toggleScheduleBtn.onclick = (e) => {
            e.stopPropagation();
            const isShow = scheduleEl.classList.toggle('show');
            toggleScheduleBtn.textContent = isShow ? '收起节目单 ▲' : '全天节目单 ▼';
            if (isShow) {
              const liveItem = scheduleEl.querySelector('.is-live');
              if (liveItem) liveItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          };

          const retestBtn = epgBox.querySelector('.btn-retest-speed');
          retestBtn.onclick = (e) => {
            e.stopPropagation();
            testAndSortTvSources(chName, panelEl, rowEl, false);
          };

          panelEl.appendChild(epgBox);

          // 2. 构建直播源线路列表（支持读取已缓存的 VPS 测速结果预排序）
          const indexedUrls = urls.map((u, idx) => ({
            url: u,
            origIdx: idx,
            ping: tvPingCache.has(u) ? tvPingCache.get(u) : 99999
          })).sort((a, b) => a.ping - b.ping);

          indexedUrls.forEach((itemObj) => {
            const url = itemObj.url;
            const idx = itemObj.origIdx;
            const cachedPing = tvPingCache.get(url);

            const itemEl = document.createElement('div');
            itemEl.className = 'source-item';
            itemEl.setAttribute('data-raw-url', url);
            itemEl.setAttribute('data-ping', cachedPing !== undefined ? String(cachedPing) : '9999');

            let pingText = '待测速';
            let pingCls = 'metric-ping-wait';
            if (cachedPing !== undefined) {
              const isErr = cachedPing >= 9999;
              pingText = isErr ? '超时' : `${cachedPing}ms`;
              pingCls = isErr ? 'metric-ping-err' : (cachedPing < 500 ? 'metric-ping-ok' : (cachedPing < 1200 ? 'metric-ping-warn' : 'metric-ping-err'));
            }

            itemEl.innerHTML = `
              <span class="source-name-wrap" style="display:flex;align-items:center;">
                <span class="source-name">线路 ${idx + 1}</span>
              </span>
              <span class="tv-ping-badge ${pingCls}" style="font-family:monospace;font-size:11px;">${pingText}</span>
            `;

            itemEl.onclick = (e) => {
              e.stopPropagation();
              isLiveMode = true;
              currentVodUniqueKey = "";
              document.querySelectorAll('.channel-row.playing').forEach(el => el.classList.remove('playing'));
              rowEl.classList.add('playing');
              document.querySelectorAll('.source-item.active-source').forEach(el => el.classList.remove('active-source'));
              itemEl.classList.add('active-source');
              currentTitle.textContent = chName;
              routeBadge.style.display = 'none';
              routeBadge.textContent = '';
              currentStreamUrl = url;
              currentPlayingMeta = { title: chName, epName: '直播', siteName: `线路 ${idx + 1}` };
              updateFavIconState();
              manualPlayOnly(url);
            };
            panelEl.appendChild(itemEl);
          });

          const mainEl = document.createElement('div');
          mainEl.className = 'channel-main';
          const cachedEpgNow = tvEpgCache.get(chName)?.data?.now?.title;
          mainEl.innerHTML = `
            <div class="channel-title" style="min-width:0;flex:1;">
              <span class="channel-arrow">▶</span>
              <span style="flex-shrink:0;">${escapeHtml(chName)}</span>
              <span class="tv-epg-inline-tag">${cachedEpgNow ? '· ' + escapeHtml(cachedEpgNow) : ''}</span>
            </div>
            <div class="channel-right-tools" style="flex-shrink:0;"><span class="badge-lines">${urls.length} 路线</span></div>
          `;

          const inlineTagEl = mainEl.querySelector('.tv-epg-inline-tag');

          mainEl.onclick = () => {
            const isExpanded = rowEl.classList.contains('expanded');
            document.querySelectorAll('.channel-row.expanded').forEach(el => el !== rowEl && el.classList.remove('expanded'));
            if (!isExpanded) {
              rowEl.classList.add('expanded');
              loadTvChannelEpg(chName, epgBox, inlineTagEl, false);
              testAndSortTvSources(chName, panelEl, rowEl, true);
            } else {
              rowEl.classList.remove('expanded');
            }
          };

          rowEl.appendChild(mainEl);
          rowEl.appendChild(panelEl);
          if (isLiveMode && currentStreamUrl && urls.includes(currentStreamUrl)) {
            rowEl.classList.add('playing');
          }
          // An exact top-search hit opens its lines immediately without autoplay
          // or automatically starting a latency test.
          if (searchWord && String(chName).trim().toLowerCase() === searchWord) {
            rowEl.classList.add('expanded');
            loadTvChannelEpg(chName, epgBox, inlineTagEl, false);
          }
          subList.appendChild(rowEl);
      }
      if (!subList.children.length) {
        const empty = document.createElement('div');
        empty.className = 'sg-live-empty';
        empty.textContent = isSearchMode ? '该分类没有匹配的直播频道，请切换分类或清除搜索词。' : '此分类暂无直播频道。';
        subList.appendChild(empty);
      }
      container.appendChild(subList);
    }

    function handleSearchTv() {
      const kw = document.getElementById('filter').value.trim().toLowerCase();
      if (!kw) { renderList(groups, false); return; }
      const filtered = {};
      for (let g in groups) {
        for (let ch in groups[g]) {
          if (ch.toLowerCase().includes(kw) || g.toLowerCase().includes(kw)) {
            if (!filtered[g]) filtered[g] = {};
            filtered[g][ch] = groups[g][ch];
          }
        }
      }
      renderList(filtered, true);
    }

    video.addEventListener('playing', () => { 
      clearPlayWatchdog();
      setStatus("", false); 
      updatePlayBtn(true); 
      showControls(); 
    });
    video.addEventListener('pause', () => { updatePlayBtn(false); showControls(); });

    // 自动连续播放下一集闭环（支持搜索列表、收藏夹、播放历史全场景秒播下一集）
    video.addEventListener('ended', () => {
      if (isLiveMode || !currentPlayingMeta) return;
      const baseEpIdx = (currentPlayingMeta.epIdx !== undefined && currentPlayingMeta.epIdx >= 0) ? currentPlayingMeta.epIdx : currentActiveEp;
      const nextEpIdx = baseEpIdx + 1;
      const normCurTitle = normalizeCleanKey(parseTitleAndVersion(currentPlayingMeta.title).canonical) || normalizeCleanKey(currentPlayingMeta.title);
      const group = groupedVodList.find(g => normalizeCleanKey(g.title) === normCurTitle);
      let curItem = group ? (group.items.find(i => normalizeCleanKey(i.siteName) === normalizeCleanKey(currentPlayingMeta.siteName)) || group.items[0]) : null;

      // 降级兜底：如果从收藏夹或历史记录直接起播，内存无搜索列表时直接调取 currentPlayingMeta
      if (!curItem && currentPlayingMeta.vod) {
        curItem = {
          id: 'meta_auto_next_' + Date.now(),
          siteName: currentPlayingMeta.siteName || '默认源',
          versionTag: '',
          vod: currentPlayingMeta.vod
        };
      }

      if (curItem) {
        const episodes = getEpisodesList(curItem);
        if (nextEpIdx < episodes.length) {
          showGestureTip(`自动播放下一集: ${episodes[nextEpIdx].name}`);
          playCurrentVodSource(curItem, nextEpIdx, false);
        } else {
          showGestureTip("已播放完最后一集");
        }
      }
    });


    /* AURORA 3.11: accessible scroll strip for external players.
       Keep the original six actions untouched. Drag on desktop, swipe on touch,
       keyboard arrows when focused; clicks are suppressed only after dragging. */
    function sgSetupExternalPlayerStrip() {
      const strip = document.querySelector('#player-wrap .external-group');
      if (!strip || strip.dataset.sgScrollerReady === '1') return;
      strip.dataset.sgScrollerReady = '1';
      let gesture = null;
      let ignoreClickUntil = 0;
      strip.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        gesture = { pointerId: event.pointerId, x: event.clientX, left: strip.scrollLeft, dragged: false };
      });
      strip.addEventListener('pointermove', event => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const delta = event.clientX - gesture.x;
        if (!gesture.dragged && Math.abs(delta) < 4) return;
        if (!gesture.dragged) {
          gesture.dragged = true;
          strip.classList.add('sg-dragging');
          try { strip.setPointerCapture(event.pointerId); } catch (_) {}
        }
        strip.scrollLeft = gesture.left - delta;
        event.preventDefault();
      });
      const end = () => {
        if (gesture && gesture.dragged) ignoreClickUntil = performance.now() + 350;
        gesture = null;
        strip.classList.remove('sg-dragging');
      };
      strip.addEventListener('pointerup', end);
      strip.addEventListener('pointercancel', end);
      strip.addEventListener('lostpointercapture', end);
      strip.addEventListener('click', event => {
        if (performance.now() < ignoreClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      strip.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const amount = 25 * (event.key === 'ArrowRight' ? 1 : -1);
        strip.scrollBy({ left: amount, behavior:'smooth' });
      });
      strip.addEventListener('wheel', event => {
        if (strip.scrollWidth <= strip.clientWidth + 2) return;
        if (event.shiftKey && Math.abs(event.deltaY) > 0) {
          event.preventDefault();
          strip.scrollLeft += event.deltaY;
        }
      }, { passive:false });
    }
    document.addEventListener('DOMContentLoaded', sgSetupExternalPlayerStrip, { once:true });

    window.addEventListener('DOMContentLoaded', async () => {
      document.getElementById('gate-username').addEventListener('input', checkGateInputsReady);
      document.getElementById('gate-password').addEventListener('input', checkGateInputsReady);

      renderGateEyeIcon(false);

      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('vod_cache_')) {
            sessionStorage.removeItem(k);
          }
        }
      } catch (_) {}

      try {
        const localAuth = localStorage.getItem(KEY_AUTH_CONFIG);
        if (localAuth) authConfig = JSON.parse(localAuth);
        const localAdmin = localStorage.getItem(KEY_ADMIN_INFO);
        if (localAdmin) adminAccount = JSON.parse(localAdmin);
        const localUsers = localStorage.getItem(KEY_USERS_LIST);
        if (localUsers) userList = JSON.parse(localUsers);
        const localGroups = localStorage.getItem(KEY_SOURCE_GROUPS);
        if (localGroups) sourceGroups = JSON.parse(localGroups);
        const localSites = localStorage.getItem(KEY_SITES);
        if (localSites) parsedSites = JSON.parse(localSites);
        const localDis = localStorage.getItem(KEY_DISABLED_SITES);
        if (localDis) disabledSites = JSON.parse(localDis);
        const localFails = localStorage.getItem(KEY_SOURCE_FAILURES);
        if (localFails) sourceFailures = JSON.parse(localFails);
        const localThreshold = localStorage.getItem(KEY_FAIL_THRESHOLD);
        if (localThreshold) failThreshold = parseInt(localThreshold, 10) || 5;
        const localTheme = localStorage.getItem(KEY_THEME_PREF);
        if (localTheme) currentThemeSetting = localTheme;

        // 本地立即提取持久化电视频道，避免刷新白屏
        const localTv = localStorage.getItem(KEY_TV_CHANNELS);
        if (localTv) {
          try {
            const parsedTv = JSON.parse(localTv);
            if (parsedTv && typeof parsedTv === 'object') {
              groups = parsedTv.groups || parsedTv;
              totalChannelsCount = parsedTv.totalChannelsCount || 0;
              totalStreamsCount = parsedTv.totalStreamsCount || 0;
              if (parsedTv.tvEpgSourceUrl) tvEpgSourceUrl = parsedTv.tvEpgSourceUrl;
            }
          } catch (_) {}
        }
      } catch (_) {}

      applyGlobalTheme(currentThemeSetting);

      if (!sourceGroups || sourceGroups.length === 0) {
        sourceGroups = [{ id: 'def', name: '默认分组', sites: ['*'], isDefault: true }];
      }

      // 服务端是唯一可信的登录状态来源，忽略旧版本保存在本地的角色和密码摘要。
      localStorage.removeItem(KEY_SAVED_CREDS);
      localStorage.removeItem(KEY_CURRENT_USER);
      localStorage.removeItem(KEY_ADMIN_INFO);
      localStorage.removeItem(KEY_USERS_LIST);
      let serverAuth = null;
      try {
        const res = await fetch('/api/auth', {cache:'no-store'});
        if (res.ok) serverAuth = await res.json();
      } catch (_) {}
      if (serverAuth && serverAuth.user) currentUser = serverAuth.user;
      if (serverAuth && serverAuth.adminExists === false) {
        gateAuthMode = 'init_admin';
        const subTip = document.getElementById('gate-sub-tip');
        if (subTip) { subTip.textContent = '首次使用，请创建管理员账号'; subTip.style.display = 'block'; }
        document.getElementById('gate-submit-btn').textContent = '初始化管理员';
        document.getElementById('gate-switch-link').style.display = 'none';
      }
      updateMainRoleButton();

      const gateScreen = document.getElementById('auth-gate-screen');
      if (!currentUser) {
        gateScreen.style.display = 'flex';
      } else {
        gateScreen.style.display = 'none';
      }

      const bootKeys = [
        KEY_SITES, KEY_DISABLED_SITES, KEY_SOURCE_FAILURES, KEY_FAIL_THRESHOLD,
        KEY_AUTH_CONFIG, KEY_ADMIN_INFO, KEY_USERS_LIST, KEY_SOURCE_GROUPS,
        KEY_THEME_PREF, KEY_SUB, KEY_M3U, KEY_TV_CHANNELS
      ];

      getD1BatchData(bootKeys).then(data => {
        if (data[KEY_SITES]) {
          try { const p = JSON.parse(data[KEY_SITES]); if (Array.isArray(p)) parsedSites = p; } catch (_) {}
        }
        if (data[KEY_DISABLED_SITES]) {
          try { disabledSites = JSON.parse(data[KEY_DISABLED_SITES]) || []; } catch (_) {}
        }
        if (data[KEY_SOURCE_FAILURES]) {
          try { sourceFailures = JSON.parse(data[KEY_SOURCE_FAILURES]) || {}; } catch (_) {}
        }
        if (data[KEY_FAIL_THRESHOLD]) {
          failThreshold = parseInt(data[KEY_FAIL_THRESHOLD], 10) || failThreshold || 5;
        }
        if (data[KEY_AUTH_CONFIG]) {
          try {
            authConfig = JSON.parse(data[KEY_AUTH_CONFIG]);
            if (!currentUser) {
              gateScreen.style.display = 'flex';
            } else {
              gateScreen.style.display = 'none';
            }
          } catch (_) {}
        }
        if (data[KEY_ADMIN_INFO]) {
          try { adminAccount = JSON.parse(data[KEY_ADMIN_INFO]); } catch (_) {}
        }
        if (serverAuth && serverAuth.adminExists === false) {
          gateAuthMode = 'init_admin';
          const subTip = document.getElementById('gate-sub-tip');
          if (subTip) {
            subTip.textContent = "首次使用，请设定主管理员账号与密码";
            subTip.style.display = 'block';
          }
          const submitBtn = document.getElementById('gate-submit-btn');
          if (submitBtn) submitBtn.textContent = "初始化管理员";
          const switchLink = document.getElementById('gate-switch-link');
          if (switchLink) switchLink.style.display = 'none';
          gateScreen.style.display = 'flex';
        }
        if (data[KEY_USERS_LIST]) {
          try { userList = JSON.parse(data[KEY_USERS_LIST]); } catch (_) {}
        }
        if (data[KEY_SOURCE_GROUPS]) {
          try { const p = JSON.parse(data[KEY_SOURCE_GROUPS]); if (Array.isArray(p) && p.length > 0) sourceGroups = p; } catch (_) {}
        }
        if (data[KEY_THEME_PREF]) {
          currentThemeSetting = data[KEY_THEME_PREF];
          applyGlobalTheme(currentThemeSetting);
        }
        if (data[KEY_SUB]) {
          localStorage.setItem(KEY_SUB, data[KEY_SUB]);
        }
        if (data[KEY_M3U]) {
          localStorage.setItem(KEY_M3U, data[KEY_M3U]);
        }
        if (data[KEY_TV_CHANNELS]) {
          try {
            const parsedTv = JSON.parse(data[KEY_TV_CHANNELS]);
            if (parsedTv && typeof parsedTv === 'object') {
              groups = parsedTv.groups || parsedTv;
              totalChannelsCount = parsedTv.totalChannelsCount || 0;
              totalStreamsCount = parsedTv.totalStreamsCount || 0;
              if (parsedTv.tvEpgSourceUrl) {
                tvEpgSourceUrl = parsedTv.tvEpgSourceUrl;
                localStorage.setItem(KEY_TV_EPG_URL, tvEpgSourceUrl);
              }
              if (currentMode === 'tv' && currentView === 'normal') {
                const kw = document.getElementById('filter')?.value.trim() || '';
                if (kw) handleSearchTv();
                else renderList(groups, false);
              }
            }
          } catch (_) {}
        }
        if (currentUser) refreshAuroraRecommendations();
      });

      // AURORA 3.18: Delay remote M3U loading until the user visits Live.
      // switchMode('tv') already calls initTv(true) when no channels are cached.
      // No stream or subscription should be fetched simply to draw the home page.
      const uiRestore = currentUser ? sgLoadPageState() : null;
      const hasRestored = currentUser ? restoreVodSessionState() : false;
      if (hasRestored) {
        currentMode = 'vod';
        currentView = 'normal';
        document.getElementById('tab-tv').className = 'mode-tab';
        document.getElementById('tab-vod').className = 'mode-tab active';
        document.getElementById('filter').placeholder = "搜索片名、视频、电视频道...";
        // Do not build a hidden large search list when restoring the HOME page.
        // The list stays in memory and is rendered on first workspace visit.
        if (uiRestore?.page !== 'home') renderGroupedVodSources();
      }
      // An authenticated refresh restores the SAME page without autoplay.
      // First visits and expired saved views still start from the real homepage.
      if (currentUser) {
        if (!sgRestorePageState(uiRestore, hasRestored)) {
          showAuroraHome();
        }
      } else {
        document.body.classList.add('aurora-home-view');
      }
      document.body.classList.remove('shiguang-booting');
      applyGlobalTheme(currentThemeSetting);
      requestAnimationFrame(() => {
        // Force iOS Safari to re-sample the bottom floating bar backdrop after removing shiguang-booting
        if (document.body.classList.contains('theme-light')) {
          document.documentElement.style.backgroundColor = '#eaf2fd';
          document.body.style.backgroundColor = '#eaf2fd';
          window.scrollBy(0, 0);
        }
      });
      checkAutoSyncSchedule();
    });
  
    // Desktop: keep the player pinned in its grid cell while allowing the mouse wheel
    // over the player or unused workspace to scroll the channel/episode list.
    (function bindWorkspaceWheelRouting() {
      if (window.__shiguangWorkspaceWheelRouting) return;
      window.__shiguangWorkspaceWheelRouting = true;
      document.addEventListener('wheel', function (event) {
        if (window.innerWidth < 900 || document.body.classList.contains('aurora-home-view')) return;
        const list = document.getElementById('channel-list');
        if (!list || list.contains(event.target)) return;
        if (event.target && event.target.closest && event.target.closest('input, textarea, select, button, .glass-modal-mask, .glass-modal-card')) return;
        const maxScroll = list.scrollHeight - list.clientHeight;
        if (maxScroll <= 1) return;
        const next = Math.max(0, Math.min(maxScroll, list.scrollTop + event.deltaY));
        if (next !== list.scrollTop) {
          list.scrollTop = next;
          event.preventDefault();
        }
      }, { passive: false });
    })();



    /* ===================================================================
       AURORA 3.20.5: 影视投屏引擎（零缓冲损耗防卡顿 + 音画同步修复）
       1. 仅限看电视/电影显示投屏按钮，电视直播自动隐藏并禁用远端投屏。
       2. 投屏防卡顿核心：
          - 在 Safari / iOS / macOS 原生 HLS 下直接复用已缓冲的原生自适应流 (ABR)，绝不在呼出 AirPlay 时重置 video.src 或清空缓冲；
          - 投屏期间自动暂停后台轮播与非必要并发任务，释放无线带宽；
          - “电视卡顿加速”支持跨全站可用采集源实时并发测速（即使从收藏夹/历史记录起播也能自动检索多源），一键切换延迟最低的流畅源并保留播放进度。
       3. 电视黑屏修复（有声无画修复）：
          - 自动激活 videoTracks 与 audioTracks、退出画中画占用；
          - 自动剥离 Master M3U8 中的纯音频轨与 H.265 (HEVC) 轨，锁定 H.264 (avc1) + AAC 音画流或切换至 H.264 兼容片源。
       =================================================================== */

    function shouldShowVodCastBtn() {
      if (isLiveMode) return false;
      if (currentMode === 'tv' && currentView === 'normal') return false;
      if (currentMode === 'tv' && !currentPlayingMeta) return false;
      return true;
    }

    function syncCastUiState() {
      const showCast = shouldShowVodCastBtn();
      const castBtn = document.getElementById('cast-btn');
      if (wrap) {
        wrap.classList.toggle('is-live-mode', !showCast);
        wrap.classList.toggle('is-vod-mode', showCast);
        wrap.classList.toggle('is-casting', Boolean(showCast && sgCastState.active));
      }
      if (castBtn) {
        castBtn.hidden = !showCast;
        castBtn.style.display = showCast ? '' : 'none';
        castBtn.setAttribute('aria-hidden', String(!showCast));
        castBtn.classList.toggle('cast-active', Boolean(showCast && (sgCastState.active || sgCastState.smoothModeActive)));
      }
      if (video) {
        if (!showCast) {
          try { video.disableRemotePlayback = true; } catch (_) {}
          video.setAttribute('disableremoteplayback', '');
          video.setAttribute('x-webkit-airplay', 'deny');
          video.setAttribute('airplay', 'deny');
          closeCastModal();
        } else {
          try { video.disableRemotePlayback = false; } catch (_) {}
          video.removeAttribute('disableremoteplayback');
          video.setAttribute('x-webkit-airplay', 'allow');
          video.setAttribute('airplay', 'allow');
        }
      }
    }

    function sgResetCastSessionOnStop() {
      sgCastState.active = false;
      sgCastState.directModeActive = false;
      sgCastState.smoothModeActive = false;
      sgCastState.lastRawUrl = '';
      sgCastState.resolvedUrl = '';
      sgCastState.streamInfo = null;
      syncCastUiState();
    }

    // 确保 <video> 视频轨与音频轨同时启用，防止视频解码层被挂起
    function sgEnsureVideoAndAudioTracks(v) {
      if (!v) return;
      try {
        if (v.videoTracks && v.videoTracks.length > 0) {
          let hasSelected = false;
          for (let i = 0; i < v.videoTracks.length; i++) {
            if (v.videoTracks[i].selected) { hasSelected = true; break; }
          }
          if (!hasSelected) v.videoTracks[0].selected = true;
        }
        if (v.audioTracks && v.audioTracks.length > 0) {
          let hasEnabled = false;
          for (let i = 0; i < v.audioTracks.length; i++) {
            if (v.audioTracks[i].enabled) { hasEnabled = true; break; }
          }
          if (!hasEnabled) v.audioTracks[0].enabled = true;
        }
      } catch (_) {}
    }

    // 在 HLS.js 中过滤纯音频轨，优先选择 H.264 (avc1)；若开启防卡顿模式则优选 720p/中码率流畅层级以减轻电视解码与网络压力
    function sgSelectBestAvHlsLevel(hlsPlayer, preferSmooth = false) {
      if (!hlsPlayer || !Array.isArray(hlsPlayer.levels) || hlsPlayer.levels.length <= 1) return;
      try {
        const levels = hlsPlayer.levels;
        const videoLevels = [];
        const avcLevels = [];
        levels.forEach((lv, idx) => {
          const vCodec = String(lv.videoCodec || lv.attrs?.CODECS || '').toLowerCase();
          const aCodec = String(lv.audioCodec || lv.attrs?.CODECS || '').toLowerCase();
          const hasResolution = (Number(lv.width) > 0 && Number(lv.height) > 0);
          const isAudioOnly = !hasResolution && !vCodec.includes('avc1') && !vCodec.includes('hev1') && !vCodec.includes('hvc1') && !vCodec.includes('vp09') && !vCodec.includes('av01') && (aCodec.includes('mp4a') || aCodec.includes('ac-3') || aCodec.includes('ec-3'));
          if (isAudioOnly) return;
          if (hasResolution || vCodec) {
            const height = Number(lv.height) || 720;
            const width = Number(lv.width) || 1280;
            const bw = Number(lv.bitrate || lv.bandwidth) || 1500000;
            const entry = { idx, lv, height, width, bw, score: width * height };
            videoLevels.push(entry);
            if (!/hev1|hvc1|hevc|dvh1|dvhe/i.test(vCodec)) {
              avcLevels.push(entry);
            }
          }
        });
        const candidates = avcLevels.length > 0 ? avcLevels : videoLevels;
        if (candidates.length === 0) return;

        let chosen;
        if (preferSmooth && candidates.length > 1) {
          // 防卡顿模式：优先选择 720p 或码率适中的流畅 H.264 轨，避免高码率切片引发电视端频繁缓冲
          const smoothPool = candidates.slice().sort((a, b) => a.bw - b.bw || a.score - b.score);
          chosen = smoothPool.find(c => c.height >= 540 && c.height <= 720) || smoothPool[0];
        } else {
          const hdPool = candidates.slice().sort((a, b) => b.score - a.score || a.bw - b.bw);
          chosen = hdPool.find(c => c.height <= 1080) || hdPool[0];
        }

        const curLv = levels[hlsPlayer.currentLevel];
        const curCodec = String(curLv?.videoCodec || curLv?.attrs?.CODECS || '').toLowerCase();
        const curIsBad = !curLv || (/hev1|hvc1|hevc/i.test(curCodec) && avcLevels.length > 0) || (!curLv.width && !curLv.videoCodec);
        if (preferSmooth || curIsBad || sgCastState.active) {
          hlsPlayer.currentLevel = chosen.idx;
        }
      } catch (_) {}
    }

    function sgMimeTypeForStream(url, kindHint) {
      const kind = kindHint || sgPlaybackMediaKind(url, false);
      if (kind === 'direct') {
        const lower = String(url || '').toLowerCase();
        if (lower.includes('.webm')) return 'video/webm';
        if (lower.includes('.mov')) return 'video/quicktime';
        return 'video/mp4';
      }
      return 'application/vnd.apple.mpegurl';
    }

    // 解析 M3U8 清单：识别是否存在纯音频变体、HEVC 编码，以及提取流畅/高清 H.264 子播放列表地址
    async function sgResolveCastStreamInfo(rawUrl, preferSmooth = false) {
      if (!rawUrl || !isSafeUrl(rawUrl)) {
        return { rawUrl: rawUrl || '', playableUrl: rawUrl || '', smoothUrl: rawUrl || '', kind: 'unknown', isHevcOnly: false, isAudioOnly: false, isFmp4: false, codecLabel: '自适应音画流' };
      }
      let normalizedUrl = rawUrl.trim();
      if (window.location.protocol === 'https:' && normalizedUrl.startsWith('http://')) {
        normalizedUrl = normalizedUrl.replace(/^http:\/\//i, 'https://');
      }
      const cacheKey = `${normalizedUrl}__${preferSmooth ? 'smooth' : 'std'}`;
      if (sgCastManifestCache.has(cacheKey)) {
        return sgCastManifestCache.get(cacheKey);
      }

      const kind = sgPlaybackMediaKind(normalizedUrl, false);
      const info = {
        rawUrl: normalizedUrl,
        playableUrl: normalizedUrl,
        smoothUrl: normalizedUrl,
        kind,
        isHevcOnly: false,
        isAudioOnly: false,
        isFmp4: false,
        hasMultipleVariants: false,
        codecLabel: kind === 'direct' ? 'MP4 直连流' : 'H.264 自适应流'
      };

      if (kind === 'direct') {
        sgCastManifestCache.set(cacheKey, info);
        return info;
      }

      const fetchManifestText = async (targetUrl) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2400);
        try {
          const res = await fetch(targetUrl, { signal: controller.signal, credentials: 'omit' });
          clearTimeout(timer);
          if (res.ok) {
            const text = await res.text();
            return { text, finalUrl: res.url || targetUrl };
          }
        } catch (_) {
          clearTimeout(timer);
        }
        try {
          const text = await fetchWithSmartProxy(targetUrl, 2400);
          return { text, finalUrl: targetUrl };
        } catch (_) {
          return null;
        }
      };

      const firstHop = await fetchManifestText(normalizedUrl);
      if (!firstHop || !firstHop.text || !firstHop.text.includes('#EXTM3U')) {
        sgCastManifestCache.set(cacheKey, info);
        return info;
      }

      let manifestText = firstHop.text;
      let baseManifestUrl = firstHop.finalUrl || normalizedUrl;
      info.playableUrl = baseManifestUrl;
      info.smoothUrl = baseManifestUrl;

      if (manifestText.includes('#EXT-X-STREAM-INF')) {
        const lines = manifestText.split(/\r?\n/);
        const variants = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
          const attrStr = line.slice('#EXT-X-STREAM-INF:'.length);
          let uri = '';
          for (let j = i + 1; j < lines.length; j++) {
            const candidate = lines[j].trim();
            if (!candidate) continue;
            if (!candidate.startsWith('#')) { uri = candidate; i = j; }
            break;
          }
          if (!uri) continue;
          let resolvedUri = uri;
          try { resolvedUri = new URL(uri, baseManifestUrl).href; } catch (_) {}
          if (window.location.protocol === 'https:' && resolvedUri.startsWith('http://')) {
            resolvedUri = resolvedUri.replace(/^http:\/\//i, 'https://');
          }

          const bwMatch = attrStr.match(/BANDWIDTH=(\d+)/i);
          const resMatch = attrStr.match(/RESOLUTION=(\d+)x(\d+)/i);
          const codecsMatch = attrStr.match(/CODECS="([^"]+)"/i);
          const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
          const width = resMatch ? parseInt(resMatch[1], 10) : 0;
          const height = resMatch ? parseInt(resMatch[2], 10) : 0;
          const codecs = codecsMatch ? codecsMatch[1].toLowerCase() : '';

          const hasVideoCodec = /avc1|hev1|hvc1|vp09|vp9|av01/i.test(codecs);
          const hasAudioOnlyCodec = !hasVideoCodec && width === 0 && height === 0 && /mp4a|ac-3|ec-3|opus/i.test(codecs);
          const isHevc = /hev1|hvc1|hevc|dvh1|dvhe/i.test(codecs);
          const isAvc = /avc1/i.test(codecs) || (!isHevc && !hasAudioOnlyCodec);

          variants.push({
            url: resolvedUri,
            bandwidth,
            width,
            height,
            codecs,
            isAudioOnly: hasAudioOnlyCodec,
            isHevc,
            isAvc,
            pixels: (width || 1280) * (height || 720)
          });
        }

        const videoVariants = variants.filter(v => !v.isAudioOnly);
        if (videoVariants.length > 0) {
          info.hasMultipleVariants = videoVariants.length > 1;
          const avcVariants = videoVariants.filter(v => v.isAvc && !v.isHevc);
          const pool = avcVariants.length > 0 ? avcVariants : videoVariants;

          // 标准 H.264 1080p 子流（用于黑屏修复直连）
          const hdPool = pool.slice().sort((a, b) => (b.pixels - a.pixels) || (a.bandwidth - b.bandwidth));
          const hdChosen = hdPool.find(v => !v.height || v.height <= 1080) || hdPool[0];

          // 流畅低码率 H.264 子流（用于防卡顿加速）
          const smoothPool = pool.slice().sort((a, b) => (a.bandwidth || a.pixels) - (b.bandwidth || b.pixels));
          const smoothChosen = smoothPool.find(v => v.height >= 540 && v.height <= 720) || smoothPool[0];

          info.playableUrl = preferSmooth ? smoothChosen.url : hdChosen.url;
          info.smoothUrl = smoothChosen.url;
          info.isHevcOnly = (avcVariants.length === 0 && videoVariants.every(v => v.isHevc));
          info.codecLabel = info.isHevcOnly ? 'H.265 (部分电视易黑屏)' : 'H.264 音画兼容';
        } else if (variants.length > 0) {
          info.isAudioOnly = true;
          info.codecLabel = '⚠️ 仅音频轨';
        }
      }

      if (/#EXT-X-MAP:/i.test(manifestText)) {
        info.isFmp4 = true;
      }
      if (/CODECS="[^"]*(?:hev1|hvc1|hevc)/i.test(manifestText) && !/CODECS="[^"]*avc1/i.test(manifestText)) {
        info.isHevcOnly = true;
        info.codecLabel = 'H.265 (部分电视易黑屏)';
      }

      sgCastManifestCache.set(cacheKey, info);
      return info;
    }

    function sgDetectRuntimeAvHealth() {
      let isHevc = false;
      let isAudioOnly = false;
      let width = Number(video?.videoWidth) || 0;
      let height = Number(video?.videoHeight) || 0;

      if (hls && Array.isArray(hls.levels) && hls.levels.length > 0) {
        const curLv = hls.levels[hls.currentLevel] || hls.levels[0];
        const vCodec = String(curLv?.videoCodec || curLv?.attrs?.CODECS || '');
        if (/hev1|hvc1|hevc/i.test(vCodec)) isHevc = true;
        if (!width && curLv?.width) width = Number(curLv.width) || 0;
        if (!height && curLv?.height) height = Number(curLv.height) || 0;
      }
      if (sgCastState.streamInfo?.isHevcOnly) isHevc = true;
      if (sgCastState.streamInfo?.isAudioOnly) isAudioOnly = true;

      if (video && video.readyState >= 2 && video.currentTime > 1.2 && video.videoWidth === 0) {
        isAudioOnly = true;
      }
      return { width, height, isHevc, isAudioOnly };
    }

    // 同步准备 <video> 节点（不重置已缓冲的原生播放流，确保零卡顿起投）
    function sgPrepareVideoElementForCast() {
      if (!video) return;
      exitPictureInPictureMode();
      try {
        if (video.webkitPresentationMode === 'picture-in-picture' && typeof video.webkitSetPresentationMode === 'function') {
          video.webkitSetPresentationMode('inline');
        }
      } catch (_) {}

      try { video.disableRemotePlayback = false; } catch (_) {}
      video.removeAttribute('disableremoteplayback');
      video.setAttribute('x-webkit-airplay', 'allow');
      video.setAttribute('airplay', 'allow');

      sgEnsureVideoAndAudioTracks(video);
      if (video.muted && video.volume === 0) {
        changeVolume(1);
        if (volSlider) volSlider.value = 1;
      }

      if (hls) {
        sgSelectBestAvHlsLevel(hls, sgCastState.smoothModeActive);
      }

      // 释放后台非必要定时器，减少无线网络与主线程竞争
      if (auroraHeroTimer) {
        clearInterval(auroraHeroTimer);
        auroraHeroTimer = null;
      }
    }

    // 强制将指定直链挂载到 <video>（仅在 MSE blob: 需要转直连或用户点击“黑屏修复/流畅直连”时调用）
    async function sgBindDirectAvStreamToVideo(targetUrl, resumeTime = null, preferSmooth = false) {
      if (!video || !targetUrl || isLiveMode) return false;
      const info = await sgResolveCastStreamInfo(targetUrl, preferSmooth);
      const finalUrl = (preferSmooth ? info.smoothUrl : info.playableUrl) || targetUrl;
      sgCastState.resolvedUrl = finalUrl;
      sgCastState.streamInfo = info;

      const savedTime = resumeTime !== null ? resumeTime : (Number(video.currentTime) || 0);
      const wasPaused = video.paused;
      const kind = sgPlaybackMediaKind(finalUrl, false);

      const canPlayNativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL'));
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isRemoteConnected = Boolean(
        video.webkitCurrentPlaybackTargetIsWireless ||
        (video.remote && (video.remote.state === 'connecting' || video.remote.state === 'connected'))
      );

      video.setAttribute('data-cast-av-url', finalUrl);
      if (kind !== 'direct' && !canPlayNativeHls && !isAndroid && !isRemoteConnected) {
        if (hls) sgSelectBestAvHlsLevel(hls, preferSmooth);
        sgCastState.directModeActive = true;
        syncCastUiState();
        sgUpdateCastModalStatusUI();
        return true;
      }

      // 如果当前 <video> 已经在直接播放这同一个 URL，绝不重复调用 video.load() 清空缓冲！
      const curSrc = video.currentSrc || video.getAttribute('src') || '';
      if (!hls && curSrc === finalUrl && video.readyState >= 1) {
        sgEnsureVideoAndAudioTracks(video);
        sgCastState.directModeActive = true;
        syncCastUiState();
        sgUpdateCastModalStatusUI();
        return true;
      }

      const gen = ++playbackGeneration;
      clearPlayWatchdog();
      destroyHlsInstance();

      sgCastState.directModeActive = true;
      syncCastUiState();

      return new Promise(resolve => {
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };

        video.onloadedmetadata = () => {
          if (gen !== playbackGeneration) { finish(false); return; }
          sgEnsureVideoAndAudioTracks(video);
          if (savedTime > 2 && (!video.duration || savedTime < video.duration - 5)) {
            try { video.currentTime = savedTime; } catch (_) {}
          }
        };
        video.onplaying = () => {
          if (gen !== playbackGeneration) { finish(false); return; }
          sgEnsureVideoAndAudioTracks(video);
          setStatus('', false);
          updatePlayBtn(true);
          sgUpdateCastModalStatusUI();
          finish(true);
        };
        video.onerror = () => {
          if (gen !== playbackGeneration) { finish(false); return; }
          sgCastState.directModeActive = false;
          syncCastUiState();
          manualPlayOnly(currentStreamUrl).then(() => {
            if (savedTime > 2) {
              setTimeout(() => { try { video.currentTime = savedTime; } catch (_) {} }, 400);
            }
          });
          finish(false);
        };

        video.src = finalUrl;
        try { video.load(); } catch (_) {}
        if (!wasPaused || isRemoteConnected) {
          const p = video.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => finish(true));
          }
        } else {
          finish(true);
        }
        setTimeout(() => finish(true), 2200);
      });
    }

    function sgSyncGoogleCastOnEpisodeChange(url) {
      if (isLiveMode || !sgCastState.active || !window.cast?.framework?.CastContext) return;
      try {
        const session = cast.framework.CastContext.getInstance().getCurrentSession();
        if (session) {
          sgResolveCastStreamInfo(url, sgCastState.smoothModeActive).then(info => {
            const targetUrl = (sgCastState.smoothModeActive ? info.smoothUrl : info.playableUrl) || url;
            sgLoadMediaIntoGoogleCastSession(session, targetUrl, info, 0).catch(() => {});
          });
        }
      } catch (_) {}
    }

    function sgEnsureGoogleCastSdk() {
      if (window.cast?.framework?.CastContext && window.chrome?.cast?.media) {
        return Promise.resolve(true);
      }
      if (!window.chrome) return Promise.resolve(false);
      if (sgCastState.castSdkPromise) return sgCastState.castSdkPromise;

      sgCastState.castSdkPromise = new Promise(resolve => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          if (!ok) sgCastState.castSdkPromise = null;
          resolve(ok);
        };
        const prevCallback = window.__onGCastApiAvailable;
        window.__onGCastApiAvailable = function(isAvailable) {
          if (typeof prevCallback === 'function') {
            try { prevCallback(isAvailable); } catch (_) {}
          }
          if (isAvailable && window.cast?.framework?.CastContext) {
            try {
              const ctx = cast.framework.CastContext.getInstance();
              ctx.setOptions({
                receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
              });
            } catch (_) {}
            finish(true);
          } else {
            finish(false);
          }
        };
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        script.async = true;
        script.onerror = () => finish(false);
        setTimeout(() => finish(Boolean(window.cast?.framework?.CastContext)), 4000);
        document.head.appendChild(script);
      });
      return sgCastState.castSdkPromise;
    }

    async function sgLoadMediaIntoGoogleCastSession(session, playableUrl, streamInfo, startTimeSec = 0) {
      if (!session || !window.chrome?.cast?.media) return false;
      const isDirect = streamInfo?.kind === 'direct';
      const contentType = isDirect ? sgMimeTypeForStream(playableUrl, 'direct') : 'application/x-mpegurl';
      const mediaInfo = new chrome.cast.media.MediaInfo(playableUrl, contentType);
      mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;

      if (!isDirect) {
        if (chrome.cast.media.HlsSegmentFormat) {
          mediaInfo.hlsSegmentFormat = streamInfo?.isFmp4
            ? chrome.cast.media.HlsSegmentFormat.FMP4
            : chrome.cast.media.HlsSegmentFormat.TS;
        }
        if (chrome.cast.media.HlsVideoSegmentFormat) {
          mediaInfo.hlsVideoSegmentFormat = streamInfo?.isFmp4
            ? chrome.cast.media.HlsVideoSegmentFormat.FMP4
            : chrome.cast.media.HlsVideoSegmentFormat.MPEG2_TS;
        }
      }

      const metadata = new chrome.cast.media.GenericMediaMetadata();
      metadata.title = currentTitle?.textContent || currentPlayingMeta?.title || '拾光影视';
      metadata.subtitle = currentPlayingMeta?.siteName ? `线路: ${currentPlayingMeta.siteName}` : '电视投屏';
      if (currentPlayingMeta?.thumb && isSafeUrl(currentPlayingMeta.thumb)) {
        metadata.images = [new chrome.cast.Image(currentPlayingMeta.thumb)];
      }
      mediaInfo.metadata = metadata;

      const request = new chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      if (startTimeSec > 2) request.currentTime = Math.floor(startTimeSec);

      await session.loadMedia(request);
      sgCastState.active = true;
      syncCastUiState();
      sgUpdateCastModalStatusUI();
      showGestureTip('📺 已连接电视并同步播放');
      return true;
    }

    // 收集当前影片的所有备选源：若当前是从收藏夹/历史记录/单源卡片点进来导致内存无多源，自动实时检索已启用的采集站补充片源！
    async function sgGatherCandidateSourcesForCurrentVod() {
      if (!currentPlayingMeta?.title) return [];
      const rawTitle = currentPlayingMeta.title;
      const canonicalTitle = parseTitleAndVersion(rawTitle).canonical || rawTitle;
      const normCurTitle = normalizeCleanKey(canonicalTitle) || normalizeCleanKey(rawTitle);
      const currentSiteNorm = normalizeCleanKey(currentPlayingMeta.siteName);

      let group = (groupedVodList || []).find(g => normalizeCleanKey(g.title) === normCurTitle);
      const poolMap = new Map();

      if (group && Array.isArray(group.items)) {
        group.items.forEach(it => {
          const k = normalizeCleanKey(it.siteName);
          if (k && k !== currentSiteNorm && !poolMap.has(k)) {
            poolMap.set(k, it);
          }
        });
      }

      // 如果内存中没有其他备选源（例如从收藏夹、观看历史或首页直接进来的），自动并发检索可用源站获取同剧集线路
      if (poolMap.size < 2 && typeof auroraAllowedSites === 'function') {
        const sites = auroraAllowedSites().filter(s => normalizeCleanKey(s.name) !== currentSiteNorm).slice(0, 16);
        if (sites.length > 0) {
          await asyncPool(8, sites, async (site) => {
            const urlWd = site.api + (site.api.includes('?') ? '&' : '?') + 'ac=videolist&wd=' + encodeURIComponent(canonicalTitle) + '&out=json&pg=1';
            try {
              const raw = await fetchWithSmartProxy(urlWd, 2200);
              const data = JSON.parse(raw);
              const list = Array.isArray(data?.list) ? data.list : [];
              for (const vodItem of list) {
                const vName = String(vodItem?.vod_name || '').trim();
                const vClean = normalizeCleanKey(parseTitleAndVersion(vName).canonical) || normalizeCleanKey(vName);
                if (vClean === normCurTitle || vClean.includes(normCurTitle) || normCurTitle.includes(vClean)) {
                  const candidate = {
                    id: 'cast_auto_' + normalizeCleanKey(site.name) + '_' + Date.now(),
                    siteName: site.name,
                    versionTag: '',
                    vod: vodItem,
                    ping: -1
                  };
                  if (getEpisodesList(candidate).length > 0) {
                    poolMap.set(normalizeCleanKey(site.name), candidate);
                    break;
                  }
                }
              }
            } catch (_) {}
          });
        }
      }

      return Array.from(poolMap.values());
    }

    // 选项 2：🚀 电视卡顿加速（自动并发测速换最快片源 + 切换流畅码率 + 保留当前进度）
    async function sgBoostCastSmoothness() {
      if (isLiveMode || !currentPlayingMeta) {
        showGestureTip('🎬 请先播放一部电影或剧集');
        return false;
      }
      if (sgCastState.switchingSource) return false;
      sgCastState.switchingSource = true;
      sgCastState.smoothModeActive = true;

      sgPrepareVideoElementForCast();

      const smoothLabel = document.getElementById('cast-smooth-label');
      const smoothSub = document.getElementById('cast-smooth-sub');
      const smoothBtn = document.getElementById('btn-cast-smooth-boost');
      if (smoothBtn) smoothBtn.classList.add('is-active-mode');
      if (smoothLabel) smoothLabel.textContent = '2. 正在测速优选最快线路…';
      if (smoothSub) smoothSub.textContent = '⏳ 正在并发测试各片源响应速度，请稍候…';
      showGestureTip('🚀 正在为您测速切换最流畅的投屏线路…');

      const targetEpName = currentPlayingMeta.epName || '';
      const targetEpIdx = (currentPlayingMeta.epIdx !== undefined && currentPlayingMeta.epIdx >= 0) ? currentPlayingMeta.epIdx : currentActiveEp;
      const savedTime = Number(video?.currentTime) || 0;

      try {
        const candidates = await sgGatherCandidateSourcesForCurrentVod();
        const validMatches = [];

        if (candidates.length > 0) {
          await asyncPool(8, candidates, async (item) => {
            const eps = getEpisodesList(item);
            const epIdx = findMatchingEpisodeIndex(eps, targetEpName, targetEpIdx);
            if (epIdx < 0 || !eps[epIdx]?.url) return;
            let epUrl = eps[epIdx].url;
            if (window.location.protocol === 'https:' && epUrl.startsWith('http://')) {
              epUrl = epUrl.replace(/^http:\/\//i, 'https://');
            }
            const ping = await probeStreamLatency(epUrl);
            if (ping > 0 && ping < 9000) {
              item.ping = ping;
              validMatches.push({ item, epIdx, epUrl, ping });
            }
          });
        }

        validMatches.sort((a, b) => a.ping - b.ping);

        // 从最快的前 3 个片源中优先挑选 H.264 兼容源
        let bestMatch = null;
        for (const m of validMatches.slice(0, 3)) {
          const info = await sgResolveCastStreamInfo(m.epUrl, true);
          if (!info.isAudioOnly && !info.isHevcOnly) {
            bestMatch = { ...m, info };
            break;
          }
          if (!bestMatch && !info.isAudioOnly) {
            bestMatch = { ...m, info };
          }
        }
        if (!bestMatch && validMatches.length > 0) {
          bestMatch = { ...validMatches[0], info: null };
        }

        if (bestMatch) {
          activeSubItemId = bestMatch.item.id || activeSubItemId;
          if (bestMatch.info) {
            sgCastState.resolvedUrl = bestMatch.info.smoothUrl || bestMatch.info.playableUrl || bestMatch.epUrl;
            sgCastState.streamInfo = bestMatch.info;
          }
          playCurrentVodSource(bestMatch.item, bestMatch.epIdx, true);
          if (savedTime > 3) {
            const restoreOnce = () => {
              video.removeEventListener('playing', restoreOnce);
              try {
                if (!video.duration || savedTime < video.duration - 8) {
                  video.currentTime = savedTime;
                }
              } catch (_) {}
            };
            video.addEventListener('playing', restoreOnce, { once: true });
          }
          const cleanName = cleanSiteName(bestMatch.item.siteName);
          if (smoothLabel) smoothLabel.textContent = `2. 已切换至最快源：${cleanName} (${bestMatch.ping}ms)`;
          if (smoothSub) smoothSub.textContent = `✓ 已自动切换最快流畅线路并保留播放进度，如仍卡顿可再次点击换源`;
          showGestureTip(`🚀 已切换至最快线路：${cleanName} (${bestMatch.ping}ms)`);
          syncCastUiState();
          sgUpdateCastModalStatusUI();
          return true;
        }

        // 若当前确实只有单一可用源，则对该源启用流畅子流降码率防卡顿
        if (hls) {
          sgSelectBestAvHlsLevel(hls, true);
        } else if (currentStreamUrl) {
          const info = await sgResolveCastStreamInfo(currentStreamUrl, true);
          if (info.hasMultipleVariants && info.smoothUrl && info.smoothUrl !== currentStreamUrl) {
            await sgBindDirectAvStreamToVideo(info.smoothUrl, savedTime, true);
          }
        }
        if (smoothLabel) smoothLabel.textContent = '2. 已开启流畅防卡顿模式';
        if (smoothSub) smoothSub.textContent = '✓ 已优化当前线路缓冲与码率，减少电视端卡顿';
        showGestureTip('🚀 已开启流畅防卡顿加速模式');
        syncCastUiState();
        sgUpdateCastModalStatusUI();
        return false;
      } finally {
        sgCastState.switchingSource = false;
      }
    }

    // 选项 3：🔧 电视黑屏修复（有声音没画面点此：自动切换 H.264 兼容源或强制挂载 H.264 视频+音频直连流）
    async function sgFixCastBlackScreen(silentAuto = false) {
      if (isLiveMode || !currentPlayingMeta) {
        if (!silentAuto) showGestureTip('🎬 请先播放一部电影或剧集');
        return false;
      }
      if (sgCastState.switchingSource) return false;
      sgCastState.switchingSource = true;

      sgPrepareVideoElementForCast();

      const fixLabel = document.getElementById('cast-fix-black-label');
      const subLabel = document.getElementById('cast-switch-h264-sub');
      const fixBtn = document.getElementById('btn-cast-fix-black');
      if (fixBtn) fixBtn.classList.add('is-active-mode');
      if (fixLabel) fixLabel.textContent = '3. 正在修复电视画面兼容…';
      if (subLabel) subLabel.textContent = '⏳ 正在检测并切换兼容电视解码的 H.264 视频源…';
      if (!silentAuto) showGestureTip('🔧 正在修复电视有声音没画面问题…');

      const targetEpName = currentPlayingMeta.epName || '';
      const targetEpIdx = (currentPlayingMeta.epIdx !== undefined && currentPlayingMeta.epIdx >= 0) ? currentPlayingMeta.epIdx : currentActiveEp;
      const savedTime = Number(video?.currentTime) || 0;

      try {
        const candidates = await sgGatherCandidateSourcesForCurrentVod();
        let bestCandidate = null;
        let bestInfo = null;

        for (const item of candidates) {
          const eps = getEpisodesList(item);
          const epIdx = findMatchingEpisodeIndex(eps, targetEpName, targetEpIdx);
          if (epIdx < 0 || !eps[epIdx]?.url) continue;
          const epUrl = eps[epIdx].url;
          const info = await sgResolveCastStreamInfo(epUrl, false);
          if (!info.isAudioOnly && !info.isHevcOnly) {
            bestCandidate = { item, epIdx, epUrl };
            bestInfo = info;
            break;
          }
        }

        if (bestCandidate) {
          activeSubItemId = bestCandidate.item.id || activeSubItemId;
          sgCastState.resolvedUrl = bestInfo.playableUrl || bestCandidate.epUrl;
          sgCastState.streamInfo = bestInfo;

          playCurrentVodSource(bestCandidate.item, bestCandidate.epIdx, true);
          if (savedTime > 3) {
            const restoreOnce = () => {
              video.removeEventListener('playing', restoreOnce);
              try {
                if (!video.duration || savedTime < video.duration - 8) {
                  video.currentTime = savedTime;
                }
              } catch (_) {}
            };
            video.addEventListener('playing', restoreOnce, { once: true });
          }

          const cleanName = cleanSiteName(bestCandidate.item.siteName);
          if (fixLabel) fixLabel.textContent = `3. 已切换至兼容画面源：${cleanName}`;
          if (subLabel) subLabel.textContent = `✓ 已为您切换至 H.264 音画兼容线路并保留播放进度`;
          showGestureTip(`✓ 已切换至兼容画面源：${cleanName}`);
          sgUpdateCastModalStatusUI();
          return true;
        }

        // 若无其他 H.264 站点源，则从当前源解析 H.264 子流并强制直连输出
        await sgBindDirectAvStreamToVideo(currentStreamUrl, savedTime, false);
        if (fixLabel) fixLabel.textContent = '3. 画面兼容修复已开启';
        if (subLabel) subLabel.textContent = '✓ 已强制激活 H.264 视频轨与音频轨直连输出，请重新连接电视';
        if (!silentAuto) showGestureTip('✓ 已开启画面兼容直连修复');
        sgUpdateCastModalStatusUI();
        return false;
      } finally {
        sgCastState.switchingSource = false;
      }
    }

    // 保留旧函数别名兼容调用
    const sgSwitchToCompatibleH264Source = sgFixCastBlackScreen;

    function sgUpdateCastModalStatusUI() {
      const titleEl = document.getElementById('cast-now-playing-title');
      const avBadge = document.getElementById('cast-av-status-badge');
      const codecBadge = document.getElementById('cast-codec-badge');
      const diagTip = document.getElementById('cast-diag-tip');

      if (titleEl) {
        const siteLabel = currentPlayingMeta?.siteName ? ` (${cleanSiteName(currentPlayingMeta.siteName)})` : '';
        titleEl.textContent = (currentTitle?.textContent || currentPlayingMeta?.title || '当前未选择影视剧集') + siteLabel;
      }

      const health = sgDetectRuntimeAvHealth();
      const info = sgCastState.streamInfo;
      const resText = (health.width > 0 && health.height > 0) ? ` · ${health.width}×${health.height}` : '';

      if (avBadge) {
        if (health.isAudioOnly) {
          avBadge.className = 'sg-cast-badge sg-cast-badge-warn';
          avBadge.textContent = '⚠️ 当前线路缺失视频画面';
        } else if (sgCastState.active) {
          avBadge.className = 'sg-cast-badge sg-cast-badge-ok';
          avBadge.textContent = '📡 正在投屏到电视' + resText;
        } else {
          avBadge.className = 'sg-cast-badge sg-cast-badge-ok';
          avBadge.textContent = '✓ 音画同步已就绪' + resText;
        }
      }

      if (codecBadge) {
        if (health.isHevc) {
          codecBadge.className = 'sg-cast-badge sg-cast-badge-warn';
          codecBadge.textContent = 'H.265 编码 · 电视若黑屏请点第3项';
        } else if (sgCastState.smoothModeActive) {
          codecBadge.className = 'sg-cast-badge sg-cast-badge-ok';
          codecBadge.textContent = '🚀 防卡顿加速中';
        } else {
          codecBadge.className = 'sg-cast-badge';
          codecBadge.textContent = info?.codecLabel || '自适应流畅传输';
        }
      }

      if (diagTip) {
        if (health.isAudioOnly || health.isHevc) {
          diagTip.textContent = '提示：若电视只有声音没有画面，请点击下方“3. 电视黑屏修复”；若播放卡顿请点击“2. 电视卡顿加速”。';
        } else {
          diagTip.textContent = '点击“1. 连接电视设备投屏”即可投屏；若电视画面卡顿或黑屏，可随时点击下方对应按钮一键修复。';
        }
      }
    }

    function openCastModal() {
      if (!shouldShowVodCastBtn()) return;
      const mask = document.getElementById('cast-modal-mask');
      if (!mask) return;
      sgUpdateCastModalStatusUI();
      mask.style.display = 'flex';
    }

    function closeCastModal() {
      const mask = document.getElementById('cast-modal-mask');
      if (mask) mask.style.display = 'none';
    }

    // 点击播放器右下角“投屏”按钮的主入口：
    // 绝不重置正在播放的原生视频流（保留全部已缓冲数据防止电视卡顿），同时呼出系统投屏或打开直观的 3 项投屏面板
    async function triggerScreenCast(event) {
      if (event) event.stopPropagation();
      if (!shouldShowVodCastBtn()) {
        syncCastUiState();
        showGestureTip('📺 直播模式不支持投屏');
        return;
      }
      if (!currentStreamUrl || !isSafeUrl(currentStreamUrl)) {
        showGestureTip('🎬 请先选择一部电影或电视剧播放后再投屏');
        return;
      }

      // 1. 同步激活音画轨道并退出画中画，不重置 video.src 缓冲
      sgPrepareVideoElementForCast();

      // 2. 在支持原生 AirPlay 的设备上直接弹出系统投屏列表
      if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
        try {
          video.webkitShowPlaybackTargetPicker();
        } catch (_) {}
      }

      // 3. 打开直观的 3 选项电视投屏面板
      openCastModal();

      // 4. 后台静默分析编码信息用于更新状态提示（不打断、不重载当前播放流！）
      const targetStream = currentStreamUrl;
      sgResolveCastStreamInfo(targetStream, sgCastState.smoothModeActive).then(info => {
        if (currentStreamUrl !== targetStream || isLiveMode) return;
        sgCastState.lastRawUrl = targetStream;
        sgCastState.resolvedUrl = info.playableUrl || targetStream;
        sgCastState.streamInfo = info;
        sgUpdateCastModalStatusUI();
      });
    }

    // 选项 1：📺 连接电视设备投屏
    async function sgTriggerSystemWirelessCastFromModal(event) {
      if (event) event.stopPropagation();
      if (!shouldShowVodCastBtn() || !currentStreamUrl) {
        showGestureTip('🎬 请先播放一部影视作品');
        return;
      }

      sgPrepareVideoElementForCast();

      // 1. Apple AirPlay (iPhone / iPad / Mac Safari) — 直接呼出，不重载流，保持零卡顿
      if (video && typeof video.webkitShowPlaybackTargetPicker === 'function') {
        try {
          video.webkitShowPlaybackTargetPicker();
          showGestureTip('📺 请在弹出的列表中选择您的电视');
          return;
        } catch (_) {}
      }

      // 2. W3C Remote Playback API (Chrome / Edge / Android)
      if (video && video.remote && typeof video.remote.prompt === 'function') {
        const curSrc = video.currentSrc || video.getAttribute('src') || '';
        const canNativeOrAndroid = Boolean(video.canPlayType('application/vnd.apple.mpegurl') || /Android/i.test(navigator.userAgent));
        // 仅当 Android 处于 blob: 内存流时才在连接前转为真实直链；若是原生流则保持原缓冲不重载
        if (canNativeOrAndroid && curSrc.startsWith('blob:')) {
          await sgBindDirectAvStreamToVideo(sgCastState.resolvedUrl || currentStreamUrl, Number(video.currentTime) || 0, sgCastState.smoothModeActive);
        }
        try {
          await video.remote.prompt();
          sgCastState.active = true;
          syncCastUiState();
          sgUpdateCastModalStatusUI();
          showGestureTip('📺 已弹出无线投屏设备列表');
          return;
        } catch (err) {
          if (err?.name === 'NotFoundError') {
            showGestureTip('📡 未搜索到附近的投屏电视，请确认电视与手机在同一 Wi-Fi 下');
            return;
          }
        }
      }

      // 3. Google Cast CAF SDK (Chromecast / Android TV)
      const castReady = await sgEnsureGoogleCastSdk();
      if (castReady && window.cast?.framework?.CastContext) {
        try {
          const ctx = cast.framework.CastContext.getInstance();
          await ctx.requestSession();
          const session = ctx.getCurrentSession();
          if (session) {
            const info = sgCastState.streamInfo || await sgResolveCastStreamInfo(currentStreamUrl, sgCastState.smoothModeActive);
            const targetUrl = (sgCastState.smoothModeActive ? info.smoothUrl : info.playableUrl) || currentStreamUrl;
            await sgLoadMediaIntoGoogleCastSession(session, targetUrl, info, Number(video?.currentTime) || 0);
            return;
          }
        } catch (_) {}
      }

      // 4. 移动浏览器/系统投屏兜底：确保流地址为直连音画流
      const curSrc = video.currentSrc || video.getAttribute('src') || '';
      if (curSrc.startsWith('blob:')) {
        await sgBindDirectAvStreamToVideo(sgCastState.resolvedUrl || currentStreamUrl, Number(video?.currentTime) || 0, sgCastState.smoothModeActive);
      }
      showGestureTip('📺 已准备就绪，也可直接用手机控制中心或浏览器菜单的“投屏”连接电视');
    }

    // 绑定原生 AirPlay 与 W3C RemotePlayback 状态监听：
    // 关键优化：当原生 HLS (非 blob:) 已在播放时，AirPlay 连接绝不重置 video.src，从而保留全部缓冲与自适应码率，解决电视卡顿！
    (function sgBindNativeWirelessCastListeners() {
      if (!video) return;

      video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', async () => {
        const isWireless = Boolean(video.webkitCurrentPlaybackTargetIsWireless);
        if (isWireless && !shouldShowVodCastBtn()) {
          try { video.pause(); } catch (_) {}
          return;
        }
        sgCastState.active = isWireless;
        syncCastUiState();
        if (isWireless && currentStreamUrl && !isLiveMode) {
          sgPrepareVideoElementForCast();
          const curSrc = video.currentSrc || video.getAttribute('src') || '';
          // 只有当处于 blob: 内存流时才切换为真实直链；原生 http(s) 流直接无缝续播，不清空缓冲！
          if (curSrc.startsWith('blob:')) {
            const info = sgCastState.streamInfo || await sgResolveCastStreamInfo(currentStreamUrl, sgCastState.smoothModeActive);
            await sgBindDirectAvStreamToVideo(info?.playableUrl || currentStreamUrl, Number(video.currentTime) || 0, sgCastState.smoothModeActive);
          }
          showGestureTip('📺 电视投屏已连接，若播放卡顿可点投屏按钮选择“2. 电视卡顿加速”');
        }
        sgUpdateCastModalStatusUI();
      });

      if (video.remote && typeof video.remote.addEventListener === 'function') {
        const onRemoteStateChange = async () => {
          const state = video.remote.state;
          const connected = (state === 'connecting' || state === 'connected');
          if (connected && !shouldShowVodCastBtn()) return;
          sgCastState.active = connected;
          syncCastUiState();
          if (connected && currentStreamUrl && !isLiveMode) {
            sgPrepareVideoElementForCast();
            const curSrc = video.currentSrc || video.getAttribute('src') || '';
            if (curSrc.startsWith('blob:')) {
              const info = sgCastState.streamInfo || await sgResolveCastStreamInfo(currentStreamUrl, sgCastState.smoothModeActive);
              await sgBindDirectAvStreamToVideo(info?.playableUrl || currentStreamUrl, Number(video.currentTime) || 0, sgCastState.smoothModeActive);
            }
          } else if (state === 'disconnected' && !isLiveMode && currentStreamUrl) {
            sgCastState.directModeActive = false;
            syncCastUiState();
            const canNative = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
            if (!canNative && !hls) {
              const resumeAt = Number(video.currentTime) || 0;
              manualPlayOnly(currentStreamUrl).then(() => {
                if (resumeAt > 2) setTimeout(() => { try { video.currentTime = resumeAt; } catch (_) {} }, 350);
              });
            }
          }
          sgUpdateCastModalStatusUI();
        };
        video.remote.addEventListener('connecting', onRemoteStateChange);
        video.remote.addEventListener('connect', onRemoteStateChange);
        video.remote.addEventListener('disconnect', onRemoteStateChange);
      }

      document.addEventListener('DOMContentLoaded', () => {
        syncCastUiState();
        const castMask = document.getElementById('cast-modal-mask');
        if (castMask) {
          castMask.addEventListener('click', (e) => {
            if (e.target === castMask) closeCastModal();
          });
        }
      }, { once: true });
    })();
