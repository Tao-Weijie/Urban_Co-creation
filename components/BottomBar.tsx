import React from 'react';
import JSZip from 'jszip';

import { useGame } from '../context/GameContext';
import { DISPLAY_MODES, DisplayModeKey } from '@/game_engine/configE';

export default function BottomBar() {
  const {
    setStandardView,
    theme,
    handleToggleTheme,
    gameStarted,
    gameHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    isPaused,
    isGameOver,
    isTimelinePlaying,
    setIsTimelinePlaying,
    timelineFps,
    setTimelineFps,
    isCameraLocked,
    setIsCameraLocked,
    displayMode,
    setDisplayMode
  } = useGame();

  const [isExporting, setIsExporting] = React.useState(false);
  const [exportRatio, setExportRatio] = React.useState(0);
  const [isDockOpen, setIsDockOpen] = React.useState(false);

  const numModes = Object.keys(DISPLAY_MODES).length;
  const collapsedHeight = 40;
  const expandedHeight = numModes * 40;
  const dockContainerStyle = {
    width: '40px',
    height: isDockOpen ? `${expandedHeight}px` : `${collapsedHeight}px`,
    top: isDockOpen ? `${collapsedHeight - expandedHeight}px` : '0px',
  };

  const gameHistoryLength = gameHistory?.length ?? 0;
  const currentIndex = currentHistoryIndex;
  const onIndexChange = setCurrentHistoryIndex;
  const isDraggable = isPaused || isGameOver;

  const handleExportFrames = async () => {
    if (gameHistoryLength === 0) return;
    setIsExporting(true);

    let captureStream: MediaStream | null = null;
    const video = document.createElement('video');

    try {
      // 1. 获取屏幕捕获视频流（首帧开始，用户只需授权一次）
      captureStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          resizeMode: 'none',
          width: { ideal: window.screen.width * window.devicePixelRatio },
          height: { ideal: window.screen.height * window.devicePixelRatio }
        } as any,
        audio: false,
        preferCurrentTab: true
      } as any);

      const track = captureStream.getVideoTracks()[0];

      // 2. 将视频流接入虚拟 video 中并等待加载就绪
      video.srcObject = captureStream;
      video.autoplay = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(() => resolve())
            .catch((err) => reject(err));
        };
        // 超时降级处理以防挂死
        setTimeout(() => resolve(), 1200);
      });

      const zip = new JSZip();
      const originalIndex = currentIndex;
      const wasPlaying = isTimelinePlaying;

      if (wasPlaying) {
        setIsTimelinePlaying(false);
      }

      // 3. 按照时间轴连续捕获每一帧画面
      for (let i = 0; i < gameHistoryLength; i++) {
        onIndexChange(i);
        setExportRatio((i + 1) / gameHistoryLength);

        // 稍微等待 150ms 确保页面重绘并且已同步推送到视频轨道中
        await new Promise((resolve) => setTimeout(resolve, 150));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || window.innerWidth * window.devicePixelRatio;
        canvas.height = video.videoHeight || window.innerHeight * window.devicePixelRatio;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 直接将 video 视频帧作为图像源画到 canvas 上，不受 CORS 污染，100% 完整复原 UI
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const imgData = canvas.toDataURL('image/png').split(',')[1];
        zip.file(`frame_${String(i + 1).padStart(3, '0')}.png`, imgData, { base64: true });
      }

      // 4. 恢复原先的时间轴状态
      onIndexChange(originalIndex);
      if (wasPlaying) {
        setIsTimelinePlaying(true);
      }

      // 5. 停止录屏视频轨道，释放系统资源，顶部的分享录制条自动消失
      if (track) {
        track.stop();
      }

      // 6. 打包 ZIP 并下载
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urban_cocreation_timeline.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(err);
      // 用户取消录制或报错时，停止并给出提示
      if (captureStream) {
        captureStream.getVideoTracks().forEach((t) => t.stop());
      }
      alert('Export cancelled or failed: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportRatio(0);
      video.srcObject = null;
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center app-bar p-4 duration-500">
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Standard Views */}
        <div
          className={`app-bar-circle-btn flex items-center justify-center cursor-default hover:!text-zinc-700 dark:hover:!text-zinc-300 hover:!border-zinc-200/60 dark:hover:!border-zinc-700/60 hover:!bg-white dark:hover:!bg-zinc-900
            ${isExporting ? 'pointer-events-none opacity-30' : ''}`}
          title="Switch View"
        >
          <svg
            className="text-zinc-700 dark:text-zinc-300 transition-colors w-[20px] h-[20px]"
            viewBox="0 0 273 308"
            fill="currentColor"
          >
            <use href="/cube.svg#top" className="cursor-pointer hover:text-primary transition-colors" onClick={() => !isExporting && setStandardView('top')} />
            <use href="/cube.svg#left" className="cursor-pointer hover:text-primary transition-colors" onClick={() => !isExporting && setStandardView('left')} />
            <use href="/cube.svg#front" className="cursor-pointer hover:text-primary transition-colors" onClick={() => !isExporting && setStandardView('front')} />
          </svg>
        </div>

        {/* Lock Camera Button */}
        <button
          onClick={() => setIsCameraLocked(!isCameraLocked)}
          disabled={isExporting}
          className={`app-bar-circle-btn-base app-bar-circle-btn-icon-only-hover ${isCameraLocked ? '!text-pink-500' : ''}`}
          title={isCameraLocked ? 'Unlock Camera' : 'Lock Camera'}
        >
          <svg className="w-[20px] h-[20px]" fill="currentColor">
            <use href="/lock.svg#lock-icon" width="20" height="20" />
          </svg>
        </button>

        {/* Toggle Theme / Background Color Button */}
        <button
          onClick={handleToggleTheme}
          disabled={isExporting}
          className={`app-bar-circle-btn-base app-bar-circle-btn-icon-only-hover ${theme === 'light' ? '!text-pink-500' : ''}`}
          title="Toggle Theme Mode"
        >
          <svg
            className="w-[20px] h-[20px]"
            fill="currentColor"
          >
            <use href="/light.svg#light-icon" width="20" height="20" />
          </svg>
        </button>

        {/* Display Mode Dock */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div
            style={dockContainerStyle}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2 p-[3px] bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 rounded-full transition-all duration-300 ease-out overflow-hidden z-50"
          >
            {/* 当前激活的按钮，始终在最底部，点击它会触发展开或折叠 */}
            <button
              onClick={() => setIsDockOpen(!isDockOpen)}
              disabled={isExporting}
              style={{ width: '32px', height: '32px' }}
              className={`rounded-full flex-shrink-0 flex items-center justify-center text-[15px] font-black leading-none transition-all border outline-none
                ${isDockOpen
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-transparent text-zinc-700 dark:text-zinc-300 border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                }`}
              title="Toggle Display Mode"
            >
              {displayMode}
            </button>

            {/* 其他非激活按钮，展开时才会显示 */}
            {isDockOpen && (
              Object.keys(DISPLAY_MODES)
                .filter((key) => key !== displayMode)
                .map((modeKey) => {
                  const config = DISPLAY_MODES[modeKey];
                  return (
                    <button
                      key={modeKey}
                      onClick={() => {
                        setDisplayMode(modeKey);
                        setIsDockOpen(false);
                      }}
                      style={{ width: '32px', height: '32px' }}
                      className="rounded-full flex-shrink-0 flex items-center justify-center text-[15px] font-black leading-none transition-all border border-zinc-200/60 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 outline-none animate-in fade-in zoom-in-50 duration-200"
                      title={config.label}
                    >
                      {modeKey}
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Timeline Control Segment (Grows to the right when gameStarted is active) */}
      <div
        className={`relative flex items-center transition-all duration-500 ease-in-out overflow-hidden ${gameStarted && gameHistoryLength > 0
          ? 'w-[480px] opacity-100 translate-x-0 ml-2'
          : 'w-0 opacity-0 translate-x-10 pointer-events-none ml-0'
          }`}
      >
        {gameStarted && gameHistoryLength > 0 && (
          <div className="flex items-center gap-4 w-[480px] flex-shrink-0 animate-in fade-in slide-in-from-left-4 duration-300 delay-100">
            <button
              onClick={() => setIsTimelinePlaying(!isTimelinePlaying)}
              disabled={isExporting || (!isDraggable && gameHistoryLength <= 1)}
              className={`app-bar-circle-btn-base app-bar-circle-btn-icon-only-hover ${isTimelinePlaying ? '!text-pink-500' : ''}`}
              title={isTimelinePlaying ? "Pause Playback" : "Start Playback"}
            >
              <svg className="w-[20px] h-[20px]" fill="currentColor">
                {isTimelinePlaying ? (
                  <use href="/pause.svg#pause-icon" width="20" height="20" />
                ) : (
                  <use href="/play.svg#play-icon" width="20" height="20" />
                )}
              </svg>
            </button>

            {/* Slider with labels */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">1</span>
              <input
                type="range"
                min={0}
                max={gameHistoryLength - 1}
                value={currentIndex}
                disabled={isExporting || !isDraggable || isTimelinePlaying}
                onChange={(e) => onIndexChange(parseInt(e.target.value))}
                className={`flex-1 h-1.5 rounded-lg appearance-none bg-zinc-200 dark:bg-zinc-800 cursor-pointer accent-pink-500 outline-none ${(isExporting || !isDraggable || isTimelinePlaying) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700'
                  }`}
              />
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{gameHistoryLength}</span>
            </div>

            {/* Info, FPS & Export */}
            <div className="flex items-center gap-2 font-mono text-[9px]">
              {/* FPS Input */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 outline outline-1 outline-black/5 dark:outline-white/10 px-2 py-0.5 rounded-lg">
                <span className="text-zinc-400">FPS:</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={timelineFps}
                  disabled={isExporting}
                  onChange={(e) => {
                    const parsedVal = parseInt(e.target.value);
                    const nextFps = Math.max(1, Math.min(60, isNaN(parsedVal) ? 1 : parsedVal));
                    setTimelineFps(nextFps);
                  }}
                  className="w-7 bg-transparent text-center border-none outline-none font-bold text-pink-500"
                />
              </div>

              {/* Export Trigger */}
              <button
                onClick={handleExportFrames}
                disabled={isExporting}
                className={`app-bar-circle-btn-base app-bar-circle-btn-icon-only-hover ${isExporting ? '!opacity-100 !cursor-not-allowed' : ''}`}
                title="Export all timeline frames as ZIP"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="20px"
                  viewBox="0 -960 960 960"
                  width="20px"
                >
                  <defs>
                    {/* 线性渐变：垂直自下而上进行填充。 */}
                    {/* 当 exportRatio 为 0 时全为 currentColor；随着比例上升，粉色主题色从下往上逐渐充满图标。 */}
                    <linearGradient id="downloadProgressGrad" x1="0" y1="1" x2="0" y2="0">
                      <stop offset={`${exportRatio}`} stopColor="#ec4899" />
                      <stop offset={`${exportRatio}`} stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#downloadProgressGrad)"
                    d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"
                  />
                </svg>
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
